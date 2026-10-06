/**
 * Dependency-free static file server for demo-dapp/.
 *
 * Used by Playwright's `webServer` so `npm run e2e` serves the demo dApp with
 * zero extra installs and zero network access. Also runnable standalone:
 *
 *   node e2e/static-server.mjs           # http://localhost:4173
 *   DEMO_DAPP_PORT=8080 node e2e/static-server.mjs
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "demo-dapp"); // cwd-independent
const PORT = Number(process.env.DEMO_DAPP_PORT ?? 4173);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".png": "image/png",
};

const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname);
    const relative = pathname === "/" || pathname === "" ? "/index.html" : pathname;
    const filePath = normalize(join(ROOT, relative));

    // Path-traversal guard: never serve outside demo-dapp/.
    if (filePath !== ROOT && !filePath.startsWith(ROOT + "/")) {
      res.writeHead(403, { "content-type": "text/plain" });
      res.end("forbidden");
      return;
    }

    const body = await readFile(filePath);
    res.writeHead(200, {
      "content-type": MIME[extname(filePath)] ?? "application/octet-stream",
      "cache-control": "no-store",
    });
    res.end(body);
  } catch {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("not found");
  }
});

server.listen(PORT, () => {
  console.log(`demo-dapp served at http://localhost:${PORT}/`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
