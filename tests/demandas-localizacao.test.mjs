// Localização da demanda: endereço e coordenadas na criação, na edição, na busca e no exemplo (RF42 e RF48). Dados fictícios.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ErroCadastro, criarDemanda, editarDemanda, listarDemandas, migrarDemanda } from '../js/demandas.js';

const HOJE = '2026-10-15';
const seed = JSON.parse(readFileSync(new URL('../data/seed.json', import.meta.url), 'utf8'));
const ctx = { afastamentos: seed.afastamentos };
const CAMPOS = ['endereco', 'coord_x', 'coord_y', 'coord_x_texto', 'coord_y_texto'];

const processo = { tipo: 'processo', titulo: 'Parecer de teste', origem: 'mp', prazo: '2026-10-14', status: 'a_fazer', protocolo: 'SEMA-PRO-FICT-0999', etapa: 'analise' };
const reuniao = { tipo: 'reuniao', titulo: 'Reunião de teste', origem: 'chefia', prazo: '2026-10-20', status: 'a_fazer', data_hora: '2026-10-20T09:00', local: 'Sala fictícia' };
const palestra = { tipo: 'palestra', titulo: 'Palestra de teste', origem: 'propria', prazo: '2026-10-22', status: 'a_fazer', data_hora: '2026-10-22T10:00', local: 'Auditório', publico: '40' };
const outra = { tipo: 'outra', titulo: 'Tarefa de teste', origem: 'propria', prazo: '2026-10-25', status: 'a_fazer' };

const camposComErro = (fn) => {
  try { fn(); } catch (e) { assert.ok(e instanceof ErroCadastro); return Object.keys(e.erros).sort(); }
  assert.fail('deveria lançar ErroCadastro');
};

test('cria demanda com endereço e coordenadas: decimal com 6 casas e o texto digitado', () => {
  const d = criarDemanda({ ...outra, endereco: '  Estrada Fictícia, km 12 ', latitude: `11° 25' 12" S`, longitude: '-58,75' }, seed.demandas, HOJE);
  assert.equal(d.endereco, 'Estrada Fictícia, km 12');
  assert.equal(d.coord_y, -11.42);
  assert.equal(d.coord_x, -58.75);
  assert.equal(d.coord_y_texto, `11° 25' 12" S`);
  assert.equal(d.coord_x_texto, '-58,75');
  assert.equal('latitude' in d || 'longitude' in d, false);
});

test('sem hemisfério assume S e O: a demanda guarda o valor negativo e o texto como digitado', () => {
  const d = criarDemanda({ ...processo, latitude: '11,42', longitude: '58,75' }, seed.demandas, HOJE);
  assert.deepEqual([d.coord_y, d.coord_x, d.coord_y_texto, d.coord_x_texto], [-11.42, -58.75, '11,42', '58,75']);
});

test('todos os tipos aceitam localização, e ela é opcional', () => {
  for (const base of [processo, reuniao, palestra, outra]) {
    const sem = criarDemanda(base, seed.demandas, HOJE);
    assert.equal(CAMPOS.some((c) => c in sem), false, base.tipo);
    const com = criarDemanda({ ...base, endereco: 'Local fictício', latitude: '-12,5', longitude: '-56' }, seed.demandas, HOJE);
    assert.equal(com.coord_y, -12.5, base.tipo);
  }
  const soEndereco = criarDemanda({ ...outra, endereco: 'Só o endereço' }, seed.demandas, HOJE);
  assert.equal(soEndereco.endereco, 'Só o endereço');
  assert.equal('coord_x' in soEndereco, false);
});

test('coordenada inválida, incompleta ou endereço longo demais são recusados por campo', () => {
  assert.deepEqual(camposComErro(() => criarDemanda({ ...outra, latitude: '-12,5' }, seed.demandas, HOJE)), ['longitude']);
  assert.deepEqual(camposComErro(() => criarDemanda({ ...outra, longitude: '-56' }, seed.demandas, HOJE)), ['latitude']);
  assert.deepEqual(camposComErro(() => criarDemanda({ ...outra, latitude: '95', longitude: 'x' }, seed.demandas, HOJE)), ['latitude', 'longitude']);
  assert.deepEqual(camposComErro(() => criarDemanda({ ...outra, endereco: 'x'.repeat(201) }, seed.demandas, HOJE)), ['endereco']);
  assert.doesNotThrow(() => criarDemanda({ ...outra, endereco: 'x'.repeat(200) }, seed.demandas, HOJE));
});

