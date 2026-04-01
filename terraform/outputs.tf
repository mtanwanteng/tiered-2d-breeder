output "service_account_email" {
  description = "Service account email for the app"
  value       = google_service_account.breeder_app.email
}
