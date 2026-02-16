/**
 * LA VAGUE - Product Detail Page JavaScript
 */

// API Client for Product Detail
const ProductDetailAPI = {
    async getProductBySlug(slug) {
        try {
            const API_URL = window.location.hostname === 'localhost' 
                ? 'http://localhost:3000/api' 
                : 'https://la-vague-api.onrender.com/api';
            const response = await fetch(`${API_URL}/products/${encodeURIComponent(slug)}`);
            if (!response.ok) throw new Error('Product not found');
            const data = await response.json();
            return data.product;
        } catch (error) {
            console.error('API error:', error);
            return null;
        }
    },
    
    async getAllProducts() {
        try {
            const API_URL = window.location.hostname === 'localhost' 
                ? 'http://localhost:3000/api' 
                : 'https://la-vague-api.onrender.com/api';
            const response = await fetch(`${API_URL}/products`);
            const data = await response.json();
            return data.products || [];
        } catch (error) {
            return [];
        }
    },
    
    async checkStock(productId, color, size) {
        try {
            const API_URL = window.location.hostname === 'localhost' 
                ? 'http://localhost:3000/api' 
                : 'https://la-vague-api.onrender.com/api';
            const response = await fetch(`${API_URL}/inventory/check/${productId}?color=${encodeURIComponent(color)}&size=${encodeURIComponent(size)}`);
            const data = await response.json();
            return data;
        } catch (error) {
            return { available: 999, inStock: true };
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
    const guides = { hoodies: 'oversized', tees: 'regular', bottoms: 'pants', accessories: 'none' };
    return guides[category] || 'regular';
}

// State
const state = {
    product: null,
    currentImageIndex: 0,
    selectedColor: null,
    selectedSize: null,
    quantity: 1,
    usingStaticData: false
};

let elements = {};

async function initProduct() {
    console.log('[PRODUCT] Initializing product page logic...');
    elements = {
        productLoading: document.getElementById('productLoading'),
        productContent: document.getElementById('productContent'),
        breadcrumbProduct: document.getElementById('breadcrumbProduct'),
        mainImage: document.getElementById('mainImage'),
        galleryThumbs: document.getElementById('galleryThumbs'),
        galleryPrev: document.getElementById('galleryPrev'),
        galleryNext: document.getElementById('galleryNext'),
        productCategory: document.getElementById('productCategory'),
        productTitle: document.getElementById('productTitle'),
        productPrice: document.getElementById('productPrice'),
        productOriginalPrice: document.getElementById('productOriginalPrice'),
        productShortDesc: document.getElementById('productShortDesc'),
        productDescription: document.getElementById('productDescription'),
        productFeatures: document.getElementById('productFeatures'),
        selectedColor: document.getElementById('selectedColor'),
        selectedSize: document.getElementById('selectedSize'),
        colorSelector: document.getElementById('colorSelector'),
        sizeSelector: document.getElementById('sizeSelector'),
        sizeGroup: document.getElementById('sizeGroup'),
        qtyMinus: document.getElementById('qtyMinus'),
        qtyPlus: document.getElementById('qtyPlus'),
        quantity: document.getElementById('quantity'),
        addToCartBtn: document.getElementById('addToCartBtn'),
        wishlistToggleBtn: document.getElementById('wishlistToggleBtn'),
        productActions: document.querySelector('.product-actions'),
        sizeGuideBtn: document.getElementById('sizeGuideBtn'),
        relatedGrid: document.getElementById('relatedGrid'),
        stockStatus: document.getElementById('stockStatus'),
        nav: document.getElementById('nav'),
        mobileMenuBtn: document.getElementById('mobileMenuBtn'),
        navLinks: document.getElementById('navLinks'),
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
        toastContainer: document.getElementById('toastContainer')
    };

    const urlParams = new URLSearchParams(window.location.search);
    const slug = urlParams.get('slug');
    if (!slug) { window.location.href = 'shop.html'; return; }

    const dbProduct = await ProductDetailAPI.getProductBySlug(slug);
    if (dbProduct) {
        state.product = transformProduct(dbProduct);
        state.usingStaticData = false;
    } else {
        const staticProduct = ProductAPI.getBySlug(slug);
        if (staticProduct) { state.product = staticProduct; state.usingStaticData = true; }
        else { window.location.href = 'shop.html'; return; }
    }

    state.selectedColor = state.product.colors[0]?.name || 'Default';
    state.selectedSize = state.product.sizes[0] === 'OS' ? 'OS' : null;

    renderProduct();
    renderGallery();
    renderRelatedProducts();
    if (typeof CartState !== 'undefined') {
        CartState.updateCartCount();
        CartState.updateWishlistCount();
    }
    
    bindEvents();
    initLocaleSelector();
    initLegacySelectors();
    
    elements.productLoading.style.display = 'none';
    elements.productContent.style.display = 'block';
    console.log('[PRODUCT] Initialization complete.');
}

function renderProduct() {
    const p = state.product;
    elements.productCategory.textContent = CATEGORIES.find(c => c.id === p.category)?.name || p.category;
    elements.productTitle.textContent = p.name;
    elements.productPrice.textContent = CurrencyConfig.formatPrice(p.price);
    elements.productOriginalPrice.textContent = p.compareAtPrice ? CurrencyConfig.formatPrice(p.compareAtPrice) : '';
    elements.productShortDesc.textContent = p.description;
    elements.productDescription.textContent = p.description;
    elements.productFeatures.innerHTML = p.features.map(f => `<li>${f}</li>`).join('');
    
    if (p.colors.length > 1) {
        elements.colorSelector.innerHTML = p.colors.map(color => `
            <button class="color-btn ${state.selectedColor === color.name ? 'active' : ''}" 
                    style="background-color: ${color.value}"
                    onclick="window.selectColor('${color.name}')"
                    title="${color.name}"></button>
        `).join('');
    } else {
        elements.colorSelector.parentElement.style.display = 'none';
    }
    renderSizes();
}

function renderSizes() {
    const p = state.product;
    if (p.sizes.length === 1 && p.sizes[0] === 'OS') {
        elements.sizeGroup.style.display = 'none';
        updateStockStatus();
        return;
    }
    elements.sizeSelector.innerHTML = p.sizes.map(size => {
        const inStock = p.inventory[`${state.selectedColor}-${size}`] > 0;
        return `<button class="size-btn ${state.selectedSize === size ? 'active' : ''} ${!inStock ? 'disabled' : ''}"
                onclick="${inStock ? `window.selectSize('${size}')` : ''}" ${!inStock ? 'disabled' : ''}>${size}</button>`;
    }).join('');
    elements.selectedSize.textContent = state.selectedSize || 'Select';
    updateStockStatus();
}

function updateStockStatus() {
    if (!elements.stockStatus) return;
    const p = state.product;
    const size = (p.sizes.length === 1 && p.sizes[0] === 'OS') ? 'OS' : state.selectedSize;
    const variantKey = `${state.selectedColor}-${size}`;
    const stock = p.inventory[variantKey] || 0;
    if (!state.selectedSize && !(p.sizes.length === 1 && p.sizes[0] === 'OS')) {
        elements.stockStatus.innerHTML = '';
        elements.addToCartBtn.disabled = true;
        return;
    }
    if (stock <= 0) {
        elements.stockStatus.innerHTML = `<span class="stock-out"><span class="stock-dot"></span> Out of Stock</span>`;
        elements.addToCartBtn.disabled = true;
    } else if (stock <= 5) {
        elements.stockStatus.innerHTML = `<span class="stock-low"><span class="stock-dot"></span> Low Stock: Only ${stock} left</span>`;
        elements.addToCartBtn.disabled = false;
    } else {
        elements.stockStatus.innerHTML = `<span class="stock-in"><span class="stock-dot"></span> In Stock</span>`;
        elements.addToCartBtn.disabled = false;
    }
}

function renderGallery() {
    const images = state.product.images || [];
    if (images.length === 0) return;
    const currentImage = images[state.currentImageIndex] || images[0];
    elements.mainImage.src = currentImage.src;
    elements.galleryThumbs.innerHTML = images.map((img, i) => `
        <img src="${img.src}" class="gallery-thumb ${i === state.currentImageIndex ? 'active' : ''}" onclick="window.setImage(${i})">
    `).join('');
}

async function renderRelatedProducts() {
    const all = await ProductDetailAPI.getAllProducts();
    const related = all.filter(p => p.category === state.product.category && p.id !== state.product.id).slice(0, 4);
    if (!elements.relatedGrid) return;
    elements.relatedGrid.innerHTML = related.map(p => `
        <article class="product-card" onclick="window.location.href='product.html?slug=${p.slug}'">
            <img src="${p.images[0]?.src || ''}" alt="${p.name}">
            <div class="product-info"><h3>${p.name}</h3><p>${CurrencyConfig.formatPrice(p.price)}</p></div>
        </article>
    `).join('');
}

window.selectColor = (name) => { state.selectedColor = name; renderProduct(); };
window.selectSize = (size) => { state.selectedSize = size; renderSizes(); };
window.setImage = (idx) => { state.currentImageIndex = idx; renderGallery(); };

function bindEvents() {
    elements.qtyMinus?.addEventListener('click', () => { if (state.quantity > 1) { state.quantity--; elements.quantity.textContent = state.quantity; }});
    elements.qtyPlus?.addEventListener('click', () => { state.quantity++; elements.quantity.textContent = state.quantity; });
    elements.addToCartBtn?.addEventListener('click', () => {
        CartState.addToCart({
            id: state.product.id, name: state.product.name, price: state.product.price,
            image: state.product.images[0].src, color: state.selectedColor,
            size: state.selectedSize || 'OS', quantity: state.quantity
        });
    });
    elements.wishlistToggleBtn?.addEventListener('click', () => {
        const active = CartState.addToWishlist(state.product.id);
        elements.wishlistToggleBtn.classList.toggle('active', active);
    });
    
    // UI Event listeners
    elements.mobileMenuBtn?.addEventListener('click', () => {
        elements.mobileMenuBtn.classList.toggle('active');
        elements.navLinks?.classList.toggle('active');
    });
    elements.cartBtn?.addEventListener('click', window.openCart);
    elements.cartClose?.addEventListener('click', window.closeCart);
    elements.cartOverlay?.addEventListener('click', window.closeCart);
}

function initLocaleSelector() {
    const btn = document.getElementById('localeBtn'), drop = document.getElementById('localeDropdown');
    if (!btn || !drop) return;
    const curr = CurrencyConfig.getCurrentCurrency(), lang = localStorage.getItem('preferredLanguage') || 'en';
    btn.addEventListener('click', (e) => { e.stopPropagation(); drop.classList.toggle('active'); });
    document.addEventListener('click', () => drop.classList.remove('active'));
}

function initLegacySelectors() {
    if (typeof applyTranslations === 'function') applyTranslations();
}

window.addEventListener('componentsLoaded', initProduct);
if (document.readyState === 'complete' && window.Components && document.getElementById('nav')?.innerHTML) initProduct();
