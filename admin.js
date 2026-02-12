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
        state.orders = data.orders || [];
        renderOrdersTable(state.orders);
    } catch (error) {
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
    if (!order) return;
    
    // Load order notes
    let notes = [];
    try {
        const notesData = await fetchAPI(`/admin/orders/${orderId}/notes`);
        notes = notesData.notes || [];
    } catch (e) {
        // Silent fail
    }
    
    const items = order.items || [];
    const shippingAddress = typeof order.shipping_address === 'string' 
        ? JSON.parse(order.shipping_address || '{}') 
        : (order.shipping_address || {});
    
    elements.orderModalTitle.textContent = `Order ${orderId}`;
    elements.orderModalBody.innerHTML = '';
    
    const container = createElement('div', { className: 'order-details' });
    
    // Customer Information
    const customerSection = createElement('div', { className: 'order-section' });
    customerSection.appendChild(createElement('h4', {}, 'Customer Information'));
    
    const customerName = order.customer_name || (order.firstName && order.lastName ? `${order.firstName} ${order.lastName}` : 'N/A');
    customerSection.appendChild(createElement('p', {}, createElement('strong', {}, 'Name: '), customerName));
    customerSection.appendChild(createElement('p', {}, createElement('strong', {}, 'Email: '), order.customer_email || order.email || 'N/A'));
    customerSection.appendChild(createElement('p', {}, createElement('strong', {}, 'Phone: '), order.customer_phone || order.phone || 'N/A'));
    container.appendChild(customerSection);
    
    // Shipping Address
    const addressSection = createElement('div', { className: 'order-section' });
    addressSection.appendChild(createElement('h4', {}, 'Shipping Address'));
    addressSection.appendChild(createElement('p', {}, shippingAddress.address || order.address || ''));
    if (shippingAddress.apartment || order.apartment) {
        addressSection.appendChild(createElement('p', {}, shippingAddress.apartment || order.apartment));
    }
    const cityStateZip = `${shippingAddress.city || order.city || ''}, ${shippingAddress.state || order.state || ''} ${shippingAddress.zip || order.zip || ''}`.trim();
    if (cityStateZip && cityStateZip !== ',') {
        addressSection.appendChild(createElement('p', {}, cityStateZip));
    }
    container.appendChild(addressSection);
    
    // Items
    const itemsSection = createElement('div', { className: 'order-section' });
    itemsSection.appendChild(createElement('h4', {}, 'Items'));
    
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
        tr.appendChild(createElement('td', {}, item.name));
        tr.appendChild(createElement('td', {}, `${item.color} / ${item.size}`));
        tr.appendChild(createElement('td', {}, String(item.quantity)));
        tr.appendChild(createElement('td', {}, `$${item.price}`));
        tbody.appendChild(tr);
    });
    itemsTable.appendChild(tbody);
    itemsSection.appendChild(itemsTable);
    container.appendChild(itemsSection);
    
    // Payment Summary
    const paymentSection = createElement('div', { className: 'order-section' });
    paymentSection.appendChild(createElement('h4', {}, 'Payment Summary'));
    paymentSection.appendChild(createElement('p', {}, createElement('strong', {}, 'Subtotal: '), `$${order.subtotal || 0}`));
    paymentSection.appendChild(createElement('p', {}, createElement('strong', {}, 'Shipping: '), `$${order.shipping_cost || order.shippingCost || 0}`));
    if (order.discount) {
        paymentSection.appendChild(createElement('p', {}, createElement('strong', {}, 'Discount: '), `-$${order.discount}`));
    }
    const totalP = createElement('p', { className: 'text-bold' }, createElement('strong', {}, 'Total: '), `$${order.total || 0}`);
    paymentSection.appendChild(totalP);
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
    
    // Build product data
    const productData = {
        name: elements.productName.value,
        category: elements.productCategory.value,
        price: parseInt(elements.productPrice.value),
        compareAtPrice: elements.productComparePrice.value ? parseInt(elements.productComparePrice.value) : null,
        badge: elements.productBadge.value || null,
        description: elements.productDescription.value,
        features: elements.productFeatures.value.split('\n').filter(f => f.trim()),
        colors: state.productForm.colors,
        sizes: state.productForm.sizes,
        inventory: state.productForm.inventory,
        tags: elements.productTags.value.split(',').map(t => t.trim()).filter(t => t),
        keepImages: state.productForm.images.map(img => img.src)
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
        
        const response = await fetch(`${API_URL}${url}`, {
            method,
            headers: {
                'Authorization': `Bearer ${sessionStorage.getItem('adminToken')}`
            },
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast(isEdit ? 'Product updated!' : 'Product created!', 'success');
            closeProductModal();
            loadProducts();
            loadStats();
        } else {
            throw new Error(data.error || 'Failed to save product');
        }
    } catch (error) {
        showToast(error.message || 'Failed to save product', 'error');
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
            body: JSON.stringify({
                color: currentInventoryEdit.color,
                size: currentInventoryEdit.size,
                quantity: newStock
            })
        });
        
        showToast('Inventory updated!', 'success');
        closeInventoryModal();
        loadInventory();
    } catch (error) {
        showToast('Failed to update inventory', 'error');
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
        
        // Calculate totals
        const totalRevenue = salesData.data.reduce((sum, day) => sum + (day.revenue || 0), 0);
        const totalOrders = salesData.data.reduce((sum, day) => sum + (day.orders || 0), 0);
        const aov = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;
        
        // Update stats cards
        document.getElementById('analyticsRevenue').textContent = `$${totalRevenue.toLocaleString()}`;
        document.getElementById('analyticsOrders').textContent = totalOrders.toLocaleString();
        document.getElementById('analyticsCustomers').textContent = (customerStats.stats?.total_customers || 0).toString();
        document.getElementById('analyticsAOV').textContent = `$${aov}`;
        
        // Render sales chart (simple bar chart using DOM)
        renderSalesChart(salesData.data);
        
        // Render top products
        renderTopProducts(topProducts.products);
    } catch (error) {
        showToast('Failed to load analytics', 'error');
    } finally {
        showLoading(false);
    }
}

