/**
 * LA VAGUE - Homepage JavaScript
 */

const { escapeHTML: homeEscapeHTML, safeURL: homeSafeURL, safeClassToken: homeSafeClassToken } = window.BrowserSecurity;

// State - kept global for cross-function access
const state = {
    currentLook: 0,
    lookbookImages: [
        { src: '/assets/hey2.jpg', title: 'Look 01', number: '01' },
        { src: '/assets/daylight.jpg', title: 'Daylight', number: '02' },
        { src: '/assets/skatepark.jpg', title: 'Skate Park', number: '03' },
        { src: '/assets/downtown.jpg', title: 'Downtown', number: '04' },
        { src: '/assets/afterhours.jpg', title: 'After Hours', number: '05' },
        { src: '/assets/hey.jpg', title: 'Look 06', number: '06' },
        { src: '/assets/urbannights.jpg', title: 'Urban Nights', number: '07' }
    ]
};

let elements = {};
let eventsBound = false;

let marqueeResizeObserver = null;
let marqueeMutationObserver = null;
let marqueeFrame = 0;

function initMarquee() {
    const viewport = document.querySelector('.marquee');
    const track = viewport?.querySelector('.marquee-content');
    const source = track?.querySelector('.marquee-group:not([data-marquee-clone="true"])');
    if (!viewport || !track || !source) return;

    const rebuild = () => {
        cancelAnimationFrame(marqueeFrame);
        marqueeFrame = requestAnimationFrame(() => {
            track.querySelectorAll('[data-marquee-clone="true"], .marquee-group[aria-hidden="true"]').forEach(group => group.remove());

            const groupWidth = source.getBoundingClientRect().width;
            const viewportWidth = viewport.getBoundingClientRect().width;
            if (!groupWidth || !viewportWidth) return;

            const copies = Math.max(2, Math.ceil(viewportWidth / groupWidth) + 1);
            for (let index = 1; index < copies; index += 1) {
                const clone = source.cloneNode(true);
                clone.setAttribute('aria-hidden', 'true');
                clone.dataset.marqueeClone = 'true';
                track.appendChild(clone);
            }

            track.style.setProperty('--marquee-distance', `${groupWidth}px`);
            track.style.setProperty('--marquee-duration', `${groupWidth / 88}s`);
        });
    };

    marqueeResizeObserver?.disconnect();
    marqueeMutationObserver?.disconnect();
    rebuild();

    if ('ResizeObserver' in window) {
        marqueeResizeObserver = new ResizeObserver(rebuild);
        marqueeResizeObserver.observe(viewport);
        marqueeResizeObserver.observe(source);
    } else {
        window.addEventListener('resize', rebuild, { passive: true });
    }

    marqueeMutationObserver = new MutationObserver(rebuild);
    marqueeMutationObserver.observe(source, { childList: true, subtree: true, characterData: true });
}

function initLookbookMotion() {
    const lookbook = document.querySelector('.lookbook');
    if (!lookbook) return;

    const parallaxItems = Array.from(lookbook.querySelectorAll('[data-parallax]'));
    if (parallaxItems.length && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        let framePending = false;
        const updateParallax = () => {
            if (framePending) return;
            framePending = true;
            requestAnimationFrame(() => {
                const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
                parallaxItems.forEach(item => {
                    const image = item.querySelector('img');
                    if (!image) return;
                    const rect = item.getBoundingClientRect();
                    const speed = Number.parseFloat(item.dataset.parallax) || 0;
                    const offset = (rect.top + rect.height / 2 - viewportHeight / 2) * speed;
                    image.style.setProperty('--lookbook-parallax-y', `${Math.max(-18, Math.min(18, -offset)).toFixed(1)}px`);
                });
                framePending = false;
            });
        };
        window.addEventListener('scroll', updateParallax, { passive: true });
        window.addEventListener('resize', updateParallax, { passive: true });
        updateParallax();
    }

    lookbook.querySelectorAll('.lookbook-annotation').forEach(annotation => {
        annotation.addEventListener('click', event => {
            event.stopPropagation();
            const expanded = annotation.getAttribute('aria-expanded') === 'true';
            annotation.setAttribute('aria-expanded', String(!expanded));
        });
    });
}

