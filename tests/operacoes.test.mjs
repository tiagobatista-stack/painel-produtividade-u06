import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lerPlanilha } from '../js/planilha.js';
import {
  alterarEtapaPonto, criarOperacao, esforcoHoras, registrarRetorno, retomarOperacao, sobrestarOperacao, statusOperacao,
} from '../js/operacoes.js';
import { ErroCadastro, editarDemanda, listarDemandas } from '../js/demandas.js';
import { prazoDemanda, estaConcluida, estaSobrestada, calcularIndicadores } from '../js/indicadores.js';
import { priorizar } from '../js/regras.js';

const HOJE = '2026-10-15';
const seed = JSON.parse(readFileSync(new URL('../data/seed.json', import.meta.url), 'utf8'));
const planilha = lerPlanilha(readFileSync(new URL('../data/planilha-exemplo.tsv', import.meta.url), 'utf8')).operacao;
const PARAMS = { prazo_dias: 10, horas_ponto: 3 };
const novaOperacao = (params = PARAMS) => criarOperacao(planilha, params, seed.demandas, HOJE);
const comRetorno = (op = novaOperacao()) => registrarRetorno(op, HOJE);
const codigo = (fn) => {
  try { fn(); } catch (e) { assert.ok(e instanceof ErroCadastro, String(e)); return e.erros; }
  assert.fail('deveria lançar ErroCadastro');
};

test('importar a planilha de exemplo gera a operação com prazo = retorno + N', () => {
  const op = novaOperacao();
  assert.equal(op.id, 'DEM-0014');
  assert.equal(op.tipo, 'operacao');
  assert.equal(op.origem, 'chefia');
  assert.equal(op.status, 'a_fazer');
  assert.equal(op.pontos.length, 13);
  assert.ok(op.pontos.every((p) => p.etapa === 'planejado' && p.data_relatorio === null && p.data_auto === null));
  assert.equal(op.titulo, 'Relatórios de vistoria — Equipe Fictícia Leste (saída 09/11)');
  assert.equal(op.historico[0].evento, 'Importada: 13 pontos em 2 municípios');
  assert.equal(prazoDemanda(op), '2026-11-23'); // 13/11 + 10 dias
  assert.equal(prazoDemanda(novaOperacao({ prazo_dias: 3, horas_ponto: 3 })), '2026-11-16');
});

test('prazo dentro das férias soma +20 (RF09 com a planilha de exemplo)', () => {
  const ctx = { afastamentos: seed.afastamentos };
  const fora = priorizar(novaOperacao(), HOJE, ctx);
  assert.equal(fora.score, 30); // operação 20 + chefia 10
  const dentro = priorizar(novaOperacao({ prazo_dias: 3, horas_ponto: 3 }), HOJE, ctx);
  assert.equal(dentro.score, 50);
  assert.ok(dentro.motivos.includes('Prazo dentro de férias ou licença-prêmio (+20)'));
});

test('parâmetros inválidos e importação repetida', () => {
  assert.deepEqual(Object.keys(codigo(() => novaOperacao({ prazo_dias: -1, horas_ponto: 0 }))).sort(), ['horas_ponto', 'prazo_dias']);
  assert.deepEqual(Object.keys(codigo(() => novaOperacao({ prazo_dias: '1.5', horas_ponto: 3 }))), ['prazo_dias']);
  assert.deepEqual(Object.keys(codigo(() => novaOperacao({ prazo_dias: '', horas_ponto: 3 }))), ['prazo_dias']);
  const op = novaOperacao();
  assert.deepEqual(Object.keys(codigo(() => criarOperacao(planilha, PARAMS, [...seed.demandas, op], HOJE))), ['planilha']);
});

