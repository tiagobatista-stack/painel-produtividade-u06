import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  criarDemanda, editarDemanda, alterarStatus, alternarAnotacaoDaDemanda, migrarDemanda, listarDemandas, proximoId, normalizarBusca, ErroCadastro, origensDoTipo, FILTROS_PADRAO, filtrosEmUso, removerDemanda,
  restaurarDemanda, itemDaDemanda,
} from '../js/demandas.js';
import { calcularIndicadores } from '../js/indicadores.js';
import { adicionarAnotacoes } from '../js/anotacoes.js';
import { priorizar } from '../js/regras.js';

const HOJE = '2026-10-15';
const seed = JSON.parse(readFileSync(new URL('../data/seed.json', import.meta.url), 'utf8'));
const ctx = { afastamentos: seed.afastamentos };

const processo = { tipo: 'processo', titulo: 'Parecer de teste', origem: 'mp', prazo: '2026-10-14', status: 'a_fazer', protocolo: 'SEMA-PRO-FICT-0999', etapa: 'analise', esforco_h: '2' };
const reuniao = { tipo: 'reuniao', titulo: 'Reunião de teste', origem: 'chefia', prazo: '2026-10-20', status: 'a_fazer', data_hora: '2026-10-20T09:00', local: 'Sala fictícia' };
const palestra = { tipo: 'palestra', titulo: 'Palestra de teste', origem: 'propria', prazo: '2026-10-22', status: 'a_fazer', data_hora: '2026-10-22T10:00', local: 'Auditório', publico: '40' };
const outra = { tipo: 'outra', titulo: 'Tarefa de teste', origem: 'propria', prazo: '2026-10-25', status: 'a_fazer' };

const erroCampos = (fn) => {
  try { fn(); } catch (e) { assert.ok(e instanceof ErroCadastro); return Object.keys(e.erros).sort(); }
  assert.fail('deveria lançar ErroCadastro');
};

test('cria demanda de cada tipo com id sequencial, criação e histórico', () => {
  const d = criarDemanda(processo, seed.demandas, HOJE);
  assert.equal(d.id, 'DEM-0015');
  assert.equal(d.criada_em, HOJE);
  assert.deepEqual(d.historico, [{ data: HOJE, evento: 'Criada' }]);
  assert.equal(d.esforco_h, 2);
  assert.equal(d.protocolo, 'SEMA-PRO-FICT-0999');
  assert.equal(criarDemanda(palestra, [], HOJE).publico, 40);
  assert.equal(criarDemanda(reuniao, [], HOJE).local, 'Sala fictícia');
  assert.equal(criarDemanda(outra, [], HOJE).tipo, 'outra');
});

test('campos de outro tipo são descartados', () => {
  const d = criarDemanda({ ...outra, etapa: 'analise', local: 'Y', publico: 3 }, [], HOJE);
  assert.equal('etapa' in d, false);
  assert.equal('local' in d, false);
  assert.equal('publico' in d, false);
});

test('proximoId parte de DEM-0001 e ignora ids fora do padrão', () => {
  assert.equal(proximoId([]), 'DEM-0001');
  assert.equal(proximoId([{ id: 'DEM-0009' }, { id: 'abc' }, { id: 'DEM-0003' }]), 'DEM-0010');
});

