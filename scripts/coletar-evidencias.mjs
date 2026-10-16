// Coleta as evidências da entrega (Piloto IA 06) rodando os comandos de verdade e guardando as saídas literais.
//   uso: node scripts/coletar-evidencias.mjs [URL-da-produção]      (ou: SITE_URL=https://… npm run evidencias)
// Grava em evidencias-privadas/AAAA-MM-DD_HHMM/ (pasta ignorada pelo Git). Sai com código 1 se algo falhar.
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const agora = new Date();
const dois = (n) => String(n).padStart(2, '0');
const carimbo = `${agora.getFullYear()}-${dois(agora.getMonth() + 1)}-${dois(agora.getDate())}_${dois(agora.getHours())}${dois(agora.getMinutes())}`;
const PASTA = join(RAIZ, 'evidencias-privadas', carimbo);
mkdirSync(PASTA, { recursive: true });

const urlBruta = process.argv[2] ?? process.env.SITE_URL ?? '';
let URL_PRODUCAO = '';
if (urlBruta) {
  const u = new URL(urlBruta);
  if (u.protocol !== 'https:') throw new Error('A URL da produção deve ser https.');
  URL_PRODUCAO = u.origin;
}

const resultados = [];
const registrar = (item, ok, detalhe) => {
  resultados.push({ item, ok, detalhe });
  console.log(`${ok ? 'OK   ' : 'FALHA'} ${item} — ${detalhe}`);
};

// Roda um comando fixo e grava a saída literal. A URL nunca entra na linha de comando (vai por variável de ambiente).
function rodar(arquivo, comando, env = {}) {
  const r = spawnSync(comando, { cwd: RAIZ, shell: true, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024, env: { ...process.env, ...env } });
  const saida = `$ ${comando}\n\n${r.stdout ?? ''}${r.stderr ? `\n[stderr]\n${r.stderr}` : ''}\n[código de saída: ${r.status}]\n`;
  writeFileSync(join(PASTA, arquivo), saida);
  return { codigo: r.status, texto: `${r.stdout ?? ''}\n${r.stderr ?? ''}` };
}
const numero = (texto, regex) => Number((regex.exec(texto) ?? [])[1] ?? NaN);
const copiarRelatorio = (destino) => {
  const origem = join(RAIZ, 'playwright-report');
  if (existsSync(origem)) cpSync(origem, join(PASTA, destino), { recursive: true });
};

// 1. Git: commit, histórico e remoto
const git = rodar('01-git.txt', 'git rev-parse HEAD && git log --oneline -15 && git remote -v && git status -sb');
const commit = (/^[0-9a-f]{40}/m.exec(git.texto) ?? [''])[0];
registrar('Repositório e commit', git.codigo === 0 && commit !== '', `commit ${commit.slice(0, 7)}`);