async function initHome() {
    // ==========================================
    // UI Elements (Refresh after injection)
    // ==========================================
    elements = {
        nav: document.getElementById('nav'),
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

    initMarquee();
    await renderFeaturedProducts();
    
    updateCartCount();
    updateWishlistCount();
    bindEvents();
    initRevealAnimations();
    initLookbookMotion();
}

// ==========================================
// FEATURED PRODUCTS
// ==========================================

const API_URL = '/api';

const HomeAPI = {
    async getProducts() {
        try {
            const response = await fetch(`${API_URL}/products`);
            if (!response.ok) throw new Error('Failed to fetch products');
            const data = await response.json();
            return data.products || [];
        } catch (error) {
            console.warn('API unavailable; live products cannot be loaded');
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
        average_rating: parseFloat(dbProduct.average_rating || 0),
        review_count: parseInt(dbProduct.review_count || 0)
    };
}

function renderStarRating(rating) {
    const numericRating = parseFloat(rating);
    let html = '';
    for (let i = 1; i <= 5; i++) {
        if (i <= Math.round(numericRating)) {
            html += '★';
        } else {
            html += '<span class="empty">★</span>';
        }
    }
    return html;
}

async function renderFeaturedProducts() {
    if (!elements.featuredProducts) return;

    elements.featuredProducts.classList.remove('featured-grid-editorial', 'featured-grid-single');
    elements.featuredProducts.style.removeProperty('--featured-support-count');
    let featured = [];
    
    // Try to get from API first
    const apiProducts = await HomeAPI.getProducts();
    if (apiProducts && apiProducts.length > 0) {
        const products = apiProducts.map(transformProduct);
        featured = products.filter(p => p.tags.includes('bestseller')).slice(0, 4);
    }
    
    if (apiProducts === null) {
        elements.featuredProducts.innerHTML = '<div class="store-unavailable-state"><h3>Store temporarily unavailable</h3><p>We could not load live products right now. Please refresh in a moment.</p></div>';
        return;
    }

    // If no products are explicitly tagged as bestsellers, use live API products only.
    if (featured.length === 0 && apiProducts.length > 0) {
        featured = apiProducts.map(transformProduct).slice(0, 4);
    }

    if (featured.length === 0) {
        elements.featuredProducts.innerHTML = '<div class="store-unavailable-state"><p>No products are available right now.</p></div>';
        return;
    }
    
    elements.featuredProducts.classList.toggle('featured-grid-editorial', featured.length > 1);
    elements.featuredProducts.classList.toggle('featured-grid-single', featured.length === 1);
    if (featured.length > 1) {
        elements.featuredProducts.style.setProperty('--featured-support-count', String(featured.length - 1));
    }

    elements.featuredProducts.innerHTML = featured.map(product => {
        const inventory = typeof product.inventory === 'string'
            ? JSON.parse(product.inventory || '{}')
            : (product.inventory || {});
        const totalStock = Object.values(inventory).reduce(
            (total, value) => total + (Number.parseInt(value, 10) || 0),
            0
        );
        const isSoldOut = totalStock === 0;

        const badge = String(product.badge || '').trim();
        const badgeClass = homeSafeClassToken(badge);
        let badgeHtml = '';
        if (isSoldOut) {
            badgeHtml = '<span class="product-badge soldout">Sold Out</span>';
        } else if (badge && badge.toLowerCase() !== 'null') {
            badgeHtml = `<span class="product-badge ${badgeClass}">${homeEscapeHTML(badge)}</span>`;
        }

        const categoryName = CATEGORIES.find(category => category.id === product.category)?.name || product.category;
        const firstImage = product.images?.[0] || { src: '/la-vague-red-wordmark.png', alt: product.name };
        const secondImage = product.images?.[1] || null;
        const firstSrc = homeEscapeHTML(homeSafeURL(firstImage.src, { allowDataImage: true }) || '/la-vague-red-wordmark.png');
        const firstAlt = homeEscapeHTML(firstImage.alt || product.name);
        const secondSrc = secondImage
            ? homeEscapeHTML(homeSafeURL(secondImage.src, { allowDataImage: true }))
            : '';
        const secondAlt = secondImage ? homeEscapeHTML(secondImage.alt || product.name) : '';
        const safeSlug = homeEscapeHTML(product.slug || product.id || '');
        const reviewCount = Math.max(0, Number.parseInt(product.review_count, 10) || 0);

        return `
        <article class="product-card reveal-up ${isSoldOut ? 'sold-out' : ''}" data-home-action="open-product" data-slug="${safeSlug}" role="link" tabindex="0">
            <div class="product-image-wrapper">
                ${badgeHtml}
                <img src="${firstSrc}" alt="${firstAlt}" class="product-image" loading="lazy">
                ${secondSrc ? `<img src="${secondSrc}" alt="${secondAlt}" class="product-image-hover" loading="lazy">` : ''}
            </div>
            <div class="product-info">
                <p class="product-category">${homeEscapeHTML(categoryName)}</p>
                <h3 class="product-name">${homeEscapeHTML(product.name)}</h3>
                <div class="product-price">
                    <span class="current-price">${CurrencyConfig.formatPrice(Number(product.price) || 0)}</span>
                </div>
                ${reviewCount > 0 ? `
                    <div class="product-rating">
                        <span class="star-rating-small">${renderStarRating(Number(product.average_rating) || 0)}</span>
                        <span class="rating-text">(${reviewCount})</span>
                    </div>
                ` : ''}
            </div>
        </article>
    `;
    }).join('');
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

let liveSearchProducts = null;
let liveSearchPromise = null;

async function getLiveSearchProducts() {
    if (liveSearchProducts) return liveSearchProducts;
    if (!liveSearchPromise) {
        liveSearchPromise = HomeAPI.getProducts().then(products => {
            liveSearchProducts = Array.isArray(products) ? products.map(transformProduct) : null;
            return liveSearchProducts;
        });
    }
    return liveSearchPromise;
}

async function handleSearch(query) {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
        if (elements.searchResults) elements.searchResults.innerHTML = '';
        return;
    }

    const products = await getLiveSearchProducts();
    if (!products) {
        elements.searchResults.innerHTML = '<div class="search-message">Search is temporarily unavailable. Please try again shortly.</div>';
        return;
    }

    const results = products.filter(product => {
        const tags = Array.isArray(product.tags) ? product.tags.join(' ') : '';
        return [product.name, product.category, tags].join(' ').toLowerCase().includes(normalized);
    }).slice(0, 8);

    if (results.length === 0) {
        elements.searchResults.innerHTML = '<div class="search-message">No products found.</div>';
        return;
    }

    elements.searchResults.innerHTML = results.map(product => {
        const image = homeEscapeHTML(homeSafeURL(product.images?.[0]?.src, { allowDataImage: true }));
        const category = CATEGORIES.find(item => item.id === product.category)?.name || product.category || '';
        const slug = encodeURIComponent(String(product.slug || product.id || ''));
        const safeName = homeEscapeHTML(product.name);
        return `
            <a class="search-result-item" href="/product.html?slug=${slug}">
                ${image ? `<img src="${image}" alt="${safeName}">` : ''}
                <div class="search-result-info">
                    <h4>${safeName}</h4>
                    <p>${homeEscapeHTML(category)}</p>
                </div>
                <span class="search-result-price">${CurrencyConfig.formatPrice(Number(product.price) || 0)}</span>
            </a>
        `;
    }).join('');

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
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
    toast.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');

    const content = document.createElement('span');
    content.className = 'toast-message';
    content.textContent = String(message);
    toast.appendChild(content);

    if (action) {
        const actionButton = document.createElement('button');
        actionButton.type = 'button';
        actionButton.className = 'toast-action';
        actionButton.textContent = String(action);
        actionButton.addEventListener('click', () => window.openCart());
        toast.appendChild(actionButton);
    }

    elements.toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'lv-toast-out 160ms var(--lv-ease) forwards';
        setTimeout(() => toast.remove(), 180);
    }, 4000);
}

