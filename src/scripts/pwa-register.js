/**
 * LA VAGUE - PWA Service Worker Registration
 * Handles service worker registration and updates
 */

(function() {
    'use strict';

    // Check if service workers are supported
    if (!('serviceWorker' in navigator)) {
        console.log('[PWA] Service workers not supported');
        return;
    }

    // Check if we're in a secure context (required for service workers)
    if (!window.isSecureContext && window.location.hostname !== 'localhost') {
        console.log('[PWA] Service workers require HTTPS (except localhost)');
        return;
    }

    let refreshing = false;

    /**
     * Register the service worker
     */
    function registerServiceWorker() {
        // Use a delay to not block initial page load
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', doRegistration);
        } else {
            // Small delay to prioritize critical rendering
            setTimeout(doRegistration, 1000);
        }
    }

    function doRegistration() {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('[PWA] Service worker registered:', registration.scope);
                
                // Handle updates
                handleServiceWorkerUpdates(registration);
                
                // Check for updates periodically
                setInterval(() => {
                    registration.update();
                }, 60 * 60 * 1000); // Check every hour
            })
            .catch(error => {
                console.error('[PWA] Service worker registration failed:', error);
            });
    }

    /**
     * Handle service worker update lifecycle
     */
    function handleServiceWorkerUpdates(registration) {
        // Listen for new service worker installation
        registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            
            if (!newWorker) return;
            
            newWorker.addEventListener('statechange', () => {
                // New service worker is waiting
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    console.log('[PWA] New service worker available');
                    showUpdateNotification(newWorker);
                }
            });
        });

        // Handle controller changes (new SW activated)
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (refreshing) return;
            refreshing = true;
            console.log('[PWA] New service worker activated, reloading...');
            window.location.reload();
        });
    }

    /**
     * Show update notification to user
     */
    function showUpdateNotification(worker) {
        // Check if we have a toast notification system
        if (window.showToast) {
            window.showToast({
                message: 'A new version is available! Click to update.',
                type: 'info',
                duration: 10000,
                action: {
                    text: 'Update',
                    callback: () => {
                        skipWaitingAndReload(worker);
                    }
                }
            });
        } else {
            // Fallback: silent update after short delay
            setTimeout(() => {
                skipWaitingAndReload(worker);
            }, 5000);
        }
    }

    /**
     * Skip waiting and reload the page
     */
    function skipWaitingAndReload(worker) {
        if (worker && worker.state === 'installed') {
            worker.postMessage('skipWaiting');
        }
    }

    /**
     * Clear all caches (useful for debugging)
     */
    window.clearPWACaches = function() {
        if (!navigator.serviceWorker.controller) {
            console.log('[PWA] No active service worker');
            return Promise.resolve(false);
        }
        
        return new Promise((resolve) => {
            const messageChannel = new MessageChannel();
            messageChannel.port1.onmessage = (event) => {
                if (event.data.success) {
                    console.log('[PWA] Caches cleared successfully');
                    resolve(true);
                }
            };
            navigator.serviceWorker.controller.postMessage(
                { type: 'CLEAR_CACHES' },
                [messageChannel.port2]
            );
        });
    };

    // Register on load
    registerServiceWorker();

    // Expose PWA status for debugging
    window.PWA = {
        isSupported: true,
        isRegistered: !!navigator.serviceWorker.controller,
        clearCaches: window.clearPWACaches
    };

})();
