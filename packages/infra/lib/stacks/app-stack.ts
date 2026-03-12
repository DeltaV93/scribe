import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as apprunner from 'aws-cdk-lib/aws-apprunner';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environments';

export interface AppStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
  vpc: ec2.Vpc;
  appRunnerSecurityGroup: ec2.SecurityGroup;
  dbEndpoint: string;
  dbSecretArn: string;
  cacheEndpoint: string;
  uploadsBucket: string;
  recordingsBucket: string;
  exportsBucket: string;
  s3KmsKeyArn: string;
}

/**
 * App Stack
 *
 * Creates:
 * - IAM role for App Runner instance
 * - VPC Connector for App Runner
 * - App Runner service
 *
 * Note: App Runner source-based deployments require manual configuration
 * in the console or via apprunner.yaml. This stack creates the VPC Connector
 * and IAM roles that the service will use.
 */
export class AppStack extends cdk.Stack {
  public readonly vpcConnector: apprunner.CfnVpcConnector;
  public readonly instanceRole: iam.Role;
  public readonly accessRole: iam.Role;

  constructor(scope: Construct, id: string, props: AppStackProps) {
    super(scope, id, props);

    const { config, vpc, appRunnerSecurityGroup } = props;

    // ==========================================================================
    // IAM Role for App Runner Instance
    // ==========================================================================
    this.instanceRole = new iam.Role(this, 'AppRunnerInstanceRole', {
      roleName: `inkra-${config.name}-apprunner-instance-role`,
      assumedBy: new iam.ServicePrincipal('tasks.apprunner.amazonaws.com'),
      description: 'IAM role for App Runner instance to access AWS services',
    });

    // S3 permissions
    this.instanceRole.addToPolicy(new iam.PolicyStatement({
      sid: 'S3Access',
      effect: iam.Effect.ALLOW,
      actions: [
        's3:GetObject',
        's3:PutObject',
        's3:DeleteObject',
        's3:ListBucket',
      ],
      resources: [
        `arn:aws:s3:::${props.uploadsBucket}`,
        `arn:aws:s3:::${props.uploadsBucket}/*`,
        `arn:aws:s3:::${props.recordingsBucket}`,
        `arn:aws:s3:::${props.recordingsBucket}/*`,
        `arn:aws:s3:::${props.exportsBucket}`,
        `arn:aws:s3:::${props.exportsBucket}/*`,
      ],
    }));

    // KMS permissions for S3 encryption
    this.instanceRole.addToPolicy(new iam.PolicyStatement({
      sid: 'KMSAccess',
      effect: iam.Effect.ALLOW,
      actions: [
        'kms:Encrypt',
        'kms:Decrypt',
        'kms:GenerateDataKey',
      ],
      resources: [props.s3KmsKeyArn],
    }));

    // Secrets Manager permissions
    this.instanceRole.addToPolicy(new iam.PolicyStatement({
      sid: 'SecretsManagerAccess',
      effect: iam.Effect.ALLOW,
      actions: [
        'secretsmanager:GetSecretValue',
      ],
      resources: [
        `arn:aws:secretsmanager:${this.region}:${this.account}:secret:inkra-${config.name}/*`,
        props.dbSecretArn,
      ],
    }));

    // CloudWatch Logs permissions
    this.instanceRole.addToPolicy(new iam.PolicyStatement({
      sid: 'CloudWatchLogs',
      effect: iam.Effect.ALLOW,
      actions: [
        'logs:CreateLogGroup',
        'logs:CreateLogStream',
        'logs:PutLogEvents',
      ],
      resources: ['*'],
    }));

    // ==========================================================================
    // IAM Role for App Runner ECR Access (if using ECR)
    // ==========================================================================
    this.accessRole = new iam.Role(this, 'AppRunnerAccessRole', {
      roleName: `inkra-${config.name}-apprunner-access-role`,
      assumedBy: new iam.ServicePrincipal('build.apprunner.amazonaws.com'),
      description: 'IAM role for App Runner to access ECR',
    });

    this.accessRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSAppRunnerServicePolicyForECRAccess')
    );

    // ==========================================================================
    // VPC Connector
    // ==========================================================================
    this.vpcConnector = new apprunner.CfnVpcConnector(this, 'VpcConnector', {
      vpcConnectorName: `inkra-${config.name}-connector`,
      subnets: vpc.privateSubnets.map(subnet => subnet.subnetId),
      securityGroups: [appRunnerSecurityGroup.securityGroupId],
      tags: Object.entries(config.tags).map(([key, value]) => ({
        key,
        value,
      })),
    });

    // ==========================================================================
    // Outputs
    // ==========================================================================
    new cdk.CfnOutput(this, 'VpcConnectorArn', {
      value: this.vpcConnector.attrVpcConnectorArn,
      description: 'VPC Connector ARN',
      exportName: `${config.name}-VpcConnectorArn`,
    });

    new cdk.CfnOutput(this, 'InstanceRoleArn', {
      value: this.instanceRole.roleArn,
      description: 'App Runner Instance Role ARN',
      exportName: `${config.name}-InstanceRoleArn`,
    });

    new cdk.CfnOutput(this, 'AccessRoleArn', {
      value: this.accessRole.roleArn,
      description: 'App Runner Access Role ARN',
      exportName: `${config.name}-AccessRoleArn`,
    });

    // Output the environment variables that need to be set in App Runner
    new cdk.CfnOutput(this, 'RequiredEnvVars', {
      value: JSON.stringify({
        NODE_ENV: 'production',
        PORT: '8080',
        NEXT_PUBLIC_APP_URL: `https://${config.domainName}`,
        DATABASE_URL: `postgresql://inkra_admin:PASSWORD@${props.dbEndpoint}:5432/inkra`,
        DIRECT_URL: `postgresql://inkra_admin:PASSWORD@${props.dbEndpoint}:5432/inkra`,
        REDIS_URL: `redis://${props.cacheEndpoint}:6379`,
        AWS_REGION: this.region,
        AWS_S3_BUCKET_UPLOADS: props.uploadsBucket,
        AWS_S3_BUCKET_RECORDINGS: props.recordingsBucket,
        AWS_S3_BUCKET_EXPORTS: props.exportsBucket,
      }, null, 2),
      description: 'Environment variables to configure in App Runner',
    });
  }
}
