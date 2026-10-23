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

test('CSV de demandas: BOM, CRLF, cabeçalho, 14 linhas, ordenado por id, com endereço e coordenadas no fim', () => {
  const csv = csvDemandas(seed.demandas, HOJE, ctx);
  assert.equal(csv.charCodeAt(0), 0xfeff);
  assert.ok(csv.endsWith('\r\n'));
  assert.equal(csv.includes('\n') && !csv.replaceAll('\r\n', '').includes('\n'), true); // só CRLF
  const linhas = linhasDe(csv);
  assert.equal(linhas.length, 15);
  assert.equal(linhas[0], CABECALHO_DEMANDAS.join(';'));
  assert.ok(linhas.every((l) => celulas(l).length === CABECALHO_DEMANDAS.length));
  assert.deepEqual(linhas.slice(1).map((l) => celulas(l)[0]), seed.demandas.map((d) => d.id).sort());
  assert.deepEqual(CABECALHO_DEMANDAS.slice(-4), ['ENDERECO', 'COORD_X', 'COORD_Y', 'VISTORIA']);
  const col = (id, nome) => celulas(linhaDoId(csv, id))[CABECALHO_DEMANDAS.indexOf(nome)];
  // Demanda com localização no exemplo (fictícia, no Atlântico): endereço e coordenada com ponto decimal; longitude é X e latitude é Y.
  assert.equal(col('DEM-0003', 'ENDERECO'), 'Rodovia Fictícia, km 40 (referência fictícia)');
  assert.equal(col('DEM-0003', 'COORD_X'), '-27.2');
  assert.equal(col('DEM-0003', 'COORD_Y'), '-12.5');
  // Sem localização, e a operação (que tem coordenada nos pontos), ficam vazias.
  for (const id of ['DEM-0011', 'DEM-0001']) for (const nome of ['ENDERECO', 'COORD_X', 'COORD_Y', 'VISTORIA']) assert.equal(col(id, nome), '', `${id} ${nome}`);
  // Situação da vistoria (RF50): rótulo, com a data quando vistoriada; vazio em quem não requer.
  assert.equal(col('DEM-0003', 'VISTORIA'), 'Vistoriada (10/10/2026)');
  assert.equal(col('DEM-0004', 'VISTORIA'), 'Vistoria pendente');
  assert.equal(col('DEM-0007', 'VISTORIA'), 'Vistoria programada (20/10/2026)');
});

