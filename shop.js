/**
 * LA VAGUE - Shop Page JavaScript
 * Complete e-commerce functionality
 */

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

document.addEventListener('DOMContentLoaded', () => {
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
            maxPrice: 200
        },
        quickViewProduct: null,
        selectedColor: null,
        selectedSize: null,
        selectedQuantity: 1,
        usingStaticData: false
    };
    
    // Use shared CartState for cart and wishlist
    const getCart = () => typeof CartState !== 'undefined' ? CartState.cart : [];
    const getWishlist = () => typeof CartState !== 'undefined' ? CartState.wishlist : [];

    // ==========================================
    // DOM ELEMENTS
    // ==========================================
    const elements = {
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

    // ==========================================
    // INITIALIZATION
    // ==========================================
    async function init() {
        // Initialize UI
        showLoading();
        
        // Try to load from API first
        const apiProducts = await ShopAPI.getProducts();
        
        if (apiProducts && apiProducts.length > 0) {
            // Use API data (from admin/database)
            state.products = apiProducts.map(transformProduct);
            state.usingStaticData = false;
        } else {
            // Fallback to static data (for demo/offline)
            state.products = ProductAPI.getAll();
            state.usingStaticData = true;
        }
        
        state.filteredProducts = [...state.products];
        
        // Initialize UI
        hideLoading();
        renderProducts();
        CartState.updateCartCount();
        CartState.updateWishlistCount();
        
        // Bind events
        bindEvents();
        
        // Check URL params for category
        const urlParams = new URLSearchParams(window.location.search);
        const category = urlParams.get('category');
        if (category && CATEGORIES.find(c => c.id === category)) {
            setCategory(category);
        }
    }

    // ==========================================
    // PRODUCT RENDERING
    // ==========================================
    function renderProducts() {
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
            // Safely get first image with fallback
            const firstImage = product.images && product.images[0] ? product.images[0] : {
                src: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500"><rect fill="%23333" width="400" height="500"/><text fill="%23999" x="50%" y="50%" text-anchor="middle" font-family="sans-serif" font-size="20">No Image</text></svg>',
                alt: product.name
            };
            const secondImage = product.images && product.images[1] ? product.images[1] : null;
            
            return `
            <article class="product-card reveal-up" data-product-id="${product.id}">
                <div class="product-image-wrapper" onclick="window.openProductPage('${product.slug}')">
                    ${product.badge ? `<span class="product-badge ${product.badge.toLowerCase()}">${product.badge}</span>` : ''}
                    <img src="${firstImage.src}" alt="${firstImage.alt}" class="product-image" loading="lazy">
                    ${secondImage ? `<img src="${secondImage.src}" alt="${secondImage.alt}" class="product-image-hover" loading="lazy">` : ''}
                    <div class="product-actions">
                        <button class="product-btn" onclick="event.stopPropagation(); window.addToCartFromCard('${product.id}')">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M6 6h15l-1.5 9h-12z"></path>
                                <circle cx="9" cy="20" r="1"></circle>
                                <circle cx="18" cy="20" r="1"></circle>
                                <path d="M6 6L5 3H2"></path>
                            </svg>
                            Add to Cart
                        </button>
                        <button class="product-btn" onclick="event.stopPropagation(); window.quickView('${product.id}')">Quick View</button>
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
                        <span class="current-price">$${product.price}</span>
                        ${product.compareAtPrice ? `<span class="original-price">$${product.compareAtPrice}</span>` : ''}
                    </div>
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
        
        // Re-initialize reveal animations
        initRevealAnimations();
    }

    function showLoading() {
        elements.loadingState.classList.add('active');
        elements.productsGrid.style.display = 'none';
        elements.emptyState.style.display = 'none';
    }

    function hideLoading() {
        elements.loadingState.classList.remove('active');
    }

    // ==========================================
    // FILTERING & SORTING
    // ==========================================
    function filterProducts() {
        let filtered = [...state.products];
        
        // Category filter
        if (state.currentCategory !== 'all') {
            filtered = filtered.filter(p => p.category === state.currentCategory);
        }
        
        // Tag filters
        if (state.filters.sale) {
            filtered = filtered.filter(p => p.compareAtPrice !== null);
        }
        if (state.filters.new) {
            filtered = filtered.filter(p => p.tags.includes('new'));
        }
        if (state.filters.bestseller) {
            filtered = filtered.filter(p => p.tags.includes('bestseller'));
        }
        
        // Price filter
        filtered = filtered.filter(p => p.price <= state.filters.maxPrice);
        
        // Sort
        switch (state.sortBy) {
            case 'price-low':
                filtered.sort((a, b) => a.price - b.price);
                break;
            case 'price-high':
                filtered.sort((a, b) => b.price - a.price);
                break;
            case 'name':
                filtered.sort((a, b) => a.name.localeCompare(b.name));
                break;
            case 'newest':
                filtered.sort((a, b) => (b.tags.includes('new') ? 1 : 0) - (a.tags.includes('new') ? 1 : 0));
                break;
            default:
                // Featured - keep default order
                break;
        }
        
        state.filteredProducts = filtered;
        renderProducts();
    }

    function setCategory(category) {
        state.currentCategory = category;
        
        // Update UI
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
        const product = ProductAPI.getById(productId);
        if (!product) return;
        
        state.quickViewProduct = product;
        state.selectedColor = product.colors[0].name;
        state.selectedSize = product.sizes[0];
        state.selectedQuantity = 1;
        
        renderQuickView();
        openQuickView();
    };

    function renderQuickView() {
        const product = state.quickViewProduct;
        
        elements.quickViewContent.innerHTML = `
            <div class="quick-view-gallery">
                <img src="${product.images[0].src}" alt="${product.images[0].alt}" id="quickViewImage">
            </div>
            <div class="quick-view-details">
                <p class="quick-view-category">${CATEGORIES.find(c => c.id === product.category)?.name}</p>
                <h2 class="quick-view-title">${product.name}</h2>
                <div class="quick-view-price">
                    <span class="current-price">$${product.price}</span>
                    ${product.compareAtPrice ? `<span class="original-price">$${product.compareAtPrice}</span>` : ''}
                </div>
                <p class="quick-view-description">${product.description}</p>
                
                <div class="quick-view-options">
                    ${product.colors.length > 1 ? `
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
                            ${product.sizes.map(size => {
                                const inStock = product.inventory[`${state.selectedColor}-${size}`] > 0;
                                return `
                                    <button class="size-option ${state.selectedSize === size ? 'active' : ''} ${!inStock ? 'disabled' : ''}"
                                            onclick="${inStock ? `window.selectSize('${size}')` : ''}"
                                            ${!inStock ? 'disabled' : ''}>
                                        ${size}
                                    </button>
                                `;
                            }).join('')}
                        </div>
                    </div>
                </div>
                
                <div class="quick-view-actions">
                    <div class="quantity-selector">
                        <button class="qty-btn" onclick="window.updateQuantity(-1)" ${state.selectedQuantity <= 1 ? 'disabled' : ''}>−</button>
                        <span>${state.selectedQuantity}</span>
                        <button class="qty-btn" onclick="window.updateQuantity(1)">+</button>
                    </div>
                    <button class="add-to-cart-btn" onclick="window.addToCartFromQuickView()">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M6 6h15l-1.5 9h-12z"></path>
                            <circle cx="9" cy="20" r="1"></circle>
                            <circle cx="18" cy="20" r="1"></circle>
                            <path d="M6 6L5 3H2"></path>
                        </svg>
                        Add to Cart
                    </button>
                </div>
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
        state.selectedQuantity = Math.max(1, state.selectedQuantity + delta);
        renderQuickView();
    };

    window.addToCartFromQuickView = async function() {
        const product = state.quickViewProduct;
        
        // Check inventory if using API
        if (!state.usingStaticData) {
            const stockCheck = await ShopAPI.checkStock(product.id, state.selectedColor, state.selectedSize);
            if (!stockCheck.inStock || stockCheck.available < state.selectedQuantity) {
                showToast(`Only ${stockCheck.available} items available in this variant`, 'error');
                return;
            }
        }
        
        addToCart({
            id: product.id,
            name: product.name,
            price: product.price,
            image: product.images[0].src,
            color: state.selectedColor,
            size: state.selectedSize,
            quantity: state.selectedQuantity
        });
        closeQuickView();
    };

    function openQuickView() {
        elements.quickViewModal.classList.add('active');
        elements.quickViewOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeQuickView() {
        elements.quickViewModal.classList.remove('active');
        elements.quickViewOverlay.classList.remove('active');
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
                    <tr>
                        <th>Size</th>
                        ${Object.keys(guide.measurements[0]).filter(k => k !== 'size').map(k => `<th>${k.charAt(0).toUpperCase() + k.slice(1)}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${guide.measurements.map(m => `
                        <tr>
                            <td><strong>${m.size}</strong></td>
                            ${Object.entries(m).filter(([k]) => k !== 'size').map(([_, v]) => `<td>${v}</td>`).join('')}
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            <div class="size-note">
                <strong>Note:</strong> Measurements may vary slightly. For the best fit, measure a similar garment you own and compare.
            </div>
        `;
        
        elements.sizeGuideModal.classList.add('active');
        elements.sizeGuideOverlay.classList.add('active');
    };

    function closeSizeGuide() {
        elements.sizeGuideModal.classList.remove('active');
        elements.sizeGuideOverlay.classList.remove('active');
    }

    // ==========================================
    // CART & WISHLIST HELPERS
    // ==========================================
    
    window.addToCartFromCard = async function(productId) {
        // Find product in state (from API or static)
        const product = state.products.find(p => p.id === productId);
        if (!product) return;
        
        const color = product.colors[0]?.name || 'Default';
        const size = product.sizes[0];
        
        // Check inventory if using API
        if (!state.usingStaticData) {
            const stockCheck = await ShopAPI.checkStock(product.id, color, size);
            if (!stockCheck.inStock) {
                showToast('Sorry, this item is out of stock', 'error');
                return;
            }
        }
        
        const item = {
            id: product.id,
            name: product.name,
            price: product.price,
            image: product.images[0]?.src || '',
            color: color,
            size: size,
            quantity: 1
        };
        
        CartState.addToCart(item);
    };
    
    window.toggleWishlist = function(productId) {
        CartState.addToWishlist(productId);
        renderProducts(); // Re-render to update heart icons
    };

    // ==========================================
    // SEARCH
    // ==========================================
    function openSearch() {
        elements.searchOverlay.classList.add('active');
        elements.searchInput.focus();
        document.body.style.overflow = 'hidden';
    }

    function closeSearch() {
        elements.searchOverlay.classList.remove('active');
        elements.searchInput.value = '';
        elements.searchResults.innerHTML = '';
        document.body.style.overflow = '';
    }

    function handleSearch(query) {
        if (!query.trim()) {
            elements.searchResults.innerHTML = '';
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
            <div class="search-result-item" onclick="window.openProductPage('${product.slug}')">
                <img src="${product.images[0].src}" alt="${product.name}">
                <div class="search-result-info">
                    <h4>${product.name}</h4>
                    <p>${CATEGORIES.find(c => c.id === product.category)?.name}</p>
                </div>
                <span class="search-result-price">$${product.price}</span>
            </div>
        `).join('');
    }

    // ==========================================
    // TOAST NOTIFICATIONS
    // ==========================================
    function showToast(message, type = 'success', action = null) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <span class="toast-message">${message}</span>
            ${action ? `<span class="toast-action">${action}</span>` : ''}
        `;
        
        elements.toastContainer.appendChild(toast);
        
        if (action) {
            toast.querySelector('.toast-action').addEventListener('click', () => {
                // Could open cart sidebar here
                toast.remove();
            });
        }
        
        setTimeout(() => {
            toast.style.animation = 'toast-in 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    // ==========================================
    // NAVIGATION
    // ==========================================
    window.openProductPage = function(slug) {
        window.location.href = `product.html?slug=${slug}`;
    };

    function bindEvents() {
        // Category filters
        elements.categoryFilters?.addEventListener('click', (e) => {
            if (e.target.classList.contains('filter-btn')) {
                setCategory(e.target.dataset.category);
            }
        });
        
        // Mobile category filters
        elements.mobileCategoryFilters?.addEventListener('change', (e) => {
            if (e.target.name === 'mobile-category') {
                setCategory(e.target.value);
            }
        });
        
        // Sort
        elements.sortSelect?.addEventListener('change', (e) => {
            setSort(e.target.value);
        });
        
        // Filter sidebar
        elements.filterToggle?.addEventListener('click', () => {
            elements.filterSidebar.classList.add('active');
            elements.filterOverlay.classList.add('active');
        });
        
        elements.filterClose?.addEventListener('click', closeFilterSidebar);
        elements.filterOverlay?.addEventListener('click', closeFilterSidebar);
        
        function closeFilterSidebar() {
            elements.filterSidebar.classList.remove('active');
            elements.filterOverlay.classList.remove('active');
        }
        
        // Price range
        elements.priceRange?.addEventListener('input', (e) => {
            elements.priceValue.textContent = `$${e.target.value}`;
        });
        
        // Apply filters
        elements.applyFilters?.addEventListener('click', () => {
            state.filters.sale = document.getElementById('filterSale')?.checked || false;
            state.filters.new = document.getElementById('filterNew')?.checked || false;
            state.filters.bestseller = document.getElementById('filterBestseller')?.checked || false;
            state.filters.maxPrice = parseInt(elements.priceRange?.value || 200);
            
            filterProducts();
            closeFilterSidebar();
        });
        
        // Clear filters
        elements.clearFilters?.addEventListener('click', () => {
            document.getElementById('filterSale').checked = false;
            document.getElementById('filterNew').checked = false;
            document.getElementById('filterBestseller').checked = false;
            elements.priceRange.value = 200;
            elements.priceValue.textContent = '$200';
        });
        
        elements.clearAllFilters?.addEventListener('click', () => {
            state.currentCategory = 'all';
            state.filters = { sale: false, new: false, bestseller: false, maxPrice: 200 };
            state.sortBy = 'featured';
            
            document.querySelectorAll('.filter-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.category === 'all');
            });
            elements.sortSelect.value = 'featured';
            
            filterProducts();
        });
        
        // Quick view
        elements.quickViewClose?.addEventListener('click', closeQuickView);
        elements.quickViewOverlay?.addEventListener('click', closeQuickView);
        
        // Size guide
        elements.sizeGuideClose?.addEventListener('click', closeSizeGuide);
        elements.sizeGuideOverlay?.addEventListener('click', closeSizeGuide);
        
        // Search
        elements.searchBtn?.addEventListener('click', openSearch);
        elements.searchClose?.addEventListener('click', closeSearch);
        
        let searchTimeout;
        elements.searchInput?.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => handleSearch(e.target.value), 300);
        });
        
        // Navigation scroll effect
        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) {
                elements.nav?.classList.add('scrolled');
            } else {
                elements.nav?.classList.remove('scrolled');
            }
        }, { passive: true });
        
        // Mobile menu
        elements.mobileMenuBtn?.addEventListener('click', () => {
            elements.mobileMenuBtn.classList.toggle('active');
            elements.navLinks?.classList.toggle('active');
        });
        
        // Cart - use CartState functions
        elements.cartBtn?.addEventListener('click', window.openCart);
        elements.cartClose?.addEventListener('click', window.closeCart);
        elements.cartOverlay?.addEventListener('click', window.closeCart);
        
        // Wishlist - use CartState functions
        elements.wishlistBtn?.addEventListener('click', window.openWishlist);
        elements.wishlistClose?.addEventListener('click', window.closeWishlist);
        elements.wishlistOverlay?.addEventListener('click', window.closeWishlist);
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeQuickView();
                closeSearch();
                closeSizeGuide();
                closeFilterSidebar();
            }
            
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                openSearch();
            }
        });
    }

    // ==========================================
    // REVEAL ANIMATIONS
    // ==========================================
    function initRevealAnimations() {
        const revealElements = document.querySelectorAll('.reveal-up:not(.visible)');
        
        const revealObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    revealObserver.unobserve(entry.target);
                }
            });
        }, {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        });
        
        revealElements.forEach(el => revealObserver.observe(el));
    }

    // ==========================================
    // CART & WISHLIST (Using CartState)
    // ==========================================
    
    // Override CartState render functions for this page's UI
    const originalRenderCart = CartState.renderCart;
    CartState.renderCart = function() {
        const cart = getCart();
        if (cart.length === 0) {
            elements.cartItems.innerHTML = `
                <div class="cart-empty">
                    <p>Your cart is empty</p>
                    <a href="shop.html" class="btn btn-secondary" onclick="window.closeCart()">Continue Shopping</a>
                </div>
            `;
        } else {
            elements.cartItems.innerHTML = cart.map((item, index) => `
                <div class="cart-item">
                    <div class="cart-item-image">
                        <img src="${item.image}" alt="${item.name}">
                    </div>
                    <div class="cart-item-details">
                        <h4>${item.name}</h4>
                        <p class="cart-item-variant">${item.color} / ${item.size}</p>
                        <div class="cart-item-actions">
                            <div class="cart-item-qty">
                                <button onclick="window.shopUpdateCartQty(${index}, -1)">−</button>
                                <span>${item.quantity}</span>
                                <button onclick="window.shopUpdateCartQty(${index}, 1)">+</button>
                            </div>
                            <span class="cart-item-price">$${item.price * item.quantity}</span>
                        </div>
                    </div>
                    <button class="cart-item-remove" onclick="window.shopRemoveFromCart(${index})">×</button>
                </div>
            `).join('');
        }
        const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        elements.cartSubtotal.textContent = `$${subtotal}`;
    };
    
    window.shopUpdateCartQty = function(index, delta) {
        CartState.updateCartItemQuantity(index, delta);
        CartState.renderCart();
    };
    
    window.shopRemoveFromCart = function(index) {
        CartState.removeFromCart(index);
        showToast('Item removed from cart', 'success');
    };
    
    // Override wishlist render for this page
    const originalRenderWishlist = CartState.renderWishlist;
    CartState.renderWishlist = function() {
        const wishlist = getWishlist();
        if (wishlist.length === 0) {
            elements.wishlistItems.innerHTML = `
                <div class="wishlist-empty">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                    </svg>
                    <p>Your wishlist is empty</p>
                    <a href="shop.html" class="btn btn-secondary" onclick="window.closeWishlist()">Start Shopping</a>
                </div>
            `;
            return;
        }
        const wishlistProducts = wishlist.map(id => ProductAPI.getById(id)).filter(p => p);
        elements.wishlistItems.innerHTML = wishlistProducts.map(product => `
            <div class="wishlist-item">
                <div class="wishlist-item-image">
                    <img src="${product.images[0].src}" alt="${product.name}">
                </div>
                <div class="wishlist-item-details">
                    <h4 onclick="window.location.href='product.html?slug=${product.slug}'">${product.name}</h4>
                    <p class="wishlist-item-price">$${product.price}</p>
                    <div class="wishlist-item-actions">
                        <button class="btn-add-cart-sm" onclick="window.shopAddToCartFromWishlist('${product.id}')">Add to Cart</button>
                        <button class="btn-remove-sm" onclick="window.shopRemoveFromWishlist('${product.id}')">Remove</button>
                    </div>
                </div>
            </div>
        `).join('');
    };
    
    window.shopAddToCartFromWishlist = function(productId) {
        const product = ProductAPI.getById(productId);
        if (!product) return;
        const item = {
            id: product.id,
            name: product.name,
            price: product.price,
            image: product.images[0].src,
            color: product.colors[0]?.name || 'One Size',
            size: product.sizes[0],
            quantity: 1
        };
        CartState.addToCart(item);
        showToast(`${product.name} added to cart`, 'success');
    };
    
    window.shopRemoveFromWishlist = function(productId) {
        const index = getWishlist().indexOf(productId);
        if (index > -1) {
            CartState.removeFromWishlist(index);
            showToast('Removed from wishlist', 'success');
        }
    };

    // Start
    init();
});
