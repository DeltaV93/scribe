# SNS Configuration for ML Services Monitoring
# Provides notification topics and optional integrations

# =============================================================================
# Lambda for Slack Integration (Optional)
# =============================================================================

# IAM Role for Lambda
resource "aws_iam_role" "slack_notifier" {
  count = var.enable_slack_integration ? 1 : 0

  name = "${local.alarm_prefix}-slack-notifier"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })

  tags = local.default_tags
}

resource "aws_iam_role_policy" "slack_notifier" {
  count = var.enable_slack_integration ? 1 : 0

  name = "slack-notifier-policy"
  role = aws_iam_role.slack_notifier[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = aws_secretsmanager_secret.slack_webhook[0].arn
      }
    ]
  })
}

# Secret for Slack Webhook URL
resource "aws_secretsmanager_secret" "slack_webhook" {
  count = var.enable_slack_integration ? 1 : 0

  name        = "${local.alarm_prefix}-slack-webhook"
  description = "Slack webhook URL for alarm notifications"

  tags = local.default_tags
}

resource "aws_secretsmanager_secret_version" "slack_webhook" {
  count = var.enable_slack_integration && var.slack_webhook_url != "" ? 1 : 0

  secret_id     = aws_secretsmanager_secret.slack_webhook[0].id
  secret_string = var.slack_webhook_url
}

# Lambda Function for Slack Notifications
resource "aws_lambda_function" "slack_notifier" {
  count = var.enable_slack_integration ? 1 : 0

  function_name = "${local.alarm_prefix}-slack-notifier"
  role          = aws_iam_role.slack_notifier[0].arn
  handler       = "index.handler"
  runtime       = "python3.11"
  timeout       = 30
  memory_size   = 128

  filename         = data.archive_file.slack_notifier[0].output_path
  source_code_hash = data.archive_file.slack_notifier[0].output_base64sha256

  environment {
    variables = {
      SLACK_WEBHOOK_SECRET_ARN = aws_secretsmanager_secret.slack_webhook[0].arn
      ENVIRONMENT              = var.environment
    }
  }

  tags = local.default_tags
}

# Lambda source code
data "archive_file" "slack_notifier" {
  count = var.enable_slack_integration ? 1 : 0

  type        = "zip"
  output_path = "${path.module}/lambda/slack_notifier.zip"

  source {
    content  = <<-EOF
import json
import os
import urllib.request
import boto3

def get_slack_webhook_url():
    """Retrieve Slack webhook URL from Secrets Manager."""
    secret_arn = os.environ['SLACK_WEBHOOK_SECRET_ARN']
    client = boto3.client('secretsmanager')
    response = client.get_secret_value(SecretId=secret_arn)
    return response['SecretString']

def format_alarm_message(message):
    """Format CloudWatch alarm message for Slack."""
    alarm_name = message.get('AlarmName', 'Unknown')
    alarm_description = message.get('AlarmDescription', 'No description')
    new_state = message.get('NewStateValue', 'Unknown')
    old_state = message.get('OldStateValue', 'Unknown')
    reason = message.get('NewStateReason', 'No reason provided')
    timestamp = message.get('StateChangeTime', 'Unknown')
    region = message.get('Region', 'Unknown')
    environment = os.environ.get('ENVIRONMENT', 'unknown')

    # Color based on state
    color = '#36a64f' if new_state == 'OK' else '#ff0000' if new_state == 'ALARM' else '#ffcc00'
    emoji = ':white_check_mark:' if new_state == 'OK' else ':rotating_light:' if new_state == 'ALARM' else ':warning:'

    return {
        "attachments": [
            {
                "color": color,
                "blocks": [
                    {
                        "type": "header",
                        "text": {
                            "type": "plain_text",
                            "text": f"{emoji} CloudWatch Alarm: {alarm_name}",
                            "emoji": True
                        }
                    },
                    {
                        "type": "section",
                        "fields": [
                            {"type": "mrkdwn", "text": f"*Environment:*\n{environment}"},
                            {"type": "mrkdwn", "text": f"*Region:*\n{region}"},
                            {"type": "mrkdwn", "text": f"*State:*\n{old_state} → {new_state}"},
                            {"type": "mrkdwn", "text": f"*Time:*\n{timestamp}"}
                        ]
                    },
                    {
                        "type": "section",
                        "text": {
                            "type": "mrkdwn",
                            "text": f"*Description:*\n{alarm_description}"
                        }
                    },
                    {
                        "type": "section",
                        "text": {
                            "type": "mrkdwn",
                            "text": f"*Reason:*\n{reason}"
                        }
                    }
                ]
            }
        ]
    }

def handler(event, context):
    """Lambda handler for SNS -> Slack notifications."""
    print(f"Received event: {json.dumps(event)}")

    webhook_url = get_slack_webhook_url()

    for record in event.get('Records', []):
        sns_message = record.get('Sns', {}).get('Message', '{}')

        try:
            message = json.loads(sns_message)
        except json.JSONDecodeError:
            message = {'AlarmName': 'Unknown', 'AlarmDescription': sns_message}

        slack_message = format_alarm_message(message)

        req = urllib.request.Request(
            webhook_url,
            data=json.dumps(slack_message).encode('utf-8'),
            headers={'Content-Type': 'application/json'}
        )

        try:
            with urllib.request.urlopen(req) as response:
                print(f"Slack response: {response.read().decode('utf-8')}")
        except Exception as e:
            print(f"Error sending to Slack: {str(e)}")
            raise

    return {'statusCode': 200, 'body': 'OK'}
EOF
    filename = "index.py"
  }
}