test('CSV de demandas: operação, processo, sobrestada, concluída e reunião', () => {
  const csv = csvDemandas(seed.demandas, HOJE, ctx);
  const col = (id, nome) => celulas(linhaDoId(csv, id))[CABECALHO_DEMANDAS.indexOf(nome)];
  // operação Norte: prazo 17/10, esforço 6 pendentes × 3 h, faixa Alta, 68
  assert.deepEqual(['TIPO', 'STATUS', 'PRAZO', 'ESFORCO_H', 'FAIXA', 'SCORE', 'PONTOS', 'RELATORIOS_PENDENTES', 'AUTOS_A_LAVRAR', 'SOBRESTADA', 'EQUIPE', 'SAIDA', 'RETORNO'].map((c) => col('DEM-0001', c)),
    ['Operação de alertas', 'Em andamento', '17/10/2026', '18', 'Alta', '68', '13', '6', '1', 'não', 'Equipe Fictícia Norte', '03/10/2026', '07/10/2026']);
  assert.deepEqual(['ORIGEM', 'PROTOCOLO', 'ETAPA', 'FAIXA', 'SCORE', 'ESFORCO_H'].map((c) => col('DEM-0003', c)), ['Ministério Público', 'SEMA-PRO-FICT-0042', 'parecer', 'Crítica', '90', '4']);
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
  assert.equal(linhas[1], '1;Equipe Fictícia Norte;-20.113;-15.193;Município Fictício A;03/10/2026;07/10/2026;Possível corte raso;Auto lavrado;09/10/2026;13/10/2026;DEM-0001;Relatórios de vistoria — operação de outubro (Norte);;Auto (tipo não informado) (13/10/2026);');
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
  assert.ok(linha.startsWith('1;Eq;-20.5;-15.5;'), linha); // coordenadas com ponto decimal
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

test('CSV de demandas: colunas novas (descrição, responsável, município, modo da prioridade, motivo e anotações)', () => {
  const novas = ['PROTOCOLO', 'DESCRICAO', 'RESPONSAVEL', 'MUNICIPIO', 'PRIORIDADE_MODO', 'MOTIVO_AJUSTE', 'ANOTACOES'];
  assert.ok(novas.every((c) => CABECALHO_DEMANDAS.includes(c)));
  assert.equal(CABECALHO_DEMANDAS.includes('PROCESSO'), false); // o nº do processo é o protocolo, sem campo duplicado
  const csv = csvDemandas(seed.demandas, HOJE, ctx);
  const col = (id, nome) => celulas(linhaDoId(csv, id))[CABECALHO_DEMANDAS.indexOf(nome)];
  assert.deepEqual(['PROTOCOLO', 'RESPONSAVEL', 'MUNICIPIO', 'PRIORIDADE_MODO', 'MOTIVO_AJUSTE'].map((c) => col('DEM-0003', c)),
    ['SEMA-PRO-FICT-0042', 'Equipe Jurídica Fictícia', 'Cidade Fictícia Alfa', 'automatica', '']);
  assert.equal(col('DEM-0003', 'ANOTACOES'), '[x] Conferir os anexos do processo | [ ] Redigir a minuta da manifestação | [ ] Enviar para revisão da coordenação');
  assert.equal(col('DEM-0011', 'ANOTACOES'), ''); // sem anotações
  assert.equal(col('DEM-0011', 'PRIORIDADE_MODO'), 'automatica');
});

test('CSV de demandas: ajuste manual aparece como FAIXA efetiva, com SCORE calculado e o motivo', () => {
  const manual = { ...seed.demandas.find((d) => d.id === 'DEM-0008'), prioridade_manual: 'alta', motivo_ajuste: 'Pedido da chefia' }; // 35 Média calculada
  const csv = csvDemandas([manual], HOJE, ctx);
  const linha = celulas(linhasDe(csv)[1]);
  const col = (nome) => linha[CABECALHO_DEMANDAS.indexOf(nome)];
  assert.deepEqual(['FAIXA', 'SCORE', 'PRIORIDADE_MODO', 'MOTIVO_AJUSTE'].map(col), ['Alta', '35', 'manual', 'Pedido da chefia']);
});

test('CSV de demandas: texto de anotação e descrição com fórmula, ponto e vírgula e quebra de linha fica protegido', () => {
  const d = {
    id: 'DEM-0050', tipo: 'outra', origem: 'propria', status: 'a_fazer', prazo: '2026-10-25', titulo: 'T', criada_em: HOJE,
    descricao: '=1+1', responsavel: '+cmd', municipio: '@x', motivo_ajuste: '-y',
    anotacoes: [{ id: 'A-1', texto: 'um; dois', feita: true }, { id: 'A-2', texto: 'três', feita: false }],
  };
  const csv = csvDemandas([d], HOJE, ctx);
  assert.ok(csv.includes(";'=1+1;'+cmd;'@x;"));
  assert.ok(csv.includes('"[x] um; dois | [ ] três"'));
  assert.ok(csv.includes(";'-y;")); // motivo mesmo sem ajuste manual válido sai como texto protegido
});

test('JSON completo leva todos os campos novos', () => {
  const d = { ...seed.demandas.find((x) => x.id === 'DEM-0003'), prioridade_manual: 'baixa', motivo_ajuste: 'm' };
  const json = JSON.parse(jsonCompleto({ demandas: [d], afastamentos: [] }, '2026-10-15T10:00:00Z'));
  const salva = json.demandas[0];
  for (const campo of ['descricao', 'responsavel', 'municipio', 'protocolo', 'prioridade_manual', 'motivo_ajuste', 'anotacoes']) assert.ok(campo in salva, campo);
  assert.equal(salva.anotacoes.length, 3);
});

test('CSV de demandas: só as coordenadas saem com ponto decimal; esforço e demais números seguem com vírgula', () => {
  const base = seed.demandas.find((d) => d.id === 'DEM-0003');
  const d = { ...base, esforco_h: 1.5, coord_x: -58.8475123, coord_y: -11.053889 };
  const csv = csvDemandas([d], HOJE, ctx);
  const col = (nome) => celulas(linhaDoId(csv, 'DEM-0003'))[CABECALHO_DEMANDAS.indexOf(nome)];
  assert.equal(col('ESFORCO_H'), '1,5');
  assert.equal(col('COORD_X'), '-58.8475123'); // sem arredondar nem perder casa
  assert.equal(col('COORD_Y'), '-11.053889');
  assert.equal(celulas(linhaDoId(csv, 'DEM-0003')).filter((c) => /^-?\d+\.\d+$/.test(c)).length, 2); // nenhuma outra célula com ponto decimal
});

test('CSV de pontos: coordenada com ponto decimal volta igual pela importação', () => {
  const op = {
    id: 'DEM-0050', tipo: 'operacao', titulo: 'Op', equipe: 'Eq', saida: '2026-11-01', retorno: '2026-11-05',
    pontos: [{ n: 1, coord_x: -20.5123456, coord_y: -15.25, municipio: 'Município X', nota: '', etapa: 'planejado', data_relatorio: null, data_auto: null }],
  };
  const csv = csvPontos([op]);
  assert.ok(linhasDe(csv)[1].startsWith('1;Eq;-20.5123456;-15.25;'));
  const volta = lerPlanilha(csv);
  assert.equal(volta.ok, true, JSON.stringify(volta.erros));
  assert.deepEqual([volta.operacao.pontos[0].coord_x, volta.operacao.pontos[0].coord_y], [-20.5123456, -15.25]);
});
