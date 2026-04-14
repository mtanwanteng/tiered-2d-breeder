#gcp
output "service_account_email" {
  description = "Service account email for the app"
  value       = google_service_account.breeder_app.email
}

#s3
output "s3_bucket_name" {
  value = aws_s3_bucket.app_assets.bucket
}

output "s3_bucket_region" {
  value = var.aws_region
}

output "s3_prod_access_key_id" {
  value = aws_iam_access_key.app_prod.id
}

output "s3_prod_secret_access_key" {
  value     = aws_iam_access_key.app_prod.secret
  sensitive = true
}
