import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
import { requireEnv, validateProductionEnv } from "./utils/env.js";
import { prisma } from "./utils/prisma.js";
import { runStartupChecks } from "./utils/startupChecks.js";

export async function startServer() {
  if (process.env.NODE_ENV === "production") {
    validateProductionEnv();
  } else {
    requireEnv(["DATABASE_URL", "JWT_SECRET"]);
  }

  const port = Number(process.env.PORT ?? 10000);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid PORT "${process.env.PORT}". PORT must be an integer between 1 and 65535.`);
  }

  const app = createApp();

  // Run non-fatal startup checks and print friendly guidance
  try {
    const issues = await runStartupChecks();
    if (Array.isArray(issues) && issues.length) {
      console.log('Startup checks:');
      for (const it of issues) {
        const prefix = it.level === 'error' ? 'ERROR' : it.level === 'warning' ? 'WARN' : 'INFO';
        for (const m of it.messages) console.log(`${prefix}: ${m}`);
      }
    }
  } catch (err) {
    console.warn('Startup checks failed:', err && err.message);
  }

  const server = await new Promise((resolve, reject) => {
    const candidate = app.listen(port);
    candidate.once("listening", () => {
      console.log(`Travel Share API listening on ${port}`);
      resolve(candidate);
    });
    candidate.once("error", (err) => {
      console.error(`Travel Share API failed to bind port ${port}`, err);
      reject(err);
    });
  });

  server.on("error", (err) => {
    console.error("Travel Share API server error", err);
  });

  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal} received. Shutting down Travel Share API.`);
    const forceExit = setTimeout(() => {
      console.error("Shutdown timed out; forcing exit.");
      process.exit(1);
    }, 10000);
    forceExit.unref();

    server.close(async (err) => {
      if (err) {
        console.error("HTTP server shutdown failed", err);
        process.exitCode = 1;
      }

      try {
        await prisma.$disconnect();
      } catch (disconnectErr) {
        console.error("Prisma disconnect failed", disconnectErr);
        process.exitCode = 1;
      } finally {
        clearTimeout(forceExit);
        process.exit();
      }
    });
  };

  process.once("SIGTERM", () => { void shutdown("SIGTERM"); });
  process.once("SIGINT", () => { void shutdown("SIGINT"); });
  process.once("uncaughtException", async (err) => {
    console.error("Uncaught exception", err);
    await shutdown("uncaughtException");
  });
  process.once("unhandledRejection", async (reason) => {
    console.error("Unhandled rejection", reason);
    await shutdown("unhandledRejection");
  });

  return server;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
const modulePath = fileURLToPath(import.meta.url);

if (invokedPath === modulePath) {
  startServer().catch((err) => {
    console.error("Failed to start Travel Share API", err);
    process.exit(1);
  });
}
