// Visão "Mapa" da aba Pontos. Por padrão é o SVG local ("Sem mapa-base": nenhuma requisição externa), com a situação de cada
// ponto em cor e forma. O usuário pode escolher uma camada (OpenStreetMap ou satélite), que usa o Leaflet local e mostra também
// as demandas com coordenada. Usa a mesma lista filtrada da visão "Lista". Estado visual por classe CSS (a política de
// conteúdo não permite estilo embutido).
import { CAMADA_PADRAO, CAMADAS_EXTERNAS, ROTULOS_CAMADA, camadaValida } from './camadas-mapa.js';
import { contarPorSituacao, demandasDoMapa, faixasDasDemandas, marcadoresDePontos, montarMapa, separarPorCoordenada } from './mapa.js';
import { SITUACOES_PONTO } from './rotulos.js';
import { $, elemento, estado, formatarData, hojeAtual, mostrarAviso } from './ui-comum.js';
import { desenharComCamadas, iniciarCopiaDaCoordenada, leafletDisponivel, pararCamadas } from './ui-mapa-leaflet.js';

const SVG = 'http://www.w3.org/2000/svg';
const CHAVE_VISAO = 'painel-demandas:visao-pontos';
const CHAVE_CAMADA = 'painel-demandas:camada-mapa';
const SITUACOES = Object.keys(SITUACOES_PONTO);
let visao = 'lista';
let camada = CAMADA_PADRAO; // escolha do usuário (fica salva)
let camadaFalhou = false; // a camada escolhida não carregou: vale "Sem mapa-base" até o usuário escolher de novo

function lerVisao() {
  try {
    return estado.storage?.getItem(CHAVE_VISAO) === 'mapa' ? 'mapa' : 'lista';
  } catch {
    return 'lista';
  }
}

function lerCamada() {
  try {
    return camadaValida(estado.storage?.getItem(CHAVE_CAMADA));
  } catch {
    return CAMADA_PADRAO;
  }
}

function definirCamada(nova) {
  camada = camadaValida(nova);
  camadaFalhou = false;
  try {
    estado.storage?.setItem(CHAVE_CAMADA, camada);
  } catch {
    // preferência de tela: sem armazenamento ela só vale até recarregar
  }
}

// A camada que de fato aparece: sem o Leaflet (arquivo não carregou) ou depois de uma falha, volta ao SVG local.
const camadaEfetiva = () => (camadaFalhou || !leafletDisponivel() ? CAMADA_PADRAO : camada);

export const visaoDosPontos = () => visao;
export const camadaDoMapa = () => camadaEfetiva();

export function definirVisaoDosPontos(nova) {
  visao = nova === 'mapa' ? 'mapa' : 'lista';
  try {
    estado.storage?.setItem(CHAVE_VISAO, visao);
  } catch {
    // preferência de tela: sem armazenamento ela só vale até recarregar
  }
}

function no(tag, atributos = {}, texto) {
  const el = document.createElementNS(SVG, tag);
  for (const [chave, valor] of Object.entries(atributos)) el.setAttribute(chave, String(valor));
  if (texto !== undefined) el.textContent = texto;
  return el;
}

// Forma do marcador por situação (a cor sozinha não basta): cada situação tem cor e forma próprias.
function forma(situacao) {
  const classe = `marcador-forma forma-${situacao}`;
  switch (situacao) {
    case 'aguardando_relatorio':
      return no('rect', { class: classe, x: -8, y: -8, width: 16, height: 16, rx: 2 });
    case 'a_lavrar':
      return no('polygon', { class: classe, points: '0,-11 11,0 0,11 -11,0' });
    case 'encerrado_sem_auto':
      return no('polygon', { class: classe, points: '0,-10 10,8 -10,8' });
    default: // planejado (vazado) e com auto (cheio) são círculos
      return no('circle', { class: classe, r: 8 });
  }
}

function descricao(m) {
  const relatorio = m.relatorio ? `, relatório ${m.relatorio.id}` : '';
  return `Ponto ${m.n}, ${m.municipio}, operação ${m.equipe}${relatorio}: ${SITUACOES_PONTO[m.situacao]}`;
}

