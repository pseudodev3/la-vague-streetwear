/**
 * LA VAGUE - Shop Page JavaScript
 * Connected to Backend API
 */

// ==========================================
// API CONFIGURATION
// ==========================================
const API_URL = '/api';
const { escapeHTML, safeURL, safeClassToken, safeColor } = window.BrowserSecurity;

// API Client for Shop
const ShopAPI = {
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
    },
    
    async getProductBySlug(slug) {
        try {
            const response = await fetch(`${API_URL}/products/${encodeURIComponent(slug)}`);
            if (!response.ok) throw new Error('Product not found');
            const data = await response.json();
            return data.product;
        } catch (error) {
            return null;
        }
    },
    
    async checkStock(productId, color, size) {
        try {
            const response = await fetch(`${API_URL}/products/inventory/check/${productId}?color=${encodeURIComponent(color)}&size=${encodeURIComponent(size)}`);
            const data = await response.json();
            return data;
        } catch (error) {
            return { available: 0, inStock: false, unavailable: true };
        }
    }
};

// Transform database product to frontend format
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
        createdAt: dbProduct.created_at || dbProduct.createdAt,
        sizeGuide: getSizeGuideForCategory(dbProduct.category)
    };
}

function getSizeGuideForCategory(category) {
    const guides = {
        hoodies: 'oversized',
        tees: 'regular',
        bottoms: 'pants',
        accessories: 'none'
    };
    return guides[category] || 'regular';
}

// ==========================================
// STATE
// ==========================================
const state = {
    products: [],
    filteredProducts: [],
    currentCategory: 'all',
    sortBy: 'featured',
    filters: {
        sale: false,
        new: false,
        bestseller: false,
        maxPrice: 500000
    },
    quickViewProduct: null,
    selectedColor: null,
    selectedSize: null,
    selectedQuantity: 1,
    usingStaticData: false
};

let elements = {};
let eventsBound = false;

const getCart = () => typeof CartState !== 'undefined' ? CartState.cart : [];
const getWishlist = () => typeof CartState !== 'undefined' ? CartState.wishlist : [];

async function initShop() {
    // ==========================================
    // UI Elements (Refresh after injection)
    // ==========================================
    elements = {
        productsGrid: document.getElementById('productsGrid'),
        loadingState: document.getElementById('loadingState'),
        emptyState: document.getElementById('emptyState'),
        resultsCount: document.getElementById('resultsCount'),
        categoryFilters: document.getElementById('categoryFilters'),
        mobileCategoryFilters: document.getElementById('mobileCategoryFilters'),
        sortSelect: document.getElementById('sortSelect'),
        filterToggle: document.getElementById('filterToggle'),
        filterSidebar: document.getElementById('filterSidebar'),
        filterOverlay: document.getElementById('filterOverlay'),
        filterClose: document.getElementById('filterClose'),
        applyFilters: document.getElementById('applyFilters'),
        clearFilters: document.getElementById('clearFilters'),
        clearAllFilters: document.getElementById('clearAllFilters'),
        priceRange: document.getElementById('priceRange'),
        priceValue: document.getElementById('priceValue'),
        quickViewModal: document.getElementById('quickViewModal'),
        quickViewOverlay: document.getElementById('quickViewOverlay'),
        quickViewClose: document.getElementById('quickViewClose'),
        quickViewContent: document.getElementById('quickViewContent'),
        sizeGuideModal: document.getElementById('sizeGuideModal'),
        sizeGuideOverlay: document.getElementById('sizeGuideOverlay'),
        sizeGuideClose: document.getElementById('sizeGuideClose'),
        sizeGuideContent: document.getElementById('sizeGuideContent'),
        searchOverlay: document.getElementById('searchOverlay'),
        searchBtn: document.getElementById('searchBtn'),
        searchClose: document.getElementById('searchClose'),
        searchInput: document.getElementById('searchInput'),
        searchResults: document.getElementById('searchResults'),
        cartCount: document.getElementById('cartCount'),
        wishlistCount: document.getElementById('wishlistCount'),
        wishlistBtn: document.getElementById('wishlistBtn'),
        cartBtn: document.getElementById('cartBtn'),
        cartSidebar: document.getElementById('cartSidebar'),
        cartOverlay: document.getElementById('cartOverlay'),
        cartClose: document.getElementById('cartClose'),
        cartItems: document.getElementById('cartItems'),
        cartSubtotal: document.getElementById('cartSubtotal'),
        wishlistSidebar: document.getElementById('wishlistSidebar'),
        wishlistOverlay: document.getElementById('wishlistOverlay'),
        wishlistClose: document.getElementById('wishlistClose'),
        wishlistItems: document.getElementById('wishlistItems'),
        toastContainer: document.getElementById('toastContainer'),
        nav: document.getElementById('nav'),
        navLinks: document.getElementById('navLinks')
    };

    // Initialize UI
    showLoading();
    
    // Try to load from API first
    const apiProducts = await ShopAPI.getProducts();
    
    if (Array.isArray(apiProducts)) {
        state.products = apiProducts.map(transformProduct);
        state.usingStaticData = false;
    } else {
        state.products = [];
        state.usingStaticData = false;
        if (elements.emptyState) {
            elements.emptyState.innerHTML = '<h3>Store temporarily unavailable</h3><p>We could not load live products right now. Please refresh in a moment.</p>';
        }
    }
    
    state.filteredProducts = [...state.products];
    
    hideLoading();
    renderProducts();
    if (typeof CartState !== 'undefined') {
        CartState.updateCartCount();
        CartState.updateWishlistCount();
    }
    
    bindEvents();
const urlParams = new URLSearchParams(window.location.search);
    const category = urlParams.get('category');
    // Sanitize input: only allow categories that actually exist
    if (category && typeof CATEGORIES !== 'undefined' && CATEGORIES.find(c => c.id === category)) {
        setCategory(category);
    }
}

