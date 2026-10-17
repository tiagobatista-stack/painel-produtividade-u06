// Kanban de projetos: cards com 4 status, prioridade escolhida pelo usuário, prazo e filtros. Funções puras (sem DOM nem armazenamento).
import { dataValida, diasEntre, somarDias } from './indicadores.js';
import { normalizarBusca } from './demandas.js';

export const STATUS_KANBAN = { backlog: 'Backlog', andamento: 'Em andamento', revisao: 'Em revisão', concluido: 'Concluído' };
export const PRIORIDADES = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };
export const FILTRO_PRAZO_KANBAN = { '': 'Todos', atrasados: 'Atrasados', proximos7: 'Próximos 7 dias', sem_prazo: 'Sem prazo' };

export const TITULO_MAX = 120;
export const DESCRICAO_MAX = 500;

// Estado padrão dos filtros: é o que "Limpar filtros" restaura.
export const FILTROS_KANBAN_PADRAO = Object.freeze({ busca: '', prioridade: '', prazo: '', status: '' });

export class ErroKanban extends Error {
  constructor(erros) {
    super('Dados inválidos');
    this.name = 'ErroKanban';
    this.erros = erros; // { campo: mensagem }
  }
}

const texto = (v) => (typeof v === 'string' ? v.trim() : '');
const ORDEM_PRIORIDADE = Object.fromEntries(Object.keys(PRIORIDADES).map((p, i) => [p, i]));

// Valida e normaliza os campos de um card. Lança ErroKanban com todos os erros encontrados.
function normalizar(dados) {
  const erros = {};
  const limpo = {};

  limpo.titulo = texto(dados.titulo);
  if (!limpo.titulo) erros.titulo = 'Informe o título.';
  else if (limpo.titulo.length > TITULO_MAX) erros.titulo = `Use no máximo ${TITULO_MAX} caracteres.`;

  limpo.descricao = texto(dados.descricao);
  if (limpo.descricao.length > DESCRICAO_MAX) erros.descricao = `Use no máximo ${DESCRICAO_MAX} caracteres.`;

  limpo.prioridade = dados.prioridade;
  if (!(limpo.prioridade in PRIORIDADES)) erros.prioridade = 'Escolha a prioridade.';

  limpo.status = dados.status ?? 'backlog';
  if (!(limpo.status in STATUS_KANBAN)) erros.status = 'Escolha um status.';

  const prazo = texto(dados.prazo);
  if (prazo) {
    if (dataValida(prazo)) limpo.prazo = prazo;
    else erros.prazo = 'Informe um prazo válido.';
  }

  if (Object.keys(erros).length) throw new ErroKanban(erros);
  return limpo;
}

export function proximoIdCard(cards) {
  const maior = cards.reduce((max, c) => {
    const m = /^K-(\d+)$/.exec(c.id || '');
    return m ? Math.max(max, Number(m[1])) : max;
  }, 0);
  return `K-${String(maior + 1).padStart(4, '0')}`;
}

export function criarCard(dados, existentes, hoje) {
  const limpo = normalizar(dados);
  const historico = [{ data: hoje, evento: 'Criado' }];
  return { id: proximoIdCard(existentes), ...limpo, criado_em: hoje, historico };
}

export function editarCard(original, dados, hoje) {
  const limpo = normalizar(dados);
  const { prazo, ...base } = original; // o prazo some se o campo for esvaziado
  const editado = { ...base, ...limpo, historico: [...(original.historico || []), { data: hoje, evento: 'Editado' }] };
  if (limpo.status !== original.status) {
    editado.historico.push({ data: hoje, evento: `Status: ${STATUS_KANBAN[original.status]} → ${STATUS_KANBAN[limpo.status]}` });
  }
  return editado;
}

export function moverCard(card, novoStatus, hoje) {
  if (!(novoStatus in STATUS_KANBAN)) throw new ErroKanban({ status: 'Escolha um status.' });
  if (novoStatus === card.status) return card;
  const evento = `Status: ${STATUS_KANBAN[card.status]} → ${STATUS_KANBAN[novoStatus]}`;
  return { ...card, status: novoStatus, historico: [...(card.historico || []), { data: hoje, evento }] };
}

