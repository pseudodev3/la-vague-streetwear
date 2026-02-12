/**
 * LA VAGUE - Professional Admin Dashboard
 */

// ==========================================
// CONFIG
// ==========================================
const API_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:3000/api' 
    : 'https://la-vague-api.onrender.com/api';

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
    updateInventoryBtn: document.getElementById('updateInventoryBtn')
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
        console.error('Login error:', error);
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
            console.error('Logout error:', error);
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
        inventory: 'Inventory'
    };
    elements.pageTitle.textContent = titles[section];
    
    // Load section data
    if (section === 'orders') loadOrders();
    if (section === 'products') loadProducts();
    if (section === 'inventory') loadInventory();
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
        console.error('Error loading data:', error);
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
        console.error('Error loading stats:', error);
    }
}

async function loadRecentOrders() {
    try {
        const data = await fetchAPI('/admin/orders');
        state.orders = data.orders || [];
        
        const recent = state.orders.slice(0, 5);
        
        if (recent.length === 0) {
            elements.recentOrdersTable.innerHTML = '<tr><td colspan="4" class="text-center">No orders yet</td></tr>';
            return;
        }
        
        elements.recentOrdersTable.innerHTML = recent.map(order => `
            <tr onclick="viewOrder('${order.id}')" style="cursor: pointer;">
                <td><strong>${order.id}</strong></td>
                <td>${order.customer_name || order.customerName || ''}</td>
                <td>$${order.total || 0}</td>
                <td><span class="status-badge ${order.order_status || order.status}">${order.order_status || order.status}</span></td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading recent orders:', error);
        elements.recentOrdersTable.innerHTML = '<tr><td colspan="4" class="text-center">Error loading orders</td></tr>';
    }
}

async function loadLowStock() {
    try {
        const data = await fetchAPI('/admin/inventory/low-stock?threshold=10');
        const lowStock = data.lowStock || [];
        
        elements.lowStockCount.textContent = lowStock.length;
        elements.lowStockCount.style.display = lowStock.length > 0 ? 'inline-flex' : 'none';
        
        if (lowStock.length === 0) {
            elements.lowStockTable.innerHTML = '<tr><td colspan="3" class="text-center">No low stock items</td></tr>';
            return;
        }
        
        elements.lowStockTable.innerHTML = lowStock.slice(0, 5).map(item => `
            <tr>
                <td>${item.productName}</td>
                <td>${item.color} / ${item.size}</td>
                <td><span class="stock-badge ${item.quantity <= 5 ? 'critical' : 'warning'}">${item.quantity}</span></td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading low stock:', error);
    }
}

async function loadOrders() {
    showLoading(true);
    
    try {
        const data = await fetchAPI('/admin/orders');
        state.orders = data.orders || [];
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
    
    if (filtered.length === 0) {
        elements.ordersTable.innerHTML = '<tr><td colspan="8" class="text-center">No orders found</td></tr>';
        return;
    }
    
    elements.ordersTable.innerHTML = filtered.map(order => {
        const items = order.items || [];
        const status = order.order_status || order.status || 'pending';
        
        return `
            <tr>
                <td><strong>${order.id}</strong></td>
                <td>${order.customer_name || order.firstName + ' ' + order.lastName || ''}</td>
                <td>${order.customer_email || order.email || ''}</td>
                <td>${formatDate(order.created_at || order.date)}</td>
                <td>${items.length}</td>
                <td>$${order.total || 0}</td>
                <td><span class="status-badge ${status}">${status}</span></td>
                <td>
                    <button class="btn btn-sm btn-secondary" onclick="viewOrder('${order.id}')">View</button>
                    <button class="btn btn-sm btn-primary" onclick="updateOrderStatus('${order.id}')">Update</button>
                </td>
            </tr>
        `;
    }).join('');
}

async function loadProducts() {
    showLoading(true);
    
    try {
        const data = await fetchAPI('/admin/products');
        state.products = data.products || [];
        renderProductsTable(state.products);
    } catch (error) {
        console.error('Error loading products:', error);
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
    
    if (filtered.length === 0) {
        elements.productsTable.innerHTML = '<tr><td colspan="7" class="text-center">No products found</td></tr>';
        return;
    }
    
    elements.productsTable.innerHTML = filtered.map(product => {
        const variantCount = (product.colors?.length || 1) * (product.sizes?.length || 1);
        const imageUrl = product.images?.[0]?.src || 'https://via.placeholder.com/50';
        
        return `
            <tr>
                <td><img src="${imageUrl}" alt="${product.name}" class="product-thumb"></td>
                <td><strong>${product.name}</strong></td>
                <td>${product.category}</td>
                <td>$${product.price}</td>
                <td>${variantCount} variants</td>
                <td><span class="status-badge ${product.badge ? 'active' : 'draft'}">${product.badge || 'Active'}</span></td>
                <td>
                    <button class="btn btn-sm btn-secondary" onclick="editProduct('${product.id}')">Edit</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteProduct('${product.id}')">Delete</button>
                </td>
            </tr>
        `;
    }).join('');
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
        console.error('Error loading inventory:', error);
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
    
    if (filtered.length === 0) {
        elements.inventoryTable.innerHTML = '<tr><td colspan="6" class="text-center">No inventory items</td></tr>';
        return;
    }
    
    elements.inventoryTable.innerHTML = filtered.map(item => `
        <tr>
            <td>${item.productName}</td>
            <td>${item.color} / ${item.size}</td>
            <td>${item.total}</td>
            <td>${item.reserved}</td>
            <td><span class="stock-badge ${item.available <= 5 ? 'critical' : item.available <= 10 ? 'warning' : 'good'}">${item.available}</span></td>
            <td>
                <button class="btn btn-sm btn-secondary" onclick="editInventory('${item.productId}', '${item.color}', '${item.size}', ${item.total})">Edit</button>
            </td>
        </tr>
    `).join('');
}

// ==========================================
// ORDER MANAGEMENT
// ==========================================
window.viewOrder = async function(orderId) {
    const order = state.orders.find(o => o.id === orderId);
    if (!order) return;
    
    const items = order.items || [];
    const shippingAddress = typeof order.shipping_address === 'string' 
        ? JSON.parse(order.shipping_address || '{}') 
        : (order.shipping_address || {});
    
    elements.orderModalTitle.textContent = `Order ${orderId}`;
    elements.orderModalBody.innerHTML = `
        <div class="order-details">
            <div class="order-section">
                <h4>Customer Information</h4>
                <p><strong>Name:</strong> ${order.customer_name || order.firstName + ' ' + order.lastName}</p>
                <p><strong>Email:</strong> ${order.customer_email || order.email}</p>
                <p><strong>Phone:</strong> ${order.customer_phone || order.phone || 'N/A'}</p>
            </div>
            
            <div class="order-section">
                <h4>Shipping Address</h4>
                <p>${shippingAddress.address || order.address || ''}</p>
                ${shippingAddress.apartment || order.apartment ? `<p>${shippingAddress.apartment || order.apartment}</p>` : ''}
                <p>${shippingAddress.city || order.city || ''}, ${shippingAddress.state || order.state || ''} ${shippingAddress.zip || order.zip || ''}</p>
            </div>
            
            <div class="order-section">
                <h4>Items</h4>
                <table class="table table-sm">
                    <thead>
                        <tr><th>Item</th><th>Variant</th><th>Qty</th><th>Price</th></tr>
                    </thead>
                    <tbody>
                        ${items.map(item => `
                            <tr>
                                <td>${item.name}</td>
                                <td>${item.color} / ${item.size}</td>
                                <td>${item.quantity}</td>
                                <td>$${item.price}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            
            <div class="order-section">
                <h4>Payment Summary</h4>
                <p><strong>Subtotal:</strong> $${order.subtotal || 0}</p>
                <p><strong>Shipping:</strong> $${order.shipping_cost || order.shippingCost || 0}</p>
                ${order.discount ? `<p><strong>Discount:</strong> -$${order.discount}</p>` : ''}
                <p class="text-bold"><strong>Total:</strong> $${order.total || 0}</p>
            </div>
        </div>
    `;
    
    elements.orderModal.style.display = 'flex';
};

window.closeOrderModal = function() {
    elements.orderModal.style.display = 'none';
};

window.updateOrderStatus = async function(orderId) {
    const statuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
    const order = state.orders.find(o => o.id === orderId);
    if (!order) return;
    
    const currentStatus = order.order_status || order.status || 'pending';
    const currentIndex = statuses.indexOf(currentStatus);
    const nextStatus = statuses[(currentIndex + 1) % statuses.length];
    
    try {
        await fetchAPI(`/admin/orders/${orderId}/status`, {
            method: 'POST',
            body: JSON.stringify({ status: nextStatus })
        });
        
        showToast(`Order ${orderId} updated to ${nextStatus}`, 'success');
        loadOrders();
    } catch (error) {
        console.error('Update order error:', error);
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
        console.error('Error saving product:', error);
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
    if (state.productForm.images.length === 0) {
        elements.imagePreviewGrid.innerHTML = '';
        return;
    }
    
    elements.imagePreviewGrid.innerHTML = state.productForm.images.map((img, index) => `
        <div class="image-preview">
            <img src="${img.src}" alt="Preview ${index + 1}">
            <button type="button" class="image-remove" onclick="removeImage(${index})">&times;</button>
        </div>
    `).join('');
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
    elements.colorsContainer.innerHTML = state.productForm.colors.map((color, index) => `
        <div class="variant-chip">
            <span class="color-dot" style="background-color: ${color.value}"></span>
            <span>${color.name}</span>
            <button type="button" onclick="removeColor(${index})">&times;</button>
        </div>
    `).join('');
    
    // Render sizes
    elements.sizesContainer.innerHTML = state.productForm.sizes.map((size, index) => `
        <div class="variant-chip">
            <span>${size}</span>
            <button type="button" onclick="removeSize(${index})">&times;</button>
        </div>
    `).join('');
    
    // Render inventory grid
    renderInventoryGrid();
}

function renderInventoryGrid() {
    const colors = state.productForm.colors.length > 0 ? state.productForm.colors : [{ name: 'Default' }];
    const sizes = state.productForm.sizes.length > 0 ? state.productForm.sizes : ['OS'];
    
    if (colors.length === 0 || sizes.length === 0) {
        elements.inventoryContainer.innerHTML = '<p class="text-muted">Add colors and sizes to manage inventory</p>';
        return;
    }
    
    let html = '<table class="table table-sm"><thead><tr><th>Variant</th><th>Stock</th></tr></thead><tbody>';
    
    colors.forEach(color => {
        sizes.forEach(size => {
            const variantKey = `${color.name}-${size}`;
            const stock = state.productForm.inventory[variantKey] || 0;
            
            html += `
                <tr>
                    <td>
                        <span class="color-dot" style="background-color: ${color.value}"></span>
                        ${color.name} / ${size}
                    </td>
                    <td>
                        <input type="number" min="0" value="${stock}" 
                            onchange="updateInventoryValue('${variantKey}', this.value)"
                            class="input input-sm" style="width: 80px;">
                    </td>
                </tr>
            `;
        });
    });
    
    html += '</tbody></table>';
    elements.inventoryContainer.innerHTML = html;
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
