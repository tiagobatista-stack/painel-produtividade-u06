import { itensDosIndicadores, relatoriosPendentes, autosALavrar, totalDoIndicador } from './indicadores.js';
import { ErroCadastro, FILTROS_PADRAO, TIPOS_CADASTRAVEIS, alterarStatus, criarDemanda, editarDemanda, filtrosEmUso, listarDemandas, origensDoTipo, removerDemanda } from './demandas.js';
import { esforcoHoras } from './operacoes.js';
import { carregar } from './armazenamento.js';
import { ORIGENS, STATUS, TIPOS } from './rotulos.js';
import {
  $, criarGestorErros, elemento, estado, formatarData, hojeAtual, hojeLocal, mostrarAviso, mostrarMensagem, opcoes, persistir, restaurarFoco, textoPrazo,
} from './ui-comum.js';
import { abrirRetorno, blocoPontos, botaoSobrestamento, iniciarOperacoes, temPlanejados } from './ui-operacao.js';
import { desenharAfastamentos, desenharAgenda, desenharBanner, iniciarAfastamentos } from './ui-afastamentos.js';
import { desenharResumo, iniciarExportacao } from './ui-exportacao.js';
import { desenharCalendario, iniciarCalendario } from './ui-calendario.js';

const INDICADORES = [
  ['abertas', 'Abertas'],
  ['vencidas', 'Vencidas'],
  ['proximos7', 'Próximos 7 dias'],
  ['relatoriosPendentes', 'Relatórios pendentes'],
  ['autosALavrar', 'Autos a lavrar'],
  ['concluidasSemana', 'Concluídas na semana'],
  ['sobrestados', 'Sobrestados'],
];
const ROTULO_INDICADOR = Object.fromEntries(INDICADORES);
// Status da fila em que aparecem os cartões de cada indicador; os demais estão na fila ativa.
const STATUS_DO_INDICADOR = { concluidasSemana: 'concluida', sobrestados: 'aguardando' };
const FAIXAS =['Crítica', 'Alta', 'Média', 'Baixa'];
const CAMPOS = ['tipo', 'titulo', 'origem', 'processo', 'etapa', 'data_hora', 'local', 'publico', 'prazo', 'status', 'esforco_h', 'prazo_dias', 'horas_ponto'];

const campoData = $('data-referencia');
const dialogo = $('dialogo');
const formulario = $('formulario');
const filtroBusca = $('filtro-busca');
const filtroTipo = $('filtro-tipo');
const filtroStatus = $('filtro-status');
const filtroPrioridade = $('filtro-prioridade');
const gestor = criarGestorErros({ resumo: $('resumo-erros'), campos: CAMPOS, idCampo: (c) => `f-${c}`, idErro: (c) => `e-${c}` });

let editando = null; // demanda em edição, ou null quando é nova
let gatilho = null; // elemento que abriu o formulário, para devolver o foco
let salvouNoDialogo = false; // distingue salvar de cancelar ao fechar o formulário

// ---------- Indicadores e fila ----------

// Cada caixa é um botão que abre, abaixo da grade, a lista das demandas que formam o número.
function desenharIndicadores(itens, hoje) {
  $('indicadores').replaceChildren(
    ...INDICADORES.map(([chave, rotulo]) => {
      const valor = totalDoIndicador(itens[chave]);
      const botao = elemento('button', 'indicador');
      botao.type = 'button';
      botao.dataset.foco = `indicador-${chave}`;
      botao.setAttribute('aria-label', `${rotulo}: ${valor}`);
      botao.setAttribute('aria-controls', 'painel-indicador');
      botao.setAttribute('aria-expanded', String(estado.indicadorAberto === chave));
      botao.append(elemento('span', 'indicador-valor', String(valor)), elemento('span', 'indicador-rotulo', rotulo));
      botao.addEventListener('click', () => alternarIndicador(chave));
      const li = elemento('li');
      li.append(botao);
      return li;
    })
  );

  const chave = estado.indicadorAberto;
  $('painel-indicador').hidden = !chave;
  if (!chave) return;
  const lista = itens[chave];
  $('painel-indicador-titulo').textContent = `${ROTULO_INDICADOR[chave]} (${totalDoIndicador(lista)})`;
  $('lista-indicador').replaceChildren(
    ...(lista.length ? lista.map((x) => itemIndicador(chave, x, hoje)) : [elemento('li', 'nota', 'Nenhuma demanda nesta categoria.')])
  );
}

