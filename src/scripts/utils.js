/**
 * LA VAGUE - Utility Functions
 * Input masking, debouncing, button states, image optimization
 */

const InputMasks = {
    creditCard(input) {
        input.addEventListener('input', e => {
            let value = e.target.value.replace(/\D/g, '').substring(0, 16);
            e.target.value = (value.match(/.{1,4}/g) || []).join(' ');
        });
    },

    expiryDate(input) {
        input.addEventListener('input', e => {
            let value = e.target.value.replace(/\D/g, '').substring(0, 4);
            if (value.length >= 2) value = `${value.substring(0, 2)}/${value.substring(2)}`;
            e.target.value = value;
        });
    },

    phone(input) {
        input.addEventListener('input', e => {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length > 15) value = value.substring(0, 15);
            e.target.value = value;
        });
    },

    phoneNumber(value) {
        if (value?.tagName) return this.phone(value);
        let digits = String(value).replace(/\D/g, '');
        if (digits.length > 15) digits = digits.substring(0, 15);
        return digits;
    },

    cvv(input) {
        input.addEventListener('input', e => {
            e.target.value = e.target.value.replace(/\D/g, '').substring(0, 4);
        });
    }
};

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}

const ButtonState = {
    setLoading(button, text = 'Loading...') {
        button.disabled = true;
        button.dataset.originalText = button.textContent;
        button.textContent = text;
        button.classList.add('loading');
    },

    setSuccess(button, text = 'Success!') {
        button.textContent = text;
        button.classList.remove('loading');
        button.classList.add('success');
        setTimeout(() => this.reset(button), 2000);
    },

    setError(button, text = 'Error') {
        button.textContent = text;
        button.classList.remove('loading');
        button.classList.add('error');
        setTimeout(() => this.reset(button), 2000);
    },

    reset(button) {
        button.disabled = false;
        button.textContent = button.dataset.originalText || 'Submit';
        button.classList.remove('loading', 'success', 'error');
    }
};

const FormValidation = {
    email(value) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    },

    phone(value) {
        return /^[\d\s\-+()]{7,20}$/.test(value);
    },

    creditCard(value) {
        const clean = value.replace(/\s/g, '');
        if (!/^\d{13,19}$/.test(clean)) return false;

        let sum = 0;
        let isEven = false;
        for (let i = clean.length - 1; i >= 0; i -= 1) {
            let digit = Number.parseInt(clean.charAt(i), 10);
            if (isEven) {
                digit *= 2;
                if (digit > 9) digit -= 9;
            }
            sum += digit;
            isEven = !isEven;
        }
        return sum % 10 === 0;
    },

    expiryDate(value) {
        if (!/^\d{2}\/\d{2}$/.test(value)) return false;
        const [month, year] = value.split('/');
        const now = new Date();
        const currentYear = now.getFullYear() % 100;
        const currentMonth = now.getMonth() + 1;
        const expMonth = Number.parseInt(month, 10);
        const expYear = Number.parseInt(year, 10);

        if (expMonth < 1 || expMonth > 12) return false;
        if (expYear < currentYear) return false;
        if (expYear === currentYear && expMonth < currentMonth) return false;
        return true;
    }
};

const SearchHelper = {
    init(inputElement, callback, delay = 300) {
        if (!inputElement) return;
        const debouncedCallback = debounce(callback, delay);
        inputElement.addEventListener('input', e => debouncedCallback(e.target.value));
    }
};

const API_BASE_URL = '/api';