function marcador(m) {
  const g = no('g', { class: `marcador marcador-${m.situacao}`, transform: `translate(${m.x.toFixed(1)} ${m.y.toFixed(1)})`, tabindex: 0, role: 'button' });
  g.dataset.foco = `mapa-${m.operacaoId}-${m.n}`;
  g.setAttribute('aria-label', `${descricao(m)}. Abrir a operação`);
  g.append(no('circle', { class: 'marcador-area', r: 14 }), forma(m.situacao), no('title', {}, descricao(m)));
  const abrir = () => estado.abrirPainel(m.operacaoId, g);
  g.addEventListener('click', abrir);
  g.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      abrir();
    }
  });
  return g;
}

function desenharSvg(mapa) {
  const svg = no('svg', { class: 'mapa-svg', viewBox: `0 0 ${mapa.largura} ${mapa.altura}`, role: 'group', 'aria-label': 'Mapa dos pontos, sem mapa-base: posição relativa por longitude e latitude' });
  svg.append(no('rect', { class: 'mapa-fundo', x: 0, y: 0, width: mapa.largura, height: mapa.altura }));
  for (const mer of mapa.grade.meridianos) {
    svg.append(no('line', { class: 'mapa-grade', x1: mer.x.toFixed(1), y1: 0, x2: mer.x.toFixed(1), y2: mapa.altura }));
    svg.append(no('text', { class: 'mapa-grade-rotulo', x: (mer.x + 4).toFixed(1), y: mapa.altura - 6 }, mer.rotulo));
  }
  for (const par of mapa.grade.paralelos) {
    svg.append(no('line', { class: 'mapa-grade', x1: 0, y1: par.y.toFixed(1), x2: mapa.largura, y2: par.y.toFixed(1) }));
    svg.append(no('text', { class: 'mapa-grade-rotulo', x: 4, y: (par.y - 4).toFixed(1) }, par.rotulo));
  }
  for (const r of mapa.rotulos) svg.append(no('text', { class: 'mapa-municipio', x: r.x.toFixed(1), y: r.y.toFixed(1), 'text-anchor': r.ancora }, r.texto));
  for (const m of mapa.marcadores) svg.append(marcador(m));
  svg.append(no('line', { class: 'mapa-escala', x1: 20, y1: mapa.altura - 28, x2: (20 + mapa.escala.comprimento).toFixed(1), y2: mapa.altura - 28 }));
  svg.append(no('text', { class: 'mapa-escala-rotulo', x: 20, y: mapa.altura - 34 }, `≈ ${String(mapa.escala.km).replace('.', ',')} km`));
  return svg;
}

// Legenda: forma e cor de cada situação, com a contagem dos pontos que estão na lista filtrada.
function legenda(linhas, demandas = null) {
  const contagem = contarPorSituacao(linhas, SITUACOES);
  const itens = SITUACOES.map((s) => {
    const li = elemento('li', 'legenda-item');
    const icone = no('svg', { class: 'legenda-icone', viewBox: '-14 -14 28 28', 'aria-hidden': 'true', focusable: 'false' });
    icone.append(forma(s));
    li.append(icone, elemento('span', '', `${SITUACOES_PONTO[s]}: ${contagem[s]}`));
    return li;
  });
  if (demandas !== null) {
    const li = elemento('li', 'legenda-item');
    const icone = no('svg', { class: 'legenda-icone', viewBox: '-14 -14 28 28', 'aria-hidden': 'true', focusable: 'false' });
    icone.append(no('polygon', { class: 'marcador-forma forma-demanda demanda-faixa-sem', points: '0,-12 10.4,-6 10.4,6 0,12 -10.4,6 -10.4,-6' }));
    li.append(icone, elemento('span', '', `Demandas com coordenada (letra = faixa): ${demandas}`));
    itens.push(li);
  }
  return itens;
}

function aoFalharACamada() {
  camadaFalhou = true;
  mostrarAviso('Não foi possível carregar o mapa-base (servidor bloqueado ou sem rede). Voltei para "Sem mapa-base".');
  estado.atualizar();
}

