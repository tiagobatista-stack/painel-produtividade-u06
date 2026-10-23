// Formulário "Editar ponto" (RF67 e RF68): os dados de um ponto de operação, a vistoria (situação e data, com aviso fora do período
// previsto), a etapa e os autos. Abre da aba Pontos e de cada linha da lista de pontos do painel da operação.
import { descreverEixo } from './coordenadas.js';
import { ErroCadastro } from './demandas.js';
import { autosDoPonto, relatorioDoPonto } from './indicadores.js';
import { normalizarMunicipio } from './municipios.js';
import { dentroDaJanela, editarPonto, vistoriaDoPonto } from './operacoes.js';
import { ETAPAS_PONTO, ROTULO_AUTO_SEM_TIPO, TIPOS_AUTO, VISTORIA_PONTO } from './rotulos.js';
import { $, criarGestorErros, elemento, estado, formatarData, hojeAtual, mostrarMensagem, opcoes, persistir } from './ui-comum.js';
import { abrirAuto as abrirRegistroDeAuto } from './ui-operacao.js';

const CAMPOS = [
  'municipio', 'nota', 'processo', 'codigo', 'imovel', 'area_ha', 'responsavel', 'endereco', 'latitude', 'longitude',
  'vistoria', 'data_vistoria', 'etapa', 'observacoes',
];
const dialogo = $('dialogo-ponto');
const formulario = $('formulario-ponto');
const gestor = criarGestorErros({
  resumo: $('pt-resumo-erros'),
  campos: CAMPOS,
  idCampo: (c) => `pt-${c}`,
  idErro: (c) => `pt-e-${c}`,
});

let aberto = null; // { idOperacao, numero }
let gatilho = null; // controle que abriu o formulário, para devolver o foco
let salvou = false;

const operacaoAberta = () => estado.dados.demandas.find((d) => d.id === aberto?.idOperacao);
const pontoAberto = () => operacaoAberta()?.pontos.find((p) => p.n === aberto?.numero);
const decimal = (v) => (Number.isFinite(v) ? String(v).replace('.', ',') : '');

// Sob cada campo de coordenada: o valor convertido, o hemisfério assumido e se cai fora de Mato Grosso (como no formulário da demanda).
function atualizarLinhasDeCoordenada() {
  for (const [campo, eixo] of [['latitude', 'y'], ['longitude', 'x']]) {
    const d = descreverEixo($(`pt-${campo}`).value, eixo);
    $(`pt-a-${campo}`).textContent = d
      ? [`= ${d.decimal}`, d.assumido && `hemisfério assumido: ${d.hemisferio}`, d.foraDeMT && 'fora de MT'].filter(Boolean).join(' · ')
      : '';
  }
}

function atualizarAvisoDeMunicipio() {
  const { naLista } = normalizarMunicipio($('pt-municipio').value, estado.municipios);
  $('pt-a-municipio').textContent = naLista === false ? 'fora da lista de MT' : '';
}

// A data da vistoria só aparece nas situações que a exigem; fora do período previsto da operação há só um aviso (reagendar é normal).
function atualizarDataDaVistoria() {
  const op = operacaoAberta();
  const precisa = ['programada', 'vistoriada'].includes($('pt-vistoria').value);
  $('pt-campo-data_vistoria').hidden = !precisa;
  const data = $('pt-data_vistoria').value;
  $('pt-a-data_vistoria').textContent =
    precisa && data && op && !dentroDaJanela(op, data) ? `fora do período previsto da operação (${formatarData(op.saida)} a ${formatarData(op.retorno)})` : '';
}

// Etapa e autos podem mudar por fora do formulário (o "Registrar auto" abre outro diálogo): esta parte é redesenhada sem mexer nos campos.
function desenharEtapaEAutos() {
  const op = operacaoAberta();
  const p = pontoAberto();
  if (!op || !p) return;
  const select = $('pt-etapa');
  if (p.etapa === 'planejado') {
    opcoes(select, [['planejado', 'Planejado (registre o retorno da operação)']], 'planejado');
    select.disabled = true;
  } else {
    opcoes(select, Object.entries(ETAPAS_PONTO).filter(([chave]) => chave !== 'planejado'), p.etapa);
    select.disabled = false;
  }
  const grupo = relatorioDoPonto(op, p.n);
  $('pt-d-etapa').textContent = grupo ? `Este ponto está no relatório ${grupo.id}: as etapas do relatório valem para todos os pontos dele; o auto é de cada ponto.` : '';

  const autos = autosDoPonto(p);
  const caixa = $('pt-autos');
  const itens = [];
  if (autos.length) {
    const lista = elemento('ul', 'autos');
    for (const a of autos) lista.append(elemento('li', 'auto', `${a.tipo ? TIPOS_AUTO[a.tipo] : ROTULO_AUTO_SEM_TIPO} · ${a.data ? formatarData(a.data) : 'sem data'}`));
    itens.push(lista);
  } else {
    itens.push(elemento('p', 'nota', 'Nenhum auto registrado.'));
  }
  if (p.etapa === 'relatorio_concluido' || p.etapa === 'auto_lavrado') {
    const registrar = elemento('button', '', autos.length ? 'Registrar outro auto' : 'Registrar auto');
    registrar.type = 'button';
    registrar.dataset.foco = `pt-auto-${op.id}-${p.n}`;
    registrar.addEventListener('click', () => abrirRegistroDeAuto(op, p, registrar));
    itens.push(registrar);
  }
  caixa.replaceChildren(...itens);
}

