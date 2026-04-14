# The bucket
resource "aws_s3_bucket" "app_assets" {
  bucket = var.tapestry_bucket_name
}

resource "aws_s3_bucket_public_access_block" "app_assets" {
  bucket                  = aws_s3_bucket.app_assets.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Least-privilege policy
data "aws_iam_policy_document" "s3_app" {
  statement {
    actions   = ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"]
    resources = ["${aws_s3_bucket.app_assets.arn}/*"]
  }
  statement {
    actions   = ["s3:ListBucket"]
    resources = [aws_s3_bucket.app_assets.arn]
  }
}

resource "aws_iam_policy" "s3_app" {
  name   = "tiered-2d-breeder-s3"
  policy = data.aws_iam_policy_document.s3_app.json
}

# Production: IAM user with long-lived keys (for Vercel)
resource "aws_iam_user" "app_prod" {
  name = "tiered-2d-breeder-prod"
}

resource "aws_iam_user_policy_attachment" "app_prod" {
  user       = aws_iam_user.app_prod.name
  policy_arn = aws_iam_policy.s3_app.arn
}

resource "aws_iam_access_key" "app_prod" {
  user = aws_iam_user.app_prod.name
}
