// Genera dist-web/la-ciudad.html: el juego entero en un único HTML sin <html>/<head>/<body>,
// listo para publicarse como página web y abrirse desde cualquier móvil (incluido iPhone).
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

execSync('npx vite build --config vite.single.config.ts', { stdio: 'inherit' });
const html = readFileSync('dist-web/index.html', 'utf8');
const js = html.match(/<script type="module" crossorigin src="\.\/(assets\/[^"]+\.js)"><\/script>/)[1];
const css = html.match(/<link rel="stylesheet" crossorigin href="\.\/(assets\/[^"]+\.css)">/)[1];
const code = readFileSync(`dist-web/${js}`, 'utf8').replace(/<\/script/gi, '<\\/script');
const style = readFileSync(`dist-web/${css}`, 'utf8');
const page = `<title>La Ciudad</title>
<meta name="theme-color" content="#120c24" />
<style>${style}
html, body { height: 100%; background: #07040f; }
#app { height: 100%; }
</style>
<div id="app"></div>
<script type="module">${code}</script>
`;
writeFileSync('dist-web/la-ciudad.html', page);
console.log(`dist-web/la-ciudad.html: ${(page.length / 1024 / 1024).toFixed(2)} MB`);
