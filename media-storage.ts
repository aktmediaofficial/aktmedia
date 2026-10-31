import {
  GetObjectCommand,
  ListObjectsV2Command,
  S3Client,
  type GetObjectCommandOutput,
  type S3ClientConfig,
} from "@aws-sdk/client-s3";
import { logger } from "./logger";
import { resolveLocalMediaFile, type MediaTrack } from "./media";
import { parseWavHeader } from "./wav-info";

let client: S3Client | undefined;

/** Thrown when none of a track's file names exist in the bucket. */
export class MediaNotFoundError extends Error {
  constructor(
    readonly tried: string[],
    readonly available: string[],
  ) {
    super(`Audio file not found in bucket. Tried: ${tried.join(", ")}`);
    this.name = "MediaNotFoundError";
  }
}

export function objectStorageEnabled(): boolean {
  return Boolean(process.env["S3_BUCKET"]?.trim());
}

/**
 * Environment values pasted from chat apps sometimes arrive as markdown links,
 * e.g. "[https://x](https://x)". Pull the plain URL back out.
 */
export function cleanEnvUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  let value = raw.trim();
  if (!value) return undefined;

  const markdown = value.match(/\]\(\s*(https?:\/\/[^)\s]+)\s*\)/);
  if (markdown?.[1]) {
    value = markdown[1];
  } else {
    const plain = value.match(/https?:\/\/[^\s\]\)"'<>]+/);
    if (plain) value = plain[0];
  }
  value = value.replace(/^["']+|["']+$/g, "").replace(/\/+$/, "");

  try {
    new URL(value);
  } catch {
    throw new Error(`S3_ENDPOINT is not a valid URL: "${raw}"`);
  }
  return value;
}

function cleanCredential(value: string | undefined, name: string): string {
  const cleaned = value?.trim();
  if (!cleaned) {
    throw new Error(`${name} must be set when S3_BUCKET is configured.`);
  }
  if (/[\r\n\0]/.test(cleaned)) {
    throw new Error(
      `${name} contains an invalid control character. Check the Render Environment value.`,
    );
  }
  return cleaned;
}

function backblazeRegion(endpoint: string | undefined): string | undefined {
  if (!endpoint) return undefined;
  return new URL(endpoint).hostname.match(/^s3\.([a-z0-9-]+)\.backblazeb2\.com$/)?.[1];
}

function storageClient(): S3Client {
  if (client) return client;

  const accessKeyId = cleanCredential(
    process.env["S3_ACCESS_KEY_ID"] ?? process.env["AWS_ACCESS_KEY_ID"],
    "S3_ACCESS_KEY_ID",
  );
  const secretAccessKey = cleanCredential(
    process.env["S3_SECRET_ACCESS_KEY"] ?? process.env["AWS_SECRET_ACCESS_KEY"],
    "S3_SECRET_ACCESS_KEY",
  );

  const endpoint = cleanEnvUrl(process.env["S3_ENDPOINT"]);
  const configuredRegion = process.env["S3_REGION"]?.trim();
  // Backblaze signs requests with the region from its endpoint, so "auto" would fail there.
  const region =
    (!configuredRegion || configuredRegion === "auto"
      ? backblazeRegion(endpoint)
      : configuredRegion) ?? "auto";
  const forcePath = process.env["S3_FORCE_PATH_STYLE"]?.trim();

  const config: S3ClientConfig = {
    region,
    forcePathStyle: forcePath ? forcePath === "true" : Boolean(backblazeRegion(endpoint)),
    credentials: { accessKeyId, secretAccessKey },
  };
  if (endpoint) config.endpoint = endpoint;

  client = new S3Client(config);
  return client;
}

function keyPrefix(): string {
  return (process.env["S3_KEY_PREFIX"] ?? "").trim().replace(/^\/+|\/+$/g, "");
}

function joinKey(...parts: string[]): string {
  return parts.filter(Boolean).join("/");
}

export function mediaObjectKeys(track: MediaTrack): string[] {
  const prefix = keyPrefix();
  const inFolder = track.files.map((file) => joinKey(prefix, track.folder, file));
  // Older layout: files at the bucket root (or directly under S3_KEY_PREFIX).
  const legacy = track.files.map((file) => joinKey(prefix, file));
  return [...inFolder, ...legacy];
}

function isMissingKey(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const name = (error as { name?: unknown }).name;
  if (name === "NoSuchKey" || name === "NotFound") return true;
  if (name === "NoSuchBucket") return false; // a wrong bucket name is a config error, not a missing song
  const status = (error as { $metadata?: { httpStatusCode?: unknown } }).$metadata
    ?.httpStatusCode;
  return status === 404;
}

/** "Don't Be Dumb.wav", "dont-be-dumb.wav" and "Don't Be Dumb (3).wav" all become "dontbedumb". */
function looseName(key: string): string {
  const base = key.split("/").pop() ?? key;
  return base
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/\s*\(\d+\)\s*$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export { looseName };

let listCache: { at: number; keys: string[] } | undefined;

async function listBucketKeys(): Promise<string[]> {
  if (listCache && Date.now() - listCache.at < 60_000) return listCache.keys;
  const bucket = process.env["S3_BUCKET"]?.trim();
  if (!bucket) return [];
  try {
    const prefix = keyPrefix();
    const out = await storageClient().send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix ? `${prefix}/` : undefined,
        MaxKeys: 500,
      }),
    );
    const keys = (out.Contents ?? [])
      .map((item) => item.Key)
      .filter((key): key is string => Boolean(key));
    listCache = { at: Date.now(), keys };
    return keys;
  } catch (error) {
    logger.warn(
      { err: error },
      "Could not list the audio bucket (the app key may not allow listing); exact file names only",
    );
    return [];
  }
}

