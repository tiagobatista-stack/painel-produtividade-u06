// Servidor estático mínimo para desenvolvimento local (npm start).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = resolve(fileURLToPath(new URL('..', import.meta.url)));
const porta = Number(process.env.PORT) || 5173;
const tipos = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
};

createServer(async (req, res) => {
  const caminho = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const alvo = normalize(join(raiz, caminho === '/' ? 'index.html' : caminho));
  const partes = alvo.slice(raiz.length).split(sep);
  const bloqueado = !alvo.startsWith(raiz) || partes.some((p) => p.startsWith('.') || p === 'node_modules');
  try {
    if (bloqueado) throw new Error('bloqueado');
    const corpo = await readFile(alvo);
    res.writeHead(200, { 'Content-Type': tipos[extname(alvo)] || 'application/octet-stream' });
    res.end(corpo);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Não encontrado');
  }
}).listen(porta, () => console.log(`Painel em http://localhost:${porta}`));
