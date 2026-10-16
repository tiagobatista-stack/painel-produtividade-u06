import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { agenda } from '../js/agenda.js';
import { lerPlanilha } from '../js/planilha.js';
import { criarOperacao } from '../js/operacoes.js';

const seed = JSON.parse(readFileSync(new URL('../data/seed.json', import.meta.url), 'utf8'));
const planilha = lerPlanilha(readFileSync(new URL('../data/planilha-exemplo.tsv', import.meta.url), 'utf8')).operacao;
const resumo = (eventos) => eventos.map((e) => `${e.data}${e.hora ? ' ' + e.hora : ''} ${e.tipo} ${e.id}`);
const ag = (hoje, demandas = seed.demandas) => resumo(agenda(demandas, seed.afastamentos, hoje));

test('seed em 2026-10-15: prazo de relatório, reunião e palestra, em ordem', () => {
  assert.deepEqual(ag('2026-10-15'), [
    '2026-10-17 prazo_relatorio DEM-0001',
    '2026-10-20 09:00 reuniao DEM-0008',
    '2026-10-22 10:00 palestra DEM-0010',
  ]);
});

test('prazo vencido não entra; fronteiras de 0 e 7 dias entram', () => {
  assert.equal(ag('2026-10-15').some((e) => e.includes('DEM-0002')), false); // prazo 06/10 já venceu
  assert.deepEqual(ag('2026-10-22'), ['2026-10-22 10:00 palestra DEM-0010', '2026-10-27 14:00 reuniao DEM-0009'].slice(0, 1).concat(['2026-10-27 14:00 reuniao DEM-0009']));
  assert.deepEqual(ag('2026-10-20'), ['2026-10-20 09:00 reuniao DEM-0008', '2026-10-22 10:00 palestra DEM-0010', '2026-10-27 14:00 reuniao DEM-0009']);
  assert.deepEqual(ag('2026-10-28'), ['2026-11-03 afastamento AFA-0001']); // 7 dias adiante, inclusive
});

test('início de afastamento aparece só no dia de início', () => {
  assert.deepEqual(ag('2026-10-27'), ['2026-10-27 14:00 reuniao DEM-0009', '2026-11-03 afastamento AFA-0001']);
  assert.deepEqual(ag('2026-11-04'), []);
});

test('saída de operação e prazo dos relatórios da operação importada', () => {
  const op = criarOperacao(planilha, { prazo_dias: 3, horas_ponto: 3 }, seed.demandas, '2026-10-15'); // saída 09/11, prazo 16/11
  const todas = [...seed.demandas, op];
  assert.deepEqual(ag('2026-11-02', todas), ['2026-11-03 afastamento AFA-0001', '2026-11-09 saida_operacao DEM-0014']);
  assert.deepEqual(ag('2026-11-10', todas), ['2026-11-16 prazo_relatorio DEM-0014']);
});

test('demandas concluídas não aparecem', () => {
  const concluidas = seed.demandas.map((d) => ({ ...d, status: 'concluida' }));
  assert.deepEqual(ag('2026-10-15', concluidas), []);
});

test('ordena por data, depois hora; evento sem hora vem depois do que tem hora no mesmo dia', () => {
  const demandas = [
    { id: 'A', tipo: 'reuniao', status: 'a_fazer', titulo: 'Tarde', prazo: '2026-10-16', data_hora: '2026-10-16T15:00' },
    { id: 'B', tipo: 'reuniao', status: 'a_fazer', titulo: 'Manhã', prazo: '2026-10-16', data_hora: '2026-10-16T08:30' },
  ];
  assert.deepEqual(resumo(agenda(demandas, [], '2026-10-15')), ['2026-10-16 08:30 reuniao B', '2026-10-16 15:00 reuniao A']);
});

test('reunião sobrestada não aparece na agenda', () => {
  const sobrestada = { id: 'R', tipo: 'reuniao', status: 'aguardando', titulo: 'Reunião suspensa', prazo: '2026-10-16', data_hora: '2026-10-16T10:00' };
  assert.deepEqual(resumo(agenda([sobrestada], [], '2026-10-15')), []);
});
