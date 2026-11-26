(function initPWA() {
    // 1. Registrasi Service Worker
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js').catch((err) => {
                console.warn('ServiceWorker registration failed:', err);
            });
        });
    }

    // 2. Indikator Status Online / Offline
    const offlineBadge = document.getElementById('offline-status-badge');
    const syncNetworkStatus = () => {
        if (!offlineBadge) return;
        if (navigator.onLine) {
            offlineBadge.classList.add('hidden');
            offlineBadge.classList.remove('inline-flex');
        } else {
            offlineBadge.classList.remove('hidden');
            offlineBadge.classList.add('inline-flex');
        }
    };

    window.addEventListener('online', syncNetworkStatus);
    window.addEventListener('offline', syncNetworkStatus);
    syncNetworkStatus();

    // 3. Penanganan Tombol Install PWA (beforeinstallprompt)
    let deferredPrompt = null;
    const installBtn = document.getElementById('btn-install-pwa');

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        if (installBtn) {
            installBtn.classList.remove('hidden');
            installBtn.classList.add('inline-flex');
        }
    });

    if (installBtn) {
        installBtn.addEventListener('click', async () => {
            if (!deferredPrompt) return;
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                installBtn.classList.add('hidden');
                installBtn.classList.remove('inline-flex');
            }
            deferredPrompt = null;
        });
    }

    window.addEventListener('appinstalled', () => {
        deferredPrompt = null;
        if (installBtn) {
            installBtn.classList.add('hidden');
            installBtn.classList.remove('inline-flex');
        }
    });
})();