// Chamado a cada atualização da tela: mantém etapa e autos do formulário aberto em dia (por exemplo, depois de registrar um auto).
export function atualizarPontoAberto() {
  if (!dialogo.open || !aberto) return;
  desenharEtapaEAutos();
}

export function abrirFormularioDoPonto(idOperacao, numero, origemDoClique) {
  const op = estado.dados.demandas.find((d) => d.id === idOperacao);
  const p = op?.pontos.find((x) => x.n === numero);
  if (!p) return;
  aberto = { idOperacao, numero };
  gatilho = origemDoClique ?? null;
  salvou = false;
  formulario.reset();
  gestor.limpar();
  $('pt-titulo').textContent = `Editar ponto ${p.n}`;
  $('pt-contexto').textContent =
    `${op.titulo} · ${op.equipe} · período previsto ${formatarData(op.saida)} a ${formatarData(op.retorno)} · ponto ${p.n} de ${op.pontos.length}`;
  $('pt-municipio').value = p.municipio ?? '';
  for (const campo of ['nota', 'processo', 'codigo', 'imovel', 'responsavel', 'endereco', 'observacoes']) $(`pt-${campo}`).value = p[campo] ?? '';
  $('pt-area_ha').value = decimal(p.area_ha);
  $('pt-latitude').value = p.coord_y_texto ?? decimal(p.coord_y);
  $('pt-longitude').value = p.coord_x_texto ?? decimal(p.coord_x);
  opcoes($('pt-vistoria'), Object.entries(VISTORIA_PONTO), vistoriaDoPonto(p));
  $('pt-data_vistoria').value = p.vistoria_em ?? '';
  atualizarDataDaVistoria();
  atualizarAvisoDeMunicipio();
  atualizarLinhasDeCoordenada();
  desenharEtapaEAutos();
  dialogo.showModal();
  $('pt-municipio').focus();
}

function enviar(evento) {
  evento.preventDefault();
  const op = operacaoAberta();
  if (!op) return;
  const entrada = Object.fromEntries(new FormData(formulario)); // a etapa de um ponto planejado vem desabilitada e não entra
  const i = estado.dados.demandas.findIndex((d) => d.id === op.id);
  try {
    estado.dados.demandas[i] = editarPonto(op, aberto.numero, entrada, hojeAtual(), { municipios: estado.municipios });
  } catch (e) {
    if (!(e instanceof ErroCadastro)) throw e;
    gestor.mostrar(e.erros);
    return;
  }
  persistir();
  salvou = true;
  const numero = aberto.numero;
  estado.pontosAbertos.add(op.id);
  estado.focoApos = gatilho?.dataset.foco ?? null;
  dialogo.close();
  estado.atualizar();
  mostrarMensagem(`Ponto ${numero} atualizado.`);
}

export function iniciarFormularioDoPonto() {
  formulario.addEventListener('submit', enviar);
  $('pt-cancelar').addEventListener('click', () => dialogo.close());
  $('pt-fechar').addEventListener('click', () => dialogo.close());
  for (const id of ['pt-latitude', 'pt-longitude']) $(id).addEventListener('input', atualizarLinhasDeCoordenada);
  $('pt-municipio').addEventListener('input', atualizarAvisoDeMunicipio);
  $('pt-municipio').addEventListener('change', () => {
    $('pt-municipio').value = normalizarMunicipio($('pt-municipio').value, estado.municipios).valor;
    atualizarAvisoDeMunicipio();
  });
  $('pt-vistoria').addEventListener('change', () => {
    atualizarDataDaVistoria();
    if (!$('pt-campo-data_vistoria').hidden) $('pt-data_vistoria').focus();
  });
  $('pt-data_vistoria').addEventListener('input', atualizarDataDaVistoria);
  dialogo.addEventListener('close', () => {
    if (!salvou && gatilho?.isConnected) gatilho.focus();
    aberto = null;
    salvou = false;
  });
}
