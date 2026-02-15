/**
 * LA VAGUE - Checkout Page JavaScript
 */

console.log('=== CHECKOUT.JS LOADED ===');

// API Configuration
const API_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:3000/api' 
    : 'https://la-vague-api.onrender.com/api';

document.addEventListener('DOMContentLoaded', () => {
    console.log('=== CHECKOUT DOM LOADED ===');
    // ==========================================
    // STATE
    // ==========================================
    const state = {
        cart: JSON.parse(localStorage.getItem('cart')) || [],
        shipping: 10,
        discount: 0,
        discountCode: null,
        settings: {
            shippingRate: 10,
            freeShippingThreshold: 150
        }
    };

    // ==========================================
    // DOM ELEMENTS
    // ==========================================
    const elements = {
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
        cardNumber: document.getElementById('cardNumber'),
        expiry: document.getElementById('expiry'),
        toastContainer: document.getElementById('toastContainer')
    };

    // ==========================================
    // INITIALIZATION
    // ==========================================
    async function loadSettings() {
        try {
            const response = await fetch(`${API_URL}/config/settings`);
            const data = await response.json();
            
            if (data.success && data.settings) {
                state.settings.shippingRate = data.settings.shippingRate || 10;
                state.settings.freeShippingThreshold = data.settings.freeShippingThreshold || 150;
                state.shipping = state.settings.shippingRate;
                
                // Update shipping display
                document.getElementById('standardShipping').textContent = `₦${state.settings.shippingRate.toLocaleString()}.00`;
                
                console.log('[CHECKOUT] Settings loaded:', state.settings);
            }
        } catch (error) {
            console.error('[CHECKOUT] Failed to load settings:', error);
        }
    }

    async function init() {
        console.log('Cart items:', state.cart.length);
        if (state.cart.length === 0) {
            console.log('Cart is empty, redirecting to shop...');
            window.location.href = 'shop.html';
            return;
        }
        
        console.log('Initializing checkout...');
        await loadSettings();
        renderOrderSummary();
        updateTotals();
        bindEvents();
        console.log('Checkout initialized successfully');
        
        // Nav scroll effect
        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) {
                elements.nav?.classList.add('scrolled');
            } else {
                elements.nav?.classList.remove('scrolled');
            }
        }, { passive: true });
    }

    // ==========================================
    // ORDER SUMMARY
    // ==========================================
    function renderOrderSummary() {
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
    }

    function updateTotals() {
        const subtotal = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const total = subtotal + state.shipping - state.discount;
        
        elements.summarySubtotal.textContent = CurrencyConfig.formatPrice(subtotal);
        elements.summaryShipping.textContent = CurrencyConfig.formatPrice(state.shipping);
        elements.summaryTotal.textContent = CurrencyConfig.formatPrice(total);
        
        if (state.discount > 0) {
            elements.summaryDiscount.textContent = `-${CurrencyConfig.formatPrice(state.discount)}`;
            elements.discountLine.style.display = 'flex';
        } else {
            elements.discountLine.style.display = 'none';
        }
        
        // Free shipping threshold
        if (subtotal >= state.settings.freeShippingThreshold) {
            state.shipping = 0;
            elements.summaryShipping.textContent = 'FREE';
            document.getElementById('standardShipping').textContent = 'FREE';
        }
    }

    // ==========================================
    // DISCOUNT CODE
    // ==========================================
    async function applyDiscountCode() {
        const code = elements.discountCode.value.trim().toUpperCase();
        
        if (!code) {
            showToast('Please enter a discount code', 'error');
            return;
        }
        
        // Get cart total for validation
        const subtotal = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const shipping = state.shipping;
        const cartTotal = subtotal + shipping;
        
        try {
            // Get CSRF token first (with credentials for cookie)
            const csrfResponse = await fetch(`${API_URL}/csrf-token`, {
                credentials: 'include'
            });
            const csrfData = await csrfResponse.json();
            
            // Validate coupon with API
            const response = await fetch(`${API_URL}/coupons/validate`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfData.csrfToken
                },
                body: JSON.stringify({
                    code: code,
                    cartTotal: cartTotal,
                    items: state.cart
                })
            });
            
            const data = await response.json();
            
            if (!response.ok || !data.valid) {
                showToast(data.error || 'Invalid discount code', 'error');
                return;
            }
            
            // Apply discount based on type
            if (data.coupon.type === 'free_shipping') {
                state.shipping = 0;
                state.discount = 0;
                showToast('Free shipping applied!', 'success');
            } else if (data.coupon.type === 'percentage') {
                const discountAmount = Math.round((subtotal * data.coupon.discount) / 100);
                state.discount = discountAmount;
                showToast(`${data.coupon.discount}% discount applied!`, 'success');
            } else if (data.coupon.type === 'fixed') {
                state.discount = data.coupon.discount;
                showToast(`₦${data.coupon.discount.toLocaleString()} discount applied!`, 'success');
            }
            
            state.discountCode = code;
            updateTotals();
            elements.discountCode.value = '';
            
        } catch (error) {
            console.error('Coupon validation error:', error);
            showToast('Failed to validate coupon. Please try again.', 'error');
        }
    }

    // ==========================================
    // FORM HANDLING
    // ==========================================
    function formatCardNumber(value) {
        return value.replace(/\s/g, '').replace(/(\d{4})/g, '$1 ').trim();
    }

    function formatExpiry(value) {
        return value.replace(/\D/g, '').replace(/(\d{2})(\d{0,2})/, '$1 / $2').trim();
    }

    async function handlePlaceOrder(e) {
        e.preventDefault();
        console.log('=== PLACE ORDER CLICKED ===');
        
        // Basic validation
        const requiredFields = ['email', 'firstName', 'lastName', 'address', 'city', 'state', 'zip', 'phone'];
        let isValid = true;
        const missingFields = [];
        
        requiredFields.forEach(field => {
            const input = document.getElementById(field);
            console.log(`Field ${field}:`, input ? (input.value ? 'has value' : 'EMPTY') : 'NOT FOUND');
            if (!input || !input.value.trim()) {
                isValid = false;
                missingFields.push(field);
                input?.classList.add('error');
            } else {
                input?.classList.remove('error');
            }
        });
        
        if (!isValid) {
            console.log('Validation failed, missing:', missingFields);
            showToast('Please fill in all required fields', 'error');
            return;
        }
        console.log('Validation passed');
        
        // Get form data - Match server.js expected format
        const firstName = document.getElementById('firstName').value;
        const lastName = document.getElementById('lastName').value;
        const selectedPayment = document.querySelector('input[name="payment"]:checked')?.value || 'manual';
        const orderData = {
            customerEmail: document.getElementById('email').value,
            customerName: `${firstName} ${lastName}`,
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
            total: state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0) + state.shipping - state.discount,
            items: state.cart,
            paymentMethod: selectedPayment,
            notes: ''
        };
        
        // Show loading
        elements.placeOrderBtn.textContent = 'Processing...';
        elements.placeOrderBtn.disabled = true;
        
        // Check if Paystack payment selected and available
        if (selectedPayment === 'paystack' && window.PaystackCheckout?.isConfigured()) {
            console.log('[CHECKOUT] Using Paystack payment flow');
            try {
                await window.PaystackCheckout.processOrder(orderData);
                // Paystack handles the rest - modal/popup flow
                // Button will be re-enabled if user cancels
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
        
        // Manual/COD payment flow
        console.log('[CHECKOUT] Using manual payment flow');
        
        try {
            // Try to send to backend API
            console.log('Sending order to API:', API_URL);
            console.log('Order data:', JSON.stringify(orderData, null, 2));
            
            // Get CSRF token for manual payment too
            const csrfResponse = await fetch(`${API_URL}/csrf-token`, {
                credentials: 'include'
            });
            const csrfData = await csrfResponse.json();
            
            const response = await fetch(`${API_URL}/orders`, {
                method: 'POST',
                credentials: 'include',
                headers: { 
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfData.csrfToken
                },
                body: JSON.stringify(orderData)
            });
            
            console.log('API Response status:', response.status);
            
            const result = await response.json();
            console.log('API Result:', result);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${result.error || 'Unknown error'}`);
            }
            
            if (result.success) {
                // Save to localStorage for admin fallback (use format admin.js expects)
                const orders = JSON.parse(localStorage.getItem('orders') || '[]');
                orders.unshift({
                    id: result.orderId,
                    firstName: firstName,
                    lastName: lastName,
                    email: orderData.customerEmail,
                    phone: orderData.customerPhone,
                    address: orderData.shippingAddress.address,
                    apartment: orderData.shippingAddress.apartment,
                    city: orderData.shippingAddress.city,
                    state: orderData.shippingAddress.state,
                    zip: orderData.shippingAddress.zip,
                    shippingCost: orderData.shippingCost,
                    subtotal: orderData.subtotal,
                    discount: orderData.discount,
                    total: orderData.total,
                    items: orderData.items,
                    status: 'pending',
                    date: new Date().toISOString(),
                    created_at: new Date().toISOString()
                });
                localStorage.setItem('orders', JSON.stringify(orders));
                console.log('Order saved to localStorage:', result.orderId);
                
                // Clear cart
                localStorage.removeItem('cart');
                
                showToast('Order placed successfully!', 'success');
                
                setTimeout(() => {
                    window.location.href = `order-confirmation.html?order=${result.orderId}`;
                }, 1500);
            } else {
                throw new Error(result.error || 'Order failed');
            }
        } catch (error) {
            console.error('Order API error:', error);
            console.error('Error stack:', error.stack);
            
            // Show detailed error to user
            const errorDetails = `API Error: ${error.message}\n\nPlease check the browser console (F12) for more details.\n\nThe order will be saved locally but will NOT appear in the admin panel until the API connection is fixed.`;
            alert(errorDetails);
            
            // Fallback: Save order locally (use format admin.js expects)
            const orders = JSON.parse(localStorage.getItem('orders') || '[]');
            const fallbackOrder = {
                id: 'LV-' + Date.now().toString(36).toUpperCase(),
                firstName: firstName,
                lastName: lastName,
                email: orderData.customerEmail,
                phone: orderData.customerPhone,
                address: orderData.shippingAddress.address,
                apartment: orderData.shippingAddress.apartment,
                city: orderData.shippingAddress.city,
                state: orderData.shippingAddress.state,
                zip: orderData.shippingAddress.zip,
                shippingCost: orderData.shippingCost,
                subtotal: orderData.subtotal,
                discount: orderData.discount,
                total: orderData.total,
                items: orderData.items,
                status: 'pending',
                date: new Date().toISOString(),
                created_at: new Date().toISOString()
            };
            orders.unshift(fallbackOrder);
            localStorage.setItem('orders', JSON.stringify(orders));
            console.log('Order saved to localStorage (fallback):', fallbackOrder.id);
            
            // Clear cart
            localStorage.removeItem('cart');
            
            showToast('Order saved locally (API failed)', 'success');
            
            setTimeout(() => {
                window.location.href = `order-confirmation.html?order=${fallbackOrder.id}`;
            }, 1500);
        }
    }

    // ==========================================
    // TOAST
    // ==========================================
    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<span class="toast-message">${message}</span>`;
        
        elements.toastContainer.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'toast-in 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // ==========================================
    // EVENTS
    // ==========================================
    function bindEvents() {
        // Shipping option change
        elements.shippingOptions.forEach(option => {
            option.addEventListener('change', (e) => {
                const subtotal = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            if (e.target.value === 'express') {
                state.shipping = 2500; // Fixed express shipping
            } else if (subtotal >= state.settings.freeShippingThreshold) {
                state.shipping = 0;
            } else {
                state.shipping = state.settings.shippingRate;
            }
                updateTotals();
            });
        });
        
        // Discount code
        elements.applyDiscount?.addEventListener('click', applyDiscountCode);
        elements.discountCode?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') applyDiscountCode();
        });
        
        // Card formatting
        elements.cardNumber?.addEventListener('input', (e) => {
            e.target.value = formatCardNumber(e.target.value);
        });
        
        elements.expiry?.addEventListener('input', (e) => {
            e.target.value = formatExpiry(e.target.value);
        });
        
        // Place order
        console.log('Place Order Button:', elements.placeOrderBtn ? 'FOUND' : 'NOT FOUND');
        if (elements.placeOrderBtn) {
            elements.placeOrderBtn.addEventListener('click', handlePlaceOrder);
            console.log('Event listener attached to place order button');
        } else {
            console.error('ERROR: Place Order button not found!');
        }
    }

    // Initialize combined locale selector
    function initLocaleSelector() {
        const localeBtn = document.getElementById('localeBtn');
        const localeDropdown = document.getElementById('localeDropdown');
        
        if (!localeBtn || !localeDropdown) return;
        
        const currentCurrency = CurrencyConfig.getCurrentCurrency();
        const currentLang = localStorage.getItem('preferredLanguage') || 'en';
        
        // Update display
        updateLocaleDisplay(currentCurrency, currentLang);
        
        // Currency options
        document.querySelectorAll('#currencyOptions .locale-option').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.currency === currentCurrency);
            btn.addEventListener('click', () => {
                CurrencyConfig.setCurrency(btn.dataset.currency);
                updateLocaleDisplay(btn.dataset.currency, currentLang);
                // Update displayed prices
                renderOrderSummary();
                updateTotals();
            });
        });
        
        // Language options
        document.querySelectorAll('#languageOptions .locale-option').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.lang === currentLang);
            btn.addEventListener('click', () => {
                localStorage.setItem('preferredLanguage', btn.dataset.lang);
                document.documentElement.lang = btn.dataset.lang;
                document.documentElement.dir = btn.dataset.lang === 'ar' ? 'rtl' : 'ltr';
                updateLocaleDisplay(currentCurrency, btn.dataset.lang);
                if (typeof applyTranslations === 'function') {
                    applyTranslations();
                }
            });
        });
        
        // Toggle dropdown
        localeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            localeDropdown.classList.toggle('active');
        });
        
        // Close on outside click
        document.addEventListener('click', () => {
            localeDropdown.classList.remove('active');
        });
        
        localeDropdown.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }
    
    function updateLocaleDisplay(currency, lang) {
        const localeCurrent = document.getElementById('localeCurrent');
        if (localeCurrent) {
            const symbols = { USD: '$', NGN: '₦', EUR: '€', GBP: '£' };
            localeCurrent.textContent = `${symbols[currency]} · ${lang.toUpperCase()}`;
        }
    }
    
    // Initialize locale selector
    initLocaleSelector();
    
    // Legacy selector support (fallback)
    const currencySelect = document.getElementById('currencySelect');
    if (currencySelect) {
        currencySelect.value = CurrencyConfig.getCurrentCurrency();
        currencySelect.addEventListener('change', (e) => {
            CurrencyConfig.setCurrency(e.target.value);
            // Update displayed prices without page reload
            renderOrderSummary();
            updateTotals();
        });
    }
    
    // Listen for currency changes from other sources
    window.addEventListener('currencyChanged', () => {
        // Update locale display
        const currentCurrency = CurrencyConfig.getCurrentCurrency();
        const currentLang = localStorage.getItem('preferredLanguage') || 'en';
        updateLocaleDisplay(currentCurrency, currentLang);
        
        // Update legacy selector if present
        if (currencySelect) {
            currencySelect.value = currentCurrency;
        }
        
        // Re-render prices
        renderOrderSummary();
        updateTotals();
    });
    
    // Initialize language selector (legacy fallback)
    const languageSelect = document.getElementById('languageSelect');
    if (languageSelect) {
        const savedLang = localStorage.getItem('preferredLanguage') || 'en';
        languageSelect.value = savedLang;
        document.documentElement.lang = savedLang;
        document.documentElement.dir = savedLang === 'ar' ? 'rtl' : 'ltr';
        
        // Apply translations on load
        if (typeof applyTranslations === 'function') {
            applyTranslations();
        }
        
        languageSelect.addEventListener('change', (e) => {
            localStorage.setItem('preferredLanguage', e.target.value);
            document.documentElement.lang = e.target.value;
            document.documentElement.dir = e.target.value === 'ar' ? 'rtl' : 'ltr';
            if (typeof applyTranslations === 'function') {
                applyTranslations();
            }
        });
    }

    // Start
    init();
});
