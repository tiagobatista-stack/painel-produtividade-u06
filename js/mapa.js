// Mapa local dos pontos: projeção simples (sem mapa-base, sem serviço externo) e geometria do SVG.
// Funções puras: recebem as linhas de js/pontos.js (com coordX = longitude e coordY = latitude) e devolvem posições no desenho.
// O desenho usa uma projeção equiretangular com a longitude corrigida pelo cosseno da latitude média: serve para ver posição
// relativa e agrupamento dos pontos, não para medir distâncias com precisão.

import { listarDemandas } from './demandas.js';
import { ETAPAS, ETAPAS_PONTO, STATUS } from './rotulos.js';

export const LARGURA_MAXIMA = 1000; // lado maior do desenho (unidades do viewBox)
export const MARGEM = 70;
const KM_POR_GRAU = 111.32;
const VAO_MINIMO = 0.05; // em graus de latitude (~5,5 km): ponto único, ou pontos muito próximos, não estouram a escala
const PASSOS_DE_GRADE = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10];
const COMPRIMENTOS_DE_ESCALA_KM = [0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500];
const DISTANCIA_MINIMA = 20; // entre os centros dos marcadores; mais perto que isso, eles são afastados um do outro

export const temCoordenada = (l) => Number.isFinite(l.coordX) && Number.isFinite(l.coordY);

// Separa os pontos que têm longitude e latitude dos que não têm.
export function separarPorCoordenada(linhas) {
  return { comCoordenada: linhas.filter(temCoordenada), semCoordenada: linhas.filter((l) => !temCoordenada(l)) };
}

const formatar = (valor, casas) => `${valor.toFixed(casas).replace('.', ',')}°`;
const casasDoPasso = (passo) => (passo >= 1 ? 0 : Math.ceil(-Math.log10(passo)));

// Linhas de grade (meridianos e paralelos) em múltiplos de um passo "redondo", com no máximo ~5 linhas por eixo.
function gradeDe(centro, vaoLon, vaoLat, posX, posY) {
  const passoPara = (vao) => PASSOS_DE_GRADE.find((p) => vao / p <= 5) ?? PASSOS_DE_GRADE.at(-1);
  const linhasDe = (minimo, maximo, passo) => {
    const lista = [];
    for (let v = Math.ceil(minimo / passo - 1e-9) * passo; v <= maximo + 1e-9; v += passo) lista.push(Math.round(v / passo) * passo);
    return lista;
  };
  const passoLon = passoPara(vaoLon);
  const passoLat = passoPara(vaoLat);
  return {
    meridianos: linhasDe(centro.lon - vaoLon / 2, centro.lon + vaoLon / 2, passoLon).map((lon) => ({ x: posX(lon), rotulo: formatar(lon, casasDoPasso(passoLon)) })),
    paralelos: linhasDe(centro.lat - vaoLat / 2, centro.lat + vaoLat / 2, passoLat).map((lat) => ({ y: posY(lat), rotulo: formatar(lat, casasDoPasso(passoLat)) })),
  };
}

// Posiciona os pontos com coordenada. Devolve null se não houver nenhum.
// Resultado: { largura, altura, marcadores: [{ ...linha, x, y }], rotulos: [{ municipio, x, y, total }], grade, escala: { km, comprimento } }
export function montarMapa(linhas) {
  const { comCoordenada } = separarPorCoordenada(linhas);
  if (comCoordenada.length === 0) return null;

  const lons = comCoordenada.map((l) => l.coordX);
  const lats = comCoordenada.map((l) => l.coordY);
  const centro = { lon: (Math.min(...lons) + Math.max(...lons)) / 2, lat: (Math.min(...lats) + Math.max(...lats)) / 2 };
  const fx = Math.max(Math.cos((centro.lat * Math.PI) / 180), 0.05); // graus de longitude valem menos longe da linha do Equador
  const vaoX = Math.max((Math.max(...lons) - Math.min(...lons)) * fx, VAO_MINIMO); // em "graus de latitude"
  const vaoY = Math.max(Math.max(...lats) - Math.min(...lats), VAO_MINIMO);
  const k = (LARGURA_MAXIMA - 2 * MARGEM) / Math.max(vaoX, vaoY); // unidades do desenho por grau de latitude
  const largura = Math.round(vaoX * k + 2 * MARGEM);
  const altura = Math.round(vaoY * k + 2 * MARGEM);
  const posX = (lon) => largura / 2 + (lon - centro.lon) * fx * k;
  const posY = (lat) => altura / 2 - (lat - centro.lat) * k;

  const base = comCoordenada.map((l) => ({ ...l, x: posX(l.coordX), y: posY(l.coordY) }));

  const marcadores = afastarSobrepostos(base, largura, altura);

  const rotulos = posicionarRotulos(marcadores, largura, altura);

  // Escala: a maior barra "redonda" que ocupa até 1/4 da largura do desenho.
  const kmPorUnidade = KM_POR_GRAU / k;
  const km = [...COMPRIMENTOS_DE_ESCALA_KM].reverse().find((c) => c / kmPorUnidade <= largura / 4) ?? COMPRIMENTOS_DE_ESCALA_KM[0];

  const grade = gradeDe(centro, ((largura - 2 * MARGEM) / k) / fx, (altura - 2 * MARGEM) / k, posX, posY);
  return { largura, altura, marcadores, rotulos, grade, escala: { km, comprimento: km / kmPorUnidade } };
}

