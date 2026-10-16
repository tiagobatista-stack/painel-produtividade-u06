// Aba Pontos: cada ponto de cada operação como uma demanda, com a situação do relatório e dos autos, filtros e contadores.
// Não mostra coordenadas (o mapa, quando existe, é outra visão da mesma lista).
import { descricaoDoRelatorio, filtrosPontosEmUso, FILTROS_PONTOS_PADRAO, listarPontos, pontosDasOperacoes, resumoDosPontos } from './pontos.js';
import { ROTULO_AUTO_SEM_TIPO, SITUACOES_PONTO, TIPOS_AUTO } from './rotulos.js';
import { $, elemento, estado, formatarData, opcoes } from './ui-comum.js';
import { desenharMapa, iniciarMapa } from './ui-mapa.js';

const CONTADORES = [
  ['total', 'Pontos', ''],
  ['aguardando_relatorio', 'Aguardando relatório', 'aguardando_relatorio'],
  ['a_lavrar', 'Auto a lavrar', 'a_lavrar'],
  ['com_auto', 'Com auto lavrado', 'com_auto'],
  ['encerrado_sem_auto', 'Encerrados sem auto', 'encerrado_sem_auto'],
];

const busca = $('p-busca');
const filtroOperacao = $('p-operacao');
const filtroSituacao = $('p-situacao');

export function filtrosDosPontos() {
  return { busca: busca.value, operacao: filtroOperacao.value, situacao: filtroSituacao.value };
}

export function aplicarFiltrosDosPontos(f) {
  busca.value = f.busca;
  filtroOperacao.value = f.operacao;
  filtroSituacao.value = f.situacao;
}

function textoAutos(autos) {
  if (autos.length === 0) return 'Autos: nenhum';
  const itens = autos.map((a) => `${a.tipo ? TIPOS_AUTO[a.tipo] : ROTULO_AUTO_SEM_TIPO}${a.data ? ` (${formatarData(a.data)})` : ''}`);
  return `Autos (${autos.length}): ${itens.join('; ')}`;
}

function linhaDoPonto(l) {
  const li = elemento('li', `ponto-card situacao-${l.situacao}`);
  const topo = elemento('div', 'ponto-card-topo');
  topo.append(elemento('strong', '', `Ponto ${l.n} · ${l.municipio}`), elemento('span', `selo-situacao selo-situacao-${l.situacao}`, SITUACOES_PONTO[l.situacao]));
  const op = elemento('p', 'ponto-card-operacao', `${l.equipe} · saída ${formatarData(l.saida)} · retorno ${formatarData(l.retorno)}${l.sobrestada ? ' · operação sobrestada' : ''}`);
  const relatorio = elemento('p', 'ponto-card-linha', `Relatório: ${descricaoDoRelatorio(l, formatarData)}`);
  const autos = elemento('p', 'ponto-card-linha', textoAutos(l.autos));
  li.append(topo, op, relatorio, autos);
  if (l.observacoes) li.append(elemento('p', 'ponto-card-obs', `Anotação: ${l.observacoes}`));
  const abrir = elemento('button', '', 'Abrir operação');
  abrir.type = 'button';
  abrir.dataset.foco = `abrir-ponto-${l.operacaoId}-${l.n}`;
  abrir.setAttribute('aria-haspopup', 'dialog');
  abrir.setAttribute('aria-label', `Abrir a operação ${l.equipe}, ponto ${l.n}`);
  abrir.addEventListener('click', () => estado.abrirPainel(l.operacaoId, abrir));
  li.append(abrir);
  return li;
}

function desenharContadores(resumo) {
  const ativo = filtroSituacao.value;
  const emUso = busca.value.trim() !== '' || filtroOperacao.value !== '';
  $('pontos-indicadores').replaceChildren(
    ...CONTADORES.map(([chave, rotulo, situacao]) => {
      const botao = elemento('button', 'indicador');
      botao.type = 'button';
      botao.dataset.foco = `pontos-indicador-${chave}`;
      botao.setAttribute('aria-label', `${rotulo}: ${resumo[chave]}`);
      botao.setAttribute('aria-pressed', String(!emUso && ativo === situacao));
      botao.append(elemento('span', 'indicador-valor', String(resumo[chave])), elemento('span', 'indicador-rotulo', rotulo));
      // Clicar aplica a situação (e zera busca e operação, para a lista bater com o número); clicar de novo volta a todos.
      botao.addEventListener('click', () => {
        const ja = !emUso && ativo === situacao;
        aplicarFiltrosDosPontos({ ...FILTROS_PONTOS_PADRAO, situacao: ja ? '' : situacao });
        estado.focoApos = `pontos-indicador-${chave}`;
        estado.atualizar();
      });
      const li = elemento('li');
      li.append(botao);
      return li;
    })
  );
}

export function desenharPontos() {
  // As opções de operação acompanham as operações existentes (inclusive as importadas depois).
  const operacoes = estado.dados.demandas.filter((d) => d.tipo === 'operacao');
  const atual = filtroOperacao.value;
  opcoes(filtroOperacao, [['', 'Todas'], ...operacoes.map((o) => [o.id, `${o.equipe} · saída ${formatarData(o.saida)}`])], operacoes.some((o) => o.id === atual) ? atual : '');

  const todos = pontosDasOperacoes(estado.dados.demandas);
  const filtros = filtrosDosPontos();
  const lista = listarPontos(estado.dados.demandas, filtros);
  desenharContadores(resumoDosPontos(todos));
  $('p-limpar').disabled = !filtrosPontosEmUso(filtros);
  $('pontos-contagem').textContent = filtrosPontosEmUso(filtros) ? `${lista.length} de ${todos.length} pontos` : `${todos.length} ${todos.length === 1 ? 'ponto' : 'pontos'}`;
  $('pontos-vazio').hidden = lista.length > 0;
  $('pontos-vazio').textContent = todos.length === 0 ? 'Nenhum ponto ainda: importe a planilha de uma operação.' : 'Nenhum ponto encontrado.';
  $('pontos-lista').replaceChildren(...lista.map(linhaDoPonto));
  desenharMapa(lista); // a visão "Mapa" usa a mesma lista filtrada
}

export function iniciarPontos() {
  opcoes(filtroSituacao, [['', 'Todas'], ...Object.entries(SITUACOES_PONTO)], '');
  for (const campo of [busca, filtroOperacao, filtroSituacao]) campo.addEventListener('input', () => estado.atualizar());
  $('filtros-pontos').addEventListener('submit', (e) => e.preventDefault());
  iniciarMapa();
  $('p-limpar').addEventListener('click', () => {
    aplicarFiltrosDosPontos(FILTROS_PONTOS_PADRAO);
    busca.focus(); // antes de desabilitar o botão, para o foco não se perder
    estado.atualizar();
  });
}
