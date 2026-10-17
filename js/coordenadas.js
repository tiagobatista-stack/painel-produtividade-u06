// Coordenadas: formatação de graus decimais em graus, minutos e segundos (GMS). Módulo puro, sem DOM.
// O leitor (GMS ou decimal para decimal) ainda está em js/planilha.js; sai de lá no PR da coordenada na Nova demanda (RF42).

const SEPARADOR = ',';

function decimalEmGms(valor, positivo, negativo, casasDosSegundos) {
  const hemisferio = valor < 0 ? negativo : positivo;
  let absoluto = Math.abs(valor);
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

// Decimal com 6 casas e vírgula, como o painel mostra: "-11,420000, -58,750000"
export function coordenadaDecimal(latitude, longitude) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return '';
  return `${latitude.toFixed(6).replace('.', SEPARADOR)}, ${longitude.toFixed(6).replace('.', SEPARADOR)}`;
}