// ==========================================
// PRODUCT RENDERING
// ==========================================
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

function renderProducts() {
    if (!elements.productsGrid) return;

    if (state.filteredProducts.length === 0) {
        elements.productsGrid.style.display = 'none';
        elements.emptyState.style.display = 'block';
        elements.resultsCount.textContent = '0 products';
        return;
    }

    elements.productsGrid.style.display = 'grid';
    elements.emptyState.style.display = 'none';
    elements.resultsCount.textContent = `${state.filteredProducts.length} product${state.filteredProducts.length !== 1 ? 's' : ''}`;

    elements.productsGrid.innerHTML = state.filteredProducts.map(product => {
        const firstImage = product.images?.[0] || { src: '/la-vague-red-wordmark.png', alt: product.name };
        const secondImage = product.images?.[1] || null;
        const inventory = typeof product.inventory === 'string'
            ? JSON.parse(product.inventory || '{}')
            : (product.inventory || {});
        const totalStock = Object.values(inventory).reduce(
            (total, value) => total + (Number.parseInt(value, 10) || 0),
            0
        );
        const isSoldOut = totalStock === 0;

        const safeId = escapeHTML(product.id);
        const safeSlug = escapeHTML(product.slug);
        const safeName = escapeHTML(product.name);
        const categoryName = CATEGORIES.find(category => category.id === product.category)?.name || product.category;
        const safeCategory = escapeHTML(categoryName);
        const firstSrc = escapeHTML(safeURL(firstImage.src, { allowDataImage: true }) || '/la-vague-red-wordmark.png');
        const firstAlt = escapeHTML(firstImage.alt || product.name);
        const secondSrc = secondImage
            ? escapeHTML(safeURL(secondImage.src, { allowDataImage: true }))
            : '';
        const secondAlt = secondImage ? escapeHTML(secondImage.alt || product.name) : '';
        const badge = String(product.badge || '').trim();
        const safeBadge = escapeHTML(badge);
        const badgeClass = safeClassToken(badge);
        const reviewCount = Math.max(0, Number.parseInt(product.review_count, 10) || 0);

        let badgeHtml = '';
        if (isSoldOut) {
            badgeHtml = '<span class="product-badge soldout">Sold Out</span>';
        } else if (badge && badge.toLowerCase() !== 'null') {
            badgeHtml = `<span class="product-badge ${badgeClass}">${safeBadge}</span>`;
        }

        return `
        <article class="product-card reveal-up ${isSoldOut ? 'sold-out' : ''}" data-product-id="${safeId}">
            <div class="product-image-wrapper" data-shop-action="open-product" data-slug="${safeSlug}">
                ${badgeHtml}
                <img src="${firstSrc}" alt="${firstAlt}" class="product-image" loading="lazy">
                ${secondSrc ? `<img src="${secondSrc}" alt="${secondAlt}" class="product-image-hover" loading="lazy">` : ''}
                <div class="product-actions">
                    <button type="button" class="product-btn" data-shop-action="add-to-cart" data-product-id="${safeId}" ${isSoldOut ? 'disabled' : ''}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M6 6h15l-1.5 9h-12z"></path>
                            <circle cx="9" cy="20" r="1"></circle>
                            <circle cx="18" cy="20" r="1"></circle>
                            <path d="M6 6L5 3H2"></path>
                        </svg>
                        ${isSoldOut ? 'Sold Out' : 'Add to Cart'}
                    </button>
                    <button type="button" class="product-btn" data-shop-action="quick-view" data-product-id="${safeId}">Quick View</button>
                    <button type="button" class="product-btn wishlist ${getWishlist().includes(product.id) ? 'active' : ''}"
                            data-shop-action="wishlist" data-product-id="${safeId}" aria-label="Toggle wishlist">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="${getWishlist().includes(product.id) ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="product-info">
                <p class="product-category">${safeCategory}</p>
                <h3 class="product-name" data-shop-action="open-product" data-slug="${safeSlug}">${safeName}</h3>
                <div class="product-price">
                    <span class="current-price">${CurrencyConfig.formatPrice(Number(product.price) || 0)}</span>
                    ${product.compareAtPrice ? `<span class="original-price">${CurrencyConfig.formatPrice(Number(product.compareAtPrice) || 0)}</span>` : ''}
                </div>
                ${product.average_rating ? `
                    <div class="product-rating">
                        <span class="star-rating-small">${renderStarRating(Number(product.average_rating) || 0)}</span>
                        <span class="rating-text">(${reviewCount})</span>
                    </div>
                ` : ''}
                ${product.colors?.length > 1 ? `
                    <div class="product-colors">
                        ${product.colors.map((color, index) => `
                            <span class="color-dot ${index === 0 ? 'active' : ''}" style="background-color: ${safeColor(color.value)}" title="${escapeHTML(color.name)}"></span>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        </article>
    `;
    }).join('');

    initRevealAnimations();
}

function showLoading() {
    if (elements.loadingState) elements.loadingState.classList.add('active');
    if (elements.productsGrid) elements.productsGrid.style.display = 'none';
    if (elements.emptyState) elements.emptyState.style.display = 'none';
}

function hideLoading() {
    if (elements.loadingState) elements.loadingState.classList.remove('active');
}

// ==========================================
// FILTERING & SORTING
// ==========================================
function filterProducts() {
    let filtered = [...state.products];
    
    if (state.currentCategory !== 'all') {
        filtered = filtered.filter(p => p.category === state.currentCategory);
    }
    
    if (state.filters.sale) {
        filtered = filtered.filter(p => p.compareAtPrice !== null);
    }
    if (state.filters.new) {
        filtered = filtered.filter(p => p.tags.includes('new'));
    }
    if (state.filters.bestseller) {
        filtered = filtered.filter(p => p.tags.includes('bestseller'));
    }
    
    filtered = filtered.filter(p => p.price <= state.filters.maxPrice);
    
    switch (state.sortBy) {
        case 'price-low': filtered.sort((a, b) => a.price - b.price); break;
        case 'price-high': filtered.sort((a, b) => b.price - a.price); break;
        case 'name': filtered.sort((a, b) => a.name.localeCompare(b.name)); break;
        case 'newest': filtered.sort((a, b) => (b.tags.includes('new') ? 1 : 0) - (a.tags.includes('new') ? 1 : 0)); break;
    }
    
    state.filteredProducts = filtered;
    renderProducts();
}

function setCategory(category) {
    state.currentCategory = category;
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.category === category);
    });
    document.querySelectorAll('input[name="mobile-category"]').forEach(input => {
        input.checked = input.value === category;
    });
    filterProducts();
}

