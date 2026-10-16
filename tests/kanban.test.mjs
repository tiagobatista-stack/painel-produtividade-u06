import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ErroKanban, FILTROS_KANBAN_PADRAO, STATUS_KANBAN, agruparPorStatus, criarCard, descreverPrazo, editarCard, estaAtrasado, filtrosKanbanEmUso,
  listarCards, moverCard, proximoIdCard, removerCard, restaurarCard,
} from '../js/kanban.js';
import { CHAVE_KANBAN, carregarKanban, salvarKanban } from '../js/kanban-armazenamento.js';

const exemplo = JSON.parse(readFileSync(new URL('../data/kanban-exemplo.json', import.meta.url), 'utf8'));
const HOJE = '2026-10-15';
const cards = exemplo.cards;
const ids = (lista) => lista.map((c) => c.id);
const erros = (fn) => {
  try {
    fn();
  } catch (e) {
    assert.ok(e instanceof ErroKanban);
    return e.erros;
  }
  assert.fail('deveria lançar ErroKanban');
};

test('os 4 status do Kanban', () => {
  assert.deepEqual(Object.values(STATUS_KANBAN), ['Backlog', 'Em andamento', 'Em revisão', 'Concluído']);
});

test('o exemplo tem 8 cards, 3/2/2/1 por coluna, e só dados fictícios', () => {
  const grupos = agruparPorStatus(cards);
  assert.deepEqual(Object.values(grupos).map((g) => g.length), [3, 2, 2, 1]);
  assert.equal(JSON.stringify(exemplo).includes('SEMA'), false);
});

test('criar card: campos, id sequencial, histórico e data', () => {
  const novo = criarCard({ titulo: '  Preparar a demonstração ', descricao: 'Roteiro de 5 minutos', prioridade: 'alta', prazo: '2026-10-20' }, cards, HOJE);
  assert.equal(novo.id, 'K-0009');
  assert.equal(novo.titulo, 'Preparar a demonstração');
  assert.equal(novo.status, 'backlog'); // o status padrão é o Backlog
  assert.equal(novo.criado_em, HOJE);
  assert.deepEqual(novo.historico, [{ data: HOJE, evento: 'Criado' }]);
  assert.equal(proximoIdCard([]), 'K-0001');
});

test('criar card: descrição e prazo são opcionais; prazo vazio não vira campo', () => {
  const novo = criarCard({ titulo: 'Sem prazo', prioridade: 'baixa', prazo: '' }, [], HOJE);
  assert.equal(novo.descricao, '');
  assert.equal('prazo' in novo, false);
});

test('validação reúne todos os erros', () => {
  const e = erros(() => criarCard({ titulo: '  ', descricao: 'x'.repeat(501), prioridade: 'urgente', prazo: '2026-02-31', status: 'feito' }, [], HOJE));
  assert.deepEqual(Object.keys(e).sort(), ['descricao', 'prazo', 'prioridade', 'status', 'titulo']);
  assert.match(erros(() => criarCard({ titulo: 'x'.repeat(121), prioridade: 'alta' }, [], HOJE)).titulo, /120/);
  assert.equal(erros(() => criarCard({ titulo: 'Ok', prioridade: '' }, [], HOJE)).prioridade, 'Escolha a prioridade.');
});

test('editar card: troca de status entra no histórico e esvaziar o prazo o remove', () => {
  const original = cards.find((c) => c.id === 'K-0004');
  const editado = editarCard(original, { titulo: original.titulo, descricao: 'Nova descrição', prioridade: 'media', prazo: '', status: 'revisao' }, HOJE);
  assert.equal(editado.descricao, 'Nova descrição');
  assert.equal('prazo' in editado, false);
  assert.deepEqual(editado.historico.slice(-2).map((h) => h.evento), ['Editado', 'Status: Em andamento → Em revisão']);
  assert.equal(original.prazo, '2026-10-13'); // o original não muda
  assert.equal(editado.criado_em, original.criado_em);
});

test('mover card grava o evento; mover para o mesmo status não faz nada; status inválido é recusado', () => {
  const card = cards[0];
  const movido = moverCard(card, 'andamento', HOJE);
  assert.equal(movido.status, 'andamento');
  assert.equal(movido.historico.at(-1).evento, 'Status: Backlog → Em andamento');
  assert.equal(card.status, 'backlog');
  assert.equal(moverCard(card, 'backlog', HOJE), card);
  assert.ok(erros(() => moverCard(card, 'feito', HOJE)).status);
});

