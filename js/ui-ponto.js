// Formulário "Editar ponto" (RF67 e RF68): os dados de um ponto de operação, a vistoria (situação e data, com aviso fora do período
// previsto), a etapa e os autos. Abre da aba Pontos e de cada linha da lista de pontos do painel da operação.
import { descreverEixo, foraDeMatoGrosso, lerParDeCoordenadas, pareceInvertida } from './coordenadas.js';
import { ErroCadastro } from './demandas.js';
import { autosDoPonto, relatorioDoPonto } from './indicadores.js';
import { normalizarMunicipio } from './municipios.js';
import { dentroDaJanela, editarPonto, vistoriaDoPonto, vistoriasPermitidas } from './operacoes.js';
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

// Coordenada fora de Mato Grosso: aviso em vermelho; se parece latitude e longitude trocadas, o botão que troca; e, se a coordenada
// mudou neste formulário, a confirmação exigida ao salvar (a que já estava fora de MT não pede de novo).
function atualizarAvisoDeCoordenada() {
  const p = pontoAberto();
  const par = lerParDeCoordenadas($('pt-latitude').value, $('pt-longitude').value);
  let mensagem = '';
  let invertida = false;
  let pedeConfirmacao = false;
  if (!par.vazio && Object.keys(par.erros).length === 0 && foraDeMatoGrosso(par.latitude, par.longitude)) {
    invertida = pareceInvertida(par.latitude, par.longitude);
    mensagem = invertida
      ? 'Latitude e longitude parecem invertidas: com os valores trocados o ponto ficaria dentro de Mato Grosso.'
      : 'Coordenada fora de Mato Grosso (latitude de 7° a 18° S, longitude de 50° a 62° O). Confira os hemisférios.';
    const mudou = !(Math.abs((p?.coord_y ?? NaN) - par.latitude) < 1e-6 && Math.abs((p?.coord_x ?? NaN) - par.longitude) < 1e-6);
    pedeConfirmacao = mudou;
  }
  $('pt-aviso-coordenada').textContent = mensagem;
  $('pt-trocar').hidden = !invertida;
  $('pt-confirmar').hidden = !pedeConfirmacao;
  if (!pedeConfirmacao) $('pt-confirmar-fora-mt').checked = false;
  $('pt-bloco-coordenada').hidden = mensagem === '';
}

function trocarLatitudeELongitude() {
  const lat = $('pt-latitude');
  const lon = $('pt-longitude');
  [lat.value, lon.value] = [lon.value, lat.value];
  atualizarLinhasDeCoordenada();
  atualizarAvisoDeCoordenada();
  lat.focus();
}

// A vistoria acompanha a etapa: o select só oferece o que combina com a etapa escolhida (um ponto vistoriado não fica "a programar",
// nem um planejado "vistoriado"). Ao mudar a etapa, se a situação atual deixa de valer, passa a ser a primeira permitida.
function etapaEscolhida() {
  const select = $('pt-etapa');
  return select.disabled ? pontoAberto()?.etapa : select.value;
}

function desenharOpcoesDaVistoria({ inicial = false } = {}) {
  const p = pontoAberto();
  const op = operacaoAberta();
  if (!p || !op) return;
  const permitidas = vistoriasPermitidas(etapaEscolhida());
  const atual = inicial ? vistoriaDoPonto(p) : $('pt-vistoria').value;
  const escolha = permitidas.includes(atual) ? atual : permitidas[0];
  opcoes($('pt-vistoria'), permitidas.map((v) => [v, VISTORIA_PONTO[v]]), escolha);
  $('pt-a-vistoria').textContent = escolha !== atual ? 'A situação da vistoria acompanhou a etapa.' : '';
  if (escolha === 'vistoriada' && !$('pt-data_vistoria').value) $('pt-data_vistoria').value = p.vistoria_em ?? op.retorno;
  atualizarDataDaVistoria();
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
    // "Auto lavrado" não é escolha de seletor: vem pelo "Registrar auto", que pede o tipo do auto (aparece só para quem já tem auto).
    opcoes(select, Object.entries(ETAPAS_PONTO).filter(([chave]) => chave !== 'planejado' && (chave !== 'auto_lavrado' || p.etapa === 'auto_lavrado')), p.etapa);
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
  $('pt-data_vistoria').value = p.vistoria_em ?? '';
  $('pt-confirmar-fora-mt').checked = false;
  atualizarAvisoDeMunicipio();
  atualizarLinhasDeCoordenada();
  atualizarAvisoDeCoordenada();
  desenharEtapaEAutos();
  desenharOpcoesDaVistoria({ inicial: true });
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
  for (const id of ['pt-latitude', 'pt-longitude']) {
    $(id).addEventListener('input', () => {
      atualizarLinhasDeCoordenada();
      atualizarAvisoDeCoordenada();
    });
  }
  $('pt-trocar').addEventListener('click', trocarLatitudeELongitude);
  $('pt-etapa').addEventListener('change', () => desenharOpcoesDaVistoria());
  $('pt-municipio').addEventListener('input', atualizarAvisoDeMunicipio);
  $('pt-municipio').addEventListener('change', () => {
    $('pt-municipio').value = normalizarMunicipio($('pt-municipio').value, estado.municipios).valor;
    atualizarAvisoDeMunicipio();
  });
  $('pt-vistoria').addEventListener('change', () => {
    $('pt-a-vistoria').textContent = '';
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
