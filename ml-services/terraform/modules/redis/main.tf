# ElastiCache Redis Module

variable "environment" { type = string }
variable "vpc_id" { type = string }
variable "subnet_ids" { type = list(string) }
variable "node_type" { type = string }
variable "allowed_security_groups" { type = list(string) }

resource "aws_elasticache_subnet_group" "main" {
  name       = "ml-services-${var.environment}"
  subnet_ids = var.subnet_ids
}

resource "aws_security_group" "redis" {
  name        = "ml-services-redis-${var.environment}"
  description = "Security group for ML Services Redis"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = var.allowed_security_groups
  }

  tags = {
    Name = "ml-services-redis-${var.environment}"
  }
}

resource "aws_elasticache_cluster" "main" {
  cluster_id           = "ml-services-${var.environment}"
  engine               = "redis"
  engine_version       = "7.0"
  node_type            = var.node_type
  num_cache_nodes      = 1
  parameter_group_name = "default.redis7"
  port                 = 6379

  subnet_group_name  = aws_elasticache_subnet_group.main.name
  security_group_ids = [aws_security_group.redis.id]

  snapshot_retention_limit = var.environment == "prod" ? 7 : 0

  tags = {
    Name = "ml-services-${var.environment}"
  }
}

output "endpoint" {
  value = aws_elasticache_cluster.main.cache_nodes[0].address
}

output "connection_url" {
  value = "redis://${aws_elasticache_cluster.main.cache_nodes[0].address}:6379/0"
}

output "cluster_id" {
  value = aws_elasticache_cluster.main.cluster_id
}
