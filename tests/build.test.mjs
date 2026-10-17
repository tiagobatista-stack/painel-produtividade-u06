import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, normalize, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BUILD = join(RAIZ, 'scripts', 'build.mjs');
let base;
let saida;

const listar = (pasta) =>
  readdirSync(pasta, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? listar(join(pasta, e.name)) : [join(pasta, e.name)]));
const arquivos = (pasta) => listar(pasta).map((f) => relative(pasta, f).split(sep).join('/')).sort();
const construir = (destino) => execFileSync(process.execPath, [BUILD, destino], { encoding: 'utf8' });
const PAGINAS = ['index.html'];
const URLS_DO_MAPA = ['https://tile.openstreetmap.org/{z}/{x}/{y}.png', 'https://geo.sema.mt.gov.br/geoserver/ows', 'https://www.openstreetmap.org/copyright', 'https://www.openstreetmap.org'];

before(() => {
  base = mkdtempSync(join(tmpdir(), 'painel-build-'));
  saida = join(base, 'public');
  construir(saida);
});
after(() => rmSync(base, { recursive: true, force: true }));

test('o build copia somente o que o navegador precisa', () => {
  const lista = arquivos(saida);
  for (const pagina of PAGINAS) assert.ok(lista.includes(pagina), pagina);
  assert.ok(lista.includes('css/styles.css'));
  assert.ok(lista.includes('data/seed.json'));
  assert.ok(lista.includes('data/planilha-exemplo.tsv'));
  const js = readdirSync(join(RAIZ, 'js')).filter((f) => f.endsWith('.js')).map((f) => `js/${f}`).sort();
  assert.deepEqual(lista.filter((f) => f.startsWith('js/')), js);
  assert.deepEqual(lista.filter((f) => !/^(index\.html|css\/|js\/|data\/|vendor\/)/.test(f)), []);
});

test('o build não gera kanban.html nem nenhum arquivo do Kanban de projetos (ferramenta de metodologia, removida do site)', () => {
  const lista = arquivos(saida);
  assert.equal(lista.includes('kanban.html'), false);
  assert.deepEqual(lista.filter((f) => /kanban|design-thinking|ui-dt/i.test(f)), []);
  assert.deepEqual(lista.filter((f) => f.endsWith('.html')), ['index.html']); // a única página publicada
});

test('o build não leva testes, ferramentas, documentos, scripts, legado, dependências nem arquivos ocultos', () => {
  const lista = arquivos(saida);
  for (const proibido of ['tests/', 'tools/', 'docs/', 'scripts/', 'legado/', 'node_modules/', 'package.json', 'vercel.json', 'CLAUDE.md', '.git']) {
    assert.equal(lista.some((f) => f.startsWith(proibido) || f.includes(`/${proibido}`)), false, proibido);
  }
  assert.equal(lista.some((f) => f.split('/').some((p) => p.startsWith('.'))), false);
});

