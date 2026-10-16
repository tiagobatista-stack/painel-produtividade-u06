import { calcularIndicadores, estaConcluida, estaSobrestada } from './indicadores.js';
import { ErroCadastro, FILTROS_PADRAO, TIPOS_CADASTRAVEIS, alterarStatus, criarDemanda, editarDemanda, filtrosEmUso, listarDemandas, origensDoTipo, removerDemanda, restaurarDemanda } from './demandas.js';
import { carregar } from './armazenamento.js';
import { FILTRO_PRAZO, ORIGENS, STATUS, TIPOS } from './rotulos.js';
import {
  $, classeFaixa, criarGestorErros, elemento, estado, formatarData, hojeAtual, hojeLocal, mostrarAviso, mostrarMensagem, opcoes, persistir, restaurarFoco, textoPrazo,
} from './ui-comum.js';
import { iniciarOperacoes } from './ui-operacao.js';
import { desenharAfastamentos, desenharAgenda, desenharBanner, iniciarAfastamentos } from './ui-afastamentos.js';
import { desenharResumo, iniciarExportacao } from './ui-exportacao.js';
import { desenharCalendario, iniciarCalendario } from './ui-calendario.js';
import { abrirAba, iniciarAbas } from './ui-abas.js';
import { desenharFoco } from './ui-foco.js';
import { abrirPainel, desenharPainel, fecharPainel, iniciarPainel } from './ui-painel.js';

const INDICADORES = [
  ['vencidas', 'Vencidas'],
  ['proximos7', 'Próximos 7 dias'],
  ['sobrestados', 'Sobrestados'],
  ['concluidasSemana', 'Concluídas na semana'],
];
const COMPLEMENTARES = [
  ['abertas', 'Abertas'],
  ['relatoriosPendentes', 'Relatórios pendentes'],
  ['autosALavrar', 'Autos a lavrar'],
];
// Filtro que cada indicador aplica na fila.
const FILTRO_DO_INDICADOR = {
  vencidas: { status: 'abertas', prazo: 'vencidas' },
  proximos7: { status: 'abertas', prazo: 'proximos7' },
  sobrestados: { status: 'aguardando', prazo: '' },
  concluidasSemana: { status: 'concluida', prazo: 'semana' },
};
const FAIXAS = ['Crítica', 'Alta', 'Média', 'Baixa'];
const CAMPOS = ['tipo', 'titulo', 'origem', 'processo', 'etapa', 'data_hora', 'local', 'publico', 'prazo', 'status', 'esforco_h', 'prazo_dias', 'horas_ponto'];

const campoData = $('data-referencia');
const dialogo = $('dialogo');
const formulario = $('formulario');
const filtroBusca = $('filtro-busca');
const filtroTipo = $('filtro-tipo');
const filtroStatus = $('filtro-status');
const filtroPrioridade = $('filtro-prioridade');
const filtroPrazo = $('filtro-prazo');
const gestor = criarGestorErros({ resumo: $('resumo-erros'), campos: CAMPOS, idCampo: (c) => `f-${c}`, idErro: (c) => `e-${c}` });

let editando = null; // demanda em edição, ou null quando é nova
let gatilho = null; // elemento que abriu o formulário, para devolver o foco
let salvouNoDialogo = false; // distingue salvar de cancelar ao fechar o formulário

// ---------- Indicadores e fila ----------

// Os 4 indicadores em destaque são botões: cada um filtra a fila (e zera busca, tipo e prioridade, para a lista bater com o número).
function desenharIndicadores(valores) {
  const ativo = indicadorAtivo();
  $('indicadores').replaceChildren(
    ...INDICADORES.map(([chave, rotulo]) => {
      const valor = valores[chave];
      const botao = elemento('button', chave === 'vencidas' && valor > 0 ? 'indicador indicador-alerta' : 'indicador');
      botao.type = 'button';
      botao.dataset.foco = `indicador-${chave}`;
      botao.setAttribute('aria-label', `${rotulo}: ${valor}`);
      botao.setAttribute('aria-pressed', String(ativo === chave));
      botao.append(elemento('span', 'indicador-valor', String(valor)), elemento('span', 'indicador-rotulo', rotulo));
      botao.addEventListener('click', () => clicarIndicador(chave));
      const li = elemento('li');
      li.append(botao);
      return li;
    })
  );
  // Os demais indicadores ficam na aba Relatórios, só para leitura.
  $('indicadores-relatorio').replaceChildren(
    ...COMPLEMENTARES.map(([chave, rotulo]) => {
      const li = elemento('li', 'indicador');
      li.append(elemento('span', 'indicador-valor', String(valores[chave])), elemento('span', 'indicador-rotulo', rotulo));
      return li;
    })
  );
}

// Qual indicador está aplicado agora? Só conta quando os filtros são exatamente os dele.
function indicadorAtivo() {
  const f = filtrosAtuais();
  if (f.busca.trim() !== '' || f.tipo !== '' || f.prioridade !== '') return null;
  return INDICADORES.map(([chave]) => chave).find((chave) => FILTRO_DO_INDICADOR[chave].status === f.status && FILTRO_DO_INDICADOR[chave].prazo === f.prazo) ?? null;
}

