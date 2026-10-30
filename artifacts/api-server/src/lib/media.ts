import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import path from "node:path";

export type MediaTrack = {
  id: number;
  title: string;
  file: string;
  mime: string;
};

export const MEDIA_TRACKS: Record<number, MediaTrack> = {
  1: {
    id: 1,
    title: "Don't Be Dumb",
    file: "dont-be-dumb.wav",
    mime: "audio/wav",
  },
  2: {
    id: 2,
    title: "Ekseni",
    file: "ekseni.wav",
    mime: "audio/wav",
  },
  3: {
    id: 3,
    title: "Masambe",
    file: "masambe.wav",
    mime: "audio/wav",
  },
  4: {
    id: 4,
    title: "Money Moves",
    file: "money-moves.wav",
    mime: "audio/wav",
  },
  5: {
    id: 5,
    title: "Drip",
    file: "drip.wav",
    mime: "audio/wav",
  },
};

const DEFAULT_TOKEN_TTL_SECONDS = 600;

function mediaDirectory(): string {
  return process.env["MEDIA_DIR"]
    ? path.resolve(process.env["MEDIA_DIR"])
    : path.resolve(__dirname, "..", "media");
}

export function mediaFilePath(track: MediaTrack): string {
  return path.join(mediaDirectory(), track.file);
}

function signingSecret(): string {
  const secret =
    process.env["AUDIO_TOKEN_SECRET"] ?? process.env["SESSION_SECRET"];
  if (!secret) {
    throw new Error(
      "AUDIO_TOKEN_SECRET or SESSION_SECRET must be set before issuing audio tokens.",
    );
  }
  return secret;
}

function tokenTtlSeconds(): number {
  const configured = Number(process.env["AUDIO_TOKEN_TTL_SECONDS"]);
  return Number.isFinite(configured) && configured > 0
    ? configured
    : DEFAULT_TOKEN_TTL_SECONDS;
}

function userAgentHash(userAgent: string): string {
  return createHash("sha256")
    .update(userAgent)
    .digest("base64url")
    .slice(0, 22);
}

function signature(
  trackId: number,
  ownerId: string,
  userAgent: string,
  expiresAt: number,
): string {
  return createHmac("sha256", signingSecret())
    .update(`${trackId}.${expiresAt}.${ownerId}.${userAgentHash(userAgent)}`)
    .digest("base64url");
}

export function issueAudioToken(
  trackId: number,
  ownerId: string,
  userAgent: string,
): { token: string; expiresAt: number; expiresIn: number } {
  const expiresIn = tokenTtlSeconds();
  const expiresAt = Date.now() + expiresIn * 1000;
  const token = `${expiresAt}.${signature(trackId, ownerId, userAgent, expiresAt)}`;
  return { token, expiresAt, expiresIn };
}

export function verifyAudioToken(
  token: string,
  trackId: number,
  ownerId: string,
  userAgent: string,
): boolean {
  const [expiresRaw, providedSignature] = token.split(".");
  if (!expiresRaw || !providedSignature) return false;

  const expiresAt = Number(expiresRaw);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return false;

  const expectedSignature = signature(
    trackId,
    ownerId,
    userAgent,
    expiresAt,
  );
  const provided = Buffer.from(providedSignature);
  const expected = Buffer.from(expectedSignature);
  return (
    provided.length === expected.length && timingSafeEqual(provided, expected)
  );
}

export function isAllowedAudioRequest(
  origin: string | undefined,
  referer: string | undefined,
  host: string | undefined,
  fetchSite: string | undefined,
): boolean {
  const hostMatches = (url: string): boolean => {
    try {
      return new URL(url).host === host;
    } catch {
      return false;
    }
  };

  if (origin && !hostMatches(origin)) return false;
  if (referer && !hostMatches(referer)) return false;

  if (fetchSite) {
    return fetchSite === "same-origin";
  }

  return Boolean(referer && hostMatches(referer));
}
