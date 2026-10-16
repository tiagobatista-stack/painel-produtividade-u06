// Aba Quadro: 4 colunas, filtros, mover (arrastar ou botões), criar, editar, excluir com Desfazer.
import {
  ErroKanban, FILTRO_PRAZO_KANBAN, FILTROS_KANBAN_PADRAO, PRIORIDADES, STATUS_KANBAN, agruparPorStatus, criarCard, descreverPrazo, editarCard,
  filtrosKanbanEmUso, listarCards, moverCard, removerCard, restaurarCard,
} from './kanban.js';
import { $, criarGestorErros, elemento, formatarData, hojeAtual, mostrarAviso, mostrarMensagem, opcoes } from './ui-comum.js';
import { estadoK, persistirK } from './kanban-estado.js';

const STATUS_ORDEM = Object.keys(STATUS_KANBAN);
const CAMPOS = ['titulo', 'descricao', 'prioridade', 'prazo', 'status'];

const dialogo = $('dialogo-card');
const formulario = $('form-card');
const gestor = criarGestorErros({ resumo: $('resumo-erros'), campos: CAMPOS, idCampo: (c) => `f-${c}`, idErro: (c) => `e-${c}` });

let editando = null; // card em edição, ou null quando é novo
let gatilho = null; // elemento que abriu o diálogo, para devolver o foco
let salvou = false; // distingue salvar/excluir de cancelar ao fechar o diálogo
let idArrastando = null;

function filtrosAtuais() {
  return { busca: $('k-busca').value, prioridade: $('k-prioridade').value, prazo: $('k-prazo').value, status: $('k-status').value };
}

function aplicarFiltros(f) {
  $('k-busca').value = f.busca;
  $('k-prioridade').value = f.prioridade;
  $('k-prazo').value = f.prazo;
  $('k-status').value = f.status;
}

export function limparFiltros() {
  aplicarFiltros(FILTROS_KANBAN_PADRAO);
}

// ---------- Cards ----------

function anunciar(mensagem) {
  $('quadro-anuncio').textContent = mensagem;
}

function mover(id, status) {
  const i = estadoK.dados.cards.findIndex((c) => c.id === id);
  if (i < 0) return;
  try {
    estadoK.dados.cards[i] = moverCard(estadoK.dados.cards[i], status, hojeAtual());
  } catch (e) {
    if (!(e instanceof ErroKanban)) throw e;
    mostrarAviso(Object.values(e.erros)[0]);
    return;
  }
  persistirK();
  estadoK.focoApos = `abrir-${id}`;
  estadoK.atualizar();
  anunciar(`${id} movido para ${STATUS_KANBAN[status]}.`);
}

function botaoMover(card, status, rotulo) {
  const botao = elemento('button', 'kmover', rotulo);
  botao.type = 'button';
  botao.setAttribute('aria-label', `Mover "${card.titulo}" para ${STATUS_KANBAN[status]}`);
  botao.addEventListener('click', () => mover(card.id, status));
  return botao;
}

function cartao(card, hoje) {
  const prazo = descreverPrazo(card, hoje);
  const li = elemento('li', `kcard prio-${card.prioridade}${prazo.atrasado ? ' atrasado' : ''}${card.status === 'concluido' ? ' concluido' : ''}`);
  li.tabIndex = -1;
  li.dataset.foco = `card-${card.id}`;
  li.dataset.id = card.id;
  li.draggable = true;

  const abrir = elemento('button', 'kcard-abrir');
  abrir.type = 'button';
  abrir.draggable = true; // o botão ocupa quase todo o card e, sem isto, o navegador não inicia o arrasto a partir dele
  abrir.dataset.foco = `abrir-${card.id}`;
  abrir.setAttribute('aria-haspopup', 'dialog');
  const topo = elemento('span', 'kcard-topo');
  topo.append(elemento('span', 'kcard-id', card.id), elemento('span', `selo selo-${card.prioridade}`, PRIORIDADES[card.prioridade]));
  abrir.append(topo, elemento('span', 'kcard-titulo', card.titulo));
  if (card.descricao) abrir.append(elemento('span', 'kcard-desc', card.descricao));
  abrir.append(elemento('span', 'kcard-prazo', prazo.texto));
  abrir.addEventListener('click', () => abrirFormulario(card, abrir));
  li.append(abrir);

  const i = STATUS_ORDEM.indexOf(card.status);
  const acoes = elemento('div', 'kcard-mover');
  if (i > 0) acoes.append(botaoMover(card, STATUS_ORDEM[i - 1], `◀ ${STATUS_KANBAN[STATUS_ORDEM[i - 1]]}`));
  if (i < STATUS_ORDEM.length - 1) acoes.append(botaoMover(card, STATUS_ORDEM[i + 1], `${STATUS_KANBAN[STATUS_ORDEM[i + 1]]} ▶`));
  li.append(acoes);

  li.addEventListener('dragstart', (e) => {
    idArrastando = card.id;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', card.id);
    li.classList.add('arrastando');
  });
  li.addEventListener('dragend', () => {
    idArrastando = null;
    li.classList.remove('arrastando');
    for (const c of document.querySelectorAll('.kcol-lista.alvo')) c.classList.remove('alvo');
  });
  return li;
}

