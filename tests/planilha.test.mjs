import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lerPlanilha, lerData } from '../js/planilha.js';

const exemplo = readFileSync(new URL('../data/planilha-exemplo.tsv', import.meta.url), 'utf8');
const CAB = 'N_PONTO\tEQUIPE\tCOORD_X\tCOORD_Y\tMUNICIPIO\tDAT_SAIDA\tDAT_RETOR\tNOT_PLANEJ';
const linha = (n, extra = {}) => {
  const c = { n, equipe: 'Equipe A', x: '', y: '', mun: 'Município X', saida: '01/11/2026', retorno: '05/11/2026', nota: 'Possível corte raso', ...extra };
  return [c.n, c.equipe, c.x, c.y, c.mun, c.saida, c.retorno, c.nota].join('\t');
};
const erroDe = (r) => r.erros.map((e) => `${e.linha}:${e.campo}`);

test('planilha de exemplo: 13 pontos, 2 municípios, viagem de 5 dias, sem coordenadas', () => {
  const r = lerPlanilha(exemplo);
  assert.equal(r.ok, true, JSON.stringify(r.erros));
  const op = r.operacao;
  assert.equal(op.pontos.length, 13);
  assert.deepEqual(op.municipios, ['Município Fictício A', 'Município Fictício B']);
  assert.equal(op.equipe, 'Equipe Fictícia Leste');
  assert.equal(op.saida, '2026-11-09');
  assert.equal(op.retorno, '2026-11-13');
  assert.ok(op.pontos.every((p) => p.coord_x === null && p.coord_y === null));
  assert.equal(op.pontos[0].nota, 'Possível corte raso');
  assert.deepEqual(op.pontos.map((p) => p.n), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
});

test('aceita cabeçalho em outra ordem, caixa e sem acento', () => {
  const t = 'municipio;equipe;n_ponto;dat_retor;dat_saida\nCidade;Eq;1;2026-11-05;2026-11-01';
  const r = lerPlanilha(t);
  assert.equal(r.ok, true, JSON.stringify(r.erros));
  assert.deepEqual(r.operacao.pontos[0], { n: 1, coord_x: null, coord_y: null, municipio: 'Cidade', nota: '' });
});

test('sem cabeçalho usa a ordem das 8 colunas', () => {
  const r = lerPlanilha(`${linha(1)}\n${linha(2)}`);
  assert.equal(r.ok, true, JSON.stringify(r.erros));
  assert.equal(r.operacao.pontos.length, 2);
});

test('separadores tab, ponto e vírgula e vírgula', () => {
  const cab = ['N_PONTO', 'EQUIPE', 'MUNICIPIO', 'DAT_SAIDA', 'DAT_RETOR'];
  const val = ['1', 'Eq', 'Cidade', '01/11/2026', '05/11/2026'];
  for (const sep of ['\t', ';', ',']) {
    const r = lerPlanilha(`${cab.join(sep)}\n${val.join(sep)}`);
    assert.equal(r.ok, true, `sep ${JSON.stringify(sep)}: ${JSON.stringify(r.erros)}`);
    assert.equal(r.operacao.saida, '2026-11-01');
  }
});

test('coordenadas com vírgula decimal, células entre aspas e linhas em branco', () => {
  const t = `${CAB}\n\n1\t"Equipe, A"\t"-55,25"\t-12.5\tCidade\t01/11/2026\t05/11/2026\t"Nota ""citada"""\n\n`;
  const r = lerPlanilha(t);
  assert.equal(r.ok, true, JSON.stringify(r.erros));
  const p = r.operacao.pontos[0];
  assert.equal(r.operacao.equipe, 'Equipe, A');
  assert.equal(p.coord_x, -55.25);
  assert.equal(p.coord_y, -12.5);
  assert.equal(p.nota, 'Nota "citada"');
});

test('lerData aceita dd/mm/aaaa, d/m/aaaa e ISO; rejeita datas impossíveis', () => {
  assert.equal(lerData('09/11/2026'), '2026-11-09');
  assert.equal(lerData('9/1/2026'), '2026-01-09');
  assert.equal(lerData('2026-11-09'), '2026-11-09');
  assert.equal(lerData('31/02/2026'), null);
  assert.equal(lerData('46000'), null); // número de série do Excel não é suportado
  assert.equal(lerData(''), null);
});

test('erros por linha e campo', () => {
  const t = [
    CAB,
    linha(1),
    linha(1), // repetido
    linha(2, { equipe: 'Outra equipe' }),
    linha(3, { saida: '02/11/2026' }),
    linha(4, { retorno: '06/11/2026' }),
    linha(5, { mun: '' }),
    linha(6, { x: 'abc' }),
    linha('x'),
    linha(7, { saida: '31/02/2026' }),
  ].join('\n');
  const r = lerPlanilha(t);
  assert.equal(r.ok, false);
  assert.deepEqual(erroDe(r).sort(), [
    '10:DAT_SAIDA', '3:N_PONTO', '4:EQUIPE', '5:DAT_SAIDA', '6:DAT_RETOR', '7:MUNICIPIO', '8:COORD_X', '9:N_PONTO',
  ].sort());
  assert.match(r.erros.find((e) => e.linha === 4).mensagem, /uma operação por vez/);
});

test('retorno anterior à saída', () => {
  const r = lerPlanilha(`${CAB}\n${linha(1, { saida: '10/11/2026', retorno: '05/11/2026' })}`);
  assert.deepEqual(erroDe(r), ['2:DAT_RETOR']);
});

test('entradas inválidas: vazio, só cabeçalho, coluna obrigatória ausente, linha curta, excesso de pontos', () => {
  assert.equal(lerPlanilha('').ok, false);
  assert.equal(lerPlanilha('   \n  ').ok, false);
  assert.match(lerPlanilha(CAB).erros[0].mensagem, /não tem linhas/);
  assert.match(lerPlanilha('N_PONTO\tEQUIPE\tCOORD_X\tCOORD_Y\n1\tEq\t\t').erros[0].mensagem, /Faltam as colunas: MUNICIPIO, DAT_SAIDA, DAT_RETOR/);
  assert.match(lerPlanilha('1\tEq\tCidade').erros[0].mensagem, /Sem cabeçalho/);
  const muitas = [CAB, ...Array.from({ length: 201 }, (_, i) => linha(i + 1))].join('\n');
  assert.match(lerPlanilha(muitas).erros[0].mensagem, /Máximo de 200/);
});

test('texto da nota é limitado a 200 caracteres', () => {
  const r = lerPlanilha(`${CAB}\n${linha(1, { nota: 'x'.repeat(300) })}`);
  assert.equal(r.operacao.pontos[0].nota.length, 200);
});
