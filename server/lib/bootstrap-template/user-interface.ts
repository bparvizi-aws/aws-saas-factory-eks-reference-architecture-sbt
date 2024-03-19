import * as aws_s3 from 'aws-cdk-lib/aws-s3';
import * as aws_iam from 'aws-cdk-lib/aws-iam';
import * as aws_cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as cdk from 'aws-cdk-lib';
import { CfnDistribution } from 'aws-cdk-lib/aws-cloudfront';
import { Construct } from 'constructs';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as control_plane from '@sbt/sbt/control-plane';
import * as path from 'path';
import { StaticSite } from './static-site';

export interface UserInterfaceProps {
  regApiGatewayUrl: string;
}

export class UserInterface extends Construct {
  public readonly appBucket: aws_s3.Bucket;
  public readonly appSiteUrl: string;
  constructor(scope: Construct, id: string, props: UserInterfaceProps) {
    super(scope, id);

    const distro = new control_plane.StaticSiteDistro(this, 'static-site-distro', {
      allowedMethods: ['GET', 'HEAD', 'OPTIONS'],
    });

    new StaticSite(this, 'admin-web-ui-stack', {
      name: 'AppSite',
      assetDirectory: path.join(__dirname, '../../../client/Application/'),
      production: true,
      regApiGatewayUrl: props.regApiGatewayUrl,
      distribution: distro.cloudfrontDistribution,
      appBucket: distro.siteBucket,
    });
    this.appSiteUrl = `https://${distro.cloudfrontDistribution.domainName}`;

    // this.appBucket = new aws_s3.Bucket(this, 'AppBucket', {
    //   encryption: aws_s3.BucketEncryption.S3_MANAGED,
    //   enforceSSL: true,
    //   blockPublicAccess: aws_s3.BlockPublicAccess.BLOCK_ALL,
    // });

    // this.appSite = new aws_cloudfront.CloudFrontWebDistribution(this, 'AppSite', {
    //   originConfigs: [
    //     {
    //       s3OriginSource: {
    //         s3BucketSource: this.appBucket,
    //       },
    //       behaviors: [
    //         {
    //           isDefaultBehavior: true,
    //         },
    //       ],
    //     },
    //   ],
    //   defaultRootObject: 'index.html',
    //   httpVersion: aws_cloudfront.HttpVersion.HTTP2,
    //   priceClass: aws_cloudfront.PriceClass.PRICE_CLASS_ALL,
    //   errorConfigurations: [
    //     {
    //       errorCode: 403,
    //       responseCode: 200,
    //       responsePagePath: '/index.html',
    //     },
    //     {
    //       errorCode: 404,
    //       responseCode: 200,
    //       responsePagePath: '/index.html',
    //     },
    //   ],
    // });

    // const cfnOriginAccessControl = new aws_cloudfront.CfnOriginAccessControl(
    //   this,
    //   'OriginAccessControl',
    //   {
    //     originAccessControlConfig: {
    //       name: `UserInterface-${this.node.id}`,
    //       originAccessControlOriginType: 's3',
    //       signingBehavior: 'always',
    //       signingProtocol: 'sigv4',
    //     },
    //   }
    // );

    // // https://github.com/aws/aws-cdk/issues/21771#issuecomment-1281190832
    // const cfnDistribution = this.appSite.node.defaultChild as CfnDistribution;
    // cfnDistribution.addPropertyOverride(
    //   'DistributionConfig.Origins.0.OriginAccessControlId',
    //   cfnOriginAccessControl.getAtt('Id')
    // );

    // this.appBucket.addToResourcePolicy(
    //   new aws_iam.PolicyStatement({
    //     actions: ['s3:GetObject'],
    //     principals: [new aws_iam.ServicePrincipal('cloudfront.amazonaws.com')],
    //     effect: aws_iam.Effect.ALLOW,
    //     resources: [this.appBucket.bucketArn + '/*'],
    //     conditions: {
    //       StringEquals: {
    //         'AWS:SourceArn': cdk.Arn.format(
    //           {
    //             service: 'cloudfront',
    //             resource: 'distribution',
    //             region: '', // must not specify a single region
    //             resourceName: this.appSite.distributionId,
    //           },
    //           cdk.Stack.of(this)
    //         ),
    //       },
    //     },
    //   })
    // );

    // const codeAssetDirectory = path.join(__dirname, '..', '..', '..', 'client', 'Application');
    // const siteConfig = {
    //   production: true,
    //   regApiGatewayUrl: props.regApiGatewayUrl,
    // };

    // const dockerImage = cdk.DockerImage.fromRegistry(
    //   'public.ecr.aws/docker/library/node:18.17.1-bookworm-slim'
    // );

    // new s3deploy.BucketDeployment(this, 'SiteCodeDeployment', {
    //   sources: [
    //     s3deploy.Source.asset(codeAssetDirectory, {
    //       assetHashType: cdk.AssetHashType.SOURCE,
    //       bundling: {
    //         image: dockerImage,
    //         entrypoint: ['bash', '-c'],
    //         user: 'root',
    //         bundlingFileAccess: cdk.BundlingFileAccess.VOLUME_COPY,
    //         command: [
    //           [
    //             'pwd',
    //             'yarn install',
    //             `echo 'export const environment = ${JSON.stringify(
    //               siteConfig
    //             )}' > ./src/environments/environment.prod.ts`,
    //             `echo 'export const environment = ${JSON.stringify(
    //               siteConfig
    //             )}' > ./src/environments/environment.ts`,
    //             'npm run build',
    //             'cp -r /asset-input/dist/* /asset-output/',
    //           ].join(' && '),
    //         ],
    //       },
    //     }),
    //   ],
    //   destinationBucket: this.appBucket,
    //   distribution: this.appSite, // invalidates distribution's edge caches
    //   prune: true,
    // });
  }
}