function coluna(status, cards, hoje) {
  const secao = elemento('section', 'kcol');
  secao.dataset.coluna = status;
  secao.setAttribute('aria-label', STATUS_KANBAN[status]);
  const titulo = elemento('h3', 'kcol-titulo');
  titulo.append(STATUS_KANBAN[status], elemento('span', 'kcol-contagem', String(cards.length)));
  const lista = elemento('ul', 'kcol-lista');
  lista.dataset.coluna = status;
  lista.setAttribute('aria-label', `Cards em ${STATUS_KANBAN[status]}`);
  if (cards.length === 0) lista.append(elemento('li', 'kcol-vazio', 'Nenhum card'));
  else lista.append(...cards.map((c) => cartao(c, hoje)));

  const arrastado = () => estadoK.dados.cards.find((c) => c.id === idArrastando) ?? null;
  lista.addEventListener('dragover', (e) => {
    const c = arrastado();
    if (!c || c.status === status) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    lista.classList.add('alvo');
  });
  lista.addEventListener('dragleave', () => lista.classList.remove('alvo'));
  lista.addEventListener('drop', (e) => {
    e.preventDefault();
    lista.classList.remove('alvo');
    const c = arrastado();
    idArrastando = null;
    if (c && c.status !== status) mover(c.id, status);
  });
  secao.append(titulo, lista);
  return secao;
}

export function desenharQuadro(hoje) {
  const filtros = filtrosAtuais();
  const lista = listarCards(estadoK.dados.cards, filtros, hoje);
  const total = estadoK.dados.cards.length;
  const grupos = agruparPorStatus(lista);
  $('k-limpar').disabled = !filtrosKanbanEmUso(filtros);
  $('contagem').textContent = filtrosKanbanEmUso(filtros) ? `${lista.length} de ${total} cards` : `${total} ${total === 1 ? 'card' : 'cards'}`;
  $('quadro-vazio').hidden = lista.length > 0;
  $('kanban-grade').replaceChildren(...STATUS_ORDEM.map((s) => coluna(s, grupos[s], hoje)));
}

// Leva ao card: limpa os filtros se eles o escondem, destaca, rola até ele e põe o foco nele.
export function mostrarCard(id) {
  const card = estadoK.dados.cards.find((c) => c.id === id);
  if (!card) return;
  if (!listarCards([card], filtrosAtuais(), hojeAtual()).length) limparFiltros();
  estadoK.focoApos = `card-${id}`;
  estadoK.atualizar();
  const alvo = document.querySelector(`[data-foco="card-${id}"]`);
  if (!alvo) return;
  alvo.scrollIntoView({ block: 'center' });
  alvo.classList.add('destaque');
  setTimeout(() => alvo.classList.remove('destaque'), 2500);
}

// ---------- Formulário ----------

