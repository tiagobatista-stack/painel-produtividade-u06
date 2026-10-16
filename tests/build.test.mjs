import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, normalize, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BUILD = join(RAIZ, 'scripts', 'build.mjs');
let base;
let saida;

const listar = (pasta) =>
  readdirSync(pasta, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? listar(join(pasta, e.name)) : [join(pasta, e.name)]));
const arquivos = (pasta) => listar(pasta).map((f) => relative(pasta, f).split(sep).join('/')).sort();
const construir = (destino) => execFileSync(process.execPath, [BUILD, destino], { encoding: 'utf8' });

before(() => {
  base = mkdtempSync(join(tmpdir(), 'painel-build-'));
  saida = join(base, 'public');
  construir(saida);
});
after(() => rmSync(base, { recursive: true, force: true }));

test('o build copia somente o que o navegador precisa', () => {
  const lista = arquivos(saida);
  assert.ok(lista.includes('index.html'));
  assert.ok(lista.includes('css/styles.css'));
  assert.ok(lista.includes('data/seed.json'));
  assert.ok(lista.includes('data/planilha-exemplo.tsv'));
  const js = readdirSync(join(RAIZ, 'js')).filter((f) => f.endsWith('.js')).map((f) => `js/${f}`).sort();
  assert.deepEqual(lista.filter((f) => f.startsWith('js/')), js);
  assert.deepEqual(lista.filter((f) => !/^(index\.html|css\/|js\/|data\/)/.test(f)), []);
});

test('o build não leva testes, ferramentas, documentos, scripts, legado, dependências nem arquivos ocultos', () => {
  const lista = arquivos(saida);
  for (const proibido of ['tests/', 'tools/', 'docs/', 'scripts/', 'legado/', 'node_modules/', 'package.json', 'vercel.json', 'CLAUDE.md', '.git']) {
    assert.equal(lista.some((f) => f.startsWith(proibido) || f.includes(`/${proibido}`)), false, proibido);
  }
  assert.equal(lista.some((f) => f.split('/').some((p) => p.startsWith('.'))), false);
});

test('todo import dos módulos e todo recurso do HTML existe no resultado', () => {
  const html = readFileSync(join(saida, 'index.html'), 'utf8');
  const recursos = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]).filter((u) => !u.startsWith('data:') && !u.startsWith('#'));
  assert.ok(recursos.includes('css/styles.css') && recursos.includes('js/app.js'));
  const visitados = new Set();
  const visitar = (arquivo) => {
    if (visitados.has(arquivo)) return;
    visitados.add(arquivo);
    assert.ok(existsSync(arquivo), `faltando no build: ${relative(saida, arquivo)}`);
    if (!arquivo.endsWith('.js')) return;
    const fonte = readFileSync(arquivo, 'utf8');
    for (const [, especificador] of fonte.matchAll(/(?:import|export)[^'"]*?from\s+'([^']+)'/g)) {
      assert.ok(especificador.startsWith('./'), `${relative(saida, arquivo)} importa fora de js/: ${especificador}`);
      visitar(normalize(join(dirname(arquivo), especificador)));
    }
    // arquivos de dados buscados pelo navegador
    for (const [, dado] of fonte.matchAll(/fetch\('([^']+)'\)/g)) visitar(join(saida, dado));
  };
  for (const r of recursos) visitar(join(saida, r));
  // Tudo o que o HTML alcança está no build, e tudo o que está no build é alcançado (nada faltando, nada sobrando).
  const alcancados = [...visitados].map((f) => relative(saida, f).split(sep).join('/')).sort();
  assert.deepEqual(alcancados, arquivos(saida).filter((f) => f !== 'index.html'));
});

test('o código do navegador não depende de recursos externos nem de manipuladores embutidos', () => {
  const html = readFileSync(join(saida, 'index.html'), 'utf8');
  assert.equal(/(?:src|href)="https?:/.test(html), false);
  assert.equal(/\son[a-z]+="/.test(html), false); // onclick=, onsubmit=… violam a política de conteúdo
  assert.equal(/\sstyle="/.test(html), false);
  assert.equal(/<script(?![^>]*\ssrc=)/.test(html), false); // sem script embutido
  for (const f of listar(join(saida, 'js'))) {
    const fonte = readFileSync(f, 'utf8');
    assert.equal(/https?:\/\//.test(fonte), false, `URL externa em ${relative(saida, f)}`);
    assert.equal(/\beval\(|new Function|\.innerHTML\s*=/.test(fonte), false, `construção insegura em ${relative(saida, f)}`);
  }
});

test('o build é reproduzível e limpa o destino', () => {
  const antes = arquivos(saida);
  writeFileSync(join(saida, 'resto-antigo.txt'), 'sobra');
  mkdirSync(join(saida, 'pasta-antiga'));
  writeFileSync(join(saida, 'pasta-antiga', 'x.js'), '1');
  construir(saida);
  assert.deepEqual(arquivos(saida), antes);
});

test('o build recusa destinos que apagariam arquivos do projeto', () => {
  for (const ruim of ['.', '..', 'js', 'data', 'tests', 'docs', 'tools', 'scripts', '.git', RAIZ, dirname(RAIZ)]) {
    assert.throws(() => construir(ruim), /Destino recusado/, ruim);
  }
  for (const f of ['package.json', 'js/regras.js', 'tests/build.test.mjs', 'docs/MCP.md']) assert.ok(existsSync(join(RAIZ, f)), `${f} deveria continuar existindo`);
});

test('vercel.json: build, pasta de saída e cabeçalhos de segurança', () => {
  const v = JSON.parse(readFileSync(join(RAIZ, 'vercel.json'), 'utf8'));
  assert.equal(v.buildCommand, 'npm run build');
  assert.equal(v.outputDirectory, 'public');
  const cab = Object.fromEntries(v.headers.find((h) => h.source === '/(.*)').headers.map((h) => [h.key, h.value]));
  assert.equal(cab['X-Content-Type-Options'], 'nosniff');
  assert.equal(cab['X-Frame-Options'], 'DENY');
  assert.equal(cab['Referrer-Policy'], 'no-referrer');
  const csp = cab['Content-Security-Policy'];
  for (const d of ["default-src 'self'", "script-src 'self'", "style-src 'self'", "object-src 'none'", "frame-ancestors 'none'", "base-uri 'none'"]) assert.ok(csp.includes(d), d);
  assert.equal(csp.includes('unsafe-inline') || csp.includes('unsafe-eval') || csp.includes('*'), false);
});
