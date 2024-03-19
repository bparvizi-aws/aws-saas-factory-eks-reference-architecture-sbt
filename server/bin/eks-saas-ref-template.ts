#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { DestroyPolicySetter } from '../lib/cdk-aspect/destroy-policy-setter';
import { BootstrapTemplateStack } from '../lib/bootstrap-template/bootstrap-template-stack';
import { getEnv } from '../lib/helper-functions';
import { ControlPlaneStack } from '../lib/control-plane-stack';

// EKS reference architecture additions.
import 'source-map-support/register';
import { EKSClusterStack } from '../lib/eks-cluster-stack';
import { StaticSitesStack } from '../lib/static-sites-stack';
import { ServicesStack } from '../lib/services-stack';
import { CommonResourcesStack } from '../lib/common-resources-stack';
import { ApiStack } from '../lib/api-stack';

// TODO: make sure env vars are set.
const env = {
    account: process.env.AWS_ACCOUNT,
    region: process.env.AWS_REGION
};

const clusterName = "EKSSaaS";
const ingressControllerName = "saasnginxingressctrl";
const tenantOnboardingProjectName = "TenantOnboardingProject";
const tenantDeletionProjectName = "TenantDeletionProject";
const sharedServiceAccountName = "shared-service-account";

const customDomain = process.env.npm_config_domain && process.env.npm_config_domain.length > 0 ? process.env.npm_config_domain : undefined;
const hostedZoneId = process.env.npm_config_hostedzone && process.env.npm_config_hostedzone.length > 0 ? process.env.npm_config_hostedzone : undefined;
const saasAdminEmail = process.env.npm_config_email!;
const kubecostToken = process.env.npm_config_kubecosttoken && process.env.npm_config_kubecosttoken.length > 0 ? process.env.npm_config_kubecosttoken : undefined;

// Initializes a CDK application.
const app = new cdk.App();

// required input parameters
if (!process.env.CDK_PARAM_SYSTEM_ADMIN_EMAIL) {
  throw new Error('Please provide system admin email');
}

if (!process.env.CDK_PARAM_TENANT_ID) {
  console.log('Tenant ID is empty, a default tenant id "pooled" will be assigned');
}
const pooledId = 'pooled';

const systemAdminEmail = process.env.CDK_PARAM_SYSTEM_ADMIN_EMAIL;
const tenantId = process.env.CDK_PARAM_TENANT_ID || pooledId;
const codeCommitRepositoryName = getEnv('CDK_PARAM_CODE_COMMIT_REPOSITORY_NAME');
const controlPlaneSource = getEnv('CDK_PARAM_CONTROL_PLANE_SOURCE');
const onboardingDetailType = getEnv('CDK_PARAM_ONBOARDING_DETAIL_TYPE');
const offboardingDetailType = getEnv('CDK_PARAM_OFFBOARDING_DETAIL_TYPE');
const provisioningDetailType = getEnv('CDK_PARAM_PROVISIONING_DETAIL_TYPE');
const deprovisioningDetailType = getEnv('CDK_PARAM_DEPROVISIONING_DETAIL_TYPE');
const applicationNamePlaneSource = getEnv('CDK_PARAM_APPLICATION_NAME_PLANE_SOURCE');
const commitId = getEnv('CDK_PARAM_COMMIT_ID');

if (!process.env.CDK_PARAM_IDP_NAME) {
  process.env.CDK_PARAM_IDP_NAME = 'COGNITO';
}
if (!process.env.CDK_PARAM_SYSTEM_ADMIN_ROLE_NAME) {
  process.env.CDK_PARAM_SYSTEM_ADMIN_ROLE_NAME = 'SystemAdmin';
}

// default values for optional input parameters
const defaultStageName = 'prod';
const defaultLambdaReserveConcurrency = '1';
const defaultLambdaCanaryDeploymentPreference = 'True';
const defaultIdpName = 'COGNITO';
const defaultSystemAdminRoleName = 'SystemAdmin';

