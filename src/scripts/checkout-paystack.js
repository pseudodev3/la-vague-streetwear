/**
 * LA VAGUE - Paystack Payment Integration
 * Handles Paystack popup payment flow with Mobile Redirect Fallback
 * Version: 4.6 (Restored Processing Modal & Progress Bar)
 */
(function() {
    const API_URL = window.location.hostname === 'localhost' 
        ? 'http://localhost:3000/api' 
        : 'https://la-vague-api.onrender.com/api';

    let PAYSTACK_PUBLIC_KEY = window.PAYSTACK_PUBLIC_KEY || '';
    let configLoaded = false;
    let isPaystackAvailable = false;
    let paystackInstance = null;
    let currentOrderData = null;
    let pollInterval = null;
    let pollAttempts = 0;
    const MAX_POLL_ATTEMPTS = 40;

    const isMobile = () => /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    function prewarmPaystack() {
        if (window.PaystackPop && !paystackInstance && !isMobile()) {
            try {
                paystackInstance = new window.PaystackPop();
            } catch (e) {
                console.warn('[PAYSTACK] Prewarm failed');
            }
        }
    }

    async function loadPaystackConfig() {
        if (configLoaded) return true;
        try {
            const response = await fetch(`${API_URL}/config/paystack`, { credentials: 'include' });
            const data = await response.json();
            if (data.success && data.configured) {
                PAYSTACK_PUBLIC_KEY = data.publicKey;
                window.PAYSTACK_PUBLIC_KEY = data.publicKey;
                configLoaded = true;
                return true;
            }
            return false;
        } catch (error) {
            return false;
        }
    }

    function isPaystackConfigured() {
        return !!PAYSTACK_PUBLIC_KEY && PAYSTACK_PUBLIC_KEY.startsWith('pk_');
    }

    function loadPaystackScript() {
        return new Promise((resolve) => {
            if (window.PaystackPop) {
                isPaystackAvailable = true;
                prewarmPaystack();
                resolve();
                return;
            }
            const script = document.createElement('script');
            script.src = 'https://js.paystack.co/v2/inline.js';
            script.async = true;
            script.onload = () => {
                isPaystackAvailable = true;
                prewarmPaystack();
                resolve();
            };
            script.onerror = () => {
                isPaystackAvailable = false;
                resolve();
            };
            document.head.appendChild(script);
        });
    }

    function redirectToConfirmation(orderId) {
        localStorage.removeItem('cart');
        window.location.href = `order-confirmation.html?order=${orderId}&status=success`;
    }

    async function checkPaymentStatus(orderId) {
        try {
            const response = await fetch(`${API_URL}/orders/lookup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId, email: currentOrderData?.customerEmail })
            });
            const result = await response.json();
            return (result.success && result.order) ? result.order.payment_status : 'pending';
        } catch (error) {
            return 'pending';
        }
    }

    /**
     * Show Payment Pending Modal with Progress Bar
     */
    function showPaymentPendingMessage(orderId) {
        pollAttempts = 0;
        const content = `
            <div class="paystack-modal-icon paystack-modal-icon--pending" id="paystack-status-icon">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
            </div>
            <h3 class="paystack-modal-title" id="paystack-status-title">Processing Payment</h3>
            <p class="paystack-modal-text" id="paystack-status-text">Verifying your payment. Please wait...</p>
            <div class="paystack-modal-order">
                <span class="paystack-modal-label">Order ID</span>
                <span class="paystack-modal-value">#LV-${orderId.replace('LV-','')}</span>
            </div>
            <div class="paystack-modal-progress">
                <div class="paystack-modal-progress-bar" id="paystack-progress-bar"></div>
            </div>
            <p class="paystack-modal-hint" id="paystack-status-hint">This usually takes a few seconds</p>
            <div class="paystack-modal-actions">
                <button onclick="window.closePaystackModal()" class="paystack-modal-btn paystack-modal-btn--secondary">Close</button>
            </div>
        `;
        showStyledModal(content);
        startPaymentPolling(orderId);
    }

    function startPaymentPolling(orderId) {
        if (pollInterval) clearInterval(pollInterval);
        checkAndUpdateStatus(orderId);
        pollInterval = setInterval(() => {
            pollAttempts++;
            const progressBar = document.getElementById('paystack-progress-bar');
            if (progressBar) {
                const progress = Math.min((pollAttempts / MAX_POLL_ATTEMPTS) * 100, 100);
                progressBar.style.width = `${progress}%`;
            }
            checkAndUpdateStatus(orderId);
        }, 3000);
    }

    async function checkAndUpdateStatus(orderId) {
        try {
            const status = await checkPaymentStatus(orderId);
            if (status === 'paid') {
                clearInterval(pollInterval);
                showPaymentSuccess(orderId);
            } else if (status === 'failed') {
                clearInterval(pollInterval);
                updateModalToFailed();
            } else if (pollAttempts >= MAX_POLL_ATTEMPTS) {
                clearInterval(pollInterval);
                const hint = document.getElementById('paystack-status-hint');
                if (hint) hint.textContent = 'Verification is taking longer than usual. Please check your email for confirmation.';
            }
        } catch (e) {}
    }

    function showPaymentSuccess(orderId) {
        const icon = document.getElementById('paystack-status-icon');
        if (icon) {
            icon.className = 'paystack-modal-icon paystack-modal-icon--success';
            icon.innerHTML = `<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="20 6 9 17 4 12"/></svg>`;
        }
        const title = document.getElementById('paystack-status-title');
        if (title) title.textContent = 'Payment Successful!';
        const text = document.getElementById('paystack-status-text');
        if (text) text.textContent = 'Your order has been confirmed.';
        const progress = document.querySelector('.paystack-modal-progress');
        if (progress) progress.style.display = 'none';
        
        setTimeout(() => redirectToConfirmation(orderId), 2000);
    }

    function updateModalToFailed() {
        const title = document.getElementById('paystack-status-title');
        if (title) title.textContent = 'Payment Failed';
        const icon = document.getElementById('paystack-status-icon');
        if (icon) {
            icon.innerHTML = `<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
        }
    }

    function showStyledModal(content) {
        const existing = document.getElementById('paystack-modal');
        if (existing) existing.remove();
        
        if (!document.getElementById('paystack-modal-styles')) {
            const styles = document.createElement('style');
            styles.id = 'paystack-modal-styles';
            styles.textContent = `
                .paystack-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.85); backdrop-filter: blur(8px); z-index: 10000; display: flex; align-items: center; justify-content: center; padding: 1rem; animation: paystack-modal-fade-in 0.3s ease; }
                .paystack-modal-container { background: #0a0a0a; border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; max-width: 480px; width: 100%; padding: 3rem 2.5rem; text-align: center; box-shadow: 0 25px 80px rgba(0,0,0,0.6); }
                .paystack-modal-icon { width: 80px; height: 80px; margin: 0 auto 1.5rem; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
                .paystack-modal-icon--pending { background: rgba(245, 158, 11, 0.1); color: #f59e0b; animation: paystack-pulse 2s ease-in-out infinite; }
                .paystack-modal-icon--success { background: rgba(34, 197, 94, 0.1); color: #22c55e; }
                .paystack-modal-progress { width: 100%; height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; margin: 1.5rem 0; overflow: hidden; }
                .paystack-modal-progress-bar { height: 100%; background: linear-gradient(90deg, #dc2626, #ef4444); width: 0%; transition: width 0.4s ease; }
                .paystack-modal-title { font-family: 'Oswald', sans-serif; font-size: 1.75rem; color: #fff; margin-bottom: 1rem; text-transform: uppercase; }
                .paystack-modal-text { color: rgba(255,255,255,0.7); margin-bottom: 1.5rem; }
                .paystack-modal-order { background: rgba(255,255,255,0.05); padding: 1rem; display: flex; justify-content: space-between; margin-bottom: 1.5rem; }
                .paystack-modal-label { color: rgba(255,255,255,0.5); font-size: 0.75rem; text-transform: uppercase; }
                .paystack-modal-btn { font-family: 'Oswald', sans-serif; padding: 0.75rem 2rem; text-transform: uppercase; cursor: pointer; display: inline-flex; border: 1px solid rgba(255,255,255,0.2); background: transparent; color: #fff; }
                .paystack-modal-hint { color: rgba(255,255,255,0.5); font-size: 0.875rem; margin-bottom: 1rem; }
                @keyframes paystack-modal-fade-in { from { opacity: 0; } to { opacity: 1; } }
                @keyframes paystack-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
            `;
            document.head.appendChild(styles);
        }
        const modal = document.createElement('div');
        modal.id = 'paystack-modal';
        modal.innerHTML = `<div class="paystack-modal-overlay"><div class="paystack-modal-container">${content}</div></div>`;
        document.body.appendChild(modal);
    }

    window.closePaystackModal = function() {
        if (pollInterval) clearInterval(pollInterval);
        const modal = document.getElementById('paystack-modal');
        if (modal) modal.remove();
    };

    /**
     * Primary Payment Handler
     */
    async function initializePaystackPayment(orderId, paystackData) {
        if (!paystackData || (!paystackData.access_code && !paystackData.authorization_url)) {
            throw new Error('Payment initialization data missing');
        }

        if (isMobile() && paystackData.authorization_url) {
            window.location.href = paystackData.authorization_url;
            return;
        }

        if (window.PaystackPop && paystackData.access_code) {
            const popup = paystackInstance || new window.PaystackPop();
            popup.resumeTransaction(paystackData.access_code, {
                onSuccess: (transaction) => {
                    showPaymentSuccess(orderId);
                },
                onCancel: () => {
                    // Professional delay: Wait 2s before showing pending msg
                    // to give the webhook a chance to redirect them first
                    console.log('[PAYSTACK] Modal closed, checking status in 2s...');
                    setTimeout(() => {
                        // Only show if we haven't redirected yet
                        showPaymentPendingMessage(orderId);
                    }, 2000);
                }
            });
        } else if (paystackData.authorization_url) {
            window.location.href = paystackData.authorization_url;
        }
    }

    async function processOrderWithPaystack(orderData) {
        await loadPaystackScript();
        let freshToken = '';
        try {
            const tokenRes = await fetch(`${API_URL}/csrf-token`, { credentials: 'include' });
            const tokenData = await tokenRes.json();
            freshToken = tokenData.csrfToken;
        } catch (e) {}
        
        currentOrderData = { ...orderData, paymentMethod: 'paystack' };
        const response = await fetch(`${API_URL}/orders`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': freshToken },
            body: JSON.stringify(currentOrderData)
        });
        
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || 'Failed to create order');
        
        await initializePaystackPayment(result.orderId, result.paystack);
        return { success: true, orderId: result.orderId };
    }

    window.PaystackCheckout = {
        isConfigured: isPaystackConfigured,
        isAvailable: () => isPaystackAvailable,
        processOrder: processOrderWithPaystack,
        init: async function() {
            await loadPaystackConfig();
            await loadPaystackScript();
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => window.PaystackCheckout.init());
    } else {
        window.PaystackCheckout.init();
    }
})();
