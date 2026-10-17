// Anotações de uma demanda: lista com caixa de seleção. Funções puras (não alteram os argumentos, não tocam em tela nem armazenamento).
// Item: { id, texto, feita, criada_em, concluida_em }. As anotações não entram no cálculo de prioridade.
export const TEXTO_MAX = 280;
export const ANOTACOES_MAX = 100;

export class ErroAnotacao extends Error {
  constructor(mensagem) {
    super(mensagem);
    this.name = 'ErroAnotacao';
  }
}

const idNumero = (a) => Number(/^A-(\d+)$/.exec(a.id || '')?.[1] ?? 0);

function proximoId(lista) {
  return `A-${lista.reduce((max, a) => Math.max(max, idNumero(a)), 0) + 1}`;
}

// Cada linha não vazia vira uma anotação (colar várias linhas cria um item por linha).
export function adicionarAnotacoes(lista, texto, hoje) {
  const linhas = String(texto ?? '').split(/\r\n|\r|\n/).map((l) => l.trim()).filter(Boolean);
  if (!linhas.length) return lista;
  if (linhas.some((l) => l.length > TEXTO_MAX)) throw new ErroAnotacao(`Cada anotação aceita até ${TEXTO_MAX} caracteres.`);
  if (lista.length + linhas.length > ANOTACOES_MAX) throw new ErroAnotacao(`Use no máximo ${ANOTACOES_MAX} anotações por demanda.`);
  const nova = [...lista];
  for (const linha of linhas) nova.push({ id: proximoId(nova), texto: linha, feita: false, criada_em: hoje, concluida_em: null });
  return nova;
}

export function alternarAnotacao(lista, id, hoje) {
  return lista.map((a) => (a.id === id ? { ...a, feita: !a.feita, concluida_em: a.feita ? null : hoje } : a));
}

export function editarAnotacao(lista, id, texto) {
  const limpo = String(texto ?? '').replace(/\s+/g, ' ').trim();
  if (!limpo) throw new ErroAnotacao('A anotação não pode ficar vazia. Para apagar, use remover.');
  if (limpo.length > TEXTO_MAX) throw new ErroAnotacao(`Cada anotação aceita até ${TEXTO_MAX} caracteres.`);
  return lista.map((a) => (a.id === id ? { ...a, texto: limpo } : a));
}

// Devolve a lista sem o item e o que é preciso para desfazer.
export function removerAnotacao(lista, id) {
  const indice = lista.findIndex((a) => a.id === id);
  if (indice < 0) return { lista, removida: null, indice: -1 };
  return { lista: lista.filter((a) => a.id !== id), removida: lista[indice], indice };
}

export function desfazerRemocao(lista, removida, indice) {
  if (!removida || lista.some((a) => a.id === removida.id)) return lista;
  const nova = [...lista];
  nova.splice(Math.min(indice, nova.length), 0, removida);
  return nova;
}

// Pendentes primeiro, concluídas no fim, mantendo a ordem de cada grupo.
export function ordenarAnotacoes(lista) {
  return [...lista.filter((a) => !a.feita), ...lista.filter((a) => a.feita)];
}

export function contarAnotacoes(lista) {
  return { feitas: lista.filter((a) => a.feita).length, total: lista.length };
}

// Lista como vai para o CSV: "[x] texto | [ ] texto".
export function anotacoesEmTexto(lista) {
  return (lista ?? []).map((a) => `[${a.feita ? 'x' : ' '}] ${a.texto}`).join(' | ');
}

// Normaliza o que veio do navegador ou do formulário: descarta itens malformados, corta o texto e garante ids únicos.
export function normalizarAnotacoes(valor, hoje) {
  if (!Array.isArray(valor)) return [];
  const vistos = new Set();
  const saida = [];
  for (const a of valor.slice(0, ANOTACOES_MAX)) {
    const texto = typeof a?.texto === 'string' ? a.texto.trim().slice(0, TEXTO_MAX) : '';
    if (!texto) continue;
    const feita = a.feita === true;
    const id = typeof a.id === 'string' && a.id && !vistos.has(a.id) ? a.id : proximoId(saida);
    vistos.add(id);
    saida.push({
      id, texto, feita,
      criada_em: typeof a.criada_em === 'string' ? a.criada_em : hoje ?? null,
      concluida_em: feita ? (typeof a.concluida_em === 'string' ? a.concluida_em : hoje ?? null) : null,
    });
  }
  return saida;
}

// Eventos de histórico para as anotações que passaram a feitas entre duas versões da lista.
export function eventosDeConclusao(antes, depois) {
  const jaFeitas = new Set((antes ?? []).filter((a) => a.feita).map((a) => a.id));
  return depois.filter((a) => a.feita && !jaFeitas.has(a.id)).map((a) => `Anotação concluída: ${a.texto}`);
}