function renderSalesChart(data) {
    const container = document.getElementById('salesChart');
    container.innerHTML = '';
    
    if (!data || data.length === 0) {
        container.appendChild(createElement('p', { className: 'text-center text-muted' }, 'No data available'));
        return;
    }
    
    const maxRevenue = Math.max(...data.map(d => d.revenue || 0));
    const chartDiv = createElement('div', { 
        className: 'simple-chart',
        style: 'display: flex; align-items: flex-end; height: 250px; gap: 4px; padding: 1rem;'
    });
    
    data.slice(0, 30).reverse().forEach(day => {
        const height = maxRevenue > 0 ? ((day.revenue || 0) / maxRevenue) * 100 : 0;
        const bar = createElement('div', {
            style: `flex: 1; background: var(--color-primary); height: ${height}%; min-height: 4px; border-radius: 2px; position: relative;`,
            title: `${day.date}: $${day.revenue || 0}`
        });
        chartDiv.appendChild(bar);
    });
    
    container.appendChild(chartDiv);
}

function renderTopProducts(products) {
    const tbody = document.getElementById('topProductsTable');
    tbody.innerHTML = '';
    
    if (!products || products.length === 0) {
        const tr = createElement('tr', {}, 
            createElement('td', { colspan: 3, className: 'text-center' }, 'No data available')
        );
        tbody.appendChild(tr);
        return;
    }
    
    products.forEach(product => {
        const tr = createElement('tr');
        tr.appendChild(createElement('td', {}, product.name));
        tr.appendChild(createElement('td', {}, String(product.totalQty || 0)));
        tr.appendChild(createElement('td', {}, `$${(product.totalRevenue || 0).toLocaleString()}`));
        tbody.appendChild(tr);
    });
}

// ==========================================
// SETTINGS
// ==========================================

async function loadSettings() {
    try {
        const data = await fetchAPI('/admin/settings');
        const settings = data.settings || {};
        
        // Populate form fields
        if (settings.storeName) document.getElementById('settingStoreName').value = settings.storeName;
        if (settings.supportEmail) document.getElementById('settingSupportEmail').value = settings.supportEmail;
        if (settings.freeShippingThreshold) document.getElementById('settingFreeShipping').value = settings.freeShippingThreshold;
        if (settings.shippingRate) document.getElementById('settingShippingRate').value = settings.shippingRate;
        if (settings.newOrderEmail !== undefined) document.getElementById('settingNewOrderEmail').checked = settings.newOrderEmail === 'true';
        if (settings.lowStockEmail !== undefined) document.getElementById('settingLowStockEmail').checked = settings.lowStockEmail === 'true';
    } catch (error) {
        // Silent fail - use defaults
    }
}

