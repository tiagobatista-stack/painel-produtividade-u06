// Cadastro, edição, status e filtros. Funções puras: não alteram os argumentos e não tocam em tela nem armazenamento.
import { dataValida, estaConcluida, estaSobrestada, prazoDemanda } from './indicadores.js';
import { priorizarFila } from './regras.js';
import { ORIGENS, STATUS, TIPOS } from './rotulos.js';

export const TIPOS_CADASTRAVEIS = ['processo', 'reuniao', 'palestra', 'outra'];
const ORIGENS_PROCESSO = Object.keys(ORIGENS);
const ORIGENS_GERAIS = ['chefia', 'propria'];

export function origensDoTipo(tipo) {
  return tipo === 'processo' ? ORIGENS_PROCESSO : ORIGENS_GERAIS;
}

export class ErroCadastro extends Error {
  constructor(erros) {
    super('Dados inválidos');
    this.name = 'ErroCadastro';
    this.erros = erros; // { campo: mensagem }
  }
}

const PRAZO_DIAS_MAX = 365;
const HORAS_MAX = 24;

const texto = (v) => (typeof v === 'string' ? v.trim() : '');
const vazio = (v) => v === undefined || v === null || String(v).trim() === '';

// Valida e normaliza os campos de acordo com o tipo. Lança ErroCadastro com todos os erros encontrados.
function normalizar(tipo, dados) {
  const erros = {};
  const limpo = {};

  limpo.titulo = texto(dados.titulo);
  if (!limpo.titulo) erros.titulo = 'Informe o título.';
  else if (limpo.titulo.length > 120) erros.titulo = 'Use no máximo 120 caracteres.';

  limpo.origem = dados.origem;
  if (!origensDoTipo(tipo).includes(limpo.origem)) erros.origem = 'Escolha uma origem válida para este tipo.';

  limpo.prazo = texto(dados.prazo);
  if (!dataValida(limpo.prazo)) erros.prazo = 'Informe um prazo válido.';

  limpo.status = dados.status;
  if (!(limpo.status in STATUS)) erros.status = 'Escolha um status.';

  if (!vazio(dados.esforco_h)) {
    const horas = Number(dados.esforco_h);
    if (!Number.isFinite(horas) || horas < 0) erros.esforco_h = 'Informe um número de horas igual ou maior que zero.';
    else limpo.esforco_h = horas;
  }

  if (tipo === 'processo') {
    limpo.processo = texto(dados.processo);
    if (!limpo.processo) erros.processo = 'Informe o número do processo (fictício).';
    if (!vazio(dados.etapa)) limpo.etapa = texto(dados.etapa);
  }

  if (tipo === 'reuniao' || tipo === 'palestra') {
    limpo.data_hora = texto(dados.data_hora);
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(limpo.data_hora) || !dataValida(limpo.data_hora.slice(0, 10))) {
      erros.data_hora = 'Informe data e hora válidas.';
    }
    limpo.local = texto(dados.local);
    if (!limpo.local) erros.local = 'Informe o local.';
  }

  if (tipo === 'palestra' && !vazio(dados.publico)) {
    const publico = Number(dados.publico);
    if (!Number.isInteger(publico) || publico < 0) erros.publico = 'Informe um número inteiro igual ou maior que zero.';
    else limpo.publico = publico;
  }

  if (Object.keys(erros).length) throw new ErroCadastro(erros);
  return limpo;
}

// Parâmetros editáveis da operação: prazo (dias após o retorno) e horas por relatório.
export function validarParametros({ prazo_dias, horas_ponto }) {
  const erros = {};
  const dias = Number(prazo_dias);
  const horas = Number(horas_ponto);
  if (String(prazo_dias ?? '').trim() === '' || !Number.isInteger(dias) || dias < 0 || dias > PRAZO_DIAS_MAX) {
    erros.prazo_dias = `Informe um número inteiro de 0 a ${PRAZO_DIAS_MAX}.`;
  }
  if (String(horas_ponto ?? '').trim() === '' || !Number.isFinite(horas) || horas <= 0 || horas > HORAS_MAX) {
    erros.horas_ponto = `Informe as horas por relatório (maior que 0 e até ${HORAS_MAX}).`;
  }
  if (Object.keys(erros).length) throw new ErroCadastro(erros);
  return { prazo_dias: dias, horas_ponto: horas };
}

// Edição de operação: título, origem e parâmetros. Status e prazo são derivados dos pontos.
function editarOperacao(original, dados, hoje) {
  const erros = {};
  const titulo = texto(dados.titulo);
  if (!titulo) erros.titulo = 'Informe o título.';
  else if (titulo.length > 120) erros.titulo = 'Use no máximo 120 caracteres.';
  if (!ORIGENS_GERAIS.includes(dados.origem)) erros.origem = 'Escolha uma origem válida para este tipo.';
  let parametros = {};
  try {
    parametros = validarParametros(dados);
  } catch (e) {
    if (!(e instanceof ErroCadastro)) throw e;
    Object.assign(erros, e.erros);
  }
  if (Object.keys(erros).length) throw new ErroCadastro(erros);
  return { ...original, titulo, origem: dados.origem, ...parametros, historico: [...(original.historico || []), { data: hoje, evento: 'Editada' }] };
}

