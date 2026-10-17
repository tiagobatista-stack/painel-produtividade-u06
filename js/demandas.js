// Cadastro, edição, status e filtros. Funções puras: não alteram os argumentos e não tocam em tela nem armazenamento.
import { dataValida, estaConcluida, estaSobrestada, itensDosIndicadores, prazoDemanda } from './indicadores.js';
import { ErroValidacao, faixaManual, priorizar, priorizarFila } from './regras.js';
import { ETAPAS, ETAPA_ANTIGA, ORIGENS, PRIORIDADE_MANUAL, STATUS, TIPOS } from './rotulos.js';
import { alternarAnotacao, eventosDeConclusao, normalizarAnotacoes } from './anotacoes.js';

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

const DESCRICAO_MAX = 2000;
const MOTIVO_MAX = 200;
const CURTO_MAX = 120;
// Campos opcionais: quando ficam vazios na edição, o valor antigo é removido em vez de ficar para trás.
const OPCIONAIS = ['descricao', 'responsavel', 'municipio', 'protocolo', 'etapa', 'prioridade_manual', 'motivo_ajuste'];

const texto = (v) => (typeof v === 'string' ? v.trim() : '');
const vazio = (v) => v === undefined || v === null || String(v).trim() === '';

// Campos comuns a todos os tipos (inclusive a operação): título, descrição, responsável, município, protocolo,
// ajuste manual de prioridade e anotações. Preenche `limpo` e `erros`.
function normalizarComuns(dados, limpo, erros, hoje) {
  limpo.titulo = texto(dados.titulo);
  if (!limpo.titulo) erros.titulo = 'Informe o título.';
  else if (limpo.titulo.length > 120) erros.titulo = 'Use no máximo 120 caracteres.';

  const descricao = texto(dados.descricao);
  if (descricao.length > DESCRICAO_MAX) erros.descricao = `Use no máximo ${DESCRICAO_MAX} caracteres.`;
  else if (descricao) limpo.descricao = descricao;

  for (const campo of ['responsavel', 'municipio', 'protocolo']) {
    const valor = texto(dados[campo]);
    if (valor.length > CURTO_MAX) erros[campo] = `Use no máximo ${CURTO_MAX} caracteres.`;
    else if (valor) limpo[campo] = valor;
  }

  // Prioridade: vazio = automática (calculada). Com ajuste manual, o motivo é obrigatório.
  const manual = texto(dados.prioridade_manual);
  if (manual) {
    if (!(manual in PRIORIDADE_MANUAL)) erros.prioridade_manual = 'Escolha automática, baixa, média, alta ou crítica.';
    else limpo.prioridade_manual = manual;
    const motivo = texto(dados.motivo_ajuste);
    if (!motivo) erros.motivo_ajuste = 'Informe o motivo do ajuste.';
    else if (motivo.length > MOTIVO_MAX) erros.motivo_ajuste = `Use no máximo ${MOTIVO_MAX} caracteres.`;
    else limpo.motivo_ajuste = motivo;
  }

  limpo.anotacoes = normalizarAnotacoes(dados.anotacoes, hoje);
}

