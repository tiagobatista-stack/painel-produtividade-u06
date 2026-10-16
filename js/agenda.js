// Agenda dos próximos dias e calendário mensal: reuniões, palestras, saídas de operação, prazos e afastamentos.
import { estaConcluida, estaSobrestada, inicioDaSemana, prazoDemanda, somarDias } from './indicadores.js';
import { TIPOS_AFASTAMENTO } from './rotulos.js';

export const DIAS_AGENDA = 7;

const ordenar = (eventos) =>
  eventos.sort(
    (a, b) => a.data.localeCompare(b.data) || (a.hora ?? '99:99').localeCompare(b.hora ?? '99:99') || a.titulo.localeCompare(b.titulo)
  );

// Eventos datados de uma demanda aberta. Cada evento: { data, hora (ou null), tipo, titulo, id }.
// Com `prazos`, inclui também o prazo de processos e de outras demandas (usado no calendário).
function eventosDaDemanda(d, { prazos = false } = {}) {
  if (estaConcluida(d) || estaSobrestada(d)) return [];
  const eventos = [];
  if (d.tipo === 'reuniao' || d.tipo === 'palestra') {
    const [data, hora] = String(d.data_hora ?? '').split('T');
    if (data) eventos.push({ data, hora: hora ?? null, tipo: d.tipo, titulo: d.titulo, id: d.id });
  }
  if (d.tipo === 'operacao') {
    if (d.saida) eventos.push({ data: d.saida, hora: null, tipo: 'saida_operacao', titulo: `Saída: ${d.equipe}`, id: d.id });
    const prazo = prazoDemanda(d);
    if (prazo) eventos.push({ data: prazo, hora: null, tipo: 'prazo_relatorio', titulo: `Prazo dos relatórios: ${d.titulo}`, id: d.id });
  }
  if (prazos && (d.tipo === 'processo' || d.tipo === 'outra')) {
    const prazo = prazoDemanda(d);
    const tipo = d.tipo === 'processo' ? 'prazo_processo' : 'prazo_demanda';
    if (prazo) eventos.push({ data: prazo, hora: null, tipo, titulo: d.processo ? `${d.processo} — ${d.titulo}` : d.titulo, id: d.id });
  }
  return eventos;
}

// Retorna eventos de hoje até hoje + dias (inclusive), ordenados por data e hora.
export function agenda(demandas, afastamentos, hoje, dias = DIAS_AGENDA) {
  const limite = somarDias(hoje, dias);
  const naJanela = (data) => data >= hoje && data <= limite;
  const eventos = demandas.flatMap((d) => eventosDaDemanda(d)).filter((e) => naJanela(e.data));
  for (const a of afastamentos) {
    if (naJanela(a.inicio)) eventos.push({ data: a.inicio, hora: null, tipo: 'afastamento', titulo: `Início de ${TIPOS_AFASTAMENTO[a.tipo].toLowerCase()}`, id: a.id });
  }
  return ordenar(eventos);
}

// Soma meses a um mês no formato AAAA-MM.
export function somarMeses(mes, n) {
  const [ano, m] = mes.split('-').map(Number);
  const total = ano * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

// Calendário de um mês (AAAA-MM) em semanas de segunda a domingo, completando com dias dos meses vizinhos.
// Cada dia: { data, doMes, eventos (ordenados), afastamentos (que cobrem o dia, início e fim inclusos) }.
export function calendarioMes(demandas, afastamentos, mes) {
  const inicio = inicioDaSemana(`${mes}-01`);
  const ultimo = somarDias(`${somarMeses(mes, 1)}-01`, -1);
  const fim = somarDias(inicioDaSemana(ultimo), 6);
  const porDia = new Map();
  for (const e of demandas.flatMap((d) => eventosDaDemanda(d, { prazos: true }))) {
    if (e.data >= inicio && e.data <= fim) porDia.set(e.data, [...(porDia.get(e.data) ?? []), e]);
  }
  const semanas = [];
  for (let segunda = inicio; segunda <= fim; segunda = somarDias(segunda, 7)) {
    semanas.push(
      Array.from({ length: 7 }, (_, i) => {
        const data = somarDias(segunda, i);
        return {
          data,
          doMes: data.startsWith(`${mes}-`),
          eventos: ordenar(porDia.get(data) ?? []),
          afastamentos: afastamentos.filter((a) => a.inicio <= data && a.fim >= data),
        };
      })
    );
  }
  return semanas;
}
