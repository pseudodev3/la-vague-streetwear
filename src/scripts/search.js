/**
 * LA VAGUE - Shared live product search for content/product pages.
 * Homepage and Shop keep their page-specific implementations.
 */
(() => {
    let products = null;
    let productsPromise = null;
    let bound = false;

    const { escapeHTML, safeURL } = window.BrowserSecurity;

    const formatPrice = value => window.CurrencyConfig?.formatPrice
        ? window.CurrencyConfig.formatPrice(value)
        : `₦${Number(value || 0).toLocaleString()}`;

    async function loadProducts() {
        if (products) return products;
        if (!productsPromise) {
            productsPromise = fetch('/api/products')
                .then(response => {
                    if (!response.ok) throw new Error('Products unavailable');
                    return response.json();
                })
                .then(data => {
                    products = Array.isArray(data.products) ? data.products : [];
                    return products;
                })
                .catch(error => {
                    console.warn('[SEARCH] Live products unavailable:', error.message);
                    return null;
                });
        }
        return productsPromise;
    }

    function bind() {
        if (bound) return;
        const overlay = document.getElementById('searchOverlay');
        const button = document.getElementById('searchBtn');
        const close = document.getElementById('searchClose');
        const input = document.getElementById('searchInput');
        const results = document.getElementById('searchResults');
        if (!overlay || !button || !close || !input || !results) return;
        bound = true;

        const closeSearch = () => {
            overlay.classList.remove('active');
            input.value = '';
            results.innerHTML = '';
            document.body.style.overflow = '';
        };

        button.addEventListener('click', async () => {
            overlay.classList.add('active');
            document.body.style.overflow = 'hidden';
            input.focus();
            await loadProducts();
        });
        close.addEventListener('click', closeSearch);
        overlay.addEventListener('click', event => {
            if (event.target === overlay) closeSearch();
        });
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape' && overlay.classList.contains('active')) closeSearch();
        });

        let timer;
        input.addEventListener('input', () => {
            clearTimeout(timer);
            timer = setTimeout(async () => {
                const query = input.value.trim().toLowerCase();
                if (!query) {
                    results.innerHTML = '';
                    return;
                }
                const liveProducts = await loadProducts();
                if (!liveProducts) {
                    results.innerHTML = '<div class="search-message">Search is temporarily unavailable. Please try again shortly.</div>';
                    return;
                }
                const matches = liveProducts.filter(product => {
                    const tags = Array.isArray(product.tags) ? product.tags.join(' ') : String(product.tags || '');
                    return [product.name, product.category, tags].join(' ').toLowerCase().includes(query);
                }).slice(0, 8);
                if (!matches.length) {
                    results.innerHTML = '<div class="search-message">No products found.</div>';
                    return;
                }
                results.innerHTML = matches.map(product => {
                    let images = product.images;
                    if (typeof images === 'string') {
                        try { images = JSON.parse(images); } catch { images = []; }
                    }
                    const image = safeURL(images?.[0]?.src, { allowDataImage: true });
                    const slug = encodeURIComponent(product.slug || product.id || '');
                    return `<a class="search-result-item" href="/product.html?slug=${slug}">
                        ${image ? `<img src="${escapeHTML(image)}" alt="${escapeHTML(product.name)}">` : ''}
                        <div class="search-result-info">
                            <h4>${escapeHTML(product.name)}</h4>
                            <p>${escapeHTML(product.category || '')}</p>
                        </div>
                        <span class="search-result-price">${escapeHTML(formatPrice(product.price))}</span>
                    </a>`;
                }).join('');
            }, 220);
        });
    }

    window.addEventListener('componentsLoaded', bind);
})();
