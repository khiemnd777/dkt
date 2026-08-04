import { copyFile, stat } from "node:fs/promises";

const clientDirectory = new URL("../dist/client/", import.meta.url);
const gameIndex = new URL("index.html", clientDirectory);
const appShell = new URL("app-shell.html", clientDirectory);

await stat(gameIndex);
await copyFile(gameIndex, appShell);
console.log("✓ Preserved the React game shell as dist/client/app-shell.html.");
