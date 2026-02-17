/**
 * LA VAGUE - Paystack Payment Integration
 * Handles Paystack popup payment flow with Mobile Redirect Fallback
 * Version: 4.2 (Cache Busted)
 */
(function() {
    const API_URL = window.location.hostname === 'localhost' 
        ? 'http://localhost:3000/api' 
        : 'https://la-vague-api.onrender.com/api';

    let PAYSTACK_PUBLIC_KEY = window.PAYSTACK_PUBLIC_KEY || '';
    let configLoaded = false;
    let isPaystackAvailable = false;
    let paystackInstance = null;
    let currentOrderId = null;

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

        // 1. Mobile Redirect (100% Reliable for phones)
        if (isMobile() && paystackData.authorization_url) {
            console.log('[PAYSTACK] Mobile detected, redirecting...');
            window.location.href = paystackData.authorization_url;
            return;
        }

        // 2. Desktop Modal (Premium feel)
        if (window.PaystackPop && paystackData.access_code) {
            try {
                const popup = paystackInstance || new window.PaystackPop();
                popup.resumeTransaction(paystackData.access_code);
                return;
            } catch (error) {
                console.warn('[PAYSTACK] Modal failed, falling back to redirect:', error.message);
            }
        }
        
        // 3. Absolute Fallback: Redirect if Modal isn't available or fails
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
        
        const payload = { ...orderData, paymentMethod: 'paystack' };
        
        // If we already tried and got an orderId, we might want to resume it
        // but for now, we create a fresh attempt
        
        let response;
        try {
            if (window.CSRFProtection) {
                response = await window.CSRFProtection.fetch(`${API_URL}/orders`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            } else {
                response = await fetch(`${API_URL}/orders`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            }
        } catch (err) {
            throw new Error('Connection failed. Please check your internet.');
        }
        
        const result = await response.json();
        
        if (!response.ok || !result.success) {
            // Check for specific backend errors
            const serverError = result.error || 'Server error';
            throw new Error(serverError);
        }
        
        currentOrderId = result.orderId;
        
        // Trigger payment flow
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
