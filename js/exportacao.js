// Exportações: CSV de demandas e de pontos, JSON completo. Funções puras (devolvem texto; o download é feito pela interface).
//
// CSV pensado para o Excel em português: separador ";", UTF-8 com BOM, datas dd/mm/aaaa, vírgula decimal, linhas CRLF.
// Células de texto que começam com = + - @ ou tabulação ganham um apóstrofo, para não virarem fórmula (injeção de CSV),
// já que títulos, municípios e notas podem vir de planilhas coladas.
import { autosALavrar, autosDoPonto, estaConcluida, estaSobrestada, prazoDemanda, relatorioDoPonto, relatoriosPendentes } from './indicadores.js';
import { faixaManual, priorizar } from './regras.js';
import { anotacoesEmTexto } from './anotacoes.js';
import { esforcoHoras } from './operacoes.js';
import { ETAPAS_PONTO, ORIGENS, ROTULO_AUTO_SEM_TIPO, STATUS, TIPOS, TIPOS_AUTO } from './rotulos.js';

const BOM = '﻿';
const SEPARADOR = ';';
const FIM_DE_LINHA = '\r\n';

export function celulaTexto(valor) {
  if (valor === null || valor === undefined) return '';
  let t = String(valor);
  if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`;
  return /[;"\r\n]/.test(t) ? `"${t.replaceAll('"', '""')}"` : t;
}

export function celulaNumero(valor) {
  return typeof valor === 'number' && Number.isFinite(valor) ? String(valor).replace('.', ',') : '';
}

export function celulaData(iso) {
  return typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split('-').reverse().join('/') : '';
}

function celulaDataHora(valor) {
  if (typeof valor !== 'string' || !valor.includes('T')) return '';
  const [data, hora] = valor.split('T');
  return `${celulaData(data)} ${hora}`;
}

export function montarCsv(cabecalho, linhas) {
  return BOM + [cabecalho, ...linhas].map((cels) => cels.join(SEPARADOR)).join(FIM_DE_LINHA) + FIM_DE_LINHA;
}

const porId = (a, b) => a.id.localeCompare(b.id);

export const CABECALHO_DEMANDAS = [
  'ID', 'TIPO', 'TITULO', 'ORIGEM', 'STATUS', 'PRAZO', 'CRIADA_EM', 'CONCLUIDA_EM', 'ESFORCO_H', 'FAIXA', 'SCORE',
  'PROTOCOLO', 'ETAPA', 'DATA_HORA', 'LOCAL', 'PUBLICO', 'EQUIPE', 'SAIDA', 'RETORNO', 'PONTOS',
  'RELATORIOS_PENDENTES', 'AUTOS_A_LAVRAR', 'SOBRESTADA',
  'DESCRICAO', 'RESPONSAVEL', 'MUNICIPIO', 'PRIORIDADE_MODO', 'MOTIVO_AJUSTE', 'ANOTACOES',
  'ENDERECO', 'COORD_X', 'COORD_Y',
];

