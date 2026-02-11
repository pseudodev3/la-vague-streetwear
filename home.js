/**
 * LA VAGUE - Homepage JavaScript
 */

document.addEventListener('DOMContentLoaded', () => {
    // ==========================================
    // STATE
    // ==========================================
    const state = {
        cart: JSON.parse(localStorage.getItem('cart')) || [],
        wishlist: JSON.parse(localStorage.getItem('wishlist')) || [],
        currentLook: 0,
        lookbookImages: [
            { src: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=1200&q=80', title: 'Urban Nights', number: '01' },
            { src: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=600&q=80', title: 'Daylight', number: '02' },
            { src: 'https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?w=600&q=80', title: 'Skate Park', number: '03' },
            { src: 'https://images.unsplash.com/photo-1492447273231-0f8fecec1e3a?w=600&q=80', title: 'Downtown', number: '04' },
            { src: 'https://images.unsplash.com/photo-1520975661595-6453be3f7070?w=1200&q=80', title: 'After Hours', number: '05' }
        ]
    };

    // ==========================================
    // DOM ELEMENTS
    // ==========================================
    const elements = {
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

    // ==========================================
    // INITIALIZATION
    // ==========================================
    function init() {
        renderFeaturedProducts();
        
        // Sync with shared CartState if available
        if (typeof CartState !== 'undefined') {
            state.cart = CartState.cart;
            state.wishlist = CartState.wishlist;
        }
        
        updateCartCount();
        updateWishlistCount();
        bindEvents();
        initRevealAnimations();
    }

    // ==========================================
    // FEATURED PRODUCTS
    // ==========================================
    function renderFeaturedProducts() {
        const featured = ProductAPI.getFeatured().slice(0, 4);
        
        elements.featuredProducts.innerHTML = featured.map(product => `
            <article class="product-card reveal-up" onclick="window.location.href='product.html?slug=${product.slug}'">
                <div class="product-image-wrapper">
                    ${product.badge ? `<span class="product-badge ${product.badge.toLowerCase()}">${product.badge}</span>` : ''}
                    <img src="${product.images[0].src}" alt="${product.images[0].alt}" class="product-image" loading="lazy">
                    ${product.images[1] ? `<img src="${product.images[1].src}" alt="${product.images[1].alt}" class="product-image-hover" loading="lazy">` : ''}
                </div>
                <div class="product-info">
                    <p class="product-category">${CATEGORIES.find(c => c.id === product.category)?.name}</p>
                    <h3 class="product-name">${product.name}</h3>
                    <div class="product-price">
                        <span class="current-price">$${product.price}</span>
                        ${product.compareAtPrice ? `<span class="original-price">$${product.compareAtPrice}</span>` : ''}
                    </div>
                </div>
            </article>
        `).join('');
    }

    // ==========================================
    // CART (delegated to cart.js)
    // ==========================================
    // cart.js handles all cart functionality globally
    // These functions are kept for backwards compatibility
    
    function updateCartCount() {
        // Use CartState if available, otherwise fallback to local
        if (typeof CartState !== 'undefined') {
            const count = CartState.cart.reduce((sum, item) => sum + item.quantity, 0);
            elements.cartCount.textContent = count;
            elements.cartCount.style.display = count > 0 ? 'flex' : 'none';
        } else {
            const count = state.cart.reduce((sum, item) => sum + item.quantity, 0);
            elements.cartCount.textContent = count;
            elements.cartCount.style.display = count > 0 ? 'flex' : 'none';
        }
    }

    // ==========================================
    // WISHLIST (delegated to cart.js)
    // ==========================================
    // cart.js handles all wishlist functionality globally
    
    function updateWishlistCount() {
        // Use CartState if available
        if (typeof CartState !== 'undefined') {
            const count = CartState.wishlist.length;
            elements.wishlistCount.textContent = count;
            elements.wishlistCount.classList.toggle('active', count > 0);
        } else {
            const count = state.wishlist.length;
            elements.wishlistCount.textContent = count;
            elements.wishlistCount.classList.toggle('active', count > 0);
        }
    }

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
            <div class="search-result-item" onclick="window.location.href='product.html?slug=${product.slug}'">
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
    // LIGHTBOX
    // ==========================================
    function openLightbox(index) {
        state.currentLook = index;
        updateLightbox();
        elements.lightbox.classList.add('active');
        elements.lightboxOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeLightbox() {
        elements.lightbox.classList.remove('active');
        elements.lightboxOverlay.classList.remove('active');
        document.body.style.overflow = '';
    }

    function updateLightbox() {
        const look = state.lookbookImages[state.currentLook];
        elements.lightboxImage.src = look.src;
        elements.lightboxImage.alt = look.title;
        elements.lightboxNumber.textContent = look.number;
        elements.lightboxTitle.textContent = look.title;
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
    // REVEAL ANIMATIONS
    // ==========================================
    function initRevealAnimations() {
        const revealElements = document.querySelectorAll('.reveal-up, .reveal-scale, .reveal-left, .reveal-right');
        
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
    // EVENTS
    // ==========================================
    function bindEvents() {
        // Navigation
        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) {
                elements.nav.classList.add('scrolled');
            } else {
                elements.nav.classList.remove('scrolled');
            }
        }, { passive: true });
        
        elements.mobileMenuBtn?.addEventListener('click', () => {
            elements.mobileMenuBtn.classList.toggle('active');
            elements.navLinks?.classList.toggle('active');
        });
        
        // Cart - use global functions from cart.js (loaded before home.js)
        elements.cartBtn?.addEventListener('click', () => window.openCart && window.openCart());
        elements.cartClose?.addEventListener('click', () => window.closeCart && window.closeCart());
        elements.cartOverlay?.addEventListener('click', () => window.closeCart && window.closeCart());
        
        // Wishlist - use global functions from cart.js
        elements.wishlistBtn?.addEventListener('click', () => window.openWishlist && window.openWishlist());
        elements.wishlistClose?.addEventListener('click', () => window.closeWishlist && window.closeWishlist());
        elements.wishlistOverlay?.addEventListener('click', () => window.closeWishlist && window.closeWishlist());
        
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
            
            if (elements.lightbox.classList.contains('active')) {
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

    // Start
    init();
});
