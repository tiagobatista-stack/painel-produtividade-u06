// Ajuste manual de prioridade igual à faixa calculada: sem motivo, gravado como Automática. Dados fictícios.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ErroCadastro, criarDemanda, editarDemanda, manualIgualACalculada } from '../js/demandas.js';
import { priorizar } from '../js/regras.js';

const HOJE = '2026-10-15';
const seed = JSON.parse(readFileSync(new URL('../data/seed.json', import.meta.url), 'utf8'));
const ctx = { afastamentos: seed.afastamentos };
const CHAVE = { Baixa: 'baixa', Média: 'media', Alta: 'alta', Crítica: 'critica' };

const outra = { tipo: 'outra', titulo: 'Tarefa de teste', origem: 'propria', prazo: '2026-10-25', status: 'a_fazer' };
const mpVencido = { tipo: 'processo', titulo: 'Processo de teste', origem: 'mp', prazo: '2026-10-10', status: 'a_fazer', protocolo: 'SEMA-PRO-FICT-0999' };

const faixaCalculada = (d) => priorizar({ id: 'x', ...d }, HOJE, ctx).faixa;
const camposComErro = (fn) => {
  try { fn(); } catch (e) { assert.ok(e instanceof ErroCadastro); return Object.keys(e.erros).sort(); }
  assert.fail('deveria lançar ErroCadastro');
};
const outraFaixa = (faixa) => Object.values(CHAVE).find((c) => c !== CHAVE[faixa]);

test('as faixas calculadas dos casos de teste são as que o resto assume', () => {
  assert.equal(faixaCalculada(outra), 'Baixa');
  assert.equal(faixaCalculada(mpVencido), 'Crítica');
});

test('ajuste manual igual à calculada: não exige motivo e é gravado como Automática', () => {
  for (const base of [outra, mpVencido]) {
    const chave = CHAVE[faixaCalculada(base)];
    const d = criarDemanda({ ...base, prioridade_manual: chave }, seed.demandas, HOJE, ctx);
    assert.equal('prioridade_manual' in d, false, base.tipo);
    assert.equal('motivo_ajuste' in d, false, base.tipo);
    assert.equal(priorizar(d, HOJE, ctx).faixa, faixaCalculada(base)); // a faixa efetiva é a mesma
  }
});

test('igual à calculada com motivo digitado: também vira Automática, e o motivo é descartado', () => {
  const d = criarDemanda({ ...outra, prioridade_manual: 'baixa', motivo_ajuste: 'texto que não vale' }, seed.demandas, HOJE, ctx);
  assert.equal('prioridade_manual' in d || 'motivo_ajuste' in d, false);
});

test('ajuste manual diferente da calculada continua exigindo motivo', () => {
  const diferente = outraFaixa('Baixa');
  assert.deepEqual(camposComErro(() => criarDemanda({ ...outra, prioridade_manual: diferente }, seed.demandas, HOJE, ctx)), ['motivo_ajuste']);
  assert.deepEqual(camposComErro(() => criarDemanda({ ...outra, prioridade_manual: diferente, motivo_ajuste: '   ' }, seed.demandas, HOJE, ctx)), ['motivo_ajuste']);
  const d = criarDemanda({ ...outra, prioridade_manual: diferente, motivo_ajuste: 'Pedido da chefia' }, seed.demandas, HOJE, ctx);
  assert.equal(d.prioridade_manual, diferente);
  assert.equal(d.motivo_ajuste, 'Pedido da chefia');
});

test('sem o contexto (afastamentos) o ajuste igual também é reconhecido; faixa inválida continua sendo erro', () => {
  const d = criarDemanda({ ...outra, prioridade_manual: 'baixa' }, seed.demandas, HOJE);
  assert.equal('prioridade_manual' in d, false);
  assert.deepEqual(camposComErro(() => criarDemanda({ ...outra, prioridade_manual: 'urgentissima', motivo_ajuste: 'x' }, seed.demandas, HOJE, ctx)), ['prioridade_manual']);
});

test('sem faixa calculada (prazo inválido, concluída ou sobrestada) nunca é "igual": o motivo continua valendo', () => {
  const semPrazo = { ...outra, prazo: '' };
  assert.equal(manualIgualACalculada({ id: 'p', tipo: 'outra', origem: 'propria', prazo: '', status: 'a_fazer' }, { prioridade_manual: 'baixa' }, HOJE, ctx), false);
  assert.equal(manualIgualACalculada({ id: 'p', tipo: 'outra', origem: 'propria', prazo: '2026-10-25', status: 'concluida' }, { prioridade_manual: 'baixa' }, HOJE, ctx), false);
  assert.equal(manualIgualACalculada({ id: 'p', tipo: 'outra', origem: 'propria', prazo: '2026-10-25', status: 'aguardando' }, { prioridade_manual: 'baixa' }, HOJE, ctx), false);
  assert.equal(manualIgualACalculada({ id: 'p', tipo: 'outra', origem: 'propria', prazo: '2026-10-25', status: 'a_fazer' }, { prioridade_manual: '' }, HOJE, ctx), false);
  assert.equal(manualIgualACalculada({ id: 'p', tipo: 'outra', origem: 'propria', prazo: '2026-10-25', status: 'a_fazer' }, { prioridade_manual: 'xyz' }, HOJE, ctx), false);
  assert.equal(manualIgualACalculada({ id: 'p', tipo: 'outra', origem: 'propria', prazo: '2026-10-25', status: 'a_fazer' }, {}, HOJE, ctx), false);
  assert.deepEqual(camposComErro(() => criarDemanda({ ...semPrazo, prioridade_manual: 'baixa' }, seed.demandas, HOJE, ctx)), ['motivo_ajuste', 'prazo']);
});

test('edição: trocar o ajuste manual por um igual à calculada volta a Automática e registra no histórico', () => {
  const original = criarDemanda({ ...outra, prioridade_manual: outraFaixa('Baixa'), motivo_ajuste: 'Pedido da chefia' }, seed.demandas, HOJE, ctx);
  assert.ok(original.prioridade_manual);
  const editada = editarDemanda(original, { ...outra, prioridade_manual: 'baixa' }, HOJE, ctx);
  assert.equal('prioridade_manual' in editada || 'motivo_ajuste' in editada, false);
  assert.ok(editada.historico.some((h) => /^Prioridade: .*\(manual\) → Automática$/.test(h.evento)), JSON.stringify(editada.historico));
});

test('edição de operação: ajuste igual à faixa calculada também é gravado como Automática', () => {
  const op = seed.demandas.find((d) => d.tipo === 'operacao' && d.id === 'DEM-0001');
  const calculada = priorizar(op, HOJE, ctx).faixa;
  const dados = { titulo: op.titulo, origem: op.origem, prazo_dias: op.prazo_dias, horas_ponto: op.horas_ponto };
  const igual = editarDemanda(op, { ...dados, prioridade_manual: CHAVE[calculada] }, HOJE, ctx);
  assert.equal('prioridade_manual' in igual || 'motivo_ajuste' in igual, false);
  assert.deepEqual(camposComErro(() => editarDemanda(op, { ...dados, prioridade_manual: outraFaixa(calculada) }, HOJE, ctx)), ['motivo_ajuste']);
  assert.equal(editarDemanda(op, { ...dados, prioridade_manual: outraFaixa(calculada), motivo_ajuste: 'Motivo' }, HOJE, ctx).prioridade_manual, outraFaixa(calculada));
});
