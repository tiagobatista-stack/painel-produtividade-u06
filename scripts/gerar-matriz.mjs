// Gera docs/MATRIZ_GOVERNANCA.csv a partir de docs/matriz-governanca.json (a fonte é o JSON).
//   uso: node scripts/gerar-matriz.mjs        (ou: npm run matriz)
// Formato igual ao das exportações do painel: Excel em português (separador ";", UTF-8 com BOM, CRLF).
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { celulaTexto, montarCsv } from '../js/exportacao.js';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const ARQUIVO_JSON = join(RAIZ, 'docs', 'matriz-governanca.json');
export const ARQUIVO_CSV = join(RAIZ, 'docs', 'MATRIZ_GOVERNANCA.csv');

export const COLUNAS = [
  ['ID', 'id'], ['CENARIO', 'cenario'], ['DADO', 'dado'], ['AMBIENTE', 'ambiente'], ['AUTONOMIA', 'autonomia'],
  ['APROVACAO', 'aprovacao'], ['CONTROLE', 'controle'], ['DECISAO', 'decisao'], ['JUSTIFICATIVA', 'justificativa'],
  ['RESPONSAVEL_REVISAO', 'responsavel_revisao'], ['EVIDENCIA_NECESSARIA', 'evidencia_necessaria'],
];

export function gerarCsv(matriz) {
  return montarCsv(
    COLUNAS.map(([cabecalho]) => cabecalho),
    matriz.cenarios.map((c) => COLUNAS.map(([, campo]) => celulaTexto(c[campo])))
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const matriz = JSON.parse(readFileSync(ARQUIVO_JSON, 'utf8'));
  writeFileSync(ARQUIVO_CSV, gerarCsv(matriz));
  console.log(`Matriz gerada: ${matriz.cenarios.length} cenários em ${ARQUIVO_CSV}`);
}
