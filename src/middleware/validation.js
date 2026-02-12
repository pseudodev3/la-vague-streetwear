/**
 * LA VAGUE - Input Validation Middleware
 * Uses express-validator for request validation
 */

import { body, param, validationResult } from 'express-validator';

/**
 * Handle validation errors
 */
export const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            error: 'Validation failed',
            details: errors.array().map(err => ({
                field: err.path,
                message: err.msg
            }))
        });
    }
    next();
};

/**
 * Order creation validation
 */
export const validateCreateOrder = [
    body('customerEmail')
        .trim()
        .isEmail()
        .normalizeEmail()
        .withMessage('Valid email is required'),
    body('customerName')
        .trim()
        .isLength({ min: 2, max: 100 })
        .escape()
        .withMessage('Name must be between 2 and 100 characters'),
    body('customerPhone')
        .optional()
        .trim()
        .matches(/^[\d\s\-\+\(\)]{7,20}$/)
        .withMessage('Invalid phone number format'),
    body('shippingAddress')
        .isObject()
        .withMessage('Shipping address is required'),
    body('shippingAddress.address')
        .trim()
        .isLength({ min: 5, max: 200 })
        .escape()
        .withMessage('Address must be between 5 and 200 characters'),
    body('shippingAddress.city')
        .trim()
        .isLength({ min: 2, max: 50 })
        .escape()
        .withMessage('City must be between 2 and 50 characters'),
    body('shippingAddress.state')
        .trim()
        .isLength({ min: 2, max: 50 })
        .escape()
        .withMessage('State must be between 2 and 50 characters'),
    body('shippingAddress.zip')
        .trim()
        .matches(/^[\w\-\s]{3,10}$/)
        .withMessage('Invalid zip/postal code'),
    body('items')
        .isArray({ min: 1, max: 50 })
        .withMessage('Order must contain 1-50 items'),
    body('items.*.id')
        .trim()
        .isLength({ min: 1, max: 50 })
        .escape()
        .withMessage('Invalid item ID'),
    body('items.*.name')
        .trim()
        .isLength({ min: 1, max: 200 })
        .escape()
        .withMessage('Invalid item name'),
    body('items.*.price')
        .isInt({ min: 0, max: 1000000 })
        .withMessage('Invalid price'),
    body('items.*.quantity')
        .isInt({ min: 1, max: 100 })
        .withMessage('Quantity must be between 1 and 100'),
    body('subtotal')
        .isInt({ min: 0, max: 10000000 })
        .withMessage('Invalid subtotal'),
    body('total')
        .isInt({ min: 0, max: 10000000 })
        .withMessage('Invalid total'),
    body('paymentMethod')
        .trim()
        .isIn(['manual', 'paystack', 'cash'])
        .withMessage('Invalid payment method'),
    handleValidationErrors
];

/**
 * Admin login validation
 */
export const validateAdminLogin = [
    body('password')
        .trim()
        .isLength({ min: 1, max: 100 })
        .withMessage('Password is required'),
    handleValidationErrors
];

/**
 * Order status update validation
 */
export const validateUpdateOrderStatus = [
    param('id')
        .trim()
        .matches(/^[\w\-]{3,50}$/)
        .withMessage('Invalid order ID format'),
    body('status')
        .trim()
        .isIn(['pending', 'processing', 'shipped', 'delivered', 'cancelled'])
        .withMessage('Invalid status value'),
    handleValidationErrors
];

/**
 * Contact form validation
 */
export const validateContactForm = [
    body('name')
        .trim()
        .isLength({ min: 2, max: 100 })
        .escape()
        .withMessage('Name must be between 2 and 100 characters'),
    body('email')
        .trim()
        .isEmail()
        .normalizeEmail()
        .withMessage('Valid email is required'),
    body('subject')
        .optional()
        .trim()
        .isLength({ max: 200 })
        .escape()
        .withMessage('Subject must be less than 200 characters'),
    body('message')
        .trim()
        .isLength({ min: 10, max: 5000 })
        .escape()
        .withMessage('Message must be between 10 and 5000 characters'),
    handleValidationErrors
];

/**
 * UUID validation for IDs
 */
export const validateId = (field = 'id') => [
    param(field)
        .trim()
        .matches(/^[\w\-]{3,50}$/)
        .withMessage(`Invalid ${field} format`),
    handleValidationErrors
];
