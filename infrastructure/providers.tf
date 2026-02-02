# =============================================================================
# Scrybe Infrastructure - Provider Configuration
# =============================================================================
# Terraform and AWS provider configuration for HIPAA/SOC 2 compliant setup
# =============================================================================

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Backend configuration for state management
  # Uncomment and configure for production use
  # backend "s3" {
  #   bucket         = "scrybe-terraform-state"
  #   key            = "infrastructure/terraform.tfstate"
  #   region         = "us-west-2"
  #   encrypt        = true
  #   dynamodb_table = "scrybe-terraform-locks"
  #   kms_key_id     = "alias/scrybe-terraform"
  # }
}

# Primary region provider
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = merge(var.common_tags, {
      Environment = var.environment
      Region      = var.aws_region
    })
  }
}

# Secondary region provider for cross-region replication
provider "aws" {
  alias  = "secondary"
  region = var.aws_region_secondary

  default_tags {
    tags = merge(var.common_tags, {
      Environment = var.environment
      Region      = var.aws_region_secondary
    })
  }
}

# Data source for current AWS account
data "aws_caller_identity" "current" {}

# Data source for current region
data "aws_region" "current" {}

# Data source for secondary region
data "aws_region" "secondary" {
  provider = aws.secondary
}
