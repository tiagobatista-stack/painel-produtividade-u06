import { calcularIndicadores, relatoriosPendentes, autosALavrar, diasEntre, dataValida } from './indicadores.js';
import { ErroCadastro, TIPOS_CADASTRAVEIS, alterarStatus, criarDemanda, editarDemanda, listarDemandas, origensDoTipo } from './demandas.js';
import { carregar, salvar } from './armazenamento.js';
import { ORIGENS, STATUS, TIPOS } from './rotulos.js';

const INDICADORES = [
  ['abertas', 'Abertas'],
  ['vencidas', 'Vencidas'],
  ['proximos7', 'Próximos 7 dias'],
  ['relatoriosPendentes', 'Relatórios pendentes'],
  ['autosALavrar', 'Autos a lavrar'],
  ['concluidasSemana', 'Concluídas na semana'],
];
const FAIXAS = ['Crítica', 'Alta', 'Média', 'Baixa'];
const CAMPOS = ['tipo', 'titulo', 'origem', 'processo', 'etapa', 'data_hora', 'local', 'publico', 'prazo', 'status', 'esforco_h'];

const $ = (id) => document.getElementById(id);
const campoData = $('data-referencia');
const aviso = $('erro');
const dialogo = $('dialogo');
const formulario = $('formulario');
const resumoErros = $('resumo-erros');
const filtroBusca = $('filtro-busca');
const filtroTipo = $('filtro-tipo');
const filtroStatus = $('filtro-status');
const filtroPrioridade = $('filtro-prioridade');

let seed = null;
let dados = null; // { versao, demandas, afastamentos }
let storage = null;
let editando = null; // demanda em edição, ou null quando é nova
let gatilho = null; // elemento que abriu o formulário, para devolver o foco
let focoApos = null; // data-foco a restaurar após redesenhar
let salvouNoDialogo = false; // distingue salvar de cancelar ao fechar o formulário

function hojeLocal() {
  return new Date().toLocaleDateString('en-CA');
}

function hojeAtual() {
  return dataValida(campoData.value) ? campoData.value : hojeLocal();
}

