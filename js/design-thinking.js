// Design Thinking: notas por etapa (Empatizar, Definir, Idear, Prototipar, Testar) e promoção de uma ideia a card do Backlog.
// Funções puras (sem DOM nem armazenamento).
import { ErroKanban, TITULO_MAX, criarCard } from './kanban.js';

export const ETAPAS = { empatizar: 'Empatizar', definir: 'Definir', idear: 'Idear', prototipar: 'Prototipar', testar: 'Testar' };
export const ETAPA_PROMOVIVEL = 'idear';
export const NOTA_MAX = 300;

const texto = (v) => (typeof v === 'string' ? v.trim() : '');

function normalizarNota(dados) {
  const erros = {};
  const limpo = { etapa: dados.etapa, texto: texto(dados.texto) };
  if (!(limpo.etapa in ETAPAS)) erros.etapa = 'Escolha a etapa.';
  if (!limpo.texto) erros.texto = 'Escreva a nota.';
  else if (limpo.texto.length > NOTA_MAX) erros.texto = `Use no máximo ${NOTA_MAX} caracteres.`;
  if (Object.keys(erros).length) throw new ErroKanban(erros);
  return limpo;
}

export function proximoIdNota(notas) {
  const maior = notas.reduce((max, n) => {
    const m = /^N-(\d+)$/.exec(n.id || '');
    return m ? Math.max(max, Number(m[1])) : max;
  }, 0);
  return `N-${String(maior + 1).padStart(4, '0')}`;
}

export function criarNota(dados, existentes) {
  return { id: proximoIdNota(existentes), ...normalizarNota(dados) };
}

// A ligação com o card (card_id) é mantida na edição, mas só vale para notas da etapa Idear.
export function editarNota(original, dados) {
  const editada = { ...original, ...normalizarNota(dados) };
  if (editada.etapa !== ETAPA_PROMOVIVEL) delete editada.card_id;
  return editada;
}

export function removerNota(notas, id) {
  return notas.filter((n) => n.id !== id);
}

export function agruparPorEtapa(notas) {
  const grupos = Object.fromEntries(Object.keys(ETAPAS).map((e) => [e, []]));
  for (const n of notas) grupos[n.etapa]?.push(n);
  return grupos;
}

// Título do card: a nota inteira se couber, senão cortada com reticências.
function tituloDaNota(textoNota) {
  return textoNota.length <= TITULO_MAX ? textoNota : `${textoNota.slice(0, TITULO_MAX - 1).trimEnd()}…`;
}

// Promove uma ideia a card do Backlog (prioridade média; a descrição é a nota inteira) e liga a nota ao card.
// Só notas da etapa Idear, e só uma vez enquanto o card existir. Devolve { card, nota }; não altera os argumentos.
export function promoverNota(nota, cards, hoje) {
  if (nota.etapa !== ETAPA_PROMOVIVEL) throw new ErroKanban({ etapa: 'Só uma ideia (etapa Idear) vai para o Backlog.' });
  if (nota.card_id && cards.some((c) => c.id === nota.card_id)) {
    throw new ErroKanban({ card_id: `Esta ideia já virou o card ${nota.card_id}.` });
  }
  const card = criarCard({ titulo: tituloDaNota(nota.texto), descricao: nota.texto, prioridade: 'media', status: 'backlog' }, cards, hoje);
  return { card, nota: { ...nota, card_id: card.id } };
}
