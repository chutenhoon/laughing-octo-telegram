import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const sourcePath = path.join(rootDir, "_redirects");
const publicRedirects = path.join(rootDir, "app", "public", "_redirects");
const distRedirects = path.join(rootDir, "dist", "_redirects");

const mode = (process.argv[2] || "all").toLowerCase();
const content = await fs.readFile(sourcePath, "utf8");

const targets = [];
if (mode === "pre" || mode === "all") targets.push(publicRedirects);
if (mode === "post" || mode === "all") targets.push(distRedirects);

for (const target of targets) {
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content, "utf8");
}
