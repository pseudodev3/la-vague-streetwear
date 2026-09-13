/**
 * LA VAGUE - Checkout Page JavaScript
 */

const API_URL = '/api';

const state = {
    cart: JSON.parse(localStorage.getItem('cart')) || [],
    shipping: 0,
    discount: 0,
    discountCode: null,
    isFreeShippingCoupon: false,
    settings: {
        shippingRate: 10000,
        expressShippingRate: 25000,
        freeShippingThreshold: 150000
    }
};

let elements = {};

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

async function initCheckout() {
    elements = {
        nav: document.getElementById('nav'),
        summaryItems: document.getElementById('summaryItems'),
        summarySubtotal: document.getElementById('summarySubtotal'),
        summaryShipping: document.getElementById('summaryShipping'),
        summaryDiscount: document.getElementById('summaryDiscount'),
        summaryTotal: document.getElementById('summaryTotal'),
        discountLine: document.getElementById('discountLine'),
        discountCode: document.getElementById('discountCode'),
        applyDiscount: document.getElementById('applyDiscount'),
        shippingOptions: document.querySelectorAll('input[name="shipping"]'),
        placeOrderBtn: document.getElementById('placeOrderBtn'),
        toastContainer: document.getElementById('toastContainer'),
        standardShippingPrice: document.getElementById('standardShipping'),
        expressShippingPrice: document.getElementById('expressShipping')
    };

    if (state.cart.length === 0) {
        window.location.href = 'shop.html';
        return;
    }

    await loadSettings();
    updateShippingState();
    render();
    bindEvents();

    window.addEventListener(
        'scroll',
        () => {
            if (window.scrollY > 50) elements.nav?.classList.add('scrolled');
            else elements.nav?.classList.remove('scrolled');
        },
        { passive: true }
    );
}

function render() {
    if (!elements.summaryItems) return;

    elements.summaryItems.innerHTML = state.cart
        .map(
            item => `
        <div class="summary-item">
            <div class="summary-item-image">
                <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}">
                <span class="summary-item-qty">${Number(item.quantity) || 0}</span>
            </div>
            <div class="summary-item-details">
                <p class="summary-item-name">${escapeHtml(item.name)}</p>
                <p class="summary-item-variant">${escapeHtml(item.color)} / ${escapeHtml(item.size)}</p>
            </div>
            <span class="summary-item-price">${CurrencyConfig.formatPrice(Number(item.price) * Number(item.quantity))}</span>
        </div>
    `
        )
        .join('');

    const subtotal = state.cart.reduce(
        (sum, item) => sum + Number(item.price) * Number(item.quantity),
        0
    );
    const total = subtotal + state.shipping - state.discount;

    elements.summarySubtotal.textContent = CurrencyConfig.formatPrice(subtotal);
    elements.summaryShipping.textContent =
        state.shipping === 0 ? 'FREE' : CurrencyConfig.formatPrice(state.shipping);
    elements.summaryTotal.textContent = CurrencyConfig.formatPrice(total);

    if (state.discount > 0) {
        elements.summaryDiscount.textContent = `-${CurrencyConfig.formatPrice(state.discount)}`;
        elements.discountLine.style.display = 'flex';
    } else {
        elements.discountLine.style.display = 'none';
    }

    if (state.isFreeShippingCoupon || subtotal >= state.settings.freeShippingThreshold) {
        elements.standardShippingPrice.textContent = 'FREE';
    } else {
        elements.standardShippingPrice.textContent = CurrencyConfig.formatPrice(
            state.settings.shippingRate
        );
    }

    elements.expressShippingPrice.textContent = state.isFreeShippingCoupon
        ? 'FREE'
        : CurrencyConfig.formatPrice(state.settings.expressShippingRate);
}

function updateShippingState() {
    const subtotal = state.cart.reduce(
        (sum, item) => sum + Number(item.price) * Number(item.quantity),
        0
    );
    const selectedShipping =
        document.querySelector('input[name="shipping"]:checked')?.value || 'standard';

    if (state.isFreeShippingCoupon) {
        state.shipping = 0;
    } else if (selectedShipping === 'express') {
        state.shipping = state.settings.expressShippingRate;
    } else {
        state.shipping =
            subtotal >= state.settings.freeShippingThreshold ? 0 : state.settings.shippingRate;
    }
}

async function loadSettings() {
    try {
        const response = await fetch(`${API_URL}/config/settings`);
        const data = await response.json();
        if (!response.ok || !data.success || !data.settings) return;

        state.settings.shippingRate = Number(data.settings.shippingRate) || 10000;
        state.settings.expressShippingRate = Number(data.settings.expressShippingRate) || 25000;
        state.settings.freeShippingThreshold =
            Number(data.settings.freeShippingThreshold) || 150000;
    } catch (error) {
        console.error('[CHECKOUT] Failed to load settings:', error);
    }
}

