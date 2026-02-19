/**
 * LA VAGUE - Shared Page JavaScript (FAQ, Shipping, Contact, etc.)
 */

let elements = {};
const state = {
    cart: JSON.parse(localStorage.getItem('cart')) || []
};

function initPage() {
    // ==========================================
    // DOM ELEMENTS (RE-QUERY AFTER INJECTION)
    // ==========================================
    elements = {
        nav: document.getElementById('nav'),
        mobileMenuBtn: document.getElementById('mobileMenuBtn'),
        navLinks: document.getElementById('navLinks'),
        cartCount: document.getElementById('cartCount'),
        cartOverlay: document.getElementById('cartOverlay'),
        cartSidebar: document.getElementById('cartSidebar'),
        cartClose: document.getElementById('cartClose'),
        cartItems: document.getElementById('cartItems'),
        cartSubtotal: document.getElementById('cartSubtotal'),
        cartBtn: document.getElementById('cartBtn'),
        wishlistCount: document.getElementById('wishlistCount'),
        wishlistBtn: document.getElementById('wishlistBtn'),
        wishlistSidebar: document.getElementById('wishlistSidebar'),
        wishlistClose: document.getElementById('wishlistClose'),
        wishlistOverlay: document.getElementById('wishlistOverlay'),
        searchOverlay: document.getElementById('searchOverlay'),
        searchBtn: document.getElementById('searchBtn'),
        searchClose: document.getElementById('searchClose'),
        searchInput: document.getElementById('searchInput'),
        searchResults: document.getElementById('searchResults'),
        faqItems: document.querySelectorAll('.faq-item'),
        toastContainer: document.getElementById('toastContainer')
    };

    // Initialize combined locale selector
    initLocaleSelector();
    
    // Initialize legacy selectors (mobile menu)
    initLegacySelectors();
    
    updateCartCount();
    updateWishlistCount();
    bindEvents();
    initFAQ();
    
    // Nav scroll effect
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            elements.nav?.classList.add('scrolled');
        } else {
            elements.nav?.classList.remove('scrolled');
        }
    }, { passive: true });
}

function updateCartCount() {
    if (typeof CartState !== 'undefined') {
        CartState.updateCartCount();
    }
}

function updateWishlistCount() {
    if (typeof CartState !== 'undefined') {
        CartState.updateWishlistCount();
    }
}

// ==========================================
// FAQ
// ==========================================
function initFAQ() {
    elements.faqItems?.forEach(item => {
        const question = item.querySelector('.faq-question');
        question?.addEventListener('click', () => {
            const isActive = item.classList.contains('active');
            elements.faqItems.forEach(i => i.classList.remove('active'));
            if (!isActive) item.classList.add('active');
        });
    });
}

// ==========================================
// SEARCH
// ==========================================
function openSearch() {
    elements.searchOverlay?.classList.add('active');
    elements.searchInput?.focus();
    document.body.style.overflow = 'hidden';
}

function closeSearch() {
    elements.searchOverlay?.classList.remove('active');
    if (elements.searchInput) elements.searchInput.value = '';
    if (elements.searchResults) elements.searchResults.innerHTML = '';
    document.body.style.overflow = '';
}

function handleSearch(query) {
    if (!query.trim() || !elements.searchResults) {
        if (elements.searchResults) elements.searchResults.innerHTML = '';
        return;
    }
    const results = ProductAPI.search(query);
    if (results.length === 0) {
        elements.searchResults.innerHTML = `<div style="text-align: center; padding: 3rem; color: var(--color-text-muted);">No products found for "${query}"</div>`;
        return;
    }
    elements.searchResults.innerHTML = results.map(product => `
        <div class="search-result-item" onclick="window.location.href='product.html?slug=${product.slug}'">
            <img src="${product.images[0].src}" alt="${product.name}">
            <div class="search-result-info"><h4>${product.name}</h4><p>${product.category}</p></div>
            <span class="search-result-price">${CurrencyConfig.formatPrice(product.price)}</span>
        </div>
    `).join('');
}

