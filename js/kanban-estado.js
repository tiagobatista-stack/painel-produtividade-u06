// Estado e utilitários de tela compartilhados pelos módulos de interface do Kanban.
import { salvarKanban } from './kanban-armazenamento.js';
import { $, mostrarAviso } from './ui-comum.js';

// `atualizar` é definido por kanban-app.js.
export const estadoK = {
  exemplo: null,
  dados: null, // { versao, cards, notas }
  storage: null,
  focoApos: null, // valor de data-foco a restaurar depois de redesenhar
  atualizar: () => {},
};

export function persistirK() {
  if (!salvarKanban(estadoK.storage, estadoK.dados)) {
    mostrarAviso('Não foi possível salvar no navegador. As alterações valem só até recarregar a página.');
  }
}

// Devolve o foco ao controle que o usuário acabou de usar; se ele saiu da tela, vai para o título do quadro.
export function restaurarFocoK() {
  if (!estadoK.focoApos) return;
  (document.querySelector(`[data-foco="${estadoK.focoApos}"]`) ? document.querySelector(`[data-foco="${estadoK.focoApos}"]`) : $('titulo-fila')).focus();
  estadoK.focoApos = null;
}
