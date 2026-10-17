// Interface do formulário de demanda (nova e edição): campos por tipo, prévia da prioridade calculada e anotações.
import { linkParaLocalizar } from './camadas-mapa.js';
import { lerParDeCoordenadas } from './coordenadas.js';
import { ErroCadastro, TIPOS_CADASTRAVEIS, criarDemanda, editarDemanda, origensDoTipo } from './demandas.js';
import { ErroValidacao, priorizar } from './regras.js';
import { ETAPAS, ORIGENS, PRIORIDADE_MANUAL, STATUS, TIPOS } from './rotulos.js';
import { $, abrirEmNovaAba, criarGestorErros, estado, hojeAtual, opcoes, persistir } from './ui-comum.js';
import { criarEditorAnotacoes } from './ui-anotacoes.js';

const CAMPOS = [
  'tipo', 'origem', 'titulo', 'descricao', 'status', 'prioridade_manual', 'motivo_ajuste', 'responsavel', 'prazo', 'municipio', 'protocolo',
  'data_hora', 'local', 'publico', 'etapa', 'esforco_h', 'prazo_dias', 'horas_ponto', 'endereco', 'latitude', 'longitude', 'anotacoes',
];
const CAMPOS_DE_TEXTO = [
  'titulo', 'descricao', 'responsavel', 'municipio', 'protocolo', 'data_hora', 'local', 'publico', 'prazo', 'esforco_h', 'prazo_dias', 'horas_ponto', 'motivo_ajuste', 'endereco',
];

const dialogo = $('dialogo');
const formulario = $('formulario');
const gestor = criarGestorErros({
  resumo: $('resumo-erros'),
  campos: CAMPOS,
  idCampo: (c) => (c === 'anotacoes' ? 'f-anotacao-nova' : `f-${c}`),
  idErro: (c) => `e-${c}`,
  idDica: (c) => `d-${c}`,
});
const anotacoes = criarEditorAnotacoes();

let editando = null; // demanda em edição, ou null quando é nova
let gatilho = null; // elemento que abriu o formulário, para devolver o foco
let salvouNoDialogo = false; // distingue salvar de cancelar ao fechar o formulário

// ---------- Prévia da prioridade calculada (sempre a calculada, mesmo com ajuste manual) ----------

function rascunho() {
  const tipo = $('f-tipo').value;
  if (editando?.tipo === 'operacao') {
    const dias = $('f-prazo_dias').value.trim();
    return { ...editando, origem: $('f-origem').value, prazo_dias: dias === '' ? NaN : Number(dias) };
  }
  return { id: 'previa', tipo, origem: $('f-origem').value, prazo: $('f-prazo').value, status: $('f-status').value };
}

function atualizarPrevia() {
  const previa = $('previa-prioridade');
  const linhas = [];
  try {
    const r = priorizar(rascunho(), hojeAtual(), { afastamentos: estado.dados.afastamentos });
    if (r.sobrestada) linhas.push(['Sobrestada: o prazo está suspenso e a demanda fica fora da fila.']);
    else if (r.foraDaFila) linhas.push(['Concluída: fora da fila de prioridades.']);
    else linhas.push([`Prioridade calculada: ${r.faixa} · ${r.score}`, r.motivos.join(' · ')]);
  } catch (e) {
    if (!(e instanceof ErroValidacao)) throw e;
    linhas.push(['Prioridade calculada: informe o prazo para calcular.']);
  }
  const manual = PRIORIDADE_MANUAL[$('f-prioridade_manual').value];
  if (manual) linhas.push([`Ajuste manual: ${manual}. A faixa manual define a posição na fila; o score calculado continua valendo dentro dela.`]);
  previa.replaceChildren(...linhas.map(([forte, resto]) => {
    const bloco = document.createElement('div');
    const negrito = document.createElement('strong');
    negrito.textContent = forte;
    bloco.append(negrito);
    if (resto) {
      const detalhe = document.createElement('span');
      detalhe.textContent = resto;
      bloco.append(detalhe);
    }
    return bloco;
  }));
}

// ---------- Campos ----------

function atualizarCamposDoTipo(tipo) {
  for (const campo of formulario.querySelectorAll('[data-tipos]')) {
    campo.hidden = !campo.dataset.tipos.split(' ').includes(tipo);
  }
  atualizarAvisosDeCoordenada();
  const atual = $('f-origem').value;
  const validas = origensDoTipo(tipo);
  opcoes($('f-origem'), validas.map((o) => [o, ORIGENS[o]]), validas.includes(atual) ? atual : validas[0]);
  const etapas = ETAPAS[tipo];
  if (etapas) opcoes($('f-etapa'), [['', 'Sem etapa'], ...Object.entries(etapas)], '');
}

