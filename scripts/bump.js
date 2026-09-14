// Bump de versão: atualiza package.json + app.json, commita e cria tag vX.Y.Z.
// Uso: npm run bump -- patch|minor|major   (versionCode vem do git, ver patch-gradle.js)
const fs = require('fs');
const { execSync } = require('child_process');

const kind = process.argv[2] || 'patch';
if (!['patch', 'minor', 'major'].includes(kind)) {
  console.error('uso: bump.js patch|minor|major');
  process.exit(1);
}
const pkgPath = 'package.json';
const appPath = 'app.json';
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const app = JSON.parse(fs.readFileSync(appPath, 'utf8'));

let [ma, mi, pa] = pkg.version.split('.').map(Number);
if (kind === 'major') [ma, mi, pa] = [ma + 1, 0, 0];
else if (kind === 'minor') [mi, pa] = [mi + 1, 0];
else pa += 1;
const version = `${ma}.${mi}.${pa}`;

pkg.version = version;
app.expo.version = version;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
fs.writeFileSync(appPath, JSON.stringify(app, null, 2) + '\n');

execSync(`git add ${pkgPath} ${appPath}`, { stdio: 'inherit' });
execSync(`git commit -m "chore: release v${version}"`, { stdio: 'inherit' });
execSync(`git tag v${version}`, { stdio: 'inherit' });
console.log(`v${version} — agora: npm run build:aab`);
