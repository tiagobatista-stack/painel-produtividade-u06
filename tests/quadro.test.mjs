import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CLASSES, COLUNAS, LIMITE_PADRAO, classeDeServico, idadeEmDias, montarQuadro, movimentosPermitidos, podeArrastar, podeMoverPara,
  tempoAteConcluir, tempoMedioAteConcluir, vazaoSemanal,
} from '../js/quadro.js';
import { priorizarFila } from '../js/regras.js';

const seed = JSON.parse(readFileSync(new URL('../data/seed.json', import.meta.url), 'utf8'));
const HOJE = '2026-10-15';
const contexto = { afastamentos: seed.afastamentos };
const ids = (itens) => itens.map((x) => x.demanda.id);
const coluna = (quadro, chave) => quadro.colunas.find((c) => c.chave === chave);
const quadro = () => montarQuadro(seed.demandas, HOJE, contexto);

test('RF16: colunas do seed — A fazer 7, Em andamento 3, Sobrestado 1, Concluída na semana 2', () => {
  const q = quadro();
  assert.deepEqual(q.colunas.map((c) => c.chave), COLUNAS.map((c) => c.chave));
  assert.deepEqual(q.colunas.map((c) => c.total), [7, 3, 1, 2]);
  assert.deepEqual(ids(coluna(q, 'aguardando').itens), ['DEM-0006']);
  assert.deepEqual(ids(coluna(q, 'concluida').itens).sort(), ['DEM-0012', 'DEM-0013']);
});

test('RF16: a ordem dentro da coluna é a do motor', () => {
  const { fila } = priorizarFila(seed.demandas, HOJE, contexto);
  const q = quadro();
  for (const chave of ['a_fazer', 'em_andamento']) {
    assert.deepEqual(ids(coluna(q, chave).itens), ids(fila.filter((x) => x.demanda.status === chave)), chave);
  }
  // concluídas: a mais recente primeiro
  assert.deepEqual(ids(coluna(q, 'concluida').itens), ['DEM-0013', 'DEM-0012']);
});

test('RF16: o quadro não altera pontos nem faixas do motor', () => {
  const { fila } = priorizarFila(seed.demandas, HOJE, contexto);
  const q = quadro();
  for (const item of [...coluna(q, 'a_fazer').itens, ...coluna(q, 'em_andamento').itens]) {
    const original = fila.find((x) => x.demanda.id === item.demanda.id);
    assert.equal(item.score, original.score);
    assert.equal(item.faixa, original.faixa);
  }
});

test('RF19: classes de serviço do seed', () => {
  const todos = quadro().colunas.flatMap((c) => c.itens);
  const daClasse = (classe) => todos.filter((x) => x.classe === classe && !x.concluida).map((x) => x.demanda.id).sort();
  assert.deepEqual(daClasse('urgente'), ['DEM-0002', 'DEM-0003']);
  assert.deepEqual(daClasse('data_fixa'), ['DEM-0008', 'DEM-0009', 'DEM-0010']);
  assert.deepEqual(daClasse('padrao'), ['DEM-0001', 'DEM-0004', 'DEM-0005', 'DEM-0006', 'DEM-0007']);
  assert.deepEqual(daClasse('rotina'), ['DEM-0011']);
  assert.deepEqual(CLASSES.map((c) => c.chave), ['urgente', 'data_fixa', 'padrao', 'rotina']);
});

test('RF19: Urgente só vale para aberta; a concluída vencida e a sobrestada usam o tipo', () => {
  const vencida = { demanda: { tipo: 'processo' }, prazo: '2026-10-01', faixa: 'Alta' };
  assert.equal(classeDeServico(vencida, HOJE), 'urgente');
  assert.equal(classeDeServico({ ...vencida, sobrestada: true }, HOJE), 'padrao');
  assert.equal(classeDeServico({ ...vencida, concluida: true }, HOJE), 'padrao');
  assert.equal(classeDeServico({ demanda: { tipo: 'reuniao' }, prazo: '2026-10-01', faixa: 'Crítica' }, HOJE), 'urgente');
  assert.equal(classeDeServico({ demanda: { tipo: 'reuniao' }, prazo: '2026-10-20', faixa: 'Média' }, HOJE), 'data_fixa');
  assert.equal(classeDeServico({ demanda: { tipo: 'outra' }, prazo: '2026-10-25', faixa: 'Baixa' }, HOJE), 'rotina');
});

