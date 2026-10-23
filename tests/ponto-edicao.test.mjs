// Edição individual do ponto de uma operação (RF67) e vistoria por ponto, com data e reagendamento (RF68). Dados fictícios.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ErroCadastro } from '../js/demandas.js';
import { dentroDaJanela, editarPonto, registrarRetorno, vistoriaDoPonto } from '../js/operacoes.js';
import { criarOperacao } from '../js/operacoes.js';
import { lerPlanilha } from '../js/planilha.js';
import { listarPontos, pontosDasOperacoes } from '../js/pontos.js';
import { csvPontos } from '../js/exportacao.js';

const HOJE = '2026-10-15';
const seed = JSON.parse(readFileSync(new URL('../data/seed.json', import.meta.url), 'utf8'));
const planilha = lerPlanilha(readFileSync(new URL('../data/planilha-exemplo.tsv', import.meta.url), 'utf8')).operacao;
const nova = () => criarOperacao(planilha, { prazo_dias: 10, horas_ponto: 3 }, seed.demandas, HOJE); // saída 09/11, retorno 13/11
const norte = () => seed.demandas.find((d) => d.id === 'DEM-0001');
const camposComErro = (fn) => {
  try { fn(); } catch (e) { assert.ok(e instanceof ErroCadastro); return Object.keys(e.erros).sort(); }
  assert.fail('deveria lançar ErroCadastro');
};
const ponto = (op, n) => op.pontos.find((p) => p.n === n);

test('edita os dados do ponto e não altera a operação recebida', () => {
  const op = nova();
  const copia = JSON.stringify(op);
  const editada = editarPonto(op, 2, {
    municipio: 'Município Fictício Z', nota: 'Assunto novo', endereco: ' Estrada Fictícia, km 9 ', processo: 'SEMA-PRO-FICT-0900', codigo: 'ALT-FICT-0900',
    imovel: 'Fazenda Exemplo Z', area_ha: '12,5', responsavel: 'Responsável fictício', observacoes: 'Feito: nada. Pendente: tudo.',
  }, HOJE);
  assert.equal(JSON.stringify(op), copia);
  const p = ponto(editada, 2);
  assert.deepEqual([p.municipio, p.nota, p.endereco, p.processo, p.codigo, p.imovel, p.area_ha, p.responsavel, p.observacoes], [
    'Município Fictício Z', 'Assunto novo', 'Estrada Fictícia, km 9', 'SEMA-PRO-FICT-0900', 'ALT-FICT-0900', 'Fazenda Exemplo Z', 12.5, 'Responsável fictício', 'Feito: nada. Pendente: tudo.',
  ]);
  assert.equal(editada.pontos.length, op.pontos.length);
  assert.ok(editada.historico.some((h) => h.evento === 'Ponto 2: dados editados'));
  assert.ok(editada.historico.some((h) => h.evento === 'Ponto 2: anotação iniciada'));
});

test('campos que não vêm em `dados` ficam como estão; vazio apaga o campo opcional', () => {
  const op = editarPonto(nova(), 1, { codigo: 'ALT-FICT-0001', imovel: 'Fazenda Exemplo' }, HOJE);
  const so = editarPonto(op, 1, { codigo: '' }, HOJE);
  assert.equal('codigo' in ponto(so, 1), false);
  assert.equal(ponto(so, 1).imovel, 'Fazenda Exemplo');
  assert.equal(ponto(so, 1).municipio, ponto(op, 1).municipio);
  assert.equal(editarPonto(so, 1, {}, HOJE), so); // nada a mudar: a mesma operação
});

test('coordenadas: decimal ou graus, minutos e segundos; vazias apagam; um eixo só é recusado', () => {
  const op = nova();
  const a = ponto(editarPonto(op, 1, { latitude: `10° 30' 00" S`, longitude: '-58,25' }, HOJE), 1);
  assert.deepEqual([a.coord_y, a.coord_x, a.coord_y_texto, a.coord_x_texto], [-10.5, -58.25, `10° 30' 00" S`, '-58,25']);
  const vazio = ponto(editarPonto(editarPonto(op, 1, { latitude: '-10,5', longitude: '-58,25' }, HOJE), 1, { latitude: '', longitude: '' }, HOJE), 1);
  assert.equal('coord_x' in vazio || 'coord_y' in vazio, false);
  assert.deepEqual(camposComErro(() => editarPonto(op, 1, { latitude: '-10,5', longitude: '' }, HOJE)), ['longitude']);
  assert.deepEqual(camposComErro(() => editarPonto(op, 1, { latitude: 'abc', longitude: '-58' }, HOJE)), ['latitude']);
  const antes = pontosDasOperacoes([editarPonto(op, 1, { latitude: '-10,5', longitude: '-58,25' }, HOJE)])[0];
  assert.deepEqual([antes.coordY, antes.coordX], [-10.5, -58.25]);
});

