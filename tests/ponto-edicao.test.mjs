// Edição individual do ponto de uma operação (RF67) e vistoria por ponto, com data e reagendamento (RF68). Dados fictícios.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ErroCadastro, migrarDemanda } from '../js/demandas.js';
import { alterarEtapaPonto, criarOperacao, dentroDaJanela, editarPonto, registrarRetorno, vistoriaDoPonto, vistoriasPermitidas } from '../js/operacoes.js';
import { pareceInvertida } from '../js/coordenadas.js';
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
  assert.deepEqual(camposComErro(() => editarPonto(norte(), 10, { vistoria: 'vistoriada', data_vistoria: '10/10/2026' }, HOJE)), ['data_vistoria']); // ponto já vistoriado: a data é obrigatória e válida
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

// ---------- Coerência entre a vistoria e a etapa; coordenada fora de MT; auto só por "Registrar auto" ----------

test('vistoriasPermitidas: o que combina com cada etapa', () => {
  assert.deepEqual(vistoriasPermitidas('planejado'), ['pendente', 'programada', 'nao_acessada']);
  assert.deepEqual(vistoriasPermitidas('encerrado_nao_acessado'), ['nao_acessada']);
  for (const etapa of ['vistoriado', 'relatorio_elaboracao', 'relatorio_concluido', 'auto_lavrado', 'encerrado_nao_constatado']) {
    assert.deepEqual(vistoriasPermitidas(etapa), ['vistoriada'], etapa);
  }
});

test('o formulário recusa vistoria que contradiz a etapa, com a mensagem no campo da vistoria', () => {
  // Planejado com "vistoriada".
  assert.deepEqual(camposComErro(() => editarPonto(nova(), 1, { vistoria: 'vistoriada', data_vistoria: '2026-11-10' }, HOJE)), ['vistoria']);
  // Já vistoriado, mas "programada" ou "a programar".
  assert.deepEqual(camposComErro(() => editarPonto(norte(), 10, { vistoria: 'programada', data_vistoria: '2026-10-05' }, HOJE)), ['vistoria']);
  assert.deepEqual(camposComErro(() => editarPonto(norte(), 10, { vistoria: 'pendente' }, HOJE)), ['vistoria']);
  // Encerrado por não acesso só combina com "não realizada".
  assert.deepEqual(camposComErro(() => editarPonto(norte(), 10, { etapa: 'encerrado_nao_acessado', vistoria: 'vistoriada', data_vistoria: '2026-10-05' }, HOJE)), ['vistoria']);
  try {
    editarPonto(norte(), 10, { vistoria: 'programada', data_vistoria: '2026-10-05' }, HOJE);
  } catch (e) {
    assert.match(e.erros.vistoria, /^Com a etapa "Vistoriado \(relatório pendente\)", a vistoria só pode ser: Vistoriada\.$/);
  }
  // Pares coerentes passam.
  assert.equal(ponto(editarPonto(norte(), 10, { etapa: 'encerrado_nao_acessado', vistoria: 'nao_acessada' }, HOJE), 10).vistoria, 'nao_acessada');
  assert.equal(ponto(editarPonto(norte(), 10, { vistoria: 'vistoriada', data_vistoria: '2026-10-06' }, HOJE), 10).vistoria_em, '2026-10-06');
});

test('mudar só a etapa ajusta a vistoria junto (painel da operação): não acessado → não realizada, e de volta → vistoriada', () => {
  const nao = alterarEtapaPonto(norte(), 10, 'encerrado_nao_acessado', HOJE);
  assert.deepEqual([ponto(nao, 10).vistoria, 'vistoria_em' in ponto(nao, 10)], ['nao_acessada', false]);
  const volta = alterarEtapaPonto(nao, 10, 'vistoriado', HOJE);
  assert.deepEqual([ponto(volta, 10).vistoria, ponto(volta, 10).vistoria_em], ['vistoriada', norte().retorno]); // sem data própria, a do retorno
  const porForm = editarPonto(norte(), 10, { etapa: 'encerrado_nao_acessado' }, HOJE); // etapa sem vistoria no formulário: ajusta
  assert.equal(ponto(porForm, 10).vistoria, 'nao_acessada');
});

