import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calcularIndicadores, filaOrdenada, prazoDemanda, inicioDaSemana, somarDias } from '../js/indicadores.js';

const seed = JSON.parse(readFileSync(new URL('../data/seed.json', import.meta.url), 'utf8'));
const HOJE = '2026-10-15';

test('indicadores do seed em 2026-10-15', () => {
  assert.deepEqual(calcularIndicadores(seed.demandas, HOJE), {
    abertas: 11,
    vencidas: 2,
    proximos7: 5,
    relatoriosPendentes: 9,
    autosALavrar: 2,
    concluidasSemana: 2,
  });
});

test('mudar a data de referência muda os indicadores', () => {
  const r = calcularIndicadores(seed.demandas, '2026-10-30');
  assert.equal(r.vencidas, 9);
  assert.equal(r.concluidasSemana, 0);
});

test('prazo da operação = retorno + prazo_dias', () => {
  const op = seed.demandas.find((d) => d.id === 'DEM-0001');
  assert.equal(prazoDemanda(op), '2026-10-17');
});

test('fila exclui concluídas e ordena por prazo', () => {
  const fila = filaOrdenada(seed.demandas);
  assert.ok(fila.every((x) => x.demanda.status !== 'concluida'));
  assert.equal(fila[0].demanda.id, 'DEM-0002');
  const prazos = fila.map((x) => x.prazo);
  assert.deepEqual(prazos, [...prazos].sort());
});

test('a semana começa na segunda-feira', () => {
  assert.equal(inicioDaSemana(HOJE), '2026-10-12');
  assert.equal(inicioDaSemana('2026-10-18'), '2026-10-12');
  assert.equal(somarDias('2026-10-31', 1), '2026-11-01');
});

test('data inválida em prazo não quebra e não conta como vencida', () => {
  const demandas = [{ id: 'X', tipo: 'outra', status: 'a_fazer', prazo: '', criada_em: '2026-10-01' }];
  assert.equal(prazoDemanda(demandas[0]), null);
  assert.equal(calcularIndicadores(demandas, HOJE).vencidas, 0);
});