# SNS Subscription for Lambda
resource "aws_sns_topic_subscription" "slack_alarms" {
  count = var.enable_slack_integration ? 1 : 0

  topic_arn = aws_sns_topic.alarms.arn
  protocol  = "lambda"
  endpoint  = aws_lambda_function.slack_notifier[0].arn
}

resource "aws_sns_topic_subscription" "slack_critical_alarms" {
  count = var.enable_slack_integration ? 1 : 0

  topic_arn = aws_sns_topic.critical_alarms.arn
  protocol  = "lambda"
  endpoint  = aws_lambda_function.slack_notifier[0].arn
}

# Lambda Permission for SNS
resource "aws_lambda_permission" "sns_alarms" {
  count = var.enable_slack_integration ? 1 : 0

  statement_id  = "AllowSNSAlarms"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.slack_notifier[0].function_name
  principal     = "sns.amazonaws.com"
  source_arn    = aws_sns_topic.alarms.arn
}

resource "aws_lambda_permission" "sns_critical_alarms" {
  count = var.enable_slack_integration ? 1 : 0

  statement_id  = "AllowSNSCriticalAlarms"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.slack_notifier[0].function_name
  principal     = "sns.amazonaws.com"
  source_arn    = aws_sns_topic.critical_alarms.arn
}

# CloudWatch Log Group for Lambda
resource "aws_cloudwatch_log_group" "slack_notifier" {
  count = var.enable_slack_integration ? 1 : 0

  name              = "/aws/lambda/${aws_lambda_function.slack_notifier[0].function_name}"
  retention_in_days = 14

  tags = local.default_tags
}

# =============================================================================
# SNS Topic Policy
# =============================================================================

resource "aws_sns_topic_policy" "alarms" {
  arn = aws_sns_topic.alarms.arn

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudWatchAlarms"
        Effect = "Allow"
        Principal = {
          Service = "cloudwatch.amazonaws.com"
        }
        Action   = "sns:Publish"
        Resource = aws_sns_topic.alarms.arn
      },
      {
        Sid    = "AllowAccountPublish"
        Effect = "Allow"
        Principal = {
          AWS = "*"
        }
        Action   = "sns:Publish"
        Resource = aws_sns_topic.alarms.arn
        Condition = {
          StringEquals = {
            "AWS:SourceOwner" = data.aws_caller_identity.current.account_id
          }
        }
      }
    ]
  })
}

resource "aws_sns_topic_policy" "critical_alarms" {
  arn = aws_sns_topic.critical_alarms.arn

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudWatchAlarms"
        Effect = "Allow"
        Principal = {
          Service = "cloudwatch.amazonaws.com"
        }
        Action   = "sns:Publish"
        Resource = aws_sns_topic.critical_alarms.arn
      },
      {
        Sid    = "AllowAccountPublish"
        Effect = "Allow"
        Principal = {
          AWS = "*"
        }
        Action   = "sns:Publish"
        Resource = aws_sns_topic.critical_alarms.arn
        Condition = {
          StringEquals = {
            "AWS:SourceOwner" = data.aws_caller_identity.current.account_id
          }
        }
      }
    ]
  })
}

# Data source for account ID
data "aws_caller_identity" "current" {}
