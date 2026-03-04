#!/usr/bin/env node
/**
 * LA VAGUE - PWA Icon Generator
 * Generates PNG icons from the SVG favicon for PWA manifest
 * Requires: npm install sharp (optional dependency)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];
const OUTPUT_DIR = path.join(__dirname, '..', 'assets', 'icons');
const SOURCE_SVG = path.join(__dirname, '..', 'favicon.svg');

async function generateIcons() {
    // Check if sharp is available
    let sharp;
    try {
        sharp = (await import('sharp')).default;
    } catch (error) {
        console.log('[PWA] Sharp not installed. Install with: npm install sharp --save-dev');
        console.log('[PWA] Creating placeholder icons...');
        createPlaceholderIcons();
        return;
    }

    // Ensure output directory exists
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // Read source SVG
    const svgBuffer = fs.readFileSync(SOURCE_SVG);

    console.log('[PWA] Generating icons...');

    for (const size of SIZES) {
        const outputPath = path.join(OUTPUT_DIR, `icon-${size}x${size}.png`);
        
        try {
            await sharp(svgBuffer)
                .resize(size, size, { fit: 'contain', background: { r: 10, g: 10, b: 10, alpha: 1 } })
                .png()
                .toFile(outputPath);
            
            console.log(`[PWA] Generated: icon-${size}x${size}.png`);
        } catch (error) {
            console.error(`[PWA] Failed to generate icon-${size}x${size}.png:`, error.message);
        }
    }

    console.log('[PWA] Icon generation complete!');
}

function createPlaceholderIcons() {
    // Create a simple placeholder - in production, you'd use actual PNG icons
    const placeholderData = {
        note: 'These are placeholder icon files.',
        instruction: 'Run "npm install sharp --save-dev" and then "node scripts/generate-pwa-icons.js" to generate real PNG icons from favicon.svg',
        alternative: 'Or manually create PNG icons in assets/icons/ with sizes: 72x72, 96x96, 128x128, 144x144, 152x152, 192x192, 384x384, 512x512'
    };

    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // Create a placeholder file
    fs.writeFileSync(
        path.join(OUTPUT_DIR, 'README.txt'),
        JSON.stringify(placeholderData, null, 2)
    );

    console.log('[PWA] Placeholder created at assets/icons/README.txt');
    console.log('[PWA] To generate real icons, install sharp: npm install sharp --save-dev');
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    generateIcons();
}

export { generateIcons };
