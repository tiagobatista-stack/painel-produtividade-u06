#!/usr/bin/env node
// Servidor MCP local (stdio) do Painel de Demandas: "demandas-lab".
//
// Expõe a mesma política de prioridade do painel (js/regras.js) como ferramentas de consulta.
// Somente leitura: não escreve arquivos, não usa a rede, não executa processos e não tem dependências.
// Lê apenas data/seed.json (dados fictícios). Não enxerga os dados do navegador.
//
// Protocolo: JSON-RPC 2.0 por stdio, uma mensagem JSON por linha (transporte stdio do MCP).
// A saída padrão carrega somente mensagens do protocolo; diagnósticos vão para a saída de erro.
import { createInterface } from 'node:readline';
import { readFileSync } from 'node:fs';
import { REGRAS, ErroValidacao, priorizar } from '../js/regras.js';
import { autosALavrar, dataValida, prazoDemanda, relatoriosPendentes } from '../js/indicadores.js';
import { esforcoHoras } from '../js/operacoes.js';
import { ETAPAS_PONTO } from '../js/rotulos.js';

const NOME = 'demandas-lab';
const VERSAO = '0.1.0';
const PROTOCOLOS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const TAMANHO_MAXIMO_LINHA = 1_000_000;

const TIPOS = ['operacao', 'processo', 'reuniao', 'palestra', 'outra'];
const ORIGENS = ['mp', 'judiciario', 'procuradoria', 'ouvidoria', 'denuncia', 'chefia', 'propria'];
const STATUS = ['a_fazer', 'em_andamento', 'aguardando', 'concluida'];
const PADRAO_DATA = '^\\d{4}-\\d{2}-\\d{2}$';
const SOMENTE_LEITURA = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

// ---------- Ferramentas ----------

const FERRAMENTAS = [
  {
    name: 'listar_regras',
    title: 'Listar regras de prioridade',
    description:
      'Lista a tabela de pontos, as faixas e as regras complementares de prioridade do Painel de Demandas (fonte: docs/REGRAS_PRIORIDADE.md). ' +
      'Os pesos são uma proposta inicial, a validar com a chefia. Não recebe argumentos e não altera nada.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: SOMENTE_LEITURA,
  },
  {
    name: 'priorizar_demanda',
    title: 'Calcular a prioridade de uma demanda',
    description:
      'Calcula score, faixa e motivos de uma demanda com o mesmo motor do painel. Use apenas dados fictícios. ' +
      'Informe sempre "hoje" para um resultado reprodutível. Na operação, "prazo" é o prazo dos relatórios (retorno + N dias) e ' +
      '"relatorios_pendentes" é o número de relatórios ainda não concluídos. Demanda concluída ou com status "aguardando" (sobrestada) ' +
      'sai da fila: o retorno traz foraDaFila. Prazo ausente ou inválido é erro de validação.',
    inputSchema: {
      type: 'object',
      properties: {
        tipo: { type: 'string', enum: TIPOS, description: 'Tipo da demanda.' },
        prazo: { type: 'string', pattern: PADRAO_DATA, description: 'Prazo, no formato aaaa-mm-dd.' },
        origem: { type: 'string', enum: ORIGENS, default: 'propria', description: 'Origem da demanda ("chefia" = chefia ou coordenação).' },
        relatorios_pendentes: { type: 'integer', minimum: 0, maximum: 1000, description: 'Somente para tipo "operacao".' },
        status: { type: 'string', enum: STATUS, default: 'a_fazer', description: '"aguardando" = sobrestada; "concluida" sai da fila.' },
        hoje: { type: 'string', pattern: PADRAO_DATA, description: 'Data de referência aaaa-mm-dd. Padrão: data de hoje do servidor.' },
        afastamentos: {
          type: 'array',
          maxItems: 20,
          items: {
            type: 'object',
            properties: { inicio: { type: 'string', pattern: PADRAO_DATA }, fim: { type: 'string', pattern: PADRAO_DATA } },
            required: ['inicio', 'fim'],
            additionalProperties: false,
          },
          description: 'Férias, licenças ou compensações agendadas; prazo dentro de um período soma pontos.',
        },
      },
      required: ['tipo'],
      additionalProperties: false,
    },
    annotations: SOMENTE_LEITURA,
  },
  {
    name: 'resumo_operacao',
    title: 'Resumir uma operação de alertas do exemplo',
    description:
      'Resume uma operação de alertas do exemplo fictício (data/seed.json): equipe, datas, prazo, pontos por etapa, relatórios pendentes, ' +
      'autos a lavrar, esforço e prioridade. Sem "id", lista as operações disponíveis. Opera somente sobre o exemplo fictício: ' +
      'não envie planilhas nem dados reais. Não devolve coordenadas nem anotações dos pontos.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', pattern: '^DEM-\\d{4}$', description: 'Identificador da operação, por exemplo DEM-0001.' },
        hoje: { type: 'string', pattern: PADRAO_DATA, description: 'Data de referência aaaa-mm-dd. Padrão: data de hoje do servidor.' },
      },
      additionalProperties: false,
    },
    annotations: SOMENTE_LEITURA,
  },
];

