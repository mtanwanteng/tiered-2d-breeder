terraform {
  required_version = ">= 1.5"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

provider "aws" {
  region = var.aws_region
}

# Enable Vertex AI API
resource "google_project_service" "vertex_ai" {
  service            = "aiplatform.googleapis.com"
  disable_on_destroy = false
}

# Service account for the app
resource "google_service_account" "breeder_app" {
  account_id   = "tiered-2d-breeder"
  display_name = "Tiered 2D Breeder App"
}

# Grant Vertex AI User role to the service account
resource "google_project_iam_member" "vertex_ai_user" {
  project = var.project_id
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:${google_service_account.breeder_app.email}"
}

# For production: use workload identity or attach this SA directly.
# For local dev: use `gcloud auth application-default login` (ADC).
