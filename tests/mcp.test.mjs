import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { priorizar, REGRAS } from '../js/regras.js';
import { CASOS, HOJE, iniciarServidor, inicializar } from '../tools/mcp-apoio.mjs';

let c;
before(async () => {
  c = iniciarServidor();
  await inicializar(c);
});
after(async () => {
  await c.fechar();
});

const chamar = (nome, args) => c.chamar(nome, args);
const eco = async () => {
  const antes = c.linhasBrutas.length;
  const pong = await c.requisitar('ping', {});
  assert.deepEqual(pong.result, {});
  return c.linhasBrutas.slice(antes, -1).map((l) => JSON.parse(l)); // o que veio antes do pong
};

test('initialize: devolve a versão pedida quando suportada e a mais recente quando não', async () => {
  for (const [pedida, esperada] of [['2024-11-05', '2024-11-05'], ['2025-03-26', '2025-03-26'], ['1999-01-01', '2025-06-18']]) {
    const outro = iniciarServidor();
    const r = await inicializar(outro, pedida);
    assert.equal(r.result.protocolVersion, esperada);
    assert.deepEqual(r.result.capabilities, { tools: {} });
    assert.equal(r.result.serverInfo.name, 'demandas-lab');
    await outro.fechar();
  }
});

test('tools/list: 3 ferramentas somente leitura, com esquema de entrada', async () => {
  const r = await c.requisitar('tools/list', {});
  const nomes = r.result.tools.map((t) => t.name);
  assert.deepEqual(nomes, ['listar_regras', 'priorizar_demanda', 'resumo_operacao']);
  for (const t of r.result.tools) {
    assert.equal(t.inputSchema.type, 'object');
    assert.equal(t.inputSchema.additionalProperties, false);
    assert.equal(t.annotations.readOnlyHint, true);
    assert.equal(t.annotations.openWorldHint, false);
    assert.ok(t.description.length > 40);
  }
  const priorizar = r.result.tools.find((t) => t.name === 'priorizar_demanda');
  assert.deepEqual(priorizar.inputSchema.required, ['tipo']);
  assert.deepEqual(priorizar.inputSchema.properties.tipo.enum, ['operacao', 'processo', 'licenciamento', 'reuniao', 'palestra', 'outra']);
});

test('listar_regras: tabela de pontos igual à do motor, faixas e regras complementares', async () => {
  const r = await chamar('listar_regras', {});
  assert.equal(r.isError, false);
  const pontos = r.dados.pontuacao;
  assert.equal(pontos.length, 15);
  const de = (criterio, condicao) => pontos.find((p) => p.criterio === criterio && p.condicao.startsWith(condicao)).pontos;
  assert.equal(de('Prazo', 'vencido'), REGRAS.prazo.vencido);
  assert.equal(de('Prazo', 'vence em 0 a 2'), REGRAS.prazo.ate2dias);
  assert.equal(de('Prazo', 'vence em 3 a 7'), REGRAS.prazo.de3a7dias);
  assert.equal(de('Tipo', 'operação'), REGRAS.tipo.operacao);
  assert.equal(de('Origem do processo', 'Ministério Público'), REGRAS.origemProcesso.mp);
  assert.equal(de('Origem', 'Chefia'), REGRAS.chefia);
  assert.equal(de('Operação', '10 ou mais'), 15);
  assert.equal(de('Operação', '5 a 9'), 8);
  assert.equal(de('Afastamento', 'prazo dentro'), REGRAS.afastamento);
  assert.deepEqual(r.dados.faixas, [
    { faixa: 'Crítica', condicao: 'score >= 70' },
    { faixa: 'Alta', condicao: '45 a 69' },
    { faixa: 'Média', condicao: '25 a 44' },
    { faixa: 'Baixa', condicao: 'score < 25' },
  ]);
  assert.equal(r.dados.fonte, 'docs/REGRAS_PRIORIDADE.md');
  assert.ok(r.dados.regras_complementares.some((t) => t.includes('sobrestada')));
});

for (const caso of CASOS) {
  test(`${caso.caso}: o retorno do MCP é igual ao do painel (${caso.descricao})`, async () => {
    const mcp = await chamar('priorizar_demanda', caso.argumentos);
    assert.equal(mcp.isError, false, mcp.texto);
    const painel = priorizar(caso.painel, HOJE, caso.contexto ?? {});
    assert.equal(mcp.dados.score, painel.score);
    assert.equal(mcp.dados.faixa, painel.faixa);
    assert.deepEqual(mcp.dados.motivos, painel.motivos);
    assert.equal(mcp.dados.score, caso.score); // valor documentado em docs/REGRAS_PRIORIDADE.md
    assert.equal(mcp.dados.faixa, caso.faixa);
  });
}