test('excluir e desfazer devolvem o card à mesma posição; número reaproveitado é recusado', () => {
  const sem = removerCard(cards, 'K-0003');
  assert.equal(sem.length, 7);
  assert.deepEqual(ids(restaurarCard(sem, cards[2], 2)), ids(cards));
  assert.equal(cards.length, 8);
  const reaproveitado = [...sem, { ...cards[2] }];
  assert.ok(erros(() => restaurarCard(reaproveitado, cards[2], 2)).id);
});

test('atrasado: prazo anterior a hoje e não concluído', () => {
  assert.deepEqual(ids(cards.filter((c) => estaAtrasado(c, HOJE))), ['K-0004']);
  const concluidoVencido = cards.find((c) => c.id === 'K-0008'); // prazo 10/10, concluído
  assert.equal(estaAtrasado(concluidoVencido, HOJE), false);
  assert.deepEqual(descreverPrazo(cards.find((c) => c.id === 'K-0004'), HOJE), { texto: '13/10/2026 · atrasado há 2 dias', atrasado: true });
  assert.deepEqual(descreverPrazo(cards.find((c) => c.id === 'K-0006'), HOJE), { texto: '16/10/2026 · em 1 dia', atrasado: false });
  assert.deepEqual(descreverPrazo(cards[1], HOJE), { texto: 'Sem prazo', atrasado: false });
  assert.deepEqual(descreverPrazo(concluidoVencido, HOJE), { texto: 'Prazo: 10/10/2026', atrasado: false });
  assert.equal(descreverPrazo({ prazo: HOJE, status: 'backlog' }, HOJE).texto, '15/10/2026 · vence hoje');
});

test('filtros: prioridade, status, prazo e busca (sem acento nem caixa)', () => {
  const por = (filtros) => ids(listarCards(cards, filtros, HOJE)).sort();
  assert.deepEqual(por({ prioridade: 'alta' }), ['K-0003', 'K-0004']);
  assert.deepEqual(por({ status: 'revisao' }), ['K-0006', 'K-0007']);
  assert.deepEqual(por({ prazo: 'atrasados' }), ['K-0004']);
  assert.deepEqual(por({ prazo: 'proximos7' }), ['K-0003', 'K-0005', 'K-0006']);
  assert.deepEqual(por({ prazo: 'sem_prazo' }), ['K-0002']);
  assert.deepEqual(por({ busca: 'PROTOTIPO' }), ['K-0003', 'K-0005']); // título ou descrição
  assert.deepEqual(por({ busca: 'k-0007' }), ['K-0007']);
  assert.deepEqual(por({ busca: 'revisar textos', status: 'revisao', prioridade: 'media' }), ['K-0006']);
  assert.deepEqual(por({ busca: 'inexistente' }), []);
  assert.equal(por({}).length, 8);
});

test('ordem: prioridade, depois prazo (sem prazo por último), depois criação', () => {
  assert.deepEqual(ids(listarCards(cards, {}, HOJE)), ['K-0004', 'K-0003', 'K-0008', 'K-0006', 'K-0005', 'K-0001', 'K-0007', 'K-0002']);
});

test('agrupar mantém a ordem e devolve as 4 colunas, mesmo vazias', () => {
  const grupos = agruparPorStatus(listarCards(cards, {}, HOJE));
  assert.deepEqual(ids(grupos.backlog), ['K-0003', 'K-0001', 'K-0002']);
  assert.deepEqual(Object.keys(agruparPorStatus([])), ['backlog', 'andamento', 'revisao', 'concluido']);
});

test('filtrosKanbanEmUso ignora busca só com espaços', () => {
  assert.equal(filtrosKanbanEmUso(FILTROS_KANBAN_PADRAO), false);
  assert.equal(filtrosKanbanEmUso({ busca: '   ' }), false);
  assert.equal(filtrosKanbanEmUso({ prazo: 'atrasados' }), true);
});

test('os módulos não alteram os argumentos', () => {
  const antes = JSON.stringify(cards);
  listarCards(cards, { busca: 'a', prazo: 'proximos7' }, HOJE);
  agruparPorStatus(cards);
  moverCard(cards[0], 'revisao', HOJE);
  editarCard(cards[0], { titulo: 'x', prioridade: 'alta', status: 'backlog' }, HOJE);
  removerCard(cards, 'K-0001');
  assert.equal(JSON.stringify(cards), antes);
});

