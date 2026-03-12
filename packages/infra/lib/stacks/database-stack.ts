import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environments';

export interface DatabaseStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
  vpc: ec2.Vpc;
  securityGroup: ec2.SecurityGroup;
}

/**
 * Database Stack
 *
 * Creates:
 * - KMS key for encryption at rest (HIPAA requirement)
 * - RDS PostgreSQL instance with pgvector extension
 * - Secrets Manager secret for database credentials
 */
export class DatabaseStack extends cdk.Stack {
  public readonly instance: rds.DatabaseInstance;
  public readonly secret: secretsmanager.ISecret;
  public readonly kmsKey: kms.Key;

  constructor(scope: Construct, id: string, props: DatabaseStackProps) {
    super(scope, id, props);

    const { config, vpc, securityGroup } = props;

    // ==========================================================================
    // KMS Key for Encryption
    // ==========================================================================
    this.kmsKey = new kms.Key(this, 'DbEncryptionKey', {
      alias: `inkra-${config.name}-db-key`,
      description: 'KMS key for RDS encryption (HIPAA compliant)',
      enableKeyRotation: true, // HIPAA requirement
      removalPolicy: config.name === 'production'
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
    });

    // ==========================================================================
    // Database Credentials
    // ==========================================================================
    const credentials = rds.Credentials.fromGeneratedSecret('inkra_admin', {
      secretName: `inkra-${config.name}-db-credentials`,
    });

    // ==========================================================================
    // RDS PostgreSQL Instance
    // ==========================================================================
    this.instance = new rds.DatabaseInstance(this, 'Database', {
      instanceIdentifier: `inkra-${config.name}-db`,
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_15_4,
      }),

      // Instance sizing
      instanceType: new ec2.InstanceType(config.dbInstanceClass),
      allocatedStorage: config.dbAllocatedStorage,
      maxAllocatedStorage: config.dbMaxAllocatedStorage,

      // Networking
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [securityGroup],
      publiclyAccessible: false,

      // Credentials
      credentials,
      databaseName: 'inkra',

      // Encryption (HIPAA requirement)
      storageEncrypted: true,
      storageEncryptionKey: this.kmsKey,

      // High availability
      multiAz: config.dbMultiAz,

      // Backups (HIPAA requirement)
      backupRetention: cdk.Duration.days(config.dbBackupRetention),
      preferredBackupWindow: '03:00-04:00', // 3-4 AM UTC
      preferredMaintenanceWindow: 'Sun:04:00-Sun:05:00',

      // Performance Insights (for monitoring)
      enablePerformanceInsights: true,
      performanceInsightRetention: rds.PerformanceInsightRetention.DEFAULT,

      // Deletion protection
      deletionProtection: config.dbDeletionProtection,
      removalPolicy: config.name === 'production'
        ? cdk.RemovalPolicy.SNAPSHOT
        : cdk.RemovalPolicy.DESTROY,

      // Parameter group for pgvector
      parameterGroup: new rds.ParameterGroup(this, 'ParameterGroup', {
        engine: rds.DatabaseInstanceEngine.postgres({
          version: rds.PostgresEngineVersion.VER_15_4,
        }),
        description: 'Parameter group for Inkra with pgvector support',
        parameters: {
          'shared_preload_libraries': 'pg_stat_statements',
          'log_statement': 'ddl',
          'log_min_duration_statement': '1000', // Log queries > 1s
        },
      }),
    });

    // Store the secret reference
    this.secret = this.instance.secret!;

    // ==========================================================================
    // Outputs
    // ==========================================================================
    new cdk.CfnOutput(this, 'DbEndpoint', {
      value: this.instance.dbInstanceEndpointAddress,
      description: 'Database Endpoint',
      exportName: `${config.name}-DbEndpoint`,
    });

    new cdk.CfnOutput(this, 'DbSecretArn', {
      value: this.secret.secretArn,
      description: 'Database Secret ARN',
      exportName: `${config.name}-DbSecretArn`,
    });

    new cdk.CfnOutput(this, 'DbConnectionString', {
      value: `postgresql://inkra_admin:PASSWORD@${this.instance.dbInstanceEndpointAddress}:5432/inkra`,
      description: 'Database Connection String Template (replace PASSWORD)',
    });
  }
}
