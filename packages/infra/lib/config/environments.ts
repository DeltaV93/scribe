/**
 * Environment configuration for Inkra infrastructure
 *
 * Usage:
 *   cdk deploy --context env=production
 *   cdk deploy --context env=staging
 */

export interface EnvironmentConfig {
  name: string;
  account: string;
  region: string;

  // Domain
  domainName: string;

  // VPC
  vpcCidr: string;
  maxAzs: number;

  // RDS
  dbInstanceClass: string;
  dbAllocatedStorage: number;
  dbMaxAllocatedStorage: number;
  dbMultiAz: boolean;
  dbBackupRetention: number;
  dbDeletionProtection: boolean;

  // ElastiCache
  cacheNodeType: string;
  cacheNumNodes: number;

  // App Runner
  appRunnerCpu: string;
  appRunnerMemory: string;
  appRunnerMinSize: number;
  appRunnerMaxSize: number;

  // S3
  s3ExpirationDays: number;

  // Tags
  tags: Record<string, string>;
}

// Production environment - HIPAA compliant, high availability
export const production: EnvironmentConfig = {
  name: 'production',
  account: process.env.CDK_DEFAULT_ACCOUNT || '',
  region: 'us-east-2',

  domainName: 'app.oninkra.com',

  vpcCidr: '10.0.0.0/16',
  maxAzs: 2,

  // RDS - Production sizing
  dbInstanceClass: 'db.t3.medium',
  dbAllocatedStorage: 50,
  dbMaxAllocatedStorage: 200,
  dbMultiAz: true,
  dbBackupRetention: 30,
  dbDeletionProtection: true,

  // ElastiCache - Production sizing
  cacheNodeType: 'cache.t3.micro',
  cacheNumNodes: 2,

  // App Runner
  appRunnerCpu: '1024',      // 1 vCPU
  appRunnerMemory: '2048',   // 2 GB
  appRunnerMinSize: 1,
  appRunnerMaxSize: 10,

  // S3 - Keep recordings longer in production
  s3ExpirationDays: 365,

  tags: {
    Environment: 'production',
    Application: 'Inkra',
    ManagedBy: 'CDK',
    Compliance: 'HIPAA',
  },
};

// Staging environment - Cost-optimized, similar to production
export const staging: EnvironmentConfig = {
  name: 'staging',
  account: process.env.CDK_DEFAULT_ACCOUNT || '',
  region: 'us-east-2',

  domainName: 'staging.oninkra.com',

  vpcCidr: '10.1.0.0/16',
  maxAzs: 2,

  // RDS - Smaller for staging
  dbInstanceClass: 'db.t3.small',
  dbAllocatedStorage: 20,
  dbMaxAllocatedStorage: 50,
  dbMultiAz: false,
  dbBackupRetention: 7,
  dbDeletionProtection: false,

  // ElastiCache - Single node for staging
  cacheNodeType: 'cache.t3.micro',
  cacheNumNodes: 1,

  // App Runner - Smaller for staging
  appRunnerCpu: '512',       // 0.5 vCPU
  appRunnerMemory: '1024',   // 1 GB
  appRunnerMinSize: 1,
  appRunnerMaxSize: 3,

  // S3 - Shorter retention for staging
  s3ExpirationDays: 30,

  tags: {
    Environment: 'staging',
    Application: 'Inkra',
    ManagedBy: 'CDK',
  },
};

export const environments: Record<string, EnvironmentConfig> = {
  production,
  staging,
};

export function getEnvironment(envName: string): EnvironmentConfig {
  const env = environments[envName];
  if (!env) {
    throw new Error(`Unknown environment: ${envName}. Valid options: ${Object.keys(environments).join(', ')}`);
  }
  return env;
}
