/**
 * LA VAGUE - Order Confirmation Logic
 * Clears the cart only after the backend confirms a Paystack payment as paid.
 */
(function () {
    const API_URL = '/api';
    let initialized = false;

    function clearCart() {
        localStorage.removeItem('cart');
    }

    async function getCsrfToken() {
        const response = await fetch(`${API_URL}/csrf-token`, { credentials: 'include' });
        const data = await response.json();
        if (!response.ok || !data.csrfToken) {
            throw new Error('Could not start secure payment verification');
        }
        return data.csrfToken;
    }

    async function verifyReturnedPayment(orderId, reference) {
        const csrfToken = await getCsrfToken();
        const response = await fetch(`${API_URL}/orders/verify-payment`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify({ orderId, reference })
        });
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.error || 'Payment verification failed');
        }
        return result;
    }

    function setConfirmationMessage(message) {
        const confirmationMsg = document.querySelector('.confirmation > p');
        if (confirmationMsg) confirmationMsg.textContent = message;
    }

    async function initOrderConfirmation() {
        if (initialized) return;
        initialized = true;

        const urlParams = new URLSearchParams(window.location.search);
        const orderId = urlParams.get('order');
        const paymentStatus = urlParams.get('status');
        const reference = urlParams.get('reference') || urlParams.get('trxref');

        const orderNumberEl = document.getElementById('orderNumber');
        if (orderNumberEl) {
            orderNumberEl.textContent = orderId
                ? orderId.toUpperCase()
                : `LV-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
        }

        // Non-Paystack/manual checkout already clears the cart before this page.
        if (paymentStatus !== 'success') return;

        if (!orderId || !reference) {
            // Do not trust the URL alone. The webhook can still finish the order,
            // but without a Paystack reference this page cannot independently verify it.
            setConfirmationMessage('Your payment is being confirmed. Please keep your order number for reference.');
            return;
        }

        try {
            const result = await verifyReturnedPayment(orderId, reference);
            if (result.verified && result.status === 'paid') {
                clearCart();
                setConfirmationMessage("Your payment was successful! We've confirmed your order.");
            } else {
                setConfirmationMessage('Your payment is still being confirmed. Please keep your order number for reference.');
            }
        } catch (error) {
            console.warn('[ORDER CONFIRMATION] Verification pending:', error.message);
            setConfirmationMessage('Your payment is still being confirmed. Please keep your order number for reference.');
        }
    }

    window.addEventListener('componentsLoaded', initOrderConfirmation);
    window.addEventListener('load', initOrderConfirmation);
    document.addEventListener('DOMContentLoaded', initOrderConfirmation);

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        initOrderConfirmation();
    }
})();
