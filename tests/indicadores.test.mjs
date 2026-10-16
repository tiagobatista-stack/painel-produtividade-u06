import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calcularIndicadores, filaOrdenada, prazoDemanda, inicioDaSemana, somarDias, dataValida, estaSobrestada } from '../js/indicadores.js';

const seed = JSON.parse(readFileSync(new URL('../data/seed.json', import.meta.url), 'utf8'));
const HOJE = '2026-10-15';

test('indicadores do seed em 2026-10-15 (DEM-0006 sobrestada fica fora das abertas)', () => {
  assert.deepEqual(calcularIndicadores(seed.demandas, HOJE), {
    abertas: 10,
    vencidas: 2,
    proximos7: 5,
    relatoriosPendentes: 9,
    autosALavrar: 2,
    sobrestados: 1,
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

test('dataValida rejeita datas impossíveis e aceita bissexto', () => {
  for (const ruim of ['2026-02-31', '2026-04-31', '2026-02-29', '2026-13-01', '2026-00-10', '2026-1-1', '', null, undefined]) {
    assert.equal(dataValida(ruim), false, String(ruim));
  }
  for (const boa of ['2028-02-29', '2026-10-15', '2026-12-31']) assert.equal(dataValida(boa), true, boa);
});

test('sobrestada não conta como aberta, vencida nem próxima; ao voltar a status ativo, o prazo registrado volta a valer', () => {
  const base = { id: 'S', tipo: 'processo', origem: 'mp', status: 'aguardando', prazo: '2026-10-10', criada_em: '2026-10-01' };
  assert.deepEqual(calcularIndicadores([base], '2026-10-15'), { abertas: 0, vencidas: 0, proximos7: 0, relatoriosPendentes: 0, autosALavrar: 0, sobrestados: 1, concluidasSemana: 0 });
  const retomada = { ...base, status: 'em_andamento' };
  const r = calcularIndicadores([retomada], '2026-10-15');
  assert.equal(r.abertas, 1);
  assert.equal(r.vencidas, 1); // prazo registrado de 10/10, sem recálculo
  assert.equal(r.sobrestados, 0);
  assert.equal(estaSobrestada({ ...base, status: 'concluida' }), false);
  assert.equal(filaOrdenada([base]).length, 0);
});