export function removerCard(cards, id) {
  return cards.filter((c) => c.id !== id);
}

// Desfaz uma exclusão: devolve o card à posição em que estava. Recusa se o número já foi reaproveitado por outro card.
export function restaurarCard(cards, card, indice) {
  if (cards.some((c) => c.id === card.id)) {
    throw new ErroKanban({ id: `Não foi possível desfazer: o número ${card.id} já foi usado por outro card.` });
  }
  const i = Number.isInteger(indice) ? Math.min(Math.max(indice, 0), cards.length) : cards.length;
  return [...cards.slice(0, i), card, ...cards.slice(i)];
}

// Atrasado: prazo anterior a hoje e card ainda não concluído.
export function estaAtrasado(card, hoje) {
  return Boolean(card.prazo) && card.status !== 'concluido' && card.prazo < hoje;
}

// Texto do prazo para o card. `atrasado` só vale para card não concluído.
export function descreverPrazo(card, hoje) {
  if (!card.prazo) return { texto: 'Sem prazo', atrasado: false };
  const [a, m, d] = card.prazo.split('-');
  const data = `${d}/${m}/${a}`;
  if (card.status === 'concluido') return { texto: `Prazo: ${data}`, atrasado: false };
  const dias = diasEntre(hoje, card.prazo);
  if (dias < 0) return { texto: `${data} · atrasado há ${-dias} ${dias === -1 ? 'dia' : 'dias'}`, atrasado: true };
  if (dias === 0) return { texto: `${data} · vence hoje`, atrasado: false };
  return { texto: `${data} · em ${dias} ${dias === 1 ? 'dia' : 'dias'}`, atrasado: false };
}

export function filtrosKanbanEmUso(filtros) {
  const f = { ...FILTROS_KANBAN_PADRAO, ...filtros };
  return f.busca.trim() !== '' || f.prioridade !== '' || f.prazo !== '' || f.status !== '';
}

// Lista os cards conforme os filtros, ordenados por prioridade, prazo (sem prazo por último) e criação.
// filtros: { busca, prioridade, prazo: '' | atrasados | proximos7 | sem_prazo, status }
//   atrasados e proximos7 só consideram cards não concluídos; a busca olha id, título e descrição, sem acento nem caixa.
export function listarCards(cards, filtros, hoje) {
  const { busca = '', prioridade = '', prazo = '', status = '' } = filtros;
  const termos = normalizarBusca(busca).split(/\s+/).filter(Boolean);
  const limite = somarDias(hoje, 7);
  const confere = (c) => {
    if (prioridade && c.prioridade !== prioridade) return false;
    if (status && c.status !== status) return false;
    if (prazo === 'atrasados' && !estaAtrasado(c, hoje)) return false;
    if (prazo === 'proximos7' && !(c.prazo && c.status !== 'concluido' && c.prazo >= hoje && c.prazo <= limite)) return false;
    if (prazo === 'sem_prazo' && c.prazo) return false;
    const alvo = normalizarBusca(`${c.id} ${c.titulo} ${c.descricao ?? ''}`);
    return termos.every((t) => alvo.includes(t));
  };
  return cards
    .filter(confere)
    .sort(
      (a, b) =>
        ORDEM_PRIORIDADE[a.prioridade] - ORDEM_PRIORIDADE[b.prioridade] ||
        (a.prazo ?? '9999').localeCompare(b.prazo ?? '9999') ||
        (a.criado_em || '').localeCompare(b.criado_em || '') ||
        a.id.localeCompare(b.id)
    );
}

// Agrupa por status, mantendo a ordem recebida. Sempre devolve as 4 colunas, mesmo vazias.
export function agruparPorStatus(cards) {
  const grupos = Object.fromEntries(Object.keys(STATUS_KANBAN).map((s) => [s, []]));
  for (const c of cards) grupos[c.status]?.push(c);
  return grupos;
}
