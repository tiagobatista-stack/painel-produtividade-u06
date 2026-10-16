import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  criarDemanda, editarDemanda, alterarStatus, listarDemandas, proximoId, normalizarBusca, ErroCadastro, origensDoTipo, FILTROS_PADRAO, filtrosEmUso,
} from '../js/demandas.js';

const HOJE = '2026-10-15';
const seed = JSON.parse(readFileSync(new URL('../data/seed.json', import.meta.url), 'utf8'));
const ctx = { afastamentos: seed.afastamentos };

const processo = { tipo: 'processo', titulo: 'Parecer de teste', origem: 'mp', prazo: '2026-10-14', status: 'a_fazer', processo: 'SEMA-PRO-FICT-0999', etapa: 'analise', esforco_h: '2' };
const reuniao = { tipo: 'reuniao', titulo: 'Reunião de teste', origem: 'chefia', prazo: '2026-10-20', status: 'a_fazer', data_hora: '2026-10-20T09:00', local: 'Sala fictícia' };
const palestra = { tipo: 'palestra', titulo: 'Palestra de teste', origem: 'propria', prazo: '2026-10-22', status: 'a_fazer', data_hora: '2026-10-22T10:00', local: 'Auditório', publico: '40' };
const outra = { tipo: 'outra', titulo: 'Tarefa de teste', origem: 'propria', prazo: '2026-10-25', status: 'a_fazer' };

const erroCampos = (fn) => {
  try { fn(); } catch (e) { assert.ok(e instanceof ErroCadastro); return Object.keys(e.erros).sort(); }
  assert.fail('deveria lançar ErroCadastro');
};

test('cria demanda de cada tipo com id sequencial, criação e histórico', () => {
  const d = criarDemanda(processo, seed.demandas, HOJE);
  assert.equal(d.id, 'DEM-0014');
  assert.equal(d.criada_em, HOJE);
  assert.deepEqual(d.historico, [{ data: HOJE, evento: 'Criada' }]);
  assert.equal(d.esforco_h, 2);
  assert.equal(d.processo, 'SEMA-PRO-FICT-0999');
  assert.equal(criarDemanda(palestra, [], HOJE).publico, 40);
  assert.equal(criarDemanda(reuniao, [], HOJE).local, 'Sala fictícia');
  assert.equal(criarDemanda(outra, [], HOJE).tipo, 'outra');
});

test('campos de outro tipo são descartados', () => {
  const d = criarDemanda({ ...outra, processo: 'X', local: 'Y', publico: 3 }, [], HOJE);
  assert.equal('processo' in d, false);
  assert.equal('local' in d, false);
  assert.equal('publico' in d, false);
});

test('proximoId parte de DEM-0001 e ignora ids fora do padrão', () => {
  assert.equal(proximoId([]), 'DEM-0001');
  assert.equal(proximoId([{ id: 'DEM-0009' }, { id: 'abc' }, { id: 'DEM-0003' }]), 'DEM-0010');
});

test('validação por tipo aponta todos os campos inválidos', () => {
  assert.deepEqual(erroCampos(() => criarDemanda({ tipo: 'processo' }, [], HOJE)), ['origem', 'processo', 'prazo', 'status', 'titulo'].sort());
  assert.deepEqual(erroCampos(() => criarDemanda({ ...reuniao, local: ' ', data_hora: '2026-10-20' }, [], HOJE)), ['data_hora', 'local']);
  assert.deepEqual(erroCampos(() => criarDemanda({ ...palestra, publico: '-2' }, [], HOJE)), ['publico']);
  assert.deepEqual(erroCampos(() => criarDemanda({ ...outra, prazo: '2026-02-31x' }, [], HOJE)), ['prazo']);
  assert.deepEqual(erroCampos(() => criarDemanda({ ...outra, titulo: 'x'.repeat(121) }, [], HOJE)), ['titulo']);
  assert.deepEqual(erroCampos(() => criarDemanda({ ...outra, esforco_h: 'abc' }, [], HOJE)), ['esforco_h']);
});

