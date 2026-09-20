#!/usr/bin/env node

import { cp, copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const root = process.cwd();
const dist = resolve(root, 'dist');

const files = [
    'la-vague-red-wordmark.png',
    'src/config/sentry-env.js',
    'src/config/sentry-browser.js'
];

const directories = [
    ['assets', 'assets'],
    ['src/scripts', 'src/scripts'],
    ['src/styles', 'src/styles']
];

await mkdir(dist, { recursive: true });

for (const file of files) {
    const destination = resolve(dist, file);
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(resolve(root, file), destination);
}

for (const [source, destination] of directories) {
    await cp(resolve(root, source), resolve(dist, destination), {
        recursive: true,
        force: true
    });
}

console.log(
    `Copied ${files.length} non-public runtime files and ${directories.length} browser asset directories to dist/`
);
