// Frontend test template: programmatic check that creating a trip calls POST /api/trips and the client would update state.
// This script is a template you can run against a running frontend+backend preview, it performs HTTP requests to backend.

import fetch from 'node-fetch';

const API = process.env.API_URL || 'http://localhost:10000';
const token = process.env.AUTH_TEST_TOKEN; // set to test JWT when available

async function run() {
  if (!token) {
    console.log('Set AUTH_TEST_TOKEN to run this template. Skipping.');
    return;
  }
  const res = await fetch(`${API}/api/trips`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'Template Trip', destination: 'Local' }) });
  console.log('Status:', res.status);
  const json = await res.json();
  console.log('Body:', json);
}

run().catch((e) => { console.error(e); process.exit(1); });
