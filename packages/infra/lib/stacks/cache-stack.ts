import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environments';

export interface CacheStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
  vpc: ec2.Vpc;
  securityGroup: ec2.SecurityGroup;
}

/**
 * Cache Stack
 *
 * Creates:
 * - ElastiCache Subnet Group
 * - ElastiCache Valkey (Redis-compatible) cluster
 *
 * Note: Valkey is the open-source Redis fork that AWS now supports.
 * It's fully compatible with Redis clients.
 */
export class CacheStack extends cdk.Stack {
  public readonly cluster: elasticache.CfnCacheCluster;
  public readonly endpoint: string;

  constructor(scope: Construct, id: string, props: CacheStackProps) {
    super(scope, id, props);

    const { config, vpc, securityGroup } = props;

    // ==========================================================================
    // Subnet Group
    // ==========================================================================
    const subnetGroup = new elasticache.CfnSubnetGroup(this, 'SubnetGroup', {
      cacheSubnetGroupName: `inkra-${config.name}-cache-subnet`,
      description: 'Subnet group for Inkra ElastiCache',
      subnetIds: vpc.privateSubnets.map(subnet => subnet.subnetId),
    });

    // ==========================================================================
    // ElastiCache Valkey Cluster
    // ==========================================================================
    this.cluster = new elasticache.CfnCacheCluster(this, 'CacheCluster', {
      clusterName: `inkra-${config.name}-cache`,
      engine: 'valkey', // Valkey is Redis-compatible
      engineVersion: '7.2',
      cacheNodeType: config.cacheNodeType,
      numCacheNodes: config.cacheNumNodes,

      // Networking
      cacheSubnetGroupName: subnetGroup.cacheSubnetGroupName,
      vpcSecurityGroupIds: [securityGroup.securityGroupId],

      // Configuration
      port: 6379,
      azMode: config.cacheNumNodes > 1 ? 'cross-az' : 'single-az',

      // Maintenance
      preferredMaintenanceWindow: 'sun:05:00-sun:06:00',

      // Snapshots (for production)
      snapshotRetentionLimit: config.name === 'production' ? 7 : 0,
      snapshotWindow: '04:00-05:00',

      // Tags
      tags: Object.entries(config.tags).map(([key, value]) => ({
        key,
        value,
      })),
    });

    this.cluster.addDependency(subnetGroup);

    // ==========================================================================
    // Outputs
    // ==========================================================================

    // For single-node cluster, endpoint is on the cluster itself
    // For multi-node, you'd use a replication group instead
    new cdk.CfnOutput(this, 'CacheEndpoint', {
      value: this.cluster.attrRedisEndpointAddress,
      description: 'ElastiCache Endpoint',
      exportName: `${config.name}-CacheEndpoint`,
    });

    new cdk.CfnOutput(this, 'CachePort', {
      value: this.cluster.attrRedisEndpointPort,
      description: 'ElastiCache Port',
      exportName: `${config.name}-CachePort`,
    });

    new cdk.CfnOutput(this, 'RedisUrl', {
      value: `redis://${this.cluster.attrRedisEndpointAddress}:6379`,
      description: 'Redis Connection URL',
    });
  }
}
