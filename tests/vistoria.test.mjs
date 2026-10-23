// Situação da vistoria (RF50): cadastro, edição, filtro e exportação. Não muda a prioridade. Dados fictícios.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ErroCadastro, criarDemanda, editarDemanda, listarDemandas, migrarDemanda } from '../js/demandas.js';
import { prazoDemanda } from '../js/indicadores.js';
import { priorizar } from '../js/regras.js';
import { FILTRO_VISTORIA, VISTORIA } from '../js/rotulos.js';

const HOJE = '2026-10-15';
const seed = JSON.parse(readFileSync(new URL('../data/seed.json', import.meta.url), 'utf8'));
const ctx = { afastamentos: seed.afastamentos };
const outra = { tipo: 'outra', titulo: 'Tarefa de teste', origem: 'propria', prazo: '2026-10-25', status: 'a_fazer' };
const ids = (filtros) => listarDemandas(seed.demandas, { status: 'abertas', ...filtros }, HOJE, ctx).itens.map((i) => i.demanda.id);
const camposComErro = (fn) => {
  try { fn(); } catch (e) { assert.ok(e instanceof ErroCadastro); return Object.keys(e.erros).sort(); }
  assert.fail('deveria lançar ErroCadastro');
};

test('rótulos: as cinco situações do RF50 e o filtro "pede vistoria"', () => {
  assert.deepEqual(Object.keys(VISTORIA), ['nao_requer', 'pendente', 'programada', 'vistoriada', 'nao_acessada']);
  assert.deepEqual(Object.keys(FILTRO_VISTORIA), ['', 'pede', ...Object.keys(VISTORIA)]);
});

test('sem situação, ou "não requer", nada é gravado (demanda antiga continua válida)', () => {
  for (const vistoria of [undefined, '', 'nao_requer']) {
    const d = criarDemanda({ ...outra, vistoria }, seed.demandas, HOJE);
    assert.equal('vistoria' in d, false, String(vistoria));
    assert.equal('vistoria_em' in d, false);
  }
});

test('cria com pendente e não acessada (sem data) e com programada e vistoriada (data única, obrigatória)', () => {
  for (const vistoria of ['pendente', 'nao_acessada']) {
    const d = criarDemanda({ ...outra, vistoria, data_vistoria: '2026-10-10' }, seed.demandas, HOJE);
    assert.equal(d.vistoria, vistoria);
    assert.equal('vistoria_em' in d, false, `${vistoria} não guarda data`);
  }
  for (const vistoria of ['programada', 'vistoriada']) {
    const d = criarDemanda({ ...outra, vistoria, data_vistoria: '2026-10-20' }, seed.demandas, HOJE);
    assert.equal(d.vistoria, vistoria);
    assert.equal(d.vistoria_em, '2026-10-20');
  }
});

test('programada e vistoriada exigem data válida; situação fora da lista é recusada', () => {
  for (const vistoria of ['programada', 'vistoriada']) {
    assert.deepEqual(camposComErro(() => criarDemanda({ ...outra, vistoria }, seed.demandas, HOJE)), ['data_vistoria'], vistoria);
    assert.deepEqual(camposComErro(() => criarDemanda({ ...outra, vistoria, data_vistoria: '31/12/2026' }, seed.demandas, HOJE)), ['data_vistoria'], vistoria);
  }
  assert.deepEqual(camposComErro(() => criarDemanda({ ...outra, vistoria: 'talvez' }, seed.demandas, HOJE)), ['vistoria']);
});

test('edição: muda a situação, registra no histórico e limpa a data ao sair de vistoriada', () => {
  const original = criarDemanda({ ...outra, vistoria: 'vistoriada', data_vistoria: '2026-10-10' }, seed.demandas, HOJE);
  const pendente = editarDemanda(original, { ...outra, vistoria: 'pendente' }, HOJE, ctx);
  assert.equal(pendente.vistoria, 'pendente');
  assert.equal('vistoria_em' in pendente, false);
  assert.ok(pendente.historico.some((h) => h.evento === 'Vistoria: Vistoriada → Vistoria pendente'));
  const nada = editarDemanda(pendente, { ...outra, vistoria: 'nao_requer' }, HOJE, ctx);
  assert.equal('vistoria' in nada, false);
  assert.ok(nada.historico.some((h) => h.evento === 'Vistoria: Vistoria pendente → Não requer vistoria'));
});

test('edição sem informar a situação (outro módulo) não apaga a que existe', () => {
  const original = criarDemanda({ ...outra, vistoria: 'vistoriada', data_vistoria: '2026-10-10' }, seed.demandas, HOJE);
  const editada = editarDemanda(original, { ...outra, titulo: 'Outro título' }, HOJE, ctx);
  assert.equal(editada.vistoria, 'vistoriada');
  assert.equal(editada.vistoria_em, '2026-10-10');
});

