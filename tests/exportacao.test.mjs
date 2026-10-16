import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ARQUIVOS, CABECALHO_DEMANDAS, CABECALHO_PONTOS, celulaData, celulaNumero, celulaTexto, csvDemandas, csvPontos, jsonCompleto,
} from '../js/exportacao.js';
import { lerPlanilha } from '../js/planilha.js';

const HOJE = '2026-10-15';
const seed = JSON.parse(readFileSync(new URL('../data/seed.json', import.meta.url), 'utf8'));
const ctx = { afastamentos: seed.afastamentos };

// Lê o CSV de volta (os dados do exemplo não têm aspas nem ";" dentro dos campos).
const linhasDe = (csv) => csv.replace(/^﻿/, '').split('\r\n').filter((l) => l !== '');
const celulas = (linha) => linha.split(';');
const linhaDoId = (csv, id) => linhasDe(csv).find((l) => celulas(l)[0] === id || celulas(l)[11] === id);

test('célula de texto: aspas, separador, quebra de linha', () => {
  assert.equal(celulaTexto('simples'), 'simples');
  assert.equal(celulaTexto('a;b'), '"a;b"');
  assert.equal(celulaTexto('ele disse "oi"'), '"ele disse ""oi"""');
  assert.equal(celulaTexto('linha 1\nlinha 2'), '"linha 1\nlinha 2"');
  assert.equal(celulaTexto(null), '');
  assert.equal(celulaTexto(undefined), '');
  assert.equal(celulaTexto(0), '0');
});

test('célula de texto: proteção contra injeção de fórmula', () => {
  assert.equal(celulaTexto('=1+1'), "'=1+1");
  assert.equal(celulaTexto('+55 (65) 0000'), "'+55 (65) 0000");
  assert.equal(celulaTexto('-cmd'), "'-cmd");
  assert.equal(celulaTexto('@SUM(A1)'), "'@SUM(A1)");
  assert.equal(celulaTexto('\t=1'), "'\t=1");
  assert.equal(celulaTexto('=HYPERLINK("http://x")'), `"'=HYPERLINK(""http://x"")"`);
  assert.equal(celulaTexto('texto com = no meio'), 'texto com = no meio');
});

test('número com vírgula decimal e data dd/mm/aaaa', () => {
  assert.equal(celulaNumero(-20.113), '-20,113');
  assert.equal(celulaNumero(3), '3');
  assert.equal(celulaNumero(null), '');
  assert.equal(celulaNumero(undefined), '');
  assert.equal(celulaNumero(NaN), '');
  assert.equal(celulaData('2026-10-15'), '15/10/2026');
  assert.equal(celulaData(null), '');
  assert.equal(celulaData('15/10/2026'), '');
});

test('CSV de demandas: BOM, CRLF, cabeçalho, 13 linhas, ordenado por id, sem coordenadas', () => {
  const csv = csvDemandas(seed.demandas, HOJE, ctx);
  assert.equal(csv.charCodeAt(0), 0xfeff);
  assert.ok(csv.endsWith('\r\n'));
  assert.equal(csv.includes('\n') && !csv.replaceAll('\r\n', '').includes('\n'), true); // só CRLF
  const linhas = linhasDe(csv);
  assert.equal(linhas.length, 14);
  assert.equal(linhas[0], CABECALHO_DEMANDAS.join(';'));
  assert.ok(linhas.every((l) => celulas(l).length === CABECALHO_DEMANDAS.length));
  assert.deepEqual(linhas.slice(1).map((l) => celulas(l)[0]), seed.demandas.map((d) => d.id).sort());
  assert.equal(CABECALHO_DEMANDAS.some((c) => c.startsWith('COORD')), false);
  assert.equal(csv.includes('-20,1'), false); // nenhum valor de coordenada
});

