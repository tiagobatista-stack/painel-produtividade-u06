// Camadas do mapa e os servidores que elas usam. É o único arquivo de js/ com endereço externo: cada servidor listado aqui
// precisa estar em `img-src` na política de conteúdo do vercel.json (tests/build.test.mjs confere). Módulo puro, sem DOM.
//
// "Sem mapa-base" é o SVG local (js/ui-mapa.js) e não aparece aqui: não pede nada à rede.

export const CAMADA_PADRAO = 'sem';
export const CAMADAS_VALIDAS = ['sem', 'osm', 'satelite'];

export const ROTULOS_CAMADA = {
  sem: 'Sem mapa-base',
  osm: 'OpenStreetMap',
  satelite: 'Satélite (Sentinel-2, SEMA)',
};

export const CAMADAS_EXTERNAS = {
  osm: {
    tipo: 'xyz',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    opcoes: {
      maxZoom: 19,
      // A política de uso dos servidores de blocos do OpenStreetMap pede um Referer válido, e a página envia
      // `Referrer-Policy: no-referrer`. Só estes blocos levam a origem do site (nunca o endereço com dados).
      referrerPolicy: 'origin',
    },
    atribuicao: [
      { texto: '© contribuidores do ' },
      { texto: 'OpenStreetMap', ligacao: 'https://www.openstreetmap.org/copyright' },
    ],
  },
  satelite: {
    // Mosaico Sentinel-2 anual do servidor da própria SEMA-MT (WMS 1.3.0, sem chave): resolução de 10 m.
    // O servidor limita as requisições (15 e atraso de 5 s no excesso): blocos de 512 px e sem redesenho durante o zoom.
    tipo: 'wms',
    url: 'https://geo.sema.mt.gov.br/geoserver/ows',
    opcoes: {
      layers: 'Mosaicos:SENTINEL_2_2025',
      format: 'image/jpeg',
      version: '1.3.0',
      transparent: false,
      tileSize: 512,
      zoomOffset: -1,
      maxNativeZoom: 14,
      maxZoom: 17,
      updateWhenZooming: false,
      keepBuffer: 1,
    },
    atribuicao: [{ texto: 'Imagens Sentinel-2 (Copernicus), mosaico 2025 · SEMA-MT' }],
  },
};

// Servidores externos usados, para conferir com a política de conteúdo.
export const SERVIDORES_EXTERNOS = [...new Set(Object.values(CAMADAS_EXTERNAS).map((c) => new URL(c.url).origin))];

export function camadaValida(valor) {
  return CAMADAS_VALIDAS.includes(valor) ? valor : CAMADA_PADRAO;
}

// Camada que o usuário escolheu na aba Pontos, salva no navegador. Sem armazenamento ou valor inválido: "Sem mapa-base".
export const CHAVE_CAMADA = 'painel-demandas:camada-mapa';

export function camadaSalva(storage) {
  try {
    return camadaValida(storage?.getItem(CHAVE_CAMADA));
  } catch {
    return CAMADA_PADRAO;
  }
}

// "Localizar": endereço do OpenStreetMap que o usuário abre em nova aba. A página não faz requisição: só monta o link.
// Com coordenadas, aponta o ponto; sem elas e com endereço, abre a busca do endereço; sem nada, devolve null.
const OPENSTREETMAP = 'https://www.openstreetmap.org';

export function linkParaLocalizar({ latitude, longitude, endereco } = {}) {
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    return `${OPENSTREETMAP}/?mlat=${latitude}&mlon=${longitude}#map=16/${latitude}/${longitude}`;
  }
  const texto = typeof endereco === 'string' ? endereco.trim() : '';
  return texto ? `${OPENSTREETMAP}/search?query=${encodeURIComponent(texto)}` : null;
}
