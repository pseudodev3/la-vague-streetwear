/**
 * LA VAGUE Email Service
 * Handles sending order emails with queue support and retry logic
 */

import nodemailer from 'nodemailer';
import { 
    generateOrderConfirmationEmail, 
    generateOrderStatusEmail,
    generateTestEmail 
} from './order-email-template.js';

// Transporter instance (Singleton for reuse)
let globalTransporter = null;

/**
 * Get or create the nodemailer transporter
 */
function getTransporter() {
    if (globalTransporter) return globalTransporter;

    const provider = process.env.EMAIL_PROVIDER || 'smtp';
    let config = {};
    
    // Gmail configuration
    if (provider === 'gmail') {
        config = {
            service: 'gmail',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        };
    } 
    // Brevo (Sendinblue) configuration - Hardened for Render compatibility
    else if (provider === 'brevo' || provider === 'sendinblue') {
        config = {
            host: 'smtp-relay.brevo.com',
            port: 587,
            secure: false, // STARTTLS
            auth: {
                user: process.env.BREVO_USER || process.env.SMTP_USER,
                pass: process.env.BREVO_PASS || process.env.SMTP_PASS
            },
            tls: {
                // Essential for many cloud environments to prevent handshake hangs
                rejectUnauthorized: false,
                minVersion: 'TLSv1.2'
            },
            connectionTimeout: 20000, // 20 seconds
            greetingTimeout: 20000,
            socketTimeout: 30000
        };
    }
    // SendGrid configuration
    else if (provider === 'sendgrid') {
        config = {
            host: 'smtp.sendgrid.net',
            port: 587,
            auth: {
                user: 'apikey',
                pass: process.env.SENDGRID_API_KEY
            }
        };
    }
    // Generic SMTP (default)
    else {
        config = {
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            },
            tls: {
                rejectUnauthorized: process.env.NODE_ENV === 'production'
            }
        };
    }

    globalTransporter = nodemailer.createTransport(config);
    return globalTransporter;
}

// Email queue for reliability
class EmailQueue {
    constructor() {
        this.queue = [];
        this.processing = false;
        this.maxRetries = 3;
        this.retryDelay = 5000; // 5 seconds
    }

    add(job) {
        this.queue.push({
            ...job,
            attempts: 0,
            createdAt: Date.now()
        });
        this.process();
    }

    async process() {
        if (this.processing || this.queue.length === 0) return;
        
        this.processing = true;
        
        while (this.queue.length > 0) {
            const job = this.queue[0];
            
            try {
                await this.executeJob(job);
                this.queue.shift(); // Remove successful job
            } catch (error) {
                job.attempts++;
                console.error(`[EMAIL QUEUE] Job failed (attempt ${job.attempts}/${this.maxRetries}):`, error.message);
                
                if (job.attempts >= this.maxRetries) {
                    console.error(`[EMAIL QUEUE] Max retries reached, removing job:`, job.to);
                    this.queue.shift();
                    // Log failed email for manual review
                    this.logFailedEmail(job, error);
                } else {
                    // Wait before retry
                    await this.delay(this.retryDelay * job.attempts);
                }
            }
        }
        
        this.processing = false;
    }

    async executeJob(job) {
        // Priority 1: Brevo API (Most reliable on Render/Cloud)
        if (process.env.BREVO_API_KEY && (process.env.EMAIL_PROVIDER === 'brevo' || process.env.EMAIL_PROVIDER === 'sendinblue')) {
            await this.sendViaBrevoAPI(job);
            return;
        }

        // Priority 2: SMTP (Standard fallback)
        const transporter = getTransporter();
        await transporter.sendMail(job.mailOptions);
        console.log(`[EMAIL] Sent via SMTP to ${job.to} - ${job.subject}`);
    }

