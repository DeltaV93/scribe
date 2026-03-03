# RDS PostgreSQL Module

variable "environment" { type = string }
variable "vpc_id" { type = string }
variable "subnet_ids" { type = list(string) }
variable "instance_class" { type = string }
variable "allocated_storage" { type = number }
variable "database_name" { type = string }
variable "allowed_security_groups" { type = list(string) }

resource "random_password" "master" {
  length  = 32
  special = false
}

resource "aws_db_subnet_group" "main" {
  name       = "ml-services-${var.environment}"
  subnet_ids = var.subnet_ids

  tags = {
    Name = "ml-services-${var.environment}"
  }
}

resource "aws_security_group" "rds" {
  name        = "ml-services-rds-${var.environment}"
  description = "Security group for ML Services RDS"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = var.allowed_security_groups
  }

  tags = {
    Name = "ml-services-rds-${var.environment}"
  }
}

resource "aws_db_instance" "main" {
  identifier = "ml-services-${var.environment}"

  engine         = "postgres"
  engine_version = "16"
  instance_class = var.instance_class

  allocated_storage     = var.allocated_storage
  max_allocated_storage = var.allocated_storage * 2
  storage_type          = "gp3"
  storage_encrypted     = true

  db_name  = var.database_name
  username = "mlservices"
  password = random_password.master.result

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]

  backup_retention_period = var.environment == "prod" ? 7 : 1
  backup_window          = "03:00-04:00"
  maintenance_window     = "Mon:04:00-Mon:05:00"

  multi_az               = var.environment == "prod"
  deletion_protection    = var.environment == "prod"
  skip_final_snapshot    = var.environment != "prod"
  final_snapshot_identifier = var.environment == "prod" ? "ml-services-final-${var.environment}" : null

  performance_insights_enabled = true

  tags = {
    Name = "ml-services-${var.environment}"
  }
}

output "endpoint" {
  value = aws_db_instance.main.endpoint
}

output "connection_url" {
  value     = "postgresql+asyncpg://${aws_db_instance.main.username}:${random_password.master.result}@${aws_db_instance.main.endpoint}/${var.database_name}"
  sensitive = true
}

output "instance_identifier" {
  value = aws_db_instance.main.identifier
}