function setSort(sortBy) {
    state.sortBy = sortBy;
    filterProducts();
}

// ==========================================
// QUICK VIEW
// ==========================================
window.quickView = function(productId) {
    const product = state.products.find(p => p.id === productId);
    if (!product) return;
    
    state.quickViewProduct = product;
    state.selectedColor = product.colors?.[0]?.name || 'Default';
    state.selectedSize = product.sizes?.[0] || 'OS';
    state.selectedQuantity = 1;
    
    renderQuickView();
    openQuickView();
};

function renderQuickView() {
    const product = state.quickViewProduct;
    if (!product || !elements.quickViewContent) return;

    const firstImage = product.images?.[0] || { src: '/la-vague-red-wordmark.png', alt: product.name };
    const variantKey = `${state.selectedColor}-${state.selectedSize}`;
    const stock = Number(product.inventory?.[variantKey] || 0);

    if (stock > 0 && state.selectedQuantity > stock) {
        state.selectedQuantity = stock;
    } else if (stock === 0) {
        state.selectedQuantity = 1;
    }

    const safeImage = escapeHTML(safeURL(firstImage.src, { allowDataImage: true }) || '/la-vague-red-wordmark.png');
    const safeAlt = escapeHTML(firstImage.alt || product.name);
    const categoryName = CATEGORIES.find(category => category.id === product.category)?.name || product.category;
    const safeCategory = escapeHTML(categoryName);
    const safeName = escapeHTML(product.name);
    const safeDescription = escapeHTML(product.description || '');
    const safeSelectedColor = escapeHTML(state.selectedColor);
    const safeSelectedSize = escapeHTML(state.selectedSize);

    elements.quickViewContent.innerHTML = `
        <div class="quick-view-gallery">
            <img src="${safeImage}" alt="${safeAlt}" id="quickViewImage">
        </div>
        <div class="quick-view-details">
            <p class="quick-view-category">${safeCategory}</p>
            <h2 class="quick-view-title">${safeName}</h2>
            <div class="quick-view-price">
                <span class="current-price">${CurrencyConfig.formatPrice(Number(product.price) || 0)}</span>
                ${product.compareAtPrice ? `<span class="original-price">${CurrencyConfig.formatPrice(Number(product.compareAtPrice) || 0)}</span>` : ''}
            </div>
            <p class="quick-view-description">${safeDescription}</p>

            <div class="quick-view-options">
                ${product.colors?.length > 1 ? `
                    <div class="option-section">
                        <span class="option-label">Color: <strong>${safeSelectedColor}</strong></span>
                        <div class="color-options">
                            ${product.colors.map(color => `
                                <button type="button" class="color-option ${state.selectedColor === color.name ? 'active' : ''}"
                                        style="background-color: ${safeColor(color.value)}"
                                        data-quick-action="select-color"
                                        data-value="${escapeHTML(color.name)}"
                                        title="${escapeHTML(color.name)}"></button>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}

                <div class="option-section">
                    <span class="option-label">
                        Size: <strong>${safeSelectedSize}</strong>
                        ${product.sizeGuide ? `<button type="button" class="size-guide-link" data-quick-action="size-guide" data-value="${escapeHTML(product.sizeGuide)}">Size Guide</button>` : ''}
                    </span>
                    <div class="size-options">
                        ${product.sizes?.map(size => {
                            const inStock = Number(product.inventory?.[`${state.selectedColor}-${size}`] || 0) > 0;
                            return `
                                <button type="button" class="size-option ${state.selectedSize === size ? 'active' : ''} ${!inStock ? 'disabled' : ''}"
                                        data-quick-action="select-size"
                                        data-value="${escapeHTML(size)}"
                                        ${!inStock ? 'disabled' : ''}>
                                    ${escapeHTML(size)}
                                </button>
                            `;
                        }).join('') || ''}
                    </div>
                </div>
            </div>

            <div class="quick-view-actions">
                <div class="quantity-selector">
                    <button type="button" class="qty-btn" data-quick-action="quantity" data-delta="-1" ${state.selectedQuantity <= 1 ? 'disabled' : ''}>−</button>
                    <span>${state.selectedQuantity}</span>
                    <button type="button" class="qty-btn" data-quick-action="quantity" data-delta="1" ${state.selectedQuantity >= stock ? 'disabled' : ''}>+</button>
                </div>
                <button type="button" class="add-to-cart-btn" data-quick-action="add-to-cart" ${stock <= 0 ? 'disabled' : ''}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M6 6h15l-1.5 9h-12z"></path>
                        <circle cx="9" cy="20" r="1"></circle>
                        <circle cx="18" cy="20" r="1"></circle>
                        <path d="M6 6L5 3H2"></path>
                    </svg>
                    ${stock <= 0 ? 'Sold Out' : 'Add to Cart'}
                </button>
            </div>
            ${stock > 0 && stock <= 5 ? `<p class="stock-warning">Only ${stock} left in stock!</p>` : ''}
        </div>
    `;
}

window.selectColor = function(colorName) {
    state.selectedColor = colorName;
    renderQuickView();
};

window.selectSize = function(size) {
    state.selectedSize = size;
    renderQuickView();
};

window.updateQuantity = function(delta) {
    const product = state.quickViewProduct;
    const variantKey = `${state.selectedColor}-${state.selectedSize}`;
    const stock = product.inventory?.[variantKey] || 0;
    
    const newQty = state.selectedQuantity + delta;
    if (newQty >= 1 && newQty <= stock) {
        state.selectedQuantity = newQty;
        renderQuickView();
    } else if (newQty > stock) {
        showToast(`Only ${stock} items available in stock`, 'error');
    }
};

window.addToCartFromQuickView = async function() {
    const product = state.quickViewProduct;
    if (!state.usingStaticData) {
        const stockCheck = await ShopAPI.checkStock(product.id, state.selectedColor, state.selectedSize);
        if (!stockCheck.inStock || stockCheck.available < state.selectedQuantity) {
            showToast(`Only ${stockCheck.available} items available in this variant`, 'error');
            return;
        }
    } else {
        const variantKey = `${state.selectedColor}-${state.selectedSize}`;
        const stock = product.inventory?.[variantKey] || 0;
        if (state.selectedQuantity > stock) {
            showToast(`Only ${stock} items available in stock`, 'error');
            return;
        }
    }
    CartState.addToCart({
        id: product.id, name: product.name, price: product.price,
        image: product.images?.[0]?.src || '', color: state.selectedColor,
        size: state.selectedSize, quantity: state.selectedQuantity
    });
    showToast(`${product.name} added to cart`, 'success');
    closeQuickView();
};

function openQuickView() {
    elements.quickViewModal?.classList.add('active');
    elements.quickViewOverlay?.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeQuickView() {
    elements.quickViewModal?.classList.remove('active');
    elements.quickViewOverlay?.classList.remove('active');
    document.body.style.overflow = '';
}

// ==========================================
// SIZE GUIDE
// ==========================================
window.openSizeGuide = function(type) {
    const guide = ProductAPI.getSizeGuide(type);
    if (!guide || !elements.sizeGuideContent) return;

    const measurements = Array.isArray(guide.measurements) ? guide.measurements : [];
    const columns = measurements[0]
        ? Object.keys(measurements[0]).filter(key => key !== 'size')
        : [];

    elements.sizeGuideContent.innerHTML = `
        <h4>${escapeHTML(guide.name)}</h4>
        <p class="size-guide-unit">All measurements are in ${escapeHTML(guide.unit)}</p>
        <table class="size-table">
            <thead>
                <tr><th>Size</th>${columns.map(key => `<th>${escapeHTML(key.charAt(0).toUpperCase() + key.slice(1))}</th>`).join('')}</tr>
            </thead>
            <tbody>
                ${measurements.map(measurement => `
                    <tr>
                        <td><strong>${escapeHTML(measurement.size)}</strong></td>
                        ${columns.map(key => `<td>${escapeHTML(measurement[key])}</td>`).join('')}
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    elements.sizeGuideModal?.classList.add('active');
    elements.sizeGuideOverlay?.classList.add('active');
};

function closeSizeGuide() {
    elements.sizeGuideModal?.classList.remove('active');
    elements.sizeGuideOverlay?.classList.remove('active');
}

// ==========================================
// CART & WISHLIST HELPERS
// ==========================================
window.addToCartFromCard = async function(productId) {
    const product = state.products.find(p => p.id === productId);
    if (!product) return;
    const color = product.colors?.[0]?.name || 'Default';
    const size = product.sizes?.[0] || 'OS';
    
    // Perform thorough stock check
    let isAvailable = true;
    if (!state.usingStaticData) {
        try {
            const response = await fetch(`${API_URL}/products/inventory/check/${product.id}?color=${encodeURIComponent(color)}&size=${encodeURIComponent(size)}`);
            if (response.ok) {
                const stockCheck = await response.json();
                if (stockCheck && stockCheck.success && stockCheck.inStock === false) {
                    isAvailable = false;
                }
            } else if (response.status === 404) {
                // If product is not found in DB, it might be in static data
                const variantKey = `${color}-${size}`;
                const staticStock = product.inventory?.[variantKey] || 0;
                if (staticStock <= 0) isAvailable = false;
            }
        } catch (error) {
            console.warn('[SHOP] Live stock check unavailable:', error);
            isAvailable = false;
        }
    } else {
        const variantKey = `${color}-${size}`;
        const stock = product.inventory?.[variantKey] || 0;
        if (stock <= 0) isAvailable = false;
    }

    if (!isAvailable) {
        showToast('Sorry, this item is out of stock', 'error');
        return;
    }
    
    CartState.addToCart({
        id: product.id, name: product.name, price: product.price,
        image: product.images?.[0]?.src || '', color: color, size: size, quantity: 1
    });
};

window.toggleWishlist = function(productId) {
    CartState.addToWishlist(productId);
    renderProducts();
};

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
        if (elements.searchResults) elements.searchResults.replaceChildren();
        return;
    }

    const searchTerm = query.toLowerCase();
    const results = state.products.filter(product =>
        product.name?.toLowerCase().includes(searchTerm) ||
        product.category?.toLowerCase().includes(searchTerm)
    );

    if (results.length === 0) {
        const message = document.createElement('div');
        message.className = 'search-message';
        message.textContent = `No products found for "${query}"`;
        elements.searchResults.replaceChildren(message);
        return;
    }

    elements.searchResults.innerHTML = results.map(product => {
        const image = escapeHTML(safeURL(product.images?.[0]?.src, { allowDataImage: true }));
        const safeName = escapeHTML(product.name);
        const safeCategory = escapeHTML(product.category);
        const slug = encodeURIComponent(String(product.slug || product.id || ''));
        return `
            <a class="search-result-item" href="/product.html?slug=${slug}">
                ${image ? `<img src="${image}" alt="${safeName}">` : ''}
                <div class="search-result-info"><h4>${safeName}</h4><p>${safeCategory}</p></div>
                <span class="search-result-price">${CurrencyConfig.formatPrice(Number(product.price) || 0)}</span>
            </a>
        `;
    }).join('');
}

function showToast(message, type = 'success') {
    if (!elements.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
    toast.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
    const content = document.createElement('span');
    content.className = 'toast-message';
    content.textContent = String(message);
    toast.appendChild(content);
    elements.toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'lv-toast-out 160ms var(--lv-ease) forwards';
        setTimeout(() => toast.remove(), 180);
    }, 4000);
}

