/* Nabd-Store global click sound for standalone pages. */
(function () {\n    try { document.documentElement.dataset.theme = localStorage.getItem("nabd-theme") === "light" ? "light" : "dark"; } catch (_) {}
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
        playClickSound();
    }, { passive: true });

    document.addEventListener("touchstart", function () {
        getAudioContext();
    }, { once: true, passive: true });
})();