test('validações: município obrigatório, tamanhos, área numérica e não negativa', () => {
  const op = nova();
  assert.deepEqual(camposComErro(() => editarPonto(op, 1, { municipio: '  ' }, HOJE)), ['municipio']);
  assert.deepEqual(camposComErro(() => editarPonto(op, 1, { codigo: 'x'.repeat(61), processo: 'y'.repeat(61), nota: 'n'.repeat(201) }, HOJE)), ['codigo', 'nota', 'processo']);
  assert.deepEqual(camposComErro(() => editarPonto(op, 1, { area_ha: 'muita' }, HOJE)), ['area_ha']);
  assert.deepEqual(camposComErro(() => editarPonto(op, 1, { area_ha: '-3' }, HOJE)), ['area_ha']);
  assert.deepEqual(camposComErro(() => editarPonto(op, 1, { observacoes: 'o'.repeat(501) }, HOJE)), ['observacoes']);
  assert.equal(ponto(editarPonto(op, 1, { area_ha: '0' }, HOJE), 1).area_ha, 0);
  assert.equal('area_ha' in ponto(editarPonto(op, 1, { area_ha: '' }, HOJE), 1), false);
  assert.deepEqual(camposComErro(() => editarPonto(op, 99, { nota: 'x' }, HOJE)), ['ponto']);
  assert.deepEqual(camposComErro(() => editarPonto(seed.demandas[2], 1, { nota: 'x' }, HOJE)), ['ponto']); // não é operação
});

test('vistoria do ponto: "a programar" é o padrão; programada e vistoriada exigem a data', () => {
  const op = nova();
  assert.equal(vistoriaDoPonto(ponto(op, 1)), 'pendente');
  assert.deepEqual(camposComErro(() => editarPonto(op, 1, { vistoria: 'programada' }, HOJE)), ['data_vistoria']);
  assert.deepEqual(camposComErro(() => editarPonto(op, 1, { vistoria: 'vistoriada', data_vistoria: '10/11/2026' }, HOJE)), ['data_vistoria']);
  assert.deepEqual(camposComErro(() => editarPonto(op, 1, { vistoria: 'talvez' }, HOJE)), ['vistoria']);
  const prog = ponto(editarPonto(op, 1, { vistoria: 'programada', data_vistoria: '2026-11-10' }, HOJE), 1);
  assert.deepEqual([prog.vistoria, prog.vistoria_em], ['programada', '2026-11-10']);
  const nao = ponto(editarPonto(op, 1, { vistoria: 'nao_acessada', data_vistoria: '2026-11-10' }, HOJE), 1);
  assert.deepEqual([nao.vistoria, 'vistoria_em' in nao], ['nao_acessada', false]); // não realizada não guarda data
  const volta = ponto(editarPonto(editarPonto(op, 1, { vistoria: 'programada', data_vistoria: '2026-11-10' }, HOJE), 1, { vistoria: 'pendente' }, HOJE), 1);
  assert.equal('vistoria' in volta || 'vistoria_em' in volta, false);
});

test('reagendar: histórico da nova data; não realizada volta a programada; sem mudança, sem evento', () => {
  const op = editarPonto(nova(), 5, { vistoria: 'programada', data_vistoria: '2026-11-10' }, HOJE);
  assert.ok(op.historico.some((h) => h.evento === 'Ponto 5: vistoria a programar → vistoria programada em 10/11/2026'));
  const re = editarPonto(op, 5, { vistoria: 'programada', data_vistoria: '2026-11-17' }, HOJE); // fora da janela, sem bloqueio
  assert.equal(ponto(re, 5).vistoria_em, '2026-11-17');
  assert.ok(re.historico.some((h) => h.evento === 'Ponto 5: vistoria reprogramada 10/11/2026 → 17/11/2026'));
  const nao = editarPonto(re, 5, { vistoria: 'nao_acessada' }, HOJE);
  assert.ok(nao.historico.some((h) => h.evento === 'Ponto 5: vistoria vistoria programada → não realizada'));
  const outra = editarPonto(nao, 5, { vistoria: 'programada', data_vistoria: '2026-11-20' }, HOJE);
  assert.ok(outra.historico.some((h) => h.evento === 'Ponto 5: vistoria não realizada → vistoria programada em 20/11/2026'));
  const igual = editarPonto(outra, 5, { vistoria: 'programada', data_vistoria: '2026-11-20' }, HOJE);
  assert.equal(igual.historico.length, outra.historico.length);
});

