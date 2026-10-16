// Página do Kanban de projetos: carga e persistência local, data de referência e "Restaurar exemplo".
import { carregarKanban } from './kanban-armazenamento.js';
import { $, formatarData, hojeAtual, hojeLocal, mostrarAviso, mostrarMensagem } from './ui-comum.js';
import { estadoK, persistirK, restaurarFocoK } from './kanban-estado.js';
import { desenharQuadro, iniciarQuadro, limparFiltros } from './ui-kanban.js';

function atualizar() {
  const hoje = hojeAtual();
  desenharQuadro(hoje);
  restaurarFocoK();
}

const copia = (x) => JSON.parse(JSON.stringify(x));

// Volta ao exemplo sem pedir confirmação: por cerca de 8 s a mensagem oferece "Desfazer" (os dados anteriores voltam).
function restaurarExemplo() {
  const anteriores = estadoK.dados;
  estadoK.dados = { versao: 1, cards: copia(estadoK.exemplo.cards) };
  limparFiltros();
  persistirK();
  mostrarMensagem('Exemplo restaurado.', {
    acao: {
      rotulo: 'Desfazer',
      fazer: () => {
        estadoK.dados = anteriores;
        persistirK();
        mostrarMensagem('Dados anteriores restaurados.');
        atualizar();
      },
    },
  });
  estadoK.focoApos = 'desfazer';
  atualizar();
}

function acessarStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

async function iniciar() {
  $('data-referencia').value = hojeLocal();
  estadoK.atualizar = atualizar;
  try {
    const resposta = await fetch('data/kanban-exemplo.json');
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
    estadoK.exemplo = await resposta.json();
  } catch {
    mostrarAviso('Não foi possível carregar data/kanban-exemplo.json. Abra a página por "npm start" (não por arquivo local).');
    return;
  }

  estadoK.storage = acessarStorage();
  const carga = carregarKanban(estadoK.storage, estadoK.exemplo);
  estadoK.dados = carga.dados;
  if (carga.origem === 'exemplo') persistirK();

  $('usar-data-seed').textContent = `Usar data do exemplo (${formatarData(estadoK.exemplo.hoje_referencia)})`;
  $('usar-data-seed').addEventListener('click', () => {
    $('data-referencia').value = estadoK.exemplo.hoje_referencia;
    atualizar();
  });
  $('data-referencia').addEventListener('input', atualizar);
  $('restaurar-exemplo').addEventListener('click', restaurarExemplo);

  iniciarQuadro();
  atualizar();
}

iniciar();
