import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { focoDeHoje } from '../js/foco.js';
import { priorizarFila } from '../js/regras.js';

const seed = JSON.parse(readFileSync(new URL('../data/seed.json', import.meta.url), 'utf8'));
const ctx = { afastamentos: seed.afastamentos };
const HOJE = '2026-10-15';
const foco = (demandas, hoje = HOJE, limite) => focoDeHoje(demandas, hoje, ctx, limite);
const ids = (itens) => itens.map((x) => x.demanda.id);
const proc = (id, prazo, extra = {}) => ({
  id, tipo: 'processo', titulo: id, origem: 'mp', status: 'a_fazer', criada_em: '2026-10-01', processo: `P-${id}`, prazo, ...extra,
});

test('seed em 15/10/2026: DEM-0003, DEM-0002 e DEM-0001, com o motivo de cada uma', () => {
  const itens = foco(seed.demandas);
  assert.deepEqual(ids(itens), ['DEM-0003', 'DEM-0002', 'DEM-0001']);
  assert.deepEqual(itens.map((x) => x.motivo), ['vencida', 'vencida', 'maior_placar']);
  assert.deepEqual(itens.map((x) => x.score), [90, 80, 68]); // os pontos vêm do motor, sem recálculo
});

test('em 16/10 a demanda que vence hoje passa na frente de uma de placar maior', () => {
  const itens = foco(seed.demandas, '2026-10-16');
  assert.deepEqual(ids(itens), ['DEM-0003', 'DEM-0002', 'DEM-0005']); // DEM-0005 (55, vence hoje) antes de DEM-0001 (68)
  assert.equal(itens[2].motivo, 'vence_hoje');
});

test('no máximo 3 itens; com mais de 3 vencidas ficam as de maior placar', () => {
  const vencidas = [
    proc('A', '2026-10-01'), // MP: 50 + 15 + 25 = 90
    proc('B', '2026-10-02', { origem: 'ouvidoria' }), // 80
    proc('C', '2026-10-03', { origem: 'denuncia' }), // 75
    proc('D', '2026-10-04', { origem: 'chefia' }), // 75, prazo mais novo: perde o desempate
  ];
  const itens = foco(vencidas);
  assert.equal(itens.length, 3);
  assert.deepEqual(ids(itens), ['A', 'B', 'C']);
});

test('sobrestadas e concluídas não entram; sem demandas ativas o foco é vazio', () => {
  const fora = [proc('S', '2026-10-01', { status: 'aguardando' }), proc('C', '2026-10-01', { status: 'concluida', concluida_em: HOJE })];
  assert.deepEqual(foco(fora), []);
  assert.deepEqual(foco([]), []);
  assert.equal(foco(seed.demandas, HOJE, 99).some((x) => ['DEM-0006', 'DEM-0012', 'DEM-0013'].includes(x.demanda.id)), false);
});

test('demanda com prazo inválido fica fora do foco (vai para a lista de erros)', () => {
  assert.deepEqual(ids(foco([proc('X', ''), proc('Y', '2026-10-20')])), ['Y']);
});

test('limite configurável e sem repetir a mesma demanda', () => {
  assert.deepEqual(ids(foco(seed.demandas, HOJE, 1)), ['DEM-0003']);
  const todas = foco(seed.demandas, HOJE, 99);
  assert.equal(new Set(ids(todas)).size, todas.length);
  assert.equal(todas.length, priorizarFila(seed.demandas, HOJE, ctx).fila.length); // com limite alto, sai a fila inteira
});
