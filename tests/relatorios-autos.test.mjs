import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lerPlanilha } from '../js/planilha.js';
import {
  agruparRelatorio, alterarEtapaPonto, alterarEtapaRelatorio, criarOperacao, desfazerRelatorio, esforcoHoras, registrarAuto, registrarRetorno, removerAuto,
  salvarObservacaoPonto,
} from '../js/operacoes.js';
import { ErroCadastro } from '../js/demandas.js';
import { autosALavrar, autosDoPonto, relatorioDoPonto, relatoriosPendentes } from '../js/indicadores.js';
import { resumoSemanal } from '../js/resumo.js';
import { CABECALHO_PONTOS, csvPontos } from '../js/exportacao.js';

const HOJE = '2026-10-15';
const seed = JSON.parse(readFileSync(new URL('../data/seed.json', import.meta.url), 'utf8'));
const planilha = lerPlanilha(readFileSync(new URL('../data/planilha-exemplo.tsv', import.meta.url), 'utf8')).operacao;
const PARAMS = { prazo_dias: 10, horas_ponto: 3 };
const vistoriada = () => registrarRetorno(criarOperacao(planilha, PARAMS, seed.demandas, HOJE), HOJE); // 13 pontos vistoriados
const etapas = (op) => op.pontos.map((p) => p.etapa);
const erros = (fn) => {
  try {
    fn();
  } catch (e) {
    assert.ok(e instanceof ErroCadastro, String(e));
    return e.erros;
  }
  assert.fail('deveria lançar ErroCadastro');
};
// Operação com o relatório R1 (pontos 1, 2 e 3) concluído.
const comR1Concluido = () => alterarEtapaRelatorio(agruparRelatorio(vistoriada(), [1, 2, 3], HOJE), 'R1', 'relatorio_concluido', HOJE);

// ---------- Relatório agrupado ----------

test('agrupar pontos cria R1, grava no histórico e não altera a operação recebida', () => {
  const op = vistoriada();
  const antes = JSON.stringify(op);
  const grupo = agruparRelatorio(op, [3, 1, 2], HOJE);
  assert.deepEqual(grupo.relatorios, [{ id: 'R1', pontos: [1, 2, 3], criado_em: HOJE }]);
  assert.equal(grupo.historico.at(-1).evento, 'Relatório R1: reúne os pontos 1, 2, 3');
  assert.equal(relatorioDoPonto(grupo, 2).id, 'R1');
  assert.equal(relatorioDoPonto(grupo, 9), null);
  assert.equal(JSON.stringify(op), antes);
  assert.equal(agruparRelatorio(grupo, [4, 5], HOJE).relatorios[1].id, 'R2');
});

test('agrupar exige 2 ou mais pontos, na mesma etapa, vistoriados e fora de outro relatório', () => {
  const op = vistoriada();
  assert.match(erros(() => agruparRelatorio(op, [1], HOJE)).relatorio, /2 ou mais/);
  assert.match(erros(() => agruparRelatorio(op, [1, 1], HOJE)).relatorio, /2 ou mais/);
  assert.match(erros(() => agruparRelatorio(op, [1, 99], HOJE)).ponto, /Ponto 99 não encontrado/);
  const planejada = criarOperacao(planilha, PARAMS, seed.demandas, HOJE);
  assert.match(erros(() => agruparRelatorio(planejada, [1, 2], HOJE)).relatorio, /Vistoriado/);
  const mista = alterarEtapaPonto(op, 2, 'relatorio_elaboracao', HOJE);
  assert.match(erros(() => agruparRelatorio(mista, [1, 2], HOJE)).relatorio, /mesma etapa/);
  const grupo = agruparRelatorio(op, [1, 2], HOJE);
  assert.match(erros(() => agruparRelatorio(grupo, [2, 3], HOJE)).relatorio, /ponto 2 já está no relatório R1/);
  const concluido = alterarEtapaPonto(op, 3, 'relatorio_concluido', HOJE);
  assert.match(erros(() => agruparRelatorio(concluido, [3, 4], HOJE)).relatorio, /Vistoriado/);
});

