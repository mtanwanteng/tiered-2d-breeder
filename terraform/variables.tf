variable "project_id" {
  description = "GCP project ID"
  type        = string
  default     = "sc-ai-innovation-lab-2-dev"
}

variable "region" {
  description = "GCP region for Vertex AI"
  type        = string
  default     = "us-central1"
}

variable "aws_region" {
  description = "AWS region for the tapestry bucket"
  type        = string
  default     = "us-east-1"
}

variable "tapestry_bucket_name" {
  description = "S3 bucket name for persisted tapestry images"
  type        = string
  default     = "bari-the-architect-assets"
}