// Avisos de coordenada enquanto se digita (hemisfério assumido, ponto fora de Mato Grosso). Os erros só aparecem ao salvar.
function atualizarAvisosDeCoordenada() {
  const { avisos } = lerParDeCoordenadas($('f-latitude').value, $('f-longitude').value);
  const caixa = $('avisos-coordenada');
  caixa.replaceChildren(...avisos.map((aviso) => {
    const linha = document.createElement('span');
    linha.textContent = aviso;
    linha.className = 'aviso-linha';
    return linha;
  }));
  caixa.hidden = avisos.length === 0 || $('f-latitude').closest('[data-tipos]').hidden;
}

// "Localizar": abre o OpenStreetMap em nova aba (a página não faz requisição). Coordenadas inválidas são mostradas, não ignoradas.
function localizar() {
  const par = lerParDeCoordenadas($('f-latitude').value, $('f-longitude').value);
  if (!par.vazio && Object.keys(par.erros).length) {
    gestor.mostrar(par.erros);
    return;
  }
  const url = linkParaLocalizar({ latitude: par.latitude, longitude: par.longitude, endereco: $('f-endereco').value });
  if (!url) {
    gestor.mostrar({ endereco: 'Informe o endereço ou as coordenadas para localizar.' });
    return;
  }
  abrirEmNovaAba(url);
}

function atualizarMotivo() {
  $('campo-motivo').hidden = $('f-prioridade_manual').value === '';
}

export function abrirFormulario(demanda, origemDoClique) {
  editando = demanda;
  gatilho = origemDoClique;
  formulario.reset();
  gestor.limpar();
  $('dialogo-titulo').textContent = demanda ? 'Editar demanda' : 'Nova demanda';
  const tipoSelect = $('f-tipo');
  opcoes(tipoSelect, (demanda ? [demanda.tipo] : TIPOS_CADASTRAVEIS).map((t) => [t, TIPOS[t]]), demanda ? demanda.tipo : 'processo');
  tipoSelect.disabled = Boolean(demanda);
  opcoes($('f-status'), Object.entries(STATUS), demanda ? demanda.status : 'a_fazer');
  opcoes($('f-prioridade_manual'), [['', 'Automática (calculada)'], ...Object.entries(PRIORIDADE_MANUAL)], '');
  atualizarCamposDoTipo(tipoSelect.value);
  if (demanda) {
    // Latitude e longitude voltam como foram digitadas; sem o texto, o decimal gravado.
    const decimal = (v) => (Number.isFinite(v) ? String(v).replace('.', ',') : '');
    $('f-latitude').value = demanda.coord_y_texto ?? decimal(demanda.coord_y);
    $('f-longitude').value = demanda.coord_x_texto ?? decimal(demanda.coord_x);
    $('f-origem').value = demanda.origem;
    for (const campo of CAMPOS_DE_TEXTO) {
      if (demanda[campo] !== undefined) $(`f-${campo}`).value = demanda[campo];
    }
    if (demanda.etapa) $('f-etapa').value = demanda.etapa;
    $('f-prioridade_manual').value = demanda.prioridade_manual ?? '';
  }
  // Demanda nova começa sem prazo: a data de referência não é um padrão.
  atualizarMotivo();
  atualizarAvisosDeCoordenada();
  anotacoes.carregar(demanda?.anotacoes ?? []);
  atualizarPrevia();
  dialogo.showModal();
  $('f-titulo').focus();
}

function enviarFormulario(evento) {
  evento.preventDefault();
  const entrada = { ...Object.fromEntries(new FormData(formulario)), anotacoes: anotacoes.obter() };
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
  estado.atualizar();
}

export function iniciarFormulario() {
  $('nova-demanda').addEventListener('click', (e) => abrirFormulario(null, e.currentTarget));
  $('f-tipo').addEventListener('change', (e) => atualizarCamposDoTipo(e.target.value));
  $('f-prioridade_manual').addEventListener('change', () => {
    atualizarMotivo();
    if (!$('campo-motivo').hidden) $('f-motivo_ajuste').focus();
  });
  $('f-data_hora').addEventListener('change', (e) => {
    if (!$('f-prazo').value && e.target.value) $('f-prazo').value = e.target.value.slice(0, 10);
  });
  formulario.addEventListener('input', atualizarPrevia);
  for (const id of ['f-latitude', 'f-longitude']) $(id).addEventListener('input', atualizarAvisosDeCoordenada);
  $('f-localizar').addEventListener('click', localizar);
  formulario.addEventListener('change', atualizarPrevia);
  formulario.addEventListener('submit', enviarFormulario);
  $('cancelar').addEventListener('click', () => dialogo.close());
  $('fechar-dialogo').addEventListener('click', () => dialogo.close());
  dialogo.addEventListener('cancel', (e) => {
    // Esc durante a edição de uma anotação só cancela a edição, não fecha o formulário.
    if (anotacoes.editando()) {
      e.preventDefault();
      anotacoes.cancelarEdicaoAtual();
    }
  });
  dialogo.addEventListener('close', () => {
    anotacoes.encerrar();
    if (!salvouNoDialogo && gatilho?.isConnected) gatilho.focus();
    salvouNoDialogo = false;
  });
}