test('registrar retorno marca os pontos planejados como vistoriados e soma relatórios pendentes', () => {
  const op = novaOperacao();
  const r = registrarRetorno(op, '2026-11-13');
  assert.ok(r.pontos.every((p) => p.etapa === 'vistoriado'));
  assert.equal(r.status, 'em_andamento');
  assert.equal(r.retorno, '2026-11-13');
  assert.equal(r.historico.at(-1).evento, 'Retorno registrado em 13/11/2026: 13 pontos vistoriados');
  assert.equal(esforcoHoras(r), 39); // 13 pendentes × 3 h
  assert.equal(esforcoHoras(op), 0);
  assert.equal(calcularIndicadores([r], '2026-11-13').relatoriosPendentes, 13);
  assert.ok(op.pontos.every((p) => p.etapa === 'planejado')); // original intacto
  assert.equal(priorizar(r, HOJE).score, 45); // 20 + 10 + 15 (13 pendentes)
});

test('data efetiva de retorno recalcula o prazo e fica no histórico', () => {
  const r = registrarRetorno(novaOperacao(), HOJE, '2026-11-16');
  assert.equal(r.retorno, '2026-11-16');
  assert.equal(prazoDemanda(r), '2026-11-26');
  assert.match(r.historico.at(-1).evento, /Retorno registrado em 16\/11\/2026: 13 pontos vistoriados \(planejado: 13\/11\/2026\)/);
});

test('registrar retorno: validações', () => {
  assert.deepEqual(Object.keys(codigo(() => registrarRetorno(novaOperacao(), HOJE, '2026-11-08'))), ['retorno']); // antes da saída
  assert.deepEqual(Object.keys(codigo(() => registrarRetorno(novaOperacao(), HOJE, 'ontem'))), ['retorno']);
  assert.deepEqual(Object.keys(codigo(() => registrarRetorno(comRetorno(), HOJE))), ['retorno']); // sem planejados
});

test('ponto planejado só avança pelo retorno', () => {
  const erros = codigo(() => alterarEtapaPonto(novaOperacao(), 1, 'vistoriado', HOJE));
  assert.match(erros.etapa, /Registre o retorno/);
});

test('etapas: planejado → vistoriado → elaboração → concluído → auto, com datas', () => {
  let op = comRetorno();
  op = alterarEtapaPonto(op, 1, 'relatorio_elaboracao', '2026-11-14');
  assert.equal(op.pontos[0].etapa, 'relatorio_elaboracao');
  assert.equal(op.pontos[0].data_relatorio, null);
  op = alterarEtapaPonto(op, 1, 'relatorio_concluido', '2026-11-15');
  assert.equal(op.pontos[0].data_relatorio, '2026-11-15');
  op = alterarEtapaPonto(op, 1, 'auto_lavrado', '2026-11-16');
  assert.equal(op.pontos[0].data_auto, '2026-11-16');
  assert.equal(op.pontos[0].data_relatorio, '2026-11-15');
  assert.equal(op.historico.at(-1).evento, 'Ponto 1: Relatório concluído → Auto lavrado');
  assert.equal(op.status, 'em_andamento');
  assert.equal(calcularIndicadores([op], '2026-11-16').autosALavrar, 0);
  assert.equal(op.pontos[1].etapa, 'vistoriado'); // outros pontos intactos
});

test('regras de transição: auto só após relatório concluído; encerramentos; voltar etapa', () => {
  const op = comRetorno();
  assert.match(codigo(() => alterarEtapaPonto(op, 2, 'auto_lavrado', HOJE)).etapa, /depois do relatório concluído/);
  assert.match(codigo(() => alterarEtapaPonto(op, 2, 'planejado', HOJE)).etapa, /não volta a planejado/);
  assert.deepEqual(Object.keys(codigo(() => alterarEtapaPonto(op, 2, 'inventada', HOJE))), ['etapa']);
  assert.deepEqual(Object.keys(codigo(() => alterarEtapaPonto(op, 99, 'relatorio_concluido', HOJE))), ['ponto']);

  const naoAcessado = alterarEtapaPonto(op, 3, 'encerrado_nao_acessado', HOJE);
  assert.equal(naoAcessado.pontos[2].data_relatorio, HOJE);
  assert.equal(naoAcessado.pontos[2].data_auto, null);
  const trocado = alterarEtapaPonto(naoAcessado, 3, 'encerrado_nao_constatado', HOJE);
  assert.equal(trocado.pontos[2].etapa, 'encerrado_nao_constatado');

  const auto = alterarEtapaPonto(alterarEtapaPonto(op, 4, 'relatorio_concluido', HOJE), 4, 'auto_lavrado', HOJE);
  assert.match(codigo(() => alterarEtapaPonto(auto, 4, 'encerrado_nao_constatado', HOJE)).etapa, /Volte o ponto/);
  const voltou = alterarEtapaPonto(auto, 4, 'relatorio_concluido', '2026-10-20');
  assert.equal(voltou.pontos[3].data_auto, null);
  assert.equal(voltou.pontos[3].data_relatorio, HOJE); // mantém a data do relatório
  const reaberto = alterarEtapaPonto(voltou, 4, 'vistoriado', HOJE);
  assert.equal(reaberto.pontos[3].data_relatorio, null);
  assert.equal(alterarEtapaPonto(op, 5, 'vistoriado', HOJE), op); // sem mudança retorna o mesmo objeto
});

