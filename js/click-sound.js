/* Nabd-Store global click sound for standalone pages. */
(function () {\n    function applySavedTheme() {
        try {
            document.documentElement.dataset.theme = localStorage.getItem("nabd-theme") === "light" ? "light" : "dark";
        } catch (_) {}
    }
    function installThemeOverrides() {
        if (document.getElementById("nabd-global-theme-overrides")) return;
        const style = document.createElement("style");
        style.id = "nabd-global-theme-overrides";
        style.textContent = `
html[data-theme="light"] body { background:#f7f7f5 !important; color:#171717 !important; }
html[data-theme="light"] .page { color:#171717 !important; }
html[data-theme="light"] .card,
html[data-theme="light"] .method,
html[data-theme="light"] .network,
html[data-theme="light"] .rate-card,
html[data-theme="light"] .settings-card,
html[data-theme="light"] .login-card { background:#fff !important; color:#171717 !important; border-color:#d9d9d4 !important; }
html[data-theme="light"] .back { background:#fff !important; color:#171717 !important; border-color:#d9d9d4 !important; }
html[data-theme="light"] .method-name,
html[data-theme="light"] .rate-label,
html[data-theme="light"] .network,
html[data-theme="light"] h1,
html[data-theme="light"] h2,
html[data-theme="light"] h3,
html[data-theme="light"] p,
html[data-theme="light"] label { color:#171717 !important; }
html[data-theme="light"] .subtitle,
html[data-theme="light"] .setting-desc,
html[data-theme="light"] .wallet-id,
html[data-theme="light"] .rate-value small { color:#666 !important; }
html[data-theme="light"] input,
html[data-theme="light"] textarea,
html[data-theme="light"] select { background:#fff !important; color:#171717 !important; border-color:#d9d9d4 !important; }
html[data-theme="light"] .copy-btn { background:#f3f3ef !important; color:#8a6b00 !important; border-color:#d9d9d4 !important; }
html[data-theme="light"] .admin-header,
html[data-theme="light"] .admin-drawer,
html[data-theme="light"] .admin-main,
html[data-theme="light"] .admin-card,
html[data-theme="light"] .admin-section,
html[data-theme="light"] .admin-panel { background:#fff !important; color:#171717 !important; }
html[data-theme="light"] .admin-header,
html[data-theme="light"] .admin-drawer,
html[data-theme="light"] .admin-card,
html[data-theme="light"] .admin-section,
html[data-theme="light"] .admin-panel { border-color:#d9d9d4 !important; }
html[data-theme="dark"] body { background:#080808 !important; color:#fff !important; }
html[data-theme="dark"] .card,
html[data-theme="dark"] .method,
html[data-theme="dark"] .network,
html[data-theme="dark"] .rate-card,
html[data-theme="dark"] .settings-card,
html[data-theme="dark"] .login-card { background:#111 !important; color:#fff !important; border-color:#292929 !important; }
`;
        document.head.appendChild(style);
    }
    installThemeOverrides();

    window.addEventListener("storage", function (event) {
        if (event.key === "nabd-theme") applySavedTheme();
    });
    if (window.__nabdClickSoundReady) return;
    window.__nabdClickSoundReady = true;

    let audioContext = null;

    function getAudioContext() {
        if (!audioContext) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextClass) return null;
            audioContext = new AudioContextClass();
        }
        if (audioContext.state === "suspended") {
            audioContext.resume().catch(function () {});
        }
        return audioContext;
    }

    function playClickSound() {\n        if (localStorage.getItem("nabd-sound-enabled") === "off") return;
        try {
            const context = getAudioContext();
            if (!context) return;

            const oscillator = context.createOscillator();
            const gain = context.createGain();

            oscillator.type = "sine";
            oscillator.frequency.setValueAtTime(600, context.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(850, context.currentTime + 0.055);

            gain.gain.setValueAtTime(0.0001, context.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.045, context.currentTime + 0.008);
            gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.075);

            oscillator.connect(gain);
            gain.connect(context.destination);
            oscillator.start();
            oscillator.stop(context.currentTime + 0.085);
        } catch (_) {}
    }

    document.addEventListener("pointerdown", function (event) {
        const target = event.target && event.target.closest
            ? event.target.closest('button, a, [role="button"], label[for]')
            : null;
        if (!target || target.disabled || target.getAttribute("aria-disabled") === "true") return;
        if (target.closest("#clickSound, #nightMode")) return;
        playClickSound();
    }, { passive: true });

    document.addEventListener("touchstart", function () {
        getAudioContext();
    }, { once: true, passive: true });
})();