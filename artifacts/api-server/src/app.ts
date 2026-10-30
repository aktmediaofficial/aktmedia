import fs from "node:fs";
import path from "node:path";
import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const sessionSecret = process.env["SESSION_SECRET"];

if (!sessionSecret) {
  throw new Error("SESSION_SECRET must be set to secure playlist sessions.");
}

const app: Express = express();

// Render (and most hosts) terminate HTTPS at a proxy in front of the app.
app.set("trust proxy", 1);
app.disable("x-powered-by");

const allowedOrigins = (process.env["CORS_ORIGINS"] ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(
  cors({
    origin: allowedOrigins.length ? allowedOrigins : false,
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(sessionSecret));

app.use("/api", router);
// Unknown /api paths must answer with JSON, never with the website's index.html.
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Not found." });
});

// ---------------------------------------------------------------------------
// Website (Vite build). build.mjs copies artifacts/akt-media/dist/public into
// dist/public next to this bundle, so one Node service serves site + API.
// ---------------------------------------------------------------------------
const frontendDir = process.env["FRONTEND_DIR"]
  ? path.resolve(process.env["FRONTEND_DIR"])
  : path.resolve(__dirname, "public");
const indexHtml = path.join(frontendDir, "index.html");

// Audio must never be reachable through the static site. It is streamed only
// by /api/audio/stream after a short-lived, session-bound token is issued.
const AUDIO_EXTENSION = /\.(?:wav|mp3|m4a|aac|ogg|oga|flac|opus)$/i;
app.use("/samples", (req, res, next) => {
  let pathname = req.path;
  try {
    pathname = decodeURIComponent(pathname);
  } catch {
    // Keep the raw path; express.static will reject malformed paths anyway.
  }
  if (AUDIO_EXTENSION.test(pathname)) {
    res.status(404).type("text/plain").send("Not found.");
    return;
  }
  next();
});

if (fs.existsSync(indexHtml)) {
  logger.info({ frontendDir }, "Serving website files");

  app.use(
    express.static(frontendDir, {
      index: false,
      setHeaders(res, filePath) {
        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          // Vite fingerprints everything in /assets, so it can be cached for good.
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        } else if (filePath.endsWith(".html")) {
          res.setHeader("Cache-Control", "no-cache");
        }
      },
    }),
  );

  // Single-page-app fallback: page URLs get index.html, missing files stay 404.
  // (Express 5 no longer accepts a bare "*" route, so this is a plain middleware.)
  app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    if (path.extname(req.path)) return next();
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(indexHtml);
  });
} else {
  logger.error(
    { frontendDir },
    "Website build not found. Build @workspace/akt-media before @workspace/api-server.",
  );
  app.get("/", (_req, res) => {
    res
      .status(503)
      .type("text/plain")
      .send(
        "The website files are missing from this deploy. Build @workspace/akt-media before @workspace/api-server.",
      );
  });
}

export default app;