    async sendViaBrevoAPI(job) {
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'content-type': 'application/json',
                'api-key': process.env.BREVO_API_KEY
            },
            body: JSON.stringify({
                sender: {
                    name: process.env.SMTP_FROM_NAME || 'LA VAGUE',
                    email: process.env.EMAIL_FROM || process.env.BREVO_USER || process.env.SMTP_USER
                },
                to: [{ email: job.to }],
                subject: job.subject,
                htmlContent: job.mailOptions.html,
                textContent: job.mailOptions.text
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Brevo API Error: ${error.message || response.statusText}`);
        }

        console.log(`[EMAIL] Sent via Brevo API to ${job.to} - ${job.subject}`);
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    logFailedEmail(job, error) {
        console.error('[EMAIL FAILED]', {
            to: job.to,
            subject: job.subject,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }

    getStats() {
        return {
            pending: this.queue.length,
            processing: this.processing
        };
    }
}

// Global email queue instance
const emailQueue = new EmailQueue();

/**
 * Send email with queue support
 */
async function sendEmail({ to, subject, html, text, from, replyTo }) {
    // Professional sender logic: 
    // Brevo REQUIRES the 'from' email to be a verified sender in your dashboard.
    // If you verified official@lavague.store, you MUST use that here.
    const senderEmail = process.env.EMAIL_FROM || process.env.BREVO_USER || process.env.SMTP_USER;
    const senderName = process.env.SMTP_FROM_NAME || 'LA VAGUE';

    const mailOptions = {
        from: from || `"${senderName}" <${senderEmail}>`,
        to,
        subject,
        html,
        text: text || '',
        replyTo: replyTo || senderEmail
    };

    console.log(`[EMAIL QUEUE] Queueing email to ${to} from ${senderEmail}`);

    // Add to queue for reliability
    emailQueue.add({
        to,
        subject,
        mailOptions
    });

    return { queued: true, message: 'Email queued for sending' };
}

/**
 * Send order confirmation email
 */
export async function sendOrderConfirmation(order) {
    try {
        const { subject, html } = generateOrderConfirmationEmail(order);
        
        return await sendEmail({
            to: order.customer_email || order.customerEmail,
            subject,
            html,
            text: `Thank you for your order! Order ID: ${order.id}. Total: ₦${(order.total / 100).toFixed(2)}`
        });
    } catch (error) {
        console.error('[EMAIL SERVICE] Failed to send order confirmation:', error);
        throw error;
    }
}

/**
 * Send order status update email
 */
export async function sendOrderStatusUpdate(order, newStatus) {
    try {
        const { subject, html } = generateOrderStatusEmail(order, newStatus);
        
        const statusMessages = {
            pending: 'Your order is pending.',
            processing: 'Your order is now being processed.',
            shipped: 'Your order has been shipped!',
            delivered: 'Your order has been delivered!',
            cancelled: 'Your order has been cancelled.'
        };
        
        return await sendEmail({
            to: order.customer_email || order.customerEmail,
            subject,
            html,
            text: `${statusMessages[newStatus] || 'Your order status has been updated.'} Order ID: ${order.id}`
        });
    } catch (error) {
        console.error('[EMAIL SERVICE] Failed to send status update:', error);
        throw error;
    }
}

/**
 * Test email configuration
 */
export async function testEmailConfig() {
    try {
        const transporter = getTransporter();
        await transporter.verify();
        return { success: true, message: 'Email configuration is valid' };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

/**
 * Preview email (for testing without sending)
 */
export function previewEmail(status = 'pending', sampleOrder = null) {
    const { subject, html } = generateTestEmail(sampleOrder, status);
    return { subject, html };
}

/**
 * Send test email
 */
export async function sendTestEmail(to, status = 'pending') {
    try {
        const { subject, html } = generateTestEmail(null, status);
        
        return await sendEmail({
            to,
            subject: `[TEST] ${subject}`,
            html,
            text: `This is a test email for order status: ${status}`
        });
    } catch (error) {
        console.error('[EMAIL SERVICE] Failed to send test email:', error);
        throw error;
    }
}

/**
 * Get email queue stats
 */
export function getEmailQueueStats() {
    return emailQueue.getStats();
}

/**
 * Check if email service is configured
 */
export function isEmailConfigured() {
    const provider = process.env.EMAIL_PROVIDER || 'smtp';
    
    if (process.env.BREVO_API_KEY) return true;

    if (provider === 'sendgrid') {
        return !!process.env.SENDGRID_API_KEY;
    }
    
    if (provider === 'brevo' || provider === 'sendinblue') {
        return !!((process.env.BREVO_USER || process.env.SMTP_USER) && (process.env.BREVO_PASS || process.env.SMTP_PASS));
    }
    
    return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

/**
 * Get email configuration status
 */
export function getEmailConfig() {
    return {
        provider: process.env.EMAIL_PROVIDER || 'smtp',
        method: process.env.BREVO_API_KEY ? 'API' : 'SMTP',
        host: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
        user: process.env.SMTP_USER || process.env.BREVO_USER ? 'Configured' : null,
        from: process.env.EMAIL_FROM || process.env.SMTP_USER || process.env.BREVO_USER,
        configured: isEmailConfigured()
    };
}

/**
 * Send review confirmation email to customer
 */
export async function sendReviewConfirmationEmail({ customerEmail, customerName, productName, rating, title }) {
    if (!isEmailConfigured()) {
        console.log('[EMAIL] Skipping review confirmation - email not configured');
        return { success: false, reason: 'email_not_configured' };
    }
    
    const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating);
    
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #dc2626;">Thank You for Your Review!</h2>
            <p>Hi ${customerName || 'there'},</p>
            <p>We've received your review for <strong>${productName}</strong>. Our team will review it shortly and it will be published once approved.</p>
            
            <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <div style="color: #f59e0b; font-size: 18px; margin-bottom: 10px;">${stars}</div>
                <p style="font-weight: bold; margin: 0 0 10px 0;">${title || 'No title'}</p>
            </div>
            
            <p>We appreciate you taking the time to share your feedback with us!</p>
            <p>Best regards,<br><strong>LA VAGUE Team</strong></p>
        </div>
    `;
    
    const mailOptions = {
        from: process.env.EMAIL_FROM || process.env.SMTP_USER,
        to: customerEmail,
        subject: 'Thank You for Your Review - LA VAGUE',
        html,
        text: `Thank you for your review of ${productName}! We've received your ${rating}-star review and it will be published after approval.`
    };
    
    emailQueue.add({
        to: customerEmail,
        subject: mailOptions.subject,
        mailOptions
    });
    
    return { success: true };
}

/**
 * Send new review notification to admin
 */
export async function sendNewReviewNotification({ reviewId, productName, customerName, rating, title, reviewText }) {
    if (!isEmailConfigured()) {
        console.log('[EMAIL] Skipping admin review notification - email not configured');
        return { success: false, reason: 'email_not_configured' };
    }
    
    const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_USER;
    const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating);
    
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #dc2626;">New Review Submitted</h2>
            <p>A new review has been submitted and is pending approval.</p>
            
            <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Product:</strong> ${productName}</p>
                <p><strong>Customer:</strong> ${customerName || 'Anonymous'}</p>
                <p><strong>Rating:</strong> <span style="color: #f59e0b;">${stars}</span> (${rating}/5)</p>
                <p><strong>Title:</strong> ${title || 'No title'}</p>
                <p><strong>Review:</strong> ${reviewText || 'No text'}</p>
            </div>
            
            <p>
                <a href="https://la-vague.store/admin.html" style="background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                    Review in Admin
                </a>
            </p>
        </div>
    `;
    
    const mailOptions = {
        from: process.env.EMAIL_FROM || process.env.SMTP_USER,
        to: adminEmail,
        subject: `New Review Pending Approval - ${productName}`,
        html,
        text: `New review submitted for ${productName} by ${customerName || 'Anonymous'}. Rating: ${rating}/5. Review in admin panel.`
    };
    
    emailQueue.add({
        to: adminEmail,
        subject: mailOptions.subject,
        mailOptions
    });
    
    return { success: true };
}

export default {
    sendOrderConfirmation,
    sendOrderStatusUpdate,
    testEmailConfig,
    previewEmail,
    sendTestEmail,
    getEmailQueueStats,
    isEmailConfigured,
    getEmailConfig
};
