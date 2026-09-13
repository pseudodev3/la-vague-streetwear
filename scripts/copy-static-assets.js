#!/usr/bin/env node

import { copyFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const dist = resolve(root, 'dist');

const files = [
  'favicon.svg',
  'site.webmanifest',
  'sw.js',
  'robots.txt',
  'sitemap.xml',
  'openapi.yaml',
  'la-vague-red-wordmark.png'
];

await mkdir(dist, { recursive: true });

for (const file of files) {
  await copyFile(resolve(root, file), resolve(dist, file));
}

console.log(`Copied ${files.length} static root assets to dist/`);