const resolvedKeys = new Map<number, string>();

/** Image/video types the site may load from the bucket (never audio). */
export const ASSET_CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

const assetKeys = new Map<string, string>();

function extensionOf(key: string): string {
  const match = key.match(/\.[a-z0-9]+$/i);
  return match ? match[0].toLowerCase() : "";
}

/**
 * Finds a site asset in the bucket. The exact name is tried first; if it is not
 * there, a forgiving match inside the same folder is used (capitals, spaces,
 * hyphens, .jpg vs .jpeg, and a name that is a prefix of the other are ignored).
 */
export async function getAssetObject(
  folder: string,
  file: string,
  range: string | undefined,
): Promise<{ object: GetObjectCommandOutput; key: string }> {
  const prefix = keyPrefix();
  const exact = joinKey(prefix, folder, file);
  const cacheId = `${folder}/${file}`;
  const tried: string[] = [];

  const remembered = assetKeys.get(cacheId);
  if (remembered) {
    try {
      return { object: await fetchObject(remembered, range), key: remembered };
    } catch (error) {
      if (!isMissingKey(error)) throw error;
      assetKeys.delete(cacheId);
      tried.push(remembered);
    }
  }

  if (!tried.includes(exact)) {
    try {
      const object = await fetchObject(exact, range);
      assetKeys.set(cacheId, exact);
      return { object, key: exact };
    } catch (error) {
      if (!isMissingKey(error)) throw error;
      tried.push(exact);
    }
  }

  const available = await listBucketKeys();
  const folderPrefix = joinKey(prefix, folder) + "/";
  const candidates = available.filter(
    (key) =>
      key.startsWith(folderPrefix) &&
      !key.slice(folderPrefix.length).includes("/") &&
      extensionOf(key) in ASSET_CONTENT_TYPES,
  );
  const wanted = looseName(file);
  let match = candidates.find((key) => looseName(key) === wanted);
  if (!match) {
    const partial = candidates.filter((key) => {
      const name = looseName(key);
      return name.startsWith(wanted) || wanted.startsWith(name);
    });
    if (partial.length === 1) match = partial[0];
  }
  if (match) {
    const object = await fetchObject(match, range);
    assetKeys.set(cacheId, match);
    logger.warn(
      { requested: exact, found: match },
      "Site asset matched by approximate name; use the exact name in the site code to avoid this lookup",
    );
    return { object, key: match };
  }

  throw new MediaNotFoundError(tried, candidates);
}

