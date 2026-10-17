// Build estático: copia para public/ somente o que o navegador precisa (index.html, css/, js/, data/, vendor/).
// Não inclui testes, ferramentas, documentos, scripts nem o dashboard antigo (legado/).
//   uso: node scripts/build.mjs [destino]      (padrão: public)
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FONTES = ['index.html', 'css', 'js', 'data', 'vendor'];

function destinoSeguro(argumento) {
  const destino = resolve(RAIZ, argumento ?? 'public');
  const dentroDaRaiz = destino === RAIZ || destino.startsWith(RAIZ + sep);
  const ehAncestral = RAIZ.startsWith(destino + sep) || destino === RAIZ;
  const ehFonte = FONTES.some((f) => destino === join(RAIZ, f) || destino.startsWith(join(RAIZ, f) + sep));
  const ehPastaDoProjeto = dentroDaRaiz && ['.git', 'docs', 'tests', 'tools', 'scripts', 'legado', 'node_modules'].some((p) => destino === join(RAIZ, p) || destino.startsWith(join(RAIZ, p) + sep));
  if (ehAncestral || ehFonte || ehPastaDoProjeto) {
    throw new Error(`Destino recusado: ${destino} (o build apagaria arquivos do projeto).`);
  }
  return destino;
}

function listar(pasta) {
  return readdirSync(pasta, { withFileTypes: true }).flatMap((e) => {
    const caminho = join(pasta, e.name);
    return e.isDirectory() ? listar(caminho) : [caminho];
  });
}

export function construir(argumento) {
  const destino = destinoSeguro(argumento);
  rmSync(destino, { recursive: true, force: true });
  mkdirSync(destino, { recursive: true });
  for (const fonte of FONTES) {
    const origem = join(RAIZ, fonte);
    if (!existsSync(origem)) throw new Error(`Fonte ausente: ${fonte}`);
    cpSync(origem, join(destino, fonte), { recursive: true, filter: (f) => !f.split(sep).some((p) => p.startsWith('.')) });
  }
  return { destino, arquivos: listar(destino).map((f) => relative(destino, f).split(sep).join('/')).sort() };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { destino, arquivos } = construir(process.argv[2]);
    const bytes = arquivos.reduce((soma, f) => soma + statSync(join(destino, f)).size, 0);
    console.log(`Build concluído: ${arquivos.length} arquivos, ${(bytes / 1024).toFixed(1)} KB em ${relative(RAIZ, destino) || '.'}/`);
    for (const f of arquivos) console.log(`  ${f}`);
  } catch (e) {
    console.error(`Falha no build: ${e.message}`);
    process.exit(1);
  }
}
