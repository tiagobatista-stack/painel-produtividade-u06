// Operações de alertas: importação, etapas por ponto, retorno e status derivado. Funções puras e imutáveis.
import { dataValida, estaConcluida } from './indicadores.js';
import { ErroCadastro, proximoId, validarParametros } from './demandas.js';
import { ETAPAS_PONTO } from './rotulos.js';

const ETAPAS_ENCERRADAS = ['auto_lavrado', 'encerrado_nao_constatado', 'encerrado_nao_acessado'];
const ENCERRADOS_SEM_AUTO = ['encerrado_nao_constatado', 'encerrado_nao_acessado'];

const dataBr = (iso) => iso.split('-').reverse().join('/');

export function statusOperacao(operacao) {
  const { pontos } = operacao;
  if (pontos.length > 0 && pontos.every((p) => ETAPAS_ENCERRADAS.includes(p.etapa))) return 'concluida';
  if (pontos.length === 0 || pontos.every((p) => p.etapa === 'planejado')) return 'a_fazer';
  return 'em_andamento';
}

// Mantém status e concluida_em coerentes com as etapas dos pontos e com o sobrestamento.
// Concluída (todos os pontos encerrados) prevalece sobre o sobrestamento.
function recalcular(operacao, hoje) {
  const { concluida_em, sobrestada, ...base } = operacao;
  const derivado = statusOperacao(operacao);
  if (derivado === 'concluida') return { ...base, status: 'concluida', concluida_em: concluida_em ?? hoje };
  if (sobrestada) return { ...base, status: 'aguardando', sobrestada: true };
  return { ...base, status: derivado };
}

export function esforcoHoras(operacao) {
  const pendentes = operacao.pontos.filter((p) => p.etapa === 'vistoriado' || p.etapa === 'relatorio_elaboracao').length;
  return pendentes * operacao.horas_ponto;
}

// planilha: resultado de lerPlanilha().operacao
export function criarOperacao(planilha, parametros, existentes, hoje) {
  const { prazo_dias, horas_ponto } = validarParametros(parametros);
  const repetida = existentes.some(
    (d) => d.tipo === 'operacao' && d.equipe === planilha.equipe && d.saida === planilha.saida && d.retorno === planilha.retorno
  );
  if (repetida) throw new ErroCadastro({ planilha: 'Esta operação já foi importada (mesma equipe, saída e retorno).' });
  const n = planilha.pontos.length;
  const m = planilha.municipios.length;
  return {
    id: proximoId(existentes),
    tipo: 'operacao',
    titulo: `Relatórios de vistoria — ${planilha.equipe} (saída ${dataBr(planilha.saida).slice(0, 5)})`,
    origem: 'chefia',
    status: 'a_fazer',
    criada_em: hoje,
    equipe: planilha.equipe,
    saida: planilha.saida,
    retorno: planilha.retorno,
    prazo_dias,
    horas_ponto,
    pontos: planilha.pontos.map((p) => ({ ...p, etapa: 'planejado', data_relatorio: null, data_auto: null })),
    historico: [{ data: hoje, evento: `Importada: ${n} ${n === 1 ? 'ponto' : 'pontos'} em ${m} ${m === 1 ? 'município' : 'municípios'}` }],
  };
}

// Regras de transição de etapa de um ponto. Retorna mensagem de erro ou null.
function transicaoInvalida(atual, nova) {
  if (atual === 'planejado') return 'Registre o retorno da viagem antes de avançar este ponto.';
  if (nova === 'planejado') return 'Um ponto vistoriado não volta a planejado.';
  if (nova === 'auto_lavrado' && atual !== 'relatorio_concluido') return 'O auto só pode ser lavrado depois do relatório concluído.';
  if (ENCERRADOS_SEM_AUTO.includes(nova) && atual === 'auto_lavrado') return 'Volte o ponto para "Relatório concluído" antes de encerrá-lo sem auto.';
  return null;
}

