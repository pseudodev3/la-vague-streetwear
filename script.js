/**
 * LA VAGUE - Streetwear Brand
 * Interactive functionality
 */

document.addEventListener('DOMContentLoaded', () => {
    // ==========================================
    // NAVIGATION
    // ==========================================
    const nav = document.getElementById('nav');
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const navLinks = document.getElementById('navLinks');
    
    // Scroll effect for navigation
    let lastScrollY = window.scrollY;
    
    window.addEventListener('scroll', () => {
        const currentScrollY = window.scrollY;
        
        // Add/remove scrolled class
        if (currentScrollY > 50) {
            nav.classList.add('scrolled');
        } else {
            nav.classList.remove('scrolled');
        }
        
        lastScrollY = currentScrollY;
    }, { passive: true });
    
    // Mobile menu toggle
    mobileMenuBtn?.addEventListener('click', () => {
        mobileMenuBtn.classList.toggle('active');
        navLinks.classList.toggle('active');
        document.body.style.overflow = navLinks.classList.contains('active') ? 'hidden' : '';
    });
    
    // Close mobile menu when clicking a link
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            mobileMenuBtn?.classList.remove('active');
            navLinks?.classList.remove('active');
            document.body.style.overflow = '';
        });
    });
    
    // ==========================================
    // SCROLL REVEAL ANIMATIONS
    // ==========================================
    const revealElements = document.querySelectorAll(
        '.reveal-up, .reveal-scale, .reveal-left, .reveal-right'
    );
    
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
    
    // ==========================================
    // SMOOTH SCROLL FOR ANCHOR LINKS
    // ==========================================
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (href === '#') return;
            
            e.preventDefault();
            const target = document.querySelector(href);
            
            if (target) {
                const navHeight = nav?.offsetHeight || 0;
                const targetPosition = target.getBoundingClientRect().top + window.scrollY - navHeight;
                
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
    
    // ==========================================
    // CART FUNCTIONALITY
    // ==========================================
    const cartBtn = document.querySelector('.cart-btn');
    const cartSidebar = document.getElementById('cartSidebar');
    const cartOverlay = document.getElementById('cartOverlay');
    const cartClose = document.getElementById('cartClose');
    const cartItems = document.getElementById('cartItems');
    const cartSubtotal = document.getElementById('cartSubtotal');
    const cartCount = document.querySelector('.cart-count');
    
    let cart = [];
    
    function openCart() {
        cartSidebar?.classList.add('active');
        cartOverlay?.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
    
    function closeCart() {
        cartSidebar?.classList.remove('active');
        cartOverlay?.classList.remove('active');
        document.body.style.overflow = '';
    }
    
    function updateCart() {
        // Update cart count
        const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
        if (cartCount) {
            cartCount.textContent = totalItems;
            cartCount.style.display = totalItems > 0 ? 'flex' : 'none';
        }
        
        // Update cart items display
        if (cartItems) {
            if (cart.length === 0) {
                cartItems.innerHTML = `
                    <div class="cart-empty">
                        <p>Your cart is empty</p>
                        <a href="#collections" class="btn btn-secondary" onclick="closeCart()">Continue Shopping</a>
                    </div>
                `;
            } else {
                cartItems.innerHTML = cart.map((item, index) => `
                    <div class="cart-item" data-index="${index}">
                        <div class="cart-item-image">
                            <div class="image-placeholder small">IMG</div>
                        </div>
                        <div class="cart-item-details">
                            <h4>${item.name}</h4>
                            <p class="cart-item-variant">${item.variant || 'One Size'}</p>
                            <div class="cart-item-actions">
                                <div class="quantity-selector">
                                    <button class="qty-btn minus" data-index="${index}">−</button>
                                    <span>${item.quantity}</span>
                                    <button class="qty-btn plus" data-index="${index}">+</button>
                                </div>
                                <span class="cart-item-price">$${item.price * item.quantity}</span>
                            </div>
                        </div>
                        <button class="cart-item-remove" data-index="${index}">×</button>
                    </div>
                `).join('');
            }
        }
        
        // Update subtotal
        const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        if (cartSubtotal) {
            cartSubtotal.textContent = `$${subtotal}`;
        }
        
        // Add event listeners to cart item buttons
        document.querySelectorAll('.qty-btn.minus').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                if (cart[index].quantity > 1) {
                    cart[index].quantity--;
                } else {
                    cart.splice(index, 1);
                }
                updateCart();
            });
        });
        
        document.querySelectorAll('.qty-btn.plus').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                cart[index].quantity++;
                updateCart();
            });
        });
        
        document.querySelectorAll('.cart-item-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                cart.splice(index, 1);
                updateCart();
            });
        });
    }
    
    // Make closeCart globally accessible
    window.closeCart = closeCart;
    
    // Cart event listeners
    cartBtn?.addEventListener('click', openCart);
    cartClose?.addEventListener('click', closeCart);
    cartOverlay?.addEventListener('click', closeCart);
    
    // Add to cart buttons
    document.querySelectorAll('.btn-primary').forEach(btn => {
        if (btn.textContent.includes('Add to Cart')) {
            btn.addEventListener('click', () => {
                const product = {
                    name: 'The Classic Oversized Hoodie',
                    price: 145,
                    quantity: 1,
                    variant: 'Black / L'
                };
                
                const existingItem = cart.find(item => item.name === product.name && item.variant === product.variant);
                
                if (existingItem) {
                    existingItem.quantity++;
                } else {
                    cart.push(product);
                }
                
                updateCart();
                openCart();
                
                // Button feedback
                const originalText = btn.textContent;
                btn.textContent = 'Added!';
                btn.style.background = '#22c55e';
                
                setTimeout(() => {
                    btn.textContent = originalText;
                    btn.style.background = '';
                }, 1500);
            });
        }
    });
    
    // ==========================================
    // NEWSLETTER FORM
    // ==========================================
    const newsletterForm = document.getElementById('newsletterForm');
    
    newsletterForm?.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = newsletterForm.querySelector('input[type="email"]').value;
        const submitBtn = newsletterForm.querySelector('button[type="submit"]');
        
        // Simulate submission
        submitBtn.textContent = 'Subscribing...';
        submitBtn.disabled = true;
        
        setTimeout(() => {
            submitBtn.textContent = 'Subscribed!';
            submitBtn.style.background = '#22c55e';
            newsletterForm.reset();
            
            setTimeout(() => {
                submitBtn.textContent = 'Subscribe';
                submitBtn.style.background = '';
                submitBtn.disabled = false;
            }, 2000);
        }, 1000);
    });
    
    // ==========================================
    // PARALLAX EFFECT FOR HERO
    // ==========================================
    const heroBg = document.querySelector('.hero-bg');
    
    window.addEventListener('scroll', () => {
        if (heroBg && window.scrollY < window.innerHeight) {
            const scrollProgress = window.scrollY / window.innerHeight;
            heroBg.style.transform = `translateY(${scrollProgress * 30}%)`;
            heroBg.style.opacity = 1 - scrollProgress;
        }
    }, { passive: true });
    
    // ==========================================
    // COLLECTION CARD HOVER EFFECT
    // ==========================================
    document.querySelectorAll('.collection-card').forEach(card => {
        const image = card.querySelector('.image-placeholder');
        
        card.addEventListener('mouseenter', () => {
            image?.style.setProperty('--hover-scale', '1.05');
        });
        
        card.addEventListener('mouseleave', () => {
            image?.style.setProperty('--hover-scale', '1');
        });
    });
    
    // ==========================================
    // LOOKBOOK ITEM HOVER
    // ==========================================
    document.querySelectorAll('.lookbook-item').forEach(item => {
        item.addEventListener('click', () => {
            const title = item.querySelector('h3')?.textContent;
            // Could open a lightbox or navigate to detail page
        });
    });
    
    // ==========================================
    // KEYBOARD NAVIGATION
    // ==========================================
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeCart();
            if (navLinks?.classList.contains('active')) {
                mobileMenuBtn?.click();
            }
        }
    });
    
    // ==========================================
    // PREFERS REDUCED MOTION
    // ==========================================
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    
    if (prefersReducedMotion.matches) {
        // Disable animations for users who prefer reduced motion
        document.querySelectorAll('.reveal-up, .reveal-scale, .reveal-left, .reveal-right').forEach(el => {
            el.classList.add('visible');
            el.style.transition = 'none';
        });
        
        document.querySelectorAll('.reveal-text').forEach(el => {
            el.style.animation = 'none';
            el.style.opacity = '1';
            el.style.transform = 'none';
        });
    }
    
    // ==========================================
    // PERFORMANCE: INTERSECTION OBSERVER FOR MARQUEE
    // ==========================================
    const marquee = document.querySelector('.marquee-content');
    
    if (marquee) {
        const marqueeObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    marquee.style.animationPlayState = 'running';
                } else {
                    marquee.style.animationPlayState = 'paused';
                }
            });
        }, { threshold: 0 });
        
        marqueeObserver.observe(marquee);
    }
});

