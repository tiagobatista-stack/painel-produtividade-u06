import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { priorizar, priorizarFila, faixaDoScore, ErroValidacao } from '../js/regras.js';
import { somarDias } from '../js/indicadores.js';

const HOJE = '2026-10-15';
const seed = JSON.parse(readFileSync(new URL('../data/seed.json', import.meta.url), 'utf8'));

const emDias = (n) => somarDias(HOJE, n);
const pontos = (pendentes) =>
  Array.from({ length: pendentes }, (_, i) => ({ n: i + 1, etapa: 'vistoriado' })).concat([{ n: 99, etapa: 'auto_lavrado' }]);
// Operação com prazo = retorno + 10 dias, portanto retorno = prazo - 10.
const operacao = ({ prazoEmDias, pendentes, origem = 'propria' }) => ({
  id: 'OP', tipo: 'operacao', origem, status: 'em_andamento', criada_em: '2026-10-01',
  retorno: somarDias(emDias(prazoEmDias), -10), prazo_dias: 10, pontos: pontos(pendentes),
});
const simples = (tipo, origem, prazoEmDias, extra = {}) => ({
  id: 'D', tipo, origem, status: 'a_fazer', criada_em: '2026-10-01', prazo: emDias(prazoEmDias), ...extra,
});

const r = (demanda, ctx) => priorizar(demanda, HOJE, ctx);

test('T1 operação vencida há 1 dia, 12 pendentes, coordenação → 95 Crítica', () => {
  const x = r(operacao({ prazoEmDias: -1, pendentes: 12, origem: 'chefia' }));
  assert.equal(x.score, 95);
  assert.equal(x.faixa, 'Crítica');
});

test('T2 processo vencido, Ministério Público → 90 Crítica', () => {
  const x = r(simples('processo', 'mp', -2));
  assert.equal(x.score, 90);
  assert.equal(x.faixa, 'Crítica');
});

test('T3 operação vence em 2 dias, 7 pendentes, coordenação → 68 Alta', () => {
  const x = r(operacao({ prazoEmDias: 2, pendentes: 7, origem: 'chefia' }));
  assert.equal(x.score, 68);
  assert.equal(x.faixa, 'Alta');
});

test('T4 processo em 22 dias, dentro das férias, Judiciário → 60 Alta', () => {
  const afastamentos = [{ tipo: 'ferias', inicio: '2026-11-03', fim: '2026-11-17', situacao: 'aprovado' }];
  const x = r(simples('processo', 'judiciario', 22), { afastamentos });
  assert.equal(emDias(22), '2026-11-06');
  assert.equal(x.score, 60);
  assert.equal(x.faixa, 'Alta');
});

test('T5 processo vence em 1 dia, chefia → 55 Alta', () => {
  const x = r(simples('processo', 'chefia', 1));
  assert.equal(x.score, 55);
  assert.equal(x.faixa, 'Alta');
});

test('T6 reunião vence em 5 dias, chefia → 35 Média', () => {
  const x = r(simples('reuniao', 'chefia', 5));
  assert.equal(x.score, 35);
  assert.equal(x.faixa, 'Média');
});

test('T7 demanda concluída sai da fila', () => {
  assert.equal(r(simples('reuniao', 'chefia', 5, { status: 'concluida' })).foraDaFila, true);
  const op = { ...operacao({ prazoEmDias: -1, pendentes: 0 }), pontos: [{ n: 1, etapa: 'auto_lavrado' }, { n: 2, etapa: 'encerrado_nao_acessado' }] };
  assert.equal(r(op).foraDaFila, true);
});

test('T8 prazo vazio ou inválido → erro de validação', () => {
  assert.throws(() => r(simples('processo', 'mp', 0, { prazo: '' })), ErroValidacao);
  assert.throws(() => r(simples('processo', 'mp', 0, { prazo: undefined })), ErroValidacao);
  assert.throws(() => r(simples('processo', 'mp', 0, { prazo: '2026-13-45' })), ErroValidacao);
  assert.throws(() => r({ ...operacao({ prazoEmDias: 1, pendentes: 1 }), retorno: '' }), ErroValidacao);
});

test('T9 operação em 20 dias, origem própria: 4 / 5 / 9 / 10 pendentes', () => {
  const scores = [4, 5, 9, 10].map((n) => r(operacao({ prazoEmDias: 20, pendentes: n })));
  assert.deepEqual(scores.map((x) => x.score), [20, 28, 28, 35]);
  assert.deepEqual(scores.map((x) => x.faixa), ['Baixa', 'Média', 'Média', 'Média']);
});

test('T10 reunião própria: prazo em 7 dias e em 8 dias', () => {
  assert.deepEqual(r(simples('reuniao', 'propria', 7)), { score: 25, faixa: 'Média', motivos: ['Prazo de 3 a 7 dias (+15)', 'Reunião (+10)'] });
  assert.equal(r(simples('reuniao', 'propria', 8)).score, 10);
  assert.equal(r(simples('reuniao', 'propria', 8)).faixa, 'Baixa');
});

test('T11 afastamento que não cobre o prazo não soma', () => {
  const afastamentos = [{ tipo: 'ferias', inicio: '2026-11-01', fim: '2026-11-05', situacao: 'aprovado' }];
  const x = r(simples('processo', 'ouvidoria', 22), { afastamentos });
  assert.equal(x.score, 30);
  assert.equal(x.faixa, 'Média');
});