test('operação concluída quando todos os pontos estão encerrados; reabrir limpa a conclusão', () => {
  let op = comRetorno();
  for (const p of op.pontos) {
    op = alterarEtapaPonto(op, p.n, 'relatorio_concluido', '2026-11-20');
    op = alterarEtapaPonto(op, p.n, p.n % 2 ? 'auto_lavrado' : 'encerrado_nao_constatado', '2026-11-21');
  }
  assert.equal(statusOperacao(op), 'concluida');
  assert.equal(op.status, 'concluida');
  assert.equal(op.concluida_em, '2026-11-21');
  assert.equal(estaConcluida(op), true);
  assert.equal(priorizar(op, '2026-11-21').foraDaFila, true);
  assert.equal(calcularIndicadores([op], '2026-11-21').concluidasSemana, 1);
  const reaberta = alterarEtapaPonto(op, 13, 'relatorio_concluido', '2026-11-22');
  assert.equal(reaberta.status, 'em_andamento');
  assert.equal('concluida_em' in reaberta, false);
});

test('seed: ponto 7 da operação Norte vai a auto lavrado e o auto sai da contagem', () => {
  const norte = seed.demandas.find((d) => d.id === 'DEM-0001');
  const antes = calcularIndicadores([norte], HOJE).autosALavrar;
  const depois = alterarEtapaPonto(norte, 7, 'auto_lavrado', HOJE);
  assert.equal(antes, 1);
  assert.equal(calcularIndicadores([depois], HOJE).autosALavrar, 0);
  assert.equal(depois.status, 'em_andamento');
});

test('editar operação: título, origem e parâmetros; status e prazo derivados', () => {
  const op = comRetorno();
  const editada = editarDemanda(op, { titulo: 'Operação Leste', origem: 'propria', prazo_dias: '5', horas_ponto: '2.5' }, HOJE);
  assert.equal(editada.titulo, 'Operação Leste');
  assert.equal(editada.origem, 'propria');
  assert.equal(editada.prazo_dias, 5);
  assert.equal(editada.horas_ponto, 2.5);
  assert.equal(prazoDemanda(editada), '2026-11-18');
  assert.equal(editada.pontos.length, 13);
  assert.equal(editada.status, op.status);
  assert.equal(editada.historico.at(-1).evento, 'Editada');
  assert.deepEqual(Object.keys(codigo(() => editarDemanda(op, { titulo: '', origem: 'mp', prazo_dias: -1, horas_ponto: 0 }, HOJE))).sort(), ['horas_ponto', 'origem', 'prazo_dias', 'titulo']);
});

test('a nova operação aparece na fila e nos filtros', () => {
  const todas = [...seed.demandas, novaOperacao()];
  const { itens } = listarDemandas(todas, { tipo: 'operacao' }, HOJE, { afastamentos: seed.afastamentos });
  assert.deepEqual(itens.map((x) => x.demanda.id), ['DEM-0002', 'DEM-0001', 'DEM-0014']);
  assert.equal(listarDemandas(todas, { busca: 'Fictício B' }, HOJE).itens.some((x) => x.demanda.id === 'DEM-0014'), true);
});

