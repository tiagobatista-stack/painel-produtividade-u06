// Aba Design Thinking: notas por etapa e promoção de uma ideia (etapa Idear) a card do Backlog.
import { ErroKanban } from './kanban.js';
import { ETAPAS, ETAPA_PROMOVIVEL, agruparPorEtapa, criarNota, editarNota, promoverNota, removerNota } from './design-thinking.js';
import { $, criarGestorErros, elemento, hojeAtual, mostrarAviso, mostrarMensagem, opcoes } from './ui-comum.js';
import { estadoK, persistirK } from './kanban-estado.js';

const form = $('form-nota');
const gestor = criarGestorErros({ resumo: $('resumo-erros-nota'), campos: ['etapa', 'texto'], idCampo: (c) => `n-${c}`, idErro: (c) => `en-${c}` });
let irParaCard = () => {};
let emEdicao = null; // nota em edição, ou null

function sairDaEdicao() {
  emEdicao = null;
  form.reset();
  gestor.limpar();
  $('n-salvar').textContent = 'Adicionar nota';
  $('n-cancelar').hidden = true;
}

function botao(rotulo, rotuloAria, aoClicar, classe = '') {
  const b = elemento('button', classe, rotulo);
  b.type = 'button';
  b.setAttribute('aria-label', rotuloAria);
  b.addEventListener('click', aoClicar);
  return b;
}

function promover(nota) {
  try {
    const { card, nota: ligada } = promoverNota(nota, estadoK.dados.cards, hojeAtual());
    estadoK.dados.cards.push(card);
    estadoK.dados.notas = estadoK.dados.notas.map((n) => (n.id === nota.id ? ligada : n));
    persistirK();
    mostrarAviso('');
    mostrarMensagem(`Ideia promovida: card ${card.id} criado no Backlog.`);
    estadoK.atualizar();
    irParaCard(card.id);
  } catch (e) {
    if (!(e instanceof ErroKanban)) throw e;
    mostrarAviso(Object.values(e.erros)[0]);
  }
}

function excluir(nota) {
  const indice = estadoK.dados.notas.findIndex((n) => n.id === nota.id);
  if (emEdicao?.id === nota.id) sairDaEdicao();
  estadoK.dados.notas = removerNota(estadoK.dados.notas, nota.id);
  persistirK();
  mostrarMensagem('Nota excluída.', {
    acao: {
      rotulo: 'Desfazer',
      fazer: () => {
        const notas = estadoK.dados.notas;
        if (notas.some((n) => n.id === nota.id)) return;
        estadoK.dados.notas = [...notas.slice(0, Math.min(indice, notas.length)), nota, ...notas.slice(Math.min(indice, notas.length))];
        persistirK();
        mostrarMensagem('Nota restaurada.');
        estadoK.atualizar();
      },
    },
  });
  estadoK.focoApos = 'desfazer';
  estadoK.atualizar();
}

function editar(nota) {
  emEdicao = nota;
  $('n-etapa').value = nota.etapa;
  $('n-texto').value = nota.texto;
  $('n-salvar').textContent = 'Salvar nota';
  $('n-cancelar').hidden = false;
  $('n-texto').focus();
}

function itemDaNota(nota) {
  const li = elemento('li', 'nota-dt');
  li.dataset.id = nota.id;
  li.append(elemento('p', 'nota-dt-texto', nota.texto));
  const acoes = elemento('div', 'nota-dt-acoes');
  if (nota.etapa === ETAPA_PROMOVIVEL) {
    const cardLigado = nota.card_id && estadoK.dados.cards.some((c) => c.id === nota.card_id);
    acoes.append(
      cardLigado
        ? botao(`Ver card ${nota.card_id}`, `Ver card ${nota.card_id}: ${nota.texto}`, () => irParaCard(nota.card_id))
        : botao('Promover para o Backlog', `Promover para o Backlog: ${nota.texto}`, () => promover(nota), 'primario')
    );
  }
  acoes.append(botao('Editar', `Editar a nota: ${nota.texto}`, () => editar(nota)), botao('Excluir', `Excluir a nota: ${nota.texto}`, () => excluir(nota), 'perigo'));
  li.append(acoes);
  return li;
}

export function desenharDT() {
  const grupos = agruparPorEtapa(estadoK.dados.notas);
  $('dt-grade').replaceChildren(
    ...Object.entries(ETAPAS).map(([etapa, rotulo]) => {
      const secao = elemento('section', 'kcol dtcol');
      secao.dataset.etapa = etapa;
      secao.setAttribute('aria-label', rotulo);
      const titulo = elemento('h3', 'kcol-titulo');
      titulo.append(rotulo, elemento('span', 'kcol-contagem', String(grupos[etapa].length)));
      const lista = elemento('ul', 'kcol-lista');
      lista.setAttribute('aria-label', `Notas de ${rotulo}`);
      if (grupos[etapa].length === 0) lista.append(elemento('li', 'kcol-vazio', 'Nenhuma nota'));
      else lista.append(...grupos[etapa].map(itemDaNota));
      secao.append(titulo, lista);
      return secao;
    })
  );
}

function enviar(evento) {
  evento.preventDefault();
  const entrada = Object.fromEntries(new FormData(form));
  try {
    if (emEdicao) {
      const i = estadoK.dados.notas.findIndex((n) => n.id === emEdicao.id);
      estadoK.dados.notas[i] = editarNota(emEdicao, entrada);
    } else {
      estadoK.dados.notas.push(criarNota(entrada, estadoK.dados.notas));
    }
  } catch (e) {
    if (!(e instanceof ErroKanban)) throw e;
    gestor.mostrar(e.erros);
    return;
  }
  const etapa = entrada.etapa;
  const eraEdicao = Boolean(emEdicao);
  persistirK();
  sairDaEdicao();
  $('n-etapa').value = etapa; // quem anota em sequência costuma ficar na mesma etapa
  mostrarMensagem(eraEdicao ? 'Nota salva.' : 'Nota adicionada.');
  estadoK.atualizar();
  $('n-texto').focus();
}

// `funcoes.irParaCard(id)` abre o Quadro no card.
export function iniciarDT(funcoes) {
  irParaCard = funcoes.irParaCard;
  opcoes($('n-etapa'), Object.entries(ETAPAS), 'empatizar');
  form.addEventListener('submit', enviar);
  $('n-cancelar').addEventListener('click', () => {
    sairDaEdicao();
    $('n-texto').focus();
  });
}