test('T7: demanda concluída sai da fila', async () => {
  const r = await chamar('priorizar_demanda', { tipo: 'reuniao', prazo: '2026-10-20', origem: 'chefia', status: 'concluida', hoje: HOJE });
  assert.equal(r.isError, false);
  assert.equal(r.dados.foraDaFila, true);
  assert.equal(r.dados.score, null);
});

test('T8: prazo vazio, ausente ou impossível é erro de validação, sem cálculo', async () => {
  for (const args of [
    { tipo: 'processo', origem: 'mp', hoje: HOJE },
    { tipo: 'processo', origem: 'mp', prazo: '', hoje: HOJE },
    { tipo: 'processo', origem: 'mp', prazo: '2026-02-31', hoje: HOJE },
    { tipo: 'processo', origem: 'mp', prazo: 123, hoje: HOJE },
    { tipo: 'operacao', relatorios_pendentes: 3, hoje: HOJE },
  ]) {
    const r = await chamar('priorizar_demanda', args);
    assert.equal(r.isError, true, JSON.stringify(args));
    assert.equal(r.texto, 'Erro de validação: Prazo ausente ou inválido');
  }
});

test('T12: demanda sobrestada (aguardando) sai da fila mesmo vencida', async () => {
  const r = await chamar('priorizar_demanda', { tipo: 'processo', origem: 'mp', prazo: '2026-10-01', status: 'aguardando', hoje: HOJE });
  assert.equal(r.dados.foraDaFila, true);
  assert.equal(r.dados.sobrestada, true);
  const semPrazo = await chamar('priorizar_demanda', { tipo: 'processo', status: 'aguardando', hoje: HOJE });
  assert.equal(semPrazo.dados.sobrestada, true); // o prazo não é validado enquanto sobrestada
});

test('fronteiras: 4 / 5 / 9 / 10 relatórios pendentes e valor padrão de origem', async () => {
  const scores = [];
  for (const n of [4, 5, 9, 10]) {
    const r = await chamar('priorizar_demanda', { tipo: 'operacao', relatorios_pendentes: n, prazo: '2026-11-04', hoje: HOJE });
    scores.push(r.dados.score);
    assert.equal(r.dados.entrada.origem, 'propria');
  }
  assert.deepEqual(scores, [20, 28, 28, 35]); // T9
});

test('resumo_operacao: DEM-0001 igual ao painel (68, Alta)', async () => {
  const r = await chamar('resumo_operacao', { id: 'DEM-0001', hoje: HOJE });
  assert.equal(r.isError, false, r.texto);
  const d = r.dados;
  assert.deepEqual([d.prioridade.score, d.prioridade.faixa], [68, 'Alta']);
  assert.deepEqual([d.pontos, d.relatorios_pendentes, d.autos_a_lavrar, d.esforco_estimado_h], [13, 6, 1, 18]);
  assert.equal(d.prazo_dos_relatorios, '2026-10-17');
  assert.equal(d.equipe, 'Equipe Fictícia Norte');
  assert.deepEqual(d.municipios, ['Município Fictício A', 'Município Fictício B']);
  assert.equal(d.pontos_por_etapa.auto_lavrado, 4);
  assert.equal(d.pontos_por_etapa.vistoriado, 4);
  assert.equal(Object.values(d.pontos_por_etapa).reduce((a, b) => a + b, 0), 13);
  assert.equal(/coord_[xy]/.test(r.texto) || r.texto.includes('-20.1') || r.texto.includes('-15.2'), false); // sem coordenadas
  assert.equal(r.texto.includes('corte raso'), false); // sem anotações dos pontos
});

test('resumo_operacao: DEM-0002 (80, Crítica), lista de operações e erros', async () => {
  const sul = await chamar('resumo_operacao', { id: 'DEM-0002', hoje: HOJE });
  assert.deepEqual([sul.dados.prioridade.score, sul.dados.prioridade.faixa, sul.dados.relatorios_pendentes], [80, 'Crítica', 3]);
  const lista = await chamar('resumo_operacao', {});
  assert.deepEqual(lista.dados.operacoes.map((o) => o.id), ['DEM-0001', 'DEM-0002']);
  assert.match((await chamar('resumo_operacao', { id: 'DEM-0003' })).texto, /não encontrada/); // é processo, não operação
  assert.match((await chamar('resumo_operacao', { id: 'xyz' })).texto, /formato DEM-0000/);
  assert.match((await chamar('resumo_operacao', { id: 'DEM-0001', hoje: 'ontem' })).texto, /"hoje" deve ser uma data válida/);
});

test('resumo_operacao muda com a data de referência (30/10: operação Norte vencida)', async () => {
  const r = await chamar('resumo_operacao', { id: 'DEM-0001', hoje: '2026-10-30' });
  assert.equal(r.dados.prioridade.score, 50 + 20 + 10 + 8); // vencida + operação + chefia + 6 pendentes
});

