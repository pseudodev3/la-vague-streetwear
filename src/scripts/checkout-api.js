/**
 * LA VAGUE - Checkout API Integration
 * Connects frontend to backend for real payments and orders
 */

const API_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:3000/api' 
    : '/api';

// API Client
const api = {
    async request(endpoint, options = {}) {
        const url = `${API_URL}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        if (config.body && typeof config.body === 'object') {
            config.body = JSON.stringify(config.body);
        }

        try {
            const response = await fetch(url, config);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Request failed');
            }
            
            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    },

    // Products
    getProducts: (params) => api.request(`/products?${new URLSearchParams(params)}`),
    getProduct: (slug) => api.request(`/products/${slug}`),
    checkInventory: (productId, color, size) => 
        api.request('/inventory/check', { method: 'POST', body: { productId, color, size } }),

    // Payments
    initializePayment: (email, amount, metadata) => 
        api.request('/payment/initialize', { method: 'POST', body: { email, amount, metadata } }),
    verifyPayment: (reference) => api.request(`/payment/verify/${reference}`),

    // Orders
    createOrder: (orderData) => api.request('/orders', { method: 'POST', body: orderData }),
    getOrder: (orderId) => api.request(`/orders/${orderId}`)
};

// Loading State Manager
const loadingManager = {
    show(button, text = 'Processing...') {
        button.dataset.originalText = button.textContent;
        button.textContent = text;
        button.disabled = true;
        button.classList.add('loading');
    },
    
    hide(button) {
        button.textContent = button.dataset.originalText;
        button.disabled = false;
        button.classList.remove('loading');
    },
    
    showOverlay(message = 'Loading...') {
        let overlay = document.getElementById('loadingOverlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'loadingOverlay';
            overlay.innerHTML = `
                <div class="loading-content">
                    <div class="loading-spinner"></div>
                    <p>${message}</p>
                </div>
            `;
            document.body.appendChild(overlay);
        }
        overlay.classList.add('active');
    },
    
    hideOverlay() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) overlay.classList.remove('active');
    }
};

// Toast Notification System
const toast = {
    container: null,
    
    init() {
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.className = 'toast-container';
            document.body.appendChild(this.container);
        }
    },
    
    show(message, type = 'success', duration = 4000) {
        this.init();
        
        const toastEl = document.createElement('div');
        toastEl.className = `toast ${type}`;
        toastEl.innerHTML = `
            <span class="toast-message">${message}</span>
            <button class="toast-close" onclick="this.parentElement.remove()">×</button>
        `;
        
        this.container.appendChild(toastEl);
        
        setTimeout(() => {
            toastEl.classList.add('fade-out');
            setTimeout(() => toastEl.remove(), 300);
        }, duration);
    },
    
    success(message) { this.show(message, 'success'); },
    error(message) { this.show(message, 'error'); },
    info(message) { this.show(message, 'info'); }
};

// Form Validation
const validator = {
    rules: {
        email: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
        phone: (value) => /^[\+]?[\d\s\-\(\)]{10,}$/.test(value),
        zip: (value) => /^\d{5,6}$/.test(value),
        card: (value) => value.replace(/\s/g, '').length >= 13,
        expiry: (value) => /^(0[1-9]|1[0-2])\s\/\s\d{2}$/.test(value),
        cvv: (value) => /^\d{3,4}$/.test(value),
        required: (value) => value.trim().length > 0
    },
    
    validate(field, value, rule) {
        if (Array.isArray(rule)) {
            return rule.every(r => this.rules[r](value));
        }
        return this.rules[rule](value);
    },
    
    showError(input, message) {
        input.classList.add('error');
        let errorEl = input.parentElement.querySelector('.error-message');
        if (!errorEl) {
            errorEl = document.createElement('span');
            errorEl.className = 'error-message';
            input.parentElement.appendChild(errorEl);
        }
        errorEl.textContent = message;
    },
    
    clearError(input) {
        input.classList.remove('error');
        const errorEl = input.parentElement.querySelector('.error-message');
        if (errorEl) errorEl.remove();
    },
    
    clearAllErrors(form) {
        form.querySelectorAll('.error').forEach(input => this.clearError(input));
    }
};

// Export for use in checkout.js
window.LaVagueAPI = api;
window.LoadingManager = loadingManager;
window.Toast = toast;
window.Validator = validator;
