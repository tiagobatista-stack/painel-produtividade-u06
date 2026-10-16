// Servidor estático mínimo para desenvolvimento e testes (npm start).
//   uso: node scripts/serve.mjs [pasta]      (padrão: raiz do projeto; use "public" para servir o build)
// Aplica os mesmos cabeçalhos de segurança do vercel.json, para que violações de política de conteúdo apareçam já nos testes locais.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const projeto = resolve(fileURLToPath(new URL('..', import.meta.url)));
const raiz = resolve(projeto, process.argv[2] ?? '.');
const porta = Number(process.env.PORT) || 5173;
const tipos = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.tsv': 'text/tab-separated-values; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png',
};

// Cabeçalhos globais do vercel.json (fonte "/(.*)").
function cabecalhosDoVercel() {
  try {
    const config = JSON.parse(readFileSync(join(projeto, 'vercel.json'), 'utf8'));
    const globais = (config.headers ?? []).filter((h) => h.source === '/(.*)');
    return Object.fromEntries(globais.flatMap((h) => h.headers.map(({ key, value }) => [key, value])));
  } catch {
    return {};
  }
}
const seguranca = cabecalhosDoVercel();

createServer(async (req, res) => {
  const caminho = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const alvo = normalize(join(raiz, caminho === '/' ? 'index.html' : caminho));
  const partes = alvo.slice(raiz.length).split(sep);
  const bloqueado = !alvo.startsWith(raiz) || partes.some((p) => p.startsWith('.') || p === 'node_modules');
  try {
    if (bloqueado) throw new Error('bloqueado');
    const corpo = await readFile(alvo);
    res.writeHead(200, { ...seguranca, 'Content-Type': tipos[extname(alvo)] || 'application/octet-stream' });
    res.end(corpo);
  } catch {
    res.writeHead(404, { ...seguranca, 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Não encontrado');
  }
}).listen(porta, () => console.log(`Painel em http://localhost:${porta} (pasta: ${raiz})`));
