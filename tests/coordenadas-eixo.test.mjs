// Linha sob cada campo de coordenada do formulário: valor convertido, hemisfério assumido e "fora de MT", por eixo. Valores inventados.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { descreverEixo } from '../js/coordenadas.js';

test('o valor convertido usa hífen, vírgula e 6 casas (o exemplo do pedido: -11,053889)', () => {
  assert.deepEqual(descreverEixo('-11,053889', 'y'), { decimal: '-11,053889', assumido: false, hemisferio: 'S', foraDeMT: false });
  assert.equal(descreverEixo(`11° 03' 14" S`, 'y').decimal, '-11,053889');
  assert.equal(descreverEixo(`58° 45' 00" O`, 'x').decimal, '-58,750000');
  assert.equal(descreverEixo('-11.5', 'y').decimal, '-11,500000');
  for (const v of ['-11,053889', `11° 03' 14" S`, '-58,75', '11,42', '0']) {
    assert.match(descreverEixo(v, 'y').decimal, /^-?\d+,\d{6}$/, v);
    assert.equal(descreverEixo(v, 'y').decimal.includes('−'), false, 'sinal de menos tipográfico atrapalha a cópia para QGIS, GPS e planilha');
  }
});

test('sem hemisfério assume S (latitude) e O (longitude) e diz qual', () => {
  assert.deepEqual(descreverEixo('11,053889', 'y'), { decimal: '-11,053889', assumido: true, hemisferio: 'S', foraDeMT: false });
  assert.deepEqual(descreverEixo('58,75', 'x'), { decimal: '-58,750000', assumido: true, hemisferio: 'O', foraDeMT: false });
  assert.equal(descreverEixo('-11,05', 'y').assumido, false);
  assert.equal(descreverEixo(`11° 03' 14" S`, 'y').assumido, false);
});

test('"fora de MT" é avaliado por eixo, com os limites dentro (7° a 18° S, 50° a 62° O)', () => {
  const lat = (v) => descreverEixo(v, 'y').foraDeMT;
  const lon = (v) => descreverEixo(v, 'x').foraDeMT;
  assert.deepEqual(['-7', '-12,5', '-18'].map(lat), [false, false, false]);
  assert.deepEqual(['-6,999999', '-18,000001', '5', '-30'].map(lat), [true, true, true, true]);
  assert.deepEqual(['-50', '-56', '-62'].map(lon), [false, false, false]);
  assert.deepEqual(['-49,999999', '-62,000001', '-30', '58,75'].map((v) => descreverEixo(v, 'x').foraDeMT), [true, true, true, false]); // 58,75 sem hemisfério vale O: dentro
  assert.equal(descreverEixo(`11° 25' 12" N`, 'y').foraDeMT, true); // N: hemisfério norte, fora
  assert.equal(descreverEixo(`58° 45' 00" L`, 'x').foraDeMT, true); // L: leste, fora
});

test('campo vazio ou valor inválido não tem linha (o erro só aparece ao salvar)', () => {
  for (const v of ['', '   ', 'abc', '95', `10° 60' 00" S`, undefined, null]) assert.equal(descreverEixo(v, 'y'), null, String(v));
  assert.equal(descreverEixo('181', 'x'), null);
  assert.equal(descreverEixo(`10° 30' 15" E`, 'y'), null); // hemisfério do eixo errado
});