// ==========================================
// EVENTS
// ==========================================
function bindEvents() {
    if (eventsBound) return;
    eventsBound = true;

    elements.featuredProducts?.addEventListener('click', event => {
        const card = event.target.closest('[data-home-action="open-product"]');
        if (!card) return;
        const slug = card.dataset.slug;
        if (!slug) return;
        window.location.href = `/product.html?slug=${encodeURIComponent(slug)}`;
    });

    elements.featuredProducts?.addEventListener('keydown', event => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        const card = event.target.closest('[data-home-action="open-product"]');
        if (!card) return;
        event.preventDefault();
        const slug = card.dataset.slug;
        if (slug) window.location.href = `/product.html?slug=${encodeURIComponent(slug)}`;
    });

    // Navigation
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            elements.nav?.classList.add('scrolled');
        } else {
            elements.nav?.classList.remove('scrolled');
        }
    }, { passive: true });
    
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
        item.addEventListener('keydown', event => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            openLightbox(index);
        });
    });
    
    elements.lightboxClose?.addEventListener('click', closeLightbox);
    elements.lightboxOverlay?.addEventListener('click', closeLightbox);
    elements.lightboxPrev?.addEventListener('click', prevLook);
    elements.lightboxNext?.addEventListener('click', nextLook);
    
    // Keyboard
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeSearch();
            closeLightbox();
            window.closeCart();
            window.closeWishlist();
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