test('reprogramar a vistoria registra a mudança de data no histórico', () => {
  const original = criarDemanda({ ...outra, vistoria: 'programada', data_vistoria: '2026-10-20' }, seed.demandas, HOJE);
  const editada = editarDemanda(original, { ...outra, vistoria: 'programada', data_vistoria: '2026-10-27' }, HOJE, ctx);
  assert.equal(editada.vistoria_em, '2026-10-27');
  assert.ok(editada.historico.some((h) => h.evento === 'Vistoria reprogramada: 20/10/2026 → 27/10/2026'));
  const igual = editarDemanda(editada, { ...outra, vistoria: 'programada', data_vistoria: '2026-10-27' }, HOJE, ctx);
  assert.equal(igual.historico.filter((h) => h.evento.startsWith('Vistoria')).length, 1); // sem mudança, sem novo evento
});

test('dados antigos: vistoriada_em vira vistoria_em ao carregar', () => {
  const antiga = { ...seed.demandas.find((d) => d.id === 'DEM-0004'), vistoria: 'vistoriada', vistoriada_em: '2026-10-09' };
  const migrada = migrarDemanda(antiga);
  assert.equal(migrada.vistoria_em, '2026-10-09');
  assert.equal('vistoriada_em' in migrada, false);
  assert.equal(migrarDemanda(migrada).vistoria_em, '2026-10-09'); // idempotente
});

test('filtro: pede = pendente + programada; cada situação; "não requer" inclui quem não tem o campo', () => {
  assert.deepEqual(ids({ vistoria: 'pede' }).sort(), ['DEM-0004', 'DEM-0007']);
  assert.deepEqual(ids({ vistoria: 'pendente' }), ['DEM-0004']);
  assert.deepEqual(ids({ vistoria: 'programada' }), ['DEM-0007']);
  assert.deepEqual(ids({ vistoria: 'vistoriada' }), ['DEM-0003']);
  assert.deepEqual(ids({ vistoria: 'nao_acessada' }), []);
  const semFiltro = ids({});
  const naoRequer = ids({ vistoria: 'nao_requer' });
  assert.equal(naoRequer.length, semFiltro.length - 3);
  assert.ok(naoRequer.includes('DEM-0001')); // a operação nunca tem o campo
  assert.deepEqual(ids({ vistoria: '' }), semFiltro);
});

test('filtro combina com os demais (tipo e busca)', () => {
  assert.deepEqual(ids({ vistoria: 'pede', tipo: 'processo' }).sort(), ['DEM-0004', 'DEM-0007']);
  assert.deepEqual(ids({ vistoria: 'pede', tipo: 'reuniao' }), []);
  assert.deepEqual(ids({ vistoria: 'pede', busca: 'denúncia' }), ['DEM-0007']);
});

test('a situação da vistoria não muda a prioridade', () => {
  const { vistoria, ...sem } = seed.demandas.find((d) => d.id === 'DEM-0004');
  const referencia = priorizar(sem, HOJE, ctx);
  for (const v of Object.keys(VISTORIA)) {
    const r = priorizar({ ...sem, vistoria: v }, HOJE, ctx);
    assert.deepEqual([r.faixa, r.score, r.motivos], [referencia.faixa, referencia.score, referencia.motivos], v);
  }
});

test('edição da operação: saída e retorno mudam, com histórico, e o prazo dos relatórios acompanha o retorno', () => {
  const norte = seed.demandas.find((d) => d.id === 'DEM-0001');
  const dados = { titulo: norte.titulo, origem: norte.origem, prazo_dias: 10, horas_ponto: 3, saida: '2026-10-05', retorno: '2026-10-09' };
  const editada = editarDemanda(norte, dados, HOJE, ctx);
  assert.deepEqual([editada.saida, editada.retorno], ['2026-10-05', '2026-10-09']);
  assert.equal(prazoDemanda(editada), '2026-10-19'); // retorno + 10 dias
  assert.ok(editada.historico.some((h) => h.evento === 'Programação alterada: saída 03/10/2026 → 05/10/2026, retorno 07/10/2026 → 09/10/2026'));
  assert.equal(editada.pontos.length, norte.pontos.length); // os pontos não mudam
});

test('edição da operação: retorno antes da saída e datas inválidas são recusados; sem as datas, ficam as que existem', () => {
  const norte = seed.demandas.find((d) => d.id === 'DEM-0001');
  const base = { titulo: norte.titulo, origem: norte.origem, prazo_dias: 10, horas_ponto: 3 };
  assert.deepEqual(camposComErro(() => editarDemanda(norte, { ...base, saida: '2026-10-08', retorno: '2026-10-07' }, HOJE, ctx)), ['retorno']);
  assert.deepEqual(camposComErro(() => editarDemanda(norte, { ...base, saida: '', retorno: '2026-10-07' }, HOJE, ctx)), ['saida']);
  assert.deepEqual(camposComErro(() => editarDemanda(norte, { ...base, saida: '2026-10-03', retorno: '07/10/2026' }, HOJE, ctx)), ['retorno']);
  const mantida = editarDemanda(norte, base, HOJE, ctx);
  assert.deepEqual([mantida.saida, mantida.retorno], [norte.saida, norte.retorno]);
  assert.equal(mantida.historico.some((h) => h.evento.startsWith('Programação alterada')), false);
});
