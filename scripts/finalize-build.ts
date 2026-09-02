import { copyFile, rm, stat } from "node:fs/promises";

const clientDirectory = new URL("../dist/client/", import.meta.url);
const gameIndex = new URL("index.html", clientDirectory);
const appShell = new URL("app-shell.html", clientDirectory);
const generatedDevelopmentSecrets = new URL("../do_kinh_thanh_live/.dev.vars", clientDirectory);

await stat(gameIndex);
await copyFile(gameIndex, appShell);
await rm(generatedDevelopmentSecrets, { force: true });
console.log("✓ Preserved the React game shell as dist/client/app-shell.html.");
console.log("✓ Removed local development secrets from the build output.");
