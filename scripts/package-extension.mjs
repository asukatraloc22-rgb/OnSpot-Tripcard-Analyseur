import { cp, mkdir, rm } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const source = join(root, "extension");
const releaseRoot = join(root, "release");
const staging = join(releaseRoot, "onspot-audit-assistant-v2.1.0");
const archivePath = join(releaseRoot, "onspot-audit-assistant-v2.1.0.zip");

await rm(staging, { recursive: true, force: true });
await mkdir(releaseRoot, { recursive: true });
await cp(source, staging, { recursive: true });
await rm(join(staging, ".DS_Store"), { force: true });
await rm(archivePath, { force: true });
await execFileAsync("zip", ["-qr", archivePath, "."], { cwd: staging });

console.log(`Extension packaged: ${relative(root, archivePath)}`);
