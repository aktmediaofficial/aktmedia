import app from "./app";
import { logger } from "./lib/logger";
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
  });
}

void main();