class ErroDeArgumento extends Error {}

const ehObjeto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const hojeLocal = () => new Date().toLocaleDateString('en-CA');

function exigirSomente(args, permitidos) {
  const extras = Object.keys(args).filter((k) => !permitidos.includes(k));
  if (extras.length) throw new ErroDeArgumento(`Argumento desconhecido: ${extras.join(', ')}.`);
}

function lerData(valor, nome) {
  if (!dataValida(valor)) throw new ErroDeArgumento(`"${nome}" deve ser uma data válida no formato aaaa-mm-dd.`);
  return valor;
}

function escolher(valor, nome, validos) {
  if (!validos.includes(valor)) throw new ErroDeArgumento(`"${nome}" deve ser um de: ${validos.join(', ')}.`);
  return valor;
}

function listarRegras() {
  const p = REGRAS.prazo;
  const t = REGRAS.tipo;
  const o = REGRAS.origemProcesso;
  const [pend10, pend5] = REGRAS.relatoriosPendentes;
  return {
    fonte: 'docs/REGRAS_PRIORIDADE.md',
    observacao: 'Pesos de prioridade são proposta inicial, a validar com a chefia antes de qualquer uso real.',
    pontuacao: [
      { criterio: 'Prazo', condicao: 'vencido', pontos: p.vencido },
      { criterio: 'Prazo', condicao: 'vence em 0 a 2 dias', pontos: p.ate2dias },
      { criterio: 'Prazo', condicao: 'vence em 3 a 7 dias', pontos: p.de3a7dias },
      { criterio: 'Tipo', condicao: 'operação de alertas', pontos: t.operacao },
      { criterio: 'Tipo', condicao: 'processo SIGADOC', pontos: t.processo },
      { criterio: 'Tipo', condicao: 'reunião', pontos: t.reuniao },
      { criterio: 'Tipo', condicao: 'palestra', pontos: t.palestra },
      { criterio: 'Origem do processo', condicao: 'Ministério Público, Poder Judiciário ou Procuradoria de Justiça', pontos: o.mp },
      { criterio: 'Origem do processo', condicao: 'Ouvidoria', pontos: o.ouvidoria },
      { criterio: 'Origem do processo', condicao: 'Denúncia', pontos: o.denuncia },
      { criterio: 'Origem', condicao: 'Chefia ou coordenação', pontos: REGRAS.chefia },
      { criterio: 'Operação', condicao: `${pend10.minimo} ou mais relatórios pendentes`, pontos: pend10.pontos },
      { criterio: 'Operação', condicao: `${pend5.minimo} a ${pend10.minimo - 1} relatórios pendentes`, pontos: pend5.pontos },
      { criterio: 'Afastamento', condicao: 'prazo dentro de férias, licença-prêmio ou compensação agendada', pontos: REGRAS.afastamento },
    ],
    faixas: REGRAS.faixas.map((f, i) => {
      const acima = REGRAS.faixas[i - 1];
      const condicao = !acima ? `score >= ${f.minimo}` : f.minimo === 0 ? `score < ${acima.minimo}` : `${f.minimo} a ${acima.minimo - 1}`;
      return { faixa: f.nome, condicao };
    }),
    regras_complementares: [
      'Os pontos se somam, sem teto.',
      'Demanda concluída sai da fila (na operação: todos os pontos encerrados).',
      'Demanda sobrestada (status "aguardando") tem o prazo suspenso: sai da fila e não pontua.',
      'Desempate: maior score, depois prazo mais próximo, depois data de criação.',
      'Prazo ausente ou inválido gera erro de validação, sem cálculo.',
      'Prazo de hoje (0 dias) entra na faixa de 0 a 2 dias.',
    ],
  };
}

