// Página do Kanban de projetos: abas (Quadro, Design Thinking), carga e persistência local, data de referência.
import { carregarKanban } from './kanban-armazenamento.js';
import { $, formatarData, hojeAtual, hojeLocal, mostrarAviso, mostrarMensagem } from './ui-comum.js';
import { estadoK, persistirK, restaurarFocoK } from './kanban-estado.js';
import { desenharQuadro, iniciarQuadro, limparFiltros, mostrarCard } from './ui-kanban.js';
import { desenharDT, iniciarDT } from './ui-dt.js';

// Abas pelo endereço (#quadro, #design-thinking). Nenhum elemento da página pode ter id igual ao nome de uma aba.
const ABAS = ['quadro', 'design-thinking'];
const ABA_PADRAO = 'quadro';

const abaDoEndereco = () => {
  const nome = window.location.hash.slice(1);
  return ABAS.includes(nome) ? nome : ABA_PADRAO;
};

function mostrarAba(nome) {
  for (const painel of document.querySelectorAll('[data-aba-painel]')) painel.hidden = painel.dataset.abaPainel !== nome;
  for (const link of document.querySelectorAll('.abas [data-aba]')) {
    if (link.dataset.aba === nome) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
}

function abrirAba(nome) {
  if (window.location.hash !== `#${nome}`) window.location.hash = nome;
  mostrarAba(nome);
}

function irParaCard(id) {
  abrirAba('quadro');
  mostrarCard(id);
}

function atualizar() {
  const hoje = hojeAtual();
  desenharQuadro(hoje);
  desenharDT();
  restaurarFocoK();
}

const copia = (x) => JSON.parse(JSON.stringify(x));

// Volta ao exemplo sem pedir confirmação: por cerca de 8 s a mensagem oferece "Desfazer" (os dados anteriores voltam).
function restaurarExemplo() {
  const anteriores = estadoK.dados;
  estadoK.dados = { versao: 1, cards: copia(estadoK.exemplo.cards), notas: copia(estadoK.exemplo.notas) };
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
  mostrarAba(abaDoEndereco());
  window.addEventListener('hashchange', () => mostrarAba(abaDoEndereco()));
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
  iniciarDT({ irParaCard });
  atualizar();
}

iniciar();