test('origens: processo aceita todas; os demais só chefia e própria', () => {
  assert.ok(origensDoTipo('processo').includes('mp'));
  assert.deepEqual(origensDoTipo('reuniao'), ['chefia', 'propria']);
  assert.deepEqual(erroCampos(() => criarDemanda({ ...reuniao, origem: 'mp' }, [], HOJE)), ['origem']);
});

test('operação não é criada por formulário e seu status é derivado', () => {
  assert.deepEqual(erroCampos(() => criarDemanda({ ...outra, tipo: 'operacao' }, [], HOJE)), ['tipo']);
  assert.equal(editarDemanda(seed.demandas[0], { titulo: 'Novo título', origem: 'chefia', prazo_dias: 10, horas_ponto: 3 }, HOJE).titulo, 'Novo título'); // operação edita só título, origem e parâmetros
  assert.deepEqual(erroCampos(() => alterarStatus(seed.demandas[0], 'concluida', HOJE)), ['status']);
  assert.throws(() => alterarStatus(seed.demandas[0], 'aguardando', HOJE), (e) => e instanceof ErroCadastro && /Sobrestar operação/.test(e.erros.status));
});

test('criar não altera a lista original', () => {
  const antes = JSON.stringify(seed.demandas);
  criarDemanda(processo, seed.demandas, HOJE);
  assert.equal(JSON.stringify(seed.demandas), antes);
});

test('alterarStatus registra histórico e controla concluida_em', () => {
  const d0 = criarDemanda(outra, [], HOJE);
  const d1 = alterarStatus(d0, 'em_andamento', HOJE);
  assert.equal(d1.status, 'em_andamento');
  assert.equal(d1.historico.at(-1).evento, 'Status: A fazer → Em andamento');
  const d2 = alterarStatus(d1, 'concluida', '2026-10-16');
  assert.equal(d2.concluida_em, '2026-10-16');
  assert.equal(d2.historico.at(-1).evento, 'Status: Em andamento → Concluída');
  const d3 = alterarStatus(d2, 'aguardando', '2026-10-17');
  assert.equal('concluida_em' in d3, false);
  assert.equal(alterarStatus(d3, 'aguardando', HOJE), d3); // sem mudança, sem novo evento
  assert.equal(d0.status, 'a_fazer'); // original intacto
  assert.deepEqual(erroCampos(() => alterarStatus(d0, 'inexistente', HOJE)), ['status']);
});

test('editarDemanda preserva id, criação e histórico e registra a edição', () => {
  const d0 = criarDemanda(reuniao, seed.demandas, HOJE);
  const d1 = editarDemanda(d0, { ...reuniao, titulo: 'Reunião remarcada', status: 'aguardando' }, '2026-10-16');
  assert.equal(d1.id, d0.id);
  assert.equal(d1.criada_em, HOJE);
  assert.equal(d1.titulo, 'Reunião remarcada');
  assert.deepEqual(d1.historico.map((h) => h.evento), ['Criada', 'Editada', 'Status: A fazer → Sobrestado (aguardando)']);
  assert.equal(d0.titulo, 'Reunião de teste');
  assert.deepEqual(erroCampos(() => editarDemanda(d0, { ...reuniao, titulo: '' }, HOJE)), ['titulo']);
});

test('editar mantém a data de conclusão de quem já estava concluída', () => {
  const concluida = criarDemanda({ ...outra, status: 'concluida' }, [], '2026-10-12');
  assert.equal(concluida.concluida_em, '2026-10-12');
  const editada = editarDemanda(concluida, { ...outra, titulo: 'Novo título', status: 'concluida' }, '2026-10-15');
  assert.equal(editada.concluida_em, '2026-10-12');
});

const ids = (r) => r.itens.map((x) => x.demanda.id);

