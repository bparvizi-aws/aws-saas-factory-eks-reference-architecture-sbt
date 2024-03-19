import {Stack, StackProps, CfnOutput} from 'aws-cdk-lib';
import {Construct} from 'constructs';
import * as control_plane from '@cdklabs/sbt-aws'
import {CognitoAuth} from "@cdklabs/sbt-aws";

interface ControlPlaneStackProps extends StackProps {
    controlPlaneSource: string;
    onboardingDetailType: string;
    provisioningDetailType: string;
    applicationNamePlaneSource: string;
    offboardingDetailType: string;
    idpName: string;
    systemAdminRoleName: string;
    systemAdminEmail: string;
}

export class ControlPlaneStack extends Stack {
    public readonly regApiGatewayUrl: string;
    public readonly eventBusArn: string;

    constructor(scope: Construct, id: string, props: ControlPlaneStackProps) {
        super(scope, id, props);

        const cognitoAuth = new CognitoAuth(this, 'CognitoAuth', {
            idpName: props.idpName,
            systemAdminRoleName: props.systemAdminRoleName,
            systemAdminEmail: props.systemAdminEmail,
            // optional parameter possibly populated by another construct or an argument
            // controlPlaneCallbackURL: 'https://example.com',
        });

        const controlPlane = new control_plane.ControlPlane(this, 'ControlPlane', {
            auth: cognitoAuth,
            applicationPlaneEventSource: props.applicationNamePlaneSource,
            provisioningDetailType: props.provisioningDetailType,
            controlPlaneEventSource: props.controlPlaneSource,
            onboardingDetailType: props.onboardingDetailType,
            offboardingDetailType: props.offboardingDetailType,
        });
        this.regApiGatewayUrl = controlPlane.controlPlaneAPIGatewayUrl;
        this.eventBusArn = controlPlane.eventBusArn;

    }
}
