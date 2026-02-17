/**
 * LA VAGUE - Shop Page JavaScript
 * Connected to Backend API
 */

// ==========================================
// API CONFIGURATION
// ==========================================
const API_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:3000/api' 
    : 'https://la-vague-api.onrender.com/api';

// API Client for Shop
const ShopAPI = {
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
            const response = await fetch(`${API_URL}/inventory/check/${productId}?color=${encodeURIComponent(color)}&size=${encodeURIComponent(size)}`);
            const data = await response.json();
            return data;
        } catch (error) {
            return { available: 999, inStock: true }; // Default to available on error
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

const getCart = () => typeof CartState !== 'undefined' ? CartState.cart : [];
const getWishlist = () => typeof CartState !== 'undefined' ? CartState.wishlist : [];

async function initShop() {
    console.log('[SHOP] Initializing shop logic...');
    // ==========================================
    // DOM ELEMENTS (RE-QUERY AFTER INJECTION)
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
        mobileMenuBtn: document.getElementById('mobileMenuBtn'),
        navLinks: document.getElementById('navLinks')
    };

    // Initialize UI
    showLoading();
    
    // Try to load from API first
    const apiProducts = await ShopAPI.getProducts();
    
    if (apiProducts && apiProducts.length > 0) {
        state.products = apiProducts.map(transformProduct);
        state.usingStaticData = false;
    } else {
        state.products = ProductAPI.getAll();
        state.usingStaticData = true;
    }
    
    state.filteredProducts = [...state.products];
    
    hideLoading();
    renderProducts();
    if (typeof CartState !== 'undefined') {
        CartState.updateCartCount();
        CartState.updateWishlistCount();
    }
    
    bindEvents();
    initLocaleSelector();
    initLegacySelectors();
    
    const urlParams = new URLSearchParams(window.location.search);
    const category = urlParams.get('category');
    if (category && CATEGORIES.find(c => c.id === category)) {
        setCategory(category);
    }
    console.log('[SHOP] Initialization complete.');
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
        const firstImage = product.images && product.images[0] ? product.images[0] : {
            src: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500"><rect fill="%23333" width="400" height="500"/><text fill="%23999" x="50%" y="50%" text-anchor="middle" font-family="sans-serif" font-size="20">No Image</text></svg>',
            alt: product.name
        };
        const secondImage = product.images && product.images[1] ? product.images[1] : null;
        
        // Robust stock calculation
        const inventory = typeof product.inventory === 'string' ? JSON.parse(product.inventory || '{}') : (product.inventory || {});
        const totalStock = Object.values(inventory).reduce((a, b) => a + (parseInt(b) || 0), 0);
        const isSoldOut = totalStock === 0;

        // DEBUG: Uncomment to see stock values in console
        // console.log(`[SHOP] Product: ${product.name}, Total Stock: ${totalStock}, isSoldOut: ${isSoldOut}`);

        // Badge priority logic: SOLD OUT always overwrites everything else
        let badgeHtml = '';
        if (isSoldOut) {
            badgeHtml = '<span class="product-badge soldout" style="background: #6b7280 !important; color: white !important;">Sold Out</span>';
        } else if (product.badge && product.badge.toLowerCase() !== 'null' && product.badge.trim() !== '') {
            badgeHtml = `<span class="product-badge ${product.badge.toLowerCase().replace(/\s+/g, '-')}">${product.badge}</span>`;
        }

        return `
        <article class="product-card reveal-up ${isSoldOut ? 'sold-out' : ''}" data-product-id="${product.id}">
            <div class="product-image-wrapper" onclick="window.openProductPage('${product.slug}')">
                ${badgeHtml}
                <img src="${firstImage.src}" alt="${firstImage.alt}" class="product-image" loading="lazy">
                ${secondImage ? `<img src="${secondImage.src}" alt="${secondImage.alt}" class="product-image-hover" loading="lazy">` : ''}
                <div class="product-actions">
                    <button class="product-btn" onclick="event.stopPropagation(); window.addToCartFromCard('${product.id}')" ${isSoldOut ? 'disabled' : ''}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M6 6h15l-1.5 9h-12z"></path>
                            <circle cx="9" cy="20" r="1"></circle>
                            <circle cx="18" cy="20" r="1"></circle>
                            <path d="M6 6L5 3H2"></path>
                        </svg>
                        ${isSoldOut ? 'Sold Out' : (typeof t === 'function' ? t('product.addToCart') : 'Add to Cart')}
                    </button>
                    <button class="product-btn" onclick="event.stopPropagation(); window.quickView('${product.id}')">${typeof t === 'function' ? t('product.quickView') : 'Quick View'}</button>
                    <button class="product-btn wishlist ${getWishlist().includes(product.id) ? 'active' : ''}" 
                            onclick="event.stopPropagation(); window.toggleWishlist('${product.id}')">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="${getWishlist().includes(product.id) ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="product-info">
                <p class="product-category">${CATEGORIES.find(c => c.id === product.category)?.name || product.category}</p>
                <h3 class="product-name" onclick="window.openProductPage('${product.slug}')">${product.name}</h3>
                <div class="product-price">
                    <span class="current-price">${CurrencyConfig.formatPrice(product.price)}</span>
                    ${product.compareAtPrice ? `<span class="original-price">${CurrencyConfig.formatPrice(product.compareAtPrice)}</span>` : ''}
                </div>
                ${product.average_rating ? `
                    <div class="product-rating">
                        <span class="star-rating-small">${renderStarRating(product.average_rating)}</span>
                        <span class="rating-text">(${product.review_count || 0})</span>
                    </div>
                ` : ''}
                ${product.colors && product.colors.length > 1 ? `
                    <div class="product-colors">
                        ${product.colors.map((color, i) => `
                            <span class="color-dot ${i === 0 ? 'active' : ''}" style="background-color: ${color.value}" title="${color.name}"></span>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        </article>
    `}).join('');
    
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
    const firstImage = product.images?.[0] || {
        src: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500"><rect fill="%23333" width="400" height="500"/><text fill="%23999" x="50%" y="50%" text-anchor="middle" font-family="sans-serif" font-size="20">No Image</text></svg>',
        alt: product.name
    };
    
    const variantKey = `${state.selectedColor}-${state.selectedSize}`;
    const stock = product.inventory?.[variantKey] || 0;

    // Adjust quantity if it exceeds stock
    if (stock > 0 && state.selectedQuantity > stock) {
        state.selectedQuantity = stock;
    } else if (stock === 0) {
        state.selectedQuantity = 1;
    }
    
    elements.quickViewContent.innerHTML = `
        <div class="quick-view-gallery">
            <img src="${firstImage.src}" alt="${firstImage.alt || product.name}" id="quickViewImage">
        </div>
        <div class="quick-view-details">
            <p class="quick-view-category">${CATEGORIES.find(c => c.id === product.category)?.name || product.category}</p>
            <h2 class="quick-view-title">${product.name}</h2>
            <div class="quick-view-price">
                <span class="current-price">${CurrencyConfig.formatPrice(product.price)}</span>
                ${product.compareAtPrice ? `<span class="original-price">${CurrencyConfig.formatPrice(product.compareAtPrice)}</span>` : ''}
            </div>
            <p class="quick-view-description">${product.description || ''}</p>
            
            <div class="quick-view-options">
                ${product.colors && product.colors.length > 1 ? `
                    <div class="option-section">
                        <span class="option-label">Color: <strong>${state.selectedColor}</strong></span>
                        <div class="color-options">
                            ${product.colors.map(color => `
                                <button class="color-option ${state.selectedColor === color.name ? 'active' : ''}" 
                                        style="background-color: ${color.value}"
                                        onclick="window.selectColor('${color.name}')"
                                        title="${color.name}"></button>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
                
                <div class="option-section">
                    <span class="option-label">
                        Size: <strong>${state.selectedSize}</strong>
                        ${product.sizeGuide ? `<span class="size-guide-link" onclick="window.openSizeGuide('${product.sizeGuide}')">Size Guide</span>` : ''}
                    </span>
                    <div class="size-options">
                        ${product.sizes?.map(size => {
                            const inStock = product.inventory?.[`${state.selectedColor}-${size}`] > 0;
                            return `
                                <button class="size-option ${state.selectedSize === size ? 'active' : ''} ${!inStock ? 'disabled' : ''}"
                                        onclick="${inStock ? `window.selectSize('${size}')` : ''}"
                                        ${!inStock ? 'disabled' : ''}>
                                    ${size}
                                </button>
                            `;
                        }).join('') || ''}
                    </div>
                </div>
            </div>
            
            <div class="quick-view-actions">
                <div class="quantity-selector">
                    <button class="qty-btn" onclick="window.updateQuantity(-1)" ${state.selectedQuantity <= 1 ? 'disabled' : ''}>−</button>
                    <span>${state.selectedQuantity}</span>
                    <button class="qty-btn" onclick="window.updateQuantity(1)" ${state.selectedQuantity >= stock ? 'disabled' : ''}>+</button>
                </div>
                <button class="add-to-cart-btn" onclick="window.addToCartFromQuickView()" ${stock <= 0 ? 'disabled' : ''}>
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
    if (!guide) return;
    elements.sizeGuideContent.innerHTML = `
        <h4>${guide.name}</h4>
        <p style="color: var(--color-text-muted); margin-bottom: 1rem;">All measurements are in ${guide.unit}</p>
        <table class="size-table">
            <thead>
                <tr><th>Size</th>${Object.keys(guide.measurements[0]).filter(k => k !== 'size').map(k => `<th>${k.charAt(0).toUpperCase() + k.slice(1)}</th>`).join('')}</tr>
            </thead>
            <tbody>
                ${guide.measurements.map(m => `<tr><td><strong>${m.size}</strong></td>${Object.entries(m).filter(([k]) => k !== 'size').map(([_, v]) => `<td>${v}</td>`).join('')}</tr>`).join('')}
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
    
    if (!state.usingStaticData) {
        const stockCheck = await ShopAPI.checkStock(product.id, color, size);
        if (!stockCheck.inStock) {
            showToast('Sorry, this item is out of stock', 'error');
            return;
        }
    } else {
        const variantKey = `${color}-${size}`;
        const stock = product.inventory?.[variantKey] || 0;
        if (stock <= 0) {
            showToast('Sorry, this item is out of stock', 'error');
            return;
        }
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
        if (elements.searchResults) elements.searchResults.innerHTML = '';
        return;
    }
    const searchTerm = query.toLowerCase();
    const results = state.products.filter(p => 
        p.name?.toLowerCase().includes(searchTerm) ||
        p.category?.toLowerCase().includes(searchTerm)
    );
    if (results.length === 0) {
        elements.searchResults.innerHTML = `<div style="text-align: center; padding: 3rem; color: var(--color-text-muted);">No products found for "${query}"</div>`;
        return;
    }
    elements.searchResults.innerHTML = results.map(product => `
        <div class="search-result-item" onclick="window.openProductPage('${product.slug}')">
            <img src="${product.images?.[0]?.src || ''}" alt="${product.name}">
            <div class="search-result-info"><h4>${product.name}</h4><p>${product.category}</p></div>
            <span class="search-result-price">${CurrencyConfig.formatPrice(product.price)}</span>
        </div>
    `).join('');
}

function showToast(message, type = 'success', action = null) {
    if (!elements.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span class="toast-message">${message}</span>`;
    elements.toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'toast-in 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

window.openProductPage = function(slug) {
    const skeleton = document.getElementById('pageSkeleton');
    if (skeleton) skeleton.style.display = 'flex';
    setTimeout(() => { window.location.href = `product.html?slug=${slug}`; }, 100);
};

function bindEvents() {
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
        SearchHelper.init(elements.searchInput, handleSearch, { delay: 300 });
    }

    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) elements.nav?.classList.add('scrolled');
        else elements.nav?.classList.remove('scrolled');
    }, { passive: true });

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

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeQuickView(); closeSearch(); closeSizeGuide(); closeFilter();
            window.closeCart(); window.closeWishlist();
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
    drop.addEventListener('click', (e) => e.stopPropagation());
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

// Overrides for CartState
window.addEventListener('componentsLoaded', () => {
    // Custom renderers for shop page
    if (typeof CartState !== 'undefined') {
        CartState.renderCart = function() {
            const cart = getCart();
            if (!elements.cartItems) return;
            if (cart.length === 0) {
                elements.cartItems.innerHTML = `<div class="cart-empty"><p data-i18n="cart.empty">Your cart is empty</p><a href="shop.html" class="btn btn-secondary" onclick="window.closeCart()" data-i18n="cart.continueShopping">Continue Shopping</a></div>`;
            } else {
                elements.cartItems.innerHTML = cart.map((item, index) => `
                    <div class="cart-item">
                        <div class="cart-item-image"><img src="${item.image}" alt="${item.name}"></div>
                        <div class="cart-item-details">
                            <h4>${item.name}</h4><p>${item.color} / ${item.size}</p>
                            <div class="cart-item-actions">
                                <div class="cart-item-qty"><button onclick="window.shopUpdateCartQty(${index}, -1)">−</button><span>${item.quantity}</span><button onclick="window.shopUpdateCartQty(${index}, 1)">+</button></div>
                                <span class="cart-item-price">${CurrencyConfig.formatPrice(item.price * item.quantity)}</span>
                            </div>
                        </div>
                        <button class="cart-item-remove" onclick="window.shopRemoveFromCart(${index})">×</button>
                    </div>
                `).join('');
            }
            const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            if (elements.cartSubtotal) elements.cartSubtotal.textContent = CurrencyConfig.formatPrice(subtotal);
        };

        CartState.renderWishlist = function() {
            const wishlist = getWishlist();
            if (!elements.wishlistItems) return;
            if (wishlist.length === 0) {
                elements.wishlistItems.innerHTML = `<div class="wishlist-empty"><p data-i18n="cart.wishlistEmpty">Your wishlist is empty</p></div>`;
                return;
            }
            const wishlistProducts = wishlist.map(id => state.products.find(p => p.id === id)).filter(p => p);
            elements.wishlistItems.innerHTML = wishlistProducts.map(product => `
                <div class="wishlist-item">
                    <div class="wishlist-item-image"><img src="${product.images?.[0]?.src || ''}" alt="${product.name}"></div>
                    <div class="wishlist-item-details">
                        <h4 onclick="window.location.href='product.html?slug=${product.slug}'">${product.name}</h4>
                        <p>${CurrencyConfig.formatPrice(product.price)}</p>
                        <div class="wishlist-item-actions">
                            <button class="btn-add-cart-sm" onclick="window.shopAddToCartFromWishlist('${product.id}')">Add to Cart</button>
                            <button class="btn-remove-sm" onclick="window.shopRemoveFromWishlist('${product.id}')">Remove</button>
                        </div>
                    </div>
                </div>
            `).join('');
        };
    }

    initShop();
});

window.shopUpdateCartQty = (index, delta) => { CartState.updateCartItemQuantity(index, delta); CartState.renderCart(); };
window.shopRemoveFromCart = (index) => { CartState.removeFromCart(index); CartState.renderCart(); };
window.shopAddToCartFromWishlist = (id) => { 
    const p = state.products.find(x => x.id === id);
    if (p) CartState.addToCart({ id: p.id, name: p.name, price: p.price, image: p.images?.[0]?.src || '', color: 'Default', size: 'OS', quantity: 1 });
};
window.shopRemoveFromWishlist = (id) => { const idx = getWishlist().indexOf(id); if (idx > -1) CartState.removeFromWishlist(idx); };

if (document.readyState === 'complete') {
    if (window.Components && document.getElementById('nav')?.innerHTML) initShop();
}
