import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const region = process.env.AWS_REGION;
const bucket = process.env.AWS_S3_TAPESTRY_BUCKET;

function getS3Client() {
  if (!region || !bucket) {
    throw new Error("Tapestry storage is not configured");
  }

  return new S3Client({ region });
}

export function isTapestryStorageConfigured() {
  return Boolean(region && bucket);
}

function sanitizePathSegment(value: string) {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

export function getTapestryStoragePrefix() {
  const overridePrefix = process.env.AWS_S3_TAPESTRY_PREFIX;
  if (overridePrefix) {
    return overridePrefix.replace(/^\/+|\/+$/g, "");
  }

  const deploymentPrefix =
    process.env.VERCEL_ENV === "production" ||
    process.env.NEXT_PUBLIC_VERCEL_ENV === "production" ||
    process.env.NODE_ENV === "production"
      ? "prod"
      : "dev";

  const branchName =
    process.env.AWS_S3_TAPESTRY_BRANCH_PREFIX ??
    process.env.VERCEL_GIT_COMMIT_REF;
  const sanitizedBranch = branchName ? sanitizePathSegment(branchName) : "";

  if (!sanitizedBranch || sanitizedBranch === "main" || sanitizedBranch === "master") {
    return deploymentPrefix;
  }

  return `${deploymentPrefix}/${sanitizedBranch}`;
}

export function buildTapestryObjectKey(input: {
  recordId: string;
  ownerScope: "user" | "anon";
  ownerId: string;
  eraName?: string;
  createdAt?: Date;
  extension?: string;
}) {
  const createdAt = input.createdAt ?? new Date();
  const date = createdAt.toISOString().slice(0, 10); // YYYY-MM-DD
  const extension = input.extension ?? "png";
  const safeOwnerId = input.ownerId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeEra = input.eraName ? sanitizePathSegment(input.eraName) : "unknown-era";
  const prefix = getTapestryStoragePrefix();

  return `${prefix}/tapestries/${input.ownerScope}/${safeOwnerId}/${safeEra}-${date}-${input.recordId}.${extension}`;
}

export async function uploadTapestryImage(input: {
  bytes: Uint8Array;
  key: string;
  mimeType: string;
}) {
  const s3 = getS3Client();

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: input.key,
      Body: input.bytes,
      ContentType: input.mimeType,
    })
  );

  return {
    bucket: bucket!,
    key: input.key,
    byteSize: input.bytes.byteLength,
  };
}

export async function readTapestryImage(input: { bucket: string; key: string }) {
  const s3 = getS3Client();
  const result = await s3.send(
    new GetObjectCommand({
      Bucket: input.bucket,
      Key: input.key,
    })
  );

  if (!result.Body) {
    throw new Error("Tapestry object body was empty");
  }

  return {
    bytes: await result.Body.transformToByteArray(),
    contentType: result.ContentType ?? "application/octet-stream",
    etag: result.ETag ?? undefined,
    lastModified: result.LastModified ?? undefined,
  };
}
