import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lerPlanilha } from '../js/planilha.js';
import { agruparRelatorio, alterarEtapaRelatorio, criarOperacao, registrarAuto, registrarRetorno, salvarObservacaoPonto } from '../js/operacoes.js';
import { descricaoDoRelatorio, filtrosPontosEmUso, listarPontos, pontosDasOperacoes, resumoDosPontos, situacaoDoPonto } from '../js/pontos.js';
import { SITUACOES_PONTO } from '../js/rotulos.js';

const HOJE = '2026-10-15';
const seed = JSON.parse(readFileSync(new URL('../data/seed.json', import.meta.url), 'utf8'));
const planilha = lerPlanilha(readFileSync(new URL('../data/planilha-exemplo.tsv', import.meta.url), 'utf8')).operacao;
const formatar = (iso) => iso.split('-').reverse().join('/');
const ids = (linhas) => linhas.map((l) => `${l.operacaoId}:${l.n}`);

test('situação do ponto a partir da etapa', () => {
  const por = (etapa) => situacaoDoPonto({ etapa });
  assert.equal(por('planejado'), 'planejado');
  assert.equal(por('vistoriado'), 'aguardando_relatorio');
  assert.equal(por('relatorio_elaboracao'), 'aguardando_relatorio');
  assert.equal(por('relatorio_concluido'), 'a_lavrar');
  assert.equal(por('auto_lavrado'), 'com_auto');
  assert.equal(por('encerrado_nao_constatado'), 'encerrado_sem_auto');
  assert.equal(por('encerrado_nao_acessado'), 'encerrado_sem_auto');
  assert.deepEqual(Object.keys(SITUACOES_PONTO), ['planejado', 'aguardando_relatorio', 'a_lavrar', 'com_auto', 'encerrado_sem_auto']);
});

test('o exemplo tem 21 pontos de 2 operações, contados por situação', () => {
  const linhas = pontosDasOperacoes(seed.demandas);
  assert.equal(linhas.length, 21); // 13 + 8
  assert.deepEqual(resumoDosPontos(linhas), { total: 21, planejado: 0, aguardando_relatorio: 9, a_lavrar: 2, com_auto: 6, encerrado_sem_auto: 4 });
});

test('o resumo dos pontos bate com os indicadores de relatórios e autos do painel', () => {
  const r = resumoDosPontos(pontosDasOperacoes(seed.demandas));
  assert.equal(r.aguardando_relatorio, 9); // = relatórios pendentes do RF06 (6 + 3), sem grupos
  assert.equal(r.a_lavrar, 2); // = autos a lavrar do RF06
});

test('a lista traz primeiro o que falta; dentro da situação, por operação e número', () => {
  const lista = listarPontos(seed.demandas);
  assert.equal(lista.length, 21);
  assert.deepEqual(ids(lista).slice(0, 4), ['DEM-0001:8', 'DEM-0001:9', 'DEM-0001:10', 'DEM-0001:11']);
  assert.equal(lista[0].situacao, 'aguardando_relatorio');
  assert.equal(lista.at(-1).situacao, 'encerrado_sem_auto');
  const situacoes = lista.map((l) => l.situacao);
  assert.deepEqual([...new Set(situacoes)], ['aguardando_relatorio', 'a_lavrar', 'com_auto', 'encerrado_sem_auto']);
});

test('filtros: situação, operação e busca (sem acento nem caixa)', () => {
  const por = (f) => ids(listarPontos(seed.demandas, f));
  assert.deepEqual(por({ situacao: 'a_lavrar' }), ['DEM-0001:7', 'DEM-0002:5']);
  assert.equal(por({ operacao: 'DEM-0002' }).length, 8);
  assert.deepEqual(por({ operacao: 'DEM-0002', situacao: 'a_lavrar' }), ['DEM-0002:5']);
  assert.equal(por({ busca: 'municipio ficticio c' }).length > 0, true);
  assert.deepEqual(por({ busca: 'equipe ficticia sul', situacao: 'com_auto' }), ['DEM-0002:1', 'DEM-0002:2']);
  assert.deepEqual(por({ busca: 'ponto 7', operacao: 'DEM-0001' }), ['DEM-0001:7']);
  assert.deepEqual(por({ busca: 'nada disso' }), []);
  assert.equal(filtrosPontosEmUso({}), false);
  assert.equal(filtrosPontosEmUso({ busca: '   ' }), false);
  assert.equal(filtrosPontosEmUso({ situacao: 'a_lavrar' }), true);
});

