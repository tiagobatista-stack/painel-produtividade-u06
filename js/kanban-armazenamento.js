// Persistência do Kanban no navegador (localStorage), em chave própria: não mistura com os dados do painel de demandas.
// A chave guarda "dt" no nome por história (a página já teve uma aba de notas por etapa, retirada: Design Thinking é método,
// ver docs/DESIGN_THINKING.md). O nome não muda para os cards já salvos continuarem valendo.
// O storage é recebido por parâmetro para permitir testes sem navegador.
import { PRIORIDADES, STATUS_KANBAN } from './kanban.js';

export const CHAVE_KANBAN = 'kanban-dt:v1';

const copia = (x) => JSON.parse(JSON.stringify(x));
const unicos = (itens) => new Set(itens.map((i) => i.id)).size === itens.length;

function cardValido(c) {
  return c && typeof c.id === 'string' && typeof c.titulo === 'string' && c.titulo !== '' && c.status in STATUS_KANBAN && c.prioridade in PRIORIDADES;
}

// Uma cópia antiga pode trazer `notas` (da aba retirada): é ignorada e some no próximo salvamento.
function formatoValido(d) {
  return Boolean(d) && d.versao === 1 && Array.isArray(d.cards) && d.cards.every(cardValido) && unicos(d.cards);
}

// Retorna { dados, origem } com origem 'armazenamento' ou 'exemplo' (primeira abertura, dado inválido ou storage indisponível).
export function carregarKanban(storage, exemplo) {
  try {
    const bruto = storage?.getItem(CHAVE_KANBAN);
    if (bruto) {
      const lido = JSON.parse(bruto);
      if (formatoValido(lido)) return { dados: { versao: 1, cards: lido.cards }, origem: 'armazenamento' };
    }
  } catch {
    // storage indisponível ou JSON corrompido: cai no exemplo
  }
  return { dados: { versao: 1, cards: copia(exemplo.cards) }, origem: 'exemplo' };
}

// Retorna true se gravou; false se o storage está indisponível ou cheio.
export function salvarKanban(storage, dados) {
  try {
    storage.setItem(CHAVE_KANBAN, JSON.stringify({ versao: 1, cards: dados.cards }));
    return true;
  } catch {
    return false;
  }
}
