#!/usr/bin/env node
const http = require('http');
const { execSync, fork } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const root = path.resolve(__dirname);

console.log('=== node-ws diagnostics ===');

// 1. Check environment variables
console.log('\n--- env ---');
const envVars = ['UUID', 'DOMAIN', 'PORT', 'SUB_PATH', 'SUB1_PATH', 'NAME', 'AUTO_ACCESS', 'NEZHA_SERVER', 'NEZHA_KEY'];
for (const v of envVars) {
  console.log(v + '=' + (process.env[v] || '(unset)'));
}

// 2. Check files
console.log('\n--- files ---');
for (const f of ['index.js', 'package.json', 'index.html', '.env']) {
  const p = path.join(root, f);
  console.log(f + '=' + (fs.existsSync(p) ? 'exists' : 'MISSING'));
}

// 3. Start server briefly and probe
function request(urlPath, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port: PORT, path: urlPath, method: 'GET', timeout: timeoutMs }, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ statusCode: res.statusCode, body: Buffer.concat(chunks).toString() }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

async function diagnostics() {
  const child = fork(path.join(root, 'index.js'), [], {
    silent: false,
    env: { ...process.env, PORT: String(PORT) }
  });

  await new Promise(r => setTimeout(r, 1500));

  console.log('\n--- endpoints ---');
  const endpoints = [
    { path: '/', expect: 'Green Network' },
    { path: '/health', expect: 'ok' },
    { path: '/sub', expect: 'vless://' },
    { path: '/sub1', expect: 'proxies:' }
  ];

  for (const ep of endpoints) {
    try {
      const res = await request(ep.path);
      const ok = res.body.includes(ep.expect);
      console.log(ep.path + ' status=' + res.statusCode + ' ok=' + ok + ' len=' + res.body.length);
    } catch (e) {
      console.log(ep.path + ' error=' + e.message);
    }
  }

  console.log('\nDiagnostics complete. Shutting down server...');
  child.kill('SIGTERM');

  await new Promise(resolve => {
    const timer = setTimeout(resolve, 2000);
    child.on('exit', () => {
      clearTimeout(timer);
      resolve();
    });
  });

  process.exit(0);
}

diagnostics().catch(e => {
  console.error('Diagnostics failed:', e);
  process.exit(1);
});
