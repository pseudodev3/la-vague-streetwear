/**
 * LA VAGUE - Cloudinary Image Upload Service
 */

import { v2 as cloudinary } from 'cloudinary';
import streamifier from 'streamifier';

// Configure Cloudinary
const hasCloudinaryConfig = !!(process.env.CLOUDINARY_CLOUD_NAME && 
                               process.env.CLOUDINARY_API_KEY && 
                               process.env.CLOUDINARY_API_SECRET);

console.log('[CLOUDINARY] Config check:', { 
    hasConfig: hasCloudinaryConfig,
    hasCloudName: !!process.env.CLOUDINARY_CLOUD_NAME,
    hasApiKey: !!process.env.CLOUDINARY_API_KEY,
    hasApiSecret: !!process.env.CLOUDINARY_API_SECRET
});

if (hasCloudinaryConfig) {
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
        secure: true
    });
    console.log('[CLOUDINARY] Configured successfully');
} else {
    console.warn('[CLOUDINARY] Configuration missing - image uploads will use placeholder URLs');
}

/**
 * Upload an image buffer to Cloudinary
 * @param {Buffer} fileBuffer - The file buffer from multer
 * @param {string} folder - Folder path in Cloudinary (e.g., 'products', 'categories')
 * @param {string} publicId - Optional custom public ID
 * @returns {Promise<Object>} Cloudinary upload result
 */
export async function uploadImage(fileBuffer, folder = 'products', publicId = null) {
    // If Cloudinary is not configured, return a placeholder
    if (!hasCloudinaryConfig) {
        console.warn('[CLOUDINARY] Not configured, returning placeholder URL');
        return {
            secure_url: `https://via.placeholder.com/800x1000/333/fff?text=Product+Image`,
            public_id: `placeholder-${Date.now()}`
        };
    }
    
    // Additional safety check - ensure cloudinary is properly initialized
    if (!cloudinary.config().cloud_name) {
        console.warn('[CLOUDINARY] Cloud name not set, returning placeholder URL');
        return {
            secure_url: `https://via.placeholder.com/800x1000/333/fff?text=Product+Image`,
            public_id: `placeholder-${Date.now()}`
        };
    }
    
    return new Promise((resolve, reject) => {
        const uploadOptions = {
            folder: `la-vague/${folder}`,
            resource_type: 'image',
            transformation: [
                { quality: 'auto:good' },
                { fetch_format: 'auto' }
            ]
        };

        if (publicId) {
            uploadOptions.public_id = publicId;
        }

        const uploadStream = cloudinary.uploader.upload_stream(
            uploadOptions,
            (error, result) => {
                if (error) {
                    console.error('[CLOUDINARY] Upload error:', error);
                    reject(new Error('Failed to upload image'));
                } else {
                    console.log('[CLOUDINARY] Upload successful:', result.secure_url);
                    resolve(result);
                }
            }
        );

        streamifier.createReadStream(fileBuffer).pipe(uploadStream);
    });
}

/**
 * Upload multiple images
 * @param {Array<{buffer: Buffer, originalname: string}>} files - Array of file objects
 * @param {string} folder - Folder path
 * @returns {Promise<Array>} Array of upload results
 */
export async function uploadMultipleImages(files, folder = 'products') {
    const uploadPromises = files.map(async (file, index) => {
        const publicId = `${Date.now()}_${index}`;
        try {
            return await uploadImage(file.buffer, folder, publicId);
        } catch (error) {
            console.error(`[CLOUDINARY] Failed to upload image ${index}:`, error.message);
            // Return placeholder on individual failure
            return {
                secure_url: `https://via.placeholder.com/800x1000/333/fff?text=Image+${index + 1}`,
                public_id: `placeholder-${Date.now()}-${index}`
            };
        }
    });

    return Promise.all(uploadPromises);
}

/**
 * Delete an image from Cloudinary
 * @param {string} publicId - The public ID of the image
 * @returns {Promise<Object>} Deletion result
 */
export async function deleteImage(publicId) {
    try {
        const result = await cloudinary.uploader.destroy(publicId);
        console.log('[CLOUDINARY] Deleted:', publicId);
        return result;
    } catch (error) {
        console.error('[CLOUDINARY] Delete error:', error);
        throw error;
    }
}

/**
 * Delete multiple images
 * @param {Array<string>} publicIds - Array of public IDs
 * @returns {Promise<Array>} Array of deletion results
 */
export async function deleteMultipleImages(publicIds) {
    const deletePromises = publicIds.map(id => deleteImage(id));
    return Promise.all(deletePromises);
}

/**
 * Extract public ID from Cloudinary URL
 * @param {string} url - Cloudinary URL
 * @returns {string|null} Public ID
 */
export function getPublicIdFromUrl(url) {
    if (!url) return null;
    
    try {
        const urlObj = new URL(url);
        const pathParts = urlObj.pathname.split('/');
        const uploadIndex = pathParts.indexOf('upload');
        
        if (uploadIndex === -1) return null;
        
        // Get everything after 'upload' (excluding version number if present)
        const relevantParts = pathParts.slice(uploadIndex + 1);
        
        // Remove version number (starts with 'v' followed by digits)
        if (relevantParts[0]?.match(/^v\d+$/)) {
            relevantParts.shift();
        }
        
        // Join remaining parts and remove file extension
        const publicId = relevantParts.join('/').replace(/\.[^/.]+$/, '');
        return publicId;
    } catch (error) {
        console.error('[CLOUDINARY] Error extracting public ID:', error);
        return null;
    }
}

/**
 * Generate optimized image URL
 * @param {string} url - Original Cloudinary URL
 * @param {Object} options - Transformation options
 * @returns {string} Optimized URL
 */
export function getOptimizedUrl(url, options = {}) {
    if (!url || !url.includes('cloudinary.com')) return url;
    
    const defaultOptions = {
        quality: 'auto:good',
        fetch_format: 'auto',
        ...options
    };
    
    // If URL already has transformations, append new ones
    if (url.includes('/upload/')) {
        const transformationString = Object.entries(defaultOptions)
            .map(([key, value]) => `${key}_${value}`)
            .join(',');
        
        return url.replace('/upload/', `/upload/${transformationString}/`);
    }
    
    return url;
}

export default {
    uploadImage,
    uploadMultipleImages,
    deleteImage,
    deleteMultipleImages,
    getPublicIdFromUrl,
    getOptimizedUrl
};
