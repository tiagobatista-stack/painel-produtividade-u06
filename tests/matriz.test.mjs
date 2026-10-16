import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ARQUIVO_CSV, ARQUIVO_JSON, COLUNAS, gerarCsv } from '../scripts/gerar-matriz.mjs';

const matriz = JSON.parse(readFileSync(ARQUIVO_JSON, 'utf8'));
const csv = readFileSync(ARQUIVO_CSV, 'utf8');
const DECISOES = ['Permitido', 'Condicionado', 'Não autorizado'];

// Divide uma linha de CSV com ";" respeitando aspas.
function celulas(linha) {
  const saida = [];
  let atual = '';
  let aspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (aspas) {
      if (c === '"' && linha[i + 1] === '"') { atual += '"'; i++; }
      else if (c === '"') aspas = false;
      else atual += c;
    } else if (c === '"') aspas = true;
    else if (c === ';') { saida.push(atual); atual = ''; }
    else atual += c;
  }
  saida.push(atual);
  return saida;
}

test('a matriz tem exatamente 5 cenários, de C1 a C5, com todos os campos preenchidos', () => {
  assert.equal(matriz.cenarios.length, 5);
  assert.deepEqual(matriz.cenarios.map((c) => c.id), ['C1', 'C2', 'C3', 'C4', 'C5']);
  for (const c of matriz.cenarios) {
    for (const [, campo] of COLUNAS) assert.ok(typeof c[campo] === 'string' && c[campo].trim() !== '', `${c.id}: campo ${campo} vazio`);
  }
  assert.equal(new Set(matriz.cenarios.map((c) => c.cenario)).size, 5);
});

test('as decisões são as três previstas e todas aparecem', () => {
  for (const c of matriz.cenarios) assert.ok(DECISOES.includes(c.decisao), `${c.id}: decisão inválida ${c.decisao}`);
  assert.deepEqual([...new Set(matriz.cenarios.map((c) => c.decisao))].sort(), [...DECISOES].sort());
});

test('coerência: permitido não exige aprovação; condicionado exige; não autorizado registra a decisão negativa', () => {
  for (const c of matriz.cenarios) {
    if (c.decisao === 'Permitido') assert.equal(c.aprovacao, 'Não exigida', c.id);
    if (c.decisao === 'Condicionado') {
      assert.ok(!['Não exigida', '—'].includes(c.aprovacao), `${c.id}: condicionado precisa de aprovação`);
      assert.notEqual(c.controle, '—', `${c.id}: condicionado precisa de controle`);
    }
    if (c.decisao === 'Não autorizado') assert.ok(c.evidencia_necessaria.startsWith('Registro da decisão negativa'), c.id);
  }
});

test('o CSV versionado é igual ao gerado a partir do JSON (se falhar: npm run matriz)', () => {
  assert.equal(csv, gerarCsv(matriz), 'docs/MATRIZ_GOVERNANCA.csv está desatualizado em relação a docs/matriz-governanca.json');
});

test('o CSV tem BOM, CRLF, cabeçalho e as 5 linhas com 11 colunas', () => {
  assert.equal(csv.charCodeAt(0), 0xfeff);
  const linhas = csv.replace(/^﻿/, '').split('\r\n').filter(Boolean);
  assert.equal(linhas.length, 6);
  assert.deepEqual(celulas(linhas[0]), COLUNAS.map(([cabecalho]) => cabecalho));
  linhas.slice(1).forEach((linha, i) => {
    const c = celulas(linha);
    assert.equal(c.length, 11, `linha ${i + 2}`);
    assert.equal(c[0], matriz.cenarios[i].id);
    assert.equal(c[1], matriz.cenarios[i].cenario); // inclusive o que tem ";" dentro, entre aspas
    assert.equal(c[7], matriz.cenarios[i].decisao);
  });
});

test('nenhuma célula do CSV pode virar fórmula no Excel', () => {
  for (const linha of csv.replace(/^﻿/, '').split('\r\n').filter(Boolean)) {
    for (const c of celulas(linha)) assert.equal(/^[=+\-@\t]/.test(c), false, `célula perigosa: ${c}`);
  }
});

test('.gitattributes força CRLF no CSV, para o checkout no Linux (CI) não entregar LF', () => {
  const atributos = readFileSync(new URL('../.gitattributes', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  assert.match(atributos, /^docs\/MATRIZ_GOVERNANCA\.csv\s+text\s+eol=crlf$/m);
});

test('a proposta traz os mesmos 5 cenários da matriz', () => {
  const proposta = readFileSync(new URL('../docs/PROPOSTA_PAINEL_DEMANDAS.md', import.meta.url), 'utf8');
  for (const c of matriz.cenarios) assert.ok(proposta.includes(c.cenario), `${c.id} não aparece na proposta: ${c.cenario}`);
});
