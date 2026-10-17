// Tipo "Licenciamento" (RF43): pontuação igual à do processo (+15, mesmas origens), mesmos campos e etapas, classe "Padrão", calendário,
// exportação, resumo, MCP e o caso fictício do exemplo. Casos T19 a T22 de docs/REGRAS_PRIORIDADE.md (hoje = 2026-10-15).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { priorizar, priorizarFila, REGRAS } from '../js/regras.js';
import { ErroCadastro, TIPOS_CADASTRAVEIS, criarDemanda, editarDemanda, listarDemandas, migrarDemanda, origensDoTipo } from '../js/demandas.js';
import { ETAPAS, ORIGENS, ROTULOS_EVENTO, TIPOS } from '../js/rotulos.js';
import { calendarioMes } from '../js/agenda.js';
import { classeDeServico } from '../js/quadro.js';
import { CABECALHO_DEMANDAS, csvDemandas } from '../js/exportacao.js';
import { resumoSemanal, textoResumoSemanal } from '../js/resumo.js';
import { HOJE as HOJE_MCP, iniciarServidor, inicializar } from '../tools/mcp-apoio.mjs';

const HOJE = '2026-10-15';
const seed = JSON.parse(readFileSync(new URL('../data/seed.json', import.meta.url), 'utf8'));
const ctx = { afastamentos: seed.afastamentos };
const lic = (extra = {}) => ({ id: 'L-1', tipo: 'licenciamento', origem: 'propria', prazo: '2026-10-20', status: 'a_fazer', ...extra });
const comoProcesso = (d) => ({ ...d, tipo: 'processo' });
const dadosDoForm = { tipo: 'licenciamento', titulo: 'Licença de teste', origem: 'mp', prazo: '2026-10-25', status: 'a_fazer', protocolo: 'SEMA-PRO-FICT-0777', etapa: 'parecer' };

const camposComErro = (fn) => {
  try { fn(); } catch (e) { assert.ok(e instanceof ErroCadastro); return Object.keys(e.erros).sort(); }
  assert.fail('deveria lançar ErroCadastro');
};

// ---- Pontuação: T19 a T22 ----

test('T19: licenciamento vencido, origem própria → 65, Alta', () => {
  const r = priorizar(lic({ prazo: '2026-10-14' }), HOJE, ctx);
  assert.deepEqual([r.score, r.faixa], [65, 'Alta']);
  assert.deepEqual(r.motivos, ['Prazo vencido (+50)', 'Licenciamento (+15)']);
});

test('T20: licenciamento vencido, origem Ministério Público → 90, Crítica (a origem vale como no processo)', () => {
  const r = priorizar(lic({ prazo: '2026-10-14', origem: 'mp' }), HOJE, ctx);
  assert.deepEqual([r.score, r.faixa], [90, 'Crítica']);
  assert.deepEqual(r.motivos, ['Prazo vencido (+50)', 'Licenciamento (+15)', 'Origem: Ministério Público (+25)']);
});

test('T21: licenciamento da chefia, vence em 5 dias → 40, Média', () => {
  const r = priorizar(lic({ origem: 'chefia', prazo: '2026-10-20' }), HOJE, ctx);
  assert.deepEqual([r.score, r.faixa], [40, 'Média']);
  assert.deepEqual(r.motivos, ['Prazo de 3 a 7 dias (+15)', 'Licenciamento (+15)', 'Origem: chefia ou coordenação (+10)']);
});

test('T22: licenciamento, origem Poder Judiciário, vence em 22 dias, dentro das férias → 60, Alta', () => {
  const r = priorizar(lic({ origem: 'judiciario', prazo: '2026-11-06' }), HOJE, ctx);
  assert.deepEqual([r.score, r.faixa], [60, 'Alta']);
  assert.ok(r.motivos.includes('Prazo dentro de férias, licença-prêmio ou compensação (+20)'));
});

test('o peso do tipo é +15, igual ao do processo, e fica numa só tabela (para mudar no futuro)', () => {
  assert.equal(REGRAS.tipo.licenciamento, 15);
  assert.equal(REGRAS.tipo.licenciamento, REGRAS.tipo.processo);
});

