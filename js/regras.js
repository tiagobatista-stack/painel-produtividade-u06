// Motor de prioridade. Fonte das regras: docs/REGRAS_PRIORIDADE.md.
// Módulo puro: sem DOM, sem armazenamento. Usado pela interface, pelos testes Node e pelo MCP.
import { dataValida, diasEntre, estaConcluida, estaSobrestada, prazoDemanda, relatoriosPendentes } from './indicadores.js';

export class ErroValidacao extends Error {
  constructor(mensagem) {
    super(mensagem);
    this.name = 'ErroValidacao';
  }
}

const PONTOS_TIPO = { operacao: 20, processo: 15, reuniao: 10, palestra: 5, outra: 0 };
const ROTULO_TIPO = { operacao: 'Operação de alertas', processo: 'Processo SIGADOC', reuniao: 'Reunião', palestra: 'Palestra', outra: 'Outra' };
const PONTOS_ORIGEM_PROCESSO = { mp: 25, judiciario: 25, procuradoria: 25, ouvidoria: 15, denuncia: 10 };
const ROTULO_ORIGEM = {
  mp: 'Ministério Público', judiciario: 'Poder Judiciário', procuradoria: 'Procuradoria de Justiça',
  ouvidoria: 'Ouvidoria', denuncia: 'Denúncia',
};

export function faixaDoScore(score) {
  if (score >= 70) return 'Crítica';
  if (score >= 45) return 'Alta';
  if (score >= 25) return 'Média';
  return 'Baixa';
}

function pontosPrazo(dias) {
  if (dias < 0) return [50, 'Prazo vencido'];
  if (dias <= 2) return [30, 'Prazo em até 2 dias'];
  if (dias <= 7) return [15, 'Prazo de 3 a 7 dias'];
  return [0, null];
}

export function priorizar(demanda, hoje, { afastamentos = [] } = {}) {
  if (!dataValida(hoje)) throw new ErroValidacao('Data de referência inválida');
  if (!(demanda.tipo in PONTOS_TIPO)) throw new ErroValidacao(`Tipo de demanda inválido: ${demanda.tipo}`);
  if (estaConcluida(demanda)) return { foraDaFila: true, score: null, faixa: null, motivos: [] };

  // Sobrestada: prazo suspenso, fora da fila e sem pontuação (o prazo registrado não é validado).
  if (estaSobrestada(demanda)) return { foraDaFila: true, sobrestada: true, score: null, faixa: null, motivos: [] };

  const prazo = prazoDemanda(demanda);
  if (prazo === null) throw new ErroValidacao('Prazo ausente ou inválido');

  const motivos = [];
  let score = 0;
  const somar = (pontos, texto) => {
    if (!texto) return;
    score += pontos;
    motivos.push(`${texto} (+${pontos})`);
  };

  somar(...pontosPrazo(diasEntre(hoje, prazo)));
  somar(PONTOS_TIPO[demanda.tipo], PONTOS_TIPO[demanda.tipo] ? ROTULO_TIPO[demanda.tipo] : null);

  if (demanda.tipo === 'processo' && demanda.origem in PONTOS_ORIGEM_PROCESSO) {
    somar(PONTOS_ORIGEM_PROCESSO[demanda.origem], `Origem: ${ROTULO_ORIGEM[demanda.origem]}`);
  }
  if (demanda.origem === 'chefia') somar(10, 'Origem: chefia ou coordenação');

  if (demanda.tipo === 'operacao') {
    const pendentes = relatoriosPendentes(demanda);
    if (pendentes >= 10) somar(15, `${pendentes} relatórios pendentes`);
    else if (pendentes >= 5) somar(8, `${pendentes} relatórios pendentes`);
  }

  if (afastamentos.some((a) => dataValida(a.inicio) && dataValida(a.fim) && prazo >= a.inicio && prazo <= a.fim)) {
    somar(20, 'Prazo dentro de férias ou licença-prêmio');
  }

  return { score, faixa: faixaDoScore(score), motivos };
}

// Fila aberta ordenada por: maior score, prazo mais próximo, data de criação.
// Demandas com erro de validação não derrubam as demais; vão para `erros`.
export function priorizarFila(demandas, hoje, contexto = {}) {
  const fila = [];
  const erros = [];
  for (const demanda of demandas) {
    try {
      const resultado = priorizar(demanda, hoje, contexto);
      if (!resultado.foraDaFila) fila.push({ demanda, prazo: prazoDemanda(demanda), ...resultado });
    } catch (e) {
      if (!(e instanceof ErroValidacao)) throw e;
      erros.push({ demanda, erro: e.message });
    }
  }
  fila.sort(
    (a, b) =>
      b.score - a.score ||
      a.prazo.localeCompare(b.prazo) ||
      (a.demanda.criada_em || '').localeCompare(b.demanda.criada_em || '')
  );
  return { fila, erros };
}