function priorizarDemanda(args) {
  exigirSomente(args, ['tipo', 'prazo', 'origem', 'relatorios_pendentes', 'status', 'hoje', 'afastamentos']);
  const tipo = escolher(args.tipo, 'tipo', TIPOS);
  const origem = escolher(args.origem ?? 'propria', 'origem', ORIGENS);
  const status = escolher(args.status ?? 'a_fazer', 'status', STATUS);
  const hoje = args.hoje === undefined ? hojeLocal() : lerData(args.hoje, 'hoje');

  if (args.relatorios_pendentes !== undefined) {
    if (tipo !== 'operacao') throw new ErroDeArgumento('"relatorios_pendentes" só se aplica ao tipo "operacao".');
    if (!Number.isInteger(args.relatorios_pendentes) || args.relatorios_pendentes < 0 || args.relatorios_pendentes > 1000) {
      throw new ErroDeArgumento('"relatorios_pendentes" deve ser um inteiro de 0 a 1000.');
    }
  }
  let afastamentos = [];
  if (args.afastamentos !== undefined) {
    if (!Array.isArray(args.afastamentos) || args.afastamentos.length > 20) throw new ErroDeArgumento('"afastamentos" deve ser uma lista de até 20 períodos.');
    afastamentos = args.afastamentos.map((a, i) => {
      if (!ehObjeto(a)) throw new ErroDeArgumento(`afastamentos[${i}] deve ser um objeto com inicio e fim.`);
      exigirSomente(a, ['inicio', 'fim']);
      const inicio = lerData(a.inicio, `afastamentos[${i}].inicio`);
      const fim = lerData(a.fim, `afastamentos[${i}].fim`);
      if (fim < inicio) throw new ErroDeArgumento(`afastamentos[${i}]: o fim não pode ser anterior ao início.`);
      return { inicio, fim };
    });
  }
  // O prazo não é validado aqui: prazo ausente ou inválido é erro de validação do motor (caso T8).
  const prazo = typeof args.prazo === 'string' ? args.prazo : undefined;

  const demanda = { id: 'MCP', tipo, origem, status, criada_em: hoje };
  if (tipo === 'operacao') {
    const n = args.relatorios_pendentes ?? 0;
    // Prazo da operação = retorno + prazo_dias; aqui o prazo informado já é o prazo dos relatórios.
    Object.assign(demanda, { retorno: prazo, prazo_dias: 0, pontos: Array.from({ length: n }, (_, i) => ({ n: i + 1, etapa: 'vistoriado' })) });
  } else {
    demanda.prazo = prazo;
  }
  const resultado = priorizar(demanda, hoje, { afastamentos });
  const entrada = { tipo, origem, status, prazo: prazo ?? null, hoje };
  if (tipo === 'operacao') entrada.relatorios_pendentes = args.relatorios_pendentes ?? 0;
  if (afastamentos.length) entrada.afastamentos = afastamentos;
  return { ...resultado, entrada };
}

function lerSeed() {
  return JSON.parse(readFileSync(new URL('../data/seed.json', import.meta.url), 'utf8'));
}

function resumoOperacao(args) {
  exigirSomente(args, ['id', 'hoje']);
  const hoje = args.hoje === undefined ? hojeLocal() : lerData(args.hoje, 'hoje');
  const seed = lerSeed();
  const operacoes = seed.demandas.filter((d) => d.tipo === 'operacao');
  if (args.id === undefined) {
    return { aviso: 'Operações do exemplo fictício (data/seed.json).', operacoes: operacoes.map((d) => ({ id: d.id, titulo: d.titulo, equipe: d.equipe })) };
  }
  if (typeof args.id !== 'string' || !/^DEM-\d{4}$/.test(args.id)) throw new ErroDeArgumento('"id" deve ter o formato DEM-0000.');
  const op = operacoes.find((d) => d.id === args.id);
  if (!op) throw new ErroDeArgumento(`Operação ${args.id} não encontrada no exemplo. Disponíveis: ${operacoes.map((d) => d.id).join(', ')}.`);

  const porEtapa = Object.fromEntries(Object.keys(ETAPAS_PONTO).map((e) => [e, op.pontos.filter((p) => p.etapa === e).length]));
  return {
    aviso: 'Exemplo fictício (data/seed.json). Sem coordenadas nem anotações dos pontos.',
    id: op.id,
    titulo: op.titulo,
    equipe: op.equipe,
    status: op.status,
    sobrestada: Boolean(op.sobrestada),
    saida: op.saida,
    retorno: op.retorno,
    prazo_dias: op.prazo_dias,
    prazo_dos_relatorios: prazoDemanda(op),
    horas_por_relatorio: op.horas_ponto,
    pontos: op.pontos.length,
    municipios: [...new Set(op.pontos.map((p) => p.municipio))],
    pontos_por_etapa: porEtapa,
    relatorios_pendentes: relatoriosPendentes(op),
    autos_a_lavrar: autosALavrar(op),
    esforco_estimado_h: esforcoHoras(op),
    hoje,
    prioridade: priorizar(op, hoje, { afastamentos: seed.afastamentos }),
  };
}