// Afasta marcadores que ficariam um sobre o outro, para todos poderem ser vistos e acionados. O deslocamento é pequeno e
// determinístico (ordem de operação e número do ponto): o marcador continua ao lado da posição real. Pontos exatamente no
// mesmo lugar saem em direções diferentes, em círculo.
function afastarSobrepostos(marcadores, largura, altura) {
  const lista = marcadores.map((m) => ({ ...m })).sort((a, b) => a.operacaoId.localeCompare(b.operacaoId) || a.n - b.n);
  const limite = (v, max) => Math.min(Math.max(v, DISTANCIA_MINIMA / 2), max - DISTANCIA_MINIMA / 2);
  for (let volta = 0; volta < 60; volta++) {
    let moveu = false;
    for (let i = 0; i < lista.length; i++) {
      for (let j = i + 1; j < lista.length; j++) {
        let dx = lista[j].x - lista[i].x;
        let dy = lista[j].y - lista[i].y;
        let d = Math.hypot(dx, dy);
        if (d >= DISTANCIA_MINIMA - 0.01) continue;
        if (d < 0.001) {
          const ang = (2 * Math.PI * (i + j)) / lista.length - Math.PI / 2; // no mesmo lugar: direção estável, por ordem
          dx = Math.cos(ang);
          dy = Math.sin(ang);
          d = 1;
        }
        const folga = (DISTANCIA_MINIMA - d) / 2 + 0.01;
        lista[i].x = limite(lista[i].x - (dx / d) * folga, largura);
        lista[i].y = limite(lista[i].y - (dy / d) * folga, altura);
        lista[j].x = limite(lista[j].x + (dx / d) * folga, largura);
        lista[j].y = limite(lista[j].y + (dy / d) * folga, altura);
        moveu = true;
      }
    }
    if (!moveu) break;
  }
  return lista;
}

// Um rótulo por município, ao lado do grupo de marcadores e nunca sobre ele: acima do grupo quando ele está na metade de baixo
// do desenho, abaixo quando está na metade de cima; encostado à direita ou à esquerda perto das bordas, para não sair do desenho.
// Rótulos que se sobreporiam são empurrados na vertical. `ancora` é o text-anchor do SVG (start, middle ou end).
const LARGURA_POR_LETRA = 9.5;
const ALTURA_DO_ROTULO = 20;

function posicionarRotulos(marcadores, largura, altura) {
  const grupos = new Map();
  for (const m of marcadores) grupos.set(m.municipio, [...(grupos.get(m.municipio) ?? []), m]);
  const rotulos = [];
  for (const [municipio, ms] of [...grupos].sort(([a], [b]) => a.localeCompare(b))) {
    const caixa = {
      minX: Math.min(...ms.map((m) => m.x)), maxX: Math.max(...ms.map((m) => m.x)),
      minY: Math.min(...ms.map((m) => m.y)), maxY: Math.max(...ms.map((m) => m.y)),
    };
    const centroX = (caixa.minX + caixa.maxX) / 2;
    const ancora = centroX > largura * 0.65 ? 'end' : centroX < largura * 0.35 ? 'start' : 'middle';
    const x = ancora === 'end' ? caixa.maxX + 12 : ancora === 'start' ? caixa.minX - 12 : centroX;
    const emBaixo = (caixa.minY + caixa.maxY) / 2 > altura / 2;
    const texto = `${municipio} (${ms.length})`;
    rotulos.push({ municipio, total: ms.length, x: Math.min(Math.max(x, 10), largura - 10), y: emBaixo ? caixa.minY - 22 : caixa.maxY + 30, ancora, texto, emBaixo });
  }
  // Empurra para fora os rótulos que se sobrepõem (caixa estimada pelo tamanho do texto).
  const caixaDe = (r) => {
    const w = r.texto.length * LARGURA_POR_LETRA;
    const esquerda = r.ancora === 'end' ? r.x - w : r.ancora === 'middle' ? r.x - w / 2 : r.x;
    return { esquerda, direita: esquerda + w, topo: r.y - ALTURA_DO_ROTULO, base: r.y };
  };
  const ocupados = [];
  for (const r of rotulos) {
    for (let tentativa = 0; tentativa < 8; tentativa++) {
      const c = caixaDe(r);
      const bate = ocupados.some((o) => c.esquerda < o.direita && c.direita > o.esquerda && c.topo < o.base && c.base > o.topo);
      if (!bate) break;
      r.y += r.emBaixo ? -ALTURA_DO_ROTULO : ALTURA_DO_ROTULO;
    }
    r.y = Math.min(Math.max(r.y, ALTURA_DO_ROTULO), altura - 36);
    ocupados.push(caixaDe(r));
  }
  return rotulos.map(({ emBaixo, ...r }) => r);
}