function bindEvents() {
    elements.shippingOptions = document.querySelectorAll('input[name="shipping"]');
    elements.shippingOptions.forEach(option => {
        option.addEventListener('change', () => {
            updateShippingState();
            render();
        });
    });

    elements.applyDiscount?.addEventListener('click', applyDiscountCode);
    elements.discountCode?.addEventListener('keypress', event => {
        if (event.key === 'Enter') applyDiscountCode();
    });
    elements.placeOrderBtn?.addEventListener('click', handlePlaceOrder);
}

async function getCsrfToken() {
    const response = await fetch(`${API_URL}/csrf-token`, { credentials: 'include' });
    const data = await response.json();
    if (!response.ok || !data.csrfToken) throw new Error('Could not start secure checkout');
    return data.csrfToken;
}

async function applyDiscountCode() {
    const code = elements.discountCode.value.trim().toUpperCase();
    if (!code) {
        showToast('Please enter a discount code', 'error');
        return;
    }

    const subtotal = state.cart.reduce(
        (sum, item) => sum + Number(item.price) * Number(item.quantity),
        0
    );
    const cartTotal = subtotal + state.shipping;

    try {
        const csrfToken = await getCsrfToken();
        const response = await fetch(`${API_URL}/orders/validate-coupon`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify({ code, cartTotal })
        });
        const data = await response.json();

        if (!response.ok || !data.valid) {
            showToast(data.error || 'Invalid code', 'error');
            return;
        }

        state.discount = Number(data.coupon.discount) || 0;
        state.isFreeShippingCoupon = data.coupon.type === 'free_shipping';
        state.discountCode = code;
        updateShippingState();
        render();
        elements.discountCode.value = '';

        showToast(
            state.isFreeShippingCoupon
                ? 'Free shipping applied!'
                : `Coupon applied! ₦${state.discount.toLocaleString()} off`,
            'success'
        );
    } catch (error) {
        console.error('[CHECKOUT] Coupon validation failed:', error);
        showToast('Failed to validate coupon', 'error');
    }
}

async function handlePlaceOrder(event) {
    event.preventDefault();
    const requiredFields = [
        'email',
        'firstName',
        'lastName',
        'address',
        'city',
        'state',
        'zip',
        'phone'
    ];
    let isValid = true;

    requiredFields.forEach(field => {
        const input = document.getElementById(field);
        if (!input?.value.trim()) {
            isValid = false;
            input?.classList.add('error');
        } else {
            input.classList.remove('error');
        }
    });

    if (!isValid) {
        showToast('Please fill in all required fields', 'error');
        return;
    }

    const selectedPayment =
        document.querySelector('input[name="payment"]:checked')?.value || 'manual';
    const subtotal = state.cart.reduce(
        (sum, item) => sum + Number(item.price) * Number(item.quantity),
        0
    );

    const orderData = {
        customerEmail: document.getElementById('email').value.trim(),
        customerName: `${document.getElementById('firstName').value.trim()} ${document.getElementById('lastName').value.trim()}`,
        customerPhone: document.getElementById('phone').value.trim(),
        shippingAddress: {
            address: document.getElementById('address').value.trim(),
            apartment: document.getElementById('apartment')?.value.trim() || '',
            city: document.getElementById('city').value.trim(),
            state: document.getElementById('state').value.trim(),
            zip: document.getElementById('zip').value.trim()
        },
        shippingMethod:
            document.querySelector('input[name="shipping"]:checked')?.value || 'standard',
        shippingCost: state.shipping,
        subtotal,
        discount: state.discount,
        discountCode: state.discountCode,
        total: subtotal + state.shipping - state.discount,
        items: state.cart,
        paymentMethod: selectedPayment
    };

    elements.placeOrderBtn.textContent = 'Processing...';
    elements.placeOrderBtn.disabled = true;

    if (
        (selectedPayment === 'paystack' || selectedPayment === 'card') &&
        window.PaystackCheckout?.isConfigured()
    ) {
        try {
            await window.PaystackCheckout.processOrder(orderData);
            return;
        } catch (error) {
            console.error('[CHECKOUT] Paystack error:', error);
            showToast(error.message || 'Payment initialization failed. Please try again.', 'error');
        } finally {
            elements.placeOrderBtn.textContent = 'Complete Order';
            elements.placeOrderBtn.disabled = false;
        }
        return;
    }

    try {
        const csrfToken = await getCsrfToken();
        const response = await fetch(`${API_URL}/orders`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify(orderData)
        });
        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.error || 'Could not place order');
        }

        localStorage.removeItem('cart');
        window.location.href = `/order-confirmation?order=${encodeURIComponent(result.orderId)}`;
    } catch (error) {
        showToast(error.message || 'Could not place order', 'error');
        elements.placeOrderBtn.disabled = false;
        elements.placeOrderBtn.textContent = 'Complete Order';
    }
}

function showToast(message, type = 'success') {
    if (!elements.toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const span = document.createElement('span');
    span.className = 'toast-message';
    span.textContent = String(message);
    toast.appendChild(span);
    elements.toastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

window.addEventListener('componentsLoaded', initCheckout);
if (
    document.readyState === 'complete' &&
    window.Components &&
    document.getElementById('nav')?.innerHTML
) {
    initCheckout();
}
