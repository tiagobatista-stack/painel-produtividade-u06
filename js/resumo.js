// Resumo semanal: o que foi concluído na semana (segunda a domingo) e a situação atual. Função pura.
// Usado pela tela e pela exportação, para que os números sejam sempre os mesmos.
import { autosDoPonto, calcularIndicadores, chaveRelatorioDoPonto, estaConcluida, inicioDaSemana, somarDias } from './indicadores.js';
import { TIPOS } from './rotulos.js';

const ENCERRADOS_SEM_AUTO = ['encerrado_nao_constatado', 'encerrado_nao_acessado'];
const dataBr = (iso) => iso.split('-').reverse().join('/');

export function resumoSemanal(demandas, hoje) {
  const inicio = inicioDaSemana(hoje);
  const fim = somarDias(inicio, 6);
  const naSemana = (data) => typeof data === 'string' && data >= inicio && data <= fim;

  const concluidas = demandas.filter((d) => estaConcluida(d) && naSemana(d.concluida_em));
  const porTipo = Object.fromEntries(Object.keys(TIPOS).map((t) => [t, concluidas.filter((d) => d.tipo === t).length]));
  const operacoes = demandas.filter((d) => d.tipo === 'operacao');
  const pontos = operacoes.flatMap((d) => d.pontos);
  // Relatório = grupo de pontos somados (ou ponto solto): conta uma vez, mesmo com vários pontos.
  const relatorios = operacoes.flatMap((d) => {
    const porChave = new Map();
    for (const p of d.pontos.filter((x) => naSemana(x.data_relatorio))) {
      const chave = chaveRelatorioDoPonto(d, p);
      porChave.set(chave, [...(porChave.get(chave) ?? []), p]);
    }
    return [...porChave.values()];
  });
  const { concluidasSemana, ...situacao } = calcularIndicadores(demandas, hoje);

  return {
    inicio,
    fim,
    concluidas: { total: concluidas.length, porTipo },
    relatoriosConcluidos: relatorios.length,
    autosLavrados: pontos.flatMap(autosDoPonto).filter((a) => naSemana(a.data)).length,
    relatoriosSemAuto: relatorios.filter((pts) => pts.every((p) => ENCERRADOS_SEM_AUTO.includes(p.etapa))).length,
    situacao,
  };
}

// Texto simples, pronto para colar em e-mail ou ofício.
export function textoResumoSemanal(resumo, hoje) {
  const tipos = Object.entries(resumo.concluidas.porTipo)
    .filter(([, n]) => n > 0)
    .map(([t, n]) => `${TIPOS[t]}: ${n}`)
    .join('; ');
  const s = resumo.situacao;
  return [
    'RESUMO SEMANAL — PAINEL DE DEMANDAS',
    `Semana de ${dataBr(resumo.inicio)} a ${dataBr(resumo.fim)} (segunda a domingo)`,
    '',
    'Produção da semana',
    `- Demandas concluídas: ${resumo.concluidas.total}${tipos ? ` (${tipos})` : ''}`,
    `- Relatórios de vistoria concluídos: ${resumo.relatoriosConcluidos} (${resumo.relatoriosSemAuto} sem auto)`,
    `- Autos de infração lavrados: ${resumo.autosLavrados}`,
    '',
    `Situação em ${dataBr(hoje)}`,
    `- Demandas abertas (ativas): ${s.abertas}`,
    `- Vencidas: ${s.vencidas}`,
    `- Vencem nos próximos 7 dias: ${s.proximos7}`,
    `- Relatórios pendentes: ${s.relatoriosPendentes}`,
    `- Autos a lavrar: ${s.autosALavrar}`,
    `- Sobrestadas (prazo suspenso): ${s.sobrestados}`,
    '',
    'Gerado pelo Painel de Demandas.',
    '',
  ].join('\r\n');
}
