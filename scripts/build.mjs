import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tsc = resolve(root, 'node_modules', 'typescript', 'bin', 'tsc');
execFileSync(process.execPath, [tsc, '-p', 'tsconfig.json'], { cwd: root, stdio: 'inherit' });
const cjs = resolve(root, 'dist', 'cjs');
mkdirSync(cjs, { recursive: true });
execFileSync(process.execPath, [tsc, '-p', 'tsconfig.cjs.json'], { cwd: root, stdio: 'inherit' });
writeFileSync(resolve(cjs, 'package.json'), JSON.stringify({ type: 'commonjs' }, null, 2) + '\n');
cpSync(resolve(root, 'src', 'style.css'), resolve(root, 'dist', 'style.css'));
