/**
 * LA VAGUE - Homepage JavaScript
 */

// State - kept global for cross-function access
const state = {
    cart: JSON.parse(localStorage.getItem('cart')) || [],
    wishlist: JSON.parse(localStorage.getItem('wishlist')) || [],
    currentLook: 0,
    lookbookImages: [
        { src: '/assets/urbannights.png', title: 'Urban Nights', number: '01' },
        { src: '/assets/daylight.jpg', title: 'Daylight', number: '02' },
        { src: '/assets/skatepark.jpg', title: 'Skate Park', number: '03' },
        { src: '/assets/downtown.jpg', title: 'Downtown', number: '04' },
        { src: '/assets/afterhours.jpg', title: 'After Hours', number: '05' }
    ]
};

let elements = {};

async function initHome() {
    // ==========================================
    // DOM ELEMENTS (RE-QUERY AFTER INJECTION)
    // ==========================================
    elements = {
        nav: document.getElementById('nav'),
        mobileMenuBtn: document.getElementById('mobileMenuBtn'),
        navLinks: document.getElementById('navLinks'),
        featuredProducts: document.getElementById('featuredProducts'),
        cartBtn: document.getElementById('cartBtn'),
        cartOverlay: document.getElementById('cartOverlay'),
        cartSidebar: document.getElementById('cartSidebar'),
        cartClose: document.getElementById('cartClose'),
        cartItems: document.getElementById('cartItems'),
        cartSubtotal: document.getElementById('cartSubtotal'),
        cartCount: document.getElementById('cartCount'),
        wishlistCount: document.getElementById('wishlistCount'),
        wishlistBtn: document.getElementById('wishlistBtn'),
        wishlistOverlay: document.getElementById('wishlistOverlay'),
        wishlistSidebar: document.getElementById('wishlistSidebar'),
        wishlistClose: document.getElementById('wishlistClose'),
        wishlistItems: document.getElementById('wishlistItems'),
        searchOverlay: document.getElementById('searchOverlay'),
        searchBtn: document.getElementById('searchBtn'),
        searchClose: document.getElementById('searchClose'),
        searchInput: document.getElementById('searchInput'),
        searchResults: document.getElementById('searchResults'),
        newsletterForm: document.getElementById('newsletterForm'),
        newsletterEmail: document.getElementById('newsletterEmail'),
        lightbox: document.getElementById('lightbox'),
        lightboxOverlay: document.getElementById('lightboxOverlay'),
        lightboxClose: document.getElementById('lightboxClose'),
        lightboxPrev: document.getElementById('lightboxPrev'),
        lightboxNext: document.getElementById('lightboxNext'),
        lightboxImage: document.getElementById('lightboxImage'),
        lightboxNumber: document.getElementById('lightboxNumber'),
        lightboxTitle: document.getElementById('lightboxTitle'),
        lookbookItems: document.querySelectorAll('.lookbook-item'),
        toastContainer: document.getElementById('toastContainer')
    };

    await renderFeaturedProducts();
    
    // Sync with shared CartState if available
    if (typeof CartState !== 'undefined') {
        state.cart = CartState.cart;
        state.wishlist = CartState.wishlist;
    }
    
    updateCartCount();
    updateWishlistCount();
    bindEvents();
    initRevealAnimations();
    
    // Initialize combined locale selector
    initLocaleSelector();
    
    // Initialize legacy selectors (mobile menu)
    initLegacySelectors();
}

// ==========================================
// FEATURED PRODUCTS
// ==========================================

const API_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:3000/api' 
    : 'https://la-vague-api.onrender.com/api';

const HomeAPI = {
    async getProducts() {
        try {
            const response = await fetch(`${API_URL}/products`);
            if (!response.ok) throw new Error('Failed to fetch products');
            const data = await response.json();
            return data.products || [];
        } catch (error) {
            console.warn('API unavailable, using static data');
            return null;
        }
    }
};

