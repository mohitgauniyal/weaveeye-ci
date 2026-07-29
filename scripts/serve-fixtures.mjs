// Tiny static server for the self-test fixtures. Dependency-free (node core),
// so CI needs nothing installed to serve them. Not shipped in the npm package.
import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, normalize } from "node:path";

const DIR = fileURLToPath(new URL("../test/fixtures/", import.meta.url));
const PORT = process.env.FIXTURE_PORT || 8123;

http.createServer(async (req, res) => {
  try {
    const rel = decodeURIComponent(req.url.split("?")[0]).replace(/^\/+/, "");
    // Constrain to the fixtures directory.
    const file = join(DIR, normalize(rel).replace(/^(\.\.[/\\])+/, ""));
    const body = await readFile(file);
    res.writeHead(200, { "content-type": "text/html" });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end("not found");
  }
}).listen(PORT, () => console.log(`fixtures on :${PORT}`));