export function proximoId(demandas) {
  const maior = demandas.reduce((max, d) => {
    const m = /^DEM-(\d+)$/.exec(d.id || '');
    return m ? Math.max(max, Number(m[1])) : max;
  }, 0);
  return `DEM-${String(maior + 1).padStart(4, '0')}`;
}

export function criarDemanda(dados, existentes, hoje) {
  if (!TIPOS_CADASTRAVEIS.includes(dados.tipo)) {
    throw new ErroCadastro({ tipo: 'Este tipo não é cadastrado por formulário (a operação vem da importação da planilha).' });
  }
  const limpo = normalizar(dados.tipo, dados);
  const demanda = { id: proximoId(existentes), tipo: dados.tipo, ...limpo, criada_em: hoje, historico: [{ data: hoje, evento: 'Criada' }] };
  if (demanda.status === 'concluida') demanda.concluida_em = hoje;
  return demanda;
}

export function editarDemanda(original, dados, hoje) {
  if (original.tipo === 'operacao') return editarOperacao(original, dados, hoje);
  const limpo = normalizar(original.tipo, dados);
  const { concluida_em, ...base } = original;
  const editada = { ...base, ...limpo, historico: [...(original.historico || []), { data: hoje, evento: 'Editada' }] };
  if (limpo.status !== original.status) {
    editada.historico.push({ data: hoje, evento: `Status: ${STATUS[original.status]} → ${STATUS[limpo.status]}` });
  }
  if (limpo.status === 'concluida') editada.concluida_em = original.status === 'concluida' ? concluida_em : hoje;
  return editada;
}

export function alterarStatus(demanda, novoStatus, hoje) {
  if (!(novoStatus in STATUS)) throw new ErroCadastro({ status: 'Escolha um status.' });
  if (demanda.tipo === 'operacao') throw new ErroCadastro({ status: 'O status da operação é derivado dos pontos. Para suspender o prazo, use "Sobrestar operação".' });
  if (novoStatus === demanda.status) return demanda;
  const { concluida_em, ...base } = demanda;
  const nova = {
    ...base,
    status: novoStatus,
    historico: [...(demanda.historico || []), { data: hoje, evento: `Status: ${STATUS[demanda.status]} → ${STATUS[novoStatus]}` }],
  };
  if (novoStatus === 'concluida') nova.concluida_em = hoje;
  return nova;
}

// Exclusão de demanda cadastrada por engano. Não altera a lista recebida.
export function removerDemanda(demandas, id) {
  return demandas.filter((d) => d.id !== id);
}

export function normalizarBusca(s) {
  return String(s ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

function textoPesquisavel(d) {
  const partes = [d.id, d.titulo, d.processo, d.etapa, d.local, d.equipe, TIPOS[d.tipo], ORIGENS[d.origem]];
  if (d.pontos) partes.push(...d.pontos.map((p) => p.municipio));
  return normalizarBusca(partes.filter(Boolean).join(' '));
}

// Estado padrão dos filtros: é o que "Limpar filtros" restaura. O status padrão é a fila ativa, não "todos".
export const FILTROS_PADRAO = Object.freeze({ busca: '', tipo: '', status: 'abertas', prioridade: '' });

// Há algum filtro diferente do padrão? Busca só com espaços não conta, porque não filtra nada.
export function filtrosEmUso(filtros) {
  const f = { ...FILTROS_PADRAO, ...filtros };
  return f.busca.trim() !== '' || f.tipo !== FILTROS_PADRAO.tipo || f.status !== FILTROS_PADRAO.status || f.prioridade !== FILTROS_PADRAO.prioridade;
}

// Lista a fila conforme os filtros.
// filtros: { busca, tipo, status, prioridade }
//   status: 'abertas' (padrão: fila ativa) | a_fazer | em_andamento | aguardando (sobrestadas) | concluida
//   prioridade: faixa ('Crítica' | 'Alta' | 'Média' | 'Baixa'); só existe para demandas abertas.
export function listarDemandas(demandas, filtros, hoje, contexto = {}) {
  const { busca = '', tipo = '', status = 'abertas', prioridade = '' } = filtros;
  const termos = normalizarBusca(busca).split(/\s+/).filter(Boolean);
  const confere = (d) => (!tipo || d.tipo === tipo) && termos.every((t) => textoPesquisavel(d).includes(t));

  if (status === 'concluida') {
    const itens = prioridade
      ? []
      : demandas
          .filter((d) => estaConcluida(d) && confere(d))
          .map((d) => ({ demanda: d, prazo: prazoDemanda(d), concluida: true }))
          .sort((a, b) => (b.demanda.concluida_em || '').localeCompare(a.demanda.concluida_em || ''));
    return { itens, erros: [] };
  }

  if (status === 'aguardando') {
    const itens = prioridade
      ? []
      : demandas
          .filter((d) => estaSobrestada(d) && confere(d))
          .map((d) => ({ demanda: d, prazo: prazoDemanda(d), sobrestada: true }))
          .sort((a, b) => (a.prazo ?? '9999').localeCompare(b.prazo ?? '9999'));
    return { itens, erros: [] };
  }

  const { fila, erros } = priorizarFila(demandas, hoje, contexto);
  const itens = fila.filter(
    (x) => confere(x.demanda) && (!prioridade || x.faixa === prioridade) && (status === 'abertas' || x.demanda.status === status)
  );
  return { itens, erros: erros.filter((x) => confere(x.demanda)) };
}
