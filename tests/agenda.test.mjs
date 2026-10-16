import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { agenda, calendarioMes, somarMeses } from '../js/agenda.js';
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

// ---------- Calendário mensal ----------

const diasComEventos = (semanas) =>
  semanas.flat().filter((d) => d.eventos.length).map((d) => `${d.data} ${d.eventos.map((e) => `${e.tipo} ${e.id}`).join(', ')}`);
const dia = (semanas, data) => semanas.flat().find((d) => d.data === data);

test('calendário de outubro/2026: semanas de segunda a domingo, completando com os meses vizinhos', () => {
  const semanas = calendarioMes(seed.demandas, seed.afastamentos, '2026-10');
  assert.equal(semanas.length, 5);
  assert.ok(semanas.every((s) => s.length === 7));
  assert.equal(semanas[0][0].data, '2026-09-28'); // segunda-feira
  assert.equal(semanas[0][0].doMes, false);
  assert.equal(semanas.at(-1)[6].data, '2026-11-01'); // domingo
  assert.equal(dia(semanas, '2026-10-01').doMes, true);
});

test('calendário mostra prazos de processo e de outras demandas, além dos eventos da agenda; sobrestada e concluída ficam de fora', () => {
  const semanas = calendarioMes(seed.demandas, seed.afastamentos, '2026-10');
  assert.deepEqual(diasComEventos(semanas), [
    '2026-10-03 saida_operacao DEM-0001',
    '2026-10-06 prazo_relatorio DEM-0002',
    '2026-10-13 prazo_processo DEM-0003',
    '2026-10-16 prazo_processo DEM-0005',
    '2026-10-17 prazo_relatorio DEM-0001',
    '2026-10-20 reuniao DEM-0008, prazo_processo DEM-0007',
    '2026-10-22 palestra DEM-0010',
    '2026-10-25 prazo_demanda DEM-0011',
    '2026-10-27 reuniao DEM-0009',
  ]);
  const processo = dia(semanas, '2026-10-13').eventos[0];
  assert.match(processo.titulo, /^SEMA-PRO-FICT-\d+ — /); // o número do processo vem no título
});

test('afastamentos cobrem todos os dias do período, inclusive atravessando a virada do mês e do ano', () => {
  const dez = calendarioMes(seed.demandas, seed.afastamentos, '2026-12');
  assert.deepEqual(dia(dez, '2026-12-06').afastamentos, []);
  assert.deepEqual(dia(dez, '2026-12-07').afastamentos.map((a) => a.id), ['AFA-0002']); // licença-prêmio 07/12 a 05/01
  assert.deepEqual(dia(dez, '2026-12-31').afastamentos.map((a) => a.id), ['AFA-0002']);
  const jan = calendarioMes(seed.demandas, seed.afastamentos, '2027-01');
  assert.deepEqual(dia(jan, '2027-01-05').afastamentos.map((a) => a.id), ['AFA-0002']);
  assert.deepEqual(dia(jan, '2027-01-06').afastamentos, []);

  const comp = { id: 'AFA-0009', tipo: 'compensacao', inicio: '2026-10-26', fim: '2026-10-27', situacao: 'aprovado' };
  const out = calendarioMes(seed.demandas, [comp], '2026-10');
  assert.deepEqual(out.flat().filter((d) => d.afastamentos.length).map((d) => d.data), ['2026-10-26', '2026-10-27']);
});

test('somarMeses atravessa a virada do ano nos dois sentidos', () => {
  assert.equal(somarMeses('2026-12', 1), '2027-01');
  assert.equal(somarMeses('2026-01', -1), '2025-12');
  assert.equal(somarMeses('2026-10', 0), '2026-10');
});
