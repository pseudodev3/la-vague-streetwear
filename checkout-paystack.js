/**
 * LA VAGUE - Paystack Payment Integration
 * Handles Paystack popup payment flow
 */

(function() {
    'use strict';

    // Configuration
    let PAYSTACK_PUBLIC_KEY = window.PAYSTACK_PUBLIC_KEY || '';
    const API_URL = window.location.hostname === 'localhost' 
        ? 'http://localhost:3000/api' 
        : 'https://la-vague-api.onrender.com/api';

    // State
    let currentOrderId = null;
    let currentOrderData = null;
    let isPaystackAvailable = false;
    let configLoaded = false;

    /**
     * Fetch Paystack configuration from backend
     */
    async function loadPaystackConfig() {
        if (configLoaded) return isPaystackConfigured();
        
        console.log('[PAYSTACK] Loading config from:', `${API_URL}/config/paystack`);
        
        try {
            const response = await fetch(`${API_URL}/config/paystack`, {
                credentials: 'include'
            });
            
            console.log('[PAYSTACK] Config response status:', response.status);
            
            const data = await response.json();
            console.log('[PAYSTACK] Config response:', data);
            
            if (data.success && data.configured) {
                PAYSTACK_PUBLIC_KEY = data.publicKey;
                console.log('[PAYSTACK] Config loaded! Test mode:', data.testMode);
                console.log('[PAYSTACK] Key prefix:', PAYSTACK_PUBLIC_KEY.substring(0, 10) + '...');
                configLoaded = true;
                return true;
            } else {
                console.log('[PAYSTACK] Not configured on backend:', data.error);
                configLoaded = true;
                return false;
            }
        } catch (error) {
            console.error('[PAYSTACK] Failed to load config:', error);
            configLoaded = true;
            return false;
        }
    }

    /**
     * Check if Paystack is configured
     */
    function isPaystackConfigured() {
        return !!PAYSTACK_PUBLIC_KEY && PAYSTACK_PUBLIC_KEY.startsWith('pk_');
    }

    /**
     * Load Paystack script dynamically
     */
    function loadPaystackScript() {
        return new Promise((resolve, reject) => {
            if (window.PaystackPop) {
                isPaystackAvailable = true;
                resolve();
                return;
            }

            if (!isPaystackConfigured()) {
                console.log('[PAYSTACK] Not configured, using manual payment');
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://js.paystack.co/v2/inline.js';
            script.async = true;
            script.onload = () => {
                console.log('[PAYSTACK] Script loaded');
                isPaystackAvailable = true;
                resolve();
            };
            script.onerror = () => {
                console.error('[PAYSTACK] Failed to load script');
                isPaystackAvailable = false;
                resolve(); // Resolve anyway to use fallback
            };
            document.head.appendChild(script);
        });
    }

    /**
     * Initialize Paystack payment
     */
    async function initializePaystackPayment(orderId, orderData, customerData) {
        if (!isPaystackAvailable || !window.PaystackPop) {
            throw new Error('Paystack is not available');
        }

        const amountInKobo = Math.round(orderData.total * 100); // Convert to kobo
        
        const paymentData = {
            key: PAYSTACK_PUBLIC_KEY,
            email: customerData.email,
            amount: amountInKobo,
            ref: `LV-${Date.now()}`,
            metadata: {
                order_id: orderId,
                custom_fields: [
                    {
                        display_name: "Order ID",
                        variable_name: "order_id",
                        value: orderId
                    },
                    {
                        display_name: "Customer Name",
                        variable_name: "customer_name",
                        value: customerData.name
                    }
                ]
            },
            onClose: function() {
                console.log('[PAYSTACK] Payment window closed');
                handlePaymentClosed(orderId);
            },
            callback: function(response) {
                console.log('[PAYSTACK] Payment callback:', response);
                handlePaymentCallback(orderId, response);
            }
        };

        // Add phone if available (helps with fraud detection)
        if (customerData.phone) {
            paymentData.phone = customerData.phone;
        }

        console.log('[PAYSTACK] Initializing payment:', { orderId, amount: amountInKobo });
        
        const popup = new window.PaystackPop();
        popup.newTransaction(paymentData);
    }

    /**
     * Handle payment window closed
     */
    async function handlePaymentClosed(orderId) {
        // Check if payment was successful via webhook
        console.log('[PAYSTACK] Checking payment status for order:', orderId);
        
        try {
            const status = await checkPaymentStatus(orderId);
            
            if (status === 'paid') {
                // Payment succeeded via webhook
                console.log('[PAYSTACK] Payment confirmed via webhook');
                redirectToConfirmation(orderId);
            } else {
                // Payment was cancelled or pending
                console.log('[PAYSTACK] Payment not completed:', status);
                showPaymentPendingMessage(orderId);
            }
        } catch (error) {
            console.error('[PAYSTACK] Error checking status:', error);
            showPaymentPendingMessage(orderId);
        }
    }

    /**
     * Handle payment callback
     */
    async function handlePaymentCallback(orderId, response) {
        const { reference, status, trans } = response;
        
        console.log('[PAYSTACK] Callback received:', { orderId, reference, status });
        
        if (status === 'success') {
            // Verify payment on backend
            try {
                const verifyResult = await verifyPaymentOnBackend(orderId, reference);
                
                if (verifyResult.success && verifyResult.status === 'paid') {
                    redirectToConfirmation(orderId);
                } else {
                    // Payment pending, webhook will handle it
                    showPaymentPendingMessage(orderId);
                }
            } catch (error) {
                console.error('[PAYSTACK] Verification error:', error);
                showPaymentPendingMessage(orderId);
            }
        } else {
            showPaymentFailedMessage(status);
        }
    }

    /**
     * Check payment status
     */
    async function checkPaymentStatus(orderId) {
        try {
            const response = await fetch(`${API_URL}/orders/lookup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId, email: currentOrderData?.customerEmail })
            });
            
            const result = await response.json();
            
            if (result.success && result.order) {
                return result.order.payment_status;
            }
            
            return 'pending';
        } catch (error) {
            console.error('[PAYSTACK] Status check error:', error);
            return 'pending';
        }
    }

    /**
     * Verify payment on backend
     */
    async function verifyPaymentOnBackend(orderId, reference) {
        try {
            // Get CSRF token first
            const csrfResponse = await fetch(`${API_URL}/csrf-token`);
            const csrfData = await csrfResponse.json();
            
            const response = await fetch(`${API_URL}/orders/verify-payment`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfData.csrfToken
                },
                body: JSON.stringify({ orderId, reference })
            });
            
            return await response.json();
        } catch (error) {
            console.error('[PAYSTACK] Backend verification error:', error);
            return { success: false };
        }
    }

    /**
     * Redirect to confirmation page
     */
    function redirectToConfirmation(orderId) {
        localStorage.removeItem('cart');
        window.location.href = `order-confirmation.html?order=${orderId}&status=success`;
    }

    /**
     * Show payment pending message
     */
    function showPaymentPendingMessage(orderId) {
        const content = `
            <div class="paystack-modal-icon paystack-modal-icon--pending">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M12 6v6l4 2"/>
                </svg>
            </div>
            <h3 class="paystack-modal-title">Processing Payment</h3>
            <p class="paystack-modal-text">Your payment is being verified. This may take a moment.</p>
            <div class="paystack-modal-order">
                <span class="paystack-modal-label">Order ID</span>
                <span class="paystack-modal-value">${orderId}</span>
            </div>
            <p class="paystack-modal-hint">You will receive an email confirmation once your payment is confirmed.</p>
            <div class="paystack-modal-actions">
                <a href="track-order.html" class="paystack-modal-btn paystack-modal-btn--secondary">Track Order</a>
            </div>
        `;
        
        showStyledModal(content);
    }

    /**
     * Show payment failed message
     */
    function showPaymentFailedMessage(status) {
        const content = `
            <div class="paystack-modal-icon paystack-modal-icon--error">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="15" y1="9" x2="9" y2="15"/>
                    <line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
            </div>
            <h3 class="paystack-modal-title">Payment Failed</h3>
            <p class="paystack-modal-text">We couldn't process your payment at this time.</p>
            <div class="paystack-modal-order">
                <span class="paystack-modal-label">Status</span>
                <span class="paystack-modal-value">${status}</span>
            </div>
            <p class="paystack-modal-hint">Please try again or use a different payment method.</p>
            <div class="paystack-modal-actions">
                <button onclick="closeModal()" class="paystack-modal-btn paystack-modal-btn--primary">Try Again</button>
            </div>
        `;
        
        showStyledModal(content);
    }

    /**
     * Show styled modal with LA VAGUE aesthetic
     */
    function showStyledModal(content) {
        // Remove existing modal
        const existingModal = document.getElementById('paystack-modal');
        if (existingModal) existingModal.remove();
        
        // Add styles if not already added
        if (!document.getElementById('paystack-modal-styles')) {
            const styles = document.createElement('style');
            styles.id = 'paystack-modal-styles';
            styles.textContent = `
                .paystack-modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.85);
                    backdrop-filter: blur(8px);
                    z-index: 10000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 1rem;
                    animation: paystack-modal-fade-in 0.3s ease;
                }
                
                @keyframes paystack-modal-fade-in {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                
                .paystack-modal-container {
                    background: #0a0a0a;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 4px;
                    max-width: 480px;
                    width: 100%;
                    padding: 3rem 2.5rem;
                    text-align: center;
                    box-shadow: 0 25px 80px rgba(0, 0, 0, 0.6);
                    animation: paystack-modal-slide-up 0.4s ease;
                }
                
                @keyframes paystack-modal-slide-up {
                    from { 
                        opacity: 0;
                        transform: translateY(30px);
                    }
                    to { 
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                
                .paystack-modal-icon {
                    width: 80px;
                    height: 80px;
                    margin: 0 auto 1.5rem;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                
                .paystack-modal-icon--pending {
                    background: rgba(245, 158, 11, 0.1);
                    color: #f59e0b;
                    animation: paystack-pulse 2s ease-in-out infinite;
                }
                
                .paystack-modal-icon--error {
                    background: rgba(220, 38, 38, 0.1);
                    color: #dc2626;
                }
                
                @keyframes paystack-pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.6; }
                }
                
                .paystack-modal-icon svg {
                    width: 40px;
                    height: 40px;
                }
                
                .paystack-modal-title {
                    font-family: 'Oswald', sans-serif;
                    font-size: 1.75rem;
                    font-weight: 600;
                    color: #fff;
                    margin: 0 0 1rem;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }
                
                .paystack-modal-text {
                    font-family: 'Inter', sans-serif;
                    font-size: 1rem;
                    color: rgba(255, 255, 255, 0.7);
                    margin: 0 0 1.5rem;
                    line-height: 1.6;
                }
                
                .paystack-modal-order {
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 4px;
                    padding: 1rem 1.5rem;
                    margin-bottom: 1.5rem;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                
                .paystack-modal-label {
                    font-family: 'Inter', sans-serif;
                    font-size: 0.875rem;
                    color: rgba(255, 255, 255, 0.5);
                    text-transform: uppercase;
                    letter-spacing: 0.1em;
                }
                
                .paystack-modal-value {
                    font-family: 'Inter', sans-serif;
                    font-size: 0.9375rem;
                    color: #fff;
                    font-weight: 500;
                    font-family: monospace;
                }
                
                .paystack-modal-hint {
                    font-family: 'Inter', sans-serif;
                    font-size: 0.875rem;
                    color: rgba(255, 255, 255, 0.5);
                    margin: 0 0 2rem;
                    line-height: 1.5;
                }
                
                .paystack-modal-actions {
                    display: flex;
                    gap: 1rem;
                    justify-content: center;
                }
                
                .paystack-modal-btn {
                    font-family: 'Oswald', sans-serif;
                    font-size: 0.875rem;
                    font-weight: 500;
                    text-transform: uppercase;
                    letter-spacing: 0.1em;
                    padding: 1rem 2.5rem;
                    border: none;
                    border-radius: 0;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    text-decoration: none;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                }
                
                .paystack-modal-btn--primary {
                    background: #dc2626;
                    color: #fff;
                }
                
                .paystack-modal-btn--primary:hover {
                    background: #ef4444;
                    transform: translateY(-1px);
                }
                
                .paystack-modal-btn--secondary {
                    background: transparent;
                    color: #fff;
                    border: 1px solid rgba(255, 255, 255, 0.3);
                }
                
                .paystack-modal-btn--secondary:hover {
                    background: rgba(255, 255, 255, 0.1);
                    border-color: rgba(255, 255, 255, 0.5);
                }
                
                @media (max-width: 480px) {
                    .paystack-modal-container {
                        padding: 2rem 1.5rem;
                    }
                    
                    .paystack-modal-title {
                        font-size: 1.5rem;
                    }
                    
                    .paystack-modal-actions {
                        flex-direction: column;
                    }
                    
                    .paystack-modal-btn {
                        width: 100%;
                    }
                }
            `;
            document.head.appendChild(styles);
        }
        
        const modal = document.createElement('div');
        modal.id = 'paystack-modal';
        modal.innerHTML = `
            <div class="paystack-modal-overlay">
                <div class="paystack-modal-container">
                    ${content}
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    /**
     * Close modal
     */
    window.closeModal = function() {
        const modal = document.getElementById('paystack-modal');
        if (modal) {
            modal.style.animation = 'paystack-modal-fade-in 0.2s ease reverse';
            setTimeout(() => modal.remove(), 200);
        }
    };

    /**
     * Process order with Paystack
     */
    async function processOrderWithPaystack(orderData) {
        await loadPaystackScript();
        
        if (!isPaystackAvailable) {
            throw new Error('Paystack not available');
        }
        
        // Get CSRF token first (with credentials for cookie)
        let csrfToken = '';
        try {
            const csrfResponse = await fetch(`${API_URL}/csrf-token`, {
                credentials: 'include'
            });
            const csrfData = await csrfResponse.json();
            csrfToken = csrfData.csrfToken;
            console.log('[PAYSTACK] CSRF token obtained');
        } catch (error) {
            console.error('[PAYSTACK] Failed to get CSRF token:', error);
            throw new Error('CSRF token missing - please refresh and try again');
        }
        
        const orderPayload = {
            ...orderData,
            paymentMethod: 'paystack'
        };
        
        console.log('[PAYSTACK] Creating order:', orderPayload);
        
        const response = await fetch(`${API_URL}/orders`, {
            method: 'POST',
            credentials: 'include',
            headers: { 
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify(orderPayload)
        });
        
        const result = await response.json();
        
        if (!response.ok || !result.success) {
            throw new Error(result.error || result.message || 'Failed to create order');
        }
        
        currentOrderId = result.orderId;
        currentOrderData = orderPayload;
        
        console.log('[PAYSTACK] Order created:', currentOrderId);
        
        // Initialize Paystack payment
        await initializePaystackPayment(
            currentOrderId,
            orderPayload,
            {
                email: orderData.customerEmail,
                name: orderData.customerName,
                phone: orderData.customerPhone
            }
        );
        
        return { success: true, orderId: currentOrderId };
    }

    /**
     * Update UI to show Paystack option
     */
    function updatePaymentUI() {
        if (!isPaystackConfigured()) {
            console.log('[PAYSTACK] Not configured, keeping manual payment UI');
            return;
        }
        
        const paymentSection = document.getElementById('paymentSection');
        if (!paymentSection) return;
        
        // Update payment methods to show Paystack
        const paymentMethods = paymentSection.querySelector('.payment-methods');
        if (paymentMethods) {
            paymentMethods.innerHTML = `
                <label class="payment-method active">
                    <input type="radio" name="payment" value="paystack" checked>
                    <span>Pay with Card/Bank Transfer</span>
                    <div class="payment-icons">
                        <span class="payment-icon">💳</span>
                        <span class="payment-icon">🏦</span>
                    </div>
                </label>
                <label class="payment-method">
                    <input type="radio" name="payment" value="manual">
                    <span>Pay on Delivery</span>
                    <div class="payment-icons">
                        <span class="payment-icon">💵</span>
                    </div>
                </label>
            `;
        }
        
        // Hide card form for Paystack (it's handled in popup)
        const cardForm = paymentSection.querySelector('.card-form');
        if (cardForm) {
            cardForm.style.display = 'none';
        }
        
        // Add payment method change handler
        const paymentInputs = paymentSection.querySelectorAll('input[name="payment"]');
        paymentInputs.forEach(input => {
            input.addEventListener('change', (e) => {
                const isPaystack = e.target.value === 'paystack';
                if (cardForm) {
                    cardForm.style.display = isPaystack ? 'none' : 'block';
                }
            });
        });
        
        console.log('[PAYSTACK] UI updated');
    }

    // Public API
    window.PaystackCheckout = {
        isConfigured: isPaystackConfigured,
        isAvailable: () => isPaystackAvailable,
        loadScript: loadPaystackScript,
        processOrder: processOrderWithPaystack,
        updateUI: updatePaymentUI,
        
        // Initialize
        init: async function() {
            await loadPaystackConfig(); // Load config first
            await loadPaystackScript();
            updatePaymentUI();
            console.log('[PAYSTACK] Checkout initialized');
        }
    };

    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.PaystackCheckout.init();
        });
    } else {
        window.PaystackCheckout.init();
    }
})();
