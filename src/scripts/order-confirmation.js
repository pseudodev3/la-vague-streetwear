/**
 * LA VAGUE - Order Confirmation Logic
 *
 * This page is a static "thank you" screen. Payment verification is handled
 * entirely by the Paystack checkout modal (which shows "Payment Successful!"
 * before redirecting here) and by the backend webhook. We do NOT re-verify on
 * this page — an earlier version did, and a transient verification lag left a
 * second "Payment pending" card stuck on screen indefinitely. The cart is
 * cleared by the checkout flow before the redirect, so nothing more is needed
 * here than displaying the order reference the customer just placed.
 */
(function () {
    const API_URL = '/api';
    let initialized = false;

    function clearCompletedOrderCart() {
        if (window.CartState && typeof window.CartState.clearCart === 'function') {
            window.CartState.clearCart();
        } else {
            localStorage.removeItem('cart');
            if (window.CartState) {
                window.CartState.cart = [];
                if (typeof window.CartState.updateCartCount === 'function') {
                    window.CartState.updateCartCount();
                }
            }
        }
    }

    async function verifyReturnedPaymentSilently(orderId, reference) {
        if (!orderId) return;
        try {
            const csrfRes = await fetch(`${API_URL}/csrf-token`, { credentials: 'include' });
            const csrfData = await csrfRes.json();
            if (!csrfRes.ok || !csrfData.csrfToken) return;

            await fetch(`${API_URL}/orders/verify-payment`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfData.csrfToken
                },
                body: JSON.stringify({ orderId, reference: reference || orderId })
            });
        } catch {
            // Webhook handles verification if the client call cannot reach the API.
        }
    }

    clearCompletedOrderCart();

    function initOrderConfirmation() {
        clearCompletedOrderCart();
        if (initialized) return;
        initialized = true;

        const urlParams = new URLSearchParams(window.location.search);
        const orderId = urlParams.get('order');
        const reference = urlParams.get('reference') || urlParams.get('trxref');

        const orderNumberEl = document.getElementById('orderNumber');
        if (orderNumberEl) {
            orderNumberEl.textContent = orderId
                ? orderId.toUpperCase()
                : `LV-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
        }

        if (orderId && (reference || urlParams.get('status') === 'success')) {
            void verifyReturnedPaymentSilently(orderId, reference);
        }
    }

    window.addEventListener('componentsLoaded', initOrderConfirmation);
    window.addEventListener('load', initOrderConfirmation);
    document.addEventListener('DOMContentLoaded', initOrderConfirmation);

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        initOrderConfirmation();
    }
})();