function aplicarFiltros({ busca = '', tipo = '', status = FILTROS_PADRAO.status, prioridade = '', prazo = '' }) {
  filtroBusca.value = busca;
  filtroTipo.value = tipo;
  filtroStatus.value = status;
  filtroPrioridade.value = prioridade;
  filtroPrazo.value = prazo;
}

// Clicar no indicador aplica o filtro; clicar de novo volta ao padrão.
function clicarIndicador(chave) {
  aplicarFiltros(indicadorAtivo() === chave ? FILTROS_PADRAO : FILTRO_DO_INDICADOR[chave]);
  estado.focoApos = `indicador-${chave}`;
  atualizar();
}

// Leva ao cartão da demanda na fila: abre o Quadro, ajusta os filtros para que ele apareça, rola até ele, destaca e põe o foco nele.
function irParaDemanda(id) {
  const d = estado.dados.demandas.find((x) => x.id === id);
  if (!d) return;
  let status = FILTROS_PADRAO.status;
  if (estaConcluida(d)) status = 'concluida';
  else if (estaSobrestada(d)) status = 'aguardando';
  aplicarFiltros({ status });
  abrirAba('quadro');
  estado.focoApos = `cartao-${id}`;
  atualizar();
  const alvo = document.querySelector(`[data-foco="cartao-${id}"]`);
  if (!alvo) return;
  alvo.scrollIntoView({ block: 'center' });
  alvo.classList.add('destaque');
  setTimeout(() => alvo.classList.remove('destaque'), 2500);
}

// Card compacto: tipo, título, faixa (cor na borda e em texto) e prazo relativo. Todo o resto está no painel lateral.
function cartao(item, hoje) {
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
  botao.addEventListener('click', () => abrirPainel(d.id, botao));
  li.append(botao);
  return li;
}

function filtrosAtuais() {
  return { busca: filtroBusca.value, tipo: filtroTipo.value, status: filtroStatus.value, prioridade: filtroPrioridade.value, prazo: filtroPrazo.value };
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
  desenharFoco(hoje);
  desenharIndicadores(calcularIndicadores(estado.dados.demandas, hoje));
  desenharResumo(hoje);
  desenharCalendario(hoje);
  desenharAgenda(hoje);
  desenharFila(hoje);
  desenharAfastamentos(hoje);
  desenharPainel(hoje);
  restaurarFoco();
}

// Volta busca, tipo, status e prioridade ao padrão. Não apaga demandas nem mexe na data de referência.
function limparFiltros() {
  filtroBusca.value = FILTROS_PADRAO.busca;
  filtroTipo.value = FILTROS_PADRAO.tipo;
  filtroStatus.value = FILTROS_PADRAO.status;
  filtroPrioridade.value = FILTROS_PADRAO.prioridade;
  filtroPrazo.value = FILTROS_PADRAO.prazo;
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

// Exclui sem pedir confirmação: por cerca de 8 s a mensagem oferece "Desfazer" (a demanda volta à mesma posição, com os pontos).
// Só a última exclusão pode ser desfeita, e o prazo acaba ao recarregar a página.
function excluirDemanda(d) {
  const indice = estado.dados.demandas.findIndex((x) => x.id === d.id);
  if (indice < 0) return;
  fecharPainel(false);
  estado.dados.demandas = removerDemanda(estado.dados.demandas, d.id);
  persistir();
  mostrarMensagem('Demanda excluída.', { acao: { rotulo: 'Desfazer', fazer: () => desfazerExclusao(d, indice) } });
  estado.focoApos = 'desfazer';
  atualizar();
}

function desfazerExclusao(d, indice) {
  try {
    estado.dados.demandas = restaurarDemanda(estado.dados.demandas, d, indice);
  } catch (e) {
    if (!(e instanceof ErroCadastro)) throw e;
    mostrarAviso(Object.values(e.erros)[0]);
    return;
  }
  mostrarAviso('');
  persistir();
  mostrarMensagem('Demanda restaurada.');
  estado.focoApos = `abrir-${d.id}`;
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
      estado.focoApos = document.querySelector(`[data-foco="editar-${editando.id}"]`) ? `editar-${editando.id}` : `abrir-${editando.id}`;
    } else {
      const nova = criarDemanda(entrada, estado.dados.demandas, hoje);
      estado.dados.demandas.push(nova);
      estado.focoApos = `abrir-${nova.id}`;
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
  iniciarAbas(); // antes de carregar os dados: abrir direto em #relatorios não pisca o Quadro
  estado.atualizar = atualizar;
  estado.irParaDemanda = irParaDemanda;
  estado.abrirPainel = abrirPainel;
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
  opcoes(filtroPrazo, Object.entries(FILTRO_PRAZO), '');

  $('usar-data-seed').textContent = `Usar data do exemplo (${formatarData(estado.seed.hoje_referencia)})`;
  $('usar-data-seed').addEventListener('click', () => {
    campoData.value = estado.seed.hoje_referencia;
    atualizar();
  });
  campoData.addEventListener('input', atualizar);
  for (const f of [filtroBusca, filtroTipo, filtroStatus, filtroPrioridade, filtroPrazo]) f.addEventListener('input', atualizar);
  $('filtros').addEventListener('submit', (e) => e.preventDefault());
  $('limpar-filtros').addEventListener('click', limparFiltros);

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
  iniciarPainel({ editar: (d, botao) => abrirFormulario(d, botao), excluir: excluirDemanda, mudarStatus });
  iniciarExportacao();
  atualizar();
}

iniciar();
