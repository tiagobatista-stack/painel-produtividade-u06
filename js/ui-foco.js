// Faixa "Foco de hoje": até 3 demandas para olhar primeiro (vencidas, as que vencem hoje, maior placar).
import { focoDeHoje } from './foco.js';
import { TIPOS } from './rotulos.js';
import { $, classeFaixa, elemento, estado, textoPrazo } from './ui-comum.js';

export function desenharFoco(hoje) {
  const itens = focoDeHoje(estado.dados.demandas, hoje, { afastamentos: estado.dados.afastamentos });
  $('foco-vazio').hidden = itens.length > 0;
  $('foco-lista').replaceChildren(
    ...itens.map((x) => {
      const prazo = textoPrazo(x.prazo, hoje);
      const li = elemento('li', `foco-item ${classeFaixa(x.faixa)}${prazo.vencida ? ' vencida' : ''}`);
      const botao = elemento('button', 'foco-botao');
      botao.type = 'button';
      botao.dataset.foco = `foco-${x.demanda.id}`;
      const topo = elemento('span', 'foco-topo');
      topo.append(elemento('span', 'etiqueta', TIPOS[x.demanda.tipo]), elemento('span', '', x.faixa));
      botao.append(topo, elemento('span', 'foco-titulo', x.demanda.titulo), elemento('span', 'foco-prazo', `Prazo: ${prazo.texto}`));
      botao.addEventListener('click', () => estado.abrirPainel(x.demanda.id, botao));
      li.append(botao);
      return li;
    })
  );
}