// ---------- Persistência ----------

function armazenamentoFalso(inicial = {}) {
  const dados = { ...inicial };
  return { dados, getItem: (k) => (k in dados ? dados[k] : null), setItem: (k, v) => { dados[k] = v; } };
}

test('persistência: primeira abertura usa o exemplo; salvar e carregar devolvem os mesmos dados', () => {
  const storage = armazenamentoFalso();
  const primeira = carregarKanban(storage, exemplo);
  assert.equal(primeira.origem, 'exemplo');
  assert.equal(primeira.dados.cards.length, 8);
  primeira.dados.cards = [...primeira.dados.cards, criarCard({ titulo: 'Novo', prioridade: 'alta' }, primeira.dados.cards, HOJE)];
  assert.equal(salvarKanban(storage, primeira.dados), true);
  assert.ok(CHAVE_KANBAN in storage.dados);
  const segunda = carregarKanban(storage, exemplo);
  assert.equal(segunda.origem, 'armazenamento');
  assert.deepEqual(segunda.dados, primeira.dados);
  assert.equal(exemplo.cards.length, 8); // o exemplo não é alterado
});

test('persistência: chave própria, separada do painel de demandas', () => {
  assert.equal(CHAVE_KANBAN, 'kanban-dt:v1');
  const storage = armazenamentoFalso({ 'painel-demandas:v1': '{"versao":1,"demandas":[],"afastamentos":[]}' });
  assert.equal(carregarKanban(storage, exemplo).origem, 'exemplo');
});

test('persistência: JSON corrompido, formato errado, card inválido ou id repetido voltam ao exemplo', () => {
  const casos = [
    '{nao e json',
    JSON.stringify({ versao: 2, cards: [] }),
    JSON.stringify({ versao: 1, cards: 'x' }),
    JSON.stringify({ versao: 1, cards: [{ id: 'K-0001', titulo: 'x', status: 'feito', prioridade: 'alta' }] }),
    JSON.stringify({ versao: 1, cards: [exemplo.cards[0], exemplo.cards[0]] }),
  ];
  for (const bruto of casos) {
    const r = carregarKanban(armazenamentoFalso({ [CHAVE_KANBAN]: bruto }), exemplo);
    assert.equal(r.origem, 'exemplo', bruto);
    assert.equal(r.dados.cards.length, 8);
  }
});

test('persistência: storage indisponível ou cheio não quebra', () => {
  assert.equal(carregarKanban(null, exemplo).origem, 'exemplo');
  const quebrado = { getItem: () => { throw new Error('bloqueado'); }, setItem: () => { throw new Error('cheio'); } };
  assert.equal(carregarKanban(quebrado, exemplo).origem, 'exemplo');
  assert.equal(salvarKanban(quebrado, { cards: [] }), false);
});

test('persistência: só os cards são gravados, e uma cópia antiga com "notas" (da aba retirada) carrega sem elas', () => {
  const storage = armazenamentoFalso();
  assert.equal(salvarKanban(storage, { cards: exemplo.cards, notas: [{ id: 'N-0001', etapa: 'idear', texto: 'x' }] }), true);
  assert.deepEqual(Object.keys(JSON.parse(storage.dados[CHAVE_KANBAN])).sort(), ['cards', 'versao']);

  const antiga = armazenamentoFalso({
    [CHAVE_KANBAN]: JSON.stringify({ versao: 1, cards: exemplo.cards.slice(0, 2), notas: [{ id: 'N-0001', etapa: 'sonhar', texto: 'qualquer coisa' }] }),
  });
  const r = carregarKanban(antiga, exemplo);
  assert.equal(r.origem, 'armazenamento'); // os cards salvos continuam valendo, mesmo com notas de formato qualquer
  assert.deepEqual(r.dados, { versao: 1, cards: exemplo.cards.slice(0, 2) });
  assert.equal('notas' in r.dados, false);
});

test('o exemplo não tem mais notas de Design Thinking: Design Thinking é método, não tela', () => {
  assert.deepEqual(Object.keys(exemplo).sort(), ['_aviso', 'cards', 'hoje_referencia']);
});