function transformProduct(dbProduct) {
    return {
        id: dbProduct.id,
        name: dbProduct.name,
        slug: dbProduct.slug,
        category: dbProduct.category,
        price: dbProduct.price,
        compareAtPrice: dbProduct.compare_at_price || dbProduct.compareAtPrice,
        description: dbProduct.description,
        features: Array.isArray(dbProduct.features) ? dbProduct.features : JSON.parse(dbProduct.features || '[]'),
        images: Array.isArray(dbProduct.images) ? dbProduct.images : JSON.parse(dbProduct.images || '[]'),
        colors: Array.isArray(dbProduct.colors) ? dbProduct.colors : JSON.parse(dbProduct.colors || '[]'),
        sizes: Array.isArray(dbProduct.sizes) ? dbProduct.sizes : JSON.parse(dbProduct.sizes || '[]'),
        inventory: typeof dbProduct.inventory === 'object' ? dbProduct.inventory : JSON.parse(dbProduct.inventory || '{}'),
        tags: Array.isArray(dbProduct.tags) ? dbProduct.tags : JSON.parse(dbProduct.tags || '[]'),
        badge: dbProduct.badge,
        average_rating: dbProduct.average_rating || 0,
        review_count: dbProduct.review_count || 0
    };
}

function renderStarRating(rating) {
    let html = '';
    for (let i = 1; i <= 5; i++) {
        if (i <= Math.round(rating)) {
            html += '★';
        } else {
            html += '<span class="empty">★</span>';
        }
    }
    return html;
}

async function renderFeaturedProducts() {
    if (!elements.featuredProducts) return;
    
    let featured = [];
    
    // Try to get from API first
    const apiProducts = await HomeAPI.getProducts();
    if (apiProducts && apiProducts.length > 0) {
        const products = apiProducts.map(transformProduct);
        featured = products.filter(p => p.tags.includes('bestseller')).slice(0, 4);
    }
    
    // Fallback to static data if API fails or no bestsellers found
    if (featured.length === 0) {
        featured = ProductAPI.getFeatured().slice(0, 4);
    }
    
    elements.featuredProducts.innerHTML = featured.map(product => {
        // Robust stock calculation
        const inventory = typeof product.inventory === 'string' ? JSON.parse(product.inventory || '{}') : (product.inventory || {});
        const totalStock = Object.values(inventory).reduce((a, b) => a + (parseInt(b) || 0), 0);
        const isSoldOut = totalStock === 0;

        // Badge priority logic
        let badgeHtml = '';
        if (isSoldOut) {
            badgeHtml = '<span class="product-badge soldout" style="background: #6b7280 !important; color: white !important;">Sold Out</span>';
        } else if (product.badge && product.badge.toLowerCase() !== 'null' && product.badge.trim() !== '') {
            badgeHtml = `<span class="product-badge ${product.badge.toLowerCase().replace(/\s+/g, '-')}">${product.badge}</span>`;
        }

        const categoryName = CATEGORIES.find(c => c.id === product.category)?.name || product.category;
        
        // Image safety check
        const firstImage = product.images && product.images[0] ? product.images[0] : {
            src: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500"><rect fill="%23333" width="400" height="500"/><text fill="%23999" x="50%" y="50%" text-anchor="middle" font-family="sans-serif" font-size="20">No Image</text></svg>',
            alt: product.name
        };
        const secondImage = product.images && product.images[1] ? product.images[1] : null;

        return `
        <article class="product-card reveal-up ${isSoldOut ? 'sold-out' : ''}" onclick="window.location.href='product.html?slug=${product.slug}'">
            <div class="product-image-wrapper">
                ${badgeHtml}
                <img src="${firstImage.src}" alt="${firstImage.alt}" class="product-image" loading="lazy">
                ${secondImage ? `<img src="${secondImage.src}" alt="${secondImage.alt}" class="product-image-hover" loading="lazy">` : ''}
            </div>
            <div class="product-info">
                <p class="product-category">${categoryName}</p>
                <h3 class="product-name">${product.name}</h3>
                <div class="product-price">
                    <span class="current-price">${CurrencyConfig.formatPrice(product.price)}</span>
                </div>
                ${product.average_rating ? `
                    <div class="product-rating">
                        <span class="star-rating-small">${renderStarRating(product.average_rating)}</span>
                        <span class="rating-text">(${product.review_count || 0})</span>
                    </div>
                ` : ''}
            </div>
        </article>
    `}).join('');
}

// ==========================================
// CART
// ==========================================
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
    if (!query.trim()) {
        if (elements.searchResults) elements.searchResults.innerHTML = '';
        return;
    }
    
    const results = ProductAPI.search(query);
    
    if (results.length === 0) {
        elements.searchResults.innerHTML = `
            <div style="text-align: center; padding: 3rem; color: var(--color-text-muted);">
                No products found for "${query}"
            </div>
        `;
        return;
    }
    
    elements.searchResults.innerHTML = results.map(product => `
        <div class="search-result-item" onclick="window.location.href='product.html?slug=${product.slug}'">
            <img src="${product.images[0].src}" alt="${product.name}">
            <div class="search-result-info">
                <h4>${product.name}</h4>
                <p>${CATEGORIES.find(c => c.id === product.category)?.name}</p>
            </div>
            <span class="search-result-price">${CurrencyConfig.formatPrice(product.price)}</span>
        </div>
    `).join('');
}