test('mesmas entradas, mesmo resultado do processo: em toda origem, prazo e status', () => {
  for (const origem of Object.keys(ORIGENS)) {
    for (const prazo of ['2026-10-01', '2026-10-15', '2026-10-17', '2026-10-20', '2026-10-30', '2026-11-06']) {
      for (const status of ['a_fazer', 'em_andamento']) {
        const a = priorizar(lic({ origem, prazo, status }), HOJE, ctx);
        const b = priorizar(comoProcesso(lic({ origem, prazo, status })), HOJE, ctx);
        assert.equal(a.score, b.score, `${origem} ${prazo}`);
        assert.equal(a.faixa, b.faixa, `${origem} ${prazo}`);
        assert.deepEqual(a.motivos.map((m) => m.replace('Licenciamento', 'Processo SIGADOC')), b.motivos);
      }
    }
  }
});

test('concluído e sobrestado saem da fila, como as demais demandas', () => {
  assert.equal(priorizar(lic({ status: 'concluida' }), HOJE, ctx).foraDaFila, true);
  assert.equal(priorizar(lic({ status: 'aguardando', prazo: '2026-10-01' }), HOJE, ctx).sobrestada, true);
});

test('tipo desconhecido continua sendo recusado', () => {
  assert.throws(() => priorizar({ ...lic(), tipo: 'licenca' }, HOJE, ctx), /Tipo de demanda inválido/);
});

// ---- Cadastro e edição ----

test('"Licenciamento" está na lista de tipos do formulário, nos rótulos e nas origens do processo', () => {
  assert.ok(TIPOS_CADASTRAVEIS.includes('licenciamento'));
  assert.equal(TIPOS.licenciamento, 'Licenciamento');
  assert.deepEqual(origensDoTipo('licenciamento'), origensDoTipo('processo'));
  assert.deepEqual(origensDoTipo('licenciamento'), Object.keys(ORIGENS)); // as sete origens, inclusive Ministério Público e própria
  assert.deepEqual(ETAPAS.licenciamento, ETAPAS.processo);
  assert.equal(ROTULOS_EVENTO.prazo_licenciamento, 'Prazo de licenciamento');
});

test('cria licenciamento com os mesmos campos do processo: protocolo, etapa, origem, município, localização e anotações', () => {
  const d = criarDemanda({ ...dadosDoForm, municipio: ' juína ', endereco: 'Rodovia Fictícia, km 3', latitude: '-12,5', longitude: '-27,2', anotacoes: [{ texto: 'Conferir o estudo' }], esforco_h: '4', responsavel: 'Equipe fictícia' }, seed.demandas, HOJE, { afastamentos: seed.afastamentos });
  assert.equal(d.tipo, 'licenciamento');
  assert.equal(d.id, 'DEM-0015');
  assert.deepEqual([d.protocolo, d.etapa, d.origem, d.esforco_h], ['SEMA-PRO-FICT-0777', 'parecer', 'mp', 4]);
  assert.deepEqual([d.endereco, d.coord_y, d.coord_x], ['Rodovia Fictícia, km 3', -12.5, -27.2]);
  assert.deepEqual(d.anotacoes.map((a) => a.texto), ['Conferir o estudo']);
  assert.deepEqual(d.historico, [{ data: HOJE, evento: 'Criada' }]);
});

test('os campos de licenciamento são opcionais, menos o que todo tipo exige (título, prazo e origem válida)', () => {
  const minimo = criarDemanda({ tipo: 'licenciamento', titulo: 'Só o essencial', origem: 'chefia', prazo: '2026-10-25', status: 'a_fazer' }, seed.demandas, HOJE);
  assert.equal(minimo.etapa, undefined);
  assert.equal(minimo.protocolo, undefined);
  assert.deepEqual(camposComErro(() => criarDemanda({ ...dadosDoForm, titulo: '', prazo: '' }, seed.demandas, HOJE)), ['prazo', 'titulo']);
  assert.deepEqual(camposComErro(() => criarDemanda({ ...dadosDoForm, etapa: 'inexistente' }, seed.demandas, HOJE)), ['etapa']);
  assert.deepEqual(camposComErro(() => criarDemanda({ ...dadosDoForm, origem: 'nenhuma' }, seed.demandas, HOJE)), ['origem']);
});

test('todas as origens do processo valem para o licenciamento (e a pontuação acompanha)', () => {
  for (const origem of origensDoTipo('processo')) {
    const d = criarDemanda({ ...dadosDoForm, origem }, seed.demandas, HOJE);
    assert.equal(d.origem, origem);
  }
});