function showToast(message, type = 'success') {
    if (!elements.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span class="toast-message">${message}</span>`;
    elements.toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'toast-in 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function initContactForm() {
    const contactForm = document.getElementById('contactForm');
    if (!contactForm) return;
    if (document.getElementById('phone') && typeof InputMasks !== 'undefined') InputMasks.phone(document.getElementById('phone'));
    
    contactForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = contactForm.querySelector('button[type="submit"]');
        const email = document.getElementById('email')?.value;
        if (email && typeof FormValidation !== 'undefined' && !FormValidation.isValidEmail(email)) {
            showToast('Please enter a valid email address', 'error');
            return;
        }
        if (typeof ButtonState !== 'undefined') ButtonState.setLoading(submitBtn, 'Sending...', true);
        
        const formData = {
            name: `${document.getElementById('firstName')?.value || ''} ${document.getElementById('lastName')?.value || ''}`.trim(),
            email: email,
            subject: document.getElementById('subject')?.value,
            message: document.getElementById('message')?.value
        };
        const orderNumber = document.getElementById('orderNumber')?.value;
        if (orderNumber) formData.message = `Order Number: ${orderNumber}\n\n${formData.message}`;
        
        try {
            const API_URL = window.location.hostname === 'localhost' ? 'http://localhost:3000/api' : 'https://la-vague-api.onrender.com/api';
            const response = await fetch(`${API_URL}/contact`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            const result = await response.json();
            if (result.success) {
                if (typeof ButtonState !== 'undefined') ButtonState.setSuccess(submitBtn, 'Message Sent!', 2000);
                contactForm.reset();
                showToast('Message sent successfully!', 'success');
            } else { throw new Error(result.error || 'Failed to send message'); }
        } catch (error) {
            if (typeof ButtonState !== 'undefined') ButtonState.setError(submitBtn, 'Try Again', 3000);
            showToast('Failed to send message. Please try again.', 'error');
        }
    });
}

function bindEvents() {
    elements.mobileMenuBtn?.addEventListener('click', () => {
        elements.mobileMenuBtn.classList.toggle('active');
        elements.navLinks?.classList.toggle('active');
    });
    elements.cartBtn?.addEventListener('click', window.openCart);
    elements.cartClose?.addEventListener('click', window.closeCart);
    elements.cartOverlay?.addEventListener('click', window.closeCart);
    elements.wishlistBtn?.addEventListener('click', window.openWishlist);
    elements.wishlistClose?.addEventListener('click', window.closeWishlist);
    elements.wishlistOverlay?.addEventListener('click', window.closeWishlist);
    elements.searchBtn?.addEventListener('click', openSearch);
    elements.searchClose?.addEventListener('click', closeSearch);
    
    if (typeof SearchHelper !== 'undefined') SearchHelper.init(elements.searchInput, handleSearch, { delay: 300 });
    initContactForm();
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeSearch(); window.closeCart(); window.closeWishlist();
            if (elements.navLinks?.classList.contains('active')) elements.mobileMenuBtn?.click();
        }
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); openSearch(); }
    });
}

function initLocaleSelector() {
    const btn = document.getElementById('localeBtn'), drop = document.getElementById('localeDropdown');
    if (!btn || !drop) return;
    const curr = CurrencyConfig.getCurrentCurrency(), lang = localStorage.getItem('preferredLanguage') || 'en';
    updateLocaleDisplay(curr, lang);
    btn.addEventListener('click', (e) => { e.stopPropagation(); drop.classList.toggle('active'); });
    document.addEventListener('click', () => drop.classList.remove('active'));
}

function updateLocaleDisplay(currency, lang) {
    const el = document.getElementById('localeCurrent');
    if (el) {
        const symbols = { USD: '$', NGN: '₦', EUR: '€', GBP: '£' };
        el.textContent = `${symbols[currency]} · ${lang.toUpperCase()}`;
    }
}

function initLegacySelectors() {
    const savedLang = localStorage.getItem('preferredLanguage') || 'en';
    document.documentElement.lang = savedLang;
    document.documentElement.dir = savedLang === 'ar' ? 'rtl' : 'ltr';
    if (typeof applyTranslations === 'function') applyTranslations();
}

window.addEventListener('componentsLoaded', initPage);
if (document.readyState === 'complete' && window.Components && document.getElementById('nav')?.innerHTML) initPage();
