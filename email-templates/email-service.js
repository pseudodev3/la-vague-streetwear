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
        const transporter = createTransporter();
        await transporter.sendMail(job.mailOptions);
        console.log(`[EMAIL] Sent to ${job.to} - ${job.subject}`);
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
 * Create nodemailer transporter based on environment configuration
 */
function createTransporter() {
    const provider = process.env.EMAIL_PROVIDER || 'smtp';
    
    // Gmail configuration
    if (provider === 'gmail') {
        return nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });
    }
    
    // SendGrid configuration
    if (provider === 'sendgrid') {
        return nodemailer.createTransport({
            host: 'smtp.sendgrid.net',
            port: 587,
            auth: {
                user: 'apikey',
                pass: process.env.SENDGRID_API_KEY
            }
        });
    }
    
    // Generic SMTP (default)
    return nodemailer.createTransport({
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
    });
}

/**
 * Send email with queue support
 */
async function sendEmail({ to, subject, html, text, from, replyTo }) {
    const mailOptions = {
        from: from || `"${process.env.SMTP_FROM_NAME || 'LA VAGUE'}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
        to,
        subject,
        html,
        text: text || '',
        replyTo: replyTo || process.env.SMTP_FROM || process.env.SMTP_USER
    };

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
        const transporter = createTransporter();
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
    
    if (provider === 'sendgrid') {
        return !!process.env.SENDGRID_API_KEY;
    }
    
    return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

/**
 * Get email configuration status
 */
export function getEmailConfig() {
    return {
        provider: process.env.EMAIL_PROVIDER || 'smtp',
        host: process.env.SMTP_HOST,
        user: process.env.SMTP_USER ? `${process.env.SMTP_USER.substring(0, 3)}...` : null,
        from: process.env.EMAIL_FROM || process.env.SMTP_USER,
        configured: isEmailConfigured()
    };
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
