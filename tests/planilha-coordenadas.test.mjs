// Coordenadas em graus, minutos e segundos na colagem da planilha. Todos os valores abaixo são inventados (pontos no Atlântico ou aleatórios).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lerPlanilha } from '../js/planilha.js';

const CAB = 'N_PONTO\tEQUIPE\tCOORD_X\tCOORD_Y\tMUNICIPIO\tDAT_SAIDA\tDAT_RETOR\tNOT_PLANEJ';
const planilha = (...coords) =>
  [CAB, ...coords.map(([x, y], i) => [i + 1, 'Equipe A', x, y, 'Município X', '01/11/2026', '05/11/2026', ''].join('\t'))].join('\n');
const ponto = (x, y) => lerPlanilha(planilha([x, y]));
const proximo = (a, b) => Math.abs(a - b) < 1e-6;

test('graus, minutos e segundos com hemisfério viram decimal; S, W e O ficam negativos', () => {
  const r = ponto(`20° 30' 15,500" W`, `15° 10' 20,250" S`);
  assert.equal(r.ok, true, JSON.stringify(r.erros));
  assert.ok(proximo(r.operacao.pontos[0].coord_x, -(20 + 30 / 60 + 15.5 / 3600)));
  assert.ok(proximo(r.operacao.pontos[0].coord_y, -(15 + 10 / 60 + 20.25 / 3600)));
});

test('O (oeste, em português) vale como W; L e E são positivos; N é positivo', () => {
  const r = ponto(`20° 00' 00" O`, `10° 00' 00" N`);
  assert.equal(r.operacao.pontos[0].coord_x, -20);
  assert.equal(r.operacao.pontos[0].coord_y, 10);
  assert.equal(ponto(`20° 30' 00" L`, `1° 0' 0" N`).operacao.pontos[0].coord_x, 20.5);
  assert.equal(ponto(`20° 30' 00" E`, `1° 0' 0" N`).operacao.pontos[0].coord_x, 20.5);
});

test('aspas tipográficas, espaços variados, ponto decimal e sem espaço depois do símbolo', () => {
  const r = ponto('20°30′15.5″W', '15° 10’ 20,25” S');
  assert.equal(r.ok, true, JSON.stringify(r.erros));
  assert.ok(proximo(r.operacao.pontos[0].coord_x, -(20 + 30 / 60 + 15.5 / 3600)));
  assert.ok(proximo(r.operacao.pontos[0].coord_y, -(15 + 10 / 60 + 20.25 / 3600)));
});

test('sem hemisfério o valor é positivo, e o sinal de menos vale; só graus e só graus e minutos também', () => {
  assert.equal(ponto(`20° 30' 00"`, `-15° 30' 00"`).operacao.pontos[0].coord_y, -15.5);
  assert.equal(ponto(`20° 30' 00"`, `-15° 30' 00"`).operacao.pontos[0].coord_x, 20.5);
  assert.equal(ponto('20°', `15° 30'`).operacao.pontos[0].coord_x, 20);
  assert.equal(ponto('20°', `15° 30'`).operacao.pontos[0].coord_y, 15.5);
  assert.equal(ponto(`-20° 30' 00" W`, `15° 0' 0" S`).operacao.pontos[0].coord_x, -20.5); // menos e hemisfério negativo concordam
});

test('o decimal continua valendo, com vírgula ou ponto, e misturado com graus em outra linha', () => {
  const r = lerPlanilha(planilha(['-20,5', '-15.25'], [`20° 30' 00" W`, `15° 15' 00" S`]));
  assert.equal(r.ok, true, JSON.stringify(r.erros));
  assert.deepEqual(r.operacao.pontos.map((p) => [p.coord_x, p.coord_y]), [[-20.5, -15.25], [-20.5, -15.25]]);
  assert.equal(ponto('', '').operacao.pontos[0].coord_x, null); // vazio continua permitido
});

test('valores impossíveis são recusados: minutos ou segundos 60 ou mais, graus fora do limite, hemisfério do eixo errado', () => {
  const recusa = (x, y) => erroCampos(ponto(x, y));
  const erroCampos = (r) => (r.ok ? [] : r.erros.map((e) => e.campo));
  assert.deepEqual(recusa(`20° 60' 00" W`, `15° 0' 0" S`), ['COORD_X']);
  assert.deepEqual(recusa(`20° 0' 60" W`, `15° 0' 0" S`), ['COORD_X']);
  assert.deepEqual(recusa(`181° 0' 0" W`, `15° 0' 0" S`), ['COORD_X']);
  assert.deepEqual(recusa(`20° 0' 0" W`, `91° 0' 0" S`), ['COORD_Y']);
  assert.deepEqual(recusa(`20° 0' 0" N`, `15° 0' 0" S`), ['COORD_X']); // N na longitude: colunas trocadas
  assert.deepEqual(recusa(`20° 0' 0" W`, `15° 0' 0" W`), ['COORD_Y']); // W na latitude
  assert.deepEqual(recusa(`-20° 0' 0" E`, `15° 0' 0" S`), ['COORD_X']); // menos e hemisfério positivo se contradizem
  assert.deepEqual(recusa('abc', `15° 0' 0" S`), ['COORD_X']);
  assert.deepEqual(recusa(`20° 0' 0" Z`, `15° 0' 0" S`), ['COORD_X']);
});

test('a mensagem de erro orienta o formato e não repete o valor digitado', () => {
  const r = ponto(`20° 60' 00" W`, `15° 0' 0" S`);
  assert.equal(r.erros[0].linha, 2);
  assert.match(r.erros[0].mensagem, /COORD_X não é um número nem graus, minutos e segundos/);
  assert.equal(r.erros[0].mensagem.includes('20° 60'), false);
});
