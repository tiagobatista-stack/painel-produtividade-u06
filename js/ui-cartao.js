// Card compacto de uma demanda, usado pela lista e pelo quadro: tipo, título, faixa (cor na borda e em texto) e prazo relativo.
// Todo o resto está no painel lateral.
import { STATUS, TIPOS } from './rotulos.js';
import { classeFaixa, elemento, formatarData, textoPrazo } from './ui-comum.js';
import { abrirPainel } from './ui-painel.js';

export function cartao(item, hoje) {
  const { demanda: d, prazo, faixa, concluida, sobrestada } = item;
  const info = textoPrazo(prazo, hoje);
  const classes = ['demanda'];
  if (faixa) classes.push(classeFaixa(faixa));
  if (concluida) classes.push('concluida');
  if (sobrestada) classes.push('sobrestada');
  if (info.vencida && !concluida && !sobrestada) classes.push('vencida');
  const li = elemento('li', classes.join(' '));
  li.tabIndex = -1; // recebe o foco ao chegar pelo calendário
  li.dataset.foco = `cartao-${d.id}`;

  const botao = elemento('button', 'demanda-abrir');
  botao.type = 'button';
  botao.dataset.foco = `abrir-${d.id}`;
  botao.setAttribute('aria-haspopup', 'dialog');
  const topo = elemento('span', 'demanda-topo');
  topo.append(elemento('span', 'etiqueta', TIPOS[d.tipo]), elemento('span', 'status', faixa ?? STATUS[d.status]));
  let prazoTexto = `Prazo: ${info.texto}`;
  if (concluida) prazoTexto = d.concluida_em ? `Concluída em ${formatarData(d.concluida_em)}` : 'Concluída';
  else if (sobrestada) prazoTexto = 'Prazo suspenso (sobrestado)';
  botao.append(topo, elemento('span', 'demanda-titulo', d.titulo), elemento('span', 'demanda-prazo', prazoTexto));
  if (d.anotacoes?.length) botao.append(elemento('span', 'demanda-obs', `Anotações ${d.anotacoes.filter((a) => a.feita).length}/${d.anotacoes.length}`));
  botao.addEventListener('click', () => abrirPainel(d.id, botao));
  li.append(botao);
  return li;
}
