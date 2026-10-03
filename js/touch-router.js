/* NABD TOUCH ROUTER
 * Hardens the first-level category tiles against mobile browsers/WebViews
 * that fail to deliver the normal click event.
 */
(function () {
  "use strict";

  function route(button) {
    if (!button) return;
    var key = button.getAttribute("data-category") || "";
    try {
      if (key === "games" && typeof window.openGamesPage === "function") return window.openGamesPage(false);
      if (key === "balance" && typeof window.openBalancePage === "function") return window.openBalancePage(false);
      if (key === "numbers" && typeof window.openNumbersPage === "function") return window.openNumbersPage(false);
      if (key === "digital" && typeof window.openDigitalPage === "function") return window.openDigitalPage(false);
      if (key === "boost" && typeof window.openBoost === "function") return window.openBoost(false);
      if (key === "apps" && typeof window.openAppsPage === "function") return window.openAppsPage(false);
    } catch (error) {
      console.error("Nabd touch route error:", error);
    }
  }

  function install() {
    var root = document.getElementById("categories");
    if (!root || root.__nabdTouchRouterInstalled) return;
    root.__nabdTouchRouterInstalled = true;

    root.addEventListener("touchend", function (event) {
      var button = event.target && event.target.closest
        ? event.target.closest(".category[data-category]")
        : null;
      if (!button || !root.contains(button)) return;

      event.preventDefault();
      event.stopPropagation();
      window.__nabdLastCategoryTouch = Date.now();
      route(button);
    }, {capture: true, passive: false});

    root.addEventListener("pointerup", function (event) {
      if (event.pointerType === "mouse") return;
      var button = event.target && event.target.closest
        ? event.target.closest(".category[data-category]")
        : null;
      if (!button || !root.contains(button)) return;
      if (Date.now() - Number(window.__nabdLastCategoryTouch || 0) < 500) return;

      event.preventDefault();
      event.stopPropagation();
      window.__nabdLastCategoryTouch = Date.now();
      route(button);
    }, {capture: true, passive: false});
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install, {once: true});
  } else {
    install();
  }
})();
