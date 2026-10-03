/* NABD BALANCE ISOLATION LAYER
 * Section 3: balances/telecom.
 * Guards asynchronous balance navigation so a late response from one
 * provider/category cannot repaint another provider/category.
 */
(function () {
    "use strict";

    function ready() {
        if (typeof window.openBalancePage !== "function" ||
            typeof window.openBalanceSubgroups !== "function" ||
            typeof window.openBalanceSubgroupProducts !== "function") {
            return;
        }

        const originalOpenBalancePage = window.openBalancePage;
        const originalOpenBalanceSubgroups = window.openBalanceSubgroups;
        const originalOpenBalanceSubgroupProducts = window.openBalanceSubgroupProducts;

        const pendingLoads = new Map();

        function capture(section, category, productId) {
            if (typeof window.captureSectionScope === "function") {
                return window.captureSectionScope(section, category, productId);
            }
            return null;
        }

        function current(snapshot) {
            return !snapshot ||
                typeof window.isCurrentSectionScope !== "function" ||
                window.isCurrentSectionScope(snapshot);
        }

        window.openBalancePage = function (fromHistory) {
            if (typeof window.NabdScope !== "undefined") {
                capture(window.NabdScope.BALANCE);
            }
            return originalOpenBalancePage(fromHistory);
        };

        window.openBalanceSubgroups = function (groupKey, fromHistory) {
            groupKey = String(groupKey || "");

            if (fromHistory) {
                const snapshot = pendingLoads.get(groupKey);
                if (!current(snapshot)) return;
                pendingLoads.delete(groupKey);
                return originalOpenBalanceSubgroups(groupKey, true);
            }

            const snapshot = capture(
                typeof window.NabdScope !== "undefined" ? window.NabdScope.BALANCE : "balance",
                groupKey
            );
            pendingLoads.set(groupKey, snapshot);

            return originalOpenBalanceSubgroups(groupKey, false);
        };

        window.openBalanceSubgroupProducts = function (groupKey, subgroupKey, fromHistory) {
            groupKey = String(groupKey || "");
            subgroupKey = String(subgroupKey || "");

            const snapshot = capture(
                typeof window.NabdScope !== "undefined" ? window.NabdScope.BALANCE : "balance",
                groupKey,
                subgroupKey
            );

            // This function is synchronous, but keep the same scope guard so
            // product selection cannot repaint a different provider after navigation.
            if (!current(snapshot)) return;
            return originalOpenBalanceSubgroupProducts(groupKey, subgroupKey, fromHistory);
        };

        window.openBalanceProductGroup = function (groupKey, fromHistory) {
            return window.openBalanceSubgroups(groupKey, fromHistory);
        };

        // Product-order requests belong to the currently selected balance product.
        // The existing handler remains responsible for validation/submission.
        // We only cancel stale navigation loads; no shared product data is mutated here.
    }

    if (document.readyState === "loading") {
        // app.js is loaded immediately before this file, so DOMContentLoaded is
        // still guaranteed to occur after the wrappers are installed.
        ready();
    } else {
        ready();
    }
})();
