import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ETAPAS, NOTA_MAX, agruparPorEtapa, criarNota, editarNota, promoverNota, proximoIdNota, removerNota } from '../js/design-thinking.js';
import { ErroKanban } from '../js/kanban.js';

const exemplo = JSON.parse(readFileSync(new URL('../data/kanban-exemplo.json', import.meta.url), 'utf8'));
const HOJE = '2026-10-15';
const { cards, notas } = exemplo;
const erros = (fn) => {
  try {
    fn();
  } catch (e) {
    assert.ok(e instanceof ErroKanban);
    return e.erros;
  }
  assert.fail('deveria lançar ErroKanban');
};

test('as 5 etapas do Design Thinking', () => {
  assert.deepEqual(Object.values(ETAPAS), ['Empatizar', 'Definir', 'Idear', 'Prototipar', 'Testar']);
});

test('o exemplo distribui as notas por etapa; Testar começa vazia', () => {
  const grupos = agruparPorEtapa(notas);
  assert.deepEqual(Object.entries(grupos).map(([e, g]) => `${e}:${g.length}`), ['empatizar:2', 'definir:1', 'idear:2', 'prototipar:1', 'testar:0']);
  assert.deepEqual(Object.keys(agruparPorEtapa([])), Object.keys(ETAPAS));
});

test('criar nota: id sequencial e texto aparado', () => {
  const nova = criarNota({ etapa: 'testar', texto: '  Testar com duas pessoas  ' }, notas);
  assert.deepEqual(nova, { id: 'N-0007', etapa: 'testar', texto: 'Testar com duas pessoas' });
  assert.equal(proximoIdNota([]), 'N-0001');
});

test('validação da nota: etapa, texto vazio e texto longo', () => {
  assert.equal(erros(() => criarNota({ etapa: 'sonhar', texto: 'ok' }, [])).etapa, 'Escolha a etapa.');
  assert.equal(erros(() => criarNota({ etapa: 'idear', texto: '   ' }, [])).texto, 'Escreva a nota.');
  assert.match(erros(() => criarNota({ etapa: 'idear', texto: 'x'.repeat(NOTA_MAX + 1) }, [])).texto, /300/);
});

test('editar nota troca etapa e texto e mantém o id; sair de Idear solta o vínculo com o card', () => {
  const ligada = { id: 'N-0004', etapa: 'idear', texto: 'Ideia', card_id: 'K-0009' };
  assert.deepEqual(editarNota(ligada, { etapa: 'idear', texto: 'Ideia melhor' }), { id: 'N-0004', etapa: 'idear', texto: 'Ideia melhor', card_id: 'K-0009' });
  assert.equal('card_id' in editarNota(ligada, { etapa: 'testar', texto: 'Ideia' }), false);
  assert.equal(removerNota(notas, 'N-0001').length, 5);
});

test('promover ideia cria card no Backlog com prioridade média e liga a nota', () => {
  const ideia = notas.find((n) => n.id === 'N-0004');
  const { card, nota } = promoverNota(ideia, cards, HOJE);
  assert.equal(card.id, 'K-0009');
  assert.equal(card.status, 'backlog');
  assert.equal(card.prioridade, 'media');
  assert.equal(card.titulo, ideia.texto);
  assert.equal(card.descricao, ideia.texto);
  assert.equal(card.criado_em, HOJE);
  assert.equal(nota.card_id, 'K-0009');
  assert.equal('card_id' in ideia, false); // a nota original não muda
  assert.equal(cards.length, 8); // a lista original não muda
});

test('promover: só a etapa Idear, e só uma vez enquanto o card existir', () => {
  assert.ok(erros(() => promoverNota(notas.find((n) => n.etapa === 'definir'), cards, HOJE)).etapa);
  const { card, nota } = promoverNota(notas.find((n) => n.id === 'N-0004'), cards, HOJE);
  assert.match(erros(() => promoverNota(nota, [...cards, card], HOJE)).card_id, /K-0009/);
  // se o card foi excluído, a ideia pode ser promovida de novo
  assert.equal(promoverNota(nota, cards, HOJE).card.id, 'K-0009');
});

test('promover uma ideia longa corta o título em 120 caracteres e guarda o texto inteiro na descrição', () => {
  const longa = { id: 'N-0010', etapa: 'idear', texto: `${'ideia '.repeat(48)}fim` };
  const { card } = promoverNota(longa, cards, HOJE);
  assert.ok(card.titulo.length <= 120);
  assert.ok(card.titulo.endsWith('…'));
  assert.equal(card.descricao, longa.texto);
});
