#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { getEnvironment } from '../lib/config/environments';
import { NetworkStack } from '../lib/stacks/network-stack';
import { DatabaseStack } from '../lib/stacks/database-stack';
import { CacheStack } from '../lib/stacks/cache-stack';
import { StorageStack } from '../lib/stacks/storage-stack';
import { SecretsStack } from '../lib/stacks/secrets-stack';
import { AppStack } from '../lib/stacks/app-stack';

/**
 * Inkra Infrastructure CDK Application
 *
 * Usage:
 *   # Deploy all stacks to production
 *   cd packages/infra
 *   pnpm cdk deploy --all --context env=production
 *
 *   # Deploy specific stack
 *   pnpm cdk deploy InkraProductionNetwork --context env=production
 *
 *   # Preview changes
 *   pnpm cdk diff --all --context env=production
 *
 *   # Destroy (staging only)
 *   pnpm cdk destroy --all --context env=staging
 */

const app = new cdk.App();

// Get environment from context
const envName = app.node.tryGetContext('env') || 'staging';
const config = getEnvironment(envName);

// Validate account is set
if (!config.account) {
  console.warn('\n⚠️  Warning: CDK_DEFAULT_ACCOUNT not set.');
  console.warn('   Run: export CDK_DEFAULT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)\n');
}

const env = {
  account: config.account || process.env.CDK_DEFAULT_ACCOUNT,
  region: config.region,
};

const stackPrefix = `Inkra${config.name.charAt(0).toUpperCase() + config.name.slice(1)}`;

// =============================================================================
// Network Stack (VPC, Security Groups)
// =============================================================================
const networkStack = new NetworkStack(app, `${stackPrefix}Network`, {
  config,
  env,
  description: `Inkra ${config.name} network infrastructure (VPC, subnets, security groups)`,
  tags: config.tags,
});

// =============================================================================
// Secrets Stack (Secrets Manager)
// =============================================================================
const secretsStack = new SecretsStack(app, `${stackPrefix}Secrets`, {
  config,
  env,
  description: `Inkra ${config.name} secrets (API keys, credentials)`,
  tags: config.tags,
});

// =============================================================================
// Database Stack (RDS PostgreSQL)
// =============================================================================
const databaseStack = new DatabaseStack(app, `${stackPrefix}Database`, {
  config,
  env,
  vpc: networkStack.vpc,
  securityGroup: networkStack.dbSecurityGroup,
  description: `Inkra ${config.name} database (RDS PostgreSQL)`,
  tags: config.tags,
});
databaseStack.addDependency(networkStack);

// =============================================================================
// Cache Stack (ElastiCache Valkey)
// =============================================================================
const cacheStack = new CacheStack(app, `${stackPrefix}Cache`, {
  config,
  env,
  vpc: networkStack.vpc,
  securityGroup: networkStack.cacheSecurityGroup,
  description: `Inkra ${config.name} cache (ElastiCache Valkey)`,
  tags: config.tags,
});
cacheStack.addDependency(networkStack);

// =============================================================================
// Storage Stack (S3 Buckets)
// =============================================================================
const storageStack = new StorageStack(app, `${stackPrefix}Storage`, {
  config,
  env,
  description: `Inkra ${config.name} storage (S3 buckets)`,
  tags: config.tags,
});

// =============================================================================
// App Stack (App Runner, IAM Roles)
// =============================================================================
const appStack = new AppStack(app, `${stackPrefix}App`, {
  config,
  env,
  vpc: networkStack.vpc,
  appRunnerSecurityGroup: networkStack.appRunnerSecurityGroup,
  dbEndpoint: databaseStack.instance.dbInstanceEndpointAddress,
  dbSecretArn: databaseStack.secret.secretArn,
  cacheEndpoint: cacheStack.cluster.attrRedisEndpointAddress,
  uploadsBucket: storageStack.uploadsBucket.bucketName,
  recordingsBucket: storageStack.recordingsBucket.bucketName,
  exportsBucket: storageStack.exportsBucket.bucketName,
  s3KmsKeyArn: storageStack.kmsKey.keyArn,
  description: `Inkra ${config.name} application (App Runner, IAM)`,
  tags: config.tags,
});
appStack.addDependency(networkStack);
appStack.addDependency(databaseStack);
appStack.addDependency(cacheStack);
appStack.addDependency(storageStack);

// =============================================================================
// Summary
// =============================================================================
console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║  Inkra Infrastructure - ${config.name.toUpperCase().padEnd(52)}║
╠══════════════════════════════════════════════════════════════════════════════╣
║  Stacks:                                                                     ║
║    • ${stackPrefix}Network   - VPC, Subnets, Security Groups                 ║
║    • ${stackPrefix}Secrets   - Secrets Manager                               ║
║    • ${stackPrefix}Database  - RDS PostgreSQL                                ║
║    • ${stackPrefix}Cache     - ElastiCache Valkey                            ║
║    • ${stackPrefix}Storage   - S3 Buckets                                    ║
║    • ${stackPrefix}App       - App Runner, IAM Roles                         ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  Region: ${config.region.padEnd(67)}║
║  Domain: ${config.domainName.padEnd(67)}║
╚══════════════════════════════════════════════════════════════════════════════╝
`);

app.synth();
