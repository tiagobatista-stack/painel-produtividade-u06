// Operações de alertas: importação, etapas por ponto, retorno e status derivado. Funções puras e imutáveis.
import { autosDoPonto, dataValida, estaConcluida, relatorioDoPonto, relatoriosPendentes } from './indicadores.js';
import { ErroCadastro, proximoId, validarParametros } from './demandas.js';
import { ETAPAS_PONTO, TIPOS_AUTO } from './rotulos.js';

// Etapas que um relatório (grupo de pontos) percorre junto; o auto e o encerramento são de cada ponto.
const ETAPAS_DO_RELATORIO = ['vistoriado', 'relatorio_elaboracao', 'relatorio_concluido'];

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
  const pendentes = relatoriosPendentes(operacao); // relatórios, não pontos: pontos somados no mesmo relatório contam 1
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
function transicaoInvalida(atual, nova, ponto) {
  if (atual === 'planejado') return 'Registre o retorno da viagem antes de avançar este ponto.';
  if (nova === 'planejado') return 'Um ponto vistoriado não volta a planejado.';
  if (atual === 'auto_lavrado' && nova !== 'auto_lavrado' && autosDoPonto(ponto).length > 1) {
    return 'Este ponto tem mais de um auto: remova os autos antes de mudar a etapa.';
  }
  if (nova === 'auto_lavrado' && atual !== 'relatorio_concluido') return 'O auto só pode ser lavrado depois do relatório concluído.';
  if (ENCERRADOS_SEM_AUTO.includes(nova) && atual === 'auto_lavrado') return 'Volte o ponto para "Relatório concluído" antes de encerrá-lo sem auto.';
  return null;
}

// O ponto na nova etapa, com datas e autos coerentes com ela. Não valida a transição.
function pontoNaEtapa(ponto, novaEtapa, hoje) {
  const novo = { ...ponto, etapa: novaEtapa };
  if (novaEtapa === 'vistoriado' || novaEtapa === 'relatorio_elaboracao') {
    novo.data_relatorio = null;
    novo.data_auto = null;
    delete novo.autos;
  } else if (novaEtapa === 'relatorio_concluido') {
    novo.data_relatorio = ponto.data_relatorio ?? hoje;
    novo.data_auto = null;
    delete novo.autos;
  } else if (novaEtapa === 'auto_lavrado') {
    novo.data_auto = hoje; // caminho do seletor de etapa: 1 auto de infração; mais autos pelo "Registrar auto"
    novo.autos = [{ id: 'A1', tipo: 'auto_infracao', data: hoje }];
  } else {
    novo.data_relatorio = ponto.data_relatorio ?? hoje;
    novo.data_auto = null;
    delete novo.autos;
  }
  return novo;
}

function acharPonto(operacao, numero) {
  const i = operacao.pontos.findIndex((p) => p.n === numero);
  if (i < 0) throw new ErroCadastro({ ponto: `Ponto ${numero} não encontrado.` });
  return i;
}

function exigirOperacao(operacao) {
  if (operacao.tipo !== 'operacao') throw new ErroCadastro({ ponto: 'A demanda não é uma operação.' });
}

export function alterarEtapaPonto(operacao, numero, novaEtapa, hoje) {
  exigirOperacao(operacao);
  if (!(novaEtapa in ETAPAS_PONTO)) throw new ErroCadastro({ etapa: 'Escolha uma etapa válida.' });
  const i = acharPonto(operacao, numero);
  const ponto = operacao.pontos[i];
  if (ponto.etapa === novaEtapa) return operacao;
  const motivo = transicaoInvalida(ponto.etapa, novaEtapa, ponto);
  if (motivo) throw new ErroCadastro({ etapa: motivo });

  // Ponto de um relatório agrupado: as etapas do relatório valem para todos os pontos dele. Um ponto que já passou do relatório
  // (com auto ou encerrado) que volta a "Relatório concluído" é só ele; reabrir o relatório vai pelo grupo.
  const grupo = relatorioDoPonto(operacao, numero);
  const voltaSoDoPonto = novaEtapa === 'relatorio_concluido' && ETAPAS_ENCERRADAS.includes(ponto.etapa);
  if (grupo && ETAPAS_DO_RELATORIO.includes(novaEtapa) && !voltaSoDoPonto) return alterarEtapaRelatorio(operacao, grupo.id, novaEtapa, hoje);

  const pontos = operacao.pontos.map((p, j) => (j === i ? pontoNaEtapa(ponto, novaEtapa, hoje) : p));
  const evento = `Ponto ${numero}: ${ETAPAS_PONTO[ponto.etapa]} → ${ETAPAS_PONTO[novaEtapa]}`;
  return recalcular({ ...operacao, pontos, historico: [...(operacao.historico || []), { data: hoje, evento }] }, hoje);
}

