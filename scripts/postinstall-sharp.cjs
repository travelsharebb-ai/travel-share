const { execSync } = require('child_process');
const path = require('path');

const backendDir = path.resolve(__dirname, '..', 'backend');

function tryCmd(cmd) {
  try {
    console.log('Running:', cmd);
    execSync(cmd, { stdio: 'inherit', cwd: backendDir });
    return true;
  } catch (err) {
    console.error('Command failed:', cmd);
    return false;
  }
}

console.log('postinstall-sharp: attempting to ensure sharp binary is available for Linux x64 in backend');

// Try a set of increasingly specific install/rebuild commands. Don't fail the whole install if all fail;
// we want the deploy to continue so we can surface logs.
const cmds = [
  'npm rebuild sharp --update-binary',
  'npm install --include=optional sharp',
  'npm install --platform=linux --arch=x64 sharp',
  'npm install --workspace backend --platform=linux --arch=x64 sharp'
];

let ok = false;
for (const c of cmds) {
  if (tryCmd(c)) { ok = true; break; }
}

if (!ok) {
  console.warn('postinstall-sharp: all attempts failed. Deploy logs will contain the detailed errors.');
}
