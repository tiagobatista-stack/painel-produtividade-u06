// Coordenadas de teste inventadas (pontos no Atlântico ou sem relação com lugar real).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LARGURA_MAXIMA, MARGEM, contarPorSituacao, montarMapa, separarPorCoordenada, temCoordenada } from '../js/mapa.js';
import { listarPontos, pontosDasOperacoes } from '../js/pontos.js';
import { SITUACOES_PONTO } from '../js/rotulos.js';

const seed = JSON.parse(readFileSync(new URL('../data/seed.json', import.meta.url), 'utf8'));
const ponto = (n, coordX, coordY, extra = {}) => ({ operacaoId: 'DEM-9', n, municipio: 'Município Teste', situacao: 'aguardando_relatorio', coordX, coordY, ...extra });

test('só pontos com longitude e latitude entram no mapa', () => {
  const linhas = [ponto(1, -20, -15), ponto(2, null, -15), ponto(3, -20, null), ponto(4, 'x', -15)];
  const { comCoordenada, semCoordenada } = separarPorCoordenada(linhas);
  assert.deepEqual(comCoordenada.map((l) => l.n), [1]);
  assert.deepEqual(semCoordenada.map((l) => l.n), [2, 3, 4]);
  assert.equal(temCoordenada(ponto(1, 0, 0)), true); // zero é coordenada válida
  assert.equal(montarMapa([ponto(2, null, null)]), null);
  assert.equal(montarMapa([]), null);
});

test('leste fica à direita e norte fica em cima; tudo cabe no desenho com margem', () => {
  const m = montarMapa([ponto(1, -20.6, -15.6), ponto(2, -20.2, -15.2), ponto(3, -20.4, -15.4)]);
  const por = (n) => m.marcadores.find((x) => x.n === n);
  assert.ok(por(2).x > por(3).x && por(3).x > por(1).x); // longitude maior (mais a leste) → x maior
  assert.ok(por(2).y < por(3).y && por(3).y < por(1).y); // latitude maior (mais ao norte) → y menor (topo do desenho)
  for (const p of m.marcadores) {
    assert.ok(p.x >= MARGEM - 1 && p.x <= m.largura - MARGEM + 1, `x ${p.x}`);
    assert.ok(p.y >= MARGEM - 1 && p.y <= m.altura - MARGEM + 1, `y ${p.y}`);
  }
  assert.ok(Math.max(m.largura, m.altura) <= LARGURA_MAXIMA);
  assert.ok(Math.max(m.largura, m.altura) >= LARGURA_MAXIMA - 1); // o lado maior usa toda a largura disponível
});

test('a longitude é corrigida pelo cosseno da latitude: 1° de longitude vale metade de 1° de latitude a 60°', () => {
  const m = montarMapa([ponto(1, 10, 60), ponto(2, 11, 60), ponto(3, 10, 61)]);
  const por = (n) => m.marcadores.find((x) => x.n === n);
  const dx = por(2).x - por(1).x;
  const dy = por(1).y - por(3).y;
  assert.ok(Math.abs(dx / dy - Math.cos((60.5 * Math.PI) / 180)) < 0.01, `${dx / dy}`);
});

test('ponto único fica no centro e usa uma escala mínima, sem estourar', () => {
  const m = montarMapa([ponto(1, -30.123, -10.456)]);
  assert.equal(m.marcadores.length, 1);
  assert.ok(Math.abs(m.marcadores[0].x - m.largura / 2) < 0.001);
  assert.ok(Math.abs(m.marcadores[0].y - m.altura / 2) < 0.001);
  assert.ok(Number.isFinite(m.escala.comprimento) && m.escala.comprimento > 0);
});