test('janela prevista: saída a retorno da operação, inclusive os extremos', () => {
  const op = nova();
  assert.deepEqual(['2026-11-08', '2026-11-09', '2026-11-11', '2026-11-13', '2026-11-14', '', null].map((d) => dentroDaJanela(op, d)), [false, true, true, true, false, false, false]);
});

test('etapa pelo formulário do ponto: segue as regras de sempre', () => {
  const op = norte();
  const elaboracao = editarPonto(op, 10, { etapa: 'relatorio_elaboracao', nota: 'Revisado' }, HOJE);
  assert.equal(ponto(elaboracao, 10).etapa, 'relatorio_elaboracao');
  assert.equal(ponto(elaboracao, 10).nota, 'Revisado');
  assert.ok(elaboracao.historico.some((h) => h.evento.includes('Ponto 10: Vistoriado (relatório pendente) → Relatório em elaboração')));
  // Ponto planejado não avança sem registrar o retorno; e o erro vem junto do campo "etapa".
  assert.deepEqual(camposComErro(() => editarPonto(nova(), 1, { etapa: 'vistoriado' }, HOJE)), ['etapa']);
  // Auto só depois do relatório concluído.
  assert.deepEqual(camposComErro(() => editarPonto(op, 11, { etapa: 'auto_lavrado' }, HOJE)), ['etapa']);
  // Etapa igual à atual não é erro nem muda nada.
  assert.equal(ponto(editarPonto(op, 10, { etapa: 'vistoriado' }, HOJE), 10).etapa, 'vistoriado');
});

test('etapa recusada não grava as outras mudanças (tudo ou nada)', () => {
  assert.deepEqual(camposComErro(() => editarPonto(norte(), 11, { nota: 'Outra nota', etapa: 'auto_lavrado' }, HOJE)), ['etapa']);
});

test('registrar retorno: pontos reagendados para depois do retorno continuam planejados', () => {
  let op = nova();
  op = editarPonto(op, 2, { vistoria: 'programada', data_vistoria: '2026-11-10' }, HOJE); // dentro da janela
  op = editarPonto(op, 3, { vistoria: 'programada', data_vistoria: '2026-11-20' }, HOJE); // reagendada para depois
  const depois = registrarRetorno(op, '2026-11-14', '2026-11-14');
  assert.equal(ponto(depois, 3).etapa, 'planejado');
  assert.equal(ponto(depois, 3).vistoria_em, '2026-11-20');
  assert.equal(ponto(depois, 2).etapa, 'vistoriado');
  assert.deepEqual([ponto(depois, 2).vistoria, ponto(depois, 2).vistoria_em], ['vistoriada', '2026-11-10']); // fica a data programada
  assert.deepEqual([ponto(depois, 1).vistoria, ponto(depois, 1).vistoria_em], ['vistoriada', '2026-11-14']); // sem data própria: a do retorno
  assert.equal(depois.pontos.filter((p) => p.etapa === 'planejado').length, 1);
  assert.ok(depois.historico.at(-1).evento.includes('1 ficou planejado'));
  assert.equal(depois.status, 'em_andamento');
});

test('registrar retorno: se todos estiverem reagendados para depois, recusa com mensagem clara', () => {
  let op = nova();
  for (const p of op.pontos) op = editarPonto(op, p.n, { vistoria: 'programada', data_vistoria: '2026-11-25' }, HOJE);
  assert.deepEqual(camposComErro(() => registrarRetorno(op, HOJE, '2026-11-14')), ['retorno']);
});

test('busca e CSV incluem os dados do ponto e a vistoria, e o CSV volta pela importação', () => {
  let op = editarPonto(nova(), 4, { processo: 'SEMA-PRO-FICT-0444', codigo: 'ALT-FICT-0444', imovel: 'Fazenda Busca', responsavel: 'Fulano Fictício', vistoria: 'programada', data_vistoria: '2026-11-11' }, HOJE);
  for (const termo of ['0444', 'alt-fict-0444', 'fazenda busca', 'fulano', 'programada']) {
    assert.deepEqual(listarPontos([op], { busca: termo }).map((l) => l.n), [4], termo);
  }
  const linha = csvPontos([op]).split('\r\n')[4];
  assert.ok(linha.endsWith(';;;SEMA-PRO-FICT-0444;ALT-FICT-0444;Fazenda Busca;;Fulano Fictício;Vistoria programada (11/11/2026)') || linha.includes(';SEMA-PRO-FICT-0444;ALT-FICT-0444;Fazenda Busca;'), linha);
  const volta = lerPlanilha(csvPontos([op]));
  assert.equal(volta.ok, true, JSON.stringify(volta.erros));
  assert.equal(volta.operacao.pontos.length, op.pontos.length);
});
