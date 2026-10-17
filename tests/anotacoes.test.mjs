import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ANOTACOES_MAX, ErroAnotacao, TEXTO_MAX, adicionarAnotacoes, alternarAnotacao, anotacoesEmTexto, contarAnotacoes, desfazerRemocao, editarAnotacao,
  eventosDeConclusao, normalizarAnotacoes, ordenarAnotacoes, removerAnotacao,
} from '../js/anotacoes.js';

const HOJE = '2026-10-15';

test('adicionar cria o item com id, datas e feita falso, sem alterar a lista original', () => {
  const lista = [];
  const nova = adicionarAnotacoes(lista, '  Ligar para a equipe ', HOJE);
  assert.deepEqual(lista, []);
  assert.deepEqual(nova, [{ id: 'A-1', texto: 'Ligar para a equipe', feita: false, criada_em: HOJE, concluida_em: null }]);
});

test('colar várias linhas cria um item por linha e ignora linhas vazias (CRLF, LF e CR)', () => {
  const nova = adicionarAnotacoes([], 'um\r\ndois\n\n  \ntrês\rquatro', HOJE);
  assert.deepEqual(nova.map((a) => a.texto), ['um', 'dois', 'três', 'quatro']);
  assert.deepEqual(nova.map((a) => a.id), ['A-1', 'A-2', 'A-3', 'A-4']);
  assert.equal(adicionarAnotacoes(nova, '   ', HOJE), nova); // vazio não muda nada
});

test('ids seguem a partir do maior existente, mesmo depois de remover', () => {
  let lista = adicionarAnotacoes([], 'a\nb\nc', HOJE);
  lista = removerAnotacao(lista, 'A-3').lista;
  assert.equal(adicionarAnotacoes(lista, 'd', HOJE).at(-1).id, 'A-3');
  lista = removerAnotacao(lista, 'A-1').lista;
  assert.equal(adicionarAnotacoes(lista, 'e', HOJE).at(-1).id, 'A-3');
});

test(`limites: ${TEXTO_MAX} caracteres por anotação e ${ANOTACOES_MAX} por demanda`, () => {
  assert.equal(adicionarAnotacoes([], 'x'.repeat(TEXTO_MAX), HOJE).length, 1);
  assert.throws(() => adicionarAnotacoes([], 'x'.repeat(TEXTO_MAX + 1), HOJE), ErroAnotacao);
  assert.throws(() => adicionarAnotacoes([], 'ok\n' + 'x'.repeat(TEXTO_MAX + 1), HOJE), ErroAnotacao); // uma linha longa recusa tudo
  const cheia = adicionarAnotacoes([], Array.from({ length: ANOTACOES_MAX }, (_, i) => `item ${i}`).join('\n'), HOJE);
  assert.throws(() => adicionarAnotacoes(cheia, 'mais um', HOJE), ErroAnotacao);
});

test('marcar e desmarcar registram e limpam a data de conclusão', () => {
  const lista = adicionarAnotacoes([], 'a\nb', HOJE);
  const feita = alternarAnotacao(lista, 'A-1', '2026-10-16');
  assert.deepEqual([feita[0].feita, feita[0].concluida_em, feita[1].feita], [true, '2026-10-16', false]);
  assert.equal(lista[0].feita, false); // original intacto
  const desfeita = alternarAnotacao(feita, 'A-1', '2026-10-17');
  assert.deepEqual([desfeita[0].feita, desfeita[0].concluida_em], [false, null]);
});

test('concluídas vão para o fim; contador n/m', () => {
  let lista = adicionarAnotacoes([], 'a\nb\nc', HOJE);
  lista = alternarAnotacao(lista, 'A-1', HOJE);
  assert.deepEqual(ordenarAnotacoes(lista).map((a) => a.id), ['A-2', 'A-3', 'A-1']);
  assert.deepEqual(contarAnotacoes(lista), { feitas: 1, total: 3 });
});

test('editar troca o texto, recusa vazio e texto longo', () => {
  const lista = adicionarAnotacoes([], 'a', HOJE);
  assert.equal(editarAnotacao(lista, 'A-1', '  novo   texto ')[0].texto, 'novo texto');
  assert.throws(() => editarAnotacao(lista, 'A-1', '  '), ErroAnotacao);
  assert.throws(() => editarAnotacao(lista, 'A-1', 'x'.repeat(TEXTO_MAX + 1)), ErroAnotacao);
});

test('remover e desfazer devolvem o item à mesma posição', () => {
  const lista = adicionarAnotacoes([], 'a\nb\nc', HOJE);
  const r = removerAnotacao(lista, 'A-2');
  assert.deepEqual(r.lista.map((a) => a.id), ['A-1', 'A-3']);
  assert.equal(r.indice, 1);
  const volta = desfazerRemocao(r.lista, r.removida, r.indice);
  assert.deepEqual(volta, lista);
  assert.equal(desfazerRemocao(volta, r.removida, r.indice), volta); // desfazer duas vezes não duplica
  assert.equal(removerAnotacao(lista, 'A-9').removida, null);
});

test('texto no CSV: "[x] texto | [ ] texto"', () => {
  let lista = adicionarAnotacoes([], 'primeira\nsegunda', HOJE);
  lista = alternarAnotacao(lista, 'A-1', HOJE);
  assert.equal(anotacoesEmTexto(lista), '[x] primeira | [ ] segunda');
  assert.equal(anotacoesEmTexto(undefined), '');
});

test('normalizar descarta itens malformados, corta o texto e garante ids únicos', () => {
  const sujo = [
    { id: 'A-1', texto: ' ok ', feita: true, criada_em: '2026-10-01', concluida_em: '2026-10-02' },
    { id: 'A-1', texto: 'id repetido', feita: 'sim' },
    { texto: '' },
    null,
    { texto: 'x'.repeat(TEXTO_MAX + 50) },
  ];
  const n = normalizarAnotacoes(sujo, HOJE);
  assert.equal(n.length, 3);
  assert.deepEqual(n.map((a) => a.id), ['A-1', 'A-2', 'A-3']);
  assert.equal(n[1].feita, false);
  assert.equal(n[2].texto.length, TEXTO_MAX);
  assert.deepEqual(normalizarAnotacoes(undefined), []);
  assert.deepEqual(normalizarAnotacoes('texto'), []);
});

test('eventos de conclusão só para o que passou a feita', () => {
  const antes = alternarAnotacao(adicionarAnotacoes([], 'a\nb', HOJE), 'A-1', HOJE);
  const depois = alternarAnotacao(antes, 'A-2', HOJE);
  assert.deepEqual(eventosDeConclusao(antes, depois), ['Anotação concluída: b']);
  assert.deepEqual(eventosDeConclusao(undefined, antes), ['Anotação concluída: a']);
});

test('texto com HTML é só texto nos dados (a interface o exibe por textContent)', () => {
  const nova = adicionarAnotacoes([], '<img src=x onerror=alert(1)>', HOJE);
  assert.equal(nova[0].texto, '<img src=x onerror=alert(1)>');
});
