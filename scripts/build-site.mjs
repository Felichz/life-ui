/* global process, console */
/**
 * Builds what lifeui.medanolabs.com serves, into dist-site/:
 *   /        the landing page (site/: the film, how it works, the download and the source)
 *   /app/    the web build of the app (vite build --base /app/)
 * The Worker (worker/index.js) sends deep links into /app/ to the app, and the app's old addresses at
 * the root (/goals, /library...) to their place under /app/.
 */
import { execFileSync } from "node:child_process";
import { cpSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "dist-site");
const npx = process.platform === "win32" ? "npx.cmd" : "npx";

rmSync(out, { recursive: true, force: true });
execFileSync(npx, ["tsc", "-b"], {
  cwd: root,
  stdio: "inherit",
  shell: process.platform === "win32",
});
execFileSync(
  npx,
  ["vite", "build", "--base", "/app/", "--outDir", join(out, "app"), "--emptyOutDir"],
  {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
  }
);
// The app's own _headers speaks of /assets/ at the root: the site's covers /app/assets/
rmSync(join(out, "app", "_headers"), { force: true });
cpSync(join(root, "site"), out, { recursive: true });
console.log(`site built in ${out}`);
