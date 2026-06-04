import { readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { zipSync } from "fflate";

import packageJson from "../package.json" with { type: "json" };

// WXT zips the build with files at the archive root, so extracting dumps everything loose into
// the current folder. We repackage so the zip contains a single top-level folder — users can
// extract once and point "Load unpacked" (Chrome) or pick the inner manifest.json (Firefox).
//
// Usage: node scripts/package-extension.mjs <browser>
//   <browser> = "chrome" (default) or "firefox". The matching WXT output dir is auto-detected.

const browser = (process.argv[2] ?? "chrome").toLowerCase();
const outputDir = join(import.meta.dirname, "..", ".output");
const folderName = `watch-party-sync-${packageJson.version}`;
const target = join(outputDir, `${folderName}-${browser}.zip`);

async function dirExists(path) {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

// WXT names output dirs <browser>-mv<2|3>; pick whichever the build produced.
async function resolveBuildDir() {
  for (const candidate of [`${browser}-mv3`, `${browser}-mv2`]) {
    const path = join(outputDir, candidate);
    if (await dirExists(path)) {
      return path;
    }
  }
  throw new Error(`No ${browser} build found in extension/.output. Run the build first.`);
}

async function collectFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(fullPath)));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

const buildDir = await resolveBuildDir();
const files = await collectFiles(buildDir);
if (files.length === 0) {
  throw new Error(`Empty build dir: ${buildDir}`);
}

const archive = {};
for (const file of files) {
  // Zip paths must use forward slashes and live under the top-level folder.
  const archivePath = `${folderName}/${relative(buildDir, file).split(sep).join("/")}`;
  archive[archivePath] = new Uint8Array(await readFile(file));
}

const zipped = zipSync(archive, { level: 9 });

// Drop the loose WXT-generated zip(s) for this browser so only the foldered package remains.
const stale = (await readdir(outputDir)).filter(
  (file) => file.endsWith(`-${browser}.zip`) && !file.startsWith(folderName),
);
for (const file of stale) {
  await rm(join(outputDir, file), { force: true });
}

await rm(target, { force: true });
await writeFile(target, zipped);
console.log(`Created ${target} (contents nested under ${folderName}/)`);