// Valida e normaliza os campos de acordo com o tipo. Lança ErroCadastro com todos os erros encontrados.
function normalizar(tipo, dados, hoje) {
  const erros = {};
  const limpo = {};

  normalizarComuns(dados, limpo, erros, hoje);

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
    // O número do processo é o próprio protocolo/referência (normalizarComuns).
    if (!vazio(dados.etapa)) {
      if (texto(dados.etapa) in ETAPAS.processo) limpo.etapa = texto(dados.etapa);
      else erros.etapa = 'Escolha uma etapa da lista.';
    }
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

// Edição de operação: título, origem, parâmetros e campos comuns. Status e prazo são derivados dos pontos.
function editarOperacao(original, dados, hoje) {
  const erros = {};
  const limpo = {};
  normalizarComuns(semAnotacoesOmitidas(original, dados), limpo, erros, hoje);
  if (!ORIGENS_GERAIS.includes(dados.origem)) erros.origem = 'Escolha uma origem válida para este tipo.';
  let parametros = {};
  try {
    parametros = validarParametros(dados);
  } catch (e) {
    if (!(e instanceof ErroCadastro)) throw e;
    Object.assign(erros, e.erros);
  }
  if (Object.keys(erros).length) throw new ErroCadastro(erros);
  const historico = [...(original.historico || []), { data: hoje, evento: 'Editada' }, ...eventosEdicao(original, limpo, hoje)];
  return { ...semOpcionais(original), ...limpo, origem: dados.origem, ...parametros, historico };
}

// Quem edita sem informar `anotacoes` (por exemplo, outro módulo) não apaga a lista existente.
function semAnotacoesOmitidas(original, dados) {
  return dados.anotacoes === undefined ? { ...dados, anotacoes: original.anotacoes } : dados;
}

function semOpcionais(demanda) {
  const base = { ...demanda };
  for (const campo of OPCIONAIS) delete base[campo];
  return base;
}

const rotuloPrioridade = (d) => (faixaManual(d) ? `${faixaManual(d)} (manual)` : 'Automática');

// Eventos de histórico além de "Editada": mudança de prioridade (manual/automática) e anotações concluídas.
function eventosEdicao(original, limpo, hoje) {
  const eventos = [];
  if (rotuloPrioridade(original) !== rotuloPrioridade(limpo)) {
    eventos.push({ data: hoje, evento: `Prioridade: ${rotuloPrioridade(original)} → ${rotuloPrioridade(limpo)}` });
  }
  for (const evento of eventosDeConclusao(original.anotacoes, limpo.anotacoes)) eventos.push({ data: hoje, evento });
  return eventos;
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
  const limpo = normalizar(dados.tipo, dados, hoje);
  const historico = [{ data: hoje, evento: 'Criada' }, ...eventosDeConclusao([], limpo.anotacoes).map((evento) => ({ data: hoje, evento }))];
  const demanda = { id: proximoId(existentes), tipo: dados.tipo, ...limpo, criada_em: hoje, historico };
  if (demanda.status === 'concluida') demanda.concluida_em = hoje;
  return demanda;
}

export function editarDemanda(original, dados, hoje) {
  if (original.tipo === 'operacao') return editarOperacao(original, dados, hoje);
  const limpo = normalizar(original.tipo, semAnotacoesOmitidas(original, dados), hoje);
  const { concluida_em, ...base } = semOpcionais(original);
  const editada = { ...base, ...limpo, historico: [...(original.historico || []), { data: hoje, evento: 'Editada' }, ...eventosEdicao(original, limpo, hoje)] };
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

// Marca ou desmarca uma anotação direto do cartão. Concluir registra "Anotação concluída" no histórico.
export function alternarAnotacaoDaDemanda(demanda, idAnotacao, hoje) {
  const antes = demanda.anotacoes ?? [];
  if (!antes.some((a) => a.id === idAnotacao)) return demanda;
  const depois = alternarAnotacao(antes, idAnotacao, hoje);
  const historico = [...(demanda.historico || []), ...eventosDeConclusao(antes, depois).map((evento) => ({ data: hoje, evento }))];
  return { ...demanda, anotacoes: depois, historico };
}

// Migração de dados salvos antes dos campos novos (idempotente): `processo` vira `protocolo`, a etapa passa a ser
// um valor da lista fixa, e toda demanda ganha `anotacoes`. Não altera o argumento.
export function migrarDemanda(demanda) {
  const d = { ...demanda };
  if ('processo' in d) {
    if (!d.protocolo && typeof d.processo === 'string' && d.processo.trim()) d.protocolo = d.processo.trim();
    delete d.processo;
  }
  if (d.tipo === 'processo' && d.etapa !== undefined) {
    const etapa = d.etapa in ETAPAS.processo ? d.etapa : ETAPA_ANTIGA[d.etapa];
    if (etapa) d.etapa = etapa;
    else delete d.etapa;
  }
  for (const campo of ['descricao', 'responsavel', 'municipio', 'protocolo', 'motivo_ajuste']) {
    if (d[campo] !== undefined && typeof d[campo] !== 'string') delete d[campo];
  }
  if (d.prioridade_manual !== undefined && !(d.prioridade_manual in PRIORIDADE_MANUAL)) {
    delete d.prioridade_manual;
    delete d.motivo_ajuste;
  }
  // Texto livre antigo (`observacoes`) vira uma anotação por linha, no fim da lista.
  if (typeof d.observacoes === 'string' && d.observacoes.trim()) {
    const linhas = d.observacoes.split(/\r\n|\r|\n/).map((l) => ({ texto: l })).filter((l) => l.texto.trim());
    d.anotacoes = normalizarAnotacoes([...(Array.isArray(d.anotacoes) ? d.anotacoes : []), ...linhas]);
  } else {
    d.anotacoes = normalizarAnotacoes(d.anotacoes);
  }
  delete d.observacoes;
  return d;
}

// Exclusão de demanda cadastrada por engano. Não altera a lista recebida.
export function removerDemanda(demandas, id) {
  return demandas.filter((d) => d.id !== id);
}

// Desfaz uma exclusão: devolve a demanda à posição em que estava. Recusa se o número já foi reaproveitado por outra
// (proximoId usa o maior id + 1, então apagar a última demanda e criar outra repete o número).
export function restaurarDemanda(demandas, demanda, indice) {
  if (demandas.some((d) => d.id === demanda.id)) {
    throw new ErroCadastro({ id: `Não foi possível desfazer: o número ${demanda.id} já foi usado por outra demanda.` });
  }
  const i = Number.isInteger(indice) ? Math.min(Math.max(indice, 0), demandas.length) : demandas.length;
  return [...demandas.slice(0, i), demanda, ...demandas.slice(i)];
}

// Situação de uma demanda (faixa, pontos e motivos) sem depender dos filtros da fila: usada pelo painel lateral.
// Mesmo formato dos itens de listarDemandas; `erro` só aparece se o prazo for inválido.
export function itemDaDemanda(demanda, hoje, contexto = {}) {
  const prazo = prazoDemanda(demanda);
  if (estaConcluida(demanda)) return { demanda, prazo, concluida: true };
  if (estaSobrestada(demanda)) return { demanda, prazo, sobrestada: true };
  try {
    const r = priorizar(demanda, hoje, contexto);
    const manual = faixaManual(demanda);
    return { demanda, prazo, ...r, faixa: manual ?? r.faixa, faixa_calculada: r.faixa, modo: manual ? 'manual' : 'automatica' };
  } catch (e) {
    if (!(e instanceof ErroValidacao)) throw e;
    return { demanda, prazo, erro: e.message };
  }
}

export function normalizarBusca(s) {
  return String(s ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

function textoPesquisavel(d) {
  const partes = [d.id, d.titulo, d.descricao, d.responsavel, d.municipio, d.protocolo, ETAPAS.processo[d.etapa], d.local, d.equipe, TIPOS[d.tipo], ORIGENS[d.origem]];
  if (d.anotacoes) partes.push(...d.anotacoes.map((a) => a.texto));
  if (d.pontos) partes.push(...d.pontos.map((p) => p.municipio));
  return normalizarBusca(partes.filter(Boolean).join(' '));
}

// Estado padrão dos filtros: é o que "Limpar filtros" restaura. O status padrão é a fila ativa, não "todos".
export const FILTROS_PADRAO = Object.freeze({ busca: '', tipo: '', status: 'abertas', prioridade: '', prazo: '' });

// Recortes do filtro "prazo": cada um é um indicador da tela e usa a mesma lista dele (itensDosIndicadores).
const RECORTE_DO_PRAZO = { vencidas: 'vencidas', proximos7: 'proximos7', semana: 'concluidasSemana' };

// Há algum filtro diferente do padrão? Busca só com espaços não conta, porque não filtra nada.
export function filtrosEmUso(filtros) {
  const f = { ...FILTROS_PADRAO, ...filtros };
  return f.busca.trim() !== '' || f.tipo !== FILTROS_PADRAO.tipo || f.status !== FILTROS_PADRAO.status || f.prioridade !== FILTROS_PADRAO.prioridade || f.prazo !== FILTROS_PADRAO.prazo;
}

// Lista a fila conforme os filtros.
// filtros: { busca, tipo, status, prioridade, prazo }
//   status: 'abertas' (padrão: fila ativa) | a_fazer | em_andamento | aguardando (sobrestadas) | concluida
//   prioridade: faixa ('Crítica' | 'Alta' | 'Média' | 'Baixa'); só existe para demandas abertas.
//   prazo: '' | 'vencidas' | 'proximos7' (com status abertas) | 'semana' (com status concluida): os mesmos itens do indicador.
//     Fora dessas combinações (ex.: vencidas com concluída) a lista fica vazia.
export function listarDemandas(demandas, filtros, hoje, contexto = {}) {
  const { busca = '', tipo = '', status = 'abertas', prioridade = '', prazo = '' } = filtros;
  const termos = normalizarBusca(busca).split(/\s+/).filter(Boolean);
  const chave = RECORTE_DO_PRAZO[prazo];
  const idsDoRecorte = chave ? new Set(itensDosIndicadores(demandas, hoje)[chave].map((x) => x.demanda.id)) : null;
  const confere = (d) =>
    (!tipo || d.tipo === tipo) && (!idsDoRecorte || idsDoRecorte.has(d.id)) && termos.every((t) => textoPesquisavel(d).includes(t));

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
