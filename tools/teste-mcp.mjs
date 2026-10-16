#!/usr/bin/env node
// Teste do servidor MCP "demandas-lab" (slide 40 da aula): inicia o servidor, conversa com ele por stdio
// e mostra argumentos e retorno literais. Sai com código 1 se algum caso divergir do painel.
//   uso: node tools/teste-mcp.mjs        (ou: npm run mcp:test)
import { priorizar } from '../js/regras.js';
import { CASOS, HOJE, iniciarServidor, inicializar } from './mcp-apoio.mjs';

const cliente = iniciarServidor();
let falhas = 0;
const confere = (descricao, ok, detalhe = '') => {
  if (!ok) falhas++;
  console.log(`${ok ? 'OK   ' : 'FALHA'} ${descricao}${ok || !detalhe ? '' : ` — ${detalhe}`}`);
};

try {
  console.log('== 1. Conexão ==');
  const ini = await inicializar(cliente);
  console.log(`servidor: ${ini.result.serverInfo.name} ${ini.result.serverInfo.version} · protocolo ${ini.result.protocolVersion}`);
  confere('initialize respondeu com o nome demandas-lab', ini.result.serverInfo.name === 'demandas-lab');

  const lista = await cliente.requisitar('tools/list', {});
  const nomes = lista.result.tools.map((t) => t.name);
  console.log(`ferramentas: ${nomes.join(', ')}`);
  confere('3 ferramentas, todas somente leitura', nomes.length === 3 && lista.result.tools.every((t) => t.annotations.readOnlyHint === true));

  console.log('\n== 2. listar_regras ==');
  const regras = await cliente.chamar('listar_regras', {});
  confere(`tabela com ${regras.dados.pontuacao.length} critérios e ${regras.dados.faixas.length} faixas`, regras.dados.pontuacao.length === 14 && regras.dados.faixas.length === 4);
  for (const p of regras.dados.pontuacao.slice(0, 3)) console.log(`  ${p.criterio}: ${p.condicao} → +${p.pontos}`);
  console.log('  ...');

  console.log('\n== 3. priorizar_demanda — caso T1 (argumentos e retorno literais) ==');
  const t1 = CASOS[0];
  console.log('argumentos:');
  console.log(JSON.stringify(t1.argumentos, null, 2));
  const retornoT1 = await cliente.chamar('priorizar_demanda', t1.argumentos);
  console.log('retorno:');
  console.log(retornoT1.texto);

  console.log('\n== 4. Retorno do MCP × painel, casos T1–T6 (hoje = 2026-10-15) ==');
  console.log('caso  documentado   MCP           painel        iguais');
  for (const caso of CASOS) {
    const mcp = await cliente.chamar('priorizar_demanda', caso.argumentos);
    const painel = priorizar(caso.painel, HOJE, caso.contexto ?? {});
    const igual = !mcp.isError && mcp.dados.score === painel.score && mcp.dados.faixa === painel.faixa && JSON.stringify(mcp.dados.motivos) === JSON.stringify(painel.motivos);
    const bate = igual && painel.score === caso.score && painel.faixa === caso.faixa;
    const fmt = (s, f) => `${s} ${f}`.padEnd(13);
    console.log(`${caso.caso.padEnd(5)} ${fmt(caso.score, caso.faixa)} ${fmt(mcp.dados?.score, mcp.dados?.faixa)} ${fmt(painel.score, painel.faixa)} ${igual ? 'sim' : 'NÃO'}`);
    if (!bate) falhas++;
  }
  confere('T1–T6: retorno do MCP igual ao do painel (score, faixa e motivos)', falhas === 0);

  console.log('\n== 5. Casos de borda ==');
  const t7 = await cliente.chamar('priorizar_demanda', { tipo: 'reuniao', prazo: '2026-10-20', origem: 'chefia', status: 'concluida', hoje: HOJE });
  confere('T7 concluída: fora da fila', t7.dados.foraDaFila === true);
  const t8 = await cliente.chamar('priorizar_demanda', { tipo: 'processo', origem: 'mp', hoje: HOJE });
  confere('T8 prazo ausente: erro de validação', t8.isError === true && t8.texto === 'Erro de validação: Prazo ausente ou inválido', t8.texto);
  const sob = await cliente.chamar('priorizar_demanda', { tipo: 'processo', origem: 'mp', prazo: '2026-10-01', status: 'aguardando', hoje: HOJE });
  confere('T12 sobrestada: fora da fila, mesmo vencida', sob.dados.sobrestada === true);
  const ruim = await cliente.chamar('priorizar_demanda', { tipo: 'processo', segredo: 1 });
  confere('argumento desconhecido recusado', ruim.isError === true, ruim.texto);

  console.log('\n== 6. resumo_operacao (exemplo fictício) ==');
  const resumo = await cliente.chamar('resumo_operacao', { id: 'DEM-0001', hoje: HOJE });
  const r = resumo.dados;
  console.log(`  ${r.titulo}`);
  console.log(`  ${r.pontos} pontos · ${r.relatorios_pendentes} relatórios pendentes · ${r.autos_a_lavrar} auto a lavrar · prazo ${r.prazo_dos_relatorios}`);
  console.log(`  prioridade: ${r.prioridade.faixa} (${r.prioridade.score} pontos)`);
  confere('DEM-0001: 68 pontos, faixa Alta, como no painel', r.prioridade.score === 68 && r.prioridade.faixa === 'Alta');

  console.log('\n== 7. Protocolo ==');
  const desconhecido = await cliente.requisitar('metodo/inexistente', {});
  confere('método desconhecido: erro -32601', desconhecido.error?.code === -32601);
  const semFerramenta = await cliente.requisitar('tools/call', { name: 'apagar_tudo', arguments: {} });
  confere('ferramenta desconhecida: erro -32602', semFerramenta.error?.code === -32602);
  const limpa = cliente.linhasBrutas.every((l) => { try { return JSON.parse(l).jsonrpc === '2.0'; } catch { return false; } });
  confere('a saída padrão só tem mensagens JSON-RPC', limpa);
  confere('nada foi escrito na saída de erro', cliente.erroPadrao() === '', cliente.erroPadrao());
} catch (e) {
  falhas++;
  console.error(`FALHA inesperada: ${e.message}`);
} finally {
  await cliente.fechar();
}

console.log(falhas === 0 ? '\nTODAS AS VERIFICAÇÕES PASSARAM' : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
