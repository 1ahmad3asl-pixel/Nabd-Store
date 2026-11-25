const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const appSource = fs.readFileSync(require.resolve("../js/app.js"), "utf8");
const styleSource = fs.readFileSync(require.resolve("../css/style.css"), "utf8");

test("universal game product rows omit thumbnails without changing names or prices", () => {
  assert.equal(appSource.includes("pubg-option-image"), false);
  assert.equal(styleSource.includes(".pubg-option-image"), false);
  assert.ok(appSource.includes('class="pubg-option-name"'));
  assert.ok(appSource.includes('class="pubg-option-price"'));
  assert.match(styleSource, /\.pubg-option\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,1fr\)\s+auto/);
  assert.match(appSource, /class="pubg-picker-image"/);
});