test('CSV de demandas: operação, processo, sobrestada, concluída e reunião', () => {
  const csv = csvDemandas(seed.demandas, HOJE, ctx);
  const col = (id, nome) => celulas(linhaDoId(csv, id))[CABECALHO_DEMANDAS.indexOf(nome)];
  // operação Norte: prazo 17/10, esforço 6 pendentes × 3 h, faixa Alta, 68
  assert.deepEqual(['TIPO', 'STATUS', 'PRAZO', 'ESFORCO_H', 'FAIXA', 'SCORE', 'PONTOS', 'RELATORIOS_PENDENTES', 'AUTOS_A_LAVRAR', 'SOBRESTADA', 'EQUIPE', 'SAIDA', 'RETORNO'].map((c) => col('DEM-0001', c)),
    ['Operação de alertas', 'Em andamento', '17/10/2026', '18', 'Alta', '68', '13', '6', '1', 'não', 'Equipe Fictícia Norte', '03/10/2026', '07/10/2026']);
  assert.deepEqual(['ORIGEM', 'PROCESSO', 'ETAPA', 'FAIXA', 'SCORE', 'ESFORCO_H'].map((c) => col('DEM-0003', c)), ['Ministério Público', 'SEMA-PRO-FICT-0042', 'parecer', 'Crítica', '90', '4']);
  assert.deepEqual(['STATUS', 'FAIXA', 'SCORE', 'SOBRESTADA', 'PRAZO'].map((c) => col('DEM-0006', c)), ['Sobrestado (aguardando)', '', '', 'sim', '30/10/2026']);
  assert.deepEqual(['STATUS', 'CONCLUIDA_EM', 'FAIXA', 'SCORE'].map((c) => col('DEM-0012', c)), ['Concluída', '13/10/2026', '', '']);
  assert.deepEqual(['DATA_HORA', 'LOCAL'].map((c) => col('DEM-0008', c)), ['20/10/2026 09:00', 'Sala de reuniões (fictícia)']);
  assert.equal(col('DEM-0010', 'PUBLICO'), '40');
  assert.equal(col('DEM-0011', 'PONTOS'), ''); // só operação tem pontos
});

test('CSV de demandas não quebra com prazo inválido', () => {
  const ruim = { id: 'DEM-0099', tipo: 'outra', origem: 'propria', status: 'a_fazer', prazo: '', titulo: 'Sem prazo', criada_em: HOJE };
  const csv = csvDemandas([...seed.demandas, ruim], HOJE, ctx);
  const linha = celulas(linhaDoId(csv, 'DEM-0099'));
  assert.equal(linha[CABECALHO_DEMANDAS.indexOf('PRAZO')], '');
  assert.equal(linha[CABECALHO_DEMANDAS.indexOf('FAIXA')], '');
});

test('CSV de pontos: 21 linhas, 8 primeiras colunas iguais às da planilha, com coordenadas', () => {
  const csv = csvPontos(seed.demandas);
  const linhas = linhasDe(csv);
  assert.equal(csv.charCodeAt(0), 0xfeff);
  assert.equal(linhas.length, 1 + 13 + 8);
  assert.equal(linhas[0], CABECALHO_PONTOS.join(';'));
  assert.deepEqual(CABECALHO_PONTOS.slice(0, 8), ['N_PONTO', 'EQUIPE', 'COORD_X', 'COORD_Y', 'MUNICIPIO', 'DAT_SAIDA', 'DAT_RETOR', 'NOT_PLANEJ']);
  assert.ok(linhas.every((l) => celulas(l).length === CABECALHO_PONTOS.length));
  assert.equal(linhas[1], '1;Equipe Fictícia Norte;-20,113;-15,193;Município Fictício A;03/10/2026;07/10/2026;Possível corte raso;Auto lavrado;09/10/2026;13/10/2026;DEM-0001;Relatórios de vistoria — operação de outubro (Norte)');
  assert.equal(celulas(linhas[13])[11], 'DEM-0001'); // último ponto da operação Norte
  assert.equal(celulas(linhas[14])[11], 'DEM-0002'); // depois da operação Norte vem a Sul
});

