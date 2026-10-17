// Linha compacta de uma demanda, usada pela lista e pelo quadro: selo de prioridade, título, "tipo · origem" em linha secundária
// e o prazo à direita. Todo o resto está no painel lateral.
import { ORIGENS, STATUS, TIPOS } from './rotulos.js';
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

  // O selo é a faixa de prioridade (Crítica e Alta com cor, Média e Baixa neutras) ou, fora da fila, o estado da demanda.
  const selo = elemento('span', 'status', faixa ?? STATUS[d.status]);

  const sub = elemento('span', 'demanda-sub');
  sub.append(elemento('span', 'etiqueta', TIPOS[d.tipo]), elemento('span', 'demanda-origem', ORIGENS[d.origem] ?? ''));
  if (d.anotacoes?.length) sub.append(elemento('span', 'demanda-obs', `Anotações ${d.anotacoes.filter((a) => a.feita).length}/${d.anotacoes.length}`));
  const corpo = elemento('span', 'demanda-corpo');
  corpo.append(elemento('span', 'demanda-titulo', d.titulo), sub);

  let prazoTexto = `Prazo: ${info.texto}`;
  if (concluida) prazoTexto = d.concluida_em ? `Concluída em ${formatarData(d.concluida_em)}` : 'Concluída';
  else if (sobrestada) prazoTexto = 'Prazo suspenso (sobrestado)';

  botao.append(selo, corpo, elemento('span', 'demanda-prazo', prazoTexto));
  botao.addEventListener('click', () => abrirPainel(d.id, botao));
  li.append(botao);
  return li;
}
