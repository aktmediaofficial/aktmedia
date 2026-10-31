import app from "./app";
import { logger } from "./lib/logger";
import { MEDIA_TRACKS } from "./lib/media";
import { checkMediaStorage } from "./lib/media-storage";
import { ensurePlaylistSchema } from "./lib/migrate";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function main(): Promise<void> {
  try {
    await ensurePlaylistSchema();
  } catch (err) {
    // Keep the website up even if the database is briefly unreachable;
    // playlist requests will report errors until it recovers.
    logger.error({ err }, "Could not prepare playlist tables");
  }

  app.listen(port, "0.0.0.0", (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");

    // Report which songs are in storage and whether browsers can play them.
    void checkMediaStorage(Object.values(MEDIA_TRACKS)).catch((error: unknown) =>
      logger.error({ err: error }, "Audio storage check failed"),
    );
  });
}

void main();
