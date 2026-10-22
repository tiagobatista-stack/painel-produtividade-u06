// Mini-mapa do painel lateral: só o ponto da demanda aberta (RF66). Usa o Leaflet local, com instância própria (o mapa grande da
// aba Pontos tem a dele). Começa sem mapa-base, sem pedir nada à rede (RNF15): o fundo só vem se o usuário o escolher aqui ou
// se já o tinha escolhido na aba Pontos. A escolha feita aqui vale só enquanto o painel está aberto e não altera a da aba Pontos.
// O painel é refeito a cada atualização da tela; o recipiente do mapa é guardado e só muda de lugar, para o mapa (e os blocos
// já carregados) não serem recriados à toa.
import { CAMADA_PADRAO, CAMADAS_VALIDAS, ROTULOS_CAMADA, camadaSalva } from './camadas-mapa.js';
import { pontoDaDemanda } from './mapa.js';
import { elemento, estado } from './ui-comum.js';
import { criarCamadaBase, iconeDaDemanda, leafletDisponivel } from './ui-mapa-leaflet.js';

const ZOOM = 15;
let mapa = null;
let recipiente = null;
let marcador = null;
let base = null;
let escolhida = null; // camada escolhida neste painel; null = a salva na aba Pontos
let falhou = false;
let botoes = [];
let nota = null;
let montada = null; // demanda e coordenada em que o mapa está centrado

const camadaAtual = () => (falhou ? CAMADA_PADRAO : escolhida ?? camadaSalva(estado.storage));

function desenharBotoes() {
  const atual = camadaAtual();
  for (const b of botoes) b.setAttribute('aria-pressed', String(b.dataset.camada === atual));
  if (nota) nota.textContent = falhou ? 'Não foi possível carregar o mapa-base (servidor bloqueado ou sem rede). Voltei para "Sem mapa-base".' : '';
}

function aplicarCamada() {
  const chave = camadaAtual();
  if (!mapa) return;
  if (base && base.chave !== chave) {
    mapa.removeLayer(base.camada);
    base = null;
  }
  if (chave !== CAMADA_PADRAO && !base) {
    const camada = criarCamadaBase(chave, () => {
      falhou = true;
      aplicarCamada();
    });
    camada.addTo(mapa);
    base = { chave, camada };
  }
  desenharBotoes();
}

function escolher(chave) {
  escolhida = chave;
  falhou = false;
  aplicarCamada();
}

// Bloco "Localização no mapa" do painel, ou null se a demanda não tem coordenada (ou o Leaflet não carregou).
// Depois de inserido no painel, `montarMiniMapa` cria ou atualiza o mapa.
export function blocoMiniMapa({ demanda: d }) {
  if (!pontoDaDemanda(d) || !leafletDisponivel()) {
    destruirMiniMapa();
    return null;
  }
  const bloco = elemento('section', 'painel-mini-mapa');
  const titulo = elemento('h3', '', 'Localização no mapa');
  const grupo = elemento('div', 'mini-mapa-camadas');
  grupo.setAttribute('role', 'group');
  grupo.setAttribute('aria-label', 'Camada do mini-mapa');
  botoes = CAMADAS_VALIDAS.map((chave) => {
    const b = elemento('button', '', ROTULOS_CAMADA[chave]);
    b.type = 'button';
    b.dataset.camada = chave;
    b.dataset.foco = `mini-mapa-${chave}`;
    b.addEventListener('click', () => escolher(chave));
    return b;
  });
  grupo.append(...botoes);
  recipiente ??= elemento('div', 'mini-mapa');
  recipiente.setAttribute('aria-label', `Mapa com a localização de ${d.titulo}. Use as setas para mover e + e - para aproximar.`);
  nota = elemento('p', 'aviso-campo');
  nota.setAttribute('role', 'status');
  bloco.append(titulo, grupo, recipiente, nota);
  return bloco;
}

// Chamado depois de o bloco entrar no painel: o Leaflet precisa do recipiente já na página para medir o tamanho.
export function montarMiniMapa({ demanda: d, faixa }) {
  const ponto = pontoDaDemanda(d);
  if (!ponto || !recipiente?.isConnected) return;
  const L = window.L;
  if (!mapa) {
    mapa = L.map(recipiente, { zoomControl: false, scrollWheelZoom: false, minZoom: 2 });
    L.control.zoom({ zoomInTitle: 'Aproximar', zoomOutTitle: 'Afastar' }).addTo(mapa);
    L.control.scale({ imperial: false, maxWidth: 120 }).addTo(mapa);
    mapa.attributionControl.setPrefix('Leaflet');
    mapa.setView(ponto, ZOOM);
  } else {
    mapa.invalidateSize();
  }
  if (!marcador) marcador = L.marker(ponto, { icon: iconeDaDemanda(faixa ?? null), interactive: false, keyboard: false }).addTo(mapa);
  else {
    marcador.setLatLng(ponto);
    marcador.setIcon(iconeDaDemanda(faixa ?? null));
  }
  const chave = `${d.id}|${ponto.join(',')}`;
  if (chave !== montada) mapa.setView(ponto, ZOOM); // só reenquadra se mudou a demanda ou a coordenada: não desfaz o arrastar do usuário
  montada = chave;
  aplicarCamada();
}

// Ao fechar o painel (ou abrir uma demanda sem coordenada): desfaz o mapa e, com ele, qualquer pedido de blocos em andamento.
export function destruirMiniMapa() {
  if (mapa) mapa.remove();
  recipiente?.remove();
  mapa = null;
  recipiente = null;
  marcador = null;
  base = null;
  escolhida = null;
  falhou = false;
  botoes = [];
  nota = null;
  montada = null;
}
