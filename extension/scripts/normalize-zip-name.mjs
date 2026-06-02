import { readdir, rename, rm } from "node:fs/promises";
import { join } from "node:path";

import packageJson from "../package.json" with { type: "json" };

const outputDir = join(import.meta.dirname, "..", ".output");
const zipFiles = (await readdir(outputDir))
  .filter((file) => file.endsWith("-chrome.zip"))
  .filter((file) => !file.startsWith("watch-party-sync-"))
  .sort();

if (zipFiles.length === 0) {
  throw new Error("No WXT chrome zip found in extension/.output.");
}

const source = join(outputDir, zipFiles.at(-1));
const target = join(outputDir, `watch-party-sync-${packageJson.version}-chrome.zip`);

await rm(target, { force: true });
await rename(source, target);
console.log(`Created ${target}`);