test('CSV de pontos: etapa em texto, datas vazias quando não existem', () => {
  const linhas = linhasDe(csvPontos(seed.demandas));
  const ponto10 = celulas(linhas[10]); // ponto 10 da Norte: vistoriado, sem datas
  assert.deepEqual([ponto10[0], ponto10[8], ponto10[9], ponto10[10]], ['10', 'Vistoriado (relatório pendente)', '', '']);
});

test('CSV de pontos: texto da planilha não vira fórmula, e coordenadas negativas continuam números', () => {
  const op = {
    id: 'DEM-0050', tipo: 'operacao', titulo: 'Op', equipe: 'Eq', saida: '2026-11-01', retorno: '2026-11-05',
    pontos: [{ n: 1, coord_x: -20.5, coord_y: -15.5, municipio: '+cmd|calc', nota: '=HYPERLINK("http://exemplo")', etapa: 'planejado', data_relatorio: null, data_auto: null }],
  };
  const linha = linhasDe(csvPontos([op]))[1];
  assert.ok(linha.startsWith('1;Eq;-20,5;-15,5;'), linha);
  assert.ok(linha.includes(";'+cmd|calc;"), linha);
  assert.ok(linha.includes(`;"'=HYPERLINK(""http://exemplo"")";`), linha);
});

test('ida e volta: as linhas de uma operação exportadas podem ser coladas de volta na importação', () => {
  const norte = seed.demandas.find((d) => d.id === 'DEM-0001');
  const volta = lerPlanilha(csvPontos([norte])); // com BOM e separador ";"
  assert.equal(volta.ok, true, JSON.stringify(volta.erros));
  assert.equal(volta.operacao.pontos.length, 13);
  assert.equal(volta.operacao.equipe, 'Equipe Fictícia Norte');
  assert.equal(volta.operacao.saida, '2026-10-03');
  assert.equal(volta.operacao.retorno, '2026-10-07');
  assert.deepEqual(volta.operacao.pontos.map((p) => [p.coord_x, p.coord_y, p.municipio]), norte.pontos.map((p) => [p.coord_x, p.coord_y, p.municipio]));
});

test('as coordenadas do exemplo são fictícias: pontos em pleno Atlântico', () => {
  const todas = seed.demandas.filter((d) => d.tipo === 'operacao').flatMap((d) => d.pontos);
  assert.equal(todas.length, 21);
  for (const p of todas) {
    assert.ok(p.coord_x < -19 && p.coord_x > -23, `x ${p.coord_x}`); // bem longe da costa brasileira (≈ -35)
    assert.ok(p.coord_y < -14 && p.coord_y > -17, `y ${p.coord_y}`);
  }
});

test('JSON completo: versão, data da exportação, demandas e afastamentos', () => {
  const texto = jsonCompleto({ versao: 1, demandas: seed.demandas, afastamentos: seed.afastamentos }, '2026-10-15T12:00:00.000Z');
  const j = JSON.parse(texto);
  assert.equal(j.versao, 1);
  assert.equal(j.exportado_em, '2026-10-15T12:00:00.000Z');
  assert.deepEqual(j.demandas, seed.demandas);
  assert.deepEqual(j.afastamentos, seed.afastamentos);
  assert.deepEqual(Object.keys(j), ['versao', 'exportado_em', 'demandas', 'afastamentos']);
});

test('nomes e tipos dos arquivos', () => {
  assert.equal(ARQUIVOS.demandas.nome(HOJE), 'demandas-2026-10-15.csv');
  assert.equal(ARQUIVOS.pontos.nome(HOJE), 'pontos-2026-10-15.csv');
  assert.equal(ARQUIVOS.json.nome(HOJE), 'painel-2026-10-15.json');
  assert.equal(ARQUIVOS.resumo.nome(HOJE), 'resumo-semanal-2026-10-15.txt');
  assert.match(ARQUIVOS.demandas.mime, /^text\/csv/);
});
