const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const appSource = fs.readFileSync(require.resolve("../js/app.js"), "utf8");
const homeSource = fs.readFileSync(require.resolve("../index.html"), "utf8");
const styleSource = fs.readFileSync(require.resolve("../css/style.css"), "utf8");

test("drawer notifications use only the shared drawer action handler", () => {
  const drawerMenu = appSource.match(/function initializeMenu\(\) \{([\s\S]*?)\n\}/);

  assert.ok(drawerMenu, "drawer menu initializer exists");
  assert.doesNotMatch(appSource, /sidebarNotificationsLink/);
  assert.match(drawerMenu[1], /handleAction\(href\.replace\("#", ""\)\)/);
});

test("drawer has one profile link", () => {
  const profileLinks = homeSource.match(/<a\b[^>]*href="\/customer-profile\.html"[^>]*>/g) || [];
  assert.equal(profileLinks.length, 1);
});

test("homepage excludes its hidden intro, quick menu, footer, and their handlers", () => {
  const retiredClasses = new Set(["hero", "quick-menu", "quick-item", "main-footer", "footer-logo"]);
  const hasRetiredMarkupClass = [...homeSource.matchAll(/class="([^"]*)"/g)
  ].some(([, classes]) => classes.split(/\s+/).some((className) => retiredClasses.has(className)));
  assert.equal(hasRetiredMarkupClass, false);
  assert.doesNotMatch(appSource, /initializeQuickMenu|heroBalance|quick-item/);
  assert.doesNotMatch(styleSource, /\.hero\s*,\s*\.quick-menu\s*,\s*\.main-footer\s*\{\s*display\s*:\s*none\s*!important\s*;/);
  assert.doesNotMatch(styleSource, /\.(?:hero(?:-[\w-]+)?|quick-(?:menu|item|icon)|main-footer|footer-logo)(?![\w-])/);
});