function detalheItem(chave, { demanda: d, prazo, quantidade }, hoje) {
  const partes = [TIPOS[d.tipo]];
  if (d.processo) partes.push(d.processo);
  if (chave === 'relatoriosPendentes') partes.push(`${quantidade} ${quantidade === 1 ? 'relatório pendente' : 'relatórios pendentes'}`);
  else if (chave === 'autosALavrar') partes.push(`${quantidade} ${quantidade === 1 ? 'auto a lavrar' : 'autos a lavrar'}`);
  else if (chave === 'concluidasSemana') partes.push(`concluída em ${formatarData(d.concluida_em)}`);
  else if (chave === 'sobrestados') partes.push(`prazo registrado ${formatarData(prazo)} (suspenso)`);
  else partes.push(`prazo ${textoPrazo(prazo, hoje).texto}`);
  return partes.join(' · ');
}

function itemIndicador(chave, item, hoje) {
  const botao = elemento('button', 'item-indicador');
  botao.type = 'button';
  botao.append(elemento('span', 'item-indicador-titulo', item.demanda.titulo), elemento('span', 'item-indicador-detalhe', detalheItem(chave, item, hoje)));
  botao.addEventListener('click', () => irParaDemanda(item.demanda.id, STATUS_DO_INDICADOR[chave] ?? 'abertas'));
  const li = elemento('li');
  li.append(botao);
  return li;
}

function alternarIndicador(chave) {
  estado.indicadorAberto = estado.indicadorAberto === chave ? null : chave;
  estado.focoApos = `indicador-${chave}`;
  atualizar();
}

function fecharIndicador() {
  if (!estado.indicadorAberto) return;
  estado.focoApos = `indicador-${estado.indicadorAberto}`;
  estado.indicadorAberto = null;
  atualizar();
}

// Leva ao cartão da demanda na fila: ajusta os filtros para que ele apareça, rola até ele, destaca e põe o foco nele.
function irParaDemanda(id, status = 'abertas') {
  filtroBusca.value = FILTROS_PADRAO.busca;
  filtroTipo.value = FILTROS_PADRAO.tipo;
  filtroPrioridade.value = FILTROS_PADRAO.prioridade;
  filtroStatus.value = status;
  estado.indicadorAberto = null;
  estado.focoApos = `cartao-${id}`;
  atualizar();
  const alvo = document.querySelector(`[data-foco="cartao-${id}"]`);
  if (!alvo) return;
  alvo.scrollIntoView({ block: 'center' });
  alvo.classList.add('destaque');
  setTimeout(() => alvo.classList.remove('destaque'), 2500);
}

function classeFaixa(faixa) {
  return `faixa-${faixa.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()}`;
}

