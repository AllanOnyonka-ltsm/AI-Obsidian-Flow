import { build } from "esbuild";
import { mkdir, copyFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, "dist");

if (!existsSync(distDir)) {
  await mkdir(distDir, { recursive: true });
}

const result = await build({
  entryPoints: [join(__dirname, "src/index.ts")],
  bundle: true,
  platform: "node",
  target: "node18",
  format: "esm",
  outfile: join(distDir, "index.mjs"),
  banner: {
    js: "#!/usr/bin/env node\nimport { createRequire } from 'module';\nconst require = createRequire(import.meta.url);",
  },
  external: [],
  logLevel: "info",
});

if (result.errors.length) {
  process.exit(1);
}

// Make it executable
const { chmodSync } = await import("node:fs");
chmodSync(join(distDir, "index.mjs"), 0o755);

// Copy the bundled server into the web app's public dir so users can download it.
const publicDir = join(__dirname, "../../artifacts/obsidian-exporter/public");
if (existsSync(publicDir)) {
  await copyFile(
    join(distDir, "index.mjs"),
    join(publicDir, "mcp-obsidian-server.mjs"),
  );
  console.log("Copied bundled server to web app public dir");
}

console.log("Build complete:", join(distDir, "index.mjs"));
