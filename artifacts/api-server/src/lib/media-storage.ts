import {
  GetObjectCommand,
  S3Client,
  type GetObjectCommandOutput,
  type S3ClientConfig,
} from "@aws-sdk/client-s3";
import type { MediaTrack } from "./media";

let client: S3Client | undefined;

export function objectStorageEnabled(): boolean {
  return Boolean(process.env["S3_BUCKET"]?.trim());
}

function cleanCredential(value: string | undefined, name: string): string {
  const cleaned = value?.trim();
  if (!cleaned) {
    throw new Error(`${name} must be set when S3_BUCKET is configured.`);
  }
  if (/[\r\n\0]/.test(cleaned)) {
    throw new Error(`${name} contains an invalid control character. Check the Render Environment value.`);
  }
  return cleaned;
}

function storageClient(): S3Client {
  if (client) return client;

  const accessKeyId = cleanCredential(
    process.env["S3_ACCESS_KEY_ID"] ?? process.env["AWS_ACCESS_KEY_ID"],
    "S3_ACCESS_KEY_ID",
  );
  const secretAccessKey = cleanCredential(
    process.env["S3_SECRET_ACCESS_KEY"] ??
      process.env["AWS_SECRET_ACCESS_KEY"],
    "S3_SECRET_ACCESS_KEY",
  );

  const config: S3ClientConfig = {
    region: process.env["S3_REGION"]?.trim() || "auto",
    forcePathStyle: process.env["S3_FORCE_PATH_STYLE"]?.trim() === "true",
    credentials: { accessKeyId, secretAccessKey },
  };

  const endpoint = process.env["S3_ENDPOINT"]?.trim();
  if (endpoint) config.endpoint = endpoint;

  client = new S3Client(config);
  return client;
}

export function mediaObjectKey(track: MediaTrack): string {
  const separator = String.fromCharCode(47);
  let prefix = process.env["S3_KEY_PREFIX"] ?? "";
  while (prefix.startsWith(separator)) prefix = prefix.slice(1);
  while (prefix.endsWith(separator)) prefix = prefix.slice(0, -1);
  return prefix ? `${prefix}/${track.file}` : track.file;
}

export async function getMediaObject(
  track: MediaTrack,
  range: string | undefined,
): Promise<GetObjectCommandOutput> {
  const bucket = process.env["S3_BUCKET"]?.trim();
  if (!bucket) throw new Error("S3_BUCKET is not configured.");

  return storageClient().send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: mediaObjectKey(track),
      Range: range,
    }),
  );
}
