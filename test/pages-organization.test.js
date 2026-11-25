const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.join(__dirname, "..");
const pageNames = [
  "index.html",
  "add-balance.html",
  "customer-login.html",
  "customer-profile.html",
  "settings.html",
  "sham-cash-dollar.html",
  "sham-cash-syp.html",
  "syriatel-cash.html",
  "terms.html",
  "usdt-bep20.html",
  "usdt-trc20.html"
];

test("public HTML pages are grouped in pages/ and served at their existing URLs", () => {
  const rootHtmlFiles = fs.readdirSync(projectRoot).filter((name) => name.endsWith(".html"));
  assert.deepEqual(rootHtmlFiles, []);

  for (const pageName of pageNames) {
    assert.equal(fs.existsSync(path.join(projectRoot, "pages", pageName)), true, `${pageName} is in pages/`);
  }

  const serverSource = fs.readFileSync(path.join(projectRoot, "server.js"), "utf8");
  assert.match(serverSource, /express\.static\(path\.join\(__dirname,\s*["']pages["']\)/);
  assert.match(serverSource, /sendFile\(path\.join\(__dirname,\s*["']pages["'],\s*["']index\.html["']\)\)/);
  assert.match(serverSource, /requestPath\.toLowerCase\(\)\s*===\s*["']\/pages["']/);
  assert.match(serverSource, /requestPath\.toLowerCase\(\)\.startsWith\(["']\/pages\/["']\)/);
});
