/**
 * LA VAGUE - Paystack Payment Integration
 * Handles Paystack popup payment flow with Mobile Redirect Fallback
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
                window.PAYSTACK_PUBLIC_KEY = data.publicKey; // Sync globally
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
     * Logic: Use Modal on Desktop, Redirect on Mobile for 100% reliability
     */
    async function initializePaystackPayment(orderId, paystackData) {
        if (!paystackData || !paystackData.access_code) {
            throw new Error('Payment initialization failed on server');
        }

        // Strategy 1: Mobile Redirect (Most reliable for mobile browsers that block popups)
        if (isMobile() && paystackData.authorization_url) {
            window.location.href = paystackData.authorization_url;
            return;
        }

        // Strategy 2: Desktop Modal
        if (!isPaystackAvailable || !window.PaystackPop) {
            // Fallback if script failed to load
            if (paystackData.authorization_url) {
                window.location.href = paystackData.authorization_url;
                return;
            }
            throw new Error('Payment gateway unavailable');
        }
        
        try {
            const popup = paystackInstance || new window.PaystackPop();
            popup.resumeTransaction(paystackData.access_code);
        } catch (error) {
            // Final fallback: Redirect if Modal fails to open
            if (paystackData.authorization_url) {
                window.location.href = paystackData.authorization_url;
            } else {
                throw new Error('Failed to open payment window');
            }
        }
    }

    /**
     * Process order with Paystack
     */
    async function processOrderWithPaystack(orderData) {
        await loadPaystackScript();
        
        // Use global CSRF utility for reliability
        let response;
        if (window.CSRFProtection) {
            response = await window.CSRFProtection.fetch(`${API_URL}/orders`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...orderData, paymentMethod: 'paystack' })
            });
        } else {
            // Fallback if utility not found
            response = await fetch(`${API_URL}/orders`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...orderData, paymentMethod: 'paystack' })
            });
        }
        
        const result = await response.json();
        if (!response.ok || !result.success) {
            throw new Error(result.error || 'Failed to create order');
        }
        
        // Trigger payment (Modal or Redirect)
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
