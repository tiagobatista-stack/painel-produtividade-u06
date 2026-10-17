import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resumoSemanal, textoResumoSemanal } from '../js/resumo.js';
import { calcularIndicadores } from '../js/indicadores.js';
import { alterarEtapaPonto, registrarRetorno, criarOperacao } from '../js/operacoes.js';
import { lerPlanilha } from '../js/planilha.js';

const HOJE = '2026-10-15';
const seed = JSON.parse(readFileSync(new URL('../data/seed.json', import.meta.url), 'utf8'));

test('semana de 12/10 a 18/10: produção e situação do exemplo', () => {
  const r = resumoSemanal(seed.demandas, HOJE);
  assert.equal(r.inicio, '2026-10-12');
  assert.equal(r.fim, '2026-10-18');
  assert.equal(r.concluidas.total, 2);
  assert.deepEqual(r.concluidas.porTipo, { operacao: 0, processo: 1, licenciamento: 0, reuniao: 1, palestra: 0, outra: 0 });
  assert.equal(r.relatoriosConcluidos, 5); // pontos 3, 4, 5, 6 (12/10) e 7 (14/10) da operação Norte
  assert.equal(r.autosLavrados, 4); // pontos 1 e 2 (13/10), 3 e 4 (14/10)
  assert.equal(r.relatoriosSemAuto, 2); // pontos 5 e 6, não constatados
  assert.deepEqual(r.situacao, { abertas: 11, vencidas: 2, proximos7: 5, relatoriosPendentes: 9, autosALavrar: 2, sobrestados: 1 });
});

test('os números do resumo batem com os indicadores da tela', () => {
  const r = resumoSemanal(seed.demandas, HOJE);
  const ind = calcularIndicadores(seed.demandas, HOJE);
  assert.equal(r.concluidas.total, ind.concluidasSemana);
  const { concluidasSemana, ...resto } = ind;
  assert.deepEqual(r.situacao, resto);
});

test('segunda a domingo: domingo ainda é da mesma semana; a segunda seguinte abre outra', () => {
  assert.equal(resumoSemanal(seed.demandas, '2026-10-18').inicio, '2026-10-12');
  const proxima = resumoSemanal(seed.demandas, '2026-10-19');
  assert.equal(proxima.inicio, '2026-10-19');
  assert.deepEqual([proxima.concluidas.total, proxima.relatoriosConcluidos, proxima.autosLavrados], [0, 0, 0]);
});

test('semana anterior (05/10 a 11/10): 3 relatórios, 2 autos, nenhuma concluída', () => {
  const r = resumoSemanal(seed.demandas, '2026-10-11');
  assert.equal(r.inicio, '2026-10-05');
  assert.deepEqual([r.concluidas.total, r.relatoriosConcluidos, r.autosLavrados, r.relatoriosSemAuto], [0, 3, 2, 0]);
});

test('uma operação concluída na semana conta como demanda concluída e seus pontos entram nos relatórios e autos', () => {
  const planilha = lerPlanilha(readFileSync(new URL('../data/planilha-exemplo.tsv', import.meta.url), 'utf8')).operacao;
  let op = criarOperacao(planilha, { prazo_dias: 10, horas_ponto: 3 }, seed.demandas, HOJE);
  op = registrarRetorno(op, HOJE);
  for (const p of op.pontos) {
    op = alterarEtapaPonto(op, p.n, 'relatorio_concluido', HOJE);
    op = alterarEtapaPonto(op, p.n, p.n <= 10 ? 'auto_lavrado' : 'encerrado_nao_constatado', HOJE);
  }
  const r = resumoSemanal([...seed.demandas, op], HOJE);
  assert.equal(r.concluidas.total, 3);
  assert.equal(r.concluidas.porTipo.operacao, 1);
  assert.equal(r.relatoriosConcluidos, 5 + 13);
  assert.equal(r.autosLavrados, 4 + 10);
  assert.equal(r.relatoriosSemAuto, 2 + 3);
});

test('ponto que volta de etapa deixa de contar (a data é limpa)', () => {
  const norte = seed.demandas.find((d) => d.id === 'DEM-0001');
  const voltou = alterarEtapaPonto(norte, 7, 'vistoriado', HOJE);
  assert.equal(resumoSemanal([voltou], HOJE).relatoriosConcluidos, 4);
});

test('texto do resumo semanal', () => {
  const texto = textoResumoSemanal(resumoSemanal(seed.demandas, HOJE), HOJE);
  const linhas = texto.split('\r\n');
  assert.equal(linhas[0], 'RESUMO SEMANAL — PAINEL DE DEMANDAS');
  assert.equal(linhas[1], 'Semana de 12/10/2026 a 18/10/2026 (segunda a domingo)');
  assert.ok(linhas.includes('- Demandas concluídas: 2 (Processo SIGADOC: 1; Reunião: 1)'));
  assert.ok(linhas.includes('- Relatórios de vistoria concluídos: 5 (2 sem auto)'));
  assert.ok(linhas.includes('- Autos de infração lavrados: 4'));
  assert.ok(linhas.includes('Situação em 15/10/2026'));
  assert.ok(linhas.includes('- Demandas abertas (ativas): 11'));
  assert.ok(linhas.includes('- Relatórios pendentes: 9'));
  assert.ok(linhas.includes('- Sobrestadas (prazo suspenso): 1'));
});

test('texto sem nenhuma conclusão não lista tipos', () => {
  const texto = textoResumoSemanal(resumoSemanal(seed.demandas, '2026-10-19'), '2026-10-19');
  assert.ok(texto.includes('- Demandas concluídas: 0\r\n'));
});
