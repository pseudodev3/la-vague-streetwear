/**
 * LA VAGUE - Professional Admin Dashboard
 * Security-hardened with XSS protection and audit logging
 */

// ==========================================
// CONFIG
// ==========================================
const API_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:3000/api' 
    : 'https://la-vague-api.onrender.com/api';

// ==========================================
// SECURITY UTILITIES
// ==========================================

/**
 * Sanitize HTML to prevent XSS attacks
 * @param {string} str - String to sanitize
 * @returns {string} Sanitized string safe for HTML insertion
 */
function sanitizeHTML(str) {
    if (typeof str !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Escape HTML attributes
 * @param {string} str - String to escape
 * @returns {string} Escaped string safe for attributes
 */
function escapeAttr(str) {
    if (typeof str !== 'string') return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/**
 * Create DOM element safely
 * @param {string} tag - HTML tag name
 * @param {Object} attrs - Attributes object
 * @param {string|Node} content - Text content or child node
 * @returns {HTMLElement} Created element
 */
function createElement(tag, attrs = {}, content = '') {
    const el = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
        if (key === 'className') {
            el.className = value;
        } else if (key.startsWith('on') && typeof value === 'function') {
            el.addEventListener(key.slice(2).toLowerCase(), value);
        } else {
            el.setAttribute(key, escapeAttr(String(value)));
        }
    }
    if (content) {
        if (typeof content === 'string') {
            el.textContent = content;
        } else {
            el.appendChild(content);
        }
    }
    return el;
}

// ==========================================
// STATE
// ==========================================
const state = {
    currentSection: 'overview',
    orders: [],
    products: [],
    inventory: [],
    stats: {},
    productForm: {
        images: [],
        colors: [],
        sizes: [],
        inventory: {}
    }
};

// ==========================================
// DOM ELEMENTS
// ==========================================
const elements = {
    loginScreen: document.getElementById('loginScreen'),
    dashboard: document.getElementById('dashboard'),
    loginForm: document.getElementById('loginForm'),
    logoutBtn: document.getElementById('logoutBtn'),
    loadingOverlay: document.getElementById('loadingOverlay'),
    toastContainer: document.getElementById('toastContainer'),
    
    // Navigation
    navItems: document.querySelectorAll('.nav-item'),
    pageTitle: document.getElementById('pageTitle'),
    currentDate: document.getElementById('currentDate'),
    
    // Sections
    sections: document.querySelectorAll('.section'),
    
    // Stats
    statRevenue: document.getElementById('statRevenue'),
    statOrders: document.getElementById('statOrders'),
    statProducts: document.getElementById('statProducts'),
    statPending: document.getElementById('statPending'),
    ordersCount: document.getElementById('ordersCount'),
    lowStockCount: document.getElementById('lowStockCount'),
    
    // Tables
    recentOrdersTable: document.getElementById('recentOrdersTable'),
    lowStockTable: document.getElementById('lowStockTable'),
    ordersTable: document.getElementById('ordersTable'),
    productsTable: document.getElementById('productsTable'),
    inventoryTable: document.getElementById('inventoryTable'),
    
    // Filters
    orderSearch: document.getElementById('orderSearch'),
    orderFilter: document.getElementById('orderFilter'),
    productSearch: document.getElementById('productSearch'),
    inventoryFilter: document.getElementById('inventoryFilter'),
    
    // Modals
    orderModal: document.getElementById('orderModal'),
    orderModalTitle: document.getElementById('orderModalTitle'),
    orderModalBody: document.getElementById('orderModalBody'),
    productModal: document.getElementById('productModal'),
    productModalTitle: document.getElementById('productModalTitle'),
    productForm: document.getElementById('productForm'),
    inventoryModal: document.getElementById('inventoryModal'),
    
    // Product Form
    productId: document.getElementById('productId'),
    productName: document.getElementById('productName'),
    productCategory: document.getElementById('productCategory'),
    productPrice: document.getElementById('productPrice'),
    productComparePrice: document.getElementById('productComparePrice'),
    productBadge: document.getElementById('productBadge'),
    productDescription: document.getElementById('productDescription'),
    productFeatures: document.getElementById('productFeatures'),
    productTags: document.getElementById('productTags'),
    productImages: document.getElementById('productImages'),
    imageUploadZone: document.getElementById('imageUploadZone'),
    imagePreviewGrid: document.getElementById('imagePreviewGrid'),
    colorsContainer: document.getElementById('colorsContainer'),
    sizesContainer: document.getElementById('sizesContainer'),
    inventoryContainer: document.getElementById('inventoryContainer'),
    saveProductBtn: document.getElementById('saveProductBtn'),
    addProductBtn: document.getElementById('addProductBtn'),
    
    // Inventory Modal
    inventoryProductName: document.getElementById('inventoryProductName'),
    inventoryVariant: document.getElementById('inventoryVariant'),
    inventoryCurrentStock: document.getElementById('inventoryCurrentStock'),
    inventoryNewStock: document.getElementById('inventoryNewStock'),
    updateInventoryBtn: document.getElementById('updateInventoryBtn'),
    
    // Customers
    customersTable: document.getElementById('customersTable')
};

// ==========================================
// AUTHENTICATION
// ==========================================
function checkAuth() {
    const token = sessionStorage.getItem('adminToken');
    if (token) {
        showDashboard();
        loadAllData();
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const password = document.getElementById('adminPassword').value;
    const btn = elements.loginForm.querySelector('button[type="submit"]');
    
    setLoading(btn, true);
    
    try {
        const response = await fetch(`${API_URL}/admin/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            sessionStorage.setItem('adminToken', data.token);
            showDashboard();
            loadAllData();
            showToast('Welcome back!', 'success');
        } else {
            showToast(data.error || 'Invalid password', 'error');
        }
    } catch (error) {
        showToast('Login failed. Please try again.', 'error');
    } finally {
        setLoading(btn, false);
    }
}

async function handleLogout() {
    const token = sessionStorage.getItem('adminToken');
    
    if (token) {
        try {
            await fetch(`${API_URL}/admin/logout`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });
        } catch (error) {
        }
    }
    
    sessionStorage.removeItem('adminToken');
    showLogin();
    showToast('Logged out successfully', 'success');
}

function showLogin() {
    elements.loginScreen.style.display = 'flex';
    elements.dashboard.style.display = 'none';
    document.getElementById('adminPassword').value = '';
}

function showDashboard() {
    elements.loginScreen.style.display = 'none';
    elements.dashboard.style.display = 'block';
    elements.currentDate.textContent = new Date().toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
}

// ==========================================
// NAVIGATION
// ==========================================
function navigateTo(section) {
    state.currentSection = section;
    
    // Update nav
    elements.navItems.forEach(item => {
        item.classList.toggle('active', item.dataset.section === section);
    });
    
    // Update sections
    elements.sections.forEach(sec => {
        sec.classList.toggle('active', sec.id === `${section}Section`);
    });
    
    // Update title
    const titles = {
        overview: 'Overview',
        orders: 'Orders',
        products: 'Products',
        inventory: 'Inventory',
        customers: 'Customers',
        analytics: 'Analytics',
        settings: 'Settings'
    };
    elements.pageTitle.textContent = titles[section] || 'Dashboard';
    
    // Load section data
    if (section === 'orders') loadOrders();
    if (section === 'products') loadProducts();
    if (section === 'inventory') loadInventory();
    if (section === 'customers') loadCustomers();
    if (section === 'analytics') loadAnalytics();
    if (section === 'settings') loadSettings();
}

// ==========================================
// DATA LOADING
// ==========================================
async function loadAllData() {
    showLoading(true);
    
    try {
        await Promise.all([
            loadStats(),
            loadRecentOrders(),
            loadLowStock()
        ]);
    } catch (error) {
        showToast('Error loading dashboard data', 'error');
    } finally {
        showLoading(false);
    }
}

async function loadSettings() {
    try {
        // Load current currency rates
        const result = await fetchAPI('/admin/currency-rates');
        if (result.rates) {
            Object.entries(result.rates).forEach(([currency, rate]) => {
                const input = document.querySelector(`.currency-rate[data-currency="${currency}"]`);
                if (input) input.value = rate;
            });
        }
        
        // Show last updated time
        if (result.lastUpdated) {
            const date = new Date(result.lastUpdated);
            const statusEl = document.getElementById('currencyRatesStatus');
            if (statusEl) {
                statusEl.textContent = `Last updated: ${date.toLocaleString()}`;
                statusEl.style.color = 'var(--color-text-muted)';
            }
        }
    } catch (error) {
        console.error('Failed to load settings:', error);
        showToast('Failed to load settings', 'error');
    }
}

async function loadStats() {
    try {
        const [orderStats, productStats] = await Promise.all([
            fetchAPI('/admin/stats'),
            fetchAPI('/admin/products/stats')
        ]);
        
        // Handle both response structures
        const orderData = orderStats.stats || orderStats;
        const productData = productStats.stats || productStats;
        
        state.stats = { 
            totalOrders: orderData.totalOrders || orderData.total_orders || 0,
            pendingOrders: orderData.pendingOrders || orderData.pending_orders || 0,
            totalRevenue: orderData.totalRevenue || orderData.total_revenue || 0,
            totalProducts: productData.totalProducts || productData.total_products || 0
        };
        
        elements.statRevenue.textContent = `$${(state.stats.totalRevenue || 0).toLocaleString()}`;
        elements.statOrders.textContent = (state.stats.totalOrders || 0).toLocaleString();
        elements.statProducts.textContent = (state.stats.totalProducts || 0).toLocaleString();
        elements.statPending.textContent = (state.stats.pendingOrders || 0).toLocaleString();
        elements.ordersCount.textContent = (state.stats.pendingOrders || 0).toString();
    } catch (error) {
    }
}

async function loadRecentOrders() {
    try {
        const data = await fetchAPI('/admin/orders');
        state.orders = data.orders || [];
        
        const recent = state.orders.slice(0, 5);
        
        // Clear table
        elements.recentOrdersTable.innerHTML = '';
        
        if (recent.length === 0) {
            const tr = createElement('tr', {}, 
                createElement('td', { colspan: 4, className: 'text-center' }, 'No orders yet')
            );
            elements.recentOrdersTable.appendChild(tr);
            return;
        }
        
        recent.forEach(order => {
            const tr = createElement('tr', { 
                style: 'cursor: pointer;',
                onclick: () => viewOrder(order.id)
            });
            
            const tdId = createElement('td', {}, 
                createElement('strong', {}, order.id)
            );
            
            const tdCustomer = createElement('td', {}, 
                order.customer_name || order.customerName || ''
            );
            
            const tdTotal = createElement('td', {}, `$${order.total || 0}`);
            
            const status = order.order_status || order.status || 'pending';
            const tdStatus = createElement('td', {}, 
                createElement('span', { className: `status-badge ${status}` }, status)
            );
            
            tr.appendChild(tdId);
            tr.appendChild(tdCustomer);
            tr.appendChild(tdTotal);
            tr.appendChild(tdStatus);
            elements.recentOrdersTable.appendChild(tr);
        });
    } catch (error) {
        elements.recentOrdersTable.innerHTML = '';
        const tr = createElement('tr', {}, 
            createElement('td', { colspan: 4, className: 'text-center' }, 'Error loading orders')
        );
        elements.recentOrdersTable.appendChild(tr);
    }
}

async function loadLowStock() {
    try {
        const data = await fetchAPI('/admin/inventory/low-stock?threshold=10');
        const lowStock = data.lowStock || [];
        
        elements.lowStockCount.textContent = lowStock.length;
        elements.lowStockCount.style.display = lowStock.length > 0 ? 'inline-flex' : 'none';
        
        elements.lowStockTable.innerHTML = '';
        
        if (lowStock.length === 0) {
            const tr = createElement('tr', {}, 
                createElement('td', { colspan: 3, className: 'text-center' }, 'No low stock items')
            );
            elements.lowStockTable.appendChild(tr);
            return;
        }
        
        lowStock.slice(0, 5).forEach(item => {
            const tr = createElement('tr');
            const tdProduct = createElement('td', {}, item.productName);
            const tdVariant = createElement('td', {}, `${item.color} / ${item.size}`);
            const badgeClass = item.quantity <= 5 ? 'critical' : 'warning';
            const tdStock = createElement('td', {}, 
                createElement('span', { className: `stock-badge ${badgeClass}` }, String(item.quantity))
            );
            
            tr.appendChild(tdProduct);
            tr.appendChild(tdVariant);
            tr.appendChild(tdStock);
            elements.lowStockTable.appendChild(tr);
        });
    } catch (error) {
        // Silent error - don't expose to UI
    }
}

async function loadOrders() {
    showLoading(true);
    
    try {
        const data = await fetchAPI('/admin/orders');
        // Normalize order data to ensure consistent field access
        state.orders = (data.orders || []).map(order => {
            // Parse items if it's a string
            let items = order.items;
            if (typeof items === 'string') {
                try {
                    items = JSON.parse(items);
                } catch (e) {
                    items = [];
                }
            }
            
            // Parse shipping address if it's a string
            let shippingAddress = order.shipping_address;
            if (typeof shippingAddress === 'string') {
                try {
                    shippingAddress = JSON.parse(shippingAddress);
                } catch (e) {
                    shippingAddress = {};
                }
            }
            
            return {
                ...order,
                items: items || [],
                shipping_address: shippingAddress || {}
            };
        });
        renderOrdersTable(state.orders);
    } catch (error) {
        console.error('Error loading orders:', error);
        elements.ordersTable.innerHTML = '<tr><td colspan="8" class="text-center">Error loading orders</td></tr>';
    } finally {
        showLoading(false);
    }
}

function renderOrdersTable(orders) {
    const filter = elements.orderFilter.value;
    const search = elements.orderSearch.value.toLowerCase();
    
    let filtered = orders;
    
    if (filter !== 'all') {
        filtered = filtered.filter(o => (o.order_status || o.status) === filter);
    }
    
    if (search) {
        filtered = filtered.filter(o => 
            (o.id || '').toLowerCase().includes(search) ||
            (o.customer_name || o.customerName || '').toLowerCase().includes(search) ||
            (o.customer_email || o.email || '').toLowerCase().includes(search)
        );
    }
    
    elements.ordersTable.innerHTML = '';
    
    if (filtered.length === 0) {
        const tr = createElement('tr', {}, 
            createElement('td', { colspan: 8, className: 'text-center' }, 'No orders found')
        );
        elements.ordersTable.appendChild(tr);
        return;
    }
    
    filtered.forEach(order => {
        const items = order.items || [];
        const status = order.order_status || order.status || 'pending';
        
        const tr = createElement('tr');
        
        // Order ID
        tr.appendChild(createElement('td', {}, createElement('strong', {}, order.id)));
        
        // Customer name
        const customerName = order.customer_name || (order.firstName && order.lastName ? `${order.firstName} ${order.lastName}` : '');
        tr.appendChild(createElement('td', {}, customerName));
        
        // Email
        tr.appendChild(createElement('td', {}, order.customer_email || order.email || ''));
        
        // Date
        tr.appendChild(createElement('td', {}, formatDate(order.created_at || order.date)));
        
        // Items count
        tr.appendChild(createElement('td', {}, String(items.length)));
        
        // Total
        tr.appendChild(createElement('td', {}, `$${order.total || 0}`));
        
        // Status select
        const tdStatus = createElement('td');
        const select = createElement('select', { 
            className: 'input input-sm status-select',
            id: `status-${order.id}`,
            style: 'min-width: 120px;'
        });
        const statuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
        statuses.forEach(s => {
            const option = createElement('option', { value: s }, s.charAt(0).toUpperCase() + s.slice(1));
            if (s === status) option.selected = true;
            select.appendChild(option);
        });
        tdStatus.appendChild(select);
        tr.appendChild(tdStatus);
        
        // Actions
        const tdActions = createElement('td');
        const viewBtn = createElement('button', { 
            className: 'btn btn-sm btn-secondary',
            onclick: () => viewOrder(order.id)
        }, 'View');
        const saveBtn = createElement('button', { 
            className: 'btn btn-sm btn-primary',
            style: 'margin-left: 0.5rem;',
            onclick: () => saveOrderStatus(order.id)
        }, 'Save');
        tdActions.appendChild(viewBtn);
        tdActions.appendChild(saveBtn);
        tr.appendChild(tdActions);
        
        elements.ordersTable.appendChild(tr);
    });
}

async function loadProducts() {
    showLoading(true);
    
    try {
        const data = await fetchAPI('/admin/products');
        state.products = data.products || [];
        renderProductsTable(state.products);
    } catch (error) {
        elements.productsTable.innerHTML = '<tr><td colspan="7" class="text-center">Error loading products</td></tr>';
    } finally {
        showLoading(false);
    }
}

function renderProductsTable(products) {
    const search = elements.productSearch.value.toLowerCase();
    
    let filtered = products;
    
    if (search) {
        filtered = filtered.filter(p => 
            (p.name || '').toLowerCase().includes(search) ||
            (p.category || '').toLowerCase().includes(search)
        );
    }
    
    elements.productsTable.innerHTML = '';
    
    if (filtered.length === 0) {
        const tr = createElement('tr', {}, 
            createElement('td', { colspan: 7, className: 'text-center' }, 'No products found')
        );
        elements.productsTable.appendChild(tr);
        return;
    }
    
    filtered.forEach(product => {
        const variantCount = (product.colors?.length || 1) * (product.sizes?.length || 1);
        const imageUrl = product.images?.[0]?.src || 'https://via.placeholder.com/50';
        
        const tr = createElement('tr');
        
        // Image
        const tdImage = createElement('td');
        const img = createElement('img', { 
            src: imageUrl, 
            alt: '',
            className: 'product-thumb' 
        });
        tdImage.appendChild(img);
        tr.appendChild(tdImage);
        
        // Name
        tr.appendChild(createElement('td', {}, createElement('strong', {}, product.name)));
        
        // Category
        tr.appendChild(createElement('td', {}, product.category));
        
        // Price
        tr.appendChild(createElement('td', {}, `$${product.price}`));
        
        // Variants
        tr.appendChild(createElement('td', {}, `${variantCount} variants`));
        
        // Status
        const badgeClass = product.badge ? 'active' : 'draft';
        const badgeText = product.badge || 'Active';
        tr.appendChild(createElement('td', {}, 
            createElement('span', { className: `status-badge ${badgeClass}` }, badgeText)
        ));
        
        // Actions
        const tdActions = createElement('td');
        const editBtn = createElement('button', { 
            className: 'btn btn-sm btn-secondary',
            onclick: () => editProduct(product.id)
        }, 'Edit');
        const deleteBtn = createElement('button', { 
            className: 'btn btn-sm btn-danger',
            style: 'margin-left: 0.5rem;',
            onclick: () => deleteProduct(product.id)
        }, 'Delete');
        tdActions.appendChild(editBtn);
        tdActions.appendChild(deleteBtn);
        tr.appendChild(tdActions);
        
        elements.productsTable.appendChild(tr);
    });
}

async function loadInventory() {
    showLoading(true);
    
    try {
        // Load products and get inventory for each variant
        const [productsData, lowStockData] = await Promise.all([
            fetchAPI('/admin/products'),
            fetchAPI('/admin/inventory/low-stock?threshold=1000') // Get all
        ]);
        
        const products = productsData.products || [];
        const inventoryList = [];
        
        for (const product of products) {
            const colors = product.colors || [{ name: 'Default' }];
            const sizes = product.sizes || ['OS'];
            const inventory = product.inventory || {};
            
            for (const color of colors) {
                for (const size of sizes) {
                    const variantKey = `${color.name}-${size}`;
                    const quantity = inventory[variantKey] || 0;
                    
                    inventoryList.push({
                        productId: product.id,
                        productName: product.name,
                        color: color.name,
                        size,
                        variantKey,
                        total: quantity,
                        reserved: 0, // Will be fetched from API
                        available: quantity
                    });
                }
            }
        }
        
        state.inventory = inventoryList;
        renderInventoryTable(inventoryList);
    } catch (error) {
        elements.inventoryTable.innerHTML = '<tr><td colspan="6" class="text-center">Error loading inventory</td></tr>';
    } finally {
        showLoading(false);
    }
}

function renderInventoryTable(inventory) {
    const filter = elements.inventoryFilter.value;
    
    let filtered = inventory;
    
    if (filter === 'low') {
        filtered = filtered.filter(i => i.available <= 10);
    }
    
    elements.inventoryTable.innerHTML = '';
    
    if (filtered.length === 0) {
        const tr = createElement('tr', {}, 
            createElement('td', { colspan: 6, className: 'text-center' }, 'No inventory items')
        );
        elements.inventoryTable.appendChild(tr);
        return;
    }
    
    filtered.forEach(item => {
        const tr = createElement('tr');
        tr.appendChild(createElement('td', {}, item.productName));
        tr.appendChild(createElement('td', {}, `${item.color} / ${item.size}`));
        tr.appendChild(createElement('td', {}, String(item.total)));
        tr.appendChild(createElement('td', {}, String(item.reserved)));
        
        const badgeClass = item.available <= 5 ? 'critical' : item.available <= 10 ? 'warning' : 'good';
        tr.appendChild(createElement('td', {}, 
            createElement('span', { className: `stock-badge ${badgeClass}` }, String(item.available))
        ));
        
        const tdActions = createElement('td');
        const editBtn = createElement('button', { 
            className: 'btn btn-sm btn-secondary',
            onclick: () => editInventory(item.productId, item.color, item.size, item.total)
        }, 'Edit');
        tdActions.appendChild(editBtn);
        tr.appendChild(tdActions);
        
        elements.inventoryTable.appendChild(tr);
    });
}

// ==========================================
// ORDER MANAGEMENT
// ==========================================
window.viewOrder = async function(orderId) {
    const order = state.orders.find(o => o.id === orderId);
    if (!order) {
        console.error('Order not found:', orderId);
        showToast('Order not found', 'error');
        return;
    }
    
    console.log('Viewing order - raw data:', JSON.stringify(order, null, 2));
    
    // Load order notes
    let notes = [];
    try {
        const notesData = await fetchAPI(`/admin/orders/${orderId}/notes`);
        notes = notesData.notes || [];
    } catch (e) {
        console.log('No notes found or error loading notes');
    }
    
    // Ensure items is an array
    let items = order.items || [];
    if (typeof items === 'string') {
        try {
            items = JSON.parse(items);
        } catch (e) {
            items = [];
        }
    }
    
    // Ensure shipping address is an object
    let shippingAddress = order.shipping_address || {};
    if (typeof shippingAddress === 'string') {
        try {
            shippingAddress = JSON.parse(shippingAddress);
        } catch (e) {
            shippingAddress = {};
        }
    }
    
    // Normalize field names - handle both snake_case and camelCase
    const normalizedOrder = {
        customer_name: order.customer_name || order.customerName || '',
        customer_email: order.customer_email || order.customerEmail || order.email || '',
        customer_phone: order.customer_phone || order.customerPhone || order.phone || '',
        subtotal: parseInt(order.subtotal) || 0,
        shipping_cost: parseInt(order.shipping_cost || order.shippingCost) || 0,
        discount: parseInt(order.discount) || 0,
        total: parseInt(order.total) || 0,
        payment_status: order.payment_status || order.paymentStatus || 'pending',
        payment_method: order.payment_method || order.paymentMethod || 'N/A',
        order_status: order.order_status || order.status || 'pending',
        shipping_address: shippingAddress,
        items: items
    };
    
    console.log('Normalized order data:', normalizedOrder);
    
    elements.orderModalTitle.textContent = `Order ${orderId}`;
    elements.orderModalBody.innerHTML = '';
    
    const container = createElement('div', { className: 'order-details' });
    
    // Customer Information
    const customerSection = createElement('div', { className: 'order-section' });
    customerSection.appendChild(createElement('h4', {}, 'Customer Information'));
    
    const customerName = normalizedOrder.customer_name || 'N/A';
    const customerEmail = normalizedOrder.customer_email || 'N/A';
    const customerPhone = normalizedOrder.customer_phone || 'N/A';
    
    // Name
    const nameP = createElement('p', {});
    nameP.appendChild(createElement('strong', {}, 'Name: '));
    nameP.appendChild(document.createTextNode(customerName));
    customerSection.appendChild(nameP);
    
    // Email
    const emailP = createElement('p', {});
    emailP.appendChild(createElement('strong', {}, 'Email: '));
    emailP.appendChild(document.createTextNode(customerEmail));
    customerSection.appendChild(emailP);
    
    // Phone
    const phoneP = createElement('p', {});
    phoneP.appendChild(createElement('strong', {}, 'Phone: '));
    phoneP.appendChild(document.createTextNode(customerPhone));
    customerSection.appendChild(phoneP);
    
    container.appendChild(customerSection);
    
    // Shipping Address
    const addressSection = createElement('div', { className: 'order-section' });
    addressSection.appendChild(createElement('h4', {}, 'Shipping Address'));
    
    const address = shippingAddress.address || order.address || 'N/A';
    const apartment = shippingAddress.apartment || order.apartment || '';
    const city = shippingAddress.city || order.city || '';
    const stateName = shippingAddress.state || order.state || '';
    const zip = shippingAddress.zip || order.zip || '';
    
    addressSection.appendChild(createElement('p', {}, address));
    if (apartment) {
        addressSection.appendChild(createElement('p', {}, apartment));
    }
    const cityStateZip = `${city}${city && stateName ? ', ' : ''}${stateName} ${zip}`.trim();
    if (cityStateZip) {
        addressSection.appendChild(createElement('p', {}, cityStateZip));
    }
    container.appendChild(addressSection);
    
    // Items
    const itemsSection = createElement('div', { className: 'order-section' });
    itemsSection.appendChild(createElement('h4', {}, `Items (${items.length})`));
    
    if (items.length === 0) {
        itemsSection.appendChild(createElement('p', { className: 'text-muted' }, 'No items in this order'));
    } else {
        const itemsTable = createElement('table', { className: 'table table-sm' });
        const thead = createElement('thead');
        const headerRow = createElement('tr');
        ['Item', 'Variant', 'Qty', 'Price'].forEach(text => {
            headerRow.appendChild(createElement('th', {}, text));
        });
        thead.appendChild(headerRow);
        itemsTable.appendChild(thead);
        
        const tbody = createElement('tbody');
        items.forEach(item => {
            const tr = createElement('tr');
            tr.appendChild(createElement('td', {}, item.name || 'Unknown'));
            tr.appendChild(createElement('td', {}, `${item.color || 'N/A'} / ${item.size || 'N/A'}`));
            tr.appendChild(createElement('td', {}, String(item.quantity || 0)));
            tr.appendChild(createElement('td', {}, `$${item.price || 0}`));
            tbody.appendChild(tr);
        });
        itemsTable.appendChild(tbody);
        itemsSection.appendChild(itemsTable);
    }
    container.appendChild(itemsSection);
    
    // Payment Summary
    const paymentSection = createElement('div', { className: 'order-section' });
    paymentSection.appendChild(createElement('h4', {}, 'Payment Summary'));
    
    const subtotal = normalizedOrder.subtotal;
    const shipping = normalizedOrder.shipping_cost;
    const discount = normalizedOrder.discount;
    const total = normalizedOrder.total;
    
    console.log('Payment values:', { subtotal, shipping, discount, total });
    
    // Subtotal
    const subtotalP = createElement('p', {});
    subtotalP.appendChild(createElement('strong', {}, 'Subtotal: '));
    subtotalP.appendChild(document.createTextNode(`$${subtotal.toLocaleString()}`));
    paymentSection.appendChild(subtotalP);
    
    // Shipping
    const shippingP = createElement('p', {});
    shippingP.appendChild(createElement('strong', {}, 'Shipping: '));
    shippingP.appendChild(document.createTextNode(`$${shipping.toLocaleString()}`));
    paymentSection.appendChild(shippingP);
    
    // Discount
    if (discount > 0) {
        const discountP = createElement('p', {});
        discountP.appendChild(createElement('strong', {}, 'Discount: '));
        discountP.appendChild(document.createTextNode(`-$${discount.toLocaleString()}`));
        paymentSection.appendChild(discountP);
    }
    
    // Total
    const totalP = createElement('p', { className: 'text-bold', style: 'font-size: 1.1rem; margin-top: 0.5rem;' });
    totalP.appendChild(createElement('strong', {}, 'Total: '));
    totalP.appendChild(document.createTextNode(`$${total.toLocaleString()}`));
    paymentSection.appendChild(totalP);
    
    // Payment Status
    const paymentStatus = normalizedOrder.payment_status;
    const paymentMethod = normalizedOrder.payment_method;
    
    const statusP = createElement('p', { style: 'margin-top: 1rem;' });
    statusP.appendChild(createElement('strong', {}, 'Payment Status: '));
    statusP.appendChild(document.createTextNode(paymentStatus));
    paymentSection.appendChild(statusP);
    
    const methodP = createElement('p', {});
    methodP.appendChild(createElement('strong', {}, 'Payment Method: '));
    methodP.appendChild(document.createTextNode(paymentMethod));
    paymentSection.appendChild(methodP);
    
    container.appendChild(paymentSection);
    
    // Order Notes
    const notesSection = createElement('div', { className: 'order-section' });
    notesSection.appendChild(createElement('h4', {}, 'Order Notes'));
    
    if (notes.length === 0) {
        notesSection.appendChild(createElement('p', { className: 'text-muted' }, 'No notes yet'));
    } else {
        notes.forEach(note => {
            const noteDiv = createElement('div', { className: 'order-note', style: 'margin-bottom: 0.5rem; padding: 0.5rem; background: #f3f4f6; border-radius: 4px;' });
            noteDiv.appendChild(createElement('p', { style: 'margin: 0;' }, note.note));
            const dateSmall = createElement('small', { className: 'text-muted' }, formatDate(note.created_at));
            noteDiv.appendChild(dateSmall);
            notesSection.appendChild(noteDiv);
        });
    }
    
    // Add note form
    const noteForm = createElement('div', { className: 'note-form', style: 'margin-top: 1rem;' });
    const noteTextarea = createElement('textarea', { 
        id: 'newOrderNote',
        className: 'input',
        rows: 2,
        placeholder: 'Add a note...'
    });
    noteForm.appendChild(noteTextarea);
    
    const addNoteBtn = createElement('button', { 
        className: 'btn btn-secondary btn-sm',
        style: 'margin-top: 0.5rem;',
        onclick: async () => {
            const noteText = document.getElementById('newOrderNote').value.trim();
            if (!noteText) return;
            
            try {
                await fetchAPI(`/admin/orders/${orderId}/notes`, {
                    method: 'POST',
                    body: { note: noteText, isInternal: true }
                });
                showToast('Note added', 'success');
                viewOrder(orderId); // Refresh modal
            } catch (e) {
                showToast('Failed to add note', 'error');
            }
        }
    }, 'Add Note');
    noteForm.appendChild(addNoteBtn);
    notesSection.appendChild(noteForm);
    container.appendChild(notesSection);
    
    elements.orderModalBody.appendChild(container);
    elements.orderModal.style.display = 'flex';
};

window.closeOrderModal = function() {
    elements.orderModal.style.display = 'none';
};

window.saveOrderStatus = async function(orderId) {
    const statusSelect = document.getElementById(`status-${orderId}`);
    if (!statusSelect) return;
    
    const newStatus = statusSelect.value;
    
    try {
        await fetchAPI(`/admin/orders/${orderId}/status`, {
            method: 'POST',
            body: { status: newStatus }
        });
        
        showToast(`Order ${orderId} updated to ${newStatus}`, 'success');
        loadOrders();
    } catch (error) {
        showToast(`Failed to update order: ${error.message}`, 'error');
    }
};

// ==========================================
// PRODUCT MANAGEMENT
// ==========================================
window.editProduct = async function(productId) {
    const product = state.products.find(p => p.id === productId);
    if (!product) return;
    
    elements.productModalTitle.textContent = 'Edit Product';
    elements.productId.value = product.id;
    elements.productName.value = product.name || '';
    elements.productCategory.value = product.category || '';
    elements.productPrice.value = product.price || '';
    elements.productComparePrice.value = product.compareAtPrice || '';
    elements.productBadge.value = product.badge || '';
    elements.productDescription.value = product.description || '';
    elements.productFeatures.value = (product.features || []).join('\n');
    elements.productTags.value = (product.tags || []).join(', ');
    
    // Set up images
    state.productForm.images = product.images || [];
    renderImagePreviews();
    
    // Set up variants
    state.productForm.colors = product.colors || [];
    state.productForm.sizes = product.sizes || [];
    state.productForm.inventory = product.inventory || {};
    renderVariantInputs();
    
    elements.productModal.style.display = 'flex';
};

elements.addProductBtn.addEventListener('click', () => {
    elements.productModalTitle.textContent = 'Add Product';
    elements.productForm.reset();
    elements.productId.value = '';
    
    state.productForm = {
        images: [],
        colors: [],
        sizes: [],
        inventory: {}
    };
    
    renderImagePreviews();
    renderVariantInputs();
    
    elements.productModal.style.display = 'flex';
});

window.closeProductModal = function() {
    elements.productModal.style.display = 'none';
};

elements.saveProductBtn.addEventListener('click', async () => {
    const productId = elements.productId.value;
    const isEdit = !!productId;
    
    // Validate required fields
    if (!elements.productName.value.trim()) {
        showToast('Product name is required', 'error');
        return;
    }
    if (!elements.productCategory.value) {
        showToast('Category is required', 'error');
        return;
    }
    
    // Parse and validate price
    const priceValue = elements.productPrice.value.replace(/[$,]/g, '').trim();
    const price = parseInt(priceValue, 10);
    if (!priceValue || isNaN(price) || price <= 0) {
        showToast('Valid price is required (numbers only)', 'error');
        return;
    }
    
    // Parse compare at price if provided
    let compareAtPrice = null;
    if (elements.productComparePrice.value) {
        const compareValue = elements.productComparePrice.value.replace(/[$,]/g, '').trim();
        const compareParsed = parseInt(compareValue, 10);
        if (!isNaN(compareParsed) && compareParsed > 0) {
            compareAtPrice = compareParsed;
        }
    }
    
    // Build product data
    // Filter keepImages to only include actual URLs (not data URLs)
    // Data URLs are huge and cause "field value too long" errors
    const keepImages = state.productForm.images
        .map(img => img.src)
        .filter(src => !src.startsWith('data:')); // Exclude base64 data URLs
    
    const productData = {
        name: elements.productName.value.trim(),
        category: elements.productCategory.value,
        price: price,
        compareAtPrice: compareAtPrice,
        badge: elements.productBadge.value || null,
        description: elements.productDescription.value.trim(),
        features: elements.productFeatures.value.split('\n').filter(f => f.trim()),
        colors: state.productForm.colors,
        sizes: state.productForm.sizes,
        inventory: state.productForm.inventory,
        tags: elements.productTags.value.split(',').map(t => t.trim()).filter(t => t),
        keepImages: keepImages
    };
    
    // Get new image files
    const newImageFiles = Array.from(elements.productImages.files);
    
    setLoading(elements.saveProductBtn, true);
    
    try {
        const url = isEdit ? `/admin/products/${productId}` : '/admin/products';
        const method = isEdit ? 'PUT' : 'POST';
        
        // Create FormData for multipart upload
        const formData = new FormData();
        Object.keys(productData).forEach(key => {
            if (typeof productData[key] === 'object') {
                formData.append(key, JSON.stringify(productData[key]));
            } else {
                formData.append(key, productData[key]);
            }
        });
        
        newImageFiles.forEach(file => {
            formData.append('images', file);
        });
        
        const token = sessionStorage.getItem('adminToken');
        if (!token) {
            throw new Error('Not authenticated. Please login again.');
        }
        
        const response = await fetch(`${API_URL}${url}`, {
            method,
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });
        
        let data;
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        } else {
            const text = await response.text();
            throw new Error(`Server error: ${response.status} - ${text.substring(0, 200)}`);
        }
        
        if (!response.ok) {
            throw new Error(data.error || data.message || `Server error: ${response.status}`);
        }
        
        if (data.success) {
            showToast(isEdit ? 'Product updated!' : 'Product created!', 'success');
            closeProductModal();
            loadProducts();
            loadStats();
        } else {
            throw new Error(data.error || 'Failed to save product');
        }
    } catch (error) {
        console.error('Save product error:', error);
        showToast(error.message || 'Failed to save product. Check console for details.', 'error');
    } finally {
        setLoading(elements.saveProductBtn, false);
    }
});

window.deleteProduct = async function(productId) {
    if (!confirm('Are you sure you want to delete this product? This cannot be undone.')) return;
    
    try {
        await fetchAPI(`/admin/products/${productId}`, { method: 'DELETE' });
        showToast('Product deleted', 'success');
        loadProducts();
        loadStats();
    } catch (error) {
        showToast('Failed to delete product', 'error');
    }
};

// ==========================================
// IMAGE UPLOAD
// ==========================================
elements.imageUploadZone.addEventListener('click', () => {
    elements.productImages.click();
});

elements.imageUploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    elements.imageUploadZone.classList.add('dragover');
});

elements.imageUploadZone.addEventListener('dragleave', () => {
    elements.imageUploadZone.classList.remove('dragover');
});

elements.imageUploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    elements.imageUploadZone.classList.remove('dragover');
    
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    handleImageFiles(files);
});

elements.productImages.addEventListener('change', (e) => {
    handleImageFiles(Array.from(e.target.files));
});

function handleImageFiles(files) {
    if (state.productForm.images.length + files.length > 5) {
        showToast('Maximum 5 images allowed', 'error');
        return;
    }
    
    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
            state.productForm.images.push({
                src: e.target.result,
                file: file,
                isNew: true
            });
            renderImagePreviews();
        };
        reader.readAsDataURL(file);
    });
}

function renderImagePreviews() {
    elements.imagePreviewGrid.innerHTML = '';
    
    if (state.productForm.images.length === 0) {
        return;
    }
    
    state.productForm.images.forEach((img, index) => {
        const previewDiv = createElement('div', { className: 'image-preview' });
        const image = createElement('img', { src: img.src, alt: '' });
        const removeBtn = createElement('button', { 
            type: 'button',
            className: 'image-remove',
            onclick: () => removeImage(index)
        }, '×');
        
        previewDiv.appendChild(image);
        previewDiv.appendChild(removeBtn);
        elements.imagePreviewGrid.appendChild(previewDiv);
    });
}

window.removeImage = function(index) {
    state.productForm.images.splice(index, 1);
    renderImagePreviews();
};

// ==========================================
// VARIANT MANAGEMENT
// ==========================================
window.addColorInput = function() {
    const colorName = prompt('Enter color name:');
    if (!colorName) return;
    
    const colorValue = prompt('Enter color hex code (e.g., #000000):') || '#000000';
    
    state.productForm.colors.push({
        name: colorName,
        value: colorValue
    });
    
    renderVariantInputs();
};

window.addSizeInput = function() {
    const size = prompt('Enter size:');
    if (!size) return;
    
    state.productForm.sizes.push(size);
    renderVariantInputs();
};

window.removeColor = function(index) {
    state.productForm.colors.splice(index, 1);
    renderVariantInputs();
};

window.removeSize = function(index) {
    state.productForm.sizes.splice(index, 1);
    renderVariantInputs();
};

function renderVariantInputs() {
    // Render colors
    elements.colorsContainer.innerHTML = '';
    state.productForm.colors.forEach((color, index) => {
        const chip = createElement('div', { className: 'variant-chip' });
        const dot = createElement('span', { 
            className: 'color-dot',
            style: `background-color: ${escapeAttr(color.value)}`
        });
        const name = createElement('span', {}, color.name);
        const removeBtn = createElement('button', { 
            type: 'button',
            onclick: () => removeColor(index)
        }, '×');
        
        chip.appendChild(dot);
        chip.appendChild(name);
        chip.appendChild(removeBtn);
        elements.colorsContainer.appendChild(chip);
    });
    
    // Render sizes
    elements.sizesContainer.innerHTML = '';
    state.productForm.sizes.forEach((size, index) => {
        const chip = createElement('div', { className: 'variant-chip' });
        const sizeText = createElement('span', {}, size);
        const removeBtn = createElement('button', { 
            type: 'button',
            onclick: () => removeSize(index)
        }, '×');
        
        chip.appendChild(sizeText);
        chip.appendChild(removeBtn);
        elements.sizesContainer.appendChild(chip);
    });
    
    // Render inventory grid
    renderInventoryGrid();
}

function renderInventoryGrid() {
    const colors = state.productForm.colors.length > 0 ? state.productForm.colors : [{ name: 'Default', value: '#ccc' }];
    const sizes = state.productForm.sizes.length > 0 ? state.productForm.sizes : ['OS'];
    
    elements.inventoryContainer.innerHTML = '';
    
    if (colors.length === 0 || sizes.length === 0) {
        elements.inventoryContainer.appendChild(
            createElement('p', { className: 'text-muted' }, 'Add colors and sizes to manage inventory')
        );
        return;
    }
    
    const table = createElement('table', { className: 'table table-sm' });
    const thead = createElement('thead');
    const headerRow = createElement('tr');
    headerRow.appendChild(createElement('th', {}, 'Variant'));
    headerRow.appendChild(createElement('th', {}, 'Stock'));
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    const tbody = createElement('tbody');
    colors.forEach(color => {
        sizes.forEach(size => {
            const variantKey = `${color.name}-${size}`;
            const stock = state.productForm.inventory[variantKey] || 0;
            
            const tr = createElement('tr');
            
            const tdVariant = createElement('td');
            const colorDot = createElement('span', { 
                className: 'color-dot',
                style: `background-color: ${escapeAttr(color.value || '#ccc')}`
            });
            tdVariant.appendChild(colorDot);
            tdVariant.appendChild(document.createTextNode(` ${color.name} / ${size}`));
            tr.appendChild(tdVariant);
            
            const tdStock = createElement('td');
            const input = createElement('input', {
                type: 'number',
                min: 0,
                value: stock,
                className: 'input input-sm',
                style: 'width: 80px;'
            });
            input.addEventListener('change', (e) => updateInventoryValue(variantKey, e.target.value));
            tdStock.appendChild(input);
            tr.appendChild(tdStock);
            
            tbody.appendChild(tr);
        });
    });
    
    table.appendChild(tbody);
    elements.inventoryContainer.appendChild(table);
}

window.updateInventoryValue = function(variantKey, value) {
    state.productForm.inventory[variantKey] = parseInt(value) || 0;
};

// ==========================================
// INVENTORY MANAGEMENT
// ==========================================
let currentInventoryEdit = null;

window.editInventory = async function(productId, color, size, currentStock) {
    const product = state.products.find(p => p.id === productId);
    
    currentInventoryEdit = { productId, color, size };
    
    elements.inventoryProductName.textContent = product?.name || 'Unknown Product';
    elements.inventoryVariant.textContent = `${color} / ${size}`;
    elements.inventoryCurrentStock.textContent = currentStock;
    elements.inventoryNewStock.value = currentStock;
    
    elements.inventoryModal.style.display = 'flex';
};

window.closeInventoryModal = function() {
    elements.inventoryModal.style.display = 'none';
    currentInventoryEdit = null;
};

elements.updateInventoryBtn.addEventListener('click', async () => {
    if (!currentInventoryEdit) return;
    
    const newStock = parseInt(elements.inventoryNewStock.value);
    
    try {
        await fetchAPI(`/admin/inventory/${currentInventoryEdit.productId}`, {
            method: 'POST',
            body: {
                color: currentInventoryEdit.color,
                size: currentInventoryEdit.size,
                quantity: newStock
            }
        });
        
        showToast('Inventory updated!', 'success');
        closeInventoryModal();
        loadInventory();
    } catch (error) {
        showToast('Failed to update inventory: ' + error.message, 'error');
        console.error('Inventory update error:', error);
    }
});

// ==========================================
// UTILITIES
// ==========================================
async function fetchAPI(endpoint, options = {}) {
    const url = `${API_URL}${endpoint}`;
    const token = sessionStorage.getItem('adminToken');
    
    const config = {
        headers: {
            'Authorization': `Bearer ${token}`,
            ...options.headers
        },
        ...options
    };
    
    if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
        config.headers['Content-Type'] = 'application/json';
        config.body = JSON.stringify(config.body);
    }
    
    const response = await fetch(url, config);
    const data = await response.json();
    
    if (!response.ok) {
        if (response.status === 401) {
            handleLogout();
            throw new Error('Session expired. Please login again.');
        }
        // Include validation details in error
        const errorMsg = data.details ? 
            `${data.error}: ${data.details.map(d => `${d.field} - ${d.message}`).join(', ')}` :
            (data.error || 'Request failed');
        throw new Error(errorMsg);
    }
    
    return data;
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    elements.toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function showLoading(show) {
    elements.loadingOverlay.style.display = show ? 'flex' : 'none';
}

function setLoading(btn, loading) {
    const text = btn.querySelector('.btn-text');
    const spinner = btn.querySelector('.btn-loading');
    
    if (text) text.style.display = loading ? 'none' : 'inline';
    if (spinner) spinner.style.display = loading ? 'inline' : 'none';
    btn.disabled = loading;
}

// ==========================================
// CUSTOMER MANAGEMENT
// ==========================================

let customersState = [];

async function loadCustomers() {
    showLoading(true);
    try {
        const data = await fetchAPI('/admin/customers');
        customersState = data.customers || [];
        renderCustomersTable(customersState);
    } catch (error) {
        elements.customersTable.innerHTML = '';
        const tr = createElement('tr', {}, 
            createElement('td', { colspan: 6, className: 'text-center' }, 'Error loading customers')
        );
        elements.customersTable.appendChild(tr);
    } finally {
        showLoading(false);
    }
}

function renderCustomersTable(customers) {
    const search = document.getElementById('customerSearch')?.value?.toLowerCase() || '';
    
    let filtered = customers;
    if (search) {
        filtered = customers.filter(c => 
            (c.customer_name || '').toLowerCase().includes(search) ||
            (c.customer_email || '').toLowerCase().includes(search)
        );
    }
    
    elements.customersTable.innerHTML = '';
    
    if (filtered.length === 0) {
        const tr = createElement('tr', {}, 
            createElement('td', { colspan: 6, className: 'text-center' }, 'No customers found')
        );
        elements.customersTable.appendChild(tr);
        return;
    }
    
    filtered.forEach(customer => {
        const tr = createElement('tr');
        
        tr.appendChild(createElement('td', {}, customer.customer_name || 'N/A'));
        tr.appendChild(createElement('td', {}, customer.customer_email));
        tr.appendChild(createElement('td', {}, String(customer.order_count || 0)));
        tr.appendChild(createElement('td', {}, `$${(customer.lifetime_value || 0).toLocaleString()}`));
        tr.appendChild(createElement('td', {}, formatDate(customer.last_order_date)));
        
        const tdActions = createElement('td');
        const viewBtn = createElement('button', {
            className: 'btn btn-sm btn-secondary',
            onclick: () => viewCustomer(customer.customer_email)
        }, 'View');
        tdActions.appendChild(viewBtn);
        tr.appendChild(tdActions);
        
        elements.customersTable.appendChild(tr);
    });
}

window.viewCustomer = async function(email) {
    try {
        const data = await fetchAPI(`/admin/customers/${encodeURIComponent(email)}`);
        const customer = data.customer;
        
        // Create customer modal content
        elements.orderModalTitle.textContent = 'Customer Details';
        elements.orderModalBody.innerHTML = '';
        
        const container = createElement('div', { className: 'order-details' });
        
        // Customer info
        const infoSection = createElement('div', { className: 'order-section' });
        infoSection.appendChild(createElement('h4', {}, customer.customer_name || 'Customer'));
        infoSection.appendChild(createElement('p', {}, createElement('strong', {}, 'Email: '), customer.customer_email));
        infoSection.appendChild(createElement('p', {}, createElement('strong', {}, 'Phone: '), customer.customer_phone || 'N/A'));
        infoSection.appendChild(createElement('p', {}, createElement('strong', {}, 'Total Orders: '), String(customer.order_count || 0)));
        infoSection.appendChild(createElement('p', {}, createElement('strong', {}, 'Lifetime Value: '), `$${(customer.lifetime_value || 0).toLocaleString()}`));
        infoSection.appendChild(createElement('p', {}, createElement('strong', {}, 'First Order: '), formatDate(customer.first_order_date)));
        infoSection.appendChild(createElement('p', {}, createElement('strong', {}, 'Last Order: '), formatDate(customer.last_order_date)));
        container.appendChild(infoSection);
        
        // Recent orders
        const ordersSection = createElement('div', { className: 'order-section' });
        ordersSection.appendChild(createElement('h4', {}, 'Recent Orders'));
        
        if (data.orders && data.orders.length > 0) {
            const table = createElement('table', { className: 'table table-sm' });
            const thead = createElement('thead');
            const headerRow = createElement('tr');
            ['Order ID', 'Date', 'Total', 'Status'].forEach(text => {
                headerRow.appendChild(createElement('th', {}, text));
            });
            thead.appendChild(headerRow);
            table.appendChild(thead);
            
            const tbody = createElement('tbody');
            data.orders.slice(0, 5).forEach(order => {
                const tr = createElement('tr');
                tr.appendChild(createElement('td', {}, order.id));
                tr.appendChild(createElement('td', {}, formatDate(order.created_at)));
                tr.appendChild(createElement('td', {}, `$${order.total || 0}`));
                tr.appendChild(createElement('td', {}, order.order_status || 'pending'));
                tbody.appendChild(tr);
            });
            table.appendChild(tbody);
            ordersSection.appendChild(table);
        } else {
            ordersSection.appendChild(createElement('p', { className: 'text-muted' }, 'No orders'));
        }
        container.appendChild(ordersSection);
        
        elements.orderModalBody.appendChild(container);
        elements.orderModal.style.display = 'flex';
    } catch (error) {
        showToast('Failed to load customer details', 'error');
    }
};

// ==========================================
// ANALYTICS
// ==========================================

async function loadAnalytics() {
    showLoading(true);
    try {
        // Load sales data
        const salesData = await fetchAPI('/admin/analytics/sales?period=30');
        const customerStats = await fetchAPI('/admin/analytics/customers');
        const topProducts = await fetchAPI('/admin/analytics/top-products?limit=10');
        
        // Calculate totals - ensure proper number parsing
        const totalRevenue = salesData.data.reduce((sum, day) => sum + (parseInt(day.revenue) || 0), 0);
        const totalOrders = salesData.data.reduce((sum, day) => sum + (parseInt(day.orders) || 0), 0);
        const aov = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;
        
        console.log('Analytics data:', { totalRevenue, totalOrders, aov, days: salesData.data.length });
        
        // Update stats cards with proper formatting
        const revenueEl = document.getElementById('analyticsRevenue');
        const ordersEl = document.getElementById('analyticsOrders');
        
        if (revenueEl) {
            revenueEl.textContent = '$' + totalRevenue.toLocaleString('en-US');
        }
        if (ordersEl) {
            ordersEl.textContent = totalOrders.toLocaleString('en-US');
        }
        
        const customersEl = document.getElementById('analyticsCustomers');
        const aovEl = document.getElementById('analyticsAOV');
        
        if (customersEl) {
            customersEl.textContent = (customerStats.stats?.total_customers || 0).toLocaleString('en-US');
        }
        if (aovEl) {
            aovEl.textContent = '$' + aov.toLocaleString('en-US');
        }
        
        // Render sales chart (simple bar chart using DOM)
        renderSalesChart(salesData.data);
        
        // Render top products
        renderTopProducts(topProducts.products);
    } catch (error) {
        console.error('Analytics error:', error);
        showToast('Failed to load analytics', 'error');
    } finally {
        showLoading(false);
    }
}

function renderSalesChart(data) {
    const container = document.getElementById('salesChart');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (!data || data.length === 0) {
        container.appendChild(createElement('p', { className: 'text-center text-muted' }, 'No data available'));
        return;
    }
    
    // Parse all revenue values as integers
    const parsedData = data.map(d => ({
        ...d,
        revenue: parseInt(d.revenue) || 0,
        orders: parseInt(d.orders) || 0
    }));
    
    // Filter out days with 0 revenue for cleaner chart
    const filteredData = parsedData.filter(d => d.revenue > 0 || d.orders > 0);
    
    // If no sales yet, show message
    if (filteredData.length === 0) {
        container.appendChild(createElement('p', { className: 'text-center text-muted' }, 'No sales data yet'));
        return;
    }
    
    const maxRevenue = Math.max(...filteredData.map(d => d.revenue));
    
    console.log('Chart data:', { maxRevenue, dataPoints: filteredData.length, sample: filteredData[0] });
    
    // Chart container with better styling
    const chartWrapper = createElement('div', {
        style: 'padding: 1rem;'
    });
    
    // Stats summary
    const statsDiv = createElement('div', {
        style: 'display: flex; justify-content: space-between; margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 1px solid var(--color-border);'
    });
    statsDiv.appendChild(createElement('span', {}, `Max: $${maxRevenue.toLocaleString('en-US')}`));
    statsDiv.appendChild(createElement('span', {}, `${filteredData.length} days with sales`));
    chartWrapper.appendChild(statsDiv);
    
    // Chart bars
    const chartDiv = createElement('div', { 
        className: 'simple-chart',
        style: 'display: flex; align-items: flex-end; height: 250px; gap: 8px; overflow-x: auto; padding-bottom: 30px;'
    });
    
    // Show last 14 days max for better visibility
    const displayData = filteredData.slice(-14);
    
    displayData.forEach(day => {
        const revenue = day.revenue;
        const orders = day.orders;
        
        // Calculate height as percentage (no minimum, let 0 be 0)
        let heightPercent = maxRevenue > 0 ? (revenue / maxRevenue) * 100 : 0;
        
        // Ensure at least visible for very small values (but proportional)
        if (revenue > 0 && heightPercent < 2) {
            heightPercent = 2;
        }
        
        console.log(`Bar ${day.date}: revenue=$${revenue}, height=${heightPercent}%`);
        
        // Bar wrapper
        const barWrapper = createElement('div', {
            style: 'display: flex; flex-direction: column; align-items: center; min-width: 50px; flex: 1;'
        });
        
        // Revenue amount label (on top of bar) - format based on size
        if (revenue > 0) {
            let labelText;
            if (revenue >= 1000000) {
                labelText = `$${(revenue / 1000000).toFixed(1)}M`;
            } else if (revenue >= 1000) {
                labelText = `$${(revenue / 1000).toFixed(0)}k`;
            } else {
                labelText = `$${revenue}`;
            }
            barWrapper.appendChild(createElement('span', {
                style: 'font-size: 0.7rem; color: var(--color-text-secondary); margin-bottom: 4px; font-weight: 500;'
            }, labelText));
        }
        
        // The bar - use pixel height for more accurate representation
        const barHeight = Math.max((heightPercent / 100) * 200, revenue > 0 ? 4 : 0);
        const bar = createElement('div', {
            style: `width: 36px; background: linear-gradient(to top, var(--color-primary), var(--color-primary-dark)); height: ${barHeight}px; border-radius: 4px 4px 0 0; position: relative; transition: all 0.3s ease; flex-shrink: 0;`,
            title: `${formatDate(day.date)}\nRevenue: $${revenue.toLocaleString('en-US')}\nOrders: ${orders}`
        });
        barWrapper.appendChild(bar);
        
        // Date label
        const dateLabel = createElement('span', {
            style: 'font-size: 0.65rem; color: var(--color-text-muted); margin-top: 8px; white-space: nowrap;'
        }, new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
        barWrapper.appendChild(dateLabel);
        
        chartDiv.appendChild(barWrapper);
    });
    
    chartWrapper.appendChild(chartDiv);
    container.appendChild(chartWrapper);
}

// ==========================================
// INITIALIZATION
// ==========================================

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Check if already logged in
    checkAuth();
    
    // Login form handler
    if (elements.loginForm) {
        elements.loginForm.addEventListener('submit', handleLogin);
    }
    
    // Logout button
    if (elements.logoutBtn) {
        elements.logoutBtn.addEventListener('click', handleLogout);
    }
    
    // Navigation
    elements.navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const section = item.dataset.section;
            if (section) {
                navigateTo(section);
            }
        });
    });
    
    // Set current date
    if (elements.currentDate) {
        elements.currentDate.textContent = new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }
    
    // Search and filter listeners
    if (elements.orderSearch) {
        elements.orderSearch.addEventListener('input', () => renderOrdersTable(state.orders));
    }
    if (elements.orderFilter) {
        elements.orderFilter.addEventListener('change', () => renderOrdersTable(state.orders));
    }
    if (elements.productSearch) {
        elements.productSearch.addEventListener('input', () => renderProductsTable(state.products));
    }
    if (elements.inventoryFilter) {
        elements.inventoryFilter.addEventListener('change', () => renderInventoryTable(state.inventory));
    }
    
    // Customer search
    const customerSearch = document.getElementById('customerSearch');
    if (customerSearch) {
        customerSearch.addEventListener('input', () => renderCustomersTable(customersState));
    }
    
    // Settings form
    const settingsForm = document.getElementById('settingsForm');
    if (settingsForm) {
        settingsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = {
                storeName: document.getElementById('storeName')?.value,
                storeEmail: document.getElementById('storeEmail')?.value,
                currency: document.getElementById('defaultCurrency')?.value,
                shippingRate: parseInt(document.getElementById('shippingRate')?.value) || 0,
                freeShippingThreshold: parseInt(document.getElementById('freeShippingThreshold')?.value) || 0
            };
            
            try {
                await fetchAPI('/admin/settings', {
                    method: 'POST',
                    body: formData
                });
                showToast('Settings saved successfully', 'success');
            } catch (error) {
                showToast('Failed to save settings', 'error');
            }
        });
    }
    
    // Currency rates management
    const updateCurrencyRatesBtn = document.getElementById('updateCurrencyRatesBtn');
    const resetCurrencyRatesBtn = document.getElementById('resetCurrencyRatesBtn');
    
    if (updateCurrencyRatesBtn) {
        updateCurrencyRatesBtn.addEventListener('click', async () => {
            const rateInputs = document.querySelectorAll('.currency-rate');
            const rates = {};
            
            rateInputs.forEach(input => {
                const currency = input.dataset.currency;
                const value = parseFloat(input.value);
                if (currency && !isNaN(value) && value > 0) {
                    rates[currency] = value;
                }
            });
            
            // Ensure USD is always 1
            rates.USD = 1;
            
            try {
                updateCurrencyRatesBtn.disabled = true;
                updateCurrencyRatesBtn.textContent = 'Updating...';
                
                await fetchAPI('/admin/currency-rates', {
                    method: 'POST',
                    body: { rates }
                });
                
                document.getElementById('currencyRatesStatus').textContent = 'Rates updated successfully!';
                document.getElementById('currencyRatesStatus').style.color = 'var(--color-success)';
                showToast('Currency rates updated successfully', 'success');
                
                setTimeout(() => {
                    document.getElementById('currencyRatesStatus').textContent = '';
                }, 3000);
            } catch (error) {
                document.getElementById('currencyRatesStatus').textContent = 'Failed to update rates';
                document.getElementById('currencyRatesStatus').style.color = 'var(--color-error)';
                showToast('Failed to update currency rates', 'error');
            } finally {
                updateCurrencyRatesBtn.disabled = false;
                updateCurrencyRatesBtn.textContent = 'Update Rates';
            }
        });
    }
    
    if (resetCurrencyRatesBtn) {
        resetCurrencyRatesBtn.addEventListener('click', async () => {
            if (!confirm('Are you sure you want to reset currency rates to defaults?')) {
                return;
            }
            
            try {
                resetCurrencyRatesBtn.disabled = true;
                resetCurrencyRatesBtn.textContent = 'Resetting...';
                
                const result = await fetchAPI('/admin/currency-rates/reset', {
                    method: 'POST'
                });
                
                // Update input values
                if (result.rates) {
                    Object.entries(result.rates).forEach(([currency, rate]) => {
                        const input = document.querySelector(`.currency-rate[data-currency="${currency}"]`);
                        if (input) input.value = rate;
                    });
                }
                
                document.getElementById('currencyRatesStatus').textContent = 'Rates reset to defaults!';
                document.getElementById('currencyRatesStatus').style.color = 'var(--color-success)';
                showToast('Currency rates reset to defaults', 'success');
                
                setTimeout(() => {
                    document.getElementById('currencyRatesStatus').textContent = '';
                }, 3000);
            } catch (error) {
                document.getElementById('currencyRatesStatus').textContent = 'Failed to reset rates';
                document.getElementById('currencyRatesStatus').style.color = 'var(--color-error)';
                showToast('Failed to reset currency rates', 'error');
            } finally {
                resetCurrencyRatesBtn.disabled = false;
                resetCurrencyRatesBtn.textContent = 'Reset to Defaults';
            }
        });
    }
});