function abrirFormulario(card, origemDoClique) {
  editando = card;
  gatilho = origemDoClique;
  formulario.reset();
  gestor.limpar();
  $('card-titulo-dialogo').textContent = card ? `Editar ${card.id}` : 'Novo card';
  opcoes($('f-prioridade'), Object.entries(PRIORIDADES), card ? card.prioridade : 'media');
  opcoes($('f-status'), Object.entries(STATUS_KANBAN), card ? card.status : 'backlog');
  if (card) {
    $('f-titulo').value = card.titulo;
    $('f-descricao').value = card.descricao ?? '';
    $('f-prazo').value = card.prazo ?? '';
  }
  $('excluir-card').hidden = !card;
  const historico = $('card-historico');
  historico.hidden = !card?.historico?.length;
  historico.querySelector('ul').replaceChildren(...(card?.historico ?? []).map((h) => elemento('li', '', `${formatarData(h.data)} — ${h.evento}`)));
  historico.querySelector('summary').textContent = `Histórico (${card?.historico?.length ?? 0})`;
  historico.open = false;
  dialogo.showModal();
  $('f-titulo').focus();
}

function enviarFormulario(evento) {
  evento.preventDefault();
  const entrada = Object.fromEntries(new FormData(formulario));
  const hoje = hojeAtual();
  let id;
  let mensagem = '';
  try {
    if (editando) {
      const i = estadoK.dados.cards.findIndex((c) => c.id === editando.id);
      estadoK.dados.cards[i] = editarCard(editando, entrada, hoje);
      id = editando.id;
    } else {
      const novo = criarCard(entrada, estadoK.dados.cards, hoje);
      estadoK.dados.cards.push(novo);
      id = novo.id;
      if (!listarCards([novo], filtrosAtuais(), hoje).length) {
        limparFiltros();
        mensagem = `Card ${id} criado. Os filtros foram limpos para mostrar o novo card.`;
      }
    }
  } catch (e) {
    if (!(e instanceof ErroKanban)) throw e;
    gestor.mostrar(e.erros);
    return;
  }
  persistirK();
  salvou = true;
  dialogo.close();
  if (mensagem) mostrarMensagem(mensagem);
  estadoK.focoApos = `abrir-${id}`;
  estadoK.atualizar();
}

// Exclui sem pedir confirmação: por cerca de 8 s a mensagem oferece "Desfazer" (o card volta à mesma posição).
function excluir() {
  if (!editando) return;
  const card = editando;
  const indice = estadoK.dados.cards.findIndex((c) => c.id === card.id);
  if (indice < 0) return;
  salvou = true; // o foco não volta ao card que deixou de existir
  dialogo.close();
  estadoK.dados.cards = removerCard(estadoK.dados.cards, card.id);
  persistirK();
  mostrarMensagem('Card excluído.', { acao: { rotulo: 'Desfazer', fazer: () => desfazerExclusao(card, indice) } });
  estadoK.focoApos = 'desfazer';
  estadoK.atualizar();
}

function desfazerExclusao(card, indice) {
  try {
    estadoK.dados.cards = restaurarCard(estadoK.dados.cards, card, indice);
  } catch (e) {
    if (!(e instanceof ErroKanban)) throw e;
    mostrarAviso(Object.values(e.erros)[0]);
    return;
  }
  mostrarAviso('');
  persistirK();
  mostrarMensagem('Card restaurado.');
  estadoK.focoApos = `abrir-${card.id}`;
  estadoK.atualizar();
}

export function iniciarQuadro() {
  opcoes($('k-prioridade'), [['', 'Todas'], ...Object.entries(PRIORIDADES)], '');
  opcoes($('k-prazo'), Object.entries(FILTRO_PRAZO_KANBAN), '');
  opcoes($('k-status'), [['', 'Todos'], ...Object.entries(STATUS_KANBAN)], '');
  for (const campo of ['k-busca', 'k-prioridade', 'k-prazo', 'k-status']) $(campo).addEventListener('input', () => estadoK.atualizar());
  $('filtros-kanban').addEventListener('submit', (e) => e.preventDefault());
  $('k-limpar').addEventListener('click', () => {
    limparFiltros();
    $('k-busca').focus(); // antes de desabilitar o botão, para o foco não se perder
    estadoK.atualizar();
  });
  $('novo-card').addEventListener('click', (e) => abrirFormulario(null, e.currentTarget));
  formulario.addEventListener('submit', enviarFormulario);
  $('cancelar-card').addEventListener('click', () => dialogo.close());
  $('excluir-card').addEventListener('click', excluir);
  dialogo.addEventListener('close', () => {
    if (!salvou && gatilho?.isConnected) gatilho.focus();
    salvou = false;
  });
}
