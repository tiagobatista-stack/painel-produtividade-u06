// Coordenadas: leitura (decimal ou graus, minutos e segundos) e formatação em GMS. Módulo puro, sem DOM.
// A importação da planilha e o formulário de demanda usam o mesmo leitor; só o formulário assume hemisfério (S e O) quando falta.

// ---------- Leitura ----------

// Graus, minutos e segundos: 10° 30' 15,5" S (também ′ ″ ’ ”, espaços variáveis, vírgula ou ponto decimal).
// O hemisfério é opcional; S, W e O (oeste) ficam negativos. Na coluna X (longitude) só valem E, L, W, O; na Y (latitude), N e S.
const DMS = /^([+-]?)\s*(\d{1,3})\s*[°º˚]\s*(?:(\d{1,2})\s*['′’‘]\s*(?:(\d{1,2}(?:[.,]\d+)?)\s*(?:"|″|”|“|''|′′|’’)\s*)?)?([A-Za-z])?$/;
const DECIMAL = /^([+-]?)(\d{1,3})(?:[.,](\d+))?$/;
const HEMISFERIOS = { x: { E: 1, L: 1, W: -1, O: -1 }, y: { N: 1, S: -1 } };
const LIMITE_GRAUS = { x: 180, y: 90 };
const TEXTO_MAX = 40;

// { valor, explicito } ou null. `explicito` diz se o sinal ou o hemisfério foi escrito.
function lerGms(v, eixo) {
  const m = DMS.exec(v);
  if (!m) return null;
  const graus = Number(m[2]);
  const minutos = Number(m[3] ?? 0);
  const segundos = Number((m[4] ?? '0').replace(',', '.'));
  if (minutos >= 60 || segundos >= 60) return null;
  let sinal = m[1] === '-' ? -1 : 1;
  let explicito = m[1] !== '';
  if (m[5]) {
    explicito = true;
    const h = HEMISFERIOS[eixo][m[5].toUpperCase()];
    if (h === undefined) return null;
    if (h < 0) sinal = -1;
    else if (m[1] === '-') return null; // "-" com hemisfério positivo se contradiz
  }
  const valor = graus + minutos / 60 + segundos / 3600;
  if (valor > LIMITE_GRAUS[eixo]) return null;
  return { valor: Math.round(sinal * valor * 1e7) / 1e7, explicito };
}

export const MENSAGEM_COORDENADA = (campo, hemisferio) => `${campo} não é um número nem graus, minutos e segundos (ex.: 10° 30' 15,5" ${hemisferio[0]}).`;

// Leitura da importação da planilha. eixo: 'x' (longitude) ou 'y' (latitude). Aceita decimal (com vírgula) ou GMS.
// Não assume hemisfério: o valor decimal vale como digitado. Devolve { vazio } | { valor } | { invalido }.
export function lerNumero(valor, eixo) {
  const bruto = String(valor ?? '').trim();
  if (bruto === '') return { vazio: true };
  const n = Number(bruto.replace(',', '.'));
  if (Number.isFinite(n)) return { valor: n };
  const gms = lerGms(bruto, eixo);
  return gms === null ? { invalido: true } : { valor: gms.valor };
}

// Leitura do formulário de demanda. Igual à da planilha, mais:
// - sem hemisfério (nem sinal), assume S na latitude e O na longitude (`assumido: true`);
// - arredonda para 6 casas e guarda o texto digitado.
// Devolve { vazio } | { invalido } | { valor, assumido, texto }.
export function lerCoordenadaDoFormulario(valor, eixo) {
  const texto = String(valor ?? '').trim();
  if (texto === '') return { vazio: true };
  if (texto.length > TEXTO_MAX) return { invalido: true };
  let lido;
  const d = DECIMAL.exec(texto);
  if (d) {
    const n = Number(`${d[2]}${d[3] ? `.${d[3]}` : ''}`);
    if (n > LIMITE_GRAUS[eixo]) return { invalido: true };
    lido = { valor: d[1] === '-' ? -n : n, explicito: d[1] !== '' };
  } else {
    lido = lerGms(texto, eixo);
    if (lido === null) return { invalido: true };
  }
  const assumido = !lido.explicito && lido.valor !== 0;
  const assinado = assumido ? -lido.valor : lido.valor;
  return { valor: Math.round(assinado * 1e6) / 1e6, assumido, texto };
}

// Mato Grosso, em caixa: latitude de 7° a 18° S, longitude de 50° a 62° O. Fora disso só há aviso.
export const CAIXA_DE_MATO_GROSSO = { latitude: [-18, -7], longitude: [-62, -50] };
export const foraDeMatoGrosso = (latitude, longitude) =>
  latitude < CAIXA_DE_MATO_GROSSO.latitude[0] || latitude > CAIXA_DE_MATO_GROSSO.latitude[1] ||
  longitude < CAIXA_DE_MATO_GROSSO.longitude[0] || longitude > CAIXA_DE_MATO_GROSSO.longitude[1];

// Um eixo só, para a linha sob cada campo do formulário: "= -11,053889 · hemisfério assumido: S · fora de MT".
// null se o campo está vazio ou o valor não é válido (os erros aparecem só ao salvar).
export function descreverEixo(digitado, eixo) {
  const r = lerCoordenadaDoFormulario(digitado, eixo);
  if (r.vazio || r.invalido) return null;
  const [minimo, maximo] = eixo === 'y' ? CAIXA_DE_MATO_GROSSO.latitude : CAIXA_DE_MATO_GROSSO.longitude;
  return {
    decimal: r.valor.toFixed(6).replace('.', ','),
    assumido: r.assumido,
    hemisferio: eixo === 'y' ? 'S' : 'O',
    foraDeMT: r.valor < minimo || r.valor > maximo,
  };
}

const ERRO_LATITUDE = `Latitude inválida. Use decimal (-11,42) ou graus, minutos e segundos (11° 25' 12" S).`;
const ERRO_LONGITUDE = `Longitude inválida. Use decimal (-58,75) ou graus, minutos e segundos (58° 45' 00" O).`;

// Lê o par latitude e longitude do formulário. Nunca repete o valor digitado nas mensagens.
// Devolve { vazio, erros: { latitude?, longitude? }, avisos: [texto], latitude?, longitude?, latitudeTexto?, longitudeTexto? }.
// `avisos` também sai quando só um dos dois eixos é válido (a tela mostra enquanto se digita).
export function lerParDeCoordenadas(latitudeDigitada, longitudeDigitada) {
  const lat = lerCoordenadaDoFormulario(latitudeDigitada, 'y');
  const lon = lerCoordenadaDoFormulario(longitudeDigitada, 'x');
  const avisos = [];
  if (lat.assumido) avisos.push('Latitude: hemisfério não informado: assumido S.');
  if (lon.assumido) avisos.push('Longitude: hemisfério não informado: assumido O.');
  if (lat.vazio && lon.vazio) return { vazio: true, erros: {}, avisos };

  const erros = {};
  if (lat.invalido) erros.latitude = ERRO_LATITUDE;
  else if (lat.vazio) erros.latitude = 'Informe também a latitude.';
  if (lon.invalido) erros.longitude = ERRO_LONGITUDE;
  else if (lon.vazio) erros.longitude = 'Informe também a longitude.';
  if (Object.keys(erros).length) return { vazio: false, erros, avisos };

  if (foraDeMatoGrosso(lat.valor, lon.valor)) {
    avisos.push('O ponto fica fora de Mato Grosso (latitude de 7° a 18° S, longitude de 50° a 62° O). Confira os hemisférios.');
  }
  return { vazio: false, erros: {}, avisos, latitude: lat.valor, longitude: lon.valor, latitudeTexto: lat.texto, longitudeTexto: lon.texto };
}

// ---------- Formatação ----------

const SEPARADOR = ',';

function decimalEmGms(valor, positivo, negativo, casasDosSegundos) {
  const hemisferio = valor < 0 ? negativo : positivo;
  const absoluto = Math.abs(valor);
  let graus = Math.floor(absoluto);
  let minutos = Math.floor((absoluto - graus) * 60);
  let segundos = Number(((absoluto - graus - minutos / 60) * 3600).toFixed(casasDosSegundos));
  // O arredondamento pode chegar a 60: vira o minuto seguinte (e o grau seguinte), nunca "60,00".
  if (segundos >= 60) {
    segundos = 0;
    minutos += 1;
  }
  if (minutos >= 60) {
    minutos = 0;
    graus += 1;
  }
  const textoSegundos = segundos.toFixed(casasDosSegundos).replace('.', SEPARADOR);
  return `${graus}° ${String(minutos).padStart(2, '0')}' ${textoSegundos.padStart(casasDosSegundos > 0 ? casasDosSegundos + 3 : 2, '0')}" ${hemisferio}`;
}

// Latitude: N ou S. Valor não finito devolve texto vazio.
export function latitudeEmGms(latitude, casasDosSegundos = 2) {
  return Number.isFinite(latitude) ? decimalEmGms(latitude, 'N', 'S', casasDosSegundos) : '';
}

// Longitude: L (leste) ou O (oeste), os hemisférios usados no restante do painel.
export function longitudeEmGms(longitude, casasDosSegundos = 2) {
  return Number.isFinite(longitude) ? decimalEmGms(longitude, 'L', 'O', casasDosSegundos) : '';
}

// "11° 25' 12,00" S, 58° 45' 00,00" O"
export function coordenadaEmGms(latitude, longitude, casasDosSegundos = 2) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return '';
  return `${latitudeEmGms(latitude, casasDosSegundos)}, ${longitudeEmGms(longitude, casasDosSegundos)}`;
}

// Para copiar e colar em QGIS, GPS e planilha: latitude, vírgula e espaço, longitude, 6 casas, ponto decimal: "-11.053889, -58.847500"
export function coordenadaParaCopiar(latitude, longitude) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return '';
  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
}

// Decimal com 6 casas e vírgula, como o painel mostra: "-11,420000, -58,750000"
export function coordenadaDecimal(latitude, longitude) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return '';
  return `${latitude.toFixed(6).replace('.', SEPARADOR)}, ${longitude.toFixed(6).replace('.', SEPARADOR)}`;
}
