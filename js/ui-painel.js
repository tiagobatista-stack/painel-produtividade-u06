// Painel lateral de uma demanda: prioridade e motivos, dados, pontos da operação, histórico, status, editar e excluir.
// É um <dialog> modal (foco preso, Esc fecha) estilizado como gaveta; o conteúdo é refeito a cada atualização da tela.
import { linkParaLocalizar } from './camadas-mapa.js';
import { coordenadaDecimal, coordenadaEmGms } from './coordenadas.js';
import { autosALavrar, relatoriosPendentes } from './indicadores.js';
import { itemDaDemanda } from './demandas.js';
import { blocoAnotacoes } from './ui-anotacoes.js';
import { blocoMiniMapa, destruirMiniMapa, montarMiniMapa } from './ui-mini-mapa.js';
import { esforcoHoras } from './operacoes.js';
import { ETAPAS, ORIGENS, STATUS, TIPOS } from './rotulos.js';
import { $, abrirEmNovaAba, elemento, estado, formatarData, hojeAtual, opcoes, textoPrazo } from './ui-comum.js';
import { abrirRetorno, blocoPontos, botaoSobrestamento, temPlanejados } from './ui-operacao.js';

const painel = $('painel-demanda');
let idAberto = null;
let focoDeRetorno = null; // data-foco do controle que abriu o painel, para devolver o foco ao fechar
let semFoco = false; // fechar sem devolver o foco (ex.: a demanda foi excluída)
let tratadores = { editar: () => {}, excluir: () => {}, mudarStatus: () => {} };

const linha = (texto, classe = 'demanda-detalhe') => elemento('p', classe, texto);

function linhaPrioridade({ demanda: d, faixa, faixa_calculada: faixaCalculada, modo, score, concluida, sobrestada, erro }) {
  if (concluida) return d.concluida_em ? `Concluída em ${formatarData(d.concluida_em)}` : 'Concluída';
  if (sobrestada) return d.tipo === 'operacao' ? 'Sobrestada: prazo suspenso, aguardando identificação do autuado' : 'Sobrestado: prazo suspenso, aguardando resposta do interessado';
  if (erro) return `Sem prioridade: ${erro}`;
  if (modo === 'manual') return `Prioridade ${faixa} (manual) · calculada: ${faixaCalculada} ${score}`;
  return `Prioridade ${faixa} · ${score} pontos`;
}

function blocoDados(item, hoje) {
  const { demanda: d, prazo, concluida, sobrestada } = item;
  const bloco = elemento('div', 'painel-dados');
  bloco.append(linha(linhaPrioridade(item), 'prioridade'));
  bloco.append(linha(`Origem: ${ORIGENS[d.origem]}`));
  if (sobrestada) bloco.append(linha(`Prazo registrado: ${formatarData(prazo)} (não conta enquanto sobrestado)`));
  else if (!concluida) bloco.append(linha(`Prazo: ${textoPrazo(prazo, hoje).texto}`, 'demanda-prazo'));
  if (d.descricao) bloco.append(linha(d.descricao, 'demanda-descricao-painel'));
  const etapa = ETAPAS[d.tipo]?.[d.etapa];
  if (d.protocolo || etapa) {
    const rotulo = d.tipo === 'processo' || d.tipo === 'licenciamento' ? 'Processo' : 'Protocolo';
    bloco.append(linha([d.protocolo && `${rotulo} ${d.protocolo}`, etapa && `etapa: ${etapa}`].filter(Boolean).join(' · ')));
  }
  if (d.responsavel) bloco.append(linha(`Responsável: ${d.responsavel}`));
  if (d.municipio) bloco.append(linha(`Município: ${d.municipio}`));
  if (d.endereco) bloco.append(linha(`Endereço: ${d.endereco}`));
  if (Number.isFinite(d.coord_y) && Number.isFinite(d.coord_x)) {
    bloco.append(linha(`Coordenadas: ${coordenadaEmGms(d.coord_y, d.coord_x)} (${coordenadaDecimal(d.coord_y, d.coord_x)})`, 'demanda-detalhe painel-coordenada'));
  }
  const localizar = linkParaLocalizar({ latitude: d.coord_y, longitude: d.coord_x, endereco: d.endereco });
  if (localizar) {
    const botao = elemento('button', 'link', 'Localizar no OpenStreetMap');
    botao.type = 'button';
    botao.setAttribute('aria-label', `Localizar ${d.titulo} no OpenStreetMap (abre em outra aba)`);
    botao.addEventListener('click', () => abrirEmNovaAba(localizar));
    bloco.append(botao);
  }
  if (d.data_hora) {
    const [dia, hora] = d.data_hora.split('T');
    bloco.append(linha(`${formatarData(dia)} às ${hora} · ${d.local}${d.publico !== undefined ? ` · ${d.publico} pessoas` : ''}`));
  }
  if (d.tipo === 'operacao') {
    const pend = relatoriosPendentes(d);
    const autos = autosALavrar(d);
    bloco.append(linha(`${d.equipe} · saída ${formatarData(d.saida)} · retorno ${formatarData(d.retorno)}`));
    bloco.append(linha(`${pend} ${pend === 1 ? 'relatório pendente' : 'relatórios pendentes'} · ${autos} ${autos === 1 ? 'auto a lavrar' : 'autos a lavrar'} · esforço estimado ${esforcoHoras(d)} h`));
  }
  return bloco;
}

