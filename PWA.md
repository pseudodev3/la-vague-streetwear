# LA VAGUE - Progressive Web App (PWA)

This document describes the PWA features implemented for LA VAGUE Streetwear.

## Features

### ✅ Implemented

- **Service Worker** - Caches static assets for offline browsing
- **Web App Manifest** - Enables "Add to Home Screen" on mobile devices
- **Offline Support** - Browse products even without internet connection
- **Background Sync** - Cart data syncs when connection returns
- **Update Notifications** - Users are notified when a new version is available

### 📱 Mobile Features

- Standalone app mode (no browser chrome)
- Splash screen on iOS
- Theme color matching brand
- Home screen shortcuts for Shop and Cart

## File Structure

```
la-vague/
├── sw.js                          # Service Worker
├── site.webmanifest               # PWA Manifest
├── src/scripts/pwa-register.js    # Service Worker Registration
├── assets/icons/                  # PWA Icons (generated from favicon.svg)
│   ├── icon-72x72.png
│   ├── icon-96x96.png
│   ├── icon-128x128.png
│   ├── icon-144x144.png
│   ├── icon-152x152.png
│   ├── icon-192x192.png
│   ├── icon-384x384.png
│   └── icon-512x512.png
└── PWA.md                         # This file
```

## Generating Icons

To generate PNG icons from the SVG favicon:

```bash
# Install sharp (one-time)
npm install sharp --save-dev

# Generate icons
node scripts/generate-pwa-icons.js
```

Or manually create PNG icons in `assets/icons/` with the sizes listed above.

## Caching Strategy

| Resource Type | Strategy | Description |
|--------------|----------|-------------|
| Static Assets (JS/CSS/HTML) | Cache First | Served from cache, updated in background |
| Images | Cache First | Cached with background refresh |
| API Calls | Network Only | Never cached, always fresh data |
| Payment Scripts | Network Only | Never intercepted by service worker |

## Testing PWA

### Chrome DevTools

1. Open DevTools → Application tab
2. Check Service Workers section
3. Test "Offline" checkbox in Network tab
4. Verify app works without internet

### Lighthouse Audit

```bash
# In Chrome DevTools → Lighthouse
# Run PWA category audit
```

### Mobile Testing

1. Deploy to HTTPS-enabled server
2. Open on Android Chrome or iOS Safari
3. Look for "Add to Home Screen" prompt
4. Verify app launches in standalone mode

## Debugging

### Clear Service Worker Caches

Open browser console and run:

```javascript
// Clear all PWA caches
PWA.clearCaches().then(() => location.reload());
```

Or manually:

```javascript
// In DevTools Application tab
// Service Workers → Unregister
// Storage → Clear site data
```

### Check PWA Status

```javascript
// Check if PWA is supported and registered
console.log(PWA);
// Output: { isSupported: true, isRegistered: true, clearCaches: fn }
```

## Updates

When you deploy a new version:

1. Service worker detects the change
2. New assets are cached in the background
3. User sees update notification
4. Clicking "Update" refreshes the page with new version

### Forcing Updates

If you need all users to get the latest version immediately:

1. Change `CACHE_NAME` in `sw.js` (e.g., `'la-vague-v2'`)
2. Deploy the new service worker
3. Old caches will be automatically cleaned up

## Browser Support

| Browser | Support |
|---------|---------|
| Chrome/Edge | ✅ Full support |
| Firefox | ✅ Full support |
| Safari | ✅ Full support (iOS 11.3+) |
| Samsung Internet | ✅ Full support |

## Known Limitations

- **Checkout requires internet** - Payment processing needs connectivity
- **Inventory updates** - Stock levels refresh when connection returns
- **Order tracking** - Requires internet to fetch latest status

## Security Notes

- Service worker only runs on HTTPS (or localhost during development)
- API calls are never cached (prevent stale data)
- Payment-related scripts bypass service worker
- No sensitive data stored in caches

## Troubleshooting

### Service Worker Not Registering

1. Check HTTPS is enabled (required for production)
2. Verify `sw.js` is accessible at root: `https://yoursite.com/sw.js`
3. Check browser console for errors

### Cache Not Updating

1. Use `PWA.clearCaches()` in console
2. Unregister service worker in DevTools
3. Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)

### Icons Not Showing

1. Verify icons exist in `assets/icons/`
2. Check icon paths in `site.webmanifest`
3. Test manifest in DevTools → Application → Manifest