test('relatórios pendentes contam relatórios, não pontos: 3 pontos somados valem 1', () => {
  const op = vistoriada();
  assert.equal(relatoriosPendentes(op), 13);
  const grupo = agruparRelatorio(op, [1, 2, 3], HOJE);
  assert.equal(relatoriosPendentes(grupo), 11); // R1 + 10 pontos soltos
  assert.equal(relatoriosPendentes(agruparRelatorio(grupo, [4, 5], HOJE)), 10);
  assert.equal(esforcoHoras(grupo), 11 * 3); // horas por relatório
  assert.equal(relatoriosPendentes({ tipo: 'processo' }), 0);
});

test('mudar a etapa do relatório vale para todos os pontos, com um só evento', () => {
  const grupo = agruparRelatorio(vistoriada(), [1, 2, 3], HOJE);
  const emElaboracao = alterarEtapaRelatorio(grupo, 'R1', 'relatorio_elaboracao', HOJE);
  assert.deepEqual(etapas(emElaboracao).slice(0, 4), ['relatorio_elaboracao', 'relatorio_elaboracao', 'relatorio_elaboracao', 'vistoriado']);
  assert.equal(emElaboracao.historico.at(-1).evento, 'Relatório R1: Relatório em elaboração (3 pontos)');
  assert.equal(emElaboracao.historico.length, grupo.historico.length + 1);
  const concluido = alterarEtapaRelatorio(emElaboracao, 'R1', 'relatorio_concluido', '2026-10-16');
  assert.deepEqual(concluido.pontos.slice(0, 3).map((p) => p.data_relatorio), ['2026-10-16', '2026-10-16', '2026-10-16']);
  assert.equal(concluido.pontos[3].data_relatorio, null);
  assert.equal(autosALavrar(concluido), 3); // cada ponto do relatório concluído ainda espera o seu auto
  assert.equal(alterarEtapaRelatorio(concluido, 'R1', 'relatorio_concluido', HOJE), concluido); // sem mudança
  assert.match(erros(() => alterarEtapaRelatorio(grupo, 'R1', 'auto_lavrado', HOJE)).etapa, /Vistoriado, Em elaboração ou Concluído/);
  assert.match(erros(() => alterarEtapaRelatorio(grupo, 'R9', 'relatorio_concluido', HOJE)).relatorio, /R9 não encontrado/);
});

test('a etapa de um ponto agrupado propaga ao relatório; auto e encerramento seguem por ponto', () => {
  const grupo = agruparRelatorio(vistoriada(), [1, 2, 3], HOJE);
  const concluido = alterarEtapaPonto(grupo, 2, 'relatorio_concluido', HOJE);
  assert.deepEqual(etapas(concluido).slice(0, 4), ['relatorio_concluido', 'relatorio_concluido', 'relatorio_concluido', 'vistoriado']);
  const comAuto = alterarEtapaPonto(concluido, 1, 'auto_lavrado', HOJE);
  assert.deepEqual(etapas(comAuto).slice(0, 3), ['auto_lavrado', 'relatorio_concluido', 'relatorio_concluido']);
  const semAuto = alterarEtapaPonto(comAuto, 3, 'encerrado_nao_constatado', HOJE);
  assert.equal(semAuto.pontos[2].etapa, 'encerrado_nao_constatado');
  // reabrir o relatório com ponto já com auto é recusado
  assert.match(erros(() => alterarEtapaRelatorio(comAuto, 'R1', 'relatorio_elaboracao', HOJE)).etapa, /remova os autos e reabra o ponto/);
  // concluir de novo o relatório não mexe nos pontos que já têm auto
  const reaberto = alterarEtapaPonto(semAuto, 2, 'relatorio_concluido', HOJE);
  assert.equal(reaberto.pontos[0].etapa, 'auto_lavrado');
});