function listarRegrasComArgumentos(args) {
  exigirSomente(args, []);
  return listarRegras();
}

const EXECUTORES = { listar_regras: listarRegrasComArgumentos, priorizar_demanda: priorizarDemanda, resumo_operacao: resumoOperacao };

function executarFerramenta(nome, args) {
  try {
    const dados = EXECUTORES[nome](args);
    return { content: [{ type: 'text', text: JSON.stringify(dados, null, 2) }] };
  } catch (e) {
    if (e instanceof ErroDeArgumento) return { isError: true, content: [{ type: 'text', text: `Argumento inválido: ${e.message}` }] };
    if (e instanceof ErroValidacao) return { isError: true, content: [{ type: 'text', text: `Erro de validação: ${e.message}` }] };
    process.stderr.write(`[${NOME}] erro inesperado em ${nome}: ${e?.stack ?? e}\n`);
    return { isError: true, content: [{ type: 'text', text: 'Erro interno ao executar a ferramenta.' }] };
  }
}

// ---------- Protocolo JSON-RPC ----------

const escrever = (mensagem) => process.stdout.write(`${JSON.stringify(mensagem)}\n`);
const responder = (id, result) => escrever({ jsonrpc: '2.0', id, result });
const falhar = (id, code, message) => escrever({ jsonrpc: '2.0', id, error: { code, message } });

function tratar(msg) {
  if (!ehObjeto(msg) || msg.jsonrpc !== '2.0') return falhar(null, -32600, 'Requisição inválida: esperado um objeto JSON-RPC 2.0.');
  const temId = Object.hasOwn(msg, 'id');
  if (typeof msg.method !== 'string') {
    // Respostas do cliente a requisições do servidor: este servidor não faz requisições.
    return temId && ('result' in msg || 'error' in msg) ? undefined : falhar(temId ? msg.id : null, -32600, 'Requisição inválida: falta "method".');
  }
  if (!temId) return; // notificações (ex.: notifications/initialized) não têm resposta
  const { id, method } = msg;
  const params = msg.params ?? {};
  if (!ehObjeto(params)) return falhar(id, -32602, 'Parâmetros inválidos: esperado um objeto.');

  switch (method) {
    case 'initialize': {
      const pedido = params.protocolVersion;
      return responder(id, {
        protocolVersion: PROTOCOLOS.includes(pedido) ? pedido : PROTOCOLOS[0],
        capabilities: { tools: {} },
        serverInfo: { name: NOME, title: 'Painel de Demandas (laboratório)', version: VERSAO },
        instructions: 'Ferramentas de consulta somente leitura sobre a política de prioridade do Painel de Demandas. Use apenas dados fictícios.',
      });
    }
    case 'ping':
      return responder(id, {});
    case 'tools/list':
      return responder(id, { tools: FERRAMENTAS });
    case 'tools/call': {
      if (typeof params.name !== 'string' || !(params.name in EXECUTORES)) return falhar(id, -32602, `Ferramenta desconhecida: ${params.name}`);
      const args = params.arguments ?? {};
      if (!ehObjeto(args)) return falhar(id, -32602, 'Parâmetros inválidos: "arguments" deve ser um objeto.');
      return responder(id, executarFerramenta(params.name, args));
    }
    default:
      return falhar(id, -32601, `Método não encontrado: ${method}`);
  }
}

const leitor = createInterface({ input: process.stdin, crlfDelay: Infinity });
leitor.on('line', (linha) => {
  if (linha.trim() === '') return;
  if (linha.length > TAMANHO_MAXIMO_LINHA) return falhar(null, -32600, 'Mensagem grande demais.');
  let msg;
  try {
    msg = JSON.parse(linha);
  } catch {
    return falhar(null, -32700, 'JSON inválido.');
  }
  try {
    tratar(msg);
  } catch (e) {
    process.stderr.write(`[${NOME}] erro inesperado: ${e?.stack ?? e}\n`);
    falhar(ehObjeto(msg) && Object.hasOwn(msg, 'id') ? msg.id : null, -32603, 'Erro interno.');
  }
});
leitor.on('close', () => process.exit(0));
