/**
 * LA VAGUE - Admin Panel JavaScript
 */

// DEBUG - This should always show
console.log('=== ADMIN.JS LOADED ===');
console.log('Current URL:', window.location.href);
console.log('localStorage orders:', localStorage.getItem('orders'));

document.addEventListener('DOMContentLoaded', () => {
    console.log('=== DOM LOADED ===');
    
    // ==========================================
    // CONFIG
    // ==========================================
    const ADMIN_PASSWORD = 'lavague2024'; // Change this in production!
    const API_URL = window.location.hostname === 'localhost' 
        ? 'http://localhost:3000/api' 
        : 'https://la-vague-api.onrender.com/api';

    // ==========================================
    // STATE
    // ==========================================
    const state = {
        isAuthenticated: false,
        currentTab: 'dashboard',
        orders: [],
        products: [],
        stats: {
            totalSales: 0,
            totalOrders: 0,
            totalProducts: 0
        }
    };

    // ==========================================
    // DOM ELEMENTS
    // ==========================================
    const elements = {
        loginScreen: document.getElementById('loginScreen'),
        adminDashboard: document.getElementById('adminDashboard'),
        loginForm: document.getElementById('loginForm'),
        logoutBtn: document.getElementById('logoutBtn'),
        navItems: document.querySelectorAll('.nav-item'),
        tabContents: document.querySelectorAll('.tab-content'),
        toastContainer: document.getElementById('toastContainer')
    };

    // ==========================================
    // AUTHENTICATION
    // ==========================================
    function checkAuth() {
        const auth = sessionStorage.getItem('adminAuth');
        if (auth === 'true') {
            state.isAuthenticated = true;
            showDashboard();
            loadDashboardData();
        }
    }

    function handleLogin(e) {
        e.preventDefault();
        const password = document.getElementById('adminPassword').value;
        
        if (password === ADMIN_PASSWORD) {
            state.isAuthenticated = true;
            sessionStorage.setItem('adminAuth', 'true');
            showDashboard();
            loadDashboardData();
            showToast('Login successful', 'success');
        } else {
            showToast('Invalid password', 'error');
            document.getElementById('adminPassword').value = '';
        }
    }

    function handleLogout() {
        state.isAuthenticated = false;
        sessionStorage.removeItem('adminAuth');
        showLogin();
        showToast('Logged out', 'success');
    }

    function showLogin() {
        elements.loginScreen.style.display = 'flex';
        elements.adminDashboard.style.display = 'none';
    }

    function showDashboard() {
        elements.loginScreen.style.display = 'none';
        elements.adminDashboard.style.display = 'grid';
    }

    // ==========================================
    // NAVIGATION
    // ==========================================
    function switchTab(tabName) {
        state.currentTab = tabName;
        
        // Update nav
        elements.navItems.forEach(item => {
            item.classList.toggle('active', item.dataset.tab === tabName);
        });
        
        // Update content
        elements.tabContents.forEach(content => {
            content.classList.toggle('active', content.id === tabName + 'Tab');
        });
        
        // Load tab data
        if (tabName === 'orders') loadOrders();
        if (tabName === 'products') loadProducts();
    }

    // Admin API Key (should match server ADMIN_KEY env variable)
    const ADMIN_KEY = 'lavague2024';

    // ==========================================
    // DATA LOADING
    // ==========================================
    async function loadDashboardData() {
        console.log('Loading dashboard data...');
        console.log('localStorage orders:', localStorage.getItem('orders'));
        
        try {
            // Try to fetch from API first
            let orders = [];
            let products = PRODUCTS || [];
            
            try {
                const response = await fetch(`${API_URL}/admin/stats?key=${ADMIN_KEY}`);
                
                if (response.ok) {
                    const data = await response.json();
                    state.stats = data.stats;
                    
                    // Also fetch recent orders
                    const ordersResponse = await fetch(`${API_URL}/admin/orders?key=${ADMIN_KEY}`);
                    
                    if (ordersResponse.ok) {
                        const ordersData = await ordersResponse.json();
                        orders = ordersData.orders || [];
                        console.log('Orders loaded from API:', orders.length);
                    }
                } else {
                    const errorData = await response.json().catch(() => ({}));
                    console.error('API error:', response.status, errorData);
                    throw new Error('API error: ' + (errorData.error || response.status));
                }
            } catch (apiError) {
                console.log('API not available, using localStorage fallback');
                console.log('API Error:', apiError);
            }
            
            // Always ALSO check localStorage (merge with API orders)
            const localOrders = JSON.parse(localStorage.getItem('orders') || '[]');
            console.log('Local orders count:', localOrders.length);
            
            // If API returned no orders, use localStorage
            if (orders.length === 0 && localOrders.length > 0) {
                orders = localOrders;
                state.stats.totalOrders = orders.length;
                state.stats.totalProducts = products.length;
                state.stats.totalSales = orders.reduce((sum, order) => sum + (order.total || 0), 0);
            }
            
            // Update UI
            document.getElementById('totalSales').textContent = '$' + (state.stats.totalSales || 0).toLocaleString();
            document.getElementById('totalOrders').textContent = state.stats.totalOrders || 0;
            document.getElementById('totalProducts').textContent = state.stats.totalProducts || products.length;
            document.getElementById('ordersBadge').textContent = state.stats.totalOrders || 0;
            
            // Load recent orders
            loadRecentOrders(orders.slice(0, 5));
        } catch (error) {
            console.error('Error loading dashboard:', error);
            showToast('Error loading data', 'error');
        }
    }

    function loadRecentOrders(orders) {
        const tbody = document.getElementById('recentOrdersTable');
        
        if (orders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem;">No orders yet</td></tr>';
            return;
        }
        
        tbody.innerHTML = orders.map(order => {
            // Handle both API format (snake_case) and localStorage format (camelCase)
            const firstName = order.first_name || order.firstName || (order.customer_name ? order.customer_name.split(' ')[0] : '');
            const lastName = order.last_name || order.lastName || (order.customer_name ? order.customer_name.split(' ').slice(1).join(' ') : '');
            const date = order.created_at || order.date;
            const orderStatus = order.order_status || order.status || 'pending';
            
            return `
            <tr onclick="viewOrder('${order.id}')" style="cursor: pointer;">
                <td><strong>${order.id}</strong></td>
                <td>${firstName} ${lastName}</td>
                <td>${new Date(date).toLocaleDateString()}</td>
                <td>$${order.total || 0}</td>
                <td><span class="status-badge ${orderStatus}">${orderStatus}</span></td>
            </tr>
        `}).join('');
    }

    async function loadOrders() {
        const tbody = document.getElementById('ordersTable');
        const filter = document.getElementById('orderStatusFilter')?.value || 'all';
        
        console.log('Loading orders...');
        
        let orders = [];
        
        // Try API first
        try {
            let url = `${API_URL}/admin/orders?key=${ADMIN_KEY}`;
            if (filter !== 'all') {
                url += `&status=${filter}`;
            }
            
            const response = await fetch(url);
            
            if (response.ok) {
                const data = await response.json();
                orders = data.orders || [];
                state.orders = orders;
                console.log('Loaded orders from API:', orders.length, orders);
            } else {
                const errorData = await response.json().catch(() => ({}));
                console.error('API error loading orders:', response.status, errorData);
            }
        } catch (apiError) {
            console.log('API not available:', apiError);
        }
        
        // Always ALSO load from localStorage
        try {
            const localOrders = JSON.parse(localStorage.getItem('orders') || '[]');
            console.log('Loaded orders from localStorage:', localOrders.length);
            
            // If no API orders, use localStorage
            if (orders.length === 0) {
                orders = localOrders;
                state.orders = orders;
            }
        } catch (e) {
            console.error('Error reading localStorage:', e);
        }
        
        // Apply filter
        let filteredOrders = orders;
        if (filter !== 'all') {
            filteredOrders = orders.filter(o => o.status === filter);
        }
        
        if (filteredOrders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem;">No orders found</td></tr>';
            return;
        }
        
        tbody.innerHTML = filteredOrders.map(order => {
            // Handle both API format (snake_case) and localStorage format (camelCase)
            const firstName = order.first_name || order.firstName;
            const lastName = order.last_name || order.lastName;
            const date = order.created_at || order.date;
            
            return `
                <tr>
                    <td><strong>${order.id}</strong></td>
                    <td>${firstName} ${lastName}</td>
                    <td>${order.email}</td>
                    <td>${new Date(date).toLocaleDateString()}</td>
                    <td>${order.items?.length || 0}</td>
                    <td>$${order.total}</td>
                    <td><span class="status-badge ${order.status}">${order.status}</span></td>
                    <td>
                        <button class="btn-action" onclick="viewOrder('${order.id}')">View</button>
                        <button class="btn-action" onclick="updateOrderStatus('${order.id}')">Update</button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    function loadProducts() {
        const products = PRODUCTS || [];
        const tbody = document.getElementById('productsTable');
        
        tbody.innerHTML = products.map(product => {
            const totalStock = Object.values(product.inventory || {}).reduce((a, b) => a + b, 0);
            return `
                <tr>
                    <td><img src="${product.images[0]?.src}" alt="${product.name}"></td>
                    <td><strong>${product.name}</strong></td>
                    <td>${product.category}</td>
                    <td>$${product.price}</td>
                    <td>${totalStock}</td>
                    <td><span class="status-badge ${totalStock > 0 ? 'active' : 'draft'}">${totalStock > 0 ? 'Active' : 'Out of Stock'}</span></td>
                    <td>
                        <button class="btn-action" onclick="editProduct('${product.id}')">Edit</button>
                        <button class="btn-action delete" onclick="deleteProduct('${product.id}')">Delete</button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // ==========================================
    // ORDER MANAGEMENT
    // ==========================================
    window.viewOrder = async function(orderId) {
        let order = null;
        
        // Try to find in state first (from API)
        order = state.orders.find(o => o.id === orderId);
        
        // If not found, try localStorage
        if (!order) {
            const localOrders = JSON.parse(localStorage.getItem('orders') || '[]');
            order = localOrders.find(o => o.id === orderId);
        }
        
        if (!order) {
            showToast('Order not found', 'error');
            return;
        }
        
        // Handle both API format (snake_case) and localStorage format (camelCase)
        const customerName = order.customer_name || (order.firstName ? `${order.firstName} ${order.lastName}` : '');
        const nameParts = customerName ? customerName.split(' ') : ['', ''];
        const firstName = order.first_name || order.firstName || nameParts[0];
        const lastName = order.last_name || order.lastName || nameParts.slice(1).join(' ');
        const email = order.customer_email || order.email;
        const phone = order.customer_phone || order.phone;
        const shippingCost = order.shipping_cost || order.shippingCost || 0;
        const paystackRef = order.payment_reference || order.paystack_reference || order.paystackReference;
        const createdAt = order.created_at || order.date;
        const orderStatus = order.order_status || order.status || 'pending';
        
        // Parse shipping address (could be JSON string or object)
        let shippingAddress = order.shipping_address || {};
        if (typeof shippingAddress === 'string') {
            try { shippingAddress = JSON.parse(shippingAddress); } catch(e) {}
        }
        const address = shippingAddress.address || order.address || '';
        const apartment = shippingAddress.apartment || order.apartment || '';
        const city = shippingAddress.city || order.city || '';
        const state = shippingAddress.state || order.state || '';
        const zip = shippingAddress.zip || order.zip || '';
        
        // Parse items (could be JSON string or array)
        let items = order.items || [];
        if (typeof items === 'string') {
            try { items = JSON.parse(items); } catch(e) {}
        }
        
        const modalBody = document.getElementById('orderModalBody');
        modalBody.innerHTML = `
            <div class="order-detail">
                <div class="detail-section">
                    <h4>Order Information</h4>
                    <p><strong>Order ID:</strong> ${order.id}</p>
                    <p><strong>Date:</strong> ${new Date(createdAt).toLocaleString()}</p>
                    <p><strong>Status:</strong> <span class="status-badge ${orderStatus}">${orderStatus}</span></p>
                    <p><strong>Payment:</strong> ${paystackRef ? 'Paid via Paystack' : 'Pending'}</p>
                </div>
                
                <div class="detail-section">
                    <h4>Customer</h4>
                    <p><strong>Name:</strong> ${firstName} ${lastName}</p>
                    <p><strong>Email:</strong> ${email}</p>
                    <p><strong>Phone:</strong> ${phone}</p>
                </div>
                
                <div class="detail-section">
                    <h4>Shipping Address</h4>
                    <p>${address}</p>
                    ${apartment ? `<p>${apartment}</p>` : ''}
                    <p>${city}, ${state} ${zip}</p>
                </div>
                
                <div class="detail-section">
                    <h4>Items</h4>
                    <table class="items-table">
                        ${items.map(item => `
                            <tr>
                                <td>${item.name}</td>
                                <td>${item.color || ''} / ${item.size || ''}</td>
                                <td>x${item.quantity}</td>
                                <td>$${item.price * item.quantity}</td>
                            </tr>
                        `).join('') || '<tr><td colspan="4">No items</td></tr>'}
                    </table>
                </div>
                
                <div class="detail-section">
                    <h4>Payment Summary</h4>
                    <p><strong>Subtotal:</strong> $${order.subtotal || 0}</p>
                    <p><strong>Shipping:</strong> $${shippingCost}</p>
                    ${order.discount ? `<p><strong>Discount:</strong> -$${order.discount}</p>` : ''}
                    <p><strong>Total:</strong> $${order.total || 0}</p>
                </div>
            </div>
        `;
        
        document.getElementById('orderModalOverlay').classList.add('active');
        document.getElementById('orderModal').classList.add('active');
    };

    window.closeOrderModal = function() {
        document.getElementById('orderModalOverlay').classList.remove('active');
        document.getElementById('orderModal').classList.remove('active');
    };

    window.updateOrderStatus = async function(orderId) {
        const statuses = ['pending', 'processing', 'shipped', 'delivered'];
        
        // Try to find order
        let order = state.orders.find(o => o.id === orderId);
        let fromLocalStorage = false;
        
        if (!order) {
            const localOrders = JSON.parse(localStorage.getItem('orders') || '[]');
            const orderIndex = localOrders.findIndex(o => o.id === orderId);
            if (orderIndex === -1) {
                showToast('Order not found', 'error');
                return;
            }
            order = localOrders[orderIndex];
            fromLocalStorage = true;
        }
        
        // Handle both API format (order_status) and localStorage format (status)
        const currentStatus = order.order_status || order.status || 'pending';
        const currentIndex = statuses.indexOf(currentStatus);
        const nextStatus = statuses[(currentIndex + 1) % statuses.length];
        
        try {
            // Try to update via API
            const response = await fetch(`${API_URL}/admin/orders/${orderId}/status?key=${ADMIN_KEY}`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status: nextStatus })
            });
            
            if (response.ok) {
                showToast(`Order ${orderId} updated to ${nextStatus}`, 'success');
            } else {
                throw new Error('API update failed');
            }
        } catch (error) {
            // Fallback to localStorage
            if (fromLocalStorage) {
                const localOrders = JSON.parse(localStorage.getItem('orders') || '[]');
                const orderIndex = localOrders.findIndex(o => o.id === orderId);
                if (orderIndex !== -1) {
                    localOrders[orderIndex].status = nextStatus;
                    localStorage.setItem('orders', JSON.stringify(localOrders));
                }
            }
            showToast(`Order ${orderId} updated to ${nextStatus} (local only)`, 'success');
        }
        
        loadOrders();
    };

    // ==========================================
    // PRODUCT MANAGEMENT
    // ==========================================
    window.editProduct = function(productId) {
        const product = PRODUCTS.find(p => p.id === productId);
        if (!product) return;
        
        document.getElementById('productId').value = product.id;
        document.getElementById('editProductName').value = product.name;
        document.getElementById('editProductPrice').value = product.price;
        document.getElementById('editProductDesc').value = product.description;
        document.getElementById('editProductCategory').value = product.category;
        document.getElementById('editProductStatus').value = 'active';
        document.getElementById('productModalTitle').textContent = 'Edit Product';
        
        document.getElementById('productModalOverlay').classList.add('active');
        document.getElementById('productModal').classList.add('active');
    };

    window.closeProductModal = function() {
        document.getElementById('productModalOverlay').classList.remove('active');
        document.getElementById('productModal').classList.remove('active');
    };

    document.getElementById('addProductBtn')?.addEventListener('click', () => {
        document.getElementById('productForm').reset();
        document.getElementById('productId').value = '';
        document.getElementById('productModalTitle').textContent = 'Add Product';
        document.getElementById('productModalOverlay').classList.add('active');
        document.getElementById('productModal').classList.add('active');
    });

    document.getElementById('productForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const productId = document.getElementById('productId').value;
        const productData = {
            name: document.getElementById('editProductName').value,
            price: parseInt(document.getElementById('editProductPrice').value),
            description: document.getElementById('editProductDesc').value,
            category: document.getElementById('editProductCategory').value
        };
        
        if (productId) {
            // Edit existing
            const product = PRODUCTS.find(p => p.id === productId);
            if (product) {
                Object.assign(product, productData);
                showToast('Product updated', 'success');
            }
        } else {
            // Add new
            showToast('Product added (demo only - reload to see)', 'success');
        }
        
        closeProductModal();
        loadProducts();
    });

    window.deleteProduct = function(productId) {
        if (!confirm('Are you sure you want to delete this product?')) return;
        showToast('Product deleted (demo)', 'success');
        loadProducts();
    };

    // ==========================================
    // TOAST NOTIFICATIONS
    // ==========================================
    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <span class="toast-message">${message}</span>
            <button class="toast-close" onclick="this.parentElement.remove()">×</button>
        `;
        
        elements.toastContainer.appendChild(toast);
        
        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // ==========================================
    // EVENT BINDING
    // ==========================================
    function bindEvents() {
        // Login
        elements.loginForm?.addEventListener('submit', handleLogin);
        elements.logoutBtn?.addEventListener('click', handleLogout);
        
        // Navigation
        elements.navItems.forEach(item => {
            item.addEventListener('click', () => switchTab(item.dataset.tab));
        });
        
        // Order filter
        document.getElementById('orderStatusFilter')?.addEventListener('change', loadOrders);
        
        // Close modals on overlay click
        document.getElementById('orderModalOverlay')?.addEventListener('click', closeOrderModal);
        document.getElementById('productModalOverlay')?.addEventListener('click', closeProductModal);
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeOrderModal();
                closeProductModal();
            }
        });
    }

    // ==========================================
    // INITIALIZATION
    // ==========================================
    function init() {
        checkAuth();
        bindEvents();
    }

    init();
});