test('migração: ponto vistoriado sem vistoria vira vistoriada na data do retorno; incoerências antigas são corrigidas; é idempotente', () => {
  const antiga = {
    ...norte(),
    pontos: [
      { n: 1, municipio: 'A', etapa: 'vistoriado' },
      { n: 2, municipio: 'A', etapa: 'encerrado_nao_acessado' },
      { n: 3, municipio: 'A', etapa: 'planejado', vistoria: 'vistoriada', vistoria_em: '2026-10-05' },
      { n: 4, municipio: 'A', etapa: 'auto_lavrado', vistoria: 'programada', vistoria_em: '2026-10-04' },
      { n: 5, municipio: 'A', etapa: 'planejado' },
    ],
  };
  const m = migrarDemanda(antiga);
  const v = (n) => [ponto(m, n).vistoria ?? null, ponto(m, n).vistoria_em ?? null];
  assert.deepEqual(v(1), ['vistoriada', '2026-10-07']);
  assert.deepEqual(v(2), ['nao_acessada', null]);
  assert.deepEqual(v(3), ['programada', '2026-10-05']);
  assert.deepEqual(v(4), ['vistoriada', '2026-10-04']);
  assert.deepEqual(v(5), [null, null]);
  assert.deepEqual(migrarDemanda(m), m);
  // O exemplo já é coerente: a migração não muda nada nos pontos.
  for (const op of seed.demandas.filter((d) => d.tipo === 'operacao')) assert.deepEqual(migrarDemanda(op).pontos, op.pontos);
});

test('pareceInvertida: fora de MT como está, mas dentro dele se trocar', () => {
  assert.equal(pareceInvertida(-58.3, -11.5), true);
  assert.equal(pareceInvertida(-11.5, -58.3), false); // já dentro de MT
  assert.equal(pareceInvertida(-15.1, -20.3), false); // fora de MT, e trocando continua fora
  assert.equal(pareceInvertida(0, 0), false);
});

test('coordenada que muda para fora de MT pede confirmação; a que já estava assim não pede; invertida tem mensagem própria', () => {
  const op = norte(); // o exemplo ainda tem coordenadas fora de MT
  const p = ponto(op, 10);
  const mesma = { latitude: String(p.coord_y).replace('.', ','), longitude: String(p.coord_x).replace('.', ',') };
  assert.equal(ponto(editarPonto(op, 10, { ...mesma, nota: 'só a nota' }, HOJE), 10).nota, 'só a nota'); // inalterada: sem confirmação
  assert.deepEqual(camposComErro(() => editarPonto(op, 10, { latitude: '-15,5', longitude: '-20,5' }, HOJE)), ['latitude']);
  assert.equal(ponto(editarPonto(op, 10, { latitude: '-15,5', longitude: '-20,5', confirmar_fora_mt: 'on' }, HOJE), 10).coord_y, -15.5);
  assert.equal(ponto(editarPonto(op, 10, { latitude: '-15,5', longitude: '-20,5', confirmar_fora_mt: true }, HOJE), 10).coord_x, -20.5);
  assert.equal(ponto(editarPonto(op, 10, { latitude: '-11,5', longitude: '-58,3' }, HOJE), 10).coord_y, -11.5); // dentro de MT: sem confirmação
  try {
    editarPonto(op, 10, { latitude: '-58,3', longitude: '-11,5' }, HOJE);
    assert.fail('deveria recusar');
  } catch (e) {
    assert.match(e.erros.latitude, /parecem invertidas/);
  }
});

test('"Auto lavrado" não vem pelo formulário (só por "Registrar auto", que pede o tipo)', () => {
  const concluido = alterarEtapaPonto(norte(), 11, 'relatorio_concluido', HOJE);
  assert.deepEqual(camposComErro(() => editarPonto(concluido, 11, { etapa: 'auto_lavrado' }, HOJE)), ['etapa']);
  assert.equal(ponto(editarPonto(norte(), 1, { nota: 'ponto que já tem auto' }, HOJE), 1).etapa, 'auto_lavrado'); // quem já tem auto segue assim
});
