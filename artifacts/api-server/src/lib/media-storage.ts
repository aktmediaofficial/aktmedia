import {
  GetObjectCommand,
  S3Client,
  type GetObjectCommandOutput,
  type S3ClientConfig,
} from "@aws-sdk/client-s3";
import type { MediaTrack } from "./media";

let client: S3Client | undefined;

export function objectStorageEnabled(): boolean {
  return Boolean(process.env["S3_BUCKET"]);
}

function storageClient(): S3Client {
  if (client) return client;

  const accessKeyId =
    process.env[
005632ed43532bc0000000002] ?? process.env[
005632ed43532bc0000000002];
  const secretAccessKey =
    process.env[
005632ed43532bc0000000002] ??
    process.env[K005QwGunUAM2p01HlYtNtmSQLusW7g];

  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      "S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY must be set when S3_BUCKET is configured.",
    );
  }

  const config: S3ClientConfig = {
    region: process.env["S3_REGION"] ?? "auto",
    forcePathStyle: process.env["S3_FORCE_PATH_STYLE"] === "true",
    credentials: { accessKeyId, secretAccessKey },
  };

  const endpoint = process.env["S3_ENDPOINT"];
  if (endpoint) config.endpoint = endpoint;

  client = new S3Client(config);
  return client;
}

export function mediaObjectKey(track: MediaTrack): string {
  const prefix = (process.env["S3_KEY_PREFIX"] ?? "").replace(
    /^\/+|\/+$/g,
    "",
  );
  return prefix ? `${prefix}/${track.file}` : track.file;
}

export async function getMediaObject(
  track: MediaTrack,
  range: string | undefined,
): Promise<GetObjectCommandOutput> {
  const bucket = process.env["S3_BUCKET"];
  if (!bucket) throw new Error("S3_BUCKET is not configured.");

  return storageClient().send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: mediaObjectKey(track),
      Range: range,
    }),
  );
}