async function saveSettings(e) {
    e.preventDefault();
    
    const settings = {
        storeName: document.getElementById('settingStoreName').value,
        supportEmail: document.getElementById('settingSupportEmail').value,
        freeShippingThreshold: document.getElementById('settingFreeShipping').value,
        shippingRate: document.getElementById('settingShippingRate').value,
        newOrderEmail: document.getElementById('settingNewOrderEmail').checked.toString(),
        lowStockEmail: document.getElementById('settingLowStockEmail').checked.toString()
    };
    
    try {
        await fetchAPI('/admin/settings', {
            method: 'POST',
            body: { settings }
        });
        showToast('Settings saved successfully', 'success');
    } catch (error) {
        showToast('Failed to save settings', 'error');
    }
}

// ==========================================
// DATA EXPORT
// ==========================================

async function exportOrders() {
    try {
        const token = sessionStorage.getItem('adminToken');
        const response = await fetch(`${API_URL}/admin/export/orders`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) throw new Error('Export failed');
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `orders-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
        
        showToast('Orders exported successfully', 'success');
    } catch (error) {
        showToast('Failed to export orders', 'error');
    }
}

async function exportProducts() {
    try {
        const token = sessionStorage.getItem('adminToken');
        const response = await fetch(`${API_URL}/admin/export/products`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) throw new Error('Export failed');
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `products-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
        
        showToast('Products exported successfully', 'success');
    } catch (error) {
        showToast('Failed to export products', 'error');
    }
}

async function exportCustomers() {
    // Export customers as CSV from loaded data
    if (customersState.length === 0) {
        showToast('No customers to export', 'error');
        return;
    }
    
    const headers = ['Name', 'Email', 'Phone', 'Orders', 'Lifetime Value', 'First Order', 'Last Order'];
    const rows = customersState.map(c => [
        `"${(c.customer_name || '').replace(/"/g, '""')}"`,
        c.customer_email,
        `"${(c.customer_phone || '').replace(/"/g, '""')}"`,
        c.order_count || 0,
        c.lifetime_value || 0,
        c.first_order_date || '',
        c.last_order_date || ''
    ].join(','));
    
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `customers-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
    
    showToast('Customers exported successfully', 'success');
}

// ==========================================
// EVENT LISTENERS
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // Auth
    elements.loginForm.addEventListener('submit', handleLogin);
    elements.logoutBtn.addEventListener('click', handleLogout);
    
    // Navigation
    elements.navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            navigateTo(item.dataset.section);
        });
    });
    
    // Filters
    elements.orderSearch.addEventListener('input', () => renderOrdersTable(state.orders));
    elements.orderFilter.addEventListener('change', () => renderOrdersTable(state.orders));
    elements.productSearch.addEventListener('input', () => renderProductsTable(state.products));
    elements.inventoryFilter.addEventListener('change', () => renderInventoryTable(state.inventory));
    
    // Customer search
    const customerSearch = document.getElementById('customerSearch');
    if (customerSearch) {
        customerSearch.addEventListener('input', () => renderCustomersTable(customersState));
    }
    
    // Settings form
    const settingsForm = document.getElementById('settingsForm');
    if (settingsForm) {
        settingsForm.addEventListener('submit', saveSettings);
    }
    
    // Export buttons
    const exportOrdersBtn = document.getElementById('exportOrdersBtn');
    if (exportOrdersBtn) exportOrdersBtn.addEventListener('click', exportOrders);
    
    const exportProductsBtn = document.getElementById('exportProductsBtn');
    if (exportProductsBtn) exportProductsBtn.addEventListener('click', exportProducts);
    
    const exportCustomersBtn = document.getElementById('exportCustomersBtn');
    if (exportCustomersBtn) exportCustomersBtn.addEventListener('click', exportCustomers);
    
    // Check auth
    checkAuth();
});

// Close modals on escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeOrderModal();
        closeProductModal();
        closeInventoryModal();
    }
});

// Close modals on overlay click
window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        e.target.style.display = 'none';
    }
});