// ==========================================
// LIGHTBOX
// ==========================================
function openLightbox(index) {
    state.currentLook = index;
    updateLightbox();
    elements.lightbox?.classList.add('active');
    elements.lightboxOverlay?.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeLightbox() {
    elements.lightbox?.classList.remove('active');
    elements.lightboxOverlay?.classList.remove('active');
    document.body.style.overflow = '';
}

function updateLightbox() {
    const look = state.lookbookImages[state.currentLook];
    if (elements.lightboxImage) elements.lightboxImage.src = look.src;
    if (elements.lightboxImage) elements.lightboxImage.alt = look.title;
    if (elements.lightboxNumber) elements.lightboxNumber.textContent = look.number;
    if (elements.lightboxTitle) elements.lightboxTitle.textContent = look.title;
}

function prevLook() {
    state.currentLook = (state.currentLook - 1 + state.lookbookImages.length) % state.lookbookImages.length;
    updateLightbox();
}

function nextLook() {
    state.currentLook = (state.currentLook + 1) % state.lookbookImages.length;
    updateLightbox();
}

// ==========================================
// TOAST
// ==========================================
function showToast(message, type = 'success', action = null) {
    if (!elements.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span class="toast-message">${message}</span>
        ${action ? `<span class="toast-action" onclick="window.openCart()">${action}</span>` : ''}
    `;
    
    elements.toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'toast-in 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ==========================================
// NEWSLETTER
// ==========================================
function handleNewsletterSubmit(e) {
    e.preventDefault();
    const email = elements.newsletterEmail.value;
    const submitBtn = elements.newsletterForm.querySelector('button[type="submit"]');
    
    submitBtn.textContent = 'Subscribing...';
    submitBtn.disabled = true;
    
    setTimeout(() => {
        submitBtn.textContent = 'Subscribed!';
        submitBtn.style.background = '#22c55e';
        elements.newsletterForm.reset();
        showToast('Welcome to the wave! Check your email.', 'success');
        
        setTimeout(() => {
            submitBtn.textContent = 'Subscribe';
            submitBtn.style.background = '';
            submitBtn.disabled = false;
        }, 2000);
    }, 1000);
}

// ==========================================
// EVENTS
// ==========================================
function bindEvents() {
    // Navigation
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            elements.nav?.classList.add('scrolled');
        } else {
            elements.nav?.classList.remove('scrolled');
        }
    }, { passive: true });
    
    elements.mobileMenuBtn?.addEventListener('click', () => {
        elements.mobileMenuBtn.classList.toggle('active');
        elements.navLinks?.classList.toggle('active');
    });
    
    // Cart
    elements.cartBtn?.addEventListener('click', window.openCart);
    elements.cartClose?.addEventListener('click', window.closeCart);
    elements.cartOverlay?.addEventListener('click', window.closeCart);
    
    // Wishlist
    elements.wishlistBtn?.addEventListener('click', window.openWishlist);
    elements.wishlistClose?.addEventListener('click', window.closeWishlist);
    elements.wishlistOverlay?.addEventListener('click', window.closeWishlist);
    
    // Search
    elements.searchBtn?.addEventListener('click', openSearch);
    elements.searchClose?.addEventListener('click', closeSearch);
    
    let searchTimeout;
    elements.searchInput?.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => handleSearch(e.target.value), 300);
    });
    
    // Lightbox
    elements.lookbookItems.forEach((item, index) => {
        item.addEventListener('click', () => openLightbox(index));
    });
    
    elements.lightboxClose?.addEventListener('click', closeLightbox);
    elements.lightboxOverlay?.addEventListener('click', closeLightbox);
    elements.lightboxPrev?.addEventListener('click', prevLook);
    elements.lightboxNext?.addEventListener('click', nextLook);
    
    // Newsletter
    elements.newsletterForm?.addEventListener('submit', handleNewsletterSubmit);
    
    // Keyboard
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeSearch();
            closeLightbox();
            window.closeCart();
            window.closeWishlist();
            
            if (elements.navLinks?.classList.contains('active')) {
                elements.mobileMenuBtn?.click();
            }
        }
        
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault();
            openSearch();
        }
        
        if (elements.lightbox?.classList.contains('active')) {
            if (e.key === 'ArrowLeft') prevLook();
            if (e.key === 'ArrowRight') nextLook();
        }
    });
    
    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (href === '#') return;
            
            e.preventDefault();
            const target = document.querySelector(href);
            
            if (target) {
                const navHeight = elements.nav?.offsetHeight || 0;
                const targetPosition = target.getBoundingClientRect().top + window.scrollY - navHeight;
                
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
}

// Combined Locale Selector
function initLocaleSelector() {
    const localeBtn = document.getElementById('localeBtn');
    const localeDropdown = document.getElementById('localeDropdown');
    const localeCurrent = document.getElementById('localeCurrent');
    
    if (!localeBtn || !localeDropdown) return;
    
    // Get current values
    const currentCurrency = CurrencyConfig.getCurrentCurrency();
    const currentLang = localStorage.getItem('preferredLanguage') || 'en';
    
    // Update display
    updateLocaleDisplay(currentCurrency, currentLang);
    
    // Set active states
    document.querySelectorAll('#currencyOptions .locale-option').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.currency === currentCurrency);
        btn.addEventListener('click', () => {
            CurrencyConfig.setCurrency(btn.dataset.currency);
            updateLocaleDisplay(btn.dataset.currency, currentLang);
            window.location.reload();
        });
    });
    
    document.querySelectorAll('#languageOptions .locale-option').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === currentLang);
        btn.addEventListener('click', () => {
            localStorage.setItem('preferredLanguage', btn.dataset.lang);
            document.documentElement.lang = btn.dataset.lang;
            document.documentElement.dir = btn.dataset.lang === 'ar' ? 'rtl' : 'ltr';
            updateLocaleDisplay(currentCurrency, btn.dataset.lang);
            window.location.reload();
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

// Legacy selectors (mobile menu)
function initLegacySelectors() {
    const currencySelect = document.getElementById('currencySelect');
    if (currencySelect) {
        currencySelect.value = CurrencyConfig.getCurrentCurrency();
        currencySelect.addEventListener('change', (e) => {
            CurrencyConfig.setCurrency(e.target.value);
            window.location.reload();
        });
    }
    
    const languageSelect = document.getElementById('languageSelect');
    if (languageSelect) {
        const savedLang = localStorage.getItem('preferredLanguage') || 'en';
        languageSelect.value = savedLang;
        languageSelect.addEventListener('change', (e) => {
            localStorage.setItem('preferredLanguage', e.target.value);
            document.documentElement.lang = e.target.value;
            document.documentElement.dir = e.target.value === 'ar' ? 'rtl' : 'ltr';
            window.location.reload();
        });
    }
    
    // Mobile selectors
    const mobileCurrencySelect = document.getElementById('mobileCurrencySelect');
    if (mobileCurrencySelect) {
        mobileCurrencySelect.value = CurrencyConfig.getCurrentCurrency();
        mobileCurrencySelect.addEventListener('change', (e) => {
            CurrencyConfig.setCurrency(e.target.value);
            window.location.reload();
        });
    }
    
    const mobileLanguageSelect = document.getElementById('mobileLanguageSelect');
    if (mobileLanguageSelect) {
        const savedLang = localStorage.getItem('preferredLanguage') || 'en';
        mobileLanguageSelect.value = savedLang;
        mobileLanguageSelect.addEventListener('change', (e) => {
            localStorage.setItem('preferredLanguage', e.target.value);
            document.documentElement.lang = e.target.value;
            document.documentElement.dir = e.target.value === 'ar' ? 'rtl' : 'ltr';
            window.location.reload();
        });
    }
    
    // Apply translations on load
    const savedLang = localStorage.getItem('preferredLanguage') || 'en';
    document.documentElement.lang = savedLang;
    document.documentElement.dir = savedLang === 'ar' ? 'rtl' : 'ltr';
    if (typeof applyTranslations === 'function') {
        applyTranslations();
    }
}

// BOOTSTRAP: Wait for shared components to load before starting logic
window.addEventListener('componentsLoaded', () => {
    initHome();
});

// Fallback: If components don't load or already loaded
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    // Check if components are already initialized
    if (window.Components && document.getElementById('nav')?.innerHTML) {
        initHome();
    }
}
