import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environments';

export interface NetworkStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
}

/**
 * Network Stack
 *
 * Creates:
 * - VPC with public and private subnets across 2 AZs
 * - NAT Gateway for private subnet internet access
 * - Security groups for RDS, ElastiCache, and App Runner
 */
export class NetworkStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;
  public readonly dbSecurityGroup: ec2.SecurityGroup;
  public readonly cacheSecurityGroup: ec2.SecurityGroup;
  public readonly appRunnerSecurityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: NetworkStackProps) {
    super(scope, id, props);

    const { config } = props;

    // ==========================================================================
    // VPC
    // ==========================================================================
    this.vpc = new ec2.Vpc(this, 'Vpc', {
      vpcName: `inkra-${config.name}-vpc`,
      ipAddresses: ec2.IpAddresses.cidr(config.vpcCidr),
      maxAzs: config.maxAzs,
      natGateways: 1, // Cost optimization: 1 NAT Gateway shared

      subnetConfiguration: [
        {
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 20,
        },
        {
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 20,
        },
        {
          name: 'Isolated',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 20,
        },
      ],

      // Enable DNS support for RDS
      enableDnsHostnames: true,
      enableDnsSupport: true,
    });

    // ==========================================================================
    // Security Groups
    // ==========================================================================

    // App Runner Security Group (for VPC Connector)
    this.appRunnerSecurityGroup = new ec2.SecurityGroup(this, 'AppRunnerSg', {
      vpc: this.vpc,
      securityGroupName: `inkra-${config.name}-apprunner-sg`,
      description: 'Security group for App Runner VPC Connector',
      allowAllOutbound: true,
    });

    // Database Security Group
    this.dbSecurityGroup = new ec2.SecurityGroup(this, 'DbSecurityGroup', {
      vpc: this.vpc,
      securityGroupName: `inkra-${config.name}-db-sg`,
      description: 'Security group for RDS PostgreSQL',
      allowAllOutbound: false,
    });

    // Allow App Runner to connect to RDS on port 5432
    this.dbSecurityGroup.addIngressRule(
      this.appRunnerSecurityGroup,
      ec2.Port.tcp(5432),
      'Allow PostgreSQL from App Runner'
    );

    // Cache Security Group
    this.cacheSecurityGroup = new ec2.SecurityGroup(this, 'CacheSecurityGroup', {
      vpc: this.vpc,
      securityGroupName: `inkra-${config.name}-cache-sg`,
      description: 'Security group for ElastiCache Valkey',
      allowAllOutbound: false,
    });

    // Allow App Runner to connect to ElastiCache on port 6379
    this.cacheSecurityGroup.addIngressRule(
      this.appRunnerSecurityGroup,
      ec2.Port.tcp(6379),
      'Allow Redis from App Runner'
    );

    // ==========================================================================
    // Outputs
    // ==========================================================================
    new cdk.CfnOutput(this, 'VpcId', {
      value: this.vpc.vpcId,
      description: 'VPC ID',
      exportName: `${config.name}-VpcId`,
    });

    new cdk.CfnOutput(this, 'PrivateSubnetIds', {
      value: this.vpc.privateSubnets.map(s => s.subnetId).join(','),
      description: 'Private Subnet IDs',
      exportName: `${config.name}-PrivateSubnetIds`,
    });

    new cdk.CfnOutput(this, 'AppRunnerSecurityGroupId', {
      value: this.appRunnerSecurityGroup.securityGroupId,
      description: 'App Runner Security Group ID',
      exportName: `${config.name}-AppRunnerSgId`,
    });
  }
}