test('edita o licenciamento: etapa, protocolo e histórico; o tipo não muda', () => {
  const original = criarDemanda(dadosDoForm, seed.demandas, HOJE);
  const nova = editarDemanda(original, { ...dadosDoForm, etapa: 'devolvido', protocolo: 'SEMA-PRO-FICT-0778' }, HOJE);
  assert.equal(nova.tipo, 'licenciamento');
  assert.deepEqual([nova.etapa, nova.protocolo], ['devolvido', 'SEMA-PRO-FICT-0778']);
  assert.ok(nova.historico.some((h) => h.evento === 'Editada'));
});

test('ajuste manual igual à calculada vale também para licenciamento: grava como Automática', () => {
  const faixa = priorizar(lic({ prazo: '2026-10-25' }), HOJE, ctx).faixa; // Baixa ou Média; o teste usa a que o motor der
  const chave = { Baixa: 'baixa', Média: 'media', Alta: 'alta', Crítica: 'critica' }[faixa];
  const d = criarDemanda({ ...dadosDoForm, origem: 'propria', prioridade_manual: chave }, seed.demandas, HOJE, { afastamentos: seed.afastamentos });
  assert.equal('prioridade_manual' in d, false);
});

test('a migração preserva a etapa do licenciamento', () => {
  const m = migrarDemanda({ ...seed.demandas.find((d) => d.id === 'DEM-0014') });
  assert.equal(m.etapa, 'analise');
  assert.equal(m.tipo, 'licenciamento');
});

// ---- Lista, filtro, busca, calendário, quadro ----

test('filtro por tipo e busca pela etapa por extenso e pelo protocolo encontram o licenciamento', () => {
  const ids = (filtros) => listarDemandas(seed.demandas, filtros, HOJE, ctx).itens.map((x) => x.demanda.id);
  assert.deepEqual(ids({ tipo: 'licenciamento' }), ['DEM-0014']);
  assert.deepEqual(ids({ tipo: 'processo', busca: 'licença de operação' }), []); // o título do licenciamento não aparece no filtro de processo
  assert.ok(ids({ busca: 'SEMA-PRO-FICT-0140' }).includes('DEM-0014'));
  assert.ok(ids({ busca: 'análise' }).includes('DEM-0014')); // etapa Análise
  assert.ok(ids({ busca: 'licenciamento' }).includes('DEM-0005')); // o processo "sobre licenciamento" é outra coisa e continua sendo achado pelo título
});

test('o prazo do licenciamento aparece no calendário com o número do processo e tipo próprio', () => {
  const semanas = calendarioMes(seed.demandas, seed.afastamentos, '2026-10');
  const eventos = semanas.flatMap((s) => s.flatMap((dia) => dia.eventos ?? [])).filter((e) => e.id === 'DEM-0014');
  assert.equal(eventos.length, 1);
  assert.equal(eventos[0].tipo, 'prazo_licenciamento');
  assert.equal(eventos[0].data, '2026-10-30');
  assert.match(eventos[0].titulo, /^SEMA-PRO-FICT-0140 — Análise de pedido de licença/);
});

test('classe de serviço do quadro: Padrão (como o processo); Urgente se vencido ou Crítico', () => {
  assert.equal(classeDeServico({ demanda: { tipo: 'licenciamento' }, prazo: '2026-10-30', faixa: 'Média' }, HOJE), 'padrao');
  assert.equal(classeDeServico({ demanda: { tipo: 'licenciamento' }, prazo: '2026-10-01', faixa: 'Alta' }, HOJE), 'urgente');
  assert.equal(classeDeServico({ demanda: { tipo: 'licenciamento' }, prazo: '2026-10-30', faixa: 'Crítica' }, HOJE), 'urgente');
  assert.equal(classeDeServico({ demanda: { tipo: 'licenciamento' }, prazo: '2026-10-01', faixa: 'Alta', sobrestada: true }, HOJE), 'padrao');
});

// ---- Exportação e resumo ----

test('CSV de demandas: o licenciamento sai com o tipo por extenso, o protocolo e a etapa', () => {
  const csv = csvDemandas(seed.demandas, HOJE, ctx).replace(/^﻿/, '').split('\r\n');
  const linha = csv.find((l) => l.startsWith('DEM-0014;')).split(';');
  const col = (nome) => linha[CABECALHO_DEMANDAS.indexOf(nome)];
  assert.equal(col('TIPO'), 'Licenciamento');
  assert.equal(col('PROTOCOLO'), 'SEMA-PRO-FICT-0140');
  assert.equal(col('ETAPA'), 'analise');
  assert.equal(col('FAIXA'), 'Média');
  assert.equal(col('SCORE'), '25');
});

