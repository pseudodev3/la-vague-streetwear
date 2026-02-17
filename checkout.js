/**
 * LA VAGUE - Checkout Page JavaScript
 */

// API Configuration
const API_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:3000/api' 
    : 'https://la-vague-api.onrender.com/api';

const state = {
    cart: JSON.parse(localStorage.getItem('cart')) || [],
    shipping: 10000,
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

async function initCheckout() {
    // ==========================================
    // DOM ELEMENTS (RE-QUERY AFTER INJECTION)
    // ==========================================
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

    // Nav scroll effect
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            elements.nav?.classList.add('scrolled');
        } else {
            elements.nav?.classList.remove('scrolled');
        }
    }, { passive: true });
}

function render() {
    if (!elements.summaryItems) return;
    
    elements.summaryItems.innerHTML = state.cart.map(item => `
        <div class="summary-item">
            <div class="summary-item-image">
                <img src="${item.image}" alt="${item.name}">
                <span class="summary-item-qty">${item.quantity}</span>
            </div>
            <div class="summary-item-details">
                <p class="summary-item-name">${item.name}</p>
                <p class="summary-item-variant">${item.color} / ${item.size}</p>
            </div>
            <span class="summary-item-price">${CurrencyConfig.formatPrice(item.price * item.quantity)}</span>
        </div>
    `).join('');

    const subtotal = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const total = subtotal + state.shipping - state.discount;
    
    elements.summarySubtotal.textContent = CurrencyConfig.formatPrice(subtotal);
    elements.summaryShipping.textContent = state.shipping === 0 ? 'FREE' : CurrencyConfig.formatPrice(state.shipping);
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
        elements.standardShippingPrice.textContent = CurrencyConfig.formatPrice(state.settings.shippingRate);
    }
    
    if (state.isFreeShippingCoupon) {
        elements.expressShippingPrice.textContent = 'FREE';
    } else {
        elements.expressShippingPrice.textContent = CurrencyConfig.formatPrice(state.settings.expressShippingRate);
    }
}

function updateShippingState() {
    const subtotal = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const selectedShipping = document.querySelector('input[name="shipping"]:checked')?.value || 'standard';

    if (state.isFreeShippingCoupon) {
        state.shipping = 0;
        return;
    }

    if (selectedShipping === 'express') {
        state.shipping = state.settings.expressShippingRate;
    } else {
        if (subtotal >= state.settings.freeShippingThreshold) {
            state.shipping = 0;
        } else {
            state.shipping = state.settings.shippingRate;
        }
    }
}

async function loadSettings() {
    try {
        const response = await fetch(`${API_URL}/config/settings`);
        const data = await response.json();
        if (data.success && data.settings) {
            state.settings.shippingRate = data.settings.shippingRate || 10000;
            state.settings.expressShippingRate = data.settings.expressShippingRate || 25000;
            state.settings.freeShippingThreshold = data.settings.freeShippingThreshold || 150000;
        }
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
    elements.discountCode?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') applyDiscountCode();
    });
    
    elements.placeOrderBtn?.addEventListener('click', handlePlaceOrder);
}

async function applyDiscountCode() {
    const code = elements.discountCode.value.trim().toUpperCase();
    if (!code) { showToast('Please enter a discount code', 'error'); return; }
    
    const subtotal = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const cartTotal = subtotal + state.shipping;
    
    try {
        const csrfResponse = await fetch(`${API_URL}/csrf-token`, { credentials: 'include' });
        const csrfData = await csrfResponse.json();
        
        const response = await fetch(`${API_URL}/coupons/validate`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfData.csrfToken },
            body: JSON.stringify({ code: code, cartTotal: cartTotal, items: state.cart })
        });
        
        const data = await response.json();
        if (!response.ok || !data.valid) { showToast(data.error || 'Invalid code', 'error'); return; }
        
        if (data.coupon.type === 'free_shipping') {
            state.isFreeShippingCoupon = true;
            state.shipping = 0;
            state.discount = 0;
        } else if (data.coupon.type === 'percentage') {
            state.isFreeShippingCoupon = false;
            state.discount = Math.round((subtotal * data.coupon.discount) / 100);
        } else if (data.coupon.type === 'fixed') {
            state.isFreeShippingCoupon = false;
            state.discount = data.coupon.discount;
        }
        
        state.discountCode = code;
        updateShippingState();
        render();
        elements.discountCode.value = '';
    } catch (error) {
        showToast('Failed to validate coupon', 'error');
    }
}

async function handlePlaceOrder(e) {
    e.preventDefault();
    const requiredFields = ['email', 'firstName', 'lastName', 'address', 'city', 'state', 'zip', 'phone'];
    let isValid = true;
    
    requiredFields.forEach(field => {
        const input = document.getElementById(field);
        if (!input || !input.value.trim()) {
            isValid = false;
            input?.classList.add('error');
        } else {
            input?.classList.remove('error');
        }
    });
    
    if (!isValid) { showToast('Please fill in all required fields', 'error'); return; }
    
    const selectedPayment = document.querySelector('input[name="payment"]:checked')?.value || 'manual';
    const orderData = {
        customerEmail: document.getElementById('email').value,
        customerName: `${document.getElementById('firstName').value} ${document.getElementById('lastName').value}`,
        customerPhone: document.getElementById('phone').value,
        shippingAddress: {
            address: document.getElementById('address').value,
            apartment: document.getElementById('apartment')?.value || '',
            city: document.getElementById('city').value,
            state: document.getElementById('state').value,
            zip: document.getElementById('zip').value
        },
        shippingMethod: document.querySelector('input[name="shipping"]:checked')?.value || 'standard',
        shippingCost: state.shipping,
        subtotal: state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0),
        discount: state.discount,
        discountCode: state.discountCode,
        total: state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0) + state.shipping - state.discount,
        items: state.cart,
        paymentMethod: selectedPayment
    };

    elements.placeOrderBtn.textContent = 'Processing...';
    elements.placeOrderBtn.disabled = true;

    // Use Paystack if selected and configured
    if ((selectedPayment === 'paystack' || selectedPayment === 'card') && window.PaystackCheckout?.isConfigured()) {
        try {
            await window.PaystackCheckout.processOrder(orderData);
            elements.placeOrderBtn.textContent = 'Complete Order';
            elements.placeOrderBtn.disabled = false;
            return;
        } catch (error) {
            console.error('[CHECKOUT] Paystack error:', error);
            showToast('Payment initialization failed. Please try again.', 'error');
            elements.placeOrderBtn.textContent = 'Complete Order';
            elements.placeOrderBtn.disabled = false;
            return;
        }
    }
    
    try {
        const csrfResponse = await fetch(`${API_URL}/csrf-token`, { credentials: 'include' });
        const csrfData = await csrfResponse.json();
        const response = await fetch(`${API_URL}/orders`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfData.csrfToken },
            body: JSON.stringify(orderData)
        });
        const result = await response.json();
        if (result.success) {
            localStorage.removeItem('cart');
            window.location.href = `/order-confirmation?order=${result.orderId}`;
        }
    } catch (error) {
        showToast('API Error: ' + error.message, 'error');
        elements.placeOrderBtn.disabled = false;
        elements.placeOrderBtn.textContent = 'Complete Order';
    }
}

function showToast(message, type = 'success') {
    if (!elements.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span class="toast-message">${message}</span>`;
    elements.toastContainer.appendChild(toast);
    setTimeout(() => { toast.remove(); }, 3000);
}

window.addEventListener('componentsLoaded', initCheckout);
if (document.readyState === 'complete' && window.Components && document.getElementById('nav')?.innerHTML) initCheckout();
