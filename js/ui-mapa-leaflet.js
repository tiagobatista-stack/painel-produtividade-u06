// Mapa com camadas (OpenStreetMap ou satélite) sobre o Leaflet local (vendor/leaflet, carregado pelo index.html).
// Só é usado quando o usuário escolhe uma camada: sem escolha, nenhum pedido de blocos sai da página.
// Popups e textos são montados com nós DOM e textContent (nada interpretado como HTML), e o estilo vai por classe CSS.
import { CAMADAS_EXTERNAS, ROTULOS_CAMADA } from './camadas-mapa.js';
import { coordenadaDecimal, coordenadaEmGms } from './coordenadas.js';
import { chaveDoConjunto, limitesDosMarcadores } from './mapa.js';
import { SITUACOES_PONTO } from './rotulos.js';
import { $, classeFaixa, elemento, estado, hojeAtual, mostrarAviso, mostrarMensagem, textoPrazo } from './ui-comum.js';

const SVG = 'http://www.w3.org/2000/svg';
const VISTA_INICIAL = [[-13, -56], 5]; // Mato Grosso, até haver marcadores para enquadrar
const ERROS_ATE_DESISTIR = 3;
const LETRA_DA_FAIXA = { Crítica: 'C', Alta: 'A', Média: 'M', Baixa: 'B' };

let mapa = null;
let base = null;
let baseChave = null;
let grupo = null;
let marcadoresAtuais = '';
let conjuntoAtual = null;
let pontoFixado = null;
let marcaFixa = null;

export const leafletDisponivel = () => typeof window.L?.map === 'function';

const no = (tag, atributos = {}, texto) => {
  const el = document.createElementNS(SVG, tag);
  for (const [chave, valor] of Object.entries(atributos)) el.setAttribute(chave, String(valor));
  if (texto !== undefined) el.textContent = texto;
  return el;
};

const escapar = (texto) => texto.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// O Leaflet recebe a atribuição como texto HTML: aqui vem só da configuração fixa e é escapada.
function atribuicao(partes) {
  return partes
    .map((p) => (p.ligacao ? `<a href="${escapar(p.ligacao)}" target="_blank" rel="noopener noreferrer">${escapar(p.texto)}</a>` : escapar(p.texto)))
    .join('');
}

// ---- Marcadores ----
function forma(m, formaDoPonto) {
  if (m.tipo === 'ponto') return formaDoPonto(m.situacao);
  const classes = `marcador-forma forma-demanda demanda-${classeFaixa(m.faixa ?? 'sem')}`;
  const g = no('g');
  g.append(no('polygon', { class: classes, points: '0,-12 10.4,-6 10.4,6 0,12 -10.4,6 -10.4,-6' }));
  g.append(no('text', { class: 'marcador-letra', x: 0, y: 4.5, 'text-anchor': 'middle' }, LETRA_DA_FAIXA[m.faixa] ?? '–'));
  return g;
}

function descricao(m) {
  if (m.tipo === 'ponto') return `${m.titulo}, operação ${m.subtitulo}: ${SITUACOES_PONTO[m.situacao]}`;
  return `Demanda ${m.titulo}${m.faixa ? `, prioridade ${m.faixa}` : ''}`;
}

function icone(m, formaDoPonto) {
  const svg = no('svg', { class: 'marcador-svg', viewBox: '-14 -14 28 28', width: 28, height: 28, 'aria-hidden': 'true', focusable: 'false' });
  svg.append(forma(m, formaDoPonto));
  return window.L.divIcon({ html: svg, className: 'marcador-leaflet', iconSize: [28, 28], iconAnchor: [14, 14], popupAnchor: [0, -14] });
}

function linhaDoPopup(rotulo, valor) {
  const linha = elemento('p', 'popup-linha');
  linha.append(elemento('span', 'popup-rotulo', `${rotulo}: `), document.createTextNode(valor));
  return linha;
}

function conteudoDoPopup(m, gatilho) {
  const div = elemento('div', 'popup-mapa');
  div.append(elemento('strong', 'popup-titulo', m.titulo));
  if (m.subtitulo) div.append(elemento('p', 'popup-sub', m.subtitulo));
  div.append(linhaDoPopup(m.tipo === 'ponto' ? 'Prioridade da operação' : 'Prioridade', m.faixa ?? '—'));
  div.append(linhaDoPopup(m.tipo === 'ponto' ? 'Prazo dos relatórios' : 'Prazo', m.prazo ? textoPrazo(m.prazo, hojeAtual()).texto : '—'));
  div.append(linhaDoPopup(m.tipo === 'ponto' ? 'Etapa' : 'Situação', m.etapa ?? '—'));
  const abrir = elemento('button', 'popup-abrir', 'Abrir no painel');
  abrir.type = 'button';
  abrir.setAttribute('aria-haspopup', 'dialog');
  abrir.addEventListener('click', () => {
    mapa.closePopup();
    estado.abrirPainel(m.painelId, gatilho());
  });
  div.append(abrir);
  return div;
}