// 2. Testes do motor (T1–T13) e demais testes de regra
const qualidade = rodar('02-quality.txt', 'npm run quality');
const [tests, pass, fail] = [/^# tests (\d+)/m, /^# pass (\d+)/m, /^# fail (\d+)/m].map((r) => numero(qualidade.texto, r));
registrar('node --test (T1–T13 e demais)', qualidade.codigo === 0 && fail === 0 && pass === tests, `${pass}/${tests} passam, ${fail} falham`);

// 3. MCP local: argumentos e retorno literais do caso T1 e comparação T1–T6
const mcp = rodar('03-mcp-t1.txt', 'node tools/teste-mcp.mjs');
registrar('MCP demandas-lab: T1–T6 iguais ao painel', mcp.codigo === 0 && mcp.texto.includes('TODAS AS VERIFICAÇÕES PASSARAM'), 'ver 03-mcp-t1.txt');

// 4. Playwright local (o próprio teste constrói public/ e o serve)
rmSync(join(RAIZ, 'playwright-report'), { recursive: true, force: true });
const local = rodar('04-e2e-local.txt', 'npx playwright test --reporter=list,html', { CI: 'true', SITE_URL: '', PLAYWRIGHT_HTML_OPEN: 'never' });
copiarRelatorio('relatorio-playwright-local');
const [passL, falL, pulL] = [/(\d+) passed/, /(\d+) failed/, /(\d+) skipped/].map((r) => numero(local.texto, r));
registrar('Playwright local', local.codigo === 0 && !(falL > 0), `${passL} passam, ${Number.isNaN(falL) ? 0 : falL} falham, ${Number.isNaN(pulL) ? 0 : pulL} pulados`);

// 5. Matriz de governança: 5 linhas conferidas pelo teste
const matriz = rodar('05-matriz.txt', 'node --test tests/matriz.test.mjs');
registrar('Matriz de governança (CSV, 5 cenários)', matriz.codigo === 0, 'docs/MATRIZ_GOVERNANCA.csv conferida por tests/matriz.test.mjs');

// 6. Produção: arquivos idênticos ao commit, cabeçalhos e testes e2e contra a URL real
if (URL_PRODUCAO) {
  const linhas = [`URL: ${URL_PRODUCAO}`, `commit comparado: ${commit}`, ''];
  const arquivos = spawnSync('git ls-tree -r HEAD --name-only', { cwd: RAIZ, shell: true, encoding: 'utf8' }).stdout
    .split('\n').filter((f) => /^(index\.html|css\/|js\/|data\/)/.test(f));
  let iguais = 0;
  for (const f of arquivos) {
    const doGit = spawnSync(`git show HEAD:${f}`, { cwd: RAIZ, shell: true, encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 }).stdout;
    const resposta = await fetch(`${URL_PRODUCAO}/${f}`);
    const hash = (b) => createHash('sha256').update(b).digest('hex');
    const igual = resposta.ok && hash(Buffer.from(await resposta.arrayBuffer())) === hash(doGit);
    if (igual) iguais++;
    linhas.push(`${igual ? 'idêntico ' : 'DIFERENTE '} ${f}`);
  }
  const principal = await fetch(`${URL_PRODUCAO}/`);
  const cab = ['content-security-policy', 'x-content-type-options', 'x-frame-options', 'referrer-policy'];
  linhas.push('', `GET / -> ${principal.status}`, ...cab.map((c) => `${c}: ${principal.headers.get(c) ?? '(ausente)'}`));
  const ausentes = [];
  for (const caminho of ['/package.json', '/vercel.json', '/docs/MCP.md', '/tests/build.test.mjs', '/tools/demandas-mcp.mjs', '/legado/index.html', '/.git/config']) {
    const s = (await fetch(`${URL_PRODUCAO}${caminho}`)).status;
    linhas.push(`${caminho} -> ${s}`);
    if (s !== 404) ausentes.push(caminho);
  }
  writeFileSync(join(PASTA, '06-producao.txt'), `${linhas.join('\n')}\n`);
  const headersOk = cab.every((c) => principal.headers.get(c));
  registrar('Produção: arquivos idênticos ao commit, cabeçalhos e 404 do que não se publica',
    principal.status === 200 && iguais === arquivos.length && headersOk && ausentes.length === 0, `${iguais}/${arquivos.length} idênticos; cabeçalhos ${headersOk ? 'presentes' : 'AUSENTES'}; fora do ar: ${ausentes.length === 0 ? 'ok' : ausentes.join(', ')}`);

  rmSync(join(RAIZ, 'playwright-report'), { recursive: true, force: true });
  const prod = rodar('07-e2e-producao.txt', 'npx playwright test --reporter=list,html', { CI: 'true', SITE_URL: URL_PRODUCAO, PLAYWRIGHT_HTML_OPEN: 'never' });
  copiarRelatorio('relatorio-playwright-producao');
  const [passP, falP, pulP] = [/(\d+) passed/, /(\d+) failed/, /(\d+) skipped/].map((r) => numero(prod.texto, r));
  registrar('Playwright contra a URL real', prod.codigo === 0 && !(falP > 0), `${passP} passam, ${Number.isNaN(falP) ? 0 : falP} falham, ${Number.isNaN(pulP) ? 0 : pulP} pulados`);
} else {
  console.log('(sem URL da produção: informe-a como argumento ou em SITE_URL para coletar as evidências da produção)');
}

const relatorios = ['relatorio-playwright-local', ...(URL_PRODUCAO ? ['relatorio-playwright-producao'] : [])];
const guardados = relatorios.filter((d) => existsSync(join(PASTA, d, 'index.html')));
registrar('Relatórios HTML do Playwright guardados', guardados.length === relatorios.length, guardados.length === relatorios.length ? relatorios.join(', ') : `faltando: ${relatorios.filter((d) => !guardados.includes(d)).join(', ')}`);

const resumo = [
  `# Evidências coletadas em ${carimbo}`, '',
  `Commit: \`${commit}\`${URL_PRODUCAO ? ` · Produção: ${URL_PRODUCAO}` : ''}`, '',
  '| Item | Resultado | Detalhe |', '|---|---|---|',
  ...resultados.map((r) => `| ${r.item} | ${r.ok ? 'OK' : 'FALHA'} | ${r.detalhe} |`), '',
  `Arquivos desta pasta: saídas literais dos comandos (\`01\` a \`07\`) e, em ${guardados.map((d) => `\`${d}\``).join(' e ') || 'nenhuma pasta (relatório não gerado)'}, o relatório HTML do Playwright (abra o \`index.html\` de cada uma).`, '',
  'Não são coletados por este script (dependem do usuário): print dos checks do GitHub Actions no PR, URL de Preview da Vercel, janela anônima da produção e a chamada do MCP dentro da sessão do Claude Code.', '',
].join('\n');
writeFileSync(join(PASTA, 'RESUMO.md'), resumo);

const falhas = resultados.filter((r) => !r.ok).length;
console.log(`\nEvidências em: ${PASTA}\n${falhas === 0 ? 'TODAS AS COLETAS PASSARAM' : `${falhas} FALHA(S)`}`);
process.exit(falhas === 0 ? 0 : 1);
