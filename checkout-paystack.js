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
     * Get base currency amount (NGN) from order data
     * 
     * IMPORTANT: Product prices in cart are stored in the BASE currency (NGN).
     * The CurrencyConfig display is just for UI - it converts NGN to user's
     * selected currency for display purposes only.
     * 
     * So orderData.total is ALREADY in NGN, no conversion needed!
     * We just need to convert from Naira to Kobo (multiply by 100).
     */
    function getBaseAmountInNGN(amount) {
        console.log('[PAYSTACK] Amount is already in base currency (NGN):', amount);
        return Math.round(amount);
    }

    /**
     * Initialize Paystack payment
     */
    async function initializePaystackPayment(orderId, orderData, customerData) {
        if (!isPaystackAvailable || !window.PaystackPop) {
            throw new Error('Paystack is not available');
        }

        // Amount is already in base currency (NGN), convert to kobo (1 NGN = 100 kobo)
        const amountInNGN = getBaseAmountInNGN(orderData.total);
        const amountInKobo = amountInNGN * 100;
        
        // Validate amount
        if (!amountInKobo || amountInKobo <= 0) {
            console.error('[PAYSTACK] Invalid amount:', { 
                total: orderData.total, 
                amountInNGN, 
                amountInKobo,
                orderData 
            });
            throw new Error('Invalid payment amount: ' + orderData.total);
        }
        
        // Minimum amount check (Paystack minimum is usually 100 kobo = ₦1)
        if (amountInKobo < 100) {
            console.error('[PAYSTACK] Amount too small:', amountInKobo);
            throw new Error('Payment amount too small. Minimum is ₦1 (100 kobo)');
        }
        
        const paymentData = {
            key: PAYSTACK_PUBLIC_KEY,
            email: customerData.email,
            amount: amountInKobo,
            currency: 'NGN', // Explicitly set currency to NGN
            ref: `LV-${Date.now()}`,
            metadata: {
                order_id: orderId,
                display_currency: CurrencyConfig.getCurrentCurrency(),
                base_currency: 'NGN',
                amount_ngn: amountInNGN,
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

        console.log('[PAYSTACK] Initializing payment:', { 
            orderId, 
            total: orderData.total,
            displayCurrency: CurrencyConfig.getCurrentCurrency(),
            baseCurrency: 'NGN',
            ngnAmount: amountInNGN,
            koboAmount: amountInKobo,
            keyPrefix: PAYSTACK_PUBLIC_KEY.substring(0, 10) + '...',
            hasEmail: !!customerData.email,
            emailDomain: customerData.email ? customerData.email.split('@')[1] : 'none'
        });
        
        try {
            const popup = new window.PaystackPop();
            const result = popup.newTransaction(paymentData);
            console.log('[PAYSTACK] Popup opened successfully:', result);
        } catch (error) {
            console.error('[PAYSTACK] Failed to open popup:', error);
            console.error('[PAYSTACK] Error details:', {
                message: error.message,
                stack: error.stack,
                paymentData: {
                    ...paymentData,
                    key: '***hidden***' // Don't log full key
                }
            });
            throw new Error('Failed to initialize Paystack: ' + (error.message || 'Unknown error'));
        }
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
            // Get CSRF token first (with credentials)
            const csrfResponse = await fetch(`${API_URL}/csrf-token`, {
                credentials: 'include'
            });
            const csrfData = await csrfResponse.json();
            
            const response = await fetch(`${API_URL}/orders/verify-payment`, {
                method: 'POST',
                credentials: 'include',
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
        window.location.href = `/order-confirmation?order=${orderId}&status=success`;
    }

    // Polling state
    let pollInterval = null;
    let pollAttempts = 0;
    const MAX_POLL_ATTEMPTS = 40; // 2 minutes (3 seconds * 40)

    /**
     * Show payment pending message with auto-polling
     */
    function showPaymentPendingMessage(orderId) {
        pollAttempts = 0;
        
        const content = `
            <div class="paystack-modal-icon paystack-modal-icon--pending" id="paystack-status-icon">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M12 6v6l4 2"/>
                </svg>
            </div>
            <h3 class="paystack-modal-title" id="paystack-status-title">Processing Payment</h3>
            <p class="paystack-modal-text" id="paystack-status-text">Verifying your payment. Please wait...</p>
            <div class="paystack-modal-order">
                <span class="paystack-modal-label">Order ID</span>
                <span class="paystack-modal-value">${orderId}</span>
            </div>
            <div class="paystack-modal-progress" id="paystack-progress-container">
                <div class="paystack-modal-progress-bar" id="paystack-progress-bar"></div>
            </div>
            <p class="paystack-modal-hint" id="paystack-status-hint">This usually takes a few seconds</p>
            <div class="paystack-modal-actions" id="paystack-modal-actions">
                <button onclick="window.refreshPaymentStatus('${orderId}')" class="paystack-modal-btn paystack-modal-btn--secondary" id="paystack-refresh-btn" style="display: none;">
                    Check Again
                </button>
                <a href="/track-order" class="paystack-modal-btn paystack-modal-btn--secondary">Track Order</a>
            </div>
        `;
        
        showStyledModal(content);
        
        // Start polling
        startPaymentPolling(orderId);
    }

    /**
     * Start polling for payment status
     */
    function startPaymentPolling(orderId) {
        // Clear any existing interval
        if (pollInterval) {
            clearInterval(pollInterval);
        }
        
        // Update progress bar
        updateProgressBar();
        
        // Poll immediately
        checkAndUpdateStatus(orderId);
        
        // Then poll every 3 seconds
        pollInterval = setInterval(() => {
            pollAttempts++;
            updateProgressBar();
            checkAndUpdateStatus(orderId);
        }, 3000);
    }

    /**
     * Update progress bar
     */
    function updateProgressBar() {
        const progressBar = document.getElementById('paystack-progress-bar');
        if (progressBar) {
            const progress = Math.min((pollAttempts / MAX_POLL_ATTEMPTS) * 100, 100);
            progressBar.style.width = `${progress}%`;
        }
    }

    /**
     * Check payment status and update UI
     */
    async function checkAndUpdateStatus(orderId) {
        try {
            const status = await checkPaymentStatus(orderId);
            console.log(`[PAYSTACK POLL] Attempt ${pollAttempts}: status = ${status}`);
            
            if (status === 'paid') {
                // Payment successful!
                clearInterval(pollInterval);
                showPaymentSuccess(orderId);
                return;
            }
            
            if (status === 'failed') {
                // Payment failed
                clearInterval(pollInterval);
                updateModalToFailed();
                return;
            }
            
            // Still pending - update hint text occasionally
            if (pollAttempts === 10) {
                updateStatusHint('Still processing... Checking again');
            } else if (pollAttempts === 20) {
                updateStatusHint('Taking longer than usual. Please wait...');
            }
            
            // Timeout after max attempts
            if (pollAttempts >= MAX_POLL_ATTEMPTS) {
                clearInterval(pollInterval);
                updateModalToTimeout(orderId);
            }
            
        } catch (error) {
            console.error('[PAYSTACK POLL] Error checking status:', error);
        }
    }

    /**
     * Update status hint text
     */
    function updateStatusHint(text) {
        const hint = document.getElementById('paystack-status-hint');
        if (hint) {
            hint.textContent = text;
        }
    }

    /**
     * Show payment success and auto-redirect
     */
    function showPaymentSuccess(orderId) {
        const icon = document.getElementById('paystack-status-icon');
        const title = document.getElementById('paystack-status-title');
        const text = document.getElementById('paystack-status-text');
        const progressContainer = document.getElementById('paystack-progress-container');
        const hint = document.getElementById('paystack-status-hint');
        const actions = document.getElementById('paystack-modal-actions');
        
        // Update icon
        if (icon) {
            icon.className = 'paystack-modal-icon paystack-modal-icon--success';
            icon.innerHTML = `
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="20 6 9 17 4 12"/>
                </svg>
            `;
        }
        
        // Update text
        if (title) title.textContent = 'Payment Successful!';
        if (text) text.textContent = 'Your payment has been confirmed.';
        if (progressContainer) progressContainer.style.display = 'none';
        if (hint) hint.textContent = 'Redirecting to confirmation page...';
        
        // Update actions
        if (actions) {
            actions.innerHTML = `
                <button onclick="window.location.href='/order-confirmation?order=${orderId}&status=success'" 
                        class="paystack-modal-btn paystack-modal-btn--primary">
                    View Order
                </button>
            `;
        }
        
        // Auto-redirect after 2 seconds
        setTimeout(() => {
            redirectToConfirmation(orderId);
        }, 2000);
    }

    /**
     * Update modal to failed state
     */
    function updateModalToFailed() {
        const icon = document.getElementById('paystack-status-icon');
        const title = document.getElementById('paystack-status-title');
        const text = document.getElementById('paystack-status-text');
        const progressContainer = document.getElementById('paystack-progress-container');
        const hint = document.getElementById('paystack-status-hint');
        const actions = document.getElementById('paystack-modal-actions');
        
        if (icon) {
            icon.className = 'paystack-modal-icon paystack-modal-icon--error';
            icon.innerHTML = `
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="15" y1="9" x2="9" y2="15"/>
                    <line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
            `;
        }
        
        if (title) title.textContent = 'Payment Failed';
        if (text) text.textContent = 'We couldn\'t verify your payment.';
        if (progressContainer) progressContainer.style.display = 'none';
        if (hint) hint.textContent = 'Please try again or use a different payment method.';
        
        if (actions) {
            actions.innerHTML = `
                <button onclick="closeModal()" class="paystack-modal-btn paystack-modal-btn--primary">Try Again</button>
            `;
        }
    }

    /**
     * Update modal to timeout state
     */
    function updateModalToTimeout(orderId) {
        const title = document.getElementById('paystack-status-title');
        const text = document.getElementById('paystack-status-text');
        const progressContainer = document.getElementById('paystack-progress-container');
        const hint = document.getElementById('paystack-status-hint');
        const refreshBtn = document.getElementById('paystack-refresh-btn');
        
        if (title) title.textContent = 'Still Processing';
        if (text) text.textContent = 'Your payment is taking longer than expected.';
        if (progressContainer) progressContainer.style.display = 'none';
        if (hint) hint.textContent = 'Don\'t worry! If your payment was successful, you\'ll receive an email confirmation.';
        if (refreshBtn) refreshBtn.style.display = 'inline-flex';
    }

    /**
     * Manual refresh handler
     */
    window.refreshPaymentStatus = async function(orderId) {
        const refreshBtn = document.getElementById('paystack-refresh-btn');
        if (refreshBtn) {
            refreshBtn.textContent = 'Checking...';
            refreshBtn.disabled = true;
        }
        
        await checkAndUpdateStatus(orderId);
        
        if (refreshBtn) {
            refreshBtn.textContent = 'Check Again';
            refreshBtn.disabled = false;
        }
    };

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
                
                .paystack-modal-icon--success {
                    background: rgba(34, 197, 94, 0.1);
                    color: #22c55e;
                    animation: paystack-success-pop 0.5s ease;
                }
                
                @keyframes paystack-success-pop {
                    0% { transform: scale(0.8); opacity: 0; }
                    50% { transform: scale(1.1); }
                    100% { transform: scale(1); opacity: 1; }
                }
                
                .paystack-modal-progress {
                    width: 100%;
                    height: 3px;
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 2px;
                    margin: 1.5rem 0;
                    overflow: hidden;
                }
                
                .paystack-modal-progress-bar {
                    height: 100%;
                    background: linear-gradient(90deg, #dc2626, #ef4444);
                    border-radius: 2px;
                    transition: width 0.3s ease;
                    width: 0%;
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
            <div class="paystack-modal-overlay" id="paystack-modal-overlay">
                <div class="paystack-modal-container" id="paystack-modal-container">
                    ${content}
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Add click-outside-to-close functionality
        const overlay = document.getElementById('paystack-modal-overlay');
        const container = document.getElementById('paystack-modal-container');
        
        if (overlay && container) {
            overlay.addEventListener('click', (e) => {
                // Only close if clicking directly on the overlay (outside the container)
                if (e.target === overlay) {
                    console.log('[PAYSTACK] Modal closed by clicking outside');
                    closeModal();
                }
            });
        }
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
                    <span>Pay with Card / Bank Transfer</span>
                    <div class="payment-icons">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="payment-icon">
                            <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
                            <line x1="1" y1="10" x2="23" y2="10"></line>
                        </svg>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="payment-icon">
                            <path d="M3 21h18"></path>
                            <path d="M3 10h18"></path>
                            <path d="M5 6l7-3 7 3"></path>
                            <path d="M4 10v11"></path>
                            <path d="M20 10v11"></path>
                            <path d="M8 14v3"></path>
                            <path d="M12 14v3"></path>
                            <path d="M16 14v3"></path>
                        </svg>
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