function adicionarMarcadores(marcadores, formaDoPonto) {
  const L = window.L;
  grupo.clearLayers();
  for (const m of marcadores) {
    const marcador = L.marker([m.lat, m.lon], { icon: icone(m, formaDoPonto), keyboard: true, title: descricao(m), riseOnHover: true });
    marcador.bindPopup(() => conteudoDoPopup(m, () => marcador.getElement()), { maxWidth: 300, autoPanPadding: [30, 30] });
    marcador.addTo(grupo);
    const el = marcador.getElement();
    if (el) {
      el.setAttribute('aria-label', `${descricao(m)}. Abrir os detalhes`);
      el.dataset.foco = m.tipo === 'ponto' ? `mapa-${m.painelId}-${m.chave.split('-').pop()}` : `mapa-${m.chave}`;
    }
  }
}

// ---- Coordenada sob o cursor e botão de copiar ----
function textoDaCoordenada(prefixo, latlng) {
  const { lat, lng } = latlng.wrap();
  return `${prefixo}: ${coordenadaEmGms(lat, lng)} (${coordenadaDecimal(lat, lng)})`;
}

function ligarCursor() {
  mapa.on('mousemove', (e) => {
    if (!pontoFixado) $('mapa-coordenada').textContent = textoDaCoordenada('Cursor', e.latlng);
  });
  mapa.on('click', (e) => {
    pontoFixado = e.latlng.wrap();
    $('mapa-coordenada').textContent = textoDaCoordenada('Ponto marcado', pontoFixado);
    $('mapa-copiar').disabled = false;
    if (marcaFixa) marcaFixa.setLatLng(pontoFixado);
    else marcaFixa = window.L.circleMarker(pontoFixado, { radius: 5, weight: 2, color: '#1e2a5e', fillColor: '#fff', fillOpacity: 1, interactive: false }).addTo(mapa);
  });
  mapa.on('mouseout', () => {
    if (!pontoFixado) $('mapa-coordenada').textContent = $('mapa-coordenada').dataset.padrao;
  });
}

export function iniciarCopiaDaCoordenada() {
  const texto = $('mapa-coordenada');
  texto.dataset.padrao = texto.textContent;
  $('mapa-copiar').addEventListener('click', async () => {
    if (!pontoFixado) return;
    const { lat, lng } = pontoFixado;
    const copia = coordenadaEmGms(lat, lng);
    try {
      await navigator.clipboard.writeText(copia);
      mostrarMensagem(`Coordenada copiada: ${copia}`);
    } catch {
      mostrarAviso('Não foi possível copiar automaticamente. Selecione o texto da coordenada e copie com Ctrl+C.');
    }
  });
}

// ---- Mapa e camada ----
function criarMapa() {
  const L = window.L;
  mapa = L.map($('mapa-leaflet'), { zoomControl: false, minZoom: 2, maxBoundsViscosity: 0 });
  mapa.setView(...VISTA_INICIAL);
  L.control.zoom({ zoomInTitle: 'Aproximar', zoomOutTitle: 'Afastar' }).addTo(mapa);
  L.control.scale({ imperial: false, maxWidth: 160 }).addTo(mapa);
  mapa.attributionControl.setPrefix('Leaflet');
  grupo = L.layerGroup().addTo(mapa);
  ligarCursor();
}

function trocarCamada(chave, aoFalhar) {
  if (base) mapa.removeLayer(base);
  base = null;
  baseChave = chave;
  if (!chave) return;
  const L = window.L;
  const c = CAMADAS_EXTERNAS[chave];
  const opcoes = { ...c.opcoes, attribution: atribuicao(c.atribuicao) };
  base = c.tipo === 'wms' ? L.tileLayer.wms(c.url, opcoes) : L.tileLayer(c.url, opcoes);
  let carregados = 0;
  let erros = 0;
  let desistiu = false;
  base.on('tileload', () => {
    carregados += 1;
  });
  base.on('tileerror', () => {
    erros += 1;
    if (!desistiu && carregados === 0 && erros >= ERROS_ATE_DESISTIR) {
      desistiu = true;
      aoFalhar();
    }
  });
  base.addTo(mapa);
  mapa.getContainer().setAttribute('aria-label', `Mapa dos pontos e das demandas, camada ${ROTULOS_CAMADA[chave]}. Use as setas para mover e + e - para aproximar.`);
}

// Desenha os marcadores sobre a camada escolhida. Reenquadra só quando o conjunto de marcadores muda.
export function desenharComCamadas({ marcadores, camada, formaDoPonto, aoFalhar }) {
  if (!mapa) criarMapa();
  mapa.invalidateSize();
  if (baseChave !== camada) trocarCamada(camada, aoFalhar);

  const assinatura = JSON.stringify(marcadores);
  if (assinatura !== marcadoresAtuais) {
    marcadoresAtuais = assinatura;
    adicionarMarcadores(marcadores, formaDoPonto);
  }
  const conjunto = chaveDoConjunto(marcadores);
  if (conjunto !== conjuntoAtual) {
    conjuntoAtual = conjunto;
    const limites = limitesDosMarcadores(marcadores);
    if (limites) mapa.fitBounds(limites, { padding: [40, 40], maxZoom: 15 });
  }
}

// Sem camada escolhida (ou mapa fechado): tira a camada, e com ela qualquer pedido de blocos em andamento.
export function pararCamadas() {
  if (mapa && baseChave) trocarCamada(null, () => {});
}