test('fronteiras de prazo: hoje, 2, 3, 7 e 8 dias, vencido ontem', () => {
  const pontosPrazo = [-1, 0, 2, 3, 7, 8].map((n) => r(simples('outra', 'propria', n)).score);
  assert.deepEqual(pontosPrazo, [50, 30, 30, 15, 15, 0]);
});

test('afastamento inclui os dias de início e de fim', () => {
  const ctx = { afastamentos: [{ inicio: emDias(10), fim: emDias(12) }] };
  assert.equal(r(simples('outra', 'propria', 10), ctx).score, 20);
  assert.equal(r(simples('outra', 'propria', 12), ctx).score, 20);
  assert.equal(r(simples('outra', 'propria', 13), ctx).score, 0);
});

test('faixas: limites 24/25, 44/45 e 69/70', () => {
  assert.deepEqual([24, 25, 44, 45, 69, 70].map(faixaDoScore), ['Baixa', 'Média', 'Média', 'Alta', 'Alta', 'Crítica']);
});

test('motivos listam cada critério que pontuou', () => {
  const x = r(operacao({ prazoEmDias: -1, pendentes: 12, origem: 'chefia' }));
  assert.deepEqual(x.motivos, [
    'Prazo vencido (+50)',
    'Operação de alertas (+20)',
    'Origem: chefia ou coordenação (+10)',
    '12 relatórios pendentes (+15)',
  ]);
});

test('seed em 2026-10-15: scores conferidos em docs/REGRAS_PRIORIDADE.md', () => {
  const esperado = {
    'DEM-0003': 90, 'DEM-0002': 80, 'DEM-0001': 68, 'DEM-0004': 60, 'DEM-0005': 55, 'DEM-0007': 40,
    'DEM-0008': 35, 'DEM-0010': 20, 'DEM-0009': 10, 'DEM-0011': 0,
  };
  const { fila, erros } = priorizarFila(seed.demandas, HOJE, { afastamentos: seed.afastamentos });
  assert.deepEqual(erros, []);
  assert.deepEqual(Object.fromEntries(fila.map((x) => [x.demanda.id, x.score])), esperado);
  assert.deepEqual(fila.map((x) => x.demanda.id), Object.keys(esperado)); // já em ordem decrescente de score
});

test('desempate: mesmo score → prazo mais próximo → criação mais antiga', () => {
  const a = simples('reuniao', 'propria', 20, { id: 'A', criada_em: '2026-10-05' });
  const b = simples('reuniao', 'propria', 19, { id: 'B', criada_em: '2026-10-09' });
  const c = simples('reuniao', 'propria', 19, { id: 'C', criada_em: '2026-10-02' });
  const { fila } = priorizarFila([a, b, c], HOJE);
  assert.deepEqual(fila.map((x) => x.demanda.id), ['C', 'B', 'A']);
});

test('priorizarFila separa demandas com erro sem derrubar as demais', () => {
  const ruim = simples('processo', 'mp', 0, { id: 'RUIM', prazo: '' });
  const boa = simples('reuniao', 'propria', 3, { id: 'BOA' });
  const { fila, erros } = priorizarFila([ruim, boa], HOJE);
  assert.deepEqual(fila.map((x) => x.demanda.id), ['BOA']);
  assert.deepEqual(erros.map((x) => x.demanda.id), ['RUIM']);
});

test('T12 sobrestada: prazo suspenso, fora da fila e sem pontuação, mesmo vencida ou sem prazo válido', () => {
  const vencida = simples('processo', 'mp', -5, { status: 'aguardando' });
  assert.deepEqual(r(vencida), { foraDaFila: true, sobrestada: true, score: null, faixa: null, motivos: [] });
  assert.equal(r(simples('processo', 'mp', 0, { status: 'aguardando', prazo: '' })).sobrestada, true); // prazo não é validado
  assert.equal(r(simples('reuniao', 'chefia', 1, { status: 'aguardando' })).foraDaFila, true); // vale para todos os tipos
});

test('T13 ao retomar, o prazo registrado volta a valer, sem recálculo', () => {
  const retomada = simples('processo', 'mp', -5, { status: 'em_andamento' });
  assert.equal(r(retomada).score, 90); // vencido 50 + processo 15 + MP 25
});

test('T14 prazo dentro de compensação soma +20 como férias e licença-prêmio → 45 Alta', () => {
  const afastamentos = [{ tipo: 'compensacao', inicio: '2026-10-26', fim: '2026-10-28', situacao: 'aprovado' }];
  const x = r(simples('processo', 'denuncia', 12), { afastamentos }); // prazo 2026-10-27
  assert.equal(x.score, 45); // processo 15 + denúncia 10 + afastamento 20
  assert.equal(x.faixa, 'Alta');
  assert.ok(x.motivos.includes('Prazo dentro de férias, licença-prêmio ou compensação (+20)'));
});

test('sobrestada fica fora de priorizarFila e não é erro', () => {
  const sobrestada = simples('processo', 'mp', 0, { id: 'SOB', status: 'aguardando', prazo: '' });
  const normal = simples('reuniao', 'propria', 3, { id: 'NOR' });
  const { fila, erros } = priorizarFila([sobrestada, normal], HOJE);
  assert.deepEqual(fila.map((x) => x.demanda.id), ['NOR']);
  assert.deepEqual(erros, []);
});
