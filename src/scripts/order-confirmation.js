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

    function setConfirmationState(state, status, title, message) {
        const card = document.getElementById('confirmationCard');
        const statusEl = document.getElementById('confirmationStatus');
        const titleEl = document.getElementById('confirmationTitle');
        const messageEl = document.getElementById('confirmationMessage');

        if (card) {
            card.classList.toggle('is-pending', state === 'pending');
            card.classList.toggle('is-confirmed', state === 'confirmed');
        }
        if (statusEl) statusEl.textContent = status;
        if (titleEl) titleEl.textContent = title;
        if (messageEl) messageEl.textContent = message;
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
        if (paymentStatus !== 'success') {
            setConfirmationState(
                'confirmed',
                'Order confirmed',
                "You're all set.",
                'Your order is confirmed. We will send delivery updates using the contact details provided at checkout.'
            );
            return;
        }

        setConfirmationState(
            'pending',
            'Checking payment',
            'Confirming your order',
            'We are verifying the payment with Paystack. Keep this page open for a moment.'
        );

        if (!orderId || !reference) {
            // Do not trust the URL alone. The webhook can still finish the order,
            // but without a Paystack reference this page cannot independently verify it.
            setConfirmationState(
                'pending',
                'Payment pending',
                'Confirmation in progress',
                'We could not verify the payment from this page yet. Keep your order reference and check the tracking page shortly.'
            );
            return;
        }

        try {
            const result = await verifyReturnedPayment(orderId, reference);
            if (result.verified && result.status === 'paid') {
                clearCart();
                setConfirmationState(
                    'confirmed',
                    'Payment confirmed',
                    "You're all set.",
                    'Payment is confirmed and your order is now being prepared.'
                );
            } else {
                setConfirmationState(
                    'pending',
                    'Payment pending',
                    'Confirmation in progress',
                    'Paystack has not returned a final confirmation yet. Keep your order reference and check again shortly.'
                );
            }
        } catch (error) {
            console.warn('[ORDER CONFIRMATION] Verification pending:', error.message);
            setConfirmationState(
                'pending',
                'Payment pending',
                'Confirmation in progress',
                'We could not complete verification right now. Your order reference is safe and you can check its status shortly.'
            );
        }
    }

    window.addEventListener('componentsLoaded', initOrderConfirmation);
    window.addEventListener('load', initOrderConfirmation);
    document.addEventListener('DOMContentLoaded', initOrderConfirmation);

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        initOrderConfirmation();
    }
})();
