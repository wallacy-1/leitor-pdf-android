// Copia o build UMD do pdf.js para os assets nativos do Android (usado pela busca de texto via WebView).
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'node_modules', 'pdfjs-dist', 'build');
const dest = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'assets', 'pdfjs');

if (!fs.existsSync(path.join(__dirname, '..', 'android'))) {
  console.log('[copy-pdfjs] pasta android ausente, pulando');
  process.exit(0);
}
fs.mkdirSync(dest, { recursive: true });
for (const f of ['pdf.min.js', 'pdf.worker.min.js']) {
  fs.copyFileSync(path.join(src, f), path.join(dest, f));
}
console.log('[copy-pdfjs] ok ->', dest);