test('relatório agrupado, autos e anotações aparecem na linha do ponto e na busca', () => {
  let op = registrarRetorno(criarOperacao(planilha, { prazo_dias: 10, horas_ponto: 3 }, seed.demandas, HOJE), HOJE);
  op = alterarEtapaRelatorio(agruparRelatorio(op, [1, 2, 3], HOJE), 'R1', 'relatorio_concluido', HOJE);
  op = registrarAuto(op, 1, { tipo: 'termo_embargo', data: '2026-10-16' }, HOJE);
  op = registrarAuto(op, 1, { tipo: 'auto_infracao', data: '2026-10-17' }, HOJE);
  op = salvarObservacaoPonto(op, 2, 'Pendente: confirmar o autuado.', HOJE);
  const demandas = [...seed.demandas, op];
  const linha = (n) => listarPontos(demandas, { operacao: 'DEM-0014' }).find((l) => l.n === n);
  assert.deepEqual(linha(1).relatorio, { id: 'R1', pontos: [1, 2, 3] });
  assert.deepEqual(linha(1).autos.map((a) => a.tipo), ['termo_embargo', 'auto_infracao']);
  assert.equal(linha(1).situacao, 'com_auto');
  assert.equal(linha(2).situacao, 'a_lavrar');
  assert.equal(linha(4).relatorio, null);
  assert.equal(linha(4).situacao, 'aguardando_relatorio');
  assert.deepEqual(ids(listarPontos(demandas, { busca: 'confirmar o autuado' })), ['DEM-0014:2']);
  assert.deepEqual(ids(listarPontos(demandas, { busca: 'R1', operacao: 'DEM-0014' })), ['DEM-0014:2', 'DEM-0014:3', 'DEM-0014:1']);
  assert.deepEqual(ids(listarPontos(demandas, { busca: 'termo de embargo' })), ['DEM-0014:1']);
  const resumo = resumoDosPontos(listarPontos(demandas, { operacao: 'DEM-0014' }));
  assert.deepEqual([resumo.total, resumo.aguardando_relatorio, resumo.a_lavrar, resumo.com_auto], [13, 10, 2, 1]);
});

test('texto do relatório do ponto', () => {
  const l = (extra) => ({ relatorio: null, etapa: 'vistoriado', dataRelatorio: null, ...extra });
  assert.equal(descricaoDoRelatorio(l({}), formatar), 'relatório próprio · pendente');
  assert.equal(descricaoDoRelatorio(l({ etapa: 'planejado' }), formatar), 'relatório próprio · aguardando o retorno da equipe');
  assert.equal(descricaoDoRelatorio(l({ etapa: 'relatorio_elaboracao' }), formatar), 'relatório próprio · em elaboração');
  assert.equal(descricaoDoRelatorio(l({ etapa: 'relatorio_concluido', dataRelatorio: '2026-10-12' }), formatar), 'relatório próprio · concluído em 12/10/2026');
  assert.equal(
    descricaoDoRelatorio(l({ etapa: 'auto_lavrado', dataRelatorio: '2026-10-12', relatorio: { id: 'R2', pontos: [4, 5] } }), formatar),
    'R2 (pontos 4, 5) · concluído em 12/10/2026'
  );
  assert.equal(descricaoDoRelatorio(l({ etapa: 'encerrado_nao_acessado', dataRelatorio: '2026-10-12' }), formatar), 'relatório próprio · encerrado sem auto (relatório de 12/10/2026)');
});

test('as funções não alteram as operações recebidas e não incluem outros tipos de demanda', () => {
  const antes = JSON.stringify(seed.demandas);
  listarPontos(seed.demandas, { busca: 'a' });
  resumoDosPontos(pontosDasOperacoes(seed.demandas));
  assert.equal(JSON.stringify(seed.demandas), antes);
  assert.equal(pontosDasOperacoes(seed.demandas.filter((d) => d.tipo !== 'operacao')).length, 0);
});
