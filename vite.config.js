import { defineConfig } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const page = filename => resolve(__dirname, filename);

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    minify: 'terser',
    rollupOptions: {
      input: {
        main: page('index.html'),
        shop: page('shop.html'),
        product: page('product.html'),
        checkout: page('checkout.html'),
        admin: page('admin.html'),
        faq: page('faq.html'),
        shipping: page('shipping.html'),
        returns: page('returns.html'),
        contact: page('contact.html'),
        orderConfirmation: page('order-confirmation.html'),
        trackOrder: page('track-order.html'),
        privacyPolicy: page('privacy-policy.html'),
        refundPolicy: page('refund-policy.html'),
        termsOfService: page('terms-of-service.html'),
        apiDocs: page('api-docs.html'),
        notFound: page('404.html')
      }
    }
  },
  server: {
    port: 3000,
    strictPort: true,
    open: true,
    hmr: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false
      }
    }
  },
  preview: {
    port: 4173,
    strictPort: true
  },
  css: {
    devSourcemap: true
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@js': resolve(__dirname, 'src/scripts'),
      '@css': resolve(__dirname, 'src/styles'),
      '@assets': resolve(__dirname, 'assets')
    }
  },
  esbuild: {
    target: 'es2020'
  }
});
