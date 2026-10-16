// Cálculos puros de indicadores e fila. Sem DOM nem armazenamento.
// A prioridade (score) é responsabilidade de js/regras.js (M2).

const DIA = 86400000;
const ETAPAS_PENDENTES = ['vistoriado', 'relatorio_elaboracao'];
const ETAPAS_ENCERRADAS = ['auto_lavrado', 'encerrado_nao_constatado', 'encerrado_nao_acessado'];

export function dataValida(iso) {
  if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const t = Date.parse(iso + 'T00:00:00Z');
  // A conferência de ida e volta rejeita datas impossíveis (2026-02-31 viraria 2026-03-03).
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === iso;
}

export function somarDias(iso, dias) {
  return new Date(Date.parse(iso + 'T00:00:00Z') + dias * DIA).toISOString().slice(0, 10);
}

export function diasEntre(deIso, ateIso) {
  return Math.round((Date.parse(ateIso + 'T00:00:00Z') - Date.parse(deIso + 'T00:00:00Z')) / DIA);
}

export function inicioDaSemana(hoje) {
  const diaSemana = new Date(hoje + 'T00:00:00Z').getUTCDay(); // 0 = domingo
  return somarDias(hoje, -((diaSemana + 6) % 7)); // segunda-feira
}

export function prazoDemanda(d) {
  if (d.tipo === 'operacao') {
    return dataValida(d.retorno) && Number.isInteger(d.prazo_dias) ? somarDias(d.retorno, d.prazo_dias) : null;
  }
  return dataValida(d.prazo) ? d.prazo : null;
}

export function relatoriosPendentes(d) {
  return d.tipo === 'operacao' ? d.pontos.filter((p) => ETAPAS_PENDENTES.includes(p.etapa)).length : 0;
}

export function autosALavrar(d) {
  return d.tipo === 'operacao' ? d.pontos.filter((p) => p.etapa === 'relatorio_concluido').length : 0;
}

export function estaConcluida(d) {
  if (d.status === 'concluida') return true;
  return d.tipo === 'operacao' && d.pontos.length > 0 && d.pontos.every((p) => ETAPAS_ENCERRADAS.includes(p.etapa));
}

// Sobrestada: status "Aguardando" (aguarda resposta do interessado). O prazo fica suspenso:
// a demanda sai da fila ativa e não conta como aberta, vencida ou próxima do prazo.
export function estaSobrestada(d) {
  return d.status === 'aguardando' && !estaConcluida(d);
}

export function filaOrdenada(demandas) {
  return demandas
    .filter((d) => !estaConcluida(d) && !estaSobrestada(d))
    .map((d) => ({ demanda: d, prazo: prazoDemanda(d) }))
    .sort((a, b) => {
      if (a.prazo === b.prazo) return (a.demanda.criada_em || '').localeCompare(b.demanda.criada_em || '');
      if (a.prazo === null) return 1;
      if (b.prazo === null) return -1;
      return a.prazo.localeCompare(b.prazo);
    });
}

// Demandas que compõem cada indicador: { chave: [{ demanda, prazo, quantidade? }] }.
// `quantidade` só aparece em relatórios pendentes e autos a lavrar (vários por operação); nos demais cada demanda conta 1.
export function itensDosIndicadores(demandas, hoje) {
  const abertas = filaOrdenada(demandas);
  const limite = somarDias(hoje, 7);
  const semana = inicioDaSemana(hoje);
  const fimSemana = somarDias(semana, 6);
  const comQuantidade = (contar) =>
    abertas.map((x) => ({ ...x, quantidade: contar(x.demanda) })).filter((x) => x.quantidade > 0);
  const comPrazo = (lista) => lista.map((d) => ({ demanda: d, prazo: prazoDemanda(d) }));
  return {
    abertas,
    vencidas: abertas.filter((x) => x.prazo !== null && x.prazo < hoje),
    proximos7: abertas.filter((x) => x.prazo !== null && x.prazo >= hoje && x.prazo <= limite),
    relatoriosPendentes: comQuantidade(relatoriosPendentes),
    autosALavrar: comQuantidade(autosALavrar),
    sobrestados: comPrazo(demandas.filter(estaSobrestada)),
    concluidasSemana: comPrazo(demandas.filter(
      (d) => estaConcluida(d) && d.concluida_em >= semana && d.concluida_em <= fimSemana
    )),
  };
}

// Número exibido na caixa a partir da lista do indicador.
export function totalDoIndicador(itens) {
  return itens.reduce((soma, x) => soma + (x.quantidade ?? 1), 0);
}

export function calcularIndicadores(demandas, hoje) {
  return Object.fromEntries(
    Object.entries(itensDosIndicadores(demandas, hoje)).map(([chave, itens]) => [chave, totalDoIndicador(itens)])
  );
}
