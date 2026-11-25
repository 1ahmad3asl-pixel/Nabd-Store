const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const appSource = fs.readFileSync(require.resolve("../js/app.js"), "utf8");

test("drawer notifications use only the shared drawer action handler", () => {
  const quickMenu = appSource.match(/function initializeQuickMenu\(\) \{([\s\S]*?)\n\}/);
  const drawerMenu = appSource.match(/function initializeMenu\(\) \{([\s\S]*?)\n\}/);

  assert.ok(quickMenu, "quick menu initializer exists");
  assert.ok(drawerMenu, "drawer menu initializer exists");
  assert.doesNotMatch(quickMenu[1], /sidebarNotificationsLink/);
  assert.match(drawerMenu[1], /handleAction\(href\.replace\("#", ""\)\)/);
});