function blocoMotivos({ demanda: d, faixa, modo, motivos }) {
  if (!motivos) return null;
  const bloco = elemento('section', 'painel-motivos');
  const lista = elemento('ul');
  if (modo === 'manual') lista.append(elemento('li', '', `Ajuste manual: ${faixa}. Motivo: ${d.motivo_ajuste}`));
  lista.append(...motivos.map((m) => elemento('li', '', m)));
  bloco.append(elemento('h3', '', 'Por que esta prioridade?'), lista);
  return bloco;
}

function blocoHistorico(d) {
  if (!d.historico?.length) return null;
  const detalhes = elemento('details', 'motivos');
  const lista = elemento('ul');
  lista.append(...d.historico.map((h) => elemento('li', '', `${formatarData(h.data)} — ${h.evento}`)));
  detalhes.append(elemento('summary', '', `Histórico (${d.historico.length})`), lista);
  return detalhes;
}

function blocoAcoes({ demanda: d, concluida }) {
  const acoes = elemento('div', 'acoes-cartao');
  if (d.tipo !== 'operacao') {
    const rotulo = elemento('label', 'rotulo-status', 'Status');
    const select = elemento('select');
    select.id = `status-${d.id}`;
    rotulo.htmlFor = select.id;
    select.dataset.foco = `status-${d.id}`;
    opcoes(select, Object.entries(STATUS), d.status);
    select.addEventListener('change', () => tratadores.mudarStatus(d.id, select.value));
    acoes.append(rotulo, select);
  }
  const editar = elemento('button', '', 'Editar');
  editar.type = 'button';
  editar.dataset.foco = `editar-${d.id}`;
  editar.setAttribute('aria-label', `Editar ${d.titulo}`);
  editar.addEventListener('click', () => tratadores.editar(d, editar));
  const excluir = elemento('button', 'perigo', '🗑 Excluir');
  excluir.type = 'button';
  excluir.setAttribute('aria-label', `Excluir ${d.titulo}`);
  excluir.addEventListener('click', () => tratadores.excluir(d));
  acoes.append(editar, excluir);
  if (temPlanejados(d)) {
    const retorno = elemento('button', 'primario', 'Registrar retorno');
    retorno.type = 'button';
    retorno.dataset.foco = `retorno-${d.id}`;
    retorno.setAttribute('aria-label', `Registrar retorno de ${d.titulo}`);
    retorno.addEventListener('click', () => abrirRetorno(d, retorno));
    acoes.append(retorno);
  }
  if (d.tipo === 'operacao' && !concluida) acoes.append(botaoSobrestamento(d));
  return acoes;
}

// Refaz o conteúdo do painel aberto. Chamado a cada atualização da tela; fecha se a demanda não existe mais.
export function desenharPainel(hoje) {
  if (!idAberto || !painel.open) return;
  const d = estado.dados.demandas.find((x) => x.id === idAberto);
  if (!d) {
    fecharPainel(false);
    return;
  }
  const item = itemDaDemanda(d, hoje, { afastamentos: estado.dados.afastamentos });
  const rolagem = painel.scrollTop;
  $('painel-titulo').textContent = d.titulo;
  const topo = elemento('p', 'demanda-topo');
  topo.append(elemento('span', 'etiqueta', TIPOS[d.tipo]), elemento('span', 'status', STATUS[d.status]));
  $('painel-corpo').replaceChildren(
    ...[topo, blocoDados(item, hoje), blocoMotivos(item), blocoAnotacoes(d), d.tipo === 'operacao' ? blocoPontos(d) : null, blocoHistorico(d), blocoAcoes(item), blocoMiniMapa(item)].filter(Boolean)
  );
  montarMiniMapa(item);
  painel.scrollTop = rolagem;
}

export function abrirPainel(id, gatilho) {
  if (!estado.dados.demandas.some((d) => d.id === id)) return;
  idAberto = id;
  focoDeRetorno = gatilho?.dataset.foco ?? null;
  if (!painel.open) painel.showModal();
  desenharPainel(hojeAtual());
}

export function fecharPainel(devolverFoco = true) {
  semFoco = !devolverFoco;
  if (painel.open) painel.close();
  else semFoco = false;
}

// `tratadores`: { editar(demanda, botao), excluir(demanda), mudarStatus(id, status) }, vindos do app.js.
export function iniciarPainel(funcoes) {
  tratadores = funcoes;
  $('painel-fechar').addEventListener('click', () => fecharPainel());
  // O clique no fundo escurecido chega ao próprio <dialog> (o conteúdo tem o seu espaçamento por dentro).
  painel.addEventListener('click', (e) => {
    if (e.target === painel) fecharPainel();
  });
  painel.addEventListener('close', () => {
    const retorno = focoDeRetorno;
    destruirMiniMapa();
    idAberto = null;
    focoDeRetorno = null;
    if (!semFoco) (retorno && document.querySelector(`[data-foco="${retorno}"]`) ? document.querySelector(`[data-foco="${retorno}"]`) : $('titulo-fila')).focus();
    semFoco = false;
  });
}