test('RF17: limite de itens em andamento avisa e não bloqueia', () => {
  const q = quadro();
  const andamento = coluna(q, 'em_andamento');
  assert.equal(andamento.limite, LIMITE_PADRAO);
  assert.equal(andamento.total, 3);
  assert.equal(andamento.acimaDoLimite, false);
  assert.equal(coluna(q, 'a_fazer').limite, undefined);

  const quarta = seed.demandas.map((d) => (d.id === 'DEM-0004' ? { ...d, status: 'em_andamento' } : d));
  const acima = coluna(montarQuadro(quarta, HOJE, contexto), 'em_andamento');
  assert.equal(acima.total, 4);
  assert.equal(acima.acimaDoLimite, true);
  assert.equal(coluna(montarQuadro(quarta, HOJE, contexto, { limite: 4 }), 'em_andamento').acimaDoLimite, false);
});

test('RF21: idade conta desde o último evento de status, ou desde a criação', () => {
  const porId = (id) => seed.demandas.find((d) => d.id === id);
  assert.equal(idadeEmDias(porId('DEM-0001'), HOJE), 17); // sem evento de status: 2026-09-28
  const movida = { criada_em: '2026-10-01', historico: [{ data: '2026-10-01', evento: 'Criada' }, { data: '2026-10-10', evento: 'Status: A fazer → Em andamento' }, { data: '2026-10-12', evento: 'Editada' }] };
  assert.equal(idadeEmDias(movida, HOJE), 5);
  assert.equal(idadeEmDias({}, HOJE), null);
  assert.equal(coluna(quadro(), 'a_fazer').itens.find((x) => x.demanda.id === 'DEM-0004').idade, 10);
});

test('RF21: tempo até concluir e vazão semanal batem com as datas do seed', () => {
  const porId = (id) => seed.demandas.find((d) => d.id === id);
  assert.equal(tempoAteConcluir(porId('DEM-0012')), 7);
  assert.equal(tempoAteConcluir(porId('DEM-0013')), 12);
  assert.equal(tempoAteConcluir(porId('DEM-0004')), null);
  assert.equal(tempoMedioAteConcluir(seed.demandas), 9.5);
  assert.equal(tempoMedioAteConcluir([]), null);
  const vazao = vazaoSemanal(seed.demandas, HOJE);
  assert.equal(vazao.length, 4);
  assert.deepEqual(vazao[3], { inicio: '2026-10-12', fim: '2026-10-18', total: 2 });
  assert.deepEqual(vazao.map((s) => s.total), [0, 0, 0, 2]);
});

test('RF18: movimentos permitidos e arrastar', () => {
  const porId = (id) => seed.demandas.find((d) => d.id === id);
  const destinos = (id) => movimentosPermitidos(porId(id)).map((m) => `${m.rotulo}>${m.para}`);
  assert.deepEqual(destinos('DEM-0004'), ['Iniciar>em_andamento', 'Aguardar>aguardando']);
  assert.deepEqual(destinos('DEM-0003'), ['Aguardar>aguardando', 'Concluir>concluida']);
  assert.deepEqual(destinos('DEM-0006'), ['Retomar>em_andamento']);
  assert.deepEqual(destinos('DEM-0012'), []);
  assert.deepEqual(destinos('DEM-0001'), []); // operação: só Sobrestar/Retomar, pelo fluxo próprio

  assert.equal(podeArrastar(porId('DEM-0001')), false);
  assert.equal(podeArrastar(porId('DEM-0012')), false);
  assert.equal(podeArrastar(porId('DEM-0004')), true);
  assert.equal(podeMoverPara(porId('DEM-0004'), 'em_andamento'), true);
  assert.equal(podeMoverPara(porId('DEM-0004'), 'a_fazer'), false);
  assert.equal(podeMoverPara(porId('DEM-0004'), 'inexistente'), false);
  assert.equal(podeMoverPara(porId('DEM-0001'), 'aguardando'), false);
});

test('o quadro não altera os dados recebidos', () => {
  const antes = JSON.stringify(seed.demandas);
  quadro();
  assert.equal(JSON.stringify(seed.demandas), antes);
});