test('pontos exatamente no mesmo lugar são abertos em volta, todos visíveis e distintos', () => {
  const m = montarMapa([ponto(1, -20, -15), ponto(2, -20, -15), ponto(3, -20, -15), ponto(4, -20.5, -15.5)]);
  const posicoes = new Set(m.marcadores.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`));
  assert.equal(posicoes.size, 4);
  // continuam perto do ponto real (raio pequeno)
  const [a, b] = [m.marcadores.find((p) => p.n === 1), m.marcadores.find((p) => p.n === 2)];
  assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < 60);
  // a ordem do afastamento é estável (não depende da ordem de entrada)
  const invertido = montarMapa([ponto(4, -20.5, -15.5), ponto(3, -20, -15), ponto(2, -20, -15), ponto(1, -20, -15)]);
  assert.deepEqual(invertido.marcadores.find((p) => p.n === 1), m.marcadores.find((p) => p.n === 1));
});

test('rótulos de município: um por município, com a contagem, dentro do desenho e fora dos marcadores', () => {
  const m = montarMapa([ponto(1, -20, -15, { municipio: 'Município A' }), ponto(2, -20.2, -15, { municipio: 'Município A' }), ponto(3, -21, -16, { municipio: 'Município B' })]);
  assert.deepEqual(m.rotulos.map((r) => [r.municipio, r.total, r.texto]).sort(), [['Município A', 2, 'Município A (2)'], ['Município B', 1, 'Município B (1)']]);
  for (const r of m.rotulos) {
    assert.ok(['start', 'middle', 'end'].includes(r.ancora));
    assert.ok(r.x >= 0 && r.x <= m.largura && r.y >= 0 && r.y <= m.altura, `${r.texto}: ${r.x},${r.y}`);
    // o rótulo não cai sobre nenhum marcador
    for (const p of m.marcadores) assert.ok(Math.hypot(p.x - r.x, p.y - r.y) > 8 || r.ancora !== 'middle', `${r.texto} sobre o ponto ${p.n}`);
  }
});

test('rótulos perto das bordas encostam do lado de dentro (não saem do desenho) e não se sobrepõem', () => {
  const linhas = pontosDasOperacoes(seed.demandas);
  const m = montarMapa(linhas);
  const largura = (r) => r.texto.length * 9.5;
  const caixa = (r) => {
    const esquerda = r.ancora === 'end' ? r.x - largura(r) : r.ancora === 'middle' ? r.x - largura(r) / 2 : r.x;
    return { esquerda, direita: esquerda + largura(r), topo: r.y - 20, base: r.y };
  };
  for (const r of m.rotulos) {
    const c = caixa(r);
    assert.ok(c.esquerda >= -1 && c.direita <= m.largura + 1, `${r.texto} sai pela lateral: ${c.esquerda}..${c.direita} de ${m.largura}`);
  }
  for (let i = 0; i < m.rotulos.length; i++) {
    for (let j = i + 1; j < m.rotulos.length; j++) {
      const [a, b] = [caixa(m.rotulos[i]), caixa(m.rotulos[j])];
      assert.ok(!(a.esquerda < b.direita && a.direita > b.esquerda && a.topo < b.base && a.base > b.topo), `${m.rotulos[i].texto} e ${m.rotulos[j].texto} se sobrepõem`);
    }
  }
});

test('a grade tem poucas linhas, em valores redondos, com rótulos em pt-BR', () => {
  const m = montarMapa([ponto(1, -20.6, -15.6), ponto(2, -20.2, -15.2)]);
  assert.ok(m.grade.meridianos.length >= 1 && m.grade.meridianos.length <= 6);
  assert.ok(m.grade.paralelos.length >= 1 && m.grade.paralelos.length <= 6);
  for (const g of [...m.grade.meridianos, ...m.grade.paralelos]) assert.match(g.rotulo, /^-?\d+(,\d+)?°$/);
  assert.ok(m.grade.meridianos.every((g) => g.x >= MARGEM - 1 && g.x <= m.largura - MARGEM + 1));
  assert.ok(m.grade.paralelos.every((g) => g.y >= MARGEM - 1 && g.y <= m.altura - MARGEM + 1));
  const ordenados = m.grade.meridianos.map((g) => g.x);
  assert.deepEqual(ordenados, [...ordenados].sort((a, b) => a - b));
});

test('a escala é uma barra "redonda" de até 1/4 da largura, proporcional aos quilômetros', () => {
  const pequeno = montarMapa([ponto(1, -20, -15), ponto(2, -20.01, -15.01)]);
  const grande = montarMapa([ponto(1, -20, -15), ponto(2, -23, -18)]);
  for (const m of [pequeno, grande]) {
    assert.ok([0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500].includes(m.escala.km), String(m.escala.km));
    assert.ok(m.escala.comprimento <= m.largura / 4 + 0.001);
  }
  assert.ok(grande.escala.km > pequeno.escala.km);
  // 1° de latitude ≈ 111 km: a barra de 100 km mede cerca de 0,9° de latitude no desenho
  const m = montarMapa([ponto(1, -20, -15), ponto(2, -20, -17)]);
  const k = (m.marcadores[0].y - m.marcadores[1].y) / 2; // unidades por grau de latitude (ponto 1 é o mais ao norte)
  assert.ok(Math.abs(Math.abs(k) * (m.escala.km / 111.32) - m.escala.comprimento) < 0.5);
});

test('contagem por situação para a legenda', () => {
  const linhas = [ponto(1, 0, 0, { situacao: 'a_lavrar' }), ponto(2, 0, 0, { situacao: 'a_lavrar' }), ponto(3, 0, 0, { situacao: 'com_auto' })];
  assert.deepEqual(contarPorSituacao(linhas, Object.keys(SITUACOES_PONTO)), { planejado: 0, aguardando_relatorio: 0, a_lavrar: 2, com_auto: 1, encerrado_sem_auto: 0 });
});

test('o exemplo do painel: 21 pontos, todos com coordenadas fictícias no Atlântico, cabem no mapa', () => {
  const linhas = pontosDasOperacoes(seed.demandas);
  const m = montarMapa(linhas);
  assert.equal(m.marcadores.length, 21);
  assert.ok(linhas.every((l) => l.coordX < -20 && l.coordX > -23 && l.coordY < -15 && l.coordY > -17)); // sem relação com lugar real
  assert.deepEqual(m.rotulos.map((r) => r.municipio).sort(), ['Município Fictício A', 'Município Fictício B', 'Município Fictício C', 'Município Fictício D']);
  assert.equal(listarPontos(seed.demandas, { situacao: 'a_lavrar' }).length, 2);
});

test('a montagem não altera as linhas recebidas', () => {
  const linhas = pontosDasOperacoes(seed.demandas);
  const antes = JSON.stringify(linhas);
  montarMapa(linhas);
  assert.equal(JSON.stringify(linhas), antes);
});

test('nenhum marcador fica sobre outro: distância mínima entre centros, e todos continuam dentro do desenho', () => {
  const m = montarMapa(pontosDasOperacoes(seed.demandas)); // 13 pontos de uma operação ficam a poucos quilômetros uns dos outros
  const ms = m.marcadores;
  for (let i = 0; i < ms.length; i++) {
    assert.ok(ms[i].x >= 0 && ms[i].x <= m.largura && ms[i].y >= 0 && ms[i].y <= m.altura);
    for (let j = i + 1; j < ms.length; j++) assert.ok(Math.hypot(ms[i].x - ms[j].x, ms[i].y - ms[j].y) >= 19.5, `${ms[i].n} e ${ms[j].n}`);
  }
});

test('o afastamento é pequeno: cada marcador fica perto da posição real', () => {
  const linhas = pontosDasOperacoes(seed.demandas);
  const m = montarMapa(linhas);
  const sem = montarMapa(linhas.map((l) => ({ ...l, n: l.n }))); // mesma entrada: resultado determinístico
  assert.deepEqual(m.marcadores, sem.marcadores);
  const isolado = montarMapa([linhas[0]]).marcadores[0]; // sem vizinhos, nada se move: fica no centro
  assert.ok(Math.abs(isolado.x - montarMapa([linhas[0]]).largura / 2) < 0.001);
});
