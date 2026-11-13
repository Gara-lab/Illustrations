import { build } from "esbuild";
import { copyFileSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const dist = join(root, "dist-web");
const MAX_FILE_BYTES = 25 * 1024 * 1024;

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

await build({
  bundle: true,
  logLevel: "warning",
  loader: { ".md": "text" },
  entryPoints: [join(root, "src/web/entry.ts")],
  outfile: join(dist, "renderer.js"),
  platform: "browser",
  format: "iife",
  target: "chrome140",
  minify: true,
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' }
});

copyFileSync(join(root, "src/app/renderer/index.html"), join(dist, "index.html"));
copyFileSync(join(root, "src/app/renderer/styles.css"), join(dist, "renderer.css"));
copyFileSync(join(root, "public/_headers"), join(dist, "_headers"));
copyFileSync(join(root, "src/catalog/icons-LICENSE.txt"), join(dist, "icons-LICENSE.txt"));

const fontLicences = join(dist, "fonts");
mkdirSync(fontLicences, { recursive: true });
for (const name of readdirSync(join(root, "src/catalog/fonts")).filter((n) => n.endsWith(".txt"))) copyFileSync(join(root, "src/catalog/fonts", name), join(fontLicences, name));

const notices: [string, string][] = [
  ["react/LICENSE", "react-LICENSE.txt"],
  ["react-dom/LICENSE", "react-dom-LICENSE.txt"],
  ["pptxgenjs/LICENSE", "pptxgenjs-LICENSE.txt"],
  ["jszip/LICENSE.markdown", "jszip-LICENSE.txt"],
  ["d3-shape/LICENSE", "d3-shape-LICENSE.txt"],
  ["d3-path/LICENSE", "d3-path-LICENSE.txt"]
];
mkdirSync(join(dist, "licenses"), { recursive: true });
for (const [from, to] of notices) copyFileSync(join(root, "node_modules", from), join(dist, "licenses", to));

const tooBig: string[] = [];
const scan = (dir: string): void => {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) scan(full);
    else if (statSync(full).size > MAX_FILE_BYTES) tooBig.push(full);
  }
};
scan(dist);
if (tooBig.length > 0) {
  console.error(`Files over 25 MiB: ${tooBig.join(", ")}`);
  process.exit(1);
}

console.log(`Built ${dist}`);
