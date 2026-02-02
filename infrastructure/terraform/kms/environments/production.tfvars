# Production Environment Configuration
# HIPAA/SOC 2 Compliant Settings

environment = "production"
aws_region  = "us-west-2"

# Application IAM role (update with actual ARN)
application_role_arn = "arn:aws:iam::ACCOUNT_ID:role/scrybe-production-app-role"

# Key administrators (update with actual ARNs)
admin_role_arns = [
  "arn:aws:iam::ACCOUNT_ID:role/scrybe-admin-role",
  "arn:aws:iam::ACCOUNT_ID:role/security-team-role",
]

# Emergency access role (requires MFA)
emergency_access_role_arn = "arn:aws:iam::ACCOUNT_ID:role/scrybe-emergency-access"

# Maximum deletion window for production
deletion_window_days = 30
