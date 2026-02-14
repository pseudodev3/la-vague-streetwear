/**
 * LA VAGUE - Shared Page JavaScript (FAQ, Shipping, Contact, etc.)
 */

document.addEventListener('DOMContentLoaded', () => {
    // ==========================================
    // STATE
    // ==========================================
    const state = {
        cart: JSON.parse(localStorage.getItem('cart')) || []
    };

    // ==========================================
    // DOM ELEMENTS
    // ==========================================
    const elements = {
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

    // ==========================================
    // INITIALIZATION
    // ==========================================
    function init() {
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
        
        // Listen for currency changes
        window.addEventListener('currencyChanged', () => {
            renderCart();
        });
        
        // Listen for storage changes from other pages
        window.addEventListener('storage', (e) => {
            if (e.key === 'cart') {
                state.cart = JSON.parse(e.newValue) || [];
                updateCartCount();
                renderCart();
            }
            if (e.key === 'wishlist') {
                updateWishlistCount();
            }
        });
    }

    // ==========================================
    // CART
    // ==========================================
    function renderCart() {
        if (state.cart.length === 0) {
            elements.cartItems.innerHTML = `
                <div class="cart-empty">
                    <p>Your cart is empty</p>
                    <a href="shop.html" class="btn btn-secondary" onclick="window.closeCart()">Continue Shopping</a>
                </div>
            `;
            return;
        }
        
        elements.cartItems.innerHTML = state.cart.map((item, index) => `
            <div class="cart-item">
                <div class="cart-item-image">
                    <img src="${item.image}" alt="${item.name}">
                </div>
                <div class="cart-item-details">
                    <h4>${item.name}</h4>
                    <p class="cart-item-variant">${item.color} / ${item.size}</p>
                    <div class="cart-item-actions">
                        <div class="cart-item-qty">
                            <button onclick="window.updateCartQty(${index}, -1)">−</button>
                            <span>${item.quantity}</span>
                            <button onclick="window.updateCartQty(${index}, 1)">+</button>
                        </div>
                        <span class="cart-item-price">${CurrencyConfig.formatPrice(item.price * item.quantity)}</span>
                    </div>
                </div>
                <button class="cart-item-remove" onclick="window.removeFromCart(${index})">×</button>
            </div>
        `).join('');
        
        const subtotal = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        elements.cartSubtotal.textContent = CurrencyConfig.formatPrice(subtotal);
    }

    function openCart() {
        renderCart();
        elements.cartSidebar.classList.add('active');
        elements.cartOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    window.closeCart = function() {
        elements.cartSidebar.classList.remove('active');
        elements.cartOverlay.classList.remove('active');
        document.body.style.overflow = '';
    };

    window.updateCartQty = function(index, delta) {
        const item = state.cart[index];
        const newQty = item.quantity + delta;
        
        if (newQty < 1) {
            state.cart.splice(index, 1);
        } else {
            item.quantity = newQty;
        }
        
        saveCart();
        renderCart();
        updateCartCount();
    };

    window.removeFromCart = function(index) {
        state.cart.splice(index, 1);
        saveCart();
        renderCart();
        updateCartCount();
        showToast('Item removed from cart', 'success');
    };

    function saveCart() {
        localStorage.setItem('cart', JSON.stringify(state.cart));
    }

    function updateCartCount() {
        const count = state.cart.reduce((sum, item) => sum + item.quantity, 0);
        elements.cartCount.textContent = count;
        elements.cartCount.style.display = count > 0 ? 'flex' : 'none';
    }
    
    function updateWishlistCount() {
        const wishlist = JSON.parse(localStorage.getItem('wishlist')) || [];
        const count = wishlist.length;
        if (elements.wishlistCount) {
            elements.wishlistCount.textContent = count;
            elements.wishlistCount.style.display = count > 0 ? 'flex' : 'none';
        }
    }

    // ==========================================
    // FAQ
    // ==========================================
    function initFAQ() {
        elements.faqItems.forEach(item => {
            const question = item.querySelector('.faq-question');
            question?.addEventListener('click', () => {
                const isActive = item.classList.contains('active');
                
                // Close all
                elements.faqItems.forEach(i => i.classList.remove('active'));
                
                // Open clicked if wasn't active
                if (!isActive) {
                    item.classList.add('active');
                }
            });
        });
    }

    // ==========================================
    // SEARCH
    // ==========================================
    function openSearch() {
        elements.searchOverlay.classList.add('active');
        elements.searchInput?.focus();
        document.body.style.overflow = 'hidden';
    }

    function closeSearch() {
        elements.searchOverlay.classList.remove('active');
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
    // TOAST
    // ==========================================
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

    // ==========================================
    // CONTACT FORM
    // ==========================================
    function initContactForm() {
        const contactForm = document.getElementById('contactForm');
        if (!contactForm) return;
        
        // Add phone input masking if phone field exists
        const phoneInput = document.getElementById('phone');
        if (phoneInput && typeof InputMasks !== 'undefined') {
            InputMasks.phone(phoneInput);
        }
        
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const submitBtn = contactForm.querySelector('button[type="submit"]');
            
            // Validate email
            const email = document.getElementById('email')?.value;
            if (email && typeof FormValidation !== 'undefined' && !FormValidation.isValidEmail(email)) {
                showToast('Please enter a valid email address', 'error');
                document.getElementById('email')?.classList.add('error');
                setTimeout(() => document.getElementById('email')?.classList.remove('error'), 2000);
                return;
            }
            
            // Set loading state
            if (typeof ButtonState !== 'undefined') {
                ButtonState.setLoading(submitBtn, 'Sending...', true);
            } else {
                submitBtn.textContent = 'Sending...';
                submitBtn.disabled = true;
            }
            
            const formData = {
                name: `${document.getElementById('firstName')?.value || ''} ${document.getElementById('lastName')?.value || ''}`.trim(),
                email: email,
                subject: document.getElementById('subject')?.value,
                message: document.getElementById('message')?.value
            };
            
            // Add order number if provided
            const orderNumber = document.getElementById('orderNumber')?.value;
            if (orderNumber) {
                formData.message = `Order Number: ${orderNumber}\n\n${formData.message}`;
            }
            
            try {
                const API_URL = window.location.hostname === 'localhost' 
                    ? 'http://localhost:3000/api' 
                    : 'https://la-vague-api.onrender.com/api';
                
                const response = await fetch(`${API_URL}/contact`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                });
                
                const result = await response.json();
                
                if (result.success) {
                    if (typeof ButtonState !== 'undefined') {
                        ButtonState.setSuccess(submitBtn, 'Message Sent!', 2000);
                    } else {
                        submitBtn.textContent = 'Message Sent!';
                    }
                    contactForm.reset();
                    showToast('Message sent successfully!', 'success');
                } else {
                    throw new Error(result.error || 'Failed to send message');
                }
            } catch (error) {
                console.error('Contact form error:', error);
                if (typeof ButtonState !== 'undefined') {
                    ButtonState.setError(submitBtn, 'Try Again', 3000);
                } else {
                    submitBtn.textContent = 'Try Again';
                    submitBtn.disabled = false;
                }
                showToast('Failed to send message. Please try again.', 'error');
            }
        });
    }

    // ==========================================
    // EVENTS
    // ==========================================
    function bindEvents() {
        // Mobile menu
        elements.mobileMenuBtn?.addEventListener('click', () => {
            elements.mobileMenuBtn.classList.toggle('active');
            elements.navLinks?.classList.toggle('active');
            document.body.style.overflow = elements.navLinks?.classList.contains('active') ? 'hidden' : '';
        });
        
        // Close mobile menu when clicking a link
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                elements.mobileMenuBtn?.classList.remove('active');
                elements.navLinks?.classList.remove('active');
                document.body.style.overflow = '';
            });
        });
        
        // Cart
        elements.cartBtn?.addEventListener('click', openCart);
        elements.cartClose?.addEventListener('click', window.closeCart);
        elements.cartOverlay?.addEventListener('click', window.closeCart);
        
        // Wishlist
        elements.wishlistBtn?.addEventListener('click', window.openWishlist);
        elements.wishlistClose?.addEventListener('click', window.closeWishlist);
        elements.wishlistOverlay?.addEventListener('click', window.closeWishlist);
        
        // Search
        elements.searchBtn?.addEventListener('click', openSearch);
        elements.searchClose?.addEventListener('click', closeSearch);
        
        // Use SearchHelper for consistent debouncing
        SearchHelper.init(elements.searchInput, handleSearch, {
            delay: 300,
            minLength: 1
        });
        
        // Contact form
        initContactForm();
        
        // Keyboard
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeSearch();
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
        });
    }

    // ==========================================
    // CURRENCY SELECTOR
    // ==========================================
    function initCurrencySelector() {
        const currencySelect = document.getElementById('currencySelect');
        if (currencySelect) {
            // Set initial value from localStorage
            const currentCurrency = CurrencyConfig.getCurrentCurrency();
            currencySelect.value = currentCurrency;
            
            // Handle currency change
            currencySelect.addEventListener('change', (e) => {
                CurrencyConfig.setCurrency(e.target.value);
            });
        }
    }

    // Combined Locale Selector
    function initLocaleSelector() {
        const localeBtn = document.getElementById('localeBtn');
        const localeDropdown = document.getElementById('localeDropdown');
        
        if (!localeBtn || !localeDropdown) return;
        
        const currentCurrency = CurrencyConfig.getCurrentCurrency();
        const currentLang = localStorage.getItem('preferredLanguage') || 'en';
        
        updateLocaleDisplay(currentCurrency, currentLang);
        
        document.querySelectorAll('#currencyOptions .locale-option').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.currency === currentCurrency);
            btn.addEventListener('click', () => {
                CurrencyConfig.setCurrency(btn.dataset.currency);
                window.location.reload();
            });
        });
        
        document.querySelectorAll('#languageOptions .locale-option').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.lang === currentLang);
            btn.addEventListener('click', () => {
                localStorage.setItem('preferredLanguage', btn.dataset.lang);
                document.documentElement.lang = btn.dataset.lang;
                document.documentElement.dir = btn.dataset.lang === 'ar' ? 'rtl' : 'ltr';
                window.location.reload();
            });
        });
        
        localeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            localeDropdown.classList.toggle('active');
        });
        
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
        
        const savedLang = localStorage.getItem('preferredLanguage') || 'en';
        document.documentElement.lang = savedLang;
        document.documentElement.dir = savedLang === 'ar' ? 'rtl' : 'ltr';
        if (typeof applyTranslations === 'function') {
            applyTranslations();
        }
    }

    // Start
    init();
});
