# Secrets Manager Module

variable "environment" { type = string }
variable "service_api_key" { type = string }
variable "database_url" { type = string }
variable "redis_url" { type = string }

resource "aws_secretsmanager_secret" "main" {
  name        = "ml-services/${var.environment}"
  description = "ML Services secrets for ${var.environment}"

  recovery_window_in_days = var.environment == "prod" ? 30 : 0
}

resource "aws_secretsmanager_secret_version" "main" {
  secret_id = aws_secretsmanager_secret.main.id

  secret_string = jsonencode({
    DATABASE_URL    = var.database_url
    REDIS_URL       = var.redis_url
    SERVICE_API_KEY = var.service_api_key
  })
}

output "secret_arn" {
  value = aws_secretsmanager_secret.main.arn
}

output "secret_name" {
  value = aws_secretsmanager_secret.main.name
}