test('argumentos inválidos viram erro da ferramenta, não derrubam o servidor', async () => {
  const casos = [
    [{ tipo: 'xyz' }, /"tipo" deve ser um de/],
    [{ tipo: 'processo', origem: 'amigo' }, /"origem" deve ser um de/],
    [{ tipo: 'processo', status: 'feito' }, /"status" deve ser um de/],
    [{ tipo: 'processo', hoje: '2026-13-01' }, /"hoje" deve ser uma data válida/],
    [{ tipo: 'processo', prazo: '2026-10-20', segredo: 1 }, /Argumento desconhecido: segredo/],
    [{ tipo: 'processo', relatorios_pendentes: 3 }, /só se aplica ao tipo "operacao"/],
    [{ tipo: 'operacao', relatorios_pendentes: -1 }, /inteiro de 0 a 1000/],
    [{ tipo: 'operacao', relatorios_pendentes: 2.5 }, /inteiro de 0 a 1000/],
    [{ tipo: 'processo', afastamentos: 'sempre' }, /lista de até 20/],
    [{ tipo: 'processo', afastamentos: [{ inicio: '2026-11-10', fim: '2026-11-01' }] }, /fim não pode ser anterior/],
    [{ tipo: 'processo', afastamentos: [{ inicio: '2026-11-01', fim: '2026-11-10', x: 1 }] }, /Argumento desconhecido: x/],
    [{}, /"tipo" deve ser um de/],
  ];
  for (const [args, esperado] of casos) {
    const r = await chamar('priorizar_demanda', args);
    assert.equal(r.isError, true, JSON.stringify(args));
    assert.match(r.texto, esperado, JSON.stringify(args));
  }
  assert.equal((await chamar('listar_regras', { extra: 1 })).isError, true);
  assert.equal((await chamar('priorizar_demanda', { tipo: 'outra', prazo: '2026-10-20', hoje: HOJE })).isError, false); // continua funcionando
});

test('erros de protocolo: método, ferramenta, parâmetros, JSON inválido e lote', async () => {
  assert.equal((await c.requisitar('metodo/inexistente', {})).error.code, -32601);
  assert.equal((await c.requisitar('tools/call', { name: 'apagar_tudo', arguments: {} })).error.code, -32602);
  assert.equal((await c.requisitar('tools/call', { name: 'listar_regras', arguments: [] })).error.code, -32602);
  assert.equal((await c.requisitar('tools/call', {})).error.code, -32602);
  assert.equal((await c.requisitar('tools/list', [])).error.code, -32602);

  const antes = c.linhasBrutas.length;
  c.escreverBruto('isto não é json');
  c.escreverBruto('[{"jsonrpc":"2.0","id":7,"method":"ping"}]'); // lote não é suportado
  c.escreverBruto('{"id":8,"method":"ping"}'); // falta jsonrpc
  c.escreverBruto('');
  const pong = await c.requisitar('ping', {});
  assert.deepEqual(pong.result, {});
  const respostas = c.linhasBrutas.slice(antes, -1).map((l) => JSON.parse(l));
  assert.deepEqual(respostas.map((m) => [m.id, m.error.code]), [[null, -32700], [null, -32600], [null, -32600]]);
});

test('notificações não geram resposta, e respostas do cliente são ignoradas', async () => {
  c.notificar('notifications/initialized');
  c.notificar('notifications/cancelled', { requestId: 1 });
  c.escreverBruto('{"jsonrpc":"2.0","id":99,"result":{}}');
  assert.deepEqual(await eco(), []);
});

test('a saída padrão só tem mensagens JSON-RPC e o servidor não escreveu na saída de erro', async () => {
  await eco();
  assert.ok(c.linhasBrutas.length > 10);
  for (const linha of c.linhasBrutas) assert.equal(JSON.parse(linha).jsonrpc, '2.0');
  assert.equal(c.erroPadrao(), '');
});

test('somente leitura: o código do servidor não escreve arquivos, não usa rede nem executa processos', () => {
  const fonte = readFileSync(new URL('../tools/demandas-mcp.mjs', import.meta.url), 'utf8');
  const codigo = fonte.replace(/\/\/.*$/gm, ''); // ignora comentários
  for (const proibido of ['writeFile', 'appendFile', 'unlink', 'rmSync', 'mkdir', 'rename', 'child_process', 'node:http', 'node:https', 'node:net', 'node:dgram', 'fetch(', 'WebSocket', 'process.env', 'eval(', 'new Function']) {
    assert.equal(codigo.includes(proibido), false, `não deveria usar ${proibido}`);
  }
  const imports = [...fonte.matchAll(/^import .* from '([^']+)'/gm)].map((m) => m[1]);
  assert.deepEqual(imports.filter((i) => i.startsWith('node:')).sort(), ['node:fs', 'node:readline']);
  assert.equal([...codigo.matchAll(/readFileSync\(/g)].length, 1); // só lê o seed fictício
});