function formatarData(iso) {
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

function textoPrazo(prazo, hoje) {
  if (prazo === null) return { texto: 'Sem prazo válido', vencida: false };
  const dias = diasEntre(hoje, prazo);
  if (dias < 0) return { texto: `${formatarData(prazo)} · vencida há ${-dias} ${dias === -1 ? 'dia' : 'dias'}`, vencida: true };
  if (dias === 0) return { texto: `${formatarData(prazo)} · vence hoje`, vencida: false };
  return { texto: `${formatarData(prazo)} · em ${dias} ${dias === 1 ? 'dia' : 'dias'}`, vencida: false };
}

function elemento(tag, classe, texto) {
  const el = document.createElement(tag);
  if (classe) el.className = classe;
  if (texto !== undefined) el.textContent = texto;
  return el;
}

function opcoes(select, pares, selecionado) {
  select.replaceChildren(...pares.map(([valor, rotulo]) => {
    const o = elemento('option', '', rotulo);
    o.value = valor;
    return o;
  }));
  if (selecionado !== undefined) select.value = selecionado;
}

function mostrarAviso(mensagem) {
  aviso.textContent = mensagem;
  aviso.hidden = !mensagem;
}

function persistir() {
  if (!salvar(storage, dados)) {
    mostrarAviso('Não foi possível salvar no navegador. As alterações valem só até recarregar a página.');
  }
}

// ---------- Indicadores e fila ----------

function desenharIndicadores(valores) {
  $('indicadores').replaceChildren(
    ...INDICADORES.map(([chave, rotulo]) => {
      const li = elemento('li', 'indicador');
      li.append(elemento('span', 'indicador-valor', String(valores[chave])), elemento('span', 'indicador-rotulo', rotulo));
      return li;
    })
  );
}

function classeFaixa(faixa) {
  return `faixa-${faixa.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()}`;
}

function cartao(item, hoje) {
  const { demanda: d, prazo, score, faixa, motivos, concluida } = item;
  const info = textoPrazo(prazo, hoje);
  const classes = ['demanda'];
  if (faixa) classes.push(classeFaixa(faixa));
  if (concluida) classes.push('concluida');
  if (info.vencida && !concluida) classes.push('vencida');
  const li = elemento('li', classes.join(' '));

  const topo = elemento('div', 'demanda-topo');
  topo.append(elemento('span', 'etiqueta', TIPOS[d.tipo]), elemento('span', 'status', STATUS[d.status]));
  li.append(topo, elemento('h3', 'demanda-titulo', d.titulo));

  if (concluida) {
    li.append(elemento('p', 'prioridade', d.concluida_em ? `Concluída em ${formatarData(d.concluida_em)}` : 'Concluída'));
  } else {
    li.append(elemento('p', 'prioridade', `Prioridade ${faixa} · ${score} pontos`));
  }
  li.append(elemento('p', 'demanda-detalhe', `Origem: ${ORIGENS[d.origem]}`));
  if (!concluida) li.append(elemento('p', 'demanda-prazo', `Prazo: ${info.texto}`));
  if (d.processo) li.append(elemento('p', 'demanda-detalhe', `Processo ${d.processo}${d.etapa ? ` · etapa: ${d.etapa.replaceAll('_', ' ')}` : ''}`));
  if (d.data_hora) {
    const [dia, hora] = d.data_hora.split('T');
    li.append(elemento('p', 'demanda-detalhe', `${formatarData(dia)} às ${hora} · ${d.local}${d.publico !== undefined ? ` · ${d.publico} pessoas` : ''}`));
  }
  if (d.tipo === 'operacao') {
    const pend = relatoriosPendentes(d);
    const autos = autosALavrar(d);
    li.append(elemento('p', 'demanda-detalhe', `${pend} ${pend === 1 ? 'relatório pendente' : 'relatórios pendentes'} · ${autos} ${autos === 1 ? 'auto a lavrar' : 'autos a lavrar'}`));
  }

  if (motivos) {
    const detalhes = elemento('details', 'motivos');
    const lista = elemento('ul');
    lista.append(...motivos.map((m) => elemento('li', '', m)));
    detalhes.append(elemento('summary', '', 'Por que esta prioridade?'), lista);
    li.append(detalhes);
  }

  if (d.historico?.length) {
    const detalhes = elemento('details', 'motivos');
    const lista = elemento('ul');
    lista.append(...d.historico.map((h) => elemento('li', '', `${formatarData(h.data)} — ${h.evento}`)));
    detalhes.append(elemento('summary', '', `Histórico (${d.historico.length})`), lista);
    li.append(detalhes);
  }

  if (d.tipo !== 'operacao') {
    const acoes = elemento('div', 'acoes-cartao');
    const rotulo = elemento('label', 'rotulo-status', 'Status');
    const select = elemento('select');
    select.id = `status-${d.id}`;
    rotulo.htmlFor = select.id;
    select.dataset.foco = `status-${d.id}`;
    opcoes(select, Object.entries(STATUS), d.status);
    select.addEventListener('change', () => mudarStatus(d.id, select.value));
    const editar = elemento('button', '', 'Editar');
    editar.type = 'button';
    editar.dataset.foco = `editar-${d.id}`;
    editar.setAttribute('aria-label', `Editar ${d.titulo}`);
    editar.addEventListener('click', () => abrirFormulario(d, editar));
    acoes.append(rotulo, select, editar);
    li.append(acoes);
  }
  return li;
}

function filtrosAtuais() {
  return { busca: filtroBusca.value, tipo: filtroTipo.value, status: filtroStatus.value, prioridade: filtroPrioridade.value };
}

function desenharFila(hoje) {
  const { itens, erros } = listarDemandas(dados.demandas, filtrosAtuais(), hoje, { afastamentos: dados.afastamentos });
  $('fila-vazia').hidden = itens.length > 0;
  $('contagem').textContent = `${itens.length} ${itens.length === 1 ? 'demanda' : 'demandas'}`;
  $('fila').replaceChildren(...itens.map((item) => cartao(item, hoje)));
  $('erros-validacao').hidden = erros.length === 0;
  $('lista-erros').replaceChildren(...erros.map((x) => elemento('li', '', `${x.demanda.id || '(sem id)'} — ${x.demanda.titulo || ''}: ${x.erro}`)));
}

function atualizar() {
  const hoje = hojeAtual();
  desenharIndicadores(calcularIndicadores(dados.demandas, hoje));
  desenharFila(hoje);
  if (focoApos) {
    document.querySelector(`[data-foco="${focoApos}"]`)?.focus();
    focoApos = null;
  }
}

function mudarStatus(id, novoStatus) {
  const i = dados.demandas.findIndex((d) => d.id === id);
  try {
    dados.demandas[i] = alterarStatus(dados.demandas[i], novoStatus, hojeAtual());
  } catch (e) {
    if (!(e instanceof ErroCadastro)) throw e;
    mostrarAviso(Object.values(e.erros)[0]);
    return;
  }
  persistir();
  focoApos = `status-${id}`;
  atualizar();
}

// ---------- Formulário ----------

function atualizarCamposDoTipo(tipo) {
  for (const campo of formulario.querySelectorAll('[data-tipos]')) {
    campo.hidden = !campo.dataset.tipos.split(' ').includes(tipo);
  }
  const atual = $('f-origem').value;
  const validas = origensDoTipo(tipo);
  opcoes($('f-origem'), validas.map((o) => [o, ORIGENS[o]]), validas.includes(atual) ? atual : validas[0]);
}

function limparErros() {
  resumoErros.hidden = true;
  resumoErros.replaceChildren();
  for (const campo of CAMPOS) {
    $(`e-${campo}`).textContent = '';
    const input = $(`f-${campo}`);
    input.removeAttribute('aria-invalid');
    input.removeAttribute('aria-describedby');
  }
}

function mostrarErros(erros) {
  limparErros();
  const lista = elemento('ul');
  let primeiro = null;
  for (const campo of CAMPOS.filter((c) => c in erros)) {
    $(`e-${campo}`).textContent = erros[campo];
    const input = $(`f-${campo}`);
    input.setAttribute('aria-invalid', 'true');
    input.setAttribute('aria-describedby', `e-${campo}`);
    lista.append(elemento('li', '', erros[campo]));
    primeiro ??= input;
  }
  resumoErros.append(elemento('strong', '', 'Corrija os campos abaixo:'), lista);
  resumoErros.hidden = false;
  (primeiro && !primeiro.closest('[hidden]') ? primeiro : resumoErros).focus();
}

function abrirFormulario(demanda, origemDoClique) {
  editando = demanda;
  gatilho = origemDoClique;
  formulario.reset();
  limparErros();
  $('dialogo-titulo').textContent = demanda ? 'Editar demanda' : 'Nova demanda';
  const tipoSelect = $('f-tipo');
  opcoes(tipoSelect, (demanda ? [demanda.tipo] : TIPOS_CADASTRAVEIS).map((t) => [t, TIPOS[t]]), demanda ? demanda.tipo : 'processo');
  tipoSelect.disabled = Boolean(demanda);
  opcoes($('f-status'), Object.entries(STATUS), demanda ? demanda.status : 'a_fazer');
  atualizarCamposDoTipo(tipoSelect.value);
  if (demanda) {
    $('f-origem').value = demanda.origem;
    for (const campo of ['titulo', 'processo', 'etapa', 'data_hora', 'local', 'publico', 'prazo', 'esforco_h']) {
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
      const i = dados.demandas.findIndex((d) => d.id === editando.id);
      dados.demandas[i] = editarDemanda(editando, entrada, hoje);
      focoApos = `editar-${editando.id}`;
    } else {
      const nova = criarDemanda(entrada, dados.demandas, hoje);
      dados.demandas.push(nova);
      focoApos = `editar-${nova.id}`;
    }
  } catch (e) {
    if (!(e instanceof ErroCadastro)) throw e;
    mostrarErros(e.erros);
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
  try {
    const resposta = await fetch('data/seed.json');
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
    seed = await resposta.json();
  } catch {
    mostrarAviso('Não foi possível carregar data/seed.json. Abra o painel por "npm start" (não por arquivo local).');
    return;
  }

  storage = acessarStorage();
  const carga = carregar(storage, seed);
  dados = carga.dados;
  if (carga.origem === 'seed') persistir();

  opcoes(filtroTipo, [['', 'Todos'], ...Object.entries(TIPOS)], '');
  opcoes(filtroStatus, [['abertas', 'Abertas (todas)'], ...Object.entries(STATUS)], 'abertas');
  opcoes(filtroPrioridade, [['', 'Todas'], ...FAIXAS.map((f) => [f, f])], '');

  $('usar-data-seed').textContent = `Usar data do exemplo (${formatarData(seed.hoje_referencia)})`;
  $('usar-data-seed').addEventListener('click', () => {
    campoData.value = seed.hoje_referencia;
    atualizar();
  });
  campoData.addEventListener('input', atualizar);
  for (const f of [filtroBusca, filtroTipo, filtroStatus, filtroPrioridade]) f.addEventListener('input', atualizar);

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

  atualizar();
}

iniciar();
