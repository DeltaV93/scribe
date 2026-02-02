# Staging Environment Configuration

environment = "staging"
aws_region  = "us-west-2"

# Application IAM role (update with actual ARN)
application_role_arn = "arn:aws:iam::ACCOUNT_ID:role/scrybe-staging-app-role"

# Key administrators (update with actual ARNs)
admin_role_arns = [
  "arn:aws:iam::ACCOUNT_ID:role/scrybe-admin-role",
]

# No emergency access role for staging
emergency_access_role_arn = ""

# Shorter deletion window for staging
deletion_window_days = 7
