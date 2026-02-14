/**
 * LA VAGUE Email Templates
 * Export all email templates and services
 */

export { 
    generateOrderEmail, 
    generateOrderConfirmationEmail, 
    generateOrderStatusEmail,
    generateTestEmail 
} from './order-email-template.js';

export { 
    sendOrderConfirmation, 
    sendOrderStatusUpdate, 
    testEmailConfig, 
    previewEmail, 
    sendTestEmail,
    getEmailQueueStats,
    isEmailConfigured,
    getEmailConfig,
    sendReviewConfirmationEmail,
    sendNewReviewNotification
} from './email-service.js';

export { default as emailService } from './email-service.js';
