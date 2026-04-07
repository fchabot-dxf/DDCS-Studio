#!/usr/bin/env node
/*
  scripts/publish-pages.cjs
  Simple Node helper to publish the project to Cloudflare Pages using the
  `wrangler` CLI. Falls back to a clear error if `wrangler` is not installed.

  Usage:
    node scripts/publish-pages.cjs [--dir=./src] [--project-name=ddcsexpertstudio] [--build]

  The script respects the environment variable `CF_PAGES_API_TOKEN` when present
  (wrangler will also use its own authentication methods).
*/

const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

function exitWith(code, msg) {
  if (msg) console.error(msg);
  process.exit(code);
}

const argv = process.argv.slice(2);
const opts = {
  dir: './src',
  project: 'ddcsexpertstudio',
  build: false
};

for (const a of argv) {
  if (a === '--build') opts.build = true;
  else if (a.startsWith('--dir=')) opts.dir = a.split('=')[1];
  else if (a.startsWith('--project-name=')) opts.project = a.split('=')[1];
  else if (a === '--help' || a === '-h') {
    console.log('Usage: node scripts/publish-pages.cjs [--dir=./src] [--project-name=ddcsexpertstudio] [--build]');
    process.exit(0);
  } else {
    console.error('Unknown option:', a);
    process.exit(1);
  }
}

const workspaceDir = path.resolve(__dirname, '..');
const publishDir = path.isAbsolute(opts.dir) ? opts.dir : path.resolve(workspaceDir, opts.dir);
if (!fs.existsSync(publishDir)) exitWith(2, `Publish directory not found: ${publishDir}`);

if (opts.build) {
  console.log('Running build before publish...');
  const r = spawnSync('npm', ['run', 'build'], { stdio: 'inherit', cwd: workspaceDir, env: process.env });
  if (r.status !== 0) exitWith(r.status || 3, '`npm run build` failed. Aborting.');
}

function hasWrangler() {
  try {
    const r = spawnSync('wrangler', ['--version'], { stdio: 'ignore' });
    return r.status === 0;
  } catch (err) {
    return false;
  }
}

if (!hasWrangler()) {
  console.error('\nError: `wrangler` CLI was not found in PATH.');
  console.error('Install it with `npm i -g wrangler` or use `npx wrangler pages publish ...`.');
  exitWith(4);
}

console.log(`Publishing ${publishDir} → Pages project: ${opts.project}`);
const args = ['pages', 'publish', publishDir, '--project-name', opts.project];
const r = spawnSync('wrangler', args, { stdio: 'inherit', cwd: workspaceDir, env: process.env });

if (r.error) exitWith(5, `Failed to execute wrangler: ${r.error.message}`);
process.exit(r.status === null ? 1 : r.status);
