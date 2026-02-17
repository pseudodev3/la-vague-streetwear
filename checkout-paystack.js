/**
 * LA VAGUE - Paystack Payment Integration
 * Handles Paystack popup payment flow with Mobile Redirect Fallback
 * Version: 4.3 (Safari Mobile Resilience)
 */
(function() {
    const API_URL = window.location.hostname === 'localhost' 
        ? 'http://localhost:3000/api' 
        : 'https://la-vague-api.onrender.com/api';

    let PAYSTACK_PUBLIC_KEY = window.PAYSTACK_PUBLIC_KEY || '';
    let configLoaded = false;
    let isPaystackAvailable = false;
    let paystackInstance = null;

    /**
     * Detection for mobile devices to determine payment strategy
     */
    const isMobile = () => /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    /**
     * Pre-initialize Paystack instance for Desktop
     */
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

    /**
     * Primary Payment Handler
     */
    async function initializePaystackPayment(orderId, paystackData) {
        if (!paystackData || (!paystackData.access_code && !paystackData.authorization_url)) {
            throw new Error('Payment initialization data missing from server');
        }

        // 1. Mobile Redirect (100% Reliable for Safari/Chrome on iOS)
        if (isMobile() && paystackData.authorization_url) {
            window.location.href = paystackData.authorization_url;
            return;
        }

        // 2. Desktop Modal
        if (window.PaystackPop && paystackData.access_code) {
            try {
                const popup = paystackInstance || new window.PaystackPop();
                popup.resumeTransaction(paystackData.access_code);
                return;
            } catch (error) {
                console.warn('[PAYSTACK] Modal failed, falling back to redirect');
            }
        }
        
        // 3. Absolute Fallback
        if (paystackData.authorization_url) {
            window.location.href = paystackData.authorization_url;
        } else {
            throw new Error('Could not open payment window. Please check your browser settings.');
        }
    }

    /**
     * Process order with Paystack
     */
    async function processOrderWithPaystack(orderData) {
        await loadPaystackScript();
        
        // Safari/ITP Resilience: Refresh the CSRF token IMMEDIATELY before the POST
        // This ensures the header token is fresh even if the cookie is blocked
        let freshToken = '';
        try {
            const tokenRes = await fetch(`${API_URL}/csrf-token`, { credentials: 'include' });
            const tokenData = await tokenRes.json();
            freshToken = tokenData.csrfToken;
        } catch (e) {
            console.warn('[PAYSTACK] Could not refresh token, proceeding with existing');
        }
        
        const payload = { ...orderData, paymentMethod: 'paystack' };
        
        const response = await fetch(`${API_URL}/orders`, {
            method: 'POST',
            credentials: 'include',
            headers: { 
                'Content-Type': 'application/json',
                'X-CSRF-Token': freshToken || (window.CSRFProtection ? window.CSRFProtection.getToken() : '')
            },
            body: JSON.stringify(payload)
        });
        
        const result = await response.json();
        
        if (!response.ok || !result.success) {
            throw new Error(result.error || 'Server error');
        }
        
        await initializePaystackPayment(result.orderId, result.paystack);
        return { success: true, orderId: result.orderId };
    }

    // Public API
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
