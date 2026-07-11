import { spawn } from "node:child_process";
import net from "node:net";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function getAvailablePort(preferred = 10000) {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();

    probe.once("error", (err) => {
      if (err.code === "EADDRINUSE") {
        const fallback = net.createServer();
        fallback.once("listening", () => {
          const port = fallback.address().port;
          fallback.close(() => resolve(port));
        });
        fallback.once("error", reject);
        fallback.listen(0);
      } else {
        reject(err);
      }
    });

    probe.once("listening", () => {
      const port = probe.address().port;
      probe.close(() => resolve(port));
    });

    probe.listen(preferred);
  });
}

function buildBaseUrl(port) {
  return `http://localhost:${port}`;
}

async function waitForServer(retries = 30, baseUrl = "http://localhost:10000") {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(`${baseUrl}/health`);
      if (!res.ok) {
        await sleep(1000);
        continue;
      }

      const json = await res.json().catch(() => null);
      if (json && json.db === "ok") return true;
    } catch {}
    await sleep(1000);
  }
  throw new Error("Server never started");
}

async function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: "inherit" });
    p.on("exit", code => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} failed`));
    });
  });
}

let server;

async function main() {
  console.log("🚀 Starting CI server...");
  const port = await getAvailablePort(Number(process.env.PORT || 10000));
  const baseUrl = buildBaseUrl(port);

  server = spawn("node", ["src/index.js"], {
    env: {
      ...process.env,
      NODE_ENV: "test",
      PORT: String(port),
      CI_QR_TOKEN: process.env.CI_QR_TOKEN || "seed-event-1",
      BASE_URL: baseUrl,
      BACKEND_URL: baseUrl
    }
  });

  process.env.CI_QR_TOKEN ||= "seed-event-1";
  process.env.BASE_URL = baseUrl;
  process.env.BACKEND_URL = baseUrl;

  server.on("exit", (code, signal) => {
    if (code !== 0) {
      console.error(`CI server exited early with code=${code} signal=${signal}`);
    }
  });

  server.stdout.on("data", d => console.log(d.toString()));
  server.stderr.on("data", d => console.error(d.toString()));

  await waitForServer(30, baseUrl);

  console.log("🌱 Seeding database for CI...");
  await run("npx", ["prisma", "db", "seed"]);

  console.log("🧪 Running tests...");
  await run("npm", ["run", "test:ci"]);

  console.log("📊 Running audit...");
  await run("node", ["scripts/phase-audit.mjs"]);

  console.log("✅ CI PASSED");

  server.kill();
}

const shutdown = () => {
  if (server && !server.killed) server.kill();
};

process.on("SIGINT", () => {
  shutdown();
  process.exit(1);
});
process.on("SIGTERM", () => {
  shutdown();
  process.exit(1);
});

main().catch(err => {
  console.error("CI FAILED:", err);
  process.exit(1);
});