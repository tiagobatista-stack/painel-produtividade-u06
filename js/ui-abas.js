// Abas da página, com o estado no endereço: #quadro, #pontos, #agenda, #afastamentos e #relatorios.
// Nenhum elemento da página pode ter id igual ao nome de uma aba: o navegador trataria o endereço como âncora e tiraria o foco do link.
export const ABAS = ['quadro', 'pontos', 'agenda', 'afastamentos', 'relatorios'];
export const ABA_PADRAO = 'quadro';

// Endereço vazio ou desconhecido cai no quadro.
function abaDoEndereco() {
  const nome = window.location.hash.slice(1);
  return ABAS.includes(nome) ? nome : ABA_PADRAO;
}

export function mostrarAba(nome) {
  for (const painel of document.querySelectorAll('[data-aba-painel]')) painel.hidden = painel.dataset.abaPainel !== nome;
  for (const link of document.querySelectorAll('.abas [data-aba]')) {
    if (link.dataset.aba === nome) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
}

// Vai para a aba e grava no endereço (o botão Voltar do navegador volta à aba anterior).
export function abrirAba(nome) {
  if (window.location.hash !== `#${nome}`) window.location.hash = nome;
  mostrarAba(nome);
}

export function iniciarAbas() {
  const hash = window.location.hash.slice(1);
  if (hash && !ABAS.includes(hash)) window.history.replaceState(null, '', `#${ABA_PADRAO}`);
  window.addEventListener('hashchange', () => mostrarAba(abaDoEndereco()));
  mostrarAba(abaDoEndereco());
}
