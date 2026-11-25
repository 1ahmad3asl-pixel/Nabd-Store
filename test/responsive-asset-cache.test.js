const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const serverSource = fs.readFileSync(require.resolve("../server.js"), "utf8");
const workerSource = fs.readFileSync(require.resolve("../sw.js"), "utf8");
const appSource = fs.readFileSync(require.resolve("../js/app.js"), "utf8");

test("public stylesheets and scripts are revalidated instead of cached for a week", () => {
  assert.ok(serverSource.includes('if (/\\.(?:css|js)$/i.test(filePath))'));
  assert.ok(serverSource.includes('res.setHeader("Cache-Control", "no-cache, must-revalidate")'));
});

test("service worker refreshes assets without reusing the browser HTTP cache", () => {
  assert.match(workerSource, /const CACHE_VERSION = "nabd-static-v38"/);
  assert.match(workerSource, /function isExecutableAsset\(url\)[\s\S]*?\.\(\?:css\|js\)/);
  assert.match(workerSource, /isExecutableAsset\(url\)\s*\?\s*0\s*:\s*ASSET_TTL/);
  assert.match(workerSource, /fetch\(request,\s*\{\s*cache:\s*["']no-store["']\s*\}\)/);
  assert.match(appSource, /serviceWorker\.register\("\/sw\.js\?v=20261125-responsive1"/);
});

