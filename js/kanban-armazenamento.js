// Persistência do Kanban no navegador (localStorage), em chave própria: não mistura com os dados do painel de demandas.
// O storage é recebido por parâmetro para permitir testes sem navegador.
import { PRIORIDADES, STATUS_KANBAN } from './kanban.js';
import { ETAPAS } from './design-thinking.js';

export const CHAVE_KANBAN = 'kanban-dt:v1';

const copia = (x) => JSON.parse(JSON.stringify(x));
const unicos = (itens) => new Set(itens.map((i) => i.id)).size === itens.length;

function cardValido(c) {
  return c && typeof c.id === 'string' && typeof c.titulo === 'string' && c.titulo !== '' && c.status in STATUS_KANBAN && c.prioridade in PRIORIDADES;
}

function notaValida(n) {
  return n && typeof n.id === 'string' && typeof n.texto === 'string' && n.etapa in ETAPAS;
}

function formatoValido(d) {
  return Boolean(d) && d.versao === 1 && Array.isArray(d.cards) && Array.isArray(d.notas)
    && d.cards.every(cardValido) && d.notas.every(notaValida) && unicos(d.cards) && unicos(d.notas);
}

// Retorna { dados, origem } com origem 'armazenamento' ou 'exemplo' (primeira abertura, dado inválido ou storage indisponível).
export function carregarKanban(storage, exemplo) {
  const padrao = { versao: 1, cards: copia(exemplo.cards), notas: copia(exemplo.notas) };
  try {
    const bruto = storage?.getItem(CHAVE_KANBAN);
    if (bruto) {
      const dados = JSON.parse(bruto);
      if (formatoValido(dados)) return { dados, origem: 'armazenamento' };
    }
  } catch {
    // storage indisponível ou JSON corrompido: cai no exemplo
  }
  return { dados: padrao, origem: 'exemplo' };
}

// Retorna true se gravou; false se o storage está indisponível ou cheio.
export function salvarKanban(storage, dados) {
  try {
    storage.setItem(CHAVE_KANBAN, JSON.stringify({ versao: 1, cards: dados.cards, notas: dados.notas }));
    return true;
  } catch {
    return false;
  }
}
