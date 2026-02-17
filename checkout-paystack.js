/**
 * LA VAGUE - Paystack Payment Integration
 * Handles Paystack popup payment flow with Mobile Redirect Fallback
 * Version: 4.5 (Restored Processing Modal & Confirmation)
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
     * Desktop Success Handler
     */
    async function handleDesktopSuccess(orderId) {
        showPaymentSuccess(orderId);
        setTimeout(() => redirectToConfirmation(orderId), 2000);
    }

    /**
     * Primary Payment Handler
     */
    async function initializePaystackPayment(orderId, paystackData) {
        if (!paystackData || (!paystackData.access_code && !paystackData.authorization_url)) {
            throw new Error('Payment initialization data missing from server');
        }

        // 1. Mobile Redirect
        if (isMobile() && paystackData.authorization_url) {
            window.location.href = paystackData.authorization_url;
            return;
        }

        // 2. Desktop Modal
        if (window.PaystackPop && paystackData.access_code) {
            try {
                const popup = paystackInstance || new window.PaystackPop();
                popup.resumeTransaction(paystackData.access_code, {
                    onSuccess: (transaction) => {
                        handleDesktopSuccess(orderId);
                    },
                    onCancel: () => {
                        console.log('[PAYSTACK] User closed modal');
                    }
                });
                return;
            } catch (error) {
                if (paystackData.authorization_url) {
                    window.location.href = paystackData.authorization_url;
                    return;
                }
            }
        }
        
        // 3. Absolute Fallback
        if (paystackData.authorization_url) {
            window.location.href = paystackData.authorization_url;
        } else {
            throw new Error('Could not open payment window.');
        }
    }

    function showPaymentSuccess(orderId) {
        const content = `
            <div class="paystack-modal-icon paystack-modal-icon--success">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <h3 class="paystack-modal-title">Payment Successful!</h3>
            <p class="paystack-modal-text">Your order #LV-${orderId.replace('LV-','')} has been confirmed.</p>
            <p class="paystack-modal-hint">Redirecting to confirmation page...</p>
        `;
        showStyledModal(content);
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
                .paystack-modal-icon--success { background: rgba(34, 197, 94, 0.1); color: #22c55e; }
                .paystack-modal-title { font-family: 'Oswald', sans-serif; font-size: 1.75rem; color: #fff; margin-bottom: 1rem; text-transform: uppercase; }
                .paystack-modal-text { color: rgba(255,255,255,0.7); margin-bottom: 1.5rem; }
                .paystack-modal-hint { color: rgba(255,255,255,0.5); font-size: 0.875rem; }
                @keyframes paystack-modal-fade-in { from { opacity: 0; } to { opacity: 1; } }
            `;
            document.head.appendChild(styles);
        }
        const modal = document.createElement('div');
        modal.id = 'paystack-modal';
        modal.innerHTML = `<div class="paystack-modal-overlay"><div class="paystack-modal-container">${content}</div></div>`;
        document.body.appendChild(modal);
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
