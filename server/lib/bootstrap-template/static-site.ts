import { RemovalPolicy, Stack } from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as codecommit from 'aws-cdk-lib/aws-codecommit';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as actions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export interface StaticSiteProps {
  readonly name: string;
  readonly assetDirectory: string;
  readonly production: boolean;
  readonly defaultBranchName?: string;
  readonly distribution: cloudfront.Distribution;
  readonly regApiGatewayUrl: string;
  readonly appBucket: s3.Bucket;
}

export class StaticSite extends Construct {
  readonly repositoryUrl: string;

  constructor(scope: Construct, id: string, props: StaticSiteProps) {
    super(scope, id);

    const defaultBranchName = props.defaultBranchName ?? 'main';
    const repository = new codecommit.Repository(this, `${id}Repository`, {
      repositoryName: props.name,
      description: `Repository with code for ${props.name}`,
      code: codecommit.Code.fromDirectory(props.assetDirectory, defaultBranchName),
    });
    repository.applyRemovalPolicy(RemovalPolicy.DESTROY);
    this.repositoryUrl = repository.repositoryCloneUrlHttp;

    this.createCICDForStaticSite(
      id,
      repository,
      defaultBranchName,
      props.distribution.distributionId,
      props.production,
      props.regApiGatewayUrl,
      props.appBucket
    );
  }

  private createCICDForStaticSite(
    id: string,
    repo: codecommit.Repository,
    branchName: string,
    cloudfrontDistributionId: string,
    production: boolean,
    regApiGatewayUrl: string,
    bucket: s3.Bucket
  ) {
    const pipeline = new codepipeline.Pipeline(this, `${id}CodePipeline`, {
      crossAccountKeys: false,
      artifactBucket: new s3.Bucket(this, `${id}CodePipelineBucket`, {
        autoDeleteObjects: true,
        removalPolicy: RemovalPolicy.DESTROY,
      }),
    });
    const sourceArtifact = new codepipeline.Artifact();
    const siteConfig = {
      production: production,
      regApiGatewayUrl: regApiGatewayUrl,
    };

    pipeline.addStage({
      stageName: 'Source',
      actions: [
        new actions.CodeCommitSourceAction({
          actionName: 'Checkout',
          repository: repo,
          output: sourceArtifact,
          branch: branchName,
        }),
      ],
    });

    const buildProject = new codebuild.PipelineProject(this, `${id}AngularBuildProject`, {
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_5_0,
      },
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          install: {
            commands: ['npm install --force'],
          },
          build: {
            commands: [
              `echo 'export const environment = ${JSON.stringify(
                siteConfig
              )}' > ./src/environments/environment.prod.ts`,
              `echo 'export const environment = ${JSON.stringify(
                siteConfig
              )}' > ./src/environments/environment.ts`,
              'npm run build',
            ],
          },
        },
        artifacts: {
          files: ['**/*'],
          'base-directory': 'dist',
        },
      }),

      environmentVariables: {},
    });

    const buildOutput = new codepipeline.Artifact();

    pipeline.addStage({
      stageName: 'Build',
      actions: [
        new actions.CodeBuildAction({
          actionName: 'CompileNgSite',
          input: sourceArtifact,
          project: buildProject,
          outputs: [buildOutput],
        }),
      ],
    });

    const invalidateBuildProject = new codebuild.PipelineProject(this, `${id}InvalidateProject`, {
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          build: {
            commands: [
              'aws cloudfront create-invalidation --distribution-id ${CLOUDFRONT_ID} --paths "/*"',
            ],
          },
        },
      }),
      environmentVariables: {
        CLOUDFRONT_ID: { value: cloudfrontDistributionId },
      },
    });

    const distributionArn = `arn:aws:cloudfront::${
      Stack.of(this).account
    }:distribution/${cloudfrontDistributionId}`;

    invalidateBuildProject.addToRolePolicy(
      new iam.PolicyStatement({
        resources: [distributionArn],
        actions: ['cloudfront:CreateInvalidation'],
      })
    );

    pipeline.addStage({
      stageName: 'Deploy',
      actions: [
        new actions.S3DeployAction({
          actionName: 'CopyToS3',
          bucket: bucket,
          input: buildOutput,
          cacheControl: [actions.CacheControl.fromString('no-store')],
          runOrder: 1,
        }),
        new actions.CodeBuildAction({
          actionName: 'InvalidateCloudFront',
          input: buildOutput,
          project: invalidateBuildProject,
          runOrder: 2,
        }),
      ],
    });

    pipeline.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['codebuild:StartBuild'],
        resources: [buildProject.projectArn, invalidateBuildProject.projectArn],
        effect: iam.Effect.ALLOW,
      })
    );
  }
}
