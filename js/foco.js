// "Foco de hoje": até 3 demandas para olhar primeiro. Função pura; usa a ordem do motor (priorizarFila) e não recalcula pontos.
import { priorizarFila } from './regras.js';

export const LIMITE_FOCO = 3;

// Ordem: vencidas, depois as que vencem hoje, depois as de maior placar. Cada demanda entra uma só vez.
// Cada item é o da fila ({ demanda, prazo, score, faixa, motivos }) mais `motivo`: 'vencida' | 'vence_hoje' | 'maior_placar'.
export function focoDeHoje(demandas, hoje, contexto = {}, limite = LIMITE_FOCO) {
  const { fila } = priorizarFila(demandas, hoje, contexto);
  const grupos = [
    ['vencida', fila.filter((x) => x.prazo < hoje)],
    ['vence_hoje', fila.filter((x) => x.prazo === hoje)],
    ['maior_placar', fila],
  ];
  const vistos = new Set();
  const itens = [];
  for (const [motivo, lista] of grupos) {
    for (const x of lista) {
      if (itens.length >= limite) return itens;
      if (vistos.has(x.demanda.id)) continue;
      vistos.add(x.demanda.id);
      itens.push({ ...x, motivo });
    }
  }
  return itens;
}