test('resumo semanal: licenciamento concluído na semana entra na contagem por tipo e no texto', () => {
  const concluido = { ...seed.demandas.find((d) => d.id === 'DEM-0014'), status: 'concluida', concluida_em: '2026-10-14' };
  const demandas = seed.demandas.map((d) => (d.id === 'DEM-0014' ? concluido : d));
  const r = resumoSemanal(demandas, HOJE);
  assert.equal(r.concluidas.porTipo.licenciamento, 1);
  assert.equal(r.concluidas.total, 3);
  assert.ok(textoResumoSemanal(r, HOJE).includes('Licenciamento: 1'));
  assert.equal(resumoSemanal(seed.demandas, HOJE).concluidas.porTipo.licenciamento, 0);
});

// ---- O caso fictício do exemplo ----

test('o exemplo traz um licenciamento fictício (DEM-0014) com os campos comuns, Média 25, sem tocar nos casos T1 a T18', () => {
  const d = seed.demandas.find((x) => x.id === 'DEM-0014');
  assert.equal(d.tipo, 'licenciamento');
  assert.equal(d.origem, 'chefia');
  assert.match(d.protocolo, /^SEMA-PRO-FICT-\d+$/);
  assert.ok(d.etapa in ETAPAS.licenciamento);
  assert.ok(d.municipio && d.responsavel && d.descricao && d.anotacoes.length === 2);
  const r = priorizar(d, HOJE, ctx);
  assert.deepEqual([r.score, r.faixa], [25, 'Média']);
  // O processo "sobre licenciamento" do exemplo continua sendo um processo, não o tipo novo.
  assert.equal(seed.demandas.find((x) => x.id === 'DEM-0005').tipo, 'processo');
  // Os scores dos casos do exemplo que já existiam não mudaram: só entrou o novo.
  const { fila } = priorizarFila(seed.demandas, HOJE, ctx);
  assert.deepEqual(Object.fromEntries(fila.filter((x) => x.demanda.id !== 'DEM-0014').map((x) => [x.demanda.id, x.score])), {
    'DEM-0003': 90, 'DEM-0002': 80, 'DEM-0001': 68, 'DEM-0004': 60, 'DEM-0005': 55, 'DEM-0007': 40, 'DEM-0008': 35, 'DEM-0010': 20, 'DEM-0009': 10, 'DEM-0011': 0,
  });
});

// ---- MCP ----

let servidor;
before(async () => {
  servidor = iniciarServidor();
  await inicializar(servidor);
});
after(async () => {
  await servidor.fechar();
});

test('MCP: priorizar_demanda aceita o tipo licenciamento e devolve o mesmo que o motor (e igual ao do processo)', async () => {
  for (const [origem, prazo] of [['mp', '2026-10-14'], ['chefia', '2026-10-20'], ['judiciario', '2026-11-06']]) {
    const args = { tipo: 'licenciamento', origem, prazo, hoje: HOJE_MCP };
    const mcp = await servidor.chamar('priorizar_demanda', args);
    assert.equal(mcp.isError, false, mcp.texto);
    const motor = priorizar(lic({ origem, prazo }), HOJE, {});
    assert.equal(mcp.dados.score, motor.score);
    assert.equal(mcp.dados.faixa, motor.faixa);
    const proc = await servidor.chamar('priorizar_demanda', { ...args, tipo: 'processo' });
    assert.equal(mcp.dados.score, proc.dados.score);
  }
});

test('MCP: listar_regras traz o peso do licenciamento, igual ao do motor', async () => {
  const r = await servidor.chamar('listar_regras', {});
  const linha = r.dados.pontuacao.find((p) => p.criterio === 'Tipo' && p.condicao === 'licenciamento');
  assert.equal(linha.pontos, REGRAS.tipo.licenciamento);
});

test('MCP: tipo que não existe continua sendo recusado', async () => {
  const r = await servidor.chamar('priorizar_demanda', { tipo: 'licenca', hoje: HOJE_MCP });
  assert.equal(r.isError, true);
});
