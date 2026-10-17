// Leitura de coordenadas (importação e formulário de demanda) e link do "Localizar". Valores inventados.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lerCoordenadaDoFormulario, lerNumero, lerParDeCoordenadas } from '../js/coordenadas.js';
import { linkParaLocalizar } from '../js/camadas-mapa.js';

test('importação: o decimal vale como digitado e não assume hemisfério', () => {
  assert.deepEqual(lerNumero('11,42', 'y'), { valor: 11.42 });
  assert.deepEqual(lerNumero('-58.75', 'x'), { valor: -58.75 });
  assert.deepEqual(lerNumero('', 'x'), { vazio: true });
  assert.deepEqual(lerNumero('abc', 'x'), { invalido: true });
  assert.equal(lerNumero(`10° 30' 15,5" S`, 'y').valor, -10.5043056);
  assert.equal(lerNumero(`56° 10' 20,25" W`, 'x').valor, -56.1722917);
  assert.deepEqual(lerNumero(`10° 30' 15" E`, 'y'), { invalido: true }); // hemisfério do eixo errado
});

test('formulário: sem hemisfério assume S na latitude e O na longitude, e avisa', () => {
  const casos = [['11,42', 'y', -11.42], ['11.42', 'y', -11.42], ['58,75', 'x', -58.75], [`11° 25' 12"`, 'y', -11.42], [`58° 45'`, 'x', -58.75], ['11°', 'y', -11]];
  for (const [digitado, eixo, esperado] of casos) {
    const r = lerCoordenadaDoFormulario(digitado, eixo);
    assert.equal(r.valor, esperado, digitado);
    assert.equal(r.assumido, true, digitado);
    assert.equal(r.texto, digitado);
  }
});

test('formulário: sinal ou hemisfério escrito não é assumido', () => {
  const casos = [
    ['-11,42', 'y', -11.42], [`11° 25' 12" S`, 'y', -11.42], [`11° 25' 12" s`, 'y', -11.42], [`58° 45' 00" O`, 'x', -58.75],
    [`58° 45' 00" W`, 'x', -58.75], [`58° 45' 00" L`, 'x', 58.75], [`58° 45' 00" E`, 'x', 58.75], [`11° 25' 12" N`, 'y', 11.42], ['+11,42', 'y', 11.42],
  ];
  for (const [digitado, eixo, esperado] of casos) {
    const r = lerCoordenadaDoFormulario(digitado, eixo);
    assert.equal(r.valor, esperado, digitado);
    assert.equal(r.assumido, false, digitado);
  }
  assert.equal(lerCoordenadaDoFormulario('0', 'y').assumido, false); // zero não tem hemisfério a assumir
});

test('formulário: valores impossíveis são recusados', () => {
  const casos = [
    ['abc', 'y'], ['91', 'y'], ['-91,5', 'y'], ['181', 'x'], [`10° 60' 00" S`, 'y'], [`10° 30' 60" S`, 'y'], [`10° 30' 15" E`, 'y'],
    [`10° 30' 15" N`, 'x'], [`-10° 30' 15" N`, 'y'], ['11,4,2', 'y'], ['1e2', 'y'], ['0x10', 'y'], ['x'.repeat(41), 'y'], ['1'.repeat(41), 'x'],
  ];
  for (const [digitado, eixo] of casos) assert.deepEqual(lerCoordenadaDoFormulario(digitado, eixo), { invalido: true }, `${digitado} (${eixo})`);
  assert.deepEqual(lerCoordenadaDoFormulario('  ', 'x'), { vazio: true });
});

test('formulário: guarda 6 casas decimais', () => {
  assert.equal(lerCoordenadaDoFormulario(`10° 30' 15,5" S`, 'y').valor, -10.504306);
  assert.equal(lerCoordenadaDoFormulario(`56° 10' 20,25" O`, 'x').valor, -56.172292);
  assert.equal(lerCoordenadaDoFormulario('-11,1234567891', 'y').valor, -11.123457);
});

test('par: vazio, só um eixo, inválidos e válidos; nunca repete o valor digitado', () => {
  assert.equal(lerParDeCoordenadas('', '').vazio, true);
  assert.deepEqual(Object.keys(lerParDeCoordenadas('-11,42', '').erros), ['longitude']);
  assert.deepEqual(Object.keys(lerParDeCoordenadas('', '-58,75').erros), ['latitude']);
  const ruim = lerParDeCoordenadas('abc123', '999');
  assert.deepEqual(Object.keys(ruim.erros).sort(), ['latitude', 'longitude']);
  for (const mensagem of Object.values(ruim.erros)) assert.equal(/abc123|999/.test(mensagem), false);
  const ok = lerParDeCoordenadas(`11° 25' 12" S`, '-58,75');
  assert.deepEqual(ok.erros, {});
  assert.equal(ok.latitude, -11.42);
  assert.equal(ok.longitude, -58.75);
  assert.equal(ok.latitudeTexto, `11° 25' 12" S`);
  assert.deepEqual(ok.avisos, []);
});

test('par: avisos de hemisfério assumido e de ponto fora de Mato Grosso, sem bloquear', () => {
  const assumido = lerParDeCoordenadas('11,42', '58,75');
  assert.deepEqual(assumido.avisos, ['Latitude: hemisfério não informado: assumido S.', 'Longitude: hemisfério não informado: assumido O.']);
  assert.equal(assumido.latitude, -11.42);
  assert.equal(assumido.longitude, -58.75);
  assert.deepEqual(lerParDeCoordenadas('-11,42', '-58,75').avisos, []); // S e O escritos, dentro da caixa
  // N, L ou E mandam o ponto para fora de Mato Grosso: aviso, e os valores são guardados.
  const fora = lerParDeCoordenadas(`11° 25' 12" N`, `58° 45' 00" L`);
  assert.deepEqual(fora.erros, {});
  assert.equal(fora.avisos.length, 1);
  assert.match(fora.avisos[0], /fora de Mato Grosso/);
  assert.equal(fora.latitude, 11.42);
  assert.match(lerParDeCoordenadas('-12,5', '-27,2').avisos[0], /fora de Mato Grosso/); // Atlântico, como o exemplo
  // Os limites da caixa (7° a 18° S, 50° a 62° O) estão dentro.
  for (const [lat, lon] of [['-7', '-50'], ['-18', '-62'], ['-12,5', '-56']]) assert.deepEqual(lerParDeCoordenadas(lat, lon).avisos, [], `${lat} ${lon}`);
  // Só um eixo válido: o aviso de hemisfério já aparece enquanto se digita.
  assert.deepEqual(lerParDeCoordenadas('11,42', '').avisos, ['Latitude: hemisfério não informado: assumido S.']);
});

test('"Localizar": ponto com coordenada, busca com endereço, nada sem os dois', () => {
  assert.equal(linkParaLocalizar({ latitude: -11.42, longitude: -58.75, endereco: 'x' }), 'https://www.openstreetmap.org/?mlat=-11.42&mlon=-58.75#map=16/-11.42/-58.75');
  assert.equal(linkParaLocalizar({ endereco: 'Estrada Fictícia, km 12 & arredores' }), 'https://www.openstreetmap.org/search?query=Estrada%20Fict%C3%ADcia%2C%20km%2012%20%26%20arredores');
  assert.equal(linkParaLocalizar({ latitude: -11.42, endereco: ' texto ' }), 'https://www.openstreetmap.org/search?query=texto'); // sem longitude, vale o endereço
  assert.equal(linkParaLocalizar({}), null);
  assert.equal(linkParaLocalizar({ endereco: '   ' }), null);
  assert.equal(linkParaLocalizar(), null);
});
