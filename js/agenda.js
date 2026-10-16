// Agenda dos próximos dias: reuniões, palestras, saídas de operação, prazos de relatório e início de afastamento.
import { estaConcluida, estaSobrestada, prazoDemanda, somarDias } from './indicadores.js';
import { TIPOS_AFASTAMENTO } from './rotulos.js';

export const DIAS_AGENDA = 7;

// Retorna eventos de hoje até hoje + dias (inclusive), ordenados por data e hora.
// Cada evento: { data, hora (ou null), tipo, titulo, id }
export function agenda(demandas, afastamentos, hoje, dias = DIAS_AGENDA) {
  const limite = somarDias(hoje, dias);
  const naJanela = (data) => data !== null && data >= hoje && data <= limite;
  const eventos = [];

  for (const d of demandas) {
    if (estaConcluida(d) || estaSobrestada(d)) continue;
    if (d.tipo === 'reuniao' || d.tipo === 'palestra') {
      const [data, hora] = String(d.data_hora ?? '').split('T');
      if (naJanela(data)) eventos.push({ data, hora: hora ?? null, tipo: d.tipo, titulo: d.titulo, id: d.id });
    }
    if (d.tipo === 'operacao') {
      if (naJanela(d.saida ?? null)) eventos.push({ data: d.saida, hora: null, tipo: 'saida_operacao', titulo: `Saída: ${d.equipe}`, id: d.id });
      const prazo = prazoDemanda(d);
      if (naJanela(prazo)) eventos.push({ data: prazo, hora: null, tipo: 'prazo_relatorio', titulo: `Prazo dos relatórios: ${d.titulo}`, id: d.id });
    }
  }
  for (const a of afastamentos) {
    if (naJanela(a.inicio)) eventos.push({ data: a.inicio, hora: null, tipo: 'afastamento', titulo: `Início de ${TIPOS_AFASTAMENTO[a.tipo].toLowerCase()}`, id: a.id });
  }

  return eventos.sort(
    (a, b) => a.data.localeCompare(b.data) || (a.hora ?? '99:99').localeCompare(b.hora ?? '99:99') || a.titulo.localeCompare(b.titulo)
  );
}
