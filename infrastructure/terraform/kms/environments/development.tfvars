# Development Environment Configuration
# Note: Development can use local key generation without KMS
# This config is for when you need KMS in development

environment = "development"
aws_region  = "us-west-2"

# Application IAM role (update with actual ARN)
application_role_arn = "arn:aws:iam::ACCOUNT_ID:role/scrybe-development-app-role"

# Key administrators (update with actual ARNs)
admin_role_arns = [
  "arn:aws:iam::ACCOUNT_ID:role/developer-role",
]

# No emergency access role for development
emergency_access_role_arn = ""

# Minimum deletion window for development
deletion_window_days = 7