// ---------- Relatórios agrupados ----------

const proximoIdRelatorio = (operacao) =>
  `R${(operacao.relatorios ?? []).reduce((max, r) => Math.max(max, Number(/^R(\d+)$/.exec(r.id)?.[1] ?? 0)), 0) + 1}`;

// Reúne 2 ou mais pontos da mesma operação num só relatório. Os pontos precisam estar na mesma etapa (Vistoriado ou Em elaboração)
// e fora de outro relatório. Não altera a operação recebida.
export function agruparRelatorio(operacao, numeros, hoje) {
  exigirOperacao(operacao);
  const unicos = [...new Set(numeros)].sort((a, b) => a - b);
  if (unicos.length < 2) throw new ErroCadastro({ relatorio: 'Escolha 2 ou mais pontos para somar no mesmo relatório.' });
  const pontos = unicos.map((n) => operacao.pontos[acharPonto(operacao, n)]);
  if (pontos.some((p) => p.etapa !== 'vistoriado' && p.etapa !== 'relatorio_elaboracao')) {
    throw new ErroCadastro({ relatorio: 'Só pontos em "Vistoriado" ou "Relatório em elaboração" entram num relatório.' });
  }
  if (new Set(pontos.map((p) => p.etapa)).size > 1) {
    throw new ErroCadastro({ relatorio: 'Os pontos do relatório precisam estar na mesma etapa: ajuste as etapas antes de agrupar.' });
  }
  const jaAgrupado = unicos.find((n) => relatorioDoPonto(operacao, n));
  if (jaAgrupado !== undefined) {
    throw new ErroCadastro({ relatorio: `O ponto ${jaAgrupado} já está no relatório ${relatorioDoPonto(operacao, jaAgrupado).id}.` });
  }
  const id = proximoIdRelatorio(operacao);
  const evento = `Relatório ${id}: reúne os pontos ${unicos.join(', ')}`;
  return { ...operacao, relatorios: [...(operacao.relatorios ?? []), { id, pontos: unicos, criado_em: hoje }], historico: [...(operacao.historico || []), { data: hoje, evento }] };
}

// Desfaz o agrupamento: os pontos voltam a ter relatório próprio. Só enquanto o relatório não está concluído.
export function desfazerRelatorio(operacao, id, hoje) {
  exigirOperacao(operacao);
  const grupo = (operacao.relatorios ?? []).find((r) => r.id === id);
  if (!grupo) throw new ErroCadastro({ relatorio: `Relatório ${id} não encontrado.` });
  const membros = operacao.pontos.filter((p) => grupo.pontos.includes(p.n));
  if (membros.some((p) => p.etapa !== 'vistoriado' && p.etapa !== 'relatorio_elaboracao')) {
    throw new ErroCadastro({ relatorio: 'Só é possível desfazer o agrupamento enquanto o relatório não está concluído.' });
  }
  const { relatorios, ...resto } = operacao;
  const restantes = relatorios.filter((r) => r.id !== id);
  const evento = `Relatório ${id}: agrupamento desfeito`;
  return { ...resto, ...(restantes.length ? { relatorios: restantes } : {}), historico: [...(operacao.historico || []), { data: hoje, evento }] };
}

// Muda a etapa de todos os pontos do relatório de uma vez (Vistoriado, Em elaboração ou Concluído), com um só evento no histórico.
// Pontos do relatório que já têm auto ou foram encerrados ficam como estão; com eles, o relatório não volta atrás.
export function alterarEtapaRelatorio(operacao, id, etapa, hoje) {
  exigirOperacao(operacao);
  if (!ETAPAS_DO_RELATORIO.includes(etapa)) {
    throw new ErroCadastro({ etapa: 'O relatório vai para Vistoriado, Em elaboração ou Concluído; o auto é registrado em cada ponto.' });
  }
  const grupo = (operacao.relatorios ?? []).find((r) => r.id === id);
  if (!grupo) throw new ErroCadastro({ relatorio: `Relatório ${id} não encontrado.` });
  const membros = operacao.pontos.filter((p) => grupo.pontos.includes(p.n));
  const alem = membros.filter((p) => ETAPAS_ENCERRADAS.includes(p.etapa));
  if (etapa !== 'relatorio_concluido' && alem.length) {
    throw new ErroCadastro({ etapa: 'Há ponto deste relatório com auto ou encerrado: remova os autos e reabra o ponto antes de reabrir o relatório.' });
  }
  const afetados = membros.filter((p) => !ETAPAS_ENCERRADAS.includes(p.etapa) && p.etapa !== etapa);
  if (afetados.length === 0) return operacao;
  const numeros = new Set(afetados.map((p) => p.n));
  const pontos = operacao.pontos.map((p) => (numeros.has(p.n) ? pontoNaEtapa(p, etapa, hoje) : p));
  const evento = `Relatório ${id}: ${ETAPAS_PONTO[etapa]} (${afetados.length} ${afetados.length === 1 ? 'ponto' : 'pontos'})`;
  return recalcular({ ...operacao, pontos, historico: [...(operacao.historico || []), { data: hoje, evento }] }, hoje);
}