// Add cart styles dynamically
const cartStyles = document.createElement('style');
cartStyles.textContent = `
    .cart-item {
        display: flex;
        gap: 1rem;
        padding: 1rem 0;
        border-bottom: 1px solid var(--color-border);
    }
    
    .cart-item-image .image-placeholder.small {
        width: 80px;
        height: 80px;
        font-size: 0.7rem;
    }
    
    .cart-item-details {
        flex: 1;
    }
    
    .cart-item-details h4 {
        font-size: 0.9rem;
        font-weight: 600;
        margin-bottom: 0.25rem;
    }
    
    .cart-item-variant {
        font-size: 0.8rem;
        color: var(--color-text-muted);
        margin-bottom: 0.75rem;
    }
    
    .cart-item-actions {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    
    .quantity-selector {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        border: 1px solid var(--color-border);
        padding: 0.25rem;
    }
    
    .qty-btn {
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--color-border);
        font-size: 1rem;
        transition: var(--transition-fast);
    }
    
    .qty-btn:hover {
        background: var(--color-border-light);
    }
    
    .cart-item-price {
        font-weight: 600;
    }
    
    .cart-item-remove {
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.25rem;
        color: var(--color-text-muted);
        transition: var(--transition-fast);
    }
    
    .cart-item-remove:hover {
        color: #ef4444;
    }
`;
document.head.appendChild(cartStyles);
