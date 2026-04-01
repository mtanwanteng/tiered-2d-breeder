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