// ---------- Anotações de um ponto ----------

export const OBSERVACAO_PONTO_MAX = 500;

// Anotação livre de um ponto (o que já foi feito e o que falta). Texto vazio apaga; não altera a operação recebida.
export function salvarObservacaoPonto(operacao, numero, texto, hoje) {
  exigirOperacao(operacao);
  const i = acharPonto(operacao, numero);
  const ponto = operacao.pontos[i];
  const limpo = typeof texto === 'string' ? texto.replaceAll('\r\n', '\n').trim() : '';
  if (limpo.length > OBSERVACAO_PONTO_MAX) throw new ErroCadastro({ observacoes: `Use no máximo ${OBSERVACAO_PONTO_MAX} caracteres na anotação do ponto.` });
  if (limpo === (ponto.observacoes ?? '')) return operacao;
  const { observacoes, ...base } = ponto;
  const novo = limpo ? { ...base, observacoes: limpo } : base;
  const pontos = operacao.pontos.map((p, j) => (j === i ? novo : p));
  const evento = `Ponto ${numero}: ${limpo ? (observacoes ? 'anotação atualizada' : 'anotação iniciada') : 'anotação apagada'}`;
  return { ...operacao, pontos, historico: [...(operacao.historico || []), { data: hoje, evento }] };
}

// ---------- Autos de um ponto ----------

const dataDoPrimeiroAuto = (autos) => autos.map((a) => a.data).filter(Boolean).sort()[0] ?? null;

// Registra um auto lavrado no ponto (tipo da lista e data). O ponto precisa estar com o relatório concluído (ou já ter auto).
export function registrarAuto(operacao, numero, { tipo, data }, hoje) {
  exigirOperacao(operacao);
  const i = acharPonto(operacao, numero);
  const ponto = operacao.pontos[i];
  if (ponto.etapa !== 'relatorio_concluido' && ponto.etapa !== 'auto_lavrado') {
    throw new ErroCadastro({ auto: 'O auto só pode ser lavrado depois do relatório concluído.' });
  }
  const erros = {};
  if (!(tipo in TIPOS_AUTO)) erros.tipo = 'Escolha o tipo do auto.';
  if (!dataValida(data)) erros.data = 'Informe a data do auto.';
  else if (ponto.data_relatorio && data < ponto.data_relatorio) erros.data = 'A data do auto não pode ser anterior à do relatório.';
  if (Object.keys(erros).length) throw new ErroCadastro(erros);

  const atuais = autosDoPonto(ponto);
  const id = `A${atuais.reduce((max, a) => Math.max(max, Number(/^A(\d+)$/.exec(a.id)?.[1] ?? 0)), 0) + 1}`;
  const autos = [...atuais, { id, tipo, data }];
  const novo = { ...ponto, etapa: 'auto_lavrado', autos, data_auto: dataDoPrimeiroAuto(autos) };
  const pontos = operacao.pontos.map((p, j) => (j === i ? novo : p));
  const evento = `Ponto ${numero}: auto registrado (${TIPOS_AUTO[tipo]}, ${dataBr(data)})`;
  return recalcular({ ...operacao, pontos, historico: [...(operacao.historico || []), { data: hoje, evento }] }, hoje);
}

// Remove um auto do ponto. Sem autos, o ponto volta a "Relatório concluído".
export function removerAuto(operacao, numero, idAuto, hoje) {
  exigirOperacao(operacao);
  const i = acharPonto(operacao, numero);
  const ponto = operacao.pontos[i];
  const atuais = autosDoPonto(ponto);
  const auto = atuais.find((a) => a.id === idAuto);
  if (!auto) throw new ErroCadastro({ auto: `Auto ${idAuto} não encontrado no ponto ${numero}.` });
  const restantes = atuais.filter((a) => a.id !== idAuto);
  const { autos, ...base } = ponto;
  const novo = restantes.length
    ? { ...base, autos: restantes, data_auto: dataDoPrimeiroAuto(restantes) }
    : { ...base, etapa: 'relatorio_concluido', data_auto: null };
  const pontos = operacao.pontos.map((p, j) => (j === i ? novo : p));
  const evento = `Ponto ${numero}: auto removido (${auto.tipo ? TIPOS_AUTO[auto.tipo] : 'tipo não informado'})`;
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
