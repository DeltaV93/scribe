import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environments';

export interface StorageStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
}

/**
 * Storage Stack
 *
 * Creates:
 * - KMS key for S3 encryption (HIPAA requirement)
 * - S3 bucket for file uploads
 * - S3 bucket for call recordings (PHI - requires encryption)
 * - S3 bucket for exports
 *
 * All buckets use:
 * - Server-side encryption with KMS
 * - Versioning enabled
 * - Block all public access
 * - Lifecycle rules for cost management
 */
export class StorageStack extends cdk.Stack {
  public readonly kmsKey: kms.Key;
  public readonly uploadsBucket: s3.Bucket;
  public readonly recordingsBucket: s3.Bucket;
  public readonly exportsBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: StorageStackProps) {
    super(scope, id, props);

    const { config } = props;

    // ==========================================================================
    // KMS Key for S3 Encryption
    // ==========================================================================
    this.kmsKey = new kms.Key(this, 'S3EncryptionKey', {
      alias: `inkra-${config.name}-s3-key`,
      description: 'KMS key for S3 bucket encryption (HIPAA compliant)',
      enableKeyRotation: true,
      removalPolicy: config.name === 'production'
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
    });

    // ==========================================================================
    // Uploads Bucket (general file uploads)
    // ==========================================================================
    this.uploadsBucket = new s3.Bucket(this, 'UploadsBucket', {
      bucketName: `inkra-uploads-${config.name}-${this.account}`,

      // Encryption (HIPAA requirement)
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: this.kmsKey,
      bucketKeyEnabled: true,

      // Security
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      versioned: true,

      // CORS for presigned URL uploads
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT, s3.HttpMethods.POST],
          allowedOrigins: [`https://${config.domainName}`, 'http://localhost:3000'],
          allowedHeaders: ['*'],
          maxAge: 3600,
        },
      ],

      // Lifecycle rules
      lifecycleRules: [
        {
          id: 'DeleteIncompleteMultipartUploads',
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(7),
        },
        {
          id: 'TransitionToInfrequentAccess',
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(90),
            },
          ],
        },
      ],

      // Removal policy
      removalPolicy: config.name === 'production'
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: config.name !== 'production',
    });

    // ==========================================================================
    // Recordings Bucket (PHI - call recordings)
    // ==========================================================================
    this.recordingsBucket = new s3.Bucket(this, 'RecordingsBucket', {
      bucketName: `inkra-recordings-${config.name}-${this.account}`,

      // Encryption (HIPAA requirement - PHI data)
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: this.kmsKey,
      bucketKeyEnabled: true,

      // Security
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      versioned: true,

      // No CORS - recordings accessed server-side only

      // Lifecycle rules
      lifecycleRules: [
        {
          id: 'DeleteIncompleteMultipartUploads',
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(7),
        },
        {
          id: 'TransitionToGlacier',
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(90),
            },
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(180),
            },
          ],
        },
        {
          id: 'ExpireOldRecordings',
          expiration: cdk.Duration.days(config.s3ExpirationDays),
        },
      ],

      // Removal policy - ALWAYS RETAIN recordings in production
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // ==========================================================================
    // Exports Bucket (generated reports, exports)
    // ==========================================================================
    this.exportsBucket = new s3.Bucket(this, 'ExportsBucket', {
      bucketName: `inkra-exports-${config.name}-${this.account}`,

      // Encryption
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: this.kmsKey,
      bucketKeyEnabled: true,

      // Security
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      versioned: false, // Exports are ephemeral

      // CORS for downloads
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET],
          allowedOrigins: [`https://${config.domainName}`, 'http://localhost:3000'],
          allowedHeaders: ['*'],
          maxAge: 3600,
        },
      ],

      // Lifecycle rules - exports expire quickly
      lifecycleRules: [
        {
          id: 'ExpireExports',
          expiration: cdk.Duration.days(7), // Exports expire after 7 days
        },
      ],

      // Removal policy
      removalPolicy: config.name === 'production'
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: config.name !== 'production',
    });

    // ==========================================================================
    // Outputs
    // ==========================================================================
    new cdk.CfnOutput(this, 'UploadsBucketName', {
      value: this.uploadsBucket.bucketName,
      description: 'Uploads Bucket Name',
      exportName: `${config.name}-UploadsBucket`,
    });

    new cdk.CfnOutput(this, 'RecordingsBucketName', {
      value: this.recordingsBucket.bucketName,
      description: 'Recordings Bucket Name',
      exportName: `${config.name}-RecordingsBucket`,
    });

    new cdk.CfnOutput(this, 'ExportsBucketName', {
      value: this.exportsBucket.bucketName,
      description: 'Exports Bucket Name',
      exportName: `${config.name}-ExportsBucket`,
    });

    new cdk.CfnOutput(this, 'S3KmsKeyArn', {
      value: this.kmsKey.keyArn,
      description: 'S3 KMS Key ARN',
      exportName: `${config.name}-S3KmsKeyArn`,
    });
  }

  /**
   * Grant read/write access to a principal for all buckets
   */
  public grantReadWrite(principal: iam.IGrantable): void {
    this.uploadsBucket.grantReadWrite(principal);
    this.recordingsBucket.grantReadWrite(principal);
    this.exportsBucket.grantReadWrite(principal);
    this.kmsKey.grantEncryptDecrypt(principal);
  }
}