function cartao(item, hoje) {
  const { demanda: d, prazo, score, faixa, motivos, concluida, sobrestada } = item;
  const info = textoPrazo(prazo, hoje);
  const classes = ['demanda'];
  if (faixa) classes.push(classeFaixa(faixa));
  if (concluida) classes.push('concluida');
  if (sobrestada) classes.push('sobrestada');
  if (info.vencida && !concluida && !sobrestada) classes.push('vencida');
  const li = elemento('li', classes.join(' '));
  li.tabIndex = -1; // recebe o foco ao chegar pelo indicador
  li.dataset.foco = `cartao-${d.id}`;

  const topo = elemento('div', 'demanda-topo');
  topo.append(elemento('span', 'etiqueta', TIPOS[d.tipo]), elemento('span', 'status', STATUS[d.status]));
  li.append(topo, elemento('h3', 'demanda-titulo', d.titulo));

  if (concluida) {
    li.append(elemento('p', 'prioridade', d.concluida_em ? `Concluída em ${formatarData(d.concluida_em)}` : 'Concluída'));
  } else if (sobrestada) {
    li.append(elemento('p', 'prioridade', d.tipo === 'operacao' ? 'Sobrestada: prazo suspenso, aguardando identificação do autuado' : 'Sobrestado: prazo suspenso, aguardando resposta do interessado'));
  } else {
    li.append(elemento('p', 'prioridade', `Prioridade ${faixa} · ${score} pontos`));
  }
  li.append(elemento('p', 'demanda-detalhe', `Origem: ${ORIGENS[d.origem]}`));
  if (sobrestada) li.append(elemento('p', 'demanda-detalhe', `Prazo registrado: ${formatarData(prazo)} (não conta enquanto sobrestado)`));
  else if (!concluida) li.append(elemento('p', 'demanda-prazo', `Prazo: ${info.texto}`));
  if (d.processo) li.append(elemento('p', 'demanda-detalhe', `Processo ${d.processo}${d.etapa ? ` · etapa: ${d.etapa.replaceAll('_', ' ')}` : ''}`));
  if (d.data_hora) {
    const [dia, hora] = d.data_hora.split('T');
    li.append(elemento('p', 'demanda-detalhe', `${formatarData(dia)} às ${hora} · ${d.local}${d.publico !== undefined ? ` · ${d.publico} pessoas` : ''}`));
  }
  if (d.tipo === 'operacao') {
    const pend = relatoriosPendentes(d);
    const autos = autosALavrar(d);
    li.append(elemento('p', 'demanda-detalhe', `${d.equipe} · saída ${formatarData(d.saida)} · retorno ${formatarData(d.retorno)}`));
    li.append(elemento('p', 'demanda-detalhe', `${pend} ${pend === 1 ? 'relatório pendente' : 'relatórios pendentes'} · ${autos} ${autos === 1 ? 'auto a lavrar' : 'autos a lavrar'} · esforço estimado ${esforcoHoras(d)} h`));
  }

  if (motivos) {
    const detalhes = elemento('details', 'motivos');
    const lista = elemento('ul');
    lista.append(...motivos.map((m) => elemento('li', '', m)));
    detalhes.append(elemento('summary', '', 'Por que esta prioridade?'), lista);
    li.append(detalhes);
  }
  if (d.tipo === 'operacao') li.append(blocoPontos(d));

  if (d.historico?.length) {
    const detalhes = elemento('details', 'motivos');
    const lista = elemento('ul');
    lista.append(...d.historico.map((h) => elemento('li', '', `${formatarData(h.data)} — ${h.evento}`)));
    detalhes.append(elemento('summary', '', `Histórico (${d.historico.length})`), lista);
    li.append(detalhes);
  }

  const acoes = elemento('div', 'acoes-cartao');
  if (d.tipo !== 'operacao') {
    const rotulo = elemento('label', 'rotulo-status', 'Status');
    const select = elemento('select');
    select.id = `status-${d.id}`;
    rotulo.htmlFor = select.id;
    select.dataset.foco = `status-${d.id}`;
    opcoes(select, Object.entries(STATUS), d.status);
    select.addEventListener('change', () => mudarStatus(d.id, select.value));
    acoes.append(rotulo, select);
  }
  const editar = elemento('button', '', 'Editar');
  editar.type = 'button';
  editar.dataset.foco = `editar-${d.id}`;
  editar.setAttribute('aria-label', `Editar ${d.titulo}`);
  editar.addEventListener('click', () => abrirFormulario(d, editar));
  const excluir = elemento('button', 'perigo', '🗑');
  excluir.type = 'button';
  excluir.title = 'Excluir';
  excluir.setAttribute('aria-label', `Excluir ${d.titulo}`);
  excluir.addEventListener('click', () => excluirDemanda(d));
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
  li.append(acoes);
  return li;
}

