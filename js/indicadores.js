// Cálculos puros de indicadores e fila. Sem DOM nem armazenamento.
// A prioridade (score) é responsabilidade de js/regras.js (M2).

const DIA = 86400000;
const ETAPAS_PENDENTES = ['vistoriado', 'relatorio_elaboracao'];
const ETAPAS_ENCERRADAS = ['auto_lavrado', 'encerrado_nao_constatado', 'encerrado_nao_acessado'];

export function dataValida(iso) {
  return typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(iso) && !Number.isNaN(Date.parse(iso + 'T00:00:00Z'));
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

export function filaOrdenada(demandas) {
  return demandas
    .filter((d) => !estaConcluida(d))
    .map((d) => ({ demanda: d, prazo: prazoDemanda(d) }))
    .sort((a, b) => {
      if (a.prazo === b.prazo) return (a.demanda.criada_em || '').localeCompare(b.demanda.criada_em || '');
      if (a.prazo === null) return 1;
      if (b.prazo === null) return -1;
      return a.prazo.localeCompare(b.prazo);
    });
}

export function calcularIndicadores(demandas, hoje) {
  const abertas = filaOrdenada(demandas);
  const limite = somarDias(hoje, 7);
  const semana = inicioDaSemana(hoje);
  const fimSemana = somarDias(semana, 6);
  return {
    abertas: abertas.length,
    vencidas: abertas.filter((x) => x.prazo !== null && x.prazo < hoje).length,
    proximos7: abertas.filter((x) => x.prazo !== null && x.prazo >= hoje && x.prazo <= limite).length,
    relatoriosPendentes: abertas.reduce((soma, x) => soma + relatoriosPendentes(x.demanda), 0),
    autosALavrar: abertas.reduce((soma, x) => soma + autosALavrar(x.demanda), 0),
    concluidasSemana: demandas.filter(
      (d) => estaConcluida(d) && d.concluida_em >= semana && d.concluida_em <= fimSemana
    ).length,
  };
}