// Contagem dos marcadores por situação (para a legenda).
export function contarPorSituacao(linhas, situacoes) {
  const contagem = Object.fromEntries(situacoes.map((s) => [s, 0]));
  for (const l of linhas) contagem[l.situacao] += 1;
  return contagem;
}

// ---- Dados dos marcadores do mapa com camadas (Leaflet). Puros: a interface só desenha o que sai daqui. ----

// Faixa de prioridade de cada demanda aberta (a operação mostra no mapa a faixa dela). Sobrestada e concluída ficam sem faixa.
export function faixasDasDemandas(demandas, hoje) {
  const { itens } = listarDemandas(demandas, { status: 'abertas' }, hoje);
  return new Map(itens.map((i) => [i.demanda.id, i.faixa ?? null]));
}

// Um marcador por ponto com coordenada. `linhas` é a lista já filtrada da aba Pontos; `faixas` vem de faixasDasDemandas.
export function marcadoresDePontos(linhas, faixas = new Map()) {
  return linhas.filter(temCoordenada).map((l) => ({
    tipo: 'ponto',
    chave: `ponto-${l.operacaoId}-${l.n}`,
    lat: l.coordY,
    lon: l.coordX,
    situacao: l.situacao,
    titulo: `Ponto ${l.n} · ${l.municipio}`,
    subtitulo: l.equipe,
    faixa: faixas.get(l.operacaoId) ?? null,
    prazo: l.sobrestada ? null : l.prazo ?? null,
    etapa: ETAPAS_PONTO[l.etapa] ?? l.etapa,
    painelId: l.operacaoId,
  }));
}

// Um marcador por demanda aberta (que não seja operação: os pontos já são os marcadores dela) com coordenada.
export function marcadoresDeDemandas(itens) {
  return itens
    .filter((i) => i.demanda.tipo !== 'operacao' && Number.isFinite(i.demanda.coord_x) && Number.isFinite(i.demanda.coord_y))
    .map(({ demanda: d, faixa, prazo }) => ({
      tipo: 'demanda',
      chave: `demanda-${d.id}`,
      lat: d.coord_y,
      lon: d.coord_x,
      situacao: null,
      titulo: d.titulo,
      subtitulo: d.municipio ?? '',
      faixa: faixa ?? null,
      prazo: prazo ?? null,
      etapa: ETAPAS[d.tipo]?.[d.etapa] ?? STATUS[d.status] ?? d.status,
      painelId: d.id,
    }));
}

// Demandas no mapa: só as abertas, com coordenada e que combinam com a busca. Escolher uma operação ou uma situação de ponto
// esconde as demandas (elas não têm operação nem situação de ponto), para o mapa bater com a lista filtrada.
export function demandasDoMapa(demandas, filtros, hoje) {
  if (filtros.operacao || filtros.situacao) return [];
  const { itens } = listarDemandas(demandas, { busca: filtros.busca ?? '', status: 'abertas' }, hoje);
  return marcadoresDeDemandas(itens);
}

// Identifica o conjunto mostrado: o mapa só reenquadra quando ele muda (não a cada redesenho nem a cada movimento do usuário).
export const chaveDoConjunto = (marcadores) => marcadores.map((m) => m.chave).sort().join('|');

// Retângulo que cobre os marcadores: [[latMin, lonMin], [latMax, lonMax]]; null sem marcadores.
export function limitesDosMarcadores(marcadores) {
  if (marcadores.length === 0) return null;
  const lats = marcadores.map((m) => m.lat);
  const lons = marcadores.map((m) => m.lon);
  return [[Math.min(...lats), Math.min(...lons)], [Math.max(...lats), Math.max(...lons)]];
}