function desenharSelecaoDeCamada(efetiva) {
  for (const botao of document.querySelectorAll('#mapa-camadas button')) botao.setAttribute('aria-pressed', String(botao.dataset.camada === efetiva));
  const nota = $('mapa-nota');
  nota.textContent =
    efetiva === CAMADA_PADRAO
      ? 'Sem mapa-base: mostra a posição relativa dos pontos pela longitude e pela latitude, na mesma lista filtrada acima. Nenhum dado sai do navegador.'
      : `Camada ${ROTULOS_CAMADA[efetiva]}: o navegador pede imagens do mapa a ${new URL(CAMADAS_EXTERNAS[efetiva].url).hostname}, que fica sabendo a região que você está vendo. Nenhum dado das fichas é enviado.`;
}

export function desenharMapa(linhas, filtros = {}) {
  const emMapa = visao === 'mapa';
  $('pontos-visao-lista').setAttribute('aria-pressed', String(!emMapa));
  $('pontos-visao-mapa').setAttribute('aria-pressed', String(emMapa));
  $('pontos-mapa').hidden = !emMapa;
  $('pontos-lista').hidden = emMapa;
  if (!emMapa) {
    $('mapa-svg-caixa').replaceChildren();
    pararCamadas(); // mapa fechado: nenhum pedido de blocos
    return;
  }
  const efetiva = camadaEfetiva();
  const comCamadas = efetiva !== CAMADA_PADRAO;
  desenharSelecaoDeCamada(efetiva);
  $('mapa-svg-caixa').hidden = comCamadas;
  $('mapa-leaflet-area').hidden = !comCamadas;
  const { semCoordenada } = separarPorCoordenada(linhas);

  if (comCamadas) {
    const hoje = hojeAtual();
    const demandas = demandasDoMapa(estado.dados.demandas, filtros, hoje);
    const marcadores = [...marcadoresDePontos(linhas, faixasDasDemandas(estado.dados.demandas, hoje)), ...demandas];
    $('mapa-vazio').hidden = marcadores.length > 0;
    $('mapa-svg-caixa').replaceChildren();
    desenharComCamadas({ marcadores, camada: efetiva, formaDoPonto: forma, aoFalhar: aoFalharACamada });
    $('mapa-legenda').replaceChildren(...legenda(linhas, demandas.length));
  } else {
    pararCamadas();
    const mapa = montarMapa(linhas);
    $('mapa-vazio').hidden = Boolean(mapa);
    $('mapa-svg-caixa').replaceChildren(...(mapa ? [desenharSvg(mapa)] : []));
    $('mapa-legenda').replaceChildren(...legenda(linhas));
  }
  $('mapa-sem-coordenada').hidden = semCoordenada.length === 0;
  $('mapa-sem-coordenada-lista').replaceChildren(
    ...semCoordenada.map((l) => {
      const li = elemento('li', '', `Ponto ${l.n} · ${l.municipio} · ${l.equipe} (saída ${formatarData(l.saida)}): ${SITUACOES_PONTO[l.situacao]} `);
      const abrir = elemento('button', 'link', 'Abrir operação');
      abrir.type = 'button';
      abrir.dataset.foco = `sem-coordenada-${l.operacaoId}-${l.n}`;
      abrir.setAttribute('aria-label', `Abrir a operação ${l.equipe}, ponto ${l.n}, que está sem coordenadas`);
      abrir.addEventListener('click', () => estado.abrirPainel(l.operacaoId, abrir));
      li.append(abrir);
      return li;
    })
  );
}

export function iniciarMapa() {
  visao = lerVisao();
  camada = lerCamada();
  iniciarCopiaDaCoordenada();
  for (const botao of document.querySelectorAll('#mapa-camadas button')) {
    botao.addEventListener('click', () => {
      definirCamada(botao.dataset.camada);
      estado.focoApos = botao.id;
      estado.atualizar();
    });
  }
  for (const [id, nome] of [['pontos-visao-lista', 'lista'], ['pontos-visao-mapa', 'mapa']]) {
    $(id).addEventListener('click', () => {
      definirVisaoDosPontos(nome);
      estado.focoApos = id;
      estado.atualizar();
    });
  }
}
