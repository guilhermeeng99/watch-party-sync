import { readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { zipSync } from "fflate";

import packageJson from "../package.json" with { type: "json" };

// WXT zips the build with files at the archive root, so extracting dumps everything loose into
// the current folder. We repackage so the zip contains a single top-level folder — users can
// extract once and point "Load unpacked" straight at the resulting folder.

const outputDir = join(import.meta.dirname, "..", ".output");
const buildDir = join(outputDir, "chrome-mv3");
const folderName = `watch-party-sync-${packageJson.version}`;
const target = join(outputDir, `${folderName}-chrome.zip`);

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

const files = await collectFiles(buildDir);
if (files.length === 0) {
  throw new Error("No build found in extension/.output/chrome-mv3. Run the build first.");
}

const archive = {};
for (const file of files) {
  // Zip paths must use forward slashes and live under the top-level folder.
  const archivePath = `${folderName}/${relative(buildDir, file).split(sep).join("/")}`;
  archive[archivePath] = new Uint8Array(await readFile(file));
}

const zipped = zipSync(archive, { level: 9 });

// Drop the loose WXT-generated zip(s) so only the foldered package remains.
const stale = (await readdir(outputDir)).filter(
  (file) => file.endsWith("-chrome.zip") && !file.startsWith(folderName),
);
for (const file of stale) {
  await rm(join(outputDir, file), { force: true });
}

await rm(target, { force: true });
await writeFile(target, zipped);
console.log(`Created ${target} (contents nested under ${folderName}/)`);