test('desfazer o agrupamento só antes de concluir o relatório', () => {
  const grupo = agruparRelatorio(vistoriada(), [1, 2, 3], HOJE);
  const solto = desfazerRelatorio(grupo, 'R1', HOJE);
  assert.equal('relatorios' in solto, false);
  assert.equal(solto.historico.at(-1).evento, 'Relatório R1: agrupamento desfeito');
  assert.equal(relatoriosPendentes(solto), 13);
  assert.match(erros(() => desfazerRelatorio(comR1Concluido(), 'R1', HOJE)).relatorio, /não está concluído/);
  assert.match(erros(() => desfazerRelatorio(grupo, 'R7', HOJE)).relatorio, /R7 não encontrado/);
  const dois = agruparRelatorio(grupo, [4, 5], HOJE);
  assert.deepEqual(desfazerRelatorio(dois, 'R1', HOJE).relatorios.map((r) => r.id), ['R2']);
});

// ---------- Autos ----------

test('um ponto pode ter vários autos, cada um com tipo e data', () => {
  const op = comR1Concluido();
  const um = registrarAuto(op, 1, { tipo: 'auto_infracao', data: '2026-10-16' }, HOJE);
  const dois = registrarAuto(um, 1, { tipo: 'termo_embargo', data: '2026-10-17' }, HOJE);
  const p = dois.pontos[0];
  assert.equal(p.etapa, 'auto_lavrado');
  assert.deepEqual(p.autos, [{ id: 'A1', tipo: 'auto_infracao', data: '2026-10-16' }, { id: 'A2', tipo: 'termo_embargo', data: '2026-10-17' }]);
  assert.equal(p.data_auto, '2026-10-16'); // data do primeiro auto, para o CSV e o resumo
  assert.equal(dois.historico.at(-1).evento, 'Ponto 1: auto registrado (Termo de embargo, 17/10/2026)');
  assert.equal(autosALavrar(dois), 2); // os pontos 2 e 3 ainda esperam o auto
  assert.equal(op.pontos[0].autos, undefined); // a operação recebida não muda
});

test('registrar auto: só com relatório concluído, tipo da lista, data válida e não anterior ao relatório', () => {
  const op = comR1Concluido();
  assert.match(erros(() => registrarAuto(vistoriada(), 1, { tipo: 'auto_infracao', data: HOJE }, HOJE)).auto, /depois do relatório concluído/);
  assert.equal(erros(() => registrarAuto(op, 1, { tipo: 'multa', data: HOJE }, HOJE)).tipo, 'Escolha o tipo do auto.');
  assert.equal(erros(() => registrarAuto(op, 1, { tipo: 'outro', data: '' }, HOJE)).data, 'Informe a data do auto.');
  assert.equal(erros(() => registrarAuto(op, 1, { tipo: 'outro', data: '2026-02-31' }, HOJE)).data, 'Informe a data do auto.');
  assert.match(erros(() => registrarAuto(op, 1, { tipo: 'outro', data: '2026-10-14' }, HOJE)).data, /anterior à do relatório/);
  assert.match(erros(() => registrarAuto(op, 99, { tipo: 'outro', data: HOJE }, HOJE)).ponto, /Ponto 99 não encontrado/);
  assert.equal(Object.keys(erros(() => registrarAuto(op, 1, { tipo: 'x', data: '' }, HOJE))).length, 2);
});

test('remover auto: sobrando autos o ponto continua com auto; sem autos volta a relatório concluído', () => {
  let op = registrarAuto(registrarAuto(comR1Concluido(), 1, { tipo: 'auto_infracao', data: '2026-10-16' }, HOJE), 1, { tipo: 'outro', data: '2026-10-18' }, HOJE);
  op = removerAuto(op, 1, 'A1', HOJE);
  assert.equal(op.pontos[0].etapa, 'auto_lavrado');
  assert.deepEqual(op.pontos[0].autos.map((a) => a.id), ['A2']);
  assert.equal(op.pontos[0].data_auto, '2026-10-18');
  op = removerAuto(op, 1, 'A2', HOJE);
  assert.equal(op.pontos[0].etapa, 'relatorio_concluido');
  assert.equal(op.pontos[0].data_auto, null);
  assert.equal('autos' in op.pontos[0], false);
  assert.match(erros(() => removerAuto(op, 1, 'A9', HOJE)).auto, /Auto A9 não encontrado no ponto 1/);
});

