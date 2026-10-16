import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  afastamentosProximos, avisosAfastamento, criarAfastamento, editarAfastamento, ordenarAfastamentos, removerAfastamento,
} from '../js/afastamentos.js';
import { ErroCadastro } from '../js/demandas.js';
import { lerPlanilha } from '../js/planilha.js';
import { criarOperacao } from '../js/operacoes.js';

const HOJE = '2026-10-15';
const seed = JSON.parse(readFileSync(new URL('../data/seed.json', import.meta.url), 'utf8'));
const planilha = lerPlanilha(readFileSync(new URL('../data/planilha-exemplo.tsv', import.meta.url), 'utf8')).operacao;
const ferias = seed.afastamentos[0]; // 2026-11-03 a 2026-11-17, aprovado
const dados = { tipo: 'ferias', inicio: '2026-12-01', fim: '2026-12-10', situacao: 'solicitado' };
const campos = (fn) => {
  try { fn(); } catch (e) { assert.ok(e instanceof ErroCadastro); return Object.keys(e.erros).sort(); }
  assert.fail('deveria lançar ErroCadastro');
};

test('cria afastamento com id sequencial e sem alterar a lista', () => {
  const novo = criarAfastamento(dados, seed.afastamentos);
  assert.deepEqual(novo, { id: 'AFA-0003', ...dados });
  assert.equal(seed.afastamentos.length, 2);
  assert.equal(criarAfastamento(dados, []).id, 'AFA-0001');
});

test('validação: tipo, datas, fim depois do início e situação', () => {
  assert.deepEqual(campos(() => criarAfastamento({}, [])), ['fim', 'inicio', 'situacao', 'tipo']);
  assert.deepEqual(campos(() => criarAfastamento({ ...dados, fim: '2026-11-30' }, [])), ['fim']);
  assert.deepEqual(campos(() => criarAfastamento({ ...dados, inicio: '2026-02-31' }, [])), ['inicio']);
  assert.deepEqual(campos(() => criarAfastamento({ ...dados, situacao: 'negado' }, [])), ['situacao']);
  assert.equal(criarAfastamento({ ...dados, fim: dados.inicio }, []).fim, dados.inicio); // um dia só vale
});

test('editar e remover', () => {
  const editado = editarAfastamento(ferias, { ...ferias, situacao: 'planejado', fim: '2026-11-20' });
  assert.equal(editado.id, 'AFA-0001');
  assert.equal(editado.fim, '2026-11-20');
  assert.equal(ferias.fim, '2026-11-17');
  assert.deepEqual(campos(() => editarAfastamento(ferias, { ...ferias, fim: '2026-10-01' })), ['fim']);
  assert.deepEqual(removerAfastamento(seed.afastamentos, 'AFA-0001').map((a) => a.id), ['AFA-0002']);
  assert.equal(removerAfastamento(seed.afastamentos, 'inexistente').length, 2);
});

test('ordena por início', () => {
  const lista = [seed.afastamentos[1], criarAfastamento(dados, seed.afastamentos), seed.afastamentos[0]];
  assert.deepEqual(ordenarAfastamentos(lista).map((a) => a.id), ['AFA-0001', 'AFA-0003', 'AFA-0002']);
});

test('aviso de prazos que caem no período (seed: DEM-0004 em 06/11)', () => {
  const { prazos, viagens } = avisosAfastamento(ferias, seed.demandas, HOJE);
  assert.deepEqual(prazos.map((x) => [x.demanda.id, x.prazo]), [['DEM-0004', '2026-11-06']]);
  assert.deepEqual(viagens, []);
});

test('aviso de viagem de operação que coincide com o período', () => {
  const op = criarOperacao(planilha, { prazo_dias: 10, horas_ponto: 3 }, seed.demandas, HOJE); // saída 09/11, retorno 13/11
  const { viagens, prazos } = avisosAfastamento(ferias, [...seed.demandas, op], HOJE);
  assert.deepEqual(viagens.map((v) => [v.demanda.id, v.saida, v.retorno]), [['DEM-0014', '2026-11-09', '2026-11-13']]);
  assert.equal(prazos.some((x) => x.demanda.id === 'DEM-0014'), false); // prazo 23/11 fora do período
  const curto = criarOperacao(planilha, { prazo_dias: 3, horas_ponto: 3 }, seed.demandas, HOJE); // prazo 16/11, dentro
  assert.equal(avisosAfastamento(ferias, [curto], HOJE).prazos.length, 1);
});

test('viagem que só toca o primeiro ou o último dia do período também avisa', () => {
  const op = (saida, retorno) => ({ id: 'X', tipo: 'operacao', status: 'a_fazer', saida, retorno, prazo_dias: 10, pontos: [{ n: 1, etapa: 'planejado' }] });
  const aviso = (o) => avisosAfastamento(ferias, [o], HOJE).viagens.length;
  assert.equal(aviso(op('2026-10-30', '2026-11-03')), 1);
  assert.equal(aviso(op('2026-11-17', '2026-11-20')), 1);
  assert.equal(aviso(op('2026-10-25', '2026-11-02')), 0);
  assert.equal(aviso(op('2026-11-18', '2026-11-20')), 0);
});

test('concluídas e afastamentos já encerrados não geram aviso', () => {
  const concluida = { ...seed.demandas.find((d) => d.id === 'DEM-0004'), status: 'concluida', concluida_em: HOJE };
  assert.deepEqual(avisosAfastamento(ferias, [concluida], HOJE).prazos, []);
  assert.deepEqual(avisosAfastamento(ferias, seed.demandas, '2026-11-18'), { prazos: [], viagens: [] });
  assert.equal(avisosAfastamento(ferias, seed.demandas, '2026-11-17').prazos.length, 1); // no último dia ainda vale
});

test('afastamento próximo: começa entre hoje e 30 dias', () => {
  assert.deepEqual(afastamentosProximos(seed.afastamentos, HOJE).map((x) => [x.afastamento.id, x.dias]), [['AFA-0001', 19]]);
  assert.equal(afastamentosProximos(seed.afastamentos, '2026-10-04').length, 1); // exatamente 30 dias
  assert.equal(afastamentosProximos(seed.afastamentos, '2026-10-03').length, 0); // 31 dias
  assert.equal(afastamentosProximos(seed.afastamentos, '2026-11-03')[0].dias, 0);
  assert.equal(afastamentosProximos(seed.afastamentos, '2026-11-04').length, 0); // já começou
  assert.deepEqual(afastamentosProximos(seed.afastamentos, '2026-11-10').map((x) => x.afastamento.id), ['AFA-0002']);
});

test('processo sobrestado não gera aviso de prazo no período', () => {
  const sobrestada = { ...seed.demandas.find((d) => d.id === 'DEM-0004'), status: 'aguardando' };
  assert.deepEqual(avisosAfastamento(ferias, [sobrestada], HOJE).prazos, []);
});

test('compensação é um tipo de afastamento e gera aviso de prazo no período', () => {
  const comp = criarAfastamento({ tipo: 'compensacao', inicio: '2026-11-05', fim: '2026-11-06', situacao: 'aprovado' }, seed.afastamentos);
  assert.equal(comp.tipo, 'compensacao');
  const { prazos } = avisosAfastamento(comp, seed.demandas, HOJE);
  assert.deepEqual(prazos.map((x) => x.demanda.id), ['DEM-0004']); // prazo 06/11
});