function filtrosAtuais() {
  return { busca: filtroBusca.value, tipo: filtroTipo.value, status: filtroStatus.value, prioridade: filtroPrioridade.value };
}

function desenharFila(hoje) {
  const { itens, erros } = listarDemandas(estado.dados.demandas, filtrosAtuais(), hoje, { afastamentos: estado.dados.afastamentos });
  $('fila-vazia').hidden = itens.length > 0;
  $('contagem').textContent = `${itens.length} ${itens.length === 1 ? 'demanda' : 'demandas'}`;
  $('fila').replaceChildren(...itens.map((item) => cartao(item, hoje)));
  $('erros-validacao').hidden = erros.length === 0;
  $('lista-erros').replaceChildren(...erros.map((x) => elemento('li', '', `${x.demanda.id || '(sem id)'} — ${x.demanda.titulo || ''}: ${x.erro}`)));
}

function atualizar() {
  const hoje = hojeAtual();
  $('limpar-filtros').disabled = !filtrosEmUso(filtrosAtuais());
  desenharBanner(hoje);
  desenharIndicadores(itensDosIndicadores(estado.dados.demandas, hoje), hoje);
  desenharResumo(hoje);
  desenharCalendario(hoje);
  desenharAgenda(hoje);
  desenharFila(hoje);
  desenharAfastamentos(hoje);
  restaurarFoco();
}

// Volta busca, tipo, status e prioridade ao padrão. Não apaga demandas nem mexe na data de referência.
function limparFiltros() {
  filtroBusca.value = FILTROS_PADRAO.busca;
  filtroTipo.value = FILTROS_PADRAO.tipo;
  filtroStatus.value = FILTROS_PADRAO.status;
  filtroPrioridade.value = FILTROS_PADRAO.prioridade;
  filtroBusca.focus(); // antes de desabilitar o botão, para o foco não se perder
  atualizar();
}

function mudarStatus(id, novoStatus) {
  const i = estado.dados.demandas.findIndex((d) => d.id === id);
  try {
    estado.dados.demandas[i] = alterarStatus(estado.dados.demandas[i], novoStatus, hojeAtual());
  } catch (e) {
    if (!(e instanceof ErroCadastro)) throw e;
    mostrarAviso(Object.values(e.erros)[0]);
    return;
  }
  persistir();
  estado.focoApos = `status-${id}`;
  atualizar();
}

function excluirDemanda(d) {
  const extra = d.tipo === 'operacao' ? ' Todos os pontos da operação também serão apagados.' : '';
  if (!window.confirm(`Excluir a demanda "${d.titulo}"?${extra} Esta ação não pode ser desfeita.`)) return;
  estado.dados.demandas = removerDemanda(estado.dados.demandas, d.id);
  persistir();
  mostrarMensagem('Demanda excluída.');
  estado.focoApos = 'titulo-fila';
  atualizar();
}

// ---------- Formulário de demanda ----------

function atualizarCamposDoTipo(tipo) {
  for (const campo of formulario.querySelectorAll('[data-tipos]')) {
    campo.hidden = !campo.dataset.tipos.split(' ').includes(tipo);
  }
  const atual = $('f-origem').value;
  const validas = origensDoTipo(tipo);
  opcoes($('f-origem'), validas.map((o) => [o, ORIGENS[o]]), validas.includes(atual) ? atual : validas[0]);
}

function abrirFormulario(demanda, origemDoClique) {
  editando = demanda;
  gatilho = origemDoClique;
  formulario.reset();
  gestor.limpar();
  $('dialogo-titulo').textContent = demanda ? 'Editar demanda' : 'Nova demanda';
  const tipoSelect = $('f-tipo');
  opcoes(tipoSelect, (demanda ? [demanda.tipo] : TIPOS_CADASTRAVEIS).map((t) => [t, TIPOS[t]]), demanda ? demanda.tipo : 'processo');
  tipoSelect.disabled = Boolean(demanda);
  opcoes($('f-status'), Object.entries(STATUS), demanda ? demanda.status : 'a_fazer');
  atualizarCamposDoTipo(tipoSelect.value);
  if (demanda) {
    $('f-origem').value = demanda.origem;
    for (const campo of ['titulo', 'processo', 'etapa', 'data_hora', 'local', 'publico', 'prazo', 'esforco_h', 'prazo_dias', 'horas_ponto']) {
      if (demanda[campo] !== undefined) $(`f-${campo}`).value = demanda[campo];
    }
  } else {
    $('f-prazo').value = hojeAtual();
  }
  dialogo.showModal();
  $('f-titulo').focus();
}