export function alterarEtapaPonto(operacao, numero, novaEtapa, hoje) {
  if (operacao.tipo !== 'operacao') throw new ErroCadastro({ ponto: 'A demanda não é uma operação.' });
  if (!(novaEtapa in ETAPAS_PONTO)) throw new ErroCadastro({ etapa: 'Escolha uma etapa válida.' });
  const i = operacao.pontos.findIndex((p) => p.n === numero);
  if (i < 0) throw new ErroCadastro({ ponto: `Ponto ${numero} não encontrado.` });
  const ponto = operacao.pontos[i];
  if (ponto.etapa === novaEtapa) return operacao;
  const motivo = transicaoInvalida(ponto.etapa, novaEtapa);
  if (motivo) throw new ErroCadastro({ etapa: motivo });

  const novo = { ...ponto, etapa: novaEtapa };
  if (novaEtapa === 'vistoriado' || novaEtapa === 'relatorio_elaboracao') {
    novo.data_relatorio = null;
    novo.data_auto = null;
  } else if (novaEtapa === 'relatorio_concluido') {
    novo.data_relatorio = ponto.data_relatorio ?? hoje;
    novo.data_auto = null;
  } else if (novaEtapa === 'auto_lavrado') {
    novo.data_auto = hoje;
  } else {
    novo.data_relatorio = ponto.data_relatorio ?? hoje;
    novo.data_auto = null;
  }
  const pontos = operacao.pontos.map((p, j) => (j === i ? novo : p));
  const evento = `Ponto ${numero}: ${ETAPAS_PONTO[ponto.etapa]} → ${ETAPAS_PONTO[novaEtapa]}`;
  return recalcular({ ...operacao, pontos, historico: [...(operacao.historico || []), { data: hoje, evento }] }, hoje);
}

// Ação em lote: pontos planejados passam a vistoriados. A data efetiva de retorno recalcula o prazo.
export function registrarRetorno(operacao, hoje, dataEfetiva = operacao.retorno) {
  if (operacao.tipo !== 'operacao') throw new ErroCadastro({ retorno: 'A demanda não é uma operação.' });
  if (!dataValida(dataEfetiva)) throw new ErroCadastro({ retorno: 'Informe uma data de retorno válida.' });
  if (dataEfetiva < operacao.saida) throw new ErroCadastro({ retorno: 'O retorno não pode ser anterior à saída.' });
  const planejados = operacao.pontos.filter((p) => p.etapa === 'planejado').length;
  if (planejados === 0) throw new ErroCadastro({ retorno: 'Não há pontos planejados.' });
  const pontos = operacao.pontos.map((p) => (p.etapa === 'planejado' ? { ...p, etapa: 'vistoriado' } : p));
  const diferente = dataEfetiva !== operacao.retorno;
  const evento =
    `Retorno registrado em ${dataBr(dataEfetiva)}: ${planejados} ${planejados === 1 ? 'ponto vistoriado' : 'pontos vistoriados'}` +
    (diferente ? ` (planejado: ${dataBr(operacao.retorno)})` : '');
  return recalcular({ ...operacao, retorno: dataEfetiva, pontos, historico: [...(operacao.historico || []), { data: hoje, evento }] }, hoje);
}


// Sobrestamento da operação: o prazo fica suspenso (ex.: aguardando a identificação do autuado, que exige investigação).
// A operação sai da fila ativa; os pontos continuam editáveis. Ao retomar, vale o prazo registrado, sem recálculo.
export function sobrestarOperacao(operacao, hoje) {
  if (operacao.tipo !== 'operacao') throw new ErroCadastro({ status: 'A demanda não é uma operação.' });
  if (estaConcluida(operacao)) throw new ErroCadastro({ status: 'Uma operação concluída não pode ser sobrestada.' });
  if (operacao.sobrestada) return operacao;
  const evento = 'Sobrestada: aguardando identificação do autuado';
  return recalcular({ ...operacao, sobrestada: true, historico: [...(operacao.historico || []), { data: hoje, evento }] }, hoje);
}

export function retomarOperacao(operacao, hoje) {
  if (operacao.tipo !== 'operacao') throw new ErroCadastro({ status: 'A demanda não é uma operação.' });
  if (!operacao.sobrestada) throw new ErroCadastro({ status: 'A operação não está sobrestada.' });
  const { sobrestada, ...resto } = operacao;
  const evento = 'Retomada: o prazo registrado volta a valer';
  return recalcular({ ...resto, historico: [...(operacao.historico || []), { data: hoje, evento }] }, hoje);
}