test('filtro padrão lista as 10 abertas ativas em ordem de prioridade (sobrestada fora)', () => {
  const r = listarDemandas(seed.demandas, {}, HOJE, ctx);
  assert.equal(r.itens.length, 10);
  assert.equal(r.itens.some((x) => x.demanda.id === 'DEM-0006'), false);
  assert.equal(ids(r)[0], 'DEM-0003');
  assert.ok(r.itens.every((x) => x.faixa));
});

test('filtros de tipo, status e prioridade', () => {
  assert.deepEqual(ids(listarDemandas(seed.demandas, { tipo: 'operacao' }, HOJE, ctx)), ['DEM-0002', 'DEM-0001']);
  assert.deepEqual(ids(listarDemandas(seed.demandas, { status: 'aguardando' }, HOJE, ctx)), ['DEM-0006']); // lista as sobrestadas
  assert.deepEqual(ids(listarDemandas(seed.demandas, { prioridade: 'Crítica' }, HOJE, ctx)), ['DEM-0003', 'DEM-0002']);
  assert.deepEqual(ids(listarDemandas(seed.demandas, { tipo: 'processo', prioridade: 'Alta' }, HOJE, ctx)), ['DEM-0004', 'DEM-0005']);
});

test('filtro Concluída lista as concluídas mais recentes primeiro, sem pontuação', () => {
  const r = listarDemandas(seed.demandas, { status: 'concluida' }, HOJE, ctx);
  assert.deepEqual(ids(r), ['DEM-0013', 'DEM-0012']);
  assert.ok(r.itens.every((x) => x.concluida === true && x.score === undefined));
  assert.deepEqual(ids(listarDemandas(seed.demandas, { status: 'concluida', prioridade: 'Alta' }, HOJE, ctx)), []);
});

test('busca ignora acentos e maiúsculas, exige todos os termos e cobre vários campos', () => {
  assert.equal(normalizarBusca('Ministério'), 'ministerio');
  assert.deepEqual(ids(listarDemandas(seed.demandas, { busca: 'MINISTERIO publico' }, HOJE, ctx)), ['DEM-0003']);
  assert.deepEqual(ids(listarDemandas(seed.demandas, { busca: 'sema-pro-fict-0063' }, HOJE, ctx)), ['DEM-0005']);
  assert.deepEqual(ids(listarDemandas(seed.demandas, { busca: 'auditório' }, HOJE, ctx)), ['DEM-0010']);
  assert.deepEqual(ids(listarDemandas(seed.demandas, { busca: 'equipe fictícia SUL' }, HOJE, ctx)), ['DEM-0002']);
  assert.deepEqual(ids(listarDemandas(seed.demandas, { busca: 'município fictício' }, HOJE, ctx)), ['DEM-0002', 'DEM-0001']); // município dos pontos
  assert.deepEqual(ids(listarDemandas(seed.demandas, { busca: 'nada disso existe' }, HOJE, ctx)), []);
});

test('nova demanda entra na fila com prioridade calculada', () => {
  const nova = criarDemanda(processo, seed.demandas, HOJE); // MP vencido → 90
  const r = listarDemandas([...seed.demandas, nova], {}, HOJE, ctx);
  const item = r.itens.find((x) => x.demanda.id === nova.id);
  assert.equal(item.score, 90);
  assert.equal(item.faixa, 'Crítica');
  assert.equal(r.itens.length, 11);
});

test('demanda com prazo inválido aparece em erros, não na fila', () => {
  const ruim = { id: 'RUIM', tipo: 'outra', origem: 'propria', status: 'a_fazer', prazo: '', titulo: 'Sem prazo', criada_em: HOJE };
  const r = listarDemandas([...seed.demandas, ruim], {}, HOJE, ctx);
  assert.deepEqual(r.erros.map((x) => x.demanda.id), ['RUIM']);
  assert.equal(r.itens.length, 10);
});