test('todo import dos módulos e todo recurso do HTML existe no resultado', () => {
  // Recursos da página (os de âncora e data: não contam).
  const recursosDe = (pagina) => [...readFileSync(join(saida, pagina), 'utf8').matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]).filter((u) => !u.startsWith('data:') && !u.startsWith('#'));
  const recursos = PAGINAS.flatMap(recursosDe);
  assert.ok(recursosDe('index.html').includes('css/styles.css') && recursosDe('index.html').includes('js/app.js'));
  assert.equal(recursosDe('index.html').some((r) => /kanban/i.test(r)), false, 'a página não aponta para nada do Kanban');
  const visitados = new Set();
  const visitar = (arquivo) => {
    if (visitados.has(arquivo)) return;
    visitados.add(arquivo);
    assert.ok(existsSync(arquivo), `faltando no build: ${relative(saida, arquivo)}`);
    if (!arquivo.endsWith('.js') || arquivo.includes(`${sep}vendor${sep}`)) return; // o Leaflet é de terceiros, empacotado: não se lê import dele
    const fonte = readFileSync(arquivo, 'utf8');
    for (const [, especificador] of fonte.matchAll(/(?:import|export)[^'"]*?from\s+'([^']+)'/g)) {
      assert.ok(especificador.startsWith('./'), `${relative(saida, arquivo)} importa fora de js/: ${especificador}`);
      visitar(normalize(join(dirname(arquivo), especificador)));
    }
    // arquivos de dados buscados pelo navegador
    for (const [, dado] of fonte.matchAll(/fetch\('([^']+)'\)/g)) visitar(join(saida, dado));
  };
  for (const r of recursos) visitar(join(saida, r));
  // Tudo o que as páginas alcançam está no build, e tudo o que está no build é alcançado (nada faltando, nada sobrando).
  // A página é a raiz do site (ninguém aponta para ela), então entra na lista de alcançados como ponto de partida.
  const alcancados = [...new Set([...visitados, ...PAGINAS.map((p) => join(saida, p))])].map((f) => relative(saida, f).split(sep).join('/')).sort();
  // Do Leaflet, a licença e as imagens do CSS dele vão junto sem serem citadas por uma página.
  const doLeaflet = arquivos(saida).filter((f) => f.startsWith('vendor/leaflet/images/') || f === 'vendor/leaflet/LICENSE');
  assert.ok(doLeaflet.includes('vendor/leaflet/LICENSE'), 'a licença do Leaflet precisa ir junto');
  assert.deepEqual([...alcancados, ...doLeaflet].sort(), arquivos(saida));
});

test('o código do navegador não depende de recursos externos nem de manipuladores embutidos', () => {
  for (const pagina of PAGINAS) {
    const html = readFileSync(join(saida, pagina), 'utf8');
    assert.equal(/(?:src|href)="https?:/.test(html), false, pagina);
    assert.equal(/\son[a-z]+="/.test(html), false, pagina); // onclick=, onsubmit=… violam a política de conteúdo
    assert.equal(/\sstyle="/.test(html), false, pagina);
    assert.equal(/<script(?![^>]*\ssrc=)/.test(html), false, pagina); // sem script embutido
  }
  for (const f of listar(join(saida, 'js'))) {
    const fonte = readFileSync(f, 'utf8');
    // O endereço do espaço de nomes do SVG é só um identificador (document.createElementNS), não uma requisição.
    let semPermitidas = fonte.replaceAll('http://www.w3.org/2000/svg', '');
    // Só js/camadas-mapa.js tem endereço externo: os servidores de blocos (conferidos com a política de conteúdo abaixo) e o link da atribuição.
    if (f.endsWith(`${sep}camadas-mapa.js`)) for (const url of URLS_DO_MAPA) semPermitidas = semPermitidas.replaceAll(url, '');
    assert.equal(/https?:\/\//.test(semPermitidas), false, `URL externa em ${relative(saida, f)}`);
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
  // O mapa com camadas muda só o img-src: os servidores de blocos, por nome, e mais nada.
  const diretivas = Object.fromEntries(csp.split(';').map((d) => d.trim().split(/\s+/)).map(([nome, ...valores]) => [nome, valores]));
  assert.deepEqual(diretivas['img-src'], ["'self'", 'data:', 'https://tile.openstreetmap.org', 'https://geo.sema.mt.gov.br']);
  for (const nome of ['default-src', 'script-src', 'style-src', 'font-src', 'connect-src']) assert.equal(diretivas[nome].some((v) => v.startsWith('http')), false, nome);
  assert.deepEqual(diretivas['connect-src'], ["'self'"]);
});

test('os servidores de mapa do código são exatamente os liberados em img-src', async () => {
  const { SERVIDORES_EXTERNOS } = await import(pathToFileURL(join(RAIZ, 'js', 'camadas-mapa.js')).href);
  const v = JSON.parse(readFileSync(join(RAIZ, 'vercel.json'), 'utf8'));
  const csp = v.headers.find((h) => h.source === '/(.*)').headers.find((h) => h.key === 'Content-Security-Policy').value;
  const imgSrc = csp.split(';').map((d) => d.trim()).find((d) => d.startsWith('img-src ')).split(/\s+/).slice(1);
  assert.deepEqual(imgSrc.filter((x) => x.startsWith('https:')).sort(), [...SERVIDORES_EXTERNOS].sort());
});
