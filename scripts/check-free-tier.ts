import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const root = process.cwd();
const failures: string[] = [];
const notes: string[] = [];
const fail = (message: string) => failures.push(message);

function filesUnder(directory: string): string[] {
  const absolute = join(root, directory);
  if (!existsSync(absolute)) return [];
  return readdirSync(absolute).flatMap((name) => {
    const path = join(absolute, name);
    return statSync(path).isDirectory() ? filesUnder(path.slice(root.length + 1)) : [path];
  });
}

function initialClientJavaScript(): { files: string[]; gzipBytes: number } {
  const clientRoot = join(root, "dist/client");
  const htmlPath = join(clientRoot, "index.html");
  if (!existsSync(htmlPath)) return { files: [], gzipBytes: 0 };
  const html = readFileSync(htmlPath, "utf8");
  const entry = /<script[^>]+type=["']module["'][^>]+src=["']([^"']+\.js)["']/u.exec(html)?.[1];
  if (!entry) return { files: [], gzipBytes: 0 };

  const pending = [join(clientRoot, entry.replace(/^\//u, ""))];
  const visited = new Set<string>();
  while (pending.length > 0) {
    const path = pending.pop();
    if (!path || visited.has(path) || !existsSync(path)) continue;
    visited.add(path);
    const source = readFileSync(path, "utf8");
    for (const match of source.matchAll(
      /\bimport(?:[^"']*?\bfrom\s*)?["'](\.\/[^"']+\.js)["']/gu,
    )) {
      pending.push(join(path.slice(0, path.lastIndexOf("/")), match[1]));
    }
  }

  return {
    files: [...visited],
    gzipBytes: [...visited].reduce(
      (total, path) => total + gzipSync(readFileSync(path)).byteLength,
      0,
    ),
  };
}

const wranglerText = readFileSync(join(root, "wrangler.jsonc"), "utf8");
const wrangler = JSON.parse(
  wranglerText.replace(/\/\*[\s\S]*?\*\//gu, "").replace(/^\s*\/\/.*$/gmu, ""),
) as Record<string, unknown>;
for (const key of [
  "d1_databases",
  "kv_namespaces",
  "r2_buckets",
  "queues",
  "workflows",
  "hyperdrive",
  "containers",
]) {
  if (key in wrangler) fail(`Forbidden Wrangler binding: ${key}`);
}

const migrations = wrangler.migrations as Array<Record<string, unknown>> | undefined;
if (
  !migrations?.some(
    (migration) =>
      Array.isArray(migration.new_sqlite_classes) &&
      migration.new_sqlite_classes.includes("GameRoom"),
  )
) {
  fail("GameRoom must use a new_sqlite_classes migration.");
}
const assets = wrangler.assets as
  | { binding?: unknown; run_worker_first?: unknown; not_found_handling?: unknown }
  | undefined;
if (!assets) fail("Workers Static Assets configuration is missing.");
if (assets?.run_worker_first === true) fail("assets.run_worker_first must never be true.");
if (!Array.isArray(assets?.run_worker_first)) {
  fail("assets.run_worker_first must use a selective route array.");
} else {
  for (const required of [
    "/api/*",
    "/create*",
    "/join/*",
    "/play/*",
    "/host/*",
    "/screen/*",
    "/vi",
    "/vi/*",
    "/en",
    "/en/*",
  ]) {
    if (!assets.run_worker_first.includes(required))
      fail(`Missing Worker-first route: ${required}`);
  }
}
if (assets?.binding !== "ASSETS") fail("The host-aware router requires the ASSETS binding.");
if (assets?.not_found_handling !== "none")
  fail("Global SPA fallback must be disabled so unknown public routes return 404.");

const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};
const dependencies = Object.keys({ ...packageJson.dependencies, ...packageJson.devDependencies });
const forbiddenPackages = [
  /firebase/iu,
  /supabase/iu,
  /redis/iu,
  /socket\.io/iu,
  /pusher/iu,
  /ably/iu,
  /analytics/iu,
  /postgres/iu,
  /mysql/iu,
  /mongodb/iu,
];
for (const dependency of dependencies) {
  if (forbiddenPackages.some((pattern) => pattern.test(dependency)))
    fail(`Forbidden dependency: ${dependency}`);
}

const sourceFiles = ["src", "shared", "worker"]
  .flatMap(filesUnder)
  .filter((path) => /\.(?:ts|tsx|js|jsx)$/u.test(path));
const source = sourceFiles.map((path) => readFileSync(path, "utf8")).join("\n");
if (/\blocalStorage\b/u.test(source)) fail("localStorage usage detected.");
if (/\bindexedDB\b|\bIndexedDB\b/u.test(source)) fail("IndexedDB usage detected.");
if (/setInterval[\s\S]{0,300}(?:fetch\(|\/api\/rooms)/u.test(source))
  fail("Possible HTTP polling loop detected.");
const workerSource = filesUnder("worker")
  .map((path) => readFileSync(path, "utf8"))
  .join("\n");
if (/setInterval/u.test(workerSource))
  fail("Server-side timer interval detected; alarms must be used.");
if (/timer[^\n]{0,80}(?:broadcast|send)/iu.test(workerSource))
  fail("Possible server countdown tick broadcast detected.");

const workerCandidates = filesUnder("dist").filter(
  (path) => /\/index\.js$/u.test(path) && !path.includes("/client/") && !path.includes("/assets/"),
);
if (!workerCandidates.length) {
  fail("No built Worker bundle found. Run `bun run build` first.");
} else {
  const worker = workerCandidates[0];
  const compressed = gzipSync(readFileSync(worker)).byteLength;
  notes.push(`Worker gzip: ${(compressed / 1024).toFixed(2)} KiB`);
  if (compressed >= 2.5 * 1024 * 1024) fail("Worker bundle exceeds the 2.5 MB gzip safety target.");
}

const staticFiles = filesUnder("dist/client");
const initialJavaScript = initialClientJavaScript();
notes.push(`Generated static assets: ${staticFiles.length}`);
if (initialJavaScript.files.length === 0) {
  fail("Could not identify the initial game JavaScript entrypoint.");
} else {
  notes.push(
    `Initial game JavaScript: ${(initialJavaScript.gzipBytes / 1024).toFixed(2)} KiB gzip across ${initialJavaScript.files.length} static chunk(s)`,
  );
  if (initialJavaScript.gzipBytes > 100 * 1024) {
    fail("Initial game JavaScript exceeds the 100 KiB gzip safety target.");
  }
}
notes.push("Forbidden bindings: none detected");
notes.push("Selective Worker routing: API, canonical public HTML and operational game routes");
notes.push("Public unknown-route policy: no global SPA fallback");
notes.push("Durable Object storage: SQLite-backed migration");

for (const note of notes) console.info(`✓ ${note}`);
if (failures.length) {
  for (const failure of failures) console.error(`✗ ${failure}`);
  process.exitCode = 1;
} else {
  console.info("✓ Free-tier architecture checks passed.");
}
