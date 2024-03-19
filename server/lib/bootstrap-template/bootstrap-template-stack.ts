import {Stack, StackProps, CfnOutput} from 'aws-cdk-lib';
import {Construct} from 'constructs';
import {UserInterface} from './user-interface';
import {ApiKeySSMParameterNames} from '../interfaces/api-key-ssm-parameter-names';
import {Table, AttributeType} from 'aws-cdk-lib/aws-dynamodb';
import {PolicyDocument} from 'aws-cdk-lib/aws-iam';
import * as core_app_plane from '@cdklabs/sbt-aws'
import * as fs from 'fs';

interface BootstrapTemplateStackProps extends StackProps {
    controlPlaneSource: string;
    onboardingDetailType: string;
    provisioningDetailType: string;
    applicationNamePlaneSource: string;
    offboardingDetailType: string;
    deprovisioningDetailType: string;

    regApiGatewayUrl: string;
    eventBusArn: string;
    systemAdminEmail: string;
}

export class BootstrapTemplateStack extends Stack {
    public readonly userInterface: UserInterface;
    public readonly tenantMappingTable: Table;

    constructor(scope: Construct, id: string, props: BootstrapTemplateStackProps) {
        super(scope, id, props);

        const systemAdminEmail = props.systemAdminEmail;
        const applicationNamePlaneSource = props.applicationNamePlaneSource;
        const onboardingDetailType = props.onboardingDetailType;
        const offboardingDetailType = props.offboardingDetailType;
        const provisioningDetailType = props.provisioningDetailType;
        const deprovisioningDetailType = props.deprovisioningDetailType;
        const controlPlaneSource = props.controlPlaneSource;

        const regApiGatewayUrl = props.regApiGatewayUrl;
        const eventBusArn = props.eventBusArn;

        this.tenantMappingTable = new Table(this, 'TenantMappingTable', {
            partitionKey: {name: 'tenantId', type: AttributeType.STRING},
        });

        const provisioningJobRunnerProps = {
            name: 'provisioning',
            permissions: PolicyDocument.fromJson(
                JSON.parse(`
{
  "Version":"2012-10-17",
  "Statement":[
      {
        "Action":[
            "*"
        ],
        "Resource":"*",
        "Effect":"Allow"
      }
  ]
}
`)
            ),
            script: fs.readFileSync('../scripts/provision-eks-tenant.sh', 'utf8'),
            postScript: '',
            importedVariables: ['tenantId', 'tier', 'tenantName', 'email', 'tenantStatus'],
            exportedVariables: ['tenantConfig', 'tenantStatus'],
            scriptEnvironmentVariables: {
                // CDK_PARAM_SYSTEM_ADMIN_EMAIL is required because as part of deploying the bootstrap-template
                // the control plane is also deployed. To ensure the operation does not error out, this value
                // is provided as an env parameter.
                CDK_PARAM_SYSTEM_ADMIN_EMAIL: systemAdminEmail,
            },
            outgoingEvent: {
                source: applicationNamePlaneSource,
                detailType: provisioningDetailType,
            },
            incomingEvent: {
                source: [controlPlaneSource],
                detailType: [onboardingDetailType],
            },
        };

        const deprovisioningJobRunnerProps = {
            name: 'deprovisioning',
            permissions: PolicyDocument.fromJson(
                JSON.parse(`
{
  "Version":"2012-10-17",
  "Statement":[
      {
        "Action":[
            "*"
        ],
        "Resource":"*",
        "Effect":"Allow"
      }
  ]
}
`)
            ),
            script: fs.readFileSync('../scripts/deprovision-eks-tenant.sh', 'utf8'),
            importedVariables: ['tenantId', 'tier'],
            exportedVariables: ['tenantStatus'],
            outgoingEvent: {
                source: applicationNamePlaneSource,
                detailType: deprovisioningDetailType,
            },
            incomingEvent: {
                source: [controlPlaneSource],
                detailType: [offboardingDetailType],
            },
            scriptEnvironmentVariables: {
                TENANT_STACK_MAPPING_TABLE: this.tenantMappingTable.tableName,
                // CDK_PARAM_SYSTEM_ADMIN_EMAIL is required because as part of deploying the bootstrap-template
                // the control plane is also deployed. To ensure the operation does not error out, this value
                // is provided as an env parameter.
                CDK_PARAM_SYSTEM_ADMIN_EMAIL: systemAdminEmail,
            },
        };

        new core_app_plane.CoreApplicationPlane(this, 'CoreApplicationPlane', {
            eventBusArn: eventBusArn,
            controlPlaneSource: controlPlaneSource,
            applicationNamePlaneSource: applicationNamePlaneSource,
            jobRunnerPropsList: [provisioningJobRunnerProps, deprovisioningJobRunnerProps],
        });
    }
}