window.openProductPage = function(slug) {
    const skeleton = document.getElementById('pageSkeleton');
    if (skeleton) skeleton.style.display = 'flex';
    setTimeout(() => {
        window.location.href = `/product.html?slug=${encodeURIComponent(String(slug || ''))}`;
    }, 100);
};

function bindEvents() {
    if (eventsBound) return;
    eventsBound = true;

    elements.productsGrid?.addEventListener('click', event => {
        const control = event.target.closest('[data-shop-action]');
        if (!control) return;

        const action = control.dataset.shopAction;
        if (action === 'open-product') {
            window.openProductPage(control.dataset.slug);
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        const productId = control.dataset.productId;
        if (!productId) return;

        if (action === 'add-to-cart') void window.addToCartFromCard(productId);
        if (action === 'quick-view') window.quickView(productId);
        if (action === 'wishlist') window.toggleWishlist(productId);
    });

    elements.quickViewContent?.addEventListener('click', event => {
        const control = event.target.closest('[data-quick-action]');
        if (!control) return;

        const action = control.dataset.quickAction;
        if (action === 'select-color') window.selectColor(control.dataset.value);
        if (action === 'select-size') window.selectSize(control.dataset.value);
        if (action === 'size-guide') window.openSizeGuide(control.dataset.value);
        if (action === 'quantity') window.updateQuantity(Number.parseInt(control.dataset.delta, 10) || 0);
        if (action === 'add-to-cart') void window.addToCartFromQuickView();
    });

    elements.categoryFilters?.addEventListener('click', (e) => {
        if (e.target.classList.contains('filter-btn')) setCategory(e.target.dataset.category);
    });
    elements.mobileCategoryFilters?.addEventListener('change', (e) => {
        if (e.target.name === 'mobile-category') setCategory(e.target.value);
    });
    elements.sortSelect?.addEventListener('change', (e) => setSort(e.target.value));
    elements.filterToggle?.addEventListener('click', () => {
        elements.filterSidebar?.classList.add('active');
        elements.filterOverlay?.classList.add('active');
    });
    const closeFilter = () => {
        elements.filterSidebar?.classList.remove('active');
        elements.filterOverlay?.classList.remove('active');
    };
    elements.filterClose?.addEventListener('click', closeFilter);
    elements.filterOverlay?.addEventListener('click', closeFilter);
    elements.priceRange?.addEventListener('input', (e) => {
        if (elements.priceValue) elements.priceValue.textContent = `₦${parseInt(e.target.value).toLocaleString()}`;
    });
    elements.applyFilters?.addEventListener('click', () => {
        state.filters.sale = document.getElementById('filterSale')?.checked || false;
        state.filters.new = document.getElementById('filterNew')?.checked || false;
        state.filters.bestseller = document.getElementById('filterBestseller')?.checked || false;
        state.filters.maxPrice = parseInt(elements.priceRange?.value || 500000);
        filterProducts();
        closeFilter();
    });
    elements.clearFilters?.addEventListener('click', () => {
        const s = document.getElementById('filterSale'), n = document.getElementById('filterNew'), b = document.getElementById('filterBestseller');
        if (s) s.checked = false; if (n) n.checked = false; if (b) b.checked = false;
        if (elements.priceRange) elements.priceRange.value = 500000;
        if (elements.priceValue) elements.priceValue.textContent = '₦500,000';
    });
    elements.clearAllFilters?.addEventListener('click', () => {
        state.currentCategory = 'all';
        state.filters = { sale: false, new: false, bestseller: false, maxPrice: 500000 };
        state.sortBy = 'featured';
        setCategory('all');
    });
    elements.quickViewClose?.addEventListener('click', closeQuickView);
    elements.quickViewOverlay?.addEventListener('click', closeQuickView);
    elements.sizeGuideClose?.addEventListener('click', closeSizeGuide);
    elements.sizeGuideOverlay?.addEventListener('click', closeSizeGuide);
    elements.searchBtn?.addEventListener('click', openSearch);
    elements.searchClose?.addEventListener('click', closeSearch);
    
    if (typeof SearchHelper !== 'undefined') {
        SearchHelper.init(elements.searchInput, handleSearch, 300);
    }

    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) elements.nav?.classList.add('scrolled');
        else elements.nav?.classList.remove('scrolled');
    }, { passive: true });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeQuickView(); closeSearch(); closeSizeGuide(); closeFilter();
            window.closeCart(); window.closeWishlist();
        }
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); openSearch(); }
    });
}

// Overrides for CartState
window.addEventListener('componentsLoaded', () => {
    initShop();
});

if (document.readyState === 'complete') {
    if (window.Components && document.getElementById('nav')?.innerHTML) initShop();
}