// Todas as demandas (inclusive concluídas e sobrestadas). ENDERECO, COORD_X (longitude) e COORD_Y (latitude) ficam no fim e só existem
// nas demandas que têm localização (a operação tem coordenada nos pontos). Faixa e score só existem para as ativas:
// FAIXA é a efetiva (a manual, se houver) e SCORE é sempre o calculado. PROTOCOLO é o nº do processo nos processos.
export function csvDemandas(demandas, hoje, contexto = {}) {
  const linhas = [...demandas].sort(porId).map((d) => {
    let prioridade = { faixa: '', score: '' };
    try {
      const r = priorizar(d, hoje, contexto);
      if (!r.foraDaFila) prioridade = { faixa: faixaManual(d) ?? r.faixa, score: r.score };
    } catch {
      // prazo inválido: sem prioridade
    }
    const operacao = d.tipo === 'operacao';
    return [
      celulaTexto(d.id),
      celulaTexto(TIPOS[d.tipo]),
      celulaTexto(d.titulo),
      celulaTexto(ORIGENS[d.origem]),
      celulaTexto(STATUS[d.status]),
      celulaData(prazoDemanda(d)),
      celulaData(d.criada_em),
      celulaData(d.concluida_em),
      celulaNumero(operacao ? esforcoHoras(d) : d.esforco_h),
      celulaTexto(prioridade.faixa),
      celulaNumero(prioridade.score === '' ? null : prioridade.score),
      celulaTexto(d.protocolo),
      celulaTexto(d.etapa),
      celulaDataHora(d.data_hora),
      celulaTexto(d.local),
      celulaNumero(d.publico),
      celulaTexto(d.equipe),
      celulaData(d.saida),
      celulaData(d.retorno),
      operacao ? String(d.pontos.length) : '',
      operacao ? String(relatoriosPendentes(d)) : '',
      operacao ? String(autosALavrar(d)) : '',
      estaSobrestada(d) ? 'sim' : 'não',
      celulaTexto(d.descricao),
      celulaTexto(d.responsavel),
      celulaTexto(d.municipio),
      faixaManual(d) ? 'manual' : 'automatica',
      celulaTexto(d.motivo_ajuste),
      celulaTexto(anotacoesEmTexto(d.anotacoes)),
      celulaTexto(d.endereco),
      celulaNumero(d.coord_x),
      celulaNumero(d.coord_y),
    ];
  });
  return montarCsv(CABECALHO_DEMANDAS, linhas);
}

// Autos do ponto em uma célula: "Tipo (dd/mm/aaaa) | Tipo (dd/mm/aaaa)".
function descreverAutos(ponto) {
  return autosDoPonto(ponto).map((a) => `${a.tipo ? TIPOS_AUTO[a.tipo] : ROTULO_AUTO_SEM_TIPO} (${a.data ? a.data.split('-').reverse().join('/') : 'sem data'})`).join(' | ');
}

// As 8 primeiras colunas são as da planilha da coordenação, para as linhas de uma operação poderem ser coladas de volta na importação.
export const CABECALHO_PONTOS = [
  'N_PONTO', 'EQUIPE', 'COORD_X', 'COORD_Y', 'MUNICIPIO', 'DAT_SAIDA', 'DAT_RETOR', 'NOT_PLANEJ',
  'ETAPA', 'DATA_RELATORIO', 'DATA_AUTO', 'OPERACAO_ID', 'OPERACAO', 'RELATORIO', 'AUTOS', 'OBSERVACOES',
];

// Pontos de todas as operações, inclusive coordenadas.
export function csvPontos(demandas) {
  const linhas = demandas
    .filter((d) => d.tipo === 'operacao')
    .sort(porId)
    .flatMap((d) =>
      [...d.pontos]
        .sort((a, b) => a.n - b.n)
        .map((p) => [
          String(p.n),
          celulaTexto(d.equipe),
          celulaNumero(p.coord_x),
          celulaNumero(p.coord_y),
          celulaTexto(p.municipio),
          celulaData(d.saida),
          celulaData(d.retorno),
          celulaTexto(p.nota),
          celulaTexto(ETAPAS_PONTO[p.etapa]),
          celulaData(p.data_relatorio),
          celulaData(p.data_auto),
          celulaTexto(d.id),
          celulaTexto(d.titulo),
          celulaTexto(relatorioDoPonto(d, p.n)?.id ?? ''),
          celulaTexto(descreverAutos(p)),
          celulaTexto(p.observacoes ?? ''),
        ])
    );
  return montarCsv(CABECALHO_PONTOS, linhas);
}

// Cópia completa do que está no navegador, no mesmo formato do armazenamento.
export function jsonCompleto(dados, exportadoEm) {
  return JSON.stringify({ versao: 1, exportado_em: exportadoEm, demandas: dados.demandas, afastamentos: dados.afastamentos }, null, 2);
}

export const ARQUIVOS = {
  demandas: { nome: (hoje) => `demandas-${hoje}.csv`, mime: 'text/csv;charset=utf-8' },
  pontos: { nome: (hoje) => `pontos-${hoje}.csv`, mime: 'text/csv;charset=utf-8' },
  json: { nome: (hoje) => `painel-${hoje}.json`, mime: 'application/json;charset=utf-8' },
  resumo: { nome: (hoje) => `resumo-semanal-${hoje}.txt`, mime: 'text/plain;charset=utf-8' },
};