const CSRFProtection = {
    token: null,

    async init() {
        try {
            const response = await fetch(`${API_BASE_URL}/csrf-token`, {
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                this.token = data.csrfToken;
            }
        } catch (error) {
            console.error('[CSRF] Failed to initialize token:', error);
        }
    },

    getToken() {
        return this.token;
    },

    async refreshToken() {
        return this.init();
    },

    async fetch(url, options = {}) {
        if (!this.token) await this.init();

        const fetchOptions = {
            ...options,
            credentials: 'include',
            headers: {
                ...options.headers,
                'X-CSRF-Token': this.token
            }
        };

        const response = await fetch(url, fetchOptions);
        if (response.status !== 403) return response;

        try {
            const data = await response.clone().json();
            if (data.code === 'CSRF_INVALID' || data.code === 'CSRF_MISSING') {
                await this.refreshToken();
                fetchOptions.headers['X-CSRF-Token'] = this.token;
                return fetch(url, fetchOptions);
            }
        } catch {
            // Return the original response if the body is not JSON.
        }

        return response;
    }
};

const GlobalSettings = {
    cacheKey: 'laVagueStoreSettings',
    settings: {
        freeShippingThreshold: 150000,
        shippingRate: 10000,
        expressShippingRate: 25000,
        storeName: 'LA VAGUE'
    },

    hydrateCachedSettings() {
        try {
            const cached = JSON.parse(localStorage.getItem(this.cacheKey) || 'null');
            if (cached && typeof cached === 'object') {
                this.settings = { ...this.settings, ...cached };
            }
        } catch {
            localStorage.removeItem(this.cacheKey);
        }
    },

    async init() {
        // Paint synchronously from the last known settings (or safe defaults),
        // then revalidate against the API without flashing zero/placeholder values.
        this.hydrateCachedSettings();
        this.updateDynamicElements();

        try {
            const response = await fetch(`${API_BASE_URL}/config/settings`);
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.settings) {
                    this.settings = { ...this.settings, ...data.settings };
                    localStorage.setItem(this.cacheKey, JSON.stringify(this.settings));
                }
            }
        } catch (error) {
            console.error('[SETTINGS] Failed to load global settings:', error);
        }

        this.updateDynamicElements();
    },

    updateDynamicElements() {
        const { freeShippingThreshold, shippingRate, expressShippingRate } = this.settings;
        const format = value =>
            window.CurrencyConfig
                ? window.CurrencyConfig.formatPrice(value)
                : `₦${Number(value).toLocaleString()}`;

        document.querySelectorAll('.dynamic-free-shipping').forEach(element => {
            element.textContent =
                element.getAttribute('data-i18n') === 'product.freeShipping'
                    ? `Free standard shipping over ${format(freeShippingThreshold)}`
                    : `FREE SHIPPING ON ORDERS OVER ${format(freeShippingThreshold)}`;
        });

        document.querySelectorAll('.dynamic-shipping-rate').forEach(element => {
            element.textContent = format(shippingRate);
        });

        document.querySelectorAll('.dynamic-express-rate').forEach(element => {
            element.textContent = format(expressShippingRate);
        });
    }
};

window.GlobalSettings = GlobalSettings;

window.initRevealAnimations = function () {
    const revealElements = document.querySelectorAll(
        '.reveal-up:not(.visible), .reveal-scale:not(.visible), .reveal-left:not(.visible), .reveal-right:not(.visible)'
    );
    if (revealElements.length === 0) return;

    const revealObserver = new IntersectionObserver(
        entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    revealObserver.unobserve(entry.target);
                }
            });
        },
        { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );

    revealElements.forEach(element => revealObserver.observe(element));
};

const ChatSupport = {
    init() {
        const isCheckoutPage =
            window.location.pathname.includes('checkout') ||
            window.location.pathname.includes('order-confirmation');
        if (isCheckoutPage || document.getElementById('storeChatSupport')) return;

        if (!document.querySelector('link[data-chat-support-styles]')) {
            const stylesheet = document.createElement('link');
            stylesheet.rel = 'stylesheet';
            stylesheet.href = '/src/styles/chat-support.css';
            stylesheet.dataset.chatSupportStyles = 'true';
            document.head.appendChild(stylesheet);
        }

        const phone = '2348100864527';
        const message = encodeURIComponent(
            "Yo LA VAGUE! I'm checking out the store and had a question..."
        );

        const chatBtn = document.createElement('a');
        chatBtn.id = 'storeChatSupport';
        chatBtn.href = `https://wa.me/${phone}?text=${message}`;
        chatBtn.className = 'chat-support';
        chatBtn.target = '_blank';
        chatBtn.rel = 'noopener noreferrer';
        chatBtn.setAttribute('aria-label', 'Chat with LA VAGUE support');
        chatBtn.innerHTML = `
            <span class="chat-support-prompt" aria-hidden="true">Chat with us now</span>
            <svg class="chat-support-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M7.2 18.4 3.8 20l1.05-3.5A8 8 0 1 1 7.2 18.4Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M8 11.5h.01M12 11.5h.01M16 11.5h.01" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
            </svg>
        `;
        document.body.appendChild(chatBtn);

        window.setTimeout(() => chatBtn.classList.add('prompt-visible'), 900);
        window.setTimeout(() => chatBtn.classList.remove('prompt-visible'), 5200);
    }
};

if (!window.utilsInitialized) {
    window.utilsInitialized = true;
    document.addEventListener('DOMContentLoaded', async () => {
        if (window.Components) {
            try {
                await window.Components.init();
            } catch (error) {
                console.error('[UTILS] Component injection failed:', error);
            }
        }

        CSRFProtection.init();
        ChatSupport.init();
        GlobalSettings.init();
    });
}

window.CSRFProtection = CSRFProtection;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        InputMasks,
        debounce,
        ButtonState,
        FormValidation,
        SearchHelper,
        CSRFProtection
    };
}
