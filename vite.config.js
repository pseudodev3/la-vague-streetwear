/**
 * LA VAGUE - Vite Configuration
 * Build tool for modern development with backward compatibility
 */

import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // Root directory for Vite
  root: '.',
  
  // Public directory for static assets
  publicDir: 'public',
  
  // Build configuration
  build: {
    // Output directory
    outDir: 'dist',
    
    // Clean output directory before build
    emptyOutDir: true,
    
    // Generate source maps for debugging
    sourcemap: true,
    
    // Minify for production
    minify: 'terser',
    
    // Rollup options for multi-page application
    rollupOptions: {
      input: {
        // Main pages
        main: resolve(__dirname, 'index.html'),
        shop: resolve(__dirname, 'shop.html'),
        product: resolve(__dirname, 'product.html'),
        checkout: resolve(__dirname, 'checkout.html'),
        cart: resolve(__dirname, 'cart.html'),
        admin: resolve(__dirname, 'admin.html'),
        // Info pages
        faq: resolve(__dirname, 'faq.html'),
        shipping: resolve(__dirname, 'shipping.html'),
        returns: resolve(__dirname, 'returns.html'),
        contact: resolve(__dirname, 'contact.html'),
        orderConfirmation: resolve(__dirname, 'order-confirmation.html'),
        '404': resolve(__dirname, '404.html'),
      },
    },
  },
  
  // Development server configuration
  server: {
    // Port for dev server
    port: 3000,
    
    // Open browser on start
    open: true,
    
    // Hot Module Replacement
    hmr: true,
    
    // Proxy API requests to backend
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  
  // CSS configuration
  css: {
    devSourcemap: true,
  },
  
  // Resolve aliases for cleaner imports
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@js': resolve(__dirname, 'src/scripts'),
      '@css': resolve(__dirname, 'src/styles'),
      '@assets': resolve(__dirname, 'public/assets'),
    },
  },
  
  // Optimize dependencies
  optimizeDeps: {
    include: [],
  },
  
  // Esbuild target
  esbuild: {
    target: 'es2020',
  },
});