test('edita a localização, registra no histórico e limpar os campos remove a coordenada', () => {
  const original = criarDemanda({ ...outra, endereco: 'Antigo', latitude: '-12,5', longitude: '-56' }, seed.demandas, HOJE);
  const nova = editarDemanda(original, { ...outra, endereco: 'Novo', latitude: `13° 00' 00" S`, longitude: '-57' }, HOJE);
  assert.deepEqual([nova.endereco, nova.coord_y, nova.coord_x], ['Novo', -13, -57]);
  assert.equal(nova.historico.filter((h) => h.evento === 'Localização alterada').length, 1);
  const igual = editarDemanda(nova, { ...outra, endereco: 'Novo', latitude: `13° 00' 00" S`, longitude: '-57' }, HOJE);
  assert.equal(igual.historico.filter((h) => h.evento === 'Localização alterada').length, 1, 'sem mudança, sem novo evento');
  const limpa = editarDemanda(nova, { ...outra, endereco: '', latitude: '', longitude: '' }, HOJE);
  assert.equal(CAMPOS.some((c) => c in limpa), false);
});

test('quem edita sem informar a localização não a apaga', () => {
  const original = criarDemanda({ ...outra, endereco: 'Fica', latitude: `12° 30' 00" S`, longitude: '-56' }, seed.demandas, HOJE);
  const { origem, prazo, status } = original;
  const editada = editarDemanda(original, { titulo: 'Outro título', origem, prazo, status }, HOJE);
  assert.deepEqual([editada.endereco, editada.coord_y, editada.coord_x, editada.coord_y_texto], ['Fica', -12.5, -56, `12° 30' 00" S`]);
});

test('demanda com coordenada só em decimal (sem o texto) continua editável', () => {
  const antiga = { ...criarDemanda(outra, seed.demandas, HOJE), coord_y: -12.5, coord_x: -56 };
  const editada = editarDemanda(antiga, { titulo: 'Editada', origem: 'propria', prazo: '2026-10-25', status: 'a_fazer' }, HOJE);
  assert.deepEqual([editada.coord_y, editada.coord_x], [-12.5, -56]);
});

test('a operação não ganha localização pelo formulário (os pontos têm coordenada própria)', () => {
  const op = seed.demandas.find((d) => d.tipo === 'operacao');
  const editada = editarDemanda(op, { titulo: op.titulo, origem: op.origem, prazo_dias: op.prazo_dias, horas_ponto: op.horas_ponto, latitude: '-12', longitude: '-56', endereco: 'x' }, HOJE);
  assert.equal(['endereco', 'coord_x', 'coord_y'].some((c) => c in editada), false);
});

test('a busca encontra a demanda pelo endereço', () => {
  const comEndereco = criarDemanda({ ...outra, endereco: 'Travessa Imaginária, 99' }, seed.demandas, HOJE);
  const { itens } = listarDemandas([...seed.demandas, comEndereco], { busca: 'imaginaria' }, HOJE, ctx);
  assert.deepEqual(itens.map((i) => i.demanda.id), [comEndereco.id]);
});

test('o exemplo traz quatro demandas com localização fictícia, no Atlântico, e a migração as preserva', () => {
  const com = seed.demandas.filter((d) => d.coord_x !== undefined);
  assert.deepEqual(com.map((d) => d.id), ['DEM-0003', 'DEM-0004', 'DEM-0007', 'DEM-0010']);
  for (const d of com) {
    assert.ok(d.endereco && d.coord_x_texto && d.coord_y_texto, d.id);
    assert.ok(d.coord_x <= -25 && d.coord_x >= -30 && d.coord_y <= -10 && d.coord_y >= -20, `${d.id}: em pleno Atlântico, longe de qualquer município`);
    const m = migrarDemanda(d);
    assert.deepEqual([m.coord_x, m.coord_y, m.endereco], [d.coord_x, d.coord_y, d.endereco]);
  }
  assert.equal(seed.demandas.find((d) => d.id === 'DEM-0011').coord_x, undefined); // o preenchimento é opcional
});