function enviarFormulario(evento) {
  evento.preventDefault();
  const entrada = Object.fromEntries(new FormData(formulario));
  const hoje = hojeAtual();
  try {
    if (editando) {
      const i = estado.dados.demandas.findIndex((d) => d.id === editando.id);
      estado.dados.demandas[i] = editarDemanda(editando, entrada, hoje);
      estado.focoApos = `editar-${editando.id}`;
    } else {
      const nova = criarDemanda(entrada, estado.dados.demandas, hoje);
      estado.dados.demandas.push(nova);
      estado.focoApos = `editar-${nova.id}`;
    }
  } catch (e) {
    if (!(e instanceof ErroCadastro)) throw e;
    gestor.mostrar(e.erros);
    return;
  }
  persistir();
  salvouNoDialogo = true;
  dialogo.close();
  atualizar();
}

// ---------- Início ----------

function acessarStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

async function iniciar() {
  campoData.value = hojeLocal();
  estado.atualizar = atualizar;
  estado.irParaDemanda = irParaDemanda;
  try {
    const resposta = await fetch('data/seed.json');
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
    estado.seed = await resposta.json();
  } catch {
    mostrarAviso('Não foi possível carregar data/seed.json. Abra o painel por "npm start" (não por arquivo local).');
    return;
  }

  estado.storage = acessarStorage();
  const carga = carregar(estado.storage, estado.seed);
  estado.dados = carga.dados;
  if (carga.origem === 'seed') persistir();

  opcoes(filtroTipo, [['', 'Todos'], ...Object.entries(TIPOS)], '');
  opcoes(filtroStatus, [['abertas', 'Abertas (ativas)'], ...Object.entries(STATUS)], 'abertas');
  opcoes(filtroPrioridade, [['', 'Todas'], ...FAIXAS.map((f) => [f, f])], '');

  $('usar-data-seed').textContent = `Usar data do exemplo (${formatarData(estado.seed.hoje_referencia)})`;
  $('usar-data-seed').addEventListener('click', () => {
    campoData.value = estado.seed.hoje_referencia;
    atualizar();
  });
  campoData.addEventListener('input', atualizar);
  for (const f of [filtroBusca, filtroTipo, filtroStatus, filtroPrioridade]) f.addEventListener('input', atualizar);
  $('filtros').addEventListener('submit', (e) => e.preventDefault());
  $('limpar-filtros').addEventListener('click', limparFiltros);
  $('fechar-indicador').addEventListener('click', fecharIndicador);
  for (const area of [$('indicadores'), $('painel-indicador')]) {
    area.addEventListener('keydown', (e) => { if (e.key === 'Escape') fecharIndicador(); });
  }

  $('nova-demanda').addEventListener('click', (e) => abrirFormulario(null, e.currentTarget));
  $('f-tipo').addEventListener('change', (e) => atualizarCamposDoTipo(e.target.value));
  $('f-data_hora').addEventListener('change', (e) => {
    if (!$('f-prazo').value && e.target.value) $('f-prazo').value = e.target.value.slice(0, 10);
  });
  formulario.addEventListener('submit', enviarFormulario);
  $('cancelar').addEventListener('click', () => dialogo.close());
  dialogo.addEventListener('close', () => {
    if (!salvouNoDialogo && gatilho?.isConnected) gatilho.focus();
    salvouNoDialogo = false;
  });

  iniciarOperacoes();
  iniciarAfastamentos();
  iniciarCalendario();
  iniciarExportacao();
  atualizar();
}

iniciar();