test('filtro Sobrestado lista as sobrestadas pelo prazo registrado, sem pontuação, e respeita tipo e busca', () => {
  const sobrestada = { id: 'S2', tipo: 'processo', origem: 'mp', status: 'aguardando', prazo: '2026-10-01', titulo: 'Aguardando interessado', criada_em: HOJE, processo: 'SEMA-PRO-FICT-1' };
  const todas = [...seed.demandas, sobrestada];
  const r = listarDemandas(todas, { status: 'aguardando' }, HOJE, ctx);
  assert.deepEqual(ids(r), ['S2', 'DEM-0006']); // prazo mais antigo primeiro
  assert.ok(r.itens.every((x) => x.sobrestada === true && x.score === undefined));
  assert.deepEqual(ids(listarDemandas(todas, { status: 'aguardando', busca: 'interessado' }, HOJE, ctx)), ['S2']);
  assert.deepEqual(ids(listarDemandas(todas, { status: 'aguardando', tipo: 'reuniao' }, HOJE, ctx)), []);
  assert.deepEqual(ids(listarDemandas(todas, { status: 'aguardando', prioridade: 'Alta' }, HOJE, ctx)), []);
  assert.equal(listarDemandas(todas, {}, HOJE, ctx).itens.some((x) => x.demanda.id === 'S2'), false);
});

test('sobrestar e retomar pelo status: histórico e prazo registrado preservado', () => {
  const d0 = criarDemanda(processo, [], HOJE); // processo MP, prazo 14/10 (vencido)
  const d1 = alterarStatus(d0, 'aguardando', HOJE);
  assert.equal(d1.prazo, '2026-10-14');
  assert.equal(listarDemandas([d1], {}, HOJE).itens.length, 0);
  const d2 = alterarStatus(d1, 'em_andamento', '2026-10-20');
  assert.equal(d2.prazo, '2026-10-14'); // sem recálculo
  assert.deepEqual(d2.historico.map((h) => h.evento), ['Criada', 'Status: A fazer → Sobrestado (aguardando)', 'Status: Sobrestado (aguardando) → Em andamento']);
  assert.equal(listarDemandas([d2], {}, '2026-10-20').itens[0].faixa, 'Crítica');
});

test('filtros padrão: nenhum filtro em uso, e cada campo fora do padrão conta', () => {
  assert.deepEqual({ ...FILTROS_PADRAO }, { busca: '', tipo: '', status: 'abertas', prioridade: '' });
  assert.equal(filtrosEmUso(FILTROS_PADRAO), false);
  assert.equal(filtrosEmUso({}), false);
  assert.equal(filtrosEmUso({ busca: 'reunião' }), true);
  assert.equal(filtrosEmUso({ tipo: 'operacao' }), true);
  assert.equal(filtrosEmUso({ status: 'concluida' }), true);
  assert.equal(filtrosEmUso({ status: 'aguardando' }), true);
  assert.equal(filtrosEmUso({ prioridade: 'Crítica' }), true);
  assert.equal(filtrosEmUso({ busca: 'a', tipo: 'outra', status: 'a_fazer', prioridade: 'Baixa' }), true);
});

test('busca só com espaços não é filtro (não filtra nada)', () => {
  assert.equal(filtrosEmUso({ busca: '   ' }), false);
  const todas = listarDemandas(seed.demandas, { busca: '   ' }, HOJE, ctx).itens.length;
  assert.equal(todas, listarDemandas(seed.demandas, {}, HOJE, ctx).itens.length);
});

test('limpar filtros: listar com o padrão devolve a fila ativa completa, e o padrão é imutável', () => {
  const filtrada = listarDemandas(seed.demandas, { busca: 'reunião', tipo: 'reuniao', status: 'concluida', prioridade: 'Alta' }, HOJE, ctx);
  assert.equal(filtrada.itens.length, 0);
  const limpa = listarDemandas(seed.demandas, { ...FILTROS_PADRAO }, HOJE, ctx);
  assert.equal(limpa.itens.length, 10);
  assert.deepEqual(limpa.itens.map((x) => x.demanda.id), listarDemandas(seed.demandas, {}, HOJE, ctx).itens.map((x) => x.demanda.id));
  assert.equal(Object.isFrozen(FILTROS_PADRAO), true);
  assert.equal(seed.demandas.length, 13); // listar nunca altera as demandas
});
