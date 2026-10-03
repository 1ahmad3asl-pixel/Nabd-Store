/* NABD APPS/NUMBERS ISOLATION LAYER
 * Part 4: applications, numbers and card-like product flows.
 * Navigation snapshots are scoped so a late async render cannot paint
 * a different category after the user has moved elsewhere.
 */
(function () {
    "use strict";

    function scope(section, category, productId) {
        if (typeof window.captureSectionScope !== "function") return null;
        return window.captureSectionScope(section, category, productId);
    }

    function current(snapshot) {
        return !snapshot ||
            typeof window.isCurrentSectionScope !== "function" ||
            window.isCurrentSectionScope(snapshot);
    }

    function install() {
        if (typeof window.openAppsPage === "function") {
            const original = window.openAppsPage;
            window.openAppsPage = function (fromHistory) {
                const snapshot = scope(
                    typeof window.NabdScope !== "undefined" ? window.NabdScope.APPS : "apps"
                );
                const result = original(fromHistory);
                if (!current(snapshot)) return;
                return result;
            };
        }

        if (typeof window.openAppServerPlaceholder === "function") {
            const original = window.openAppServerPlaceholder;
            window.openAppServerPlaceholder = function (serverKey, fromHistory) {
                const snapshot = scope(
                    typeof window.NabdScope !== "undefined" ? window.NabdScope.APPS : "apps",
                    String(serverKey || "")
                );
                const result = original(serverKey, fromHistory);
                if (!current(snapshot)) return;
                return result;
            };
        }

        if (typeof window.openAppProducts === "function") {
            const original = window.openAppProducts;
            window.openAppProducts = function (serverKey, appItem, fromHistory) {
                const title = appItem && appItem.title ? appItem.title : "";
                const snapshot = scope(
                    typeof window.NabdScope !== "undefined" ? window.NabdScope.APPS : "apps",
                    String(serverKey || ""),
                    String(title)
                );
                const result = original(serverKey, appItem, fromHistory);
                if (!current(snapshot)) return;
                return result;
            };
        }

        if (typeof window.openNumbersPage === "function") {
            const original = window.openNumbersPage;
            window.openNumbersPage = function (fromHistory) {
                const snapshot = scope(
                    typeof window.NabdScope !== "undefined" ? window.NabdScope.NUMBERS : "numbers"
                );
                const result = original(fromHistory);
                if (!current(snapshot)) return;
                return result;
            };
        }

        if (typeof window.openNumberGroupProducts === "function") {
            const original = window.openNumberGroupProducts;
            window.openNumberGroupProducts = function (groupKey, fromHistory) {
                const snapshot = scope(
                    typeof window.NabdScope !== "undefined" ? window.NabdScope.NUMBERS : "numbers",
                    String(groupKey || "")
                );
                const result = original(groupKey, fromHistory);
                if (!current(snapshot)) return;
                return result;
            };
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", install, {once:true});
    } else {
        install();
    }
})();