test('sobrestar operação: aguardando identificação do autuado, fora da fila e dos indicadores de prazo', () => {
  const norte = seed.demandas.find((d) => d.id === 'DEM-0001');
  const s = sobrestarOperacao(norte, HOJE);
  assert.equal(s.status, 'aguardando');
  assert.equal(s.sobrestada, true);
  assert.equal(s.historico.at(-1).evento, 'Sobrestada: aguardando identificação do autuado');
  assert.equal(estaSobrestada(s), true);
  assert.equal(norte.status, 'em_andamento'); // original intacto
  assert.equal(priorizar(s, HOJE).sobrestada, true);
  const todas = seed.demandas.map((d) => (d.id === 'DEM-0001' ? s : d));
  const ctx = { afastamentos: seed.afastamentos };
  assert.equal(listarDemandas(todas, {}, HOJE, ctx).itens.some((x) => x.demanda.id === 'DEM-0001'), false);
  assert.deepEqual(listarDemandas(todas, { status: 'aguardando' }, HOJE, ctx).itens.map((x) => x.demanda.id), ['DEM-0001', 'DEM-0006']);
  const ind = calcularIndicadores(todas, HOJE);
  assert.deepEqual([ind.abertas, ind.sobrestados, ind.relatoriosPendentes, ind.proximos7], [9, 2, 3, 4]);
  assert.equal(sobrestarOperacao(s, HOJE), s); // repetir não duplica o histórico
});

test('operação sobrestada continua editável e mantém o sobrestamento nas mudanças de etapa', () => {
  const s = sobrestarOperacao(comRetorno(), HOJE);
  assert.equal(s.status, 'aguardando');
  const mudou = alterarEtapaPonto(s, 1, 'relatorio_concluido', HOJE);
  assert.equal(mudou.status, 'aguardando');
  assert.equal(mudou.sobrestada, true);
  assert.equal(mudou.pontos[0].etapa, 'relatorio_concluido');
  const planejada = sobrestarOperacao(novaOperacao(), HOJE);
  const retorno = registrarRetorno(planejada, HOJE);
  assert.equal(retorno.status, 'aguardando');
  assert.equal(retorno.sobrestada, true);
});

test('retomar: o prazo registrado volta a valer e o status volta a ser derivado dos pontos', () => {
  const s = sobrestarOperacao(comRetorno(), HOJE);
  const r = retomarOperacao(s, '2026-11-20');
  assert.equal(r.status, 'em_andamento');
  assert.equal('sobrestada' in r, false);
  assert.equal(r.retorno, s.retorno); // sem recálculo de prazo
  assert.equal(r.historico.at(-1).evento, 'Retomada: o prazo registrado volta a valer');
  assert.equal(retomarOperacao(sobrestarOperacao(novaOperacao(), HOJE), HOJE).status, 'a_fazer');
  assert.equal(priorizar(r, HOJE).score, 45); // volta a pontuar: 20 + 10 + 15
});

test('concluir uma operação sobrestada prevalece sobre o sobrestamento', () => {
  let op = sobrestarOperacao(comRetorno(), HOJE);
  for (const p of op.pontos) {
    op = alterarEtapaPonto(op, p.n, 'relatorio_concluido', '2026-11-20');
    op = alterarEtapaPonto(op, p.n, 'auto_lavrado', '2026-11-21');
  }
  assert.equal(op.status, 'concluida');
  assert.equal(op.concluida_em, '2026-11-21');
  assert.equal('sobrestada' in op, false);
  assert.equal(estaSobrestada(op), false);
  assert.match(codigo(() => sobrestarOperacao(op, HOJE)).status, /concluída não pode/);
});

test('sobrestar e retomar: validações', () => {
  assert.match(codigo(() => retomarOperacao(novaOperacao(), HOJE)).status, /não está sobrestada/);
  const processo = seed.demandas.find((d) => d.id === 'DEM-0003');
  assert.match(codigo(() => sobrestarOperacao(processo, HOJE)).status, /não é uma operação/);
  assert.match(codigo(() => retomarOperacao(processo, HOJE)).status, /não é uma operação/);
});
