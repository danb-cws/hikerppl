// Stamps the built service worker with a unique build version so the browser's
// built-in update check detects a new deploy (it byte-compares sw.js).
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const swPath = resolve(process.cwd(), 'dist', 'sw.js');
const sw = readFileSync(swPath, 'utf8');
const stamped = sw.replace('__BUILD_VERSION__', Date.now().toString(36));
writeFileSync(swPath, stamped);
console.log('Stamped service worker version in dist/sw.js');