// optional input parameters
const idpName = process.env.CDK_PARAM_IDP_NAME || defaultIdpName;
const systemAdminRoleName =
  process.env.CDK_PARAM_SYSTEM_ADMIN_ROLE_NAME || defaultSystemAdminRoleName;
const stageName = process.env.CDK_PARAM_STAGE_NAME || defaultStageName;
const lambdaReserveConcurrency = Number(
  process.env.CDK_PARAM_LAMBDA_RESERVE_CONCURRENCY || defaultLambdaReserveConcurrency
);
const lambdaCanaryDeploymentPreference =
  process.env.CDK_PARAM_LAMBDA_CANARY_DEPLOYMENT_PREFERENCE ||
  defaultLambdaCanaryDeploymentPreference;

// Build stacks.

// EKS Stacks start.
const clusterStack = new EKSClusterStack(app, 'EKSSaaSCluster', {
    env,
    clusterName: clusterName,
    ingressControllerName: ingressControllerName,
    tenantOnboardingProjectName: tenantOnboardingProjectName,
    tenantDeletionProjectName: tenantDeletionProjectName,
    sharedServiceAccountName: sharedServiceAccountName,
    kubecostToken: kubecostToken,
    customDomain: customDomain,
    hostedZoneId: hostedZoneId
});

const apiStack = new ApiStack(app, 'SaaSApi', {
    env,
    eksClusterName: clusterName,
    ingressControllerName: ingressControllerName,
    internalNLBDomain: clusterStack.nlbDomain,
    vpc: clusterStack.vpc,
    customDomain: customDomain,
    hostedZoneId: hostedZoneId
});

const sitesStack = new StaticSitesStack(app, 'StaticSites', {
    env,
    apiUrl: apiStack.apiUrl,
    saasAdminEmail: saasAdminEmail,
    hostedZoneId: hostedZoneId,
    customBaseDomain: customDomain,
    usingKubeCost: !!kubecostToken,
});

const commonResource = new CommonResourcesStack(app, 'CommonResources', {
    env,
});

const svcStack = new ServicesStack(app, 'Services', {
    env,
    internalNLBApiDomain: clusterStack.nlbDomain,
    eksClusterName: clusterName,
    eksClusterOIDCProviderArn: clusterStack.openIdConnectProviderArn,
    codebuildKubectlRoleArn: clusterStack.codebuildKubectlRoleArn,
    appSiteDistributionId: sitesStack.applicationSiteDistribution.distributionId,
    appSiteCloudFrontDomain: sitesStack.applicationSiteDistribution.distributionDomainName,
    sharedServiceAccountName: sharedServiceAccountName,
    appHostedZoneId: hostedZoneId,
    customDomain: customDomain,
});
// EKS Stacks end.

const controlPlaneStack = new ControlPlaneStack(app, 'ControlPlaneStack', {
  idpName: idpName,
  systemAdminEmail: systemAdminEmail,
  systemAdminRoleName: systemAdminRoleName,
  controlPlaneSource: controlPlaneSource,
  onboardingDetailType: onboardingDetailType,
  provisioningDetailType: provisioningDetailType,
  applicationNamePlaneSource: applicationNamePlaneSource,
  offboardingDetailType: offboardingDetailType,
});

const bootstrapTemplateStack = new BootstrapTemplateStack(
  app,
  'eks-saas-ref-arch-bootstrap-stack',
  {
    systemAdminEmail: systemAdminEmail,
    regApiGatewayUrl: controlPlaneStack.regApiGatewayUrl,
    eventBusArn: controlPlaneStack.eventBusArn,
    controlPlaneSource: controlPlaneSource,
    onboardingDetailType: onboardingDetailType,
    provisioningDetailType: provisioningDetailType,
    applicationNamePlaneSource: applicationNamePlaneSource,
    offboardingDetailType: offboardingDetailType,
    deprovisioningDetailType: deprovisioningDetailType,
  }
);
cdk.Aspects.of(bootstrapTemplateStack).add(new DestroyPolicySetter());
