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
    let initialized = false;

    function initOrderConfirmation() {
        if (initialized) return;
        initialized = true;

        const urlParams = new URLSearchParams(window.location.search);
        const orderId = urlParams.get('order');

        const orderNumberEl = document.getElementById('orderNumber');
        if (orderNumberEl) {
            orderNumberEl.textContent = orderId
                ? orderId.toUpperCase()
                : `LV-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
        }
    }

    window.addEventListener('componentsLoaded', initOrderConfirmation);
    window.addEventListener('load', initOrderConfirmation);
    document.addEventListener('DOMContentLoaded', initOrderConfirmation);

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        initOrderConfirmation();
    }
})();