test('ponto antigo em "auto lavrado", sem lista de autos, vale como 1 auto de tipo não informado e aceita outros', () => {
  const norte = seed.demandas.find((d) => d.id === 'DEM-0001');
  assert.deepEqual(autosDoPonto(norte.pontos[0]), [{ id: 'A1', tipo: null, data: '2026-10-13' }]);
  assert.deepEqual(autosDoPonto(norte.pontos[9]), []); // vistoriado
  const dois = registrarAuto(norte, 1, { tipo: 'termo_embargo', data: '2026-10-14' }, HOJE);
  assert.deepEqual(dois.pontos[0].autos, [{ id: 'A1', tipo: null, data: '2026-10-13' }, { id: 'A2', tipo: 'termo_embargo', data: '2026-10-14' }]);
  assert.equal(dois.pontos[0].data_auto, '2026-10-13');
});

test('o seletor de etapa continua registrando 1 auto de infração; com mais de um auto, voltar a etapa é recusado', () => {
  const op = comR1Concluido();
  const viaSeletor = alterarEtapaPonto(op, 1, 'auto_lavrado', '2026-10-16');
  assert.deepEqual(viaSeletor.pontos[0].autos, [{ id: 'A1', tipo: 'auto_infracao', data: '2026-10-16' }]);
  assert.equal(alterarEtapaPonto(viaSeletor, 1, 'relatorio_concluido', HOJE).pontos[0].etapa, 'relatorio_concluido'); // 1 auto: volta
  const dois = registrarAuto(viaSeletor, 1, { tipo: 'outro', data: '2026-10-17' }, HOJE);
  assert.match(erros(() => alterarEtapaPonto(dois, 1, 'relatorio_concluido', HOJE)).etapa, /mais de um auto/);
  assert.match(erros(() => alterarEtapaPonto(dois, 1, 'encerrado_nao_constatado', HOJE)).etapa, /mais de um auto/);
});

test('a operação conclui quando todos os pontos têm auto ou foram encerrados', () => {
  let op = alterarEtapaRelatorio(agruparRelatorio(vistoriada(), [1, 2], HOJE), 'R1', 'relatorio_concluido', HOJE);
  for (const p of op.pontos.slice(2)) op = alterarEtapaPonto(op, p.n, 'encerrado_nao_constatado', HOJE);
  op = registrarAuto(op, 1, { tipo: 'auto_infracao', data: HOJE }, HOJE);
  assert.notEqual(op.status, 'concluida');
  op = registrarAuto(op, 2, { tipo: 'termo_embargo', data: HOJE }, HOJE);
  assert.equal(op.status, 'concluida');
  assert.equal(op.concluida_em, HOJE);
});

// ---------- Resumo e exportação ----------

test('resumo semanal: relatório agrupado conta 1; cada auto conta pela sua data', () => {
  const base = resumoSemanal([vistoriada()], HOJE);
  assert.equal(base.relatoriosConcluidos, 0);
  const op = registrarAuto(registrarAuto(comR1Concluido(), 1, { tipo: 'auto_infracao', data: '2026-10-16' }, HOJE), 1, { tipo: 'termo_embargo', data: '2026-10-20' }, HOJE);
  const r = resumoSemanal([op], HOJE);
  assert.equal(r.relatoriosConcluidos, 1); // R1 (pontos 1, 2 e 3) é um relatório só
  assert.equal(r.autosLavrados, 1); // só o auto de 16/10 cai na semana de 12 a 18/10; o de 20/10 é da semana seguinte
  assert.equal(resumoSemanal([op], '2026-10-20').autosLavrados, 1);
  const semAuto = ['encerrado_nao_constatado', 'encerrado_nao_acessado'];
  let encerrado = comR1Concluido();
  encerrado = [1, 2, 3].reduce((o, n) => alterarEtapaPonto(o, n, semAuto[n % 2], HOJE), encerrado);
  assert.equal(resumoSemanal([encerrado], HOJE).relatoriosSemAuto, 1); // o relatório inteiro terminou sem auto
});

