/**
 * LA VAGUE Order Email Templates
 * Professional, high-end minimalist design matching the brand aesthetic
 */

// Brand colors
const BRAND = {
    primary: '#dc2626',      // LA VAGUE primary red
    secondary: '#0a0a0a',    // Deep black
    text: '#111111',
    textLight: '#666666',
    bg: '#fcfcfc',
    border: '#eeeeee',
    white: '#ffffff'
};

/**
 * Format price - ensure we don't divide by 100 if the value is already in Naira
 */
function formatPrice(amount, currency = '₦') {
    if (amount === undefined || amount === null) return `${currency}0`;
    // If the amount is very large (like 1,000,000 cents), we might need to divide,
    // but typically our backend stores whole Naira for NGN.
    // Based on logs, total: 33986, we should just format it as is.
    const numericAmount = Number(amount);
    return `${currency}${numericAmount.toLocaleString('en-NG')}`;
}

/**
 * Format date
 */
function formatDate(dateString) {
    if (!dateString) return new Date().toLocaleDateString('en-NG');
    const date = new Date(dateString);
    return date.toLocaleDateString('en-NG', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

/**
 * Generate order items HTML
 */
function generateOrderItems(items) {
    if (!items || !Array.isArray(items) || items.length === 0) {
        return '<tr><td style="padding: 20px; text-align: center; color: #999;">No items found</td></tr>';
    }

    return items.map(item => `
        <tr>
            <td style="padding: 20px 0; border-bottom: 1px solid ${BRAND.border};">
                <table cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                        <td width="80" style="vertical-align: top;">
                            <img src="${item.image || 'https://la-vague.store/favicon.svg'}" alt="${item.name}" style="width: 70px; height: 90px; object-fit: cover; background: #f4f4f4;" />
                        </td>
                        <td style="vertical-align: top; padding-left: 20px;">
                            <p style="margin: 0; font-size: 14px; font-weight: 700; text-transform: uppercase; color: ${BRAND.secondary}; letter-spacing: 0.5px;">${item.name}</p>
                            <p style="margin: 5px 0 0 0; font-size: 12px; color: ${BRAND.textLight}; text-transform: uppercase;">${item.color || 'Default'} / ${item.size || 'OS'}</p>
                            <p style="margin: 5px 0 0 0; font-size: 12px; color: ${BRAND.textLight};">QUANTITY: ${item.quantity}</p>
                        </td>
                        <td style="vertical-align: top; text-align: right;">
                            <p style="margin: 0; font-size: 14px; font-weight: 700; color: ${BRAND.secondary};">${formatPrice(item.price * item.quantity)}</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    `).join('');
}

/**
 * Generate shipping address HTML
 */
function generateShippingAddress(address) {
    if (!address) return 'N/A';
    
    // Support both snake_case and camelCase
    const name = address.fullName || address.full_name || '';
    const addr = address.address || '';
    const city = address.city || '';
    const state = address.state || '';
    
    return `
        <p style="margin: 0; font-size: 14px; line-height: 1.6; color: ${BRAND.text};">
            <strong>${name}</strong><br>
            ${addr}<br>
            ${city}${state ? `, ${state}` : ''}<br>
            Nigeria
        </p>
    `;
}

/**
 * Base email template wrapper
 */
function baseTemplate(content, subject, orderId) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${subject}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap');
        body { font-family: 'Inter', Helvetica, Arial, sans-serif !important; }
        @media only screen and (max-width: 600px) {
            .container { width: 100% !important; padding: 10px !important; }
            .header-logo { width: 120px !important; }
        }
    </style>
</head>
<body style="margin: 0; padding: 0; background-color: ${BRAND.bg}; -webkit-font-smoothing: antialiased;">
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: ${BRAND.bg};">
        <tr>
            <td align="center" style="padding: 40px 0;">
                <table cellpadding="0" cellspacing="0" border="0" width="600" class="container" style="max-width: 600px; background-color: ${BRAND.white}; border: 1px solid ${BRAND.border};">
                    <!-- Top Border Accent -->
                    <tr><td height="4" style="background-color: ${BRAND.primary};"></td></tr>
                    
                    <!-- Logo Header -->
                    <tr>
                        <td align="center" style="padding: 40px 0 30px 0;">
                            <a href="https://la-vague.store" target="_blank">
                                <img src="https://la-vague.store/la-vague-red-wordmark.png" alt="LA VAGUE" width="160" class="header-logo" style="display: block;" />
                            </a>
                        </td>
                    </tr>
                    
                    ${content}
                    
                    <!-- Footer Info -->
                    <tr>
                        <td style="padding: 40px; background-color: ${BRAND.secondary}; color: #ffffff; text-align: center;">
                            <p style="margin: 0 0 15px 0; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; font-weight: 700;">LA VAGUE STREETWEAR</p>
                            <p style="margin: 0 0 20px 0; font-size: 13px; color: #888; line-height: 1.6;">
                                High-end contemporary streetwear designed for those who move against the grain.
                            </p>
                            <table align="center" cellpadding="0" cellspacing="0" border="0">
                                <tr>
                                    <td style="padding: 0 10px;"><a href="https://la-vague.store/shop" style="color: #ffffff; text-decoration: none; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Shop</a></td>
                                    <td style="padding: 0 10px;"><a href="https://la-vague.store/track-order" style="color: #ffffff; text-decoration: none; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Track</a></td>
                                    <td style="padding: 0 10px;"><a href="https://la-vague.store/contact" style="color: #ffffff; text-decoration: none; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Support</a></td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
                
                <table cellpadding="0" cellspacing="0" border="0" width="600" class="container">
                    <tr>
                        <td style="padding: 30px 0; text-align: center;">
                            <p style="margin: 0; font-size: 11px; color: #999; text-transform: uppercase; letter-spacing: 1px;">
                                © ${new Date().getFullYear()} LA VAGUE. NIGERIA.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
}

/**
 * Generate order email based on status
 */
export function generateOrderEmail(order, status) {
    const isConfirmation = status === 'pending' || status === 'processing';
    const subject = isConfirmation 
        ? `Order Confirmed - ${order.id}` 
        : `Order Status Update: ${status.toUpperCase()} - ${order.id}`;

    const title = isConfirmation ? 'ORDER CONFIRMED' : `ORDER ${status.toUpperCase()}`;
    const message = isConfirmation 
        ? `Hi ${order.customer_name || 'there'}, your order has been received and is being processed. We'll notify you as soon as it ships.`
        : `Hi ${order.customer_name || 'there'}, your order status has been updated to ${status}.`;

    const content = `
        <!-- Hero Message -->
        <tr>
            <td style="padding: 0 40px 40px 40px; text-align: center;">
                <h2 style="margin: 0 0 15px 0; font-size: 24px; font-weight: 700; color: ${BRAND.secondary}; letter-spacing: -0.5px;">${title}</h2>
                <p style="margin: 0; font-size: 15px; color: ${BRAND.textLight}; line-height: 1.6;">${message}</p>
                <div style="margin-top: 30px;">
                    <a href="https://la-vague.store/track-order.html?orderId=${order.id}" style="display: inline-block; padding: 15px 35px; background-color: ${BRAND.secondary}; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase;">View Your Order</a>
                </div>
            </td>
        </tr>

        <!-- Order Info Grid -->
        <tr>
            <td style="padding: 0 40px 40px 40px;">
                <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-top: 1px solid ${BRAND.border}; border-bottom: 1px solid ${BRAND.border}; padding: 25px 0;">
                    <tr>
                        <td width="50%" style="vertical-align: top;">
                            <p style="margin: 0 0 5px 0; font-size: 11px; font-weight: 700; color: ${BRAND.textLight}; text-transform: uppercase; letter-spacing: 1px;">Order Number</p>
                            <p style="margin: 0; font-size: 14px; font-weight: 700; color: ${BRAND.secondary};">${order.id}</p>
                        </td>
                        <td width="50%" style="vertical-align: top; text-align: right;">
                            <p style="margin: 0 0 5px 0; font-size: 11px; font-weight: 700; color: ${BRAND.textLight}; text-transform: uppercase; letter-spacing: 1px;">Date</p>
                            <p style="margin: 0; font-size: 14px; font-weight: 700; color: ${BRAND.secondary};">${formatDate(order.created_at || order.createdAt)}</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>

        <!-- Order Items -->
        <tr>
            <td style="padding: 0 40px;">
                <h3 style="margin: 0 0 10px 0; font-size: 13px; font-weight: 700; color: ${BRAND.secondary}; text-transform: uppercase; letter-spacing: 1px;">Your Items</h3>
                <table cellpadding="0" cellspacing="0" border="0" width="100%">
                    ${generateOrderItems(order.items)}
                </table>
            </td>
        </tr>

        <!-- Summary & Address -->
        <tr>
            <td style="padding: 30px 40px 40px 40px;">
                <table cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                        <!-- Shipping Address -->
                        <td width="55%" style="vertical-align: top;">
                            <h3 style="margin: 0 0 15px 0; font-size: 13px; font-weight: 700; color: ${BRAND.secondary}; text-transform: uppercase; letter-spacing: 1px;">Delivery</h3>
                            ${generateShippingAddress(order.shipping_address || order.shippingAddress)}
                        </td>
                        
                        <!-- Totals -->
                        <td width="45%" style="vertical-align: top; padding-left: 20px;">
                            <table cellpadding="0" cellspacing="0" border="0" width="100%">
                                <tr>
                                    <td style="padding-bottom: 8px;"><p style="margin: 0; font-size: 13px; color: ${BRAND.textLight};">Subtotal</p></td>
                                    <td style="padding-bottom: 8px; text-align: right;"><p style="margin: 0; font-size: 13px; color: ${BRAND.secondary};">${formatPrice(order.subtotal)}</p></td>
                                </tr>
                                <tr>
                                    <td style="padding-bottom: 8px;"><p style="margin: 0; font-size: 13px; color: ${BRAND.textLight};">Shipping</p></td>
                                    <td style="padding-bottom: 8px; text-align: right;"><p style="margin: 0; font-size: 13px; color: ${BRAND.secondary};">${formatPrice(order.shipping_cost || order.shippingCost || 0)}</p></td>
                                </tr>
                                ${order.discount ? `
                                <tr>
                                    <td style="padding-bottom: 8px;"><p style="margin: 0; font-size: 13px; color: ${BRAND.primary};">Discount</p></td>
                                    <td style="padding-bottom: 8px; text-align: right;"><p style="margin: 0; font-size: 13px; color: ${BRAND.primary};">-${formatPrice(order.discount)}</p></td>
                                </tr>` : ''}
                                <tr>
                                    <td style="padding-top: 10px; border-top: 1px solid ${BRAND.border};"><p style="margin: 0; font-size: 15px; font-weight: 700; color: ${BRAND.secondary};">TOTAL</p></td>
                                    <td style="padding-top: 10px; border-top: 1px solid ${BRAND.border}; text-align: right;"><p style="margin: 0; font-size: 18px; font-weight: 700; color: ${BRAND.secondary};">${formatPrice(order.total)}</p></td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    `;

    return {
        subject,
        html: baseTemplate(content, subject, order.id)
    };
}

/**
 * Generate order confirmation email
 */
export function generateOrderConfirmationEmail(order) {
    return generateOrderEmail(order, 'pending');
}

/**
 * Generate order status update email
 */
export function generateOrderStatusEmail(order, newStatus) {
    return generateOrderEmail(order, newStatus);
}

/**
 * Generate test email preview
 */
export function generateTestEmail(order, status = 'pending') {
    const sampleOrder = order || {
        id: 'LV-TEST123',
        customer_name: 'John Doe',
        customer_email: 'john@example.com',
        created_at: new Date().toISOString(),
        items: [
            {
                name: 'Classic Oversized Hoodie',
                price: 145000,
                quantity: 1,
                color: 'Black',
                size: 'L',
                image: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=200'
            }
        ],
        subtotal: 145000,
        shipping_cost: 5000,
        discount: 0,
        total: 150000,
        shipping_address: {
            fullName: 'John Doe',
            address: '123 Luxury Lane',
            city: 'Lagos',
            state: 'Lagos'
        }
    };

    return generateOrderEmail(sampleOrder, status);
}

export default {
    generateOrderEmail,
    generateOrderConfirmationEmail,
    generateOrderStatusEmail,
    generateTestEmail
};
