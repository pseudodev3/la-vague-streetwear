/**
 * LA VAGUE - Track Order Page Logic
 */
(function() {
    const API_BASE_URL = window.location.hostname === 'localhost' 
        ? 'http://localhost:3000/api' 
        : 'https://la-vague-api.onrender.com/api';
    
    const trackForm = document.getElementById('trackOrderForm');
    const trackBtn = document.getElementById('trackBtn');
    const errorMessage = document.getElementById('errorMessage');
    const orderResult = document.getElementById('orderResult');
    
    // Status configurations
    const statusConfig = {
        pending: { label: 'Pending', class: 'pending', steps: ['Order Placed'] },
        processing: { label: 'Processing', class: 'processing', steps: ['Order Placed', 'Processing'] },
        shipped: { label: 'Shipped', class: 'shipped', steps: ['Order Placed', 'Processing', 'Shipped'] },
        delivered: { label: 'Delivered', class: 'delivered', steps: ['Order Placed', 'Processing', 'Shipped', 'Delivered'] },
        cancelled: { label: 'Cancelled', class: 'cancelled', steps: ['Order Placed', 'Cancelled'] }
    };
    
    trackForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const orderId = document.getElementById('orderId').value.trim();
        const email = document.getElementById('email').value.trim();
        
        // Reset states
        errorMessage.classList.remove('active');
        orderResult.classList.remove('active');
        
        // Validate
        if (!orderId || !email) {
            showError('Please enter both order ID and email address.');
            return;
        }
        
        // Set loading state
        const originalText = trackBtn.textContent;
        trackBtn.textContent = 'Tracking...';
        trackBtn.disabled = true;
        
        try {
            const response = await fetch(`${API_BASE_URL}/orders/lookup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId, email })
            });
            
            const data = await response.json();
            
            if (!response.ok || !data.success) {
                showError(data.error || 'Order not found. Please check your order ID and email.');
                return;
            }
            
            displayOrder(data.order);
            
        } catch (error) {
            console.error('Track order error:', error);
            showError('Unable to track order. Please try again later.');
        } finally {
            trackBtn.textContent = originalText;
            trackBtn.disabled = false;
        }
    });
    
    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.classList.add('active');
    }
    
    function displayOrder(order) {
        const config = statusConfig[order.order_status || order.status] || statusConfig.pending;
        
        // Update header info
        document.getElementById('resultOrderId').textContent = `Order #${order.id}`;
        document.getElementById('resultOrderDate').textContent = `Placed on ${formatDate(order.created_at || order.createdAt)}`;
        
        const statusBadge = document.getElementById('resultStatus');
        statusBadge.textContent = config.label;
        statusBadge.className = `order-status-badge ${config.class}`;
        
        // Update info grid
        document.getElementById('resultTotal').textContent = CurrencyConfig.formatPrice(order.total);
        document.getElementById('resultItems').textContent = `${getItemCount(order)} items`;
        document.getElementById('resultShipping').textContent = formatAddress(order);
        document.getElementById('resultTracking').textContent = order.tracking_number || order.trackingNumber || '-';
        
        // Build timeline
        buildTimeline(config.steps, order.order_status || order.status);
        
        // Build items list
        buildItemsList(order);
        
        // Show result
        orderResult.classList.add('active');
        orderResult.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    
    function buildTimeline(completedSteps, currentStatus) {
        const timeline = document.getElementById('trackingTimeline');
        const steps = [
            { key: 'Order Placed', title: 'Order Placed', desc: 'We\'ve received your order' },
            { key: 'Processing', title: 'Processing', desc: 'We\'re preparing your items' },
            { key: 'Shipped', title: 'Shipped', desc: 'Your order is on its way' },
            { key: 'Delivered', title: 'Delivered', desc: 'Package delivered successfully' }
        ];
        
        if (currentStatus === 'cancelled') {
            steps[1] = { key: 'Cancelled', title: 'Cancelled', desc: 'Order has been cancelled' };
            steps.length = 2;
        }
        
        const currentStepIndex = completedSteps.length - 1;
        
        timeline.innerHTML = steps.map((step, index) => {
            const isCompleted = index <= currentStepIndex;
            const isActive = index === currentStepIndex;
            const statusClass = isActive ? 'active' : (isCompleted ? 'completed' : '');
            
            return `
                <div class="tracking-step ${statusClass}">
                    <div class="tracking-step-time">${isCompleted ? 'Completed' : 'Pending'}</div>
                    <div class="tracking-step-title">${step.title}</div>
                    <div class="tracking-step-desc">${step.desc}</div>
                </div>
            `;
        }).join('');
    }
    
    function buildItemsList(order) {
        const container = document.getElementById('orderItems');
        const items = order.items || [];
        
        if (items.length === 0) {
            container.innerHTML = '<p style="color: var(--color-text-muted);">No item details available.</p>';
            return;
        }
        
        container.innerHTML = items.map(item => `
            <div class="order-item">
                <img src="${item.image || '/assets/hoodie.jpg'}" alt="${item.name}" class="order-item-image">
                <div class="order-item-details">
                    <div class="order-item-name">${item.name}</div>
                    <div class="order-item-variant">${item.color || ''} / ${item.size || ''} × ${item.quantity}</div>
                </div>
                <div class="order-item-price">${CurrencyConfig.formatPrice(item.price * item.quantity)}</div>
            </div>
        `).join('');
    }
    
    function getItemCount(order) {
        const items = order.items || [];
        return items.reduce((sum, item) => sum + (item.quantity || 1), 0);
    }
    
    function formatDate(dateString) {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        });
    }
    
    function formatAddress(order) {
        const city = order.shipping_city || order.shippingCity || '';
        const state = order.shipping_state || order.shippingState || '';
        const country = order.shipping_country || order.shippingCountry || 'Nigeria';
        
        const parts = [city, state].filter(Boolean);
        return parts.length > 0 ? `${parts.join(', ')}, ${country}` : country;
    }
    
    // Check for URL params (e.g., ?order=ORD-123&email=user@example.com)
    const urlParams = new URLSearchParams(window.location.search);
    const paramOrderId = urlParams.get('order');
    const paramEmail = urlParams.get('email');
    
    if (paramOrderId && paramEmail) {
        document.getElementById('orderId').value = paramOrderId;
        document.getElementById('email').value = paramEmail;
        const trackForm = document.getElementById('trackOrderForm');
        trackForm.dispatchEvent(new Event('submit'));
    }

    // Initialize locale selector for track order page (Language only)
    function initTrackOrderLocale() {
        const localeBtn = document.getElementById('localeBtn');
        const localeDropdown = document.getElementById('localeDropdown');
        
        if (!localeBtn || !localeDropdown) return;
        
        const currentLang = localStorage.getItem('preferredLanguage') || 'en';
        
        // Update display - language only
        const localeCurrent = document.getElementById('localeCurrent');
        if (localeCurrent) {
            localeCurrent.textContent = currentLang.toUpperCase();
        }
        
        // Language options
        document.querySelectorAll('#languageOptions .locale-option').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.lang === currentLang);
            btn.addEventListener('click', () => {
                localStorage.setItem('preferredLanguage', btn.dataset.lang);
                document.documentElement.lang = btn.dataset.lang;
                document.documentElement.dir = btn.dataset.lang === 'ar' ? 'rtl' : 'ltr';
                window.location.reload();
            });
        });
        
        // Toggle dropdown
        localeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            localeDropdown.classList.toggle('active');
        });
        
        // Close on outside click
        document.addEventListener('click', () => {
            localeDropdown.classList.remove('active');
        });
        
        localeDropdown.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTrackOrderLocale);
    } else {
        initTrackOrderLocale();
    }
})();
