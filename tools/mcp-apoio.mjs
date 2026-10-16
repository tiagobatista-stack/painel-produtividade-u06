// Apoio ao teste do servidor MCP: cliente JSON-RPC por stdio e os casos T1–T6 (com a demanda montada do lado do painel).
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

const SERVIDOR = fileURLToPath(new URL('./demandas-mcp.mjs', import.meta.url));

// Inicia o servidor como processo filho e devolve um cliente mínimo.
export function iniciarServidor() {
  const filho = spawn(process.execPath, [SERVIDOR], { stdio: ['pipe', 'pipe', 'pipe'] });
  const linhasBrutas = []; // tudo o que o servidor escreveu na saída padrão
  const esperando = new Map();
  let proximoId = 1;
  let erroPadrao = '';
  filho.stderr.on('data', (d) => { erroPadrao += d; });
  createInterface({ input: filho.stdout }).on('line', (linha) => {
    linhasBrutas.push(linha);
    let msg;
    try { msg = JSON.parse(linha); } catch { return; }
    if (msg.id !== undefined && esperando.has(msg.id)) {
      esperando.get(msg.id)(msg);
      esperando.delete(msg.id);
    }
  });

  const escreverBruto = (texto) => filho.stdin.write(texto + '\n');
  const requisitar = (method, params, { timeoutMs = 5000 } = {}) =>
    new Promise((resolve, reject) => {
      const id = proximoId++;
      const timer = setTimeout(() => { esperando.delete(id); reject(new Error(`Sem resposta para ${method} em ${timeoutMs} ms`)); }, timeoutMs);
      esperando.set(id, (msg) => { clearTimeout(timer); resolve(msg); });
      escreverBruto(JSON.stringify({ jsonrpc: '2.0', id, method, params }));
    });
  const notificar = (method, params) => escreverBruto(JSON.stringify({ jsonrpc: '2.0', method, params }));
  const chamar = async (name, args) => {
    const resposta = await requisitar('tools/call', { name, arguments: args });
    if (resposta.error) return { erroProtocolo: resposta.error };
    const { content, isError } = resposta.result;
    const texto = content[0].text;
    let dados = null;
    try { dados = JSON.parse(texto); } catch { /* mensagem em texto */ }
    return { isError: Boolean(isError), texto, dados };
  };
  const fechar = () => new Promise((resolve) => { filho.once('close', resolve); filho.stdin.end(); });

  return { requisitar, notificar, chamar, escreverBruto, fechar, linhasBrutas, erroPadrao: () => erroPadrao };
}

export async function inicializar(cliente, protocolVersion = '2025-06-18') {
  const resposta = await cliente.requisitar('initialize', {
    protocolVersion,
    capabilities: {},
    clientInfo: { name: 'teste-mcp', version: '1.0.0' },
  });
  cliente.notificar('notifications/initialized');
  return resposta;
}

// Casos T1–T6 de docs/REGRAS_PRIORIDADE.md (hoje = 2026-10-15).
// `argumentos`: o que se envia ao MCP. `painel`: a demanda montada de forma independente, como a interface a representaria.
const pontos = (pendentes) => [
  ...Array.from({ length: pendentes }, (_, i) => ({ n: i + 1, etapa: 'vistoriado' })),
  { n: 99, etapa: 'auto_lavrado' },
];
const operacao = (retorno, pendentes, origem) => ({
  id: 'T', tipo: 'operacao', origem, status: 'em_andamento', criada_em: '2026-10-01', retorno, prazo_dias: 0, pontos: pontos(pendentes),
});
const simples = (tipo, origem, prazo) => ({ id: 'T', tipo, origem, status: 'a_fazer', criada_em: '2026-10-01', prazo });

export const HOJE = '2026-10-15';
export const FERIAS = [{ inicio: '2026-11-03', fim: '2026-11-17' }];

export const CASOS = [
  { caso: 'T1', descricao: 'Operação vencida há 1 dia, 12 pendentes, coordenação', score: 95, faixa: 'Crítica',
    argumentos: { tipo: 'operacao', relatorios_pendentes: 12, prazo: '2026-10-14', origem: 'chefia', hoje: HOJE },
    painel: operacao('2026-10-14', 12, 'chefia') },
  { caso: 'T2', descricao: 'Processo SIGADOC vencido, Ministério Público', score: 90, faixa: 'Crítica',
    argumentos: { tipo: 'processo', prazo: '2026-10-14', origem: 'mp', hoje: HOJE },
    painel: simples('processo', 'mp', '2026-10-14') },
  { caso: 'T3', descricao: 'Operação vence em 2 dias, 7 pendentes, coordenação', score: 68, faixa: 'Alta',
    argumentos: { tipo: 'operacao', relatorios_pendentes: 7, prazo: '2026-10-17', origem: 'chefia', hoje: HOJE },
    painel: operacao('2026-10-17', 7, 'chefia') },
  { caso: 'T4', descricao: 'Processo vence em 22 dias, dentro das férias, Poder Judiciário', score: 60, faixa: 'Alta',
    argumentos: { tipo: 'processo', prazo: '2026-11-06', origem: 'judiciario', hoje: HOJE, afastamentos: FERIAS },
    painel: simples('processo', 'judiciario', '2026-11-06'), contexto: { afastamentos: FERIAS } },
  { caso: 'T5', descricao: 'Processo vence em 1 dia, chefia', score: 55, faixa: 'Alta',
    argumentos: { tipo: 'processo', prazo: '2026-10-16', origem: 'chefia', hoje: HOJE },
    painel: simples('processo', 'chefia', '2026-10-16') },
  { caso: 'T6', descricao: 'Reunião vence em 5 dias, chefia', score: 35, faixa: 'Média',
    argumentos: { tipo: 'reuniao', prazo: '2026-10-20', origem: 'chefia', hoje: HOJE },
    painel: simples('reuniao', 'chefia', '2026-10-20') },
];
