import fs from 'fs';
import path from 'path';
const file = path.resolve(process.cwd(), 'dist', 'index.html');
if (!fs.existsSync(file)) {
  console.error('dist/index.html not found — build may have failed');
  process.exit(2);
}
const html = fs.readFileSync(file, 'utf8');
function assertContains(str) {
  if (!html.includes(str)) {
    console.error(`Missing expected marker: ${str}`);
    process.exit(3);
  }
  console.log(`Found: ${str}`);
}

console.log('Checking dist/index.html for expected UI markers...');
assertContains('Memory Map');
assertContains('Locate me');
assertContains('Search place');
assertContains('Upload a memory');
assertContains('Photos only');
console.log('All markers present in built HTML (client JS may alter DOM at runtime).');
