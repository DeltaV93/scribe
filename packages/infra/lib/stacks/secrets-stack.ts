import * as cdk from 'aws-cdk-lib';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as kms from 'aws-cdk-lib/aws-kms';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environments';

export interface SecretsStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
}

/**
 * Secrets Stack
 *
 * Creates Secrets Manager secrets for all application credentials.
 * These are created with placeholder values - you must update them
 * in the AWS Console after deployment.
 *
 * Secrets created:
 * - Supabase credentials
 * - Anthropic API key
 * - Deepgram API key
 * - Twilio credentials
 * - Stripe credentials
 * - Application secrets (MFA, sessions, etc.)
 */
export class SecretsStack extends cdk.Stack {
  public readonly kmsKey: kms.Key;
  public readonly supabaseSecret: secretsmanager.Secret;
  public readonly anthropicSecret: secretsmanager.Secret;
  public readonly deepgramSecret: secretsmanager.Secret;
  public readonly twilioSecret: secretsmanager.Secret;
  public readonly stripeSecret: secretsmanager.Secret;
  public readonly appSecret: secretsmanager.Secret;

  constructor(scope: Construct, id: string, props: SecretsStackProps) {
    super(scope, id, props);

    const { config } = props;

    // ==========================================================================
    // KMS Key for Secrets
    // ==========================================================================
    this.kmsKey = new kms.Key(this, 'SecretsKey', {
      alias: `inkra-${config.name}-secrets-key`,
      description: 'KMS key for Secrets Manager encryption',
      enableKeyRotation: true,
      removalPolicy: config.name === 'production'
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
    });

    // ==========================================================================
    // Supabase Credentials
    // ==========================================================================
    this.supabaseSecret = new secretsmanager.Secret(this, 'SupabaseSecret', {
      secretName: `inkra-${config.name}/supabase`,
      description: 'Supabase authentication credentials',
      encryptionKey: this.kmsKey,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          NEXT_PUBLIC_SUPABASE_URL: 'https://your-project.supabase.co',
          NEXT_PUBLIC_SUPABASE_ANON_KEY: 'your-anon-key',
          SUPABASE_SERVICE_ROLE_KEY: 'your-service-role-key',
        }),
        generateStringKey: '_placeholder',
      },
    });

    // ==========================================================================
    // Anthropic API Key
    // ==========================================================================
    this.anthropicSecret = new secretsmanager.Secret(this, 'AnthropicSecret', {
      secretName: `inkra-${config.name}/anthropic`,
      description: 'Anthropic Claude API key',
      encryptionKey: this.kmsKey,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          ANTHROPIC_API_KEY: 'sk-ant-api03-xxxx',
        }),
        generateStringKey: '_placeholder',
      },
    });

    // ==========================================================================
    // Deepgram API Key
    // ==========================================================================
    this.deepgramSecret = new secretsmanager.Secret(this, 'DeepgramSecret', {
      secretName: `inkra-${config.name}/deepgram`,
      description: 'Deepgram transcription API key',
      encryptionKey: this.kmsKey,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          DEEPGRAM_API_KEY: 'your-deepgram-key',
        }),
        generateStringKey: '_placeholder',
      },
    });

    // ==========================================================================
    // Twilio Credentials
    // ==========================================================================
    this.twilioSecret = new secretsmanager.Secret(this, 'TwilioSecret', {
      secretName: `inkra-${config.name}/twilio`,
      description: 'Twilio VoIP credentials',
      encryptionKey: this.kmsKey,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          TWILIO_ACCOUNT_SID: 'ACxxxx',
          TWILIO_AUTH_TOKEN: 'your-auth-token',
          TWILIO_TWIML_APP_SID: 'APxxxx',
          TWILIO_API_KEY: 'SKxxxx',
          TWILIO_API_SECRET: 'your-api-secret',
          TWILIO_PHONE_NUMBER: '+1234567890',
        }),
        generateStringKey: '_placeholder',
      },
    });

    // ==========================================================================
    // Stripe Credentials
    // ==========================================================================
    this.stripeSecret = new secretsmanager.Secret(this, 'StripeSecret', {
      secretName: `inkra-${config.name}/stripe`,
      description: 'Stripe payment credentials',
      encryptionKey: this.kmsKey,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          STRIPE_SECRET_KEY: 'sk_live_xxxx',
          STRIPE_WEBHOOK_SECRET: 'whsec_xxxx',
          NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_live_xxxx',
        }),
        generateStringKey: '_placeholder',
      },
    });

    // ==========================================================================
    // Application Secrets
    // ==========================================================================
    this.appSecret = new secretsmanager.Secret(this, 'AppSecret', {
      secretName: `inkra-${config.name}/app`,
      description: 'Application-specific secrets',
      encryptionKey: this.kmsKey,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          CRON_SECRET: 'generate-with-openssl-rand-hex-32',
          JOBS_API_KEY: 'generate-with-openssl-rand-hex-32',
          MFA_ENCRYPTION_KEY: 'generate-with-openssl-rand-hex-32',
          TRUSTED_DEVICE_SECRET: 'generate-with-openssl-rand-hex-32',
        }),
        generateStringKey: '_placeholder',
      },
    });

    // ==========================================================================
    // Outputs
    // ==========================================================================
    new cdk.CfnOutput(this, 'SupabaseSecretArn', {
      value: this.supabaseSecret.secretArn,
      description: 'Supabase Secret ARN',
    });

    new cdk.CfnOutput(this, 'AnthropicSecretArn', {
      value: this.anthropicSecret.secretArn,
      description: 'Anthropic Secret ARN',
    });

    new cdk.CfnOutput(this, 'TwilioSecretArn', {
      value: this.twilioSecret.secretArn,
      description: 'Twilio Secret ARN',
    });

    new cdk.CfnOutput(this, 'StripeSecretArn', {
      value: this.stripeSecret.secretArn,
      description: 'Stripe Secret ARN',
    });
  }

  /**
   * Get all secret ARNs for IAM policy
   */
  public getAllSecretArns(): string[] {
    return [
      this.supabaseSecret.secretArn,
      this.anthropicSecret.secretArn,
      this.deepgramSecret.secretArn,
      this.twilioSecret.secretArn,
      this.stripeSecret.secretArn,
      this.appSecret.secretArn,
    ];
  }
}