test('validação por tipo aponta todos os campos inválidos', () => {
  assert.deepEqual(erroCampos(() => criarDemanda({ tipo: 'processo' }, [], HOJE)), ['origem', 'prazo', 'status', 'titulo'].sort());
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

test('filtro padrão lista as 11 abertas ativas em ordem de prioridade (sobrestada fora)', () => {
  const r = listarDemandas(seed.demandas, {}, HOJE, ctx);
  assert.equal(r.itens.length, 11);
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
  assert.equal(r.itens.length, 12);
});

test('demanda com prazo inválido aparece em erros, não na fila', () => {
  const ruim = { id: 'RUIM', tipo: 'outra', origem: 'propria', status: 'a_fazer', prazo: '', titulo: 'Sem prazo', criada_em: HOJE };
  const r = listarDemandas([...seed.demandas, ruim], {}, HOJE, ctx);
  assert.deepEqual(r.erros.map((x) => x.demanda.id), ['RUIM']);
  assert.equal(r.itens.length, 11);
});

test('filtro Sobrestado lista as sobrestadas pelo prazo registrado, sem pontuação, e respeita tipo e busca', () => {
  const sobrestada = { id: 'S2', tipo: 'processo', origem: 'mp', status: 'aguardando', prazo: '2026-10-01', titulo: 'Aguardando interessado', criada_em: HOJE, protocolo: 'SEMA-PRO-FICT-1' };
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
  assert.deepEqual({ ...FILTROS_PADRAO }, { busca: '', tipo: '', status: 'abertas', prioridade: '', prazo: '' });
  assert.equal(filtrosEmUso(FILTROS_PADRAO), false);
  assert.equal(filtrosEmUso({}), false);
  assert.equal(filtrosEmUso({ busca: 'reunião' }), true);
  assert.equal(filtrosEmUso({ tipo: 'operacao' }), true);
  assert.equal(filtrosEmUso({ status: 'concluida' }), true);
  assert.equal(filtrosEmUso({ status: 'aguardando' }), true);
  assert.equal(filtrosEmUso({ prioridade: 'Crítica' }), true);
  assert.equal(filtrosEmUso({ prazo: 'vencidas' }), true);
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
  assert.equal(limpa.itens.length, 11);
  assert.deepEqual(limpa.itens.map((x) => x.demanda.id), listarDemandas(seed.demandas, {}, HOJE, ctx).itens.map((x) => x.demanda.id));
  assert.equal(Object.isFrozen(FILTROS_PADRAO), true);
  assert.equal(seed.demandas.length, 14); // listar nunca altera as demandas
});

// ---- Campos novos, ajuste manual de prioridade, anotações e migração ----

test('campos novos: descrição, responsável, município e protocolo são guardados e têm limites', () => {
  const d = criarDemanda({ ...processo, descricao: ' Contexto ', responsavel: 'Equipe A', municipio: 'Cidade Fictícia', protocolo: 'SEMA-PRO-FICT-0001' }, [], HOJE);
  assert.deepEqual([d.descricao, d.responsavel, d.municipio, d.protocolo], ['Contexto', 'Equipe A', 'Cidade Fictícia', 'SEMA-PRO-FICT-0001']);
  assert.deepEqual(d.anotacoes, []);
  assert.equal('prioridade_manual' in d, false);
  assert.deepEqual(erroCampos(() => criarDemanda({ ...outra, descricao: 'x'.repeat(2001) }, [], HOJE)), ['descricao']);
  assert.equal(criarDemanda({ ...outra, descricao: 'x'.repeat(2000) }, [], HOJE).descricao.length, 2000);
  assert.deepEqual(erroCampos(() => criarDemanda({ ...outra, titulo: 'x'.repeat(121) }, [], HOJE)), ['titulo']);
  assert.deepEqual(erroCampos(() => criarDemanda({ ...outra, municipio: 'x'.repeat(121) }, [], HOJE)), ['municipio']);
});

test('etapa do processo é escolhida na lista; valor fora dela é recusado', () => {
  for (const etapa of ['triagem', 'analise', 'parecer', 'devolvido']) assert.equal(criarDemanda({ ...processo, etapa }, [], HOJE).etapa, etapa);
  assert.deepEqual(erroCampos(() => criarDemanda({ ...processo, etapa: 'qualquer coisa' }, [], HOJE)), ['etapa']);
  assert.equal('etapa' in criarDemanda({ ...processo, etapa: '' }, [], HOJE), false);
});

test('prioridade manual: exige motivo (até 200) e só aceita as quatro faixas', () => {
  assert.deepEqual(erroCampos(() => criarDemanda({ ...outra, prioridade_manual: 'alta' }, [], HOJE)), ['motivo_ajuste']);
  assert.deepEqual(erroCampos(() => criarDemanda({ ...outra, prioridade_manual: 'alta', motivo_ajuste: '  ' }, [], HOJE)), ['motivo_ajuste']);
  assert.deepEqual(erroCampos(() => criarDemanda({ ...outra, prioridade_manual: 'alta', motivo_ajuste: 'x'.repeat(201) }, [], HOJE)), ['motivo_ajuste']);
  assert.deepEqual(erroCampos(() => criarDemanda({ ...outra, prioridade_manual: 'urgente', motivo_ajuste: 'x' }, [], HOJE)), ['prioridade_manual']);
  const d = criarDemanda({ ...outra, prioridade_manual: 'alta', motivo_ajuste: 'Pedido da chefia' }, [], HOJE);
  assert.deepEqual([d.prioridade_manual, d.motivo_ajuste], ['alta', 'Pedido da chefia']);
  // automática: motivo digitado e esquecido no formulário não é guardado
  const auto = criarDemanda({ ...outra, prioridade_manual: '', motivo_ajuste: 'sobra' }, [], HOJE);
  assert.equal('prioridade_manual' in auto, false);
  assert.equal('motivo_ajuste' in auto, false);
});

test('editar: voltar para automática remove o ajuste; trocar registra no histórico; campos limpos somem', () => {
  const d0 = criarDemanda({ ...processo, descricao: 'antiga', responsavel: 'Fulano' }, [], HOJE);
  const d1 = editarDemanda(d0, { ...processo, prioridade_manual: 'baixa', motivo_ajuste: 'Aguarda outra área' }, HOJE);
  assert.deepEqual([d1.prioridade_manual, d1.motivo_ajuste], ['baixa', 'Aguarda outra área']);
  assert.equal('descricao' in d1, false); // veio vazio no formulário
  assert.equal('responsavel' in d1, false);
  assert.ok(d1.historico.some((h) => h.evento === 'Prioridade: Automática → Baixa (manual)'));
  const d2 = editarDemanda(d1, { ...processo, prioridade_manual: '' }, HOJE);
  assert.equal('prioridade_manual' in d2, false);
  assert.equal('motivo_ajuste' in d2, false);
  assert.ok(d2.historico.some((h) => h.evento === 'Prioridade: Baixa (manual) → Automática'));
});

test('ajuste manual muda o grupo na fila, não o score calculado', () => {
  const nova = criarDemanda({ ...processo, prioridade_manual: 'baixa', motivo_ajuste: 'x' }, seed.demandas, HOJE); // MP vencido → 90
  const { itens } = listarDemandas([...seed.demandas, nova], {}, HOJE, ctx);
  const item = itens.find((x) => x.demanda.id === nova.id);
  assert.deepEqual([item.score, item.faixa, item.faixa_calculada, item.modo], [90, 'Baixa', 'Crítica', 'manual']);
  assert.ok(itens.indexOf(item) >= itens.findIndex((x) => x.faixa === 'Baixa'));
  // o filtro por prioridade usa a faixa efetiva
  assert.ok(listarDemandas([...seed.demandas, nova], { prioridade: 'Baixa' }, HOJE, ctx).itens.some((x) => x.demanda.id === nova.id));
  assert.equal(listarDemandas([...seed.demandas, nova], { prioridade: 'Crítica' }, HOJE, ctx).itens.some((x) => x.demanda.id === nova.id), false);
});

test('anotações no cadastro: guardadas, com histórico das já concluídas; edição registra "Anotação concluída"', () => {
  const lista = [
    { id: 'A-1', texto: 'feita', feita: true, criada_em: HOJE, concluida_em: HOJE },
    { id: 'A-2', texto: 'pendente', feita: false, criada_em: HOJE, concluida_em: null },
  ];
  const d = criarDemanda({ ...outra, anotacoes: lista }, [], HOJE);
  assert.equal(d.anotacoes.length, 2);
  assert.deepEqual(d.historico.map((h) => h.evento), ['Criada', 'Anotação concluída: feita']);
  const e = editarDemanda(d, { ...outra, anotacoes: d.anotacoes.map((a) => ({ ...a, feita: true })) }, '2026-10-16');
  assert.deepEqual(e.historico.map((h) => h.evento), ['Criada', 'Anotação concluída: feita', 'Editada', 'Anotação concluída: pendente']);
  assert.equal(editarDemanda(d, { ...outra }, HOJE).anotacoes.length, 2); // sem a lista informada, a existente é preservada
});

test('marcar anotação direto no cartão: alterna, registra no histórico e não mexe na prioridade', () => {
  const d0 = criarDemanda({ ...outra, anotacoes: adicionarAnotacoes([], 'a\nb\nc', HOJE) }, [], HOJE);
  const d1 = alternarAnotacaoDaDemanda(d0, 'A-2', '2026-10-16');
  assert.deepEqual(d1.anotacoes.map((a) => a.feita), [false, true, false]);
  assert.equal(d1.historico.at(-1).evento, 'Anotação concluída: b');
  assert.equal(d0.anotacoes[1].feita, false); // original intacto
  assert.equal(priorizar(d1, HOJE).score, priorizar(d0, HOJE).score);
  const d2 = alternarAnotacaoDaDemanda(d1, 'A-2', '2026-10-17'); // desmarcar não gera evento
  assert.equal(d2.historico.length, d1.historico.length);
  assert.equal(alternarAnotacaoDaDemanda(d0, 'A-99', HOJE), d0);
});

test('migração: dados antigos abrem sem erro (processo → protocolo, etapa da lista, anotacoes vazio)', () => {
  const antiga = { id: 'DEM-0003', tipo: 'processo', titulo: 'Antiga', origem: 'mp', status: 'em_andamento', prazo: '2026-10-13', criada_em: '2026-10-01', processo: 'SEMA-PRO-FICT-0042', etapa: 'despacho', historico: [] };
  const m = migrarDemanda(antiga);
  assert.equal(m.protocolo, 'SEMA-PRO-FICT-0042');
  assert.equal('processo' in m, false);
  assert.equal(m.etapa, 'analise');
  assert.deepEqual(m.anotacoes, []);
  assert.equal('processo' in antiga, true); // não altera o argumento
  assert.deepEqual(migrarDemanda(m), m); // idempotente
  const etapas = ['parecer', 'analise', 'despacho', 'aguardando_informacao', 'concluido', 'triagem', 'devolvido'].map((etapa) => migrarDemanda({ ...antiga, etapa }).etapa);
  assert.deepEqual(etapas, ['parecer', 'analise', 'analise', 'triagem', 'devolvido', 'triagem', 'devolvido']);
  assert.equal('etapa' in migrarDemanda({ ...antiga, etapa: 'outra coisa' }), false);
  // outros tipos e valores estranhos
  assert.deepEqual(migrarDemanda({ id: 'X', tipo: 'outra', descricao: 5, prioridade_manual: 'xyz', motivo_ajuste: 'm' }), { id: 'X', tipo: 'outra', anotacoes: [] });
  assert.equal(migrarDemanda({ id: 'Y', tipo: 'outra', protocolo: 'P', processo: 'Q' }).protocolo, 'P'); // protocolo já existente prevalece
});

test('migração: o motor continua calculando a fila com os dados migrados do exemplo', () => {
  const migradas = seed.demandas.map(migrarDemanda);
  assert.ok(migradas.every((d) => Array.isArray(d.anotacoes) && !('processo' in d)));
  const a = listarDemandas(seed.demandas, {}, HOJE, ctx).itens.map((x) => [x.demanda.id, x.score]);
  const b = listarDemandas(migradas, {}, HOJE, ctx).itens.map((x) => [x.demanda.id, x.score]);
  assert.deepEqual(b, a);
});

test('busca cobre descrição, responsável, município, protocolo e etapa', () => {
  const comuns = { ...outra };
  const d = criarDemanda({ ...comuns, titulo: 'Qualquer', descricao: 'ajustar cronograma', responsavel: 'Equipe Quadrante', municipio: 'Cidade Fictícia Gama', protocolo: 'REF-777' }, [], HOJE);
  const p = criarDemanda({ ...processo, etapa: 'parecer', protocolo: 'SEMA-PRO-FICT-0123' }, [d], HOJE);
  const todas = [d, p];
  const achar = (busca) => ids(listarDemandas(todas, { busca }, HOJE, ctx));
  assert.deepEqual(achar('cronograma'), [d.id]);
  assert.deepEqual(achar('quadrante'), [d.id]);
  assert.deepEqual(achar('gama'), [d.id]);
  assert.deepEqual(achar('ref-777'), [d.id]);
  assert.deepEqual(achar('0123'), [p.id]);
  assert.deepEqual(achar('parecer'), [p.id]);
});

test('removerDemanda tira só a demanda do id informado e não altera a lista original', () => {
  const original = seed.demandas;
  const total = original.length;
  const alvo = original[0].id;
  const nova = removerDemanda(original, alvo);
  assert.equal(nova.length, total - 1);
  assert.ok(!nova.some((d) => d.id === alvo));
  assert.equal(original.length, total);
  assert.deepEqual(removerDemanda(original, 'DEM-INEXISTENTE'), original);
});

test('filtro prazo: cada recorte lista exatamente os itens do indicador, em qualquer data', () => {
  for (const hoje of ['2026-10-15', '2026-10-16', '2026-10-30', '2026-12-10']) {
    const n = calcularIndicadores(seed.demandas, hoje);
    const lista = (filtros) => listarDemandas(seed.demandas, filtros, hoje, ctx).itens;
    assert.equal(lista({ prazo: 'vencidas' }).length, n.vencidas, `vencidas em ${hoje}`);
    assert.equal(lista({ prazo: 'proximos7' }).length, n.proximos7, `proximos7 em ${hoje}`);
    assert.equal(lista({ status: 'concluida', prazo: 'semana' }).length, n.concluidasSemana, `semana em ${hoje}`);
    assert.equal(lista({ status: 'aguardando' }).length, n.sobrestados, `sobrestados em ${hoje}`);
  }
});

test('filtro prazo no seed (15/10): vencidas e próximos 7 dias, e combinações que não fazem sentido ficam vazias', () => {
  const ids = (f) => listarDemandas(seed.demandas, f, HOJE, ctx).itens.map((x) => x.demanda.id);
  assert.deepEqual(ids({ prazo: 'vencidas' }), ['DEM-0003', 'DEM-0002']); // na ordem do motor
  assert.deepEqual(ids({ prazo: 'proximos7' }).sort(), ['DEM-0001', 'DEM-0005', 'DEM-0007', 'DEM-0008', 'DEM-0010']);
  assert.deepEqual(ids({ prazo: 'vencidas', status: 'concluida' }), []);
  assert.deepEqual(ids({ prazo: 'semana' }), []); // 'semana' só vale com status concluída
  assert.deepEqual(ids({ prazo: 'vencidas', tipo: 'operacao' }), ['DEM-0002']); // combina com os outros filtros
  assert.deepEqual(ids({ prazo: 'vencidas', busca: 'ministério' }), ['DEM-0003']);
});

test('restaurarDemanda devolve a demanda à posição original e recusa id repetido', () => {
  const original = seed.demandas;
  const meio = original[4];
  const sem = removerDemanda(original, meio.id);
  const volta = restaurarDemanda(sem, meio, 4);
  assert.deepEqual(volta.map((d) => d.id), original.map((d) => d.id)); // mesma ordem de antes
  assert.equal(sem.length, original.length - 1); // a lista recebida não foi alterada
  assert.deepEqual(restaurarDemanda(sem, meio, 999).at(-1), meio); // índice fora do intervalo: vai para o fim
  assert.deepEqual(restaurarDemanda(sem, meio, undefined).at(-1), meio);
  assert.throws(() => restaurarDemanda(original, meio, 0), (e) => e instanceof ErroCadastro && /já foi usado/.test(e.erros.id));
  // apagar a última e criar outra reaproveita o número; desfazer nesse caso é recusado
  const ultima = original.at(-1);
  const reaproveitada = [...removerDemanda(original, ultima.id)];
  reaproveitada.push(criarDemanda(processo, reaproveitada, HOJE));
  assert.equal(reaproveitada.at(-1).id, ultima.id);
  assert.throws(() => restaurarDemanda(reaproveitada, ultima, original.length - 1), ErroCadastro);
});

test('itemDaDemanda: placar de uma demanda sem depender dos filtros da fila', () => {
  const porId = (id) => seed.demandas.find((d) => d.id === id);
  const aberta = itemDaDemanda(porId('DEM-0003'), HOJE, ctx);
  assert.equal(aberta.score, 90);
  assert.equal(aberta.faixa, 'Crítica');
  assert.ok(aberta.motivos.includes('Prazo vencido (+50)'));
  assert.deepEqual(itemDaDemanda(porId('DEM-0012'), HOJE, ctx).concluida, true);
  assert.equal(itemDaDemanda(porId('DEM-0006'), HOJE, ctx).sobrestada, true);
  const invalida = itemDaDemanda({ ...porId('DEM-0003'), prazo: '' }, HOJE, ctx);
  assert.equal(invalida.erro, 'Prazo ausente ou inválido');
  const daFila = listarDemandas(seed.demandas, {}, HOJE, ctx).itens.find((x) => x.demanda.id === 'DEM-0001');
  const direto = itemDaDemanda(porId('DEM-0001'), HOJE, ctx);
  assert.deepEqual([direto.score, direto.faixa, direto.motivos], [daFila.score, daFila.faixa, daFila.motivos]);
});

test('texto livre antigo (observacoes) vira uma anotação por linha na migração e entra na busca', () => {
  const original = { ...seed.demandas.find((d) => d.id === 'DEM-0004'), observacoes: 'Feito: minuta enviada.\r\n\r\nPendente: protocolo-xyz.' };
  const antes = JSON.stringify(original);
  const m = migrarDemanda(original);
  assert.equal(JSON.stringify(original), antes); // não altera o argumento
  assert.equal('observacoes' in m, false);
  assert.deepEqual(m.anotacoes.map((x) => [x.id, x.texto, x.feita]), [['A-1', 'Feito: minuta enviada.', false], ['A-2', 'Pendente: protocolo-xyz.', false]]);
  assert.deepEqual(migrarDemanda(m), m); // idempotente
  // se já havia anotações em lista, o texto antigo vai para o fim
  const mista = migrarDemanda({ ...m, observacoes: 'Linha extra' });
  assert.deepEqual(mista.anotacoes.map((x) => x.texto), ['Feito: minuta enviada.', 'Pendente: protocolo-xyz.', 'Linha extra']);
  const demandas = seed.demandas.map((d) => (d.id === 'DEM-0004' ? m : d));
  assert.deepEqual(listarDemandas(demandas, { busca: 'protocolo-xyz' }, HOJE, ctx).itens.map((x) => x.demanda.id), ['DEM-0004']);
});

test('editar sem informar as anotações preserva a lista existente', () => {
  const d = criarDemanda({ ...outra, anotacoes: adicionarAnotacoes([], 'a\nb', HOJE) }, [], HOJE);
  assert.equal(editarDemanda(d, { ...outra, titulo: 'Novo título' }, HOJE).anotacoes.length, 2);
  assert.equal(editarDemanda(d, { ...outra, anotacoes: [] }, HOJE).anotacoes.length, 0); // lista vazia informada apaga
});

test('itemDaDemanda traz a faixa efetiva e a calculada quando há ajuste manual', () => {
  const d = { ...seed.demandas.find((x) => x.id === 'DEM-0008'), prioridade_manual: 'alta', motivo_ajuste: 'x' };
  const i = itemDaDemanda(d, HOJE, ctx);
  assert.deepEqual([i.faixa, i.faixa_calculada, i.modo, i.score], ['Alta', 'Média', 'manual', 35]);
});