function fetchObject(key: string, range: string | undefined): Promise<GetObjectCommandOutput> {
  const bucket = process.env["S3_BUCKET"]?.trim();
  if (!bucket) throw new Error("S3_BUCKET is not configured.");
  return storageClient().send(new GetObjectCommand({ Bucket: bucket, Key: key, Range: range }));
}

export async function getMediaObject(
  track: MediaTrack,
  range: string | undefined,
): Promise<GetObjectCommandOutput> {
  const tried: string[] = [];

  const remembered = resolvedKeys.get(track.id);
  if (remembered) {
    try {
      return await fetchObject(remembered, range);
    } catch (error) {
      if (!isMissingKey(error)) throw error;
      resolvedKeys.delete(track.id); // it was renamed or deleted; look again
      tried.push(remembered);
    }
  }

  for (const key of mediaObjectKeys(track)) {
    if (tried.includes(key)) continue;
    try {
      const object = await fetchObject(key, range);
      resolvedKeys.set(track.id, key);
      return object;
    } catch (error) {
      if (!isMissingKey(error)) throw error;
      tried.push(key);
    }
  }

  // Nothing matched exactly: fall back to a forgiving match against the real bucket listing.
  const available = await listBucketKeys();
  const wanted = new Set([...track.files, track.title].map(looseName));
  const folderPrefix = joinKey(keyPrefix(), track.folder) + "/";
  const match = available
    .filter((key) => key.startsWith(folderPrefix) && /\.wav$/i.test(key))
    .find((key) => wanted.has(looseName(key)));
  if (match) {
    const object = await fetchObject(match, range);
    resolvedKeys.set(track.id, match);
    logger.warn(
      { trackId: track.id, found: match, preferred: mediaObjectKeys(track)[0] },
      "Audio file matched by approximate name; renaming it to the preferred name makes lookups exact",
    );
    return object;
  }

  throw new MediaNotFoundError(tried, available);
}

/**
 * Runs once at startup and writes a plain-English report to the log: which songs
 * are in the bucket and whether browsers can actually play each file.
 */
export async function checkMediaStorage(tracks: MediaTrack[]): Promise<void> {
  if (!objectStorageEnabled()) {
    for (const track of tracks) {
      const file = await resolveLocalMediaFile(track);
      if (file) logger.info({ trackId: track.id, file }, "Audio file found on disk");
      else logger.warn({ trackId: track.id, title: track.title, looked: track.files }, "Audio file missing on disk");
    }
    return;
  }

  let ready = 0;
  for (const track of tracks) {
    try {
      const object = await getMediaObject(track, "bytes=0-4095");
      const head = Buffer.from((await object.Body?.transformToByteArray()) ?? []);
      const info = parseWavHeader(head);
      const key = resolvedKeys.get(track.id);

      if (!info) {
        logger.warn({ trackId: track.id, title: track.title, key }, "Audio file found, but it does not look like a WAV file");
      } else if (!info.playable) {
        logger.error(
          { trackId: track.id, title: track.title, key, format: info.summary },
          `Audio file CANNOT be played in browsers: ${info.problem}`,
        );
      } else {
        ready += 1;
        logger.info({ trackId: track.id, title: track.title, key, format: info.summary }, "Audio file OK");
      }
    } catch (error) {
      if (error instanceof MediaNotFoundError) {
        logger.error(
          { trackId: track.id, title: track.title, tried: error.tried, inBucket: error.available.slice(0, 50) },
          "Audio file NOT FOUND in the bucket",
        );
      } else {
        logger.error({ err: error, trackId: track.id, title: track.title }, "Could not check audio file in the bucket");
      }
    }
  }
  logger.info({ ready, total: tracks.length }, "Audio storage check finished");
}
