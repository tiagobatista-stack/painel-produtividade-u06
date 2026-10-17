// Formatação de coordenadas em GMS. Valores inventados (a maioria no Atlântico ou sem relação com lugar real).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coordenadaDecimal, coordenadaEmGms, latitudeEmGms, longitudeEmGms } from '../js/coordenadas.js';

test('decimal vira graus, minutos e segundos com o hemisfério do eixo', () => {
  assert.equal(latitudeEmGms(-11.42), `11° 25' 12,00" S`);
  assert.equal(longitudeEmGms(-58.75), `58° 45' 00,00" O`);
  assert.equal(latitudeEmGms(-10.504306), `10° 30' 15,50" S`);
  assert.equal(longitudeEmGms(-56.172292), `56° 10' 20,25" O`);
  assert.equal(latitudeEmGms(5.5), `5° 30' 00,00" N`);
  assert.equal(longitudeEmGms(12.25), `12° 15' 00,00" L`);
});

test('zero tem hemisfério (N e L) e minutos e segundos com dois dígitos', () => {
  assert.equal(latitudeEmGms(0), `0° 00' 00,00" N`);
  assert.equal(longitudeEmGms(0), `0° 00' 00,00" L`);
  assert.equal(latitudeEmGms(-0.0166666667), `0° 01' 00,00" S`);
});

test('segundos que arredondam para 60 viram o minuto e o grau seguintes, nunca "60,00"', () => {
  assert.equal(latitudeEmGms(11.99999999), `12° 00' 00,00" N`);
  assert.equal(latitudeEmGms(-11.9999999), `12° 00' 00,00" S`);
  assert.equal(latitudeEmGms(20.35), `20° 21' 00,00" N`); // 0,35 * 60 = 20,999…: vira 21 minutos exatos
  for (const v of [0.35, 1.35, 2.35, 7.2, 13.7, 33.95, 59.999999]) assert.equal(/ 60[,']/.test(latitudeEmGms(v)), false, String(v));
});

test('número de casas dos segundos', () => {
  assert.equal(latitudeEmGms(-11.42, 0), `11° 25' 12" S`);
  assert.equal(latitudeEmGms(-11.4234567, 3), `11° 25' 24,444" S`);
});

test('ida e volta: o GMS escrito volta ao decimal com erro menor que 0,01 segundo', () => {
  const ler = (texto) => {
    const [, g, m, s, h] = texto.match(/^(\d+)° (\d{2})' (\d{2},\d+)" ([NSLO])$/);
    return (Number(g) + Number(m) / 60 + Number(s.replace(',', '.')) / 3600) * ('SO'.includes(h) ? -1 : 1);
  };
  for (let i = 0; i < 400; i++) {
    const v = ((i * 7919) % 36000) / 100 - 90 + (i % 13) / 1000; // espalha em [-90, 270) sem aleatoriedade
    assert.ok(Math.abs(ler(latitudeEmGms(v)) - v) < 0.01 / 3600 + 1e-9, String(v));
    assert.ok(Math.abs(ler(longitudeEmGms(v)) - v) < 0.01 / 3600 + 1e-9, String(v));
  }
});

test('valor que não é número finito devolve texto vazio', () => {
  for (const v of [NaN, Infinity, undefined, null, '11']) {
    assert.equal(latitudeEmGms(v), '');
    assert.equal(longitudeEmGms(v), '');
  }
  assert.equal(coordenadaEmGms(NaN, -58), '');
  assert.equal(coordenadaDecimal(-11, undefined), '');
});

test('o par em GMS e em decimal, como aparece sob o cursor e na cópia', () => {
  assert.equal(coordenadaEmGms(-11.42, -58.75), `11° 25' 12,00" S, 58° 45' 00,00" O`);
  assert.equal(coordenadaDecimal(-11.42, -58.75), '-11,420000, -58,750000');
});
