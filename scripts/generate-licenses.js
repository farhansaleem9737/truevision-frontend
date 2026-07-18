// truevision/scripts/generate-licenses.js
//
// Auto-generates assets/licenses.json from the project's direct dependencies.
// Reads each dependency's own package.json out of node_modules to capture the
// real version, license, author and homepage — no hand-maintained list to
// drift. Re-run after adding/removing deps:  node scripts/generate-licenses.js
//
// Scope = direct dependencies (the libraries the app actually imports). This is
// what users expect to see in an "Open Source Licenses" screen.

const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const pkg  = require(path.join(ROOT, 'package.json'));

const deps = Object.keys(pkg.dependencies || {}).sort((a, b) => a.localeCompare(b));

const readAuthor = (a) => {
  if (!a) return '';
  if (typeof a === 'string') return a;
  return a.name || '';
};

const out = [];
for (const name of deps) {
  const pjPath = path.join(ROOT, 'node_modules', name, 'package.json');
  try {
    const meta = JSON.parse(fs.readFileSync(pjPath, 'utf8'));
    const license = typeof meta.license === 'string'
      ? meta.license
      : (meta.license?.type || (Array.isArray(meta.licenses) ? meta.licenses.map((l) => l.type).join(', ') : 'UNKNOWN'));
    out.push({
      name,
      version: meta.version || '',
      license: license || 'UNKNOWN',
      author: readAuthor(meta.author),
      homepage: meta.homepage || (typeof meta.repository === 'string' ? meta.repository : meta.repository?.url) || '',
    });
  } catch (_) {
    // Dependency not installed (fresh clone) — record what we know from package.json.
    out.push({ name, version: pkg.dependencies[name], license: 'UNKNOWN', author: '', homepage: '' });
  }
}

const payload = {
  generatedAt: new Date().toISOString(),
  count: out.length,
  libraries: out,
};

const dest = path.join(ROOT, 'assets', 'licenses.json');
fs.writeFileSync(dest, JSON.stringify(payload, null, 2) + '\n');
console.log(`Wrote ${out.length} licenses → ${path.relative(ROOT, dest)}`);
