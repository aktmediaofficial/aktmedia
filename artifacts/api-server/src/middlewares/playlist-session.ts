import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";

const SESSION_COOKIE = "akt_playlist_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 365;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const playlistSession: RequestHandler = (req, res, next) => {
  const cookieValue = req.signedCookies?.[SESSION_COOKIE];
  const ownerId =
    typeof cookieValue === "string" && UUID_PATTERN.test(cookieValue)
      ? cookieValue
      : randomUUID();

  if (ownerId !== cookieValue) {
    res.cookie(SESSION_COOKIE, ownerId, {
      httpOnly: true,
      maxAge: SESSION_TTL_MS,
      path: "/api",
      sameSite: "lax",
      secure: process.env["NODE_ENV"] === "production",
      signed: true,
    });
  }

  res.locals["playlistOwnerId"] = ownerId;
  res.setHeader("Cache-Control", "private, no-store");
  next();
};