test('resumo semanal do exemplo continua igual (sem relatórios agrupados)', () => {
  const r = resumoSemanal(seed.demandas, HOJE);
  assert.deepEqual([r.relatoriosConcluidos, r.autosLavrados, r.relatoriosSemAuto], [5, 4, 2]);
});

test('CSV de pontos: colunas RELATORIO, AUTOS e OBSERVACOES ao fim da linha', () => {
  const col = (nome) => CABECALHO_PONTOS.indexOf(nome);
  assert.deepEqual(CABECALHO_PONTOS.slice(col('RELATORIO'), col('RELATORIO') + 3), ['RELATORIO', 'AUTOS', 'OBSERVACOES']); // as colunas de dados do ponto e a vistoria vêm depois
  const op = registrarAuto(registrarAuto(comR1Concluido(), 1, { tipo: 'auto_infracao', data: '2026-10-16' }, HOJE), 1, { tipo: 'termo_embargo', data: '2026-10-17' }, HOJE);
  const linhas = csvPontos([op]).split('\r\n').filter(Boolean);
  const celulas = (l) => l.split(';');
  const fim = (l) => celulas(l).slice(col('RELATORIO'), col('RELATORIO') + 2);
  assert.deepEqual(fim(linhas[1]), ['R1', 'Auto de infração (16/10/2026) | Termo de embargo (17/10/2026)']);
  assert.deepEqual(fim(linhas[2]), ['R1', '']);
  assert.deepEqual(fim(linhas[4]), ['', '']); // ponto solto, sem auto
  const comNota = salvarObservacaoPonto(op, 4, 'Feito: vistoria. Pendente: fotos.', HOJE);
  assert.equal(celulas(csvPontos([comNota]).split('\r\n').filter(Boolean)[4])[col('OBSERVACOES')], 'Feito: vistoria. Pendente: fotos.');
});

// ---------- Anotações (observações) ----------

test('anotação do ponto: guarda o texto, registra no histórico, apaga com texto vazio e não altera a operação recebida', () => {
  const op = vistoriada();
  const antes = JSON.stringify(op);
  const a = salvarObservacaoPonto(op, 2, '  Feito: relatório rascunhado.\nPendente: anexar fotos.  ', HOJE);
  assert.equal(a.pontos[1].observacoes, 'Feito: relatório rascunhado.\nPendente: anexar fotos.');
  assert.equal(a.historico.at(-1).evento, 'Ponto 2: anotação iniciada');
  const b = salvarObservacaoPonto(a, 2, 'Feito: fotos anexadas.', HOJE);
  assert.equal(b.historico.at(-1).evento, 'Ponto 2: anotação atualizada');
  assert.equal(salvarObservacaoPonto(b, 2, 'Feito: fotos anexadas.', HOJE), b); // sem mudança, sem evento
  const c = salvarObservacaoPonto(b, 2, '   ', HOJE);
  assert.equal('observacoes' in c.pontos[1], false);
  assert.equal(c.historico.at(-1).evento, 'Ponto 2: anotação apagada');
  assert.equal(JSON.stringify(op), antes);
  assert.match(erros(() => salvarObservacaoPonto(op, 2, 'x'.repeat(501), HOJE)).observacoes, /500/);
  assert.match(erros(() => salvarObservacaoPonto(op, 99, 'x', HOJE)).ponto, /Ponto 99 não encontrado/);
});

test('a anotação do ponto sobrevive a agrupar, concluir o relatório e registrar autos', () => {
  let op = salvarObservacaoPonto(vistoriada(), 1, 'Pendente: confirmar o proprietário.', HOJE);
  op = alterarEtapaRelatorio(agruparRelatorio(op, [1, 2], HOJE), 'R1', 'relatorio_concluido', HOJE);
  op = registrarAuto(op, 1, { tipo: 'auto_infracao', data: HOJE }, HOJE);
  assert.equal(op.pontos[0].observacoes, 'Pendente: confirmar o proprietário.');
});
