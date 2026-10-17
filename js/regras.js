// Motor de prioridade. Fonte das regras: docs/REGRAS_PRIORIDADE.md.
// Módulo puro: sem DOM, sem armazenamento. Usado pela interface, pelos testes Node e pelo MCP.
import { PRIORIDADE_MANUAL } from './rotulos.js';
import { dataValida, diasEntre, estaConcluida, estaSobrestada, prazoDemanda, relatoriosPendentes } from './indicadores.js';

export class ErroValidacao extends Error {
  constructor(mensagem) {
    super(mensagem);
    this.name = 'ErroValidacao';
  }
}

// Tabela de pontos: única fonte das regras. É usada por priorizar() e exposta pelo MCP (listar_regras),
// de modo que a interface, os testes e o MCP nunca divirjam.
export const REGRAS = {
  prazo: { vencido: 50, ate2dias: 30, de3a7dias: 15 },
  tipo: { operacao: 20, processo: 15, licenciamento: 15, reuniao: 10, palestra: 5, outra: 0 },
  origemProcesso: { mp: 25, judiciario: 25, procuradoria: 25, ouvidoria: 15, denuncia: 10 },
  chefia: 10,
  relatoriosPendentes: [
    { minimo: 10, pontos: 15 },
    { minimo: 5, pontos: 8 },
  ],
  afastamento: 20,
  faixas: [
    { nome: 'Crítica', minimo: 70 },
    { nome: 'Alta', minimo: 45 },
    { nome: 'Média', minimo: 25 },
    { nome: 'Baixa', minimo: 0 },
  ],
};

const ROTULO_TIPO = { operacao: 'Operação de alertas', processo: 'Processo SIGADOC', licenciamento: 'Licenciamento', reuniao: 'Reunião', palestra: 'Palestra', outra: 'Outra' };
const ROTULO_ORIGEM = {
  mp: 'Ministério Público', judiciario: 'Poder Judiciário', procuradoria: 'Procuradoria de Justiça',
  ouvidoria: 'Ouvidoria', denuncia: 'Denúncia',
};

export function faixaDoScore(score) {
  return REGRAS.faixas.find((f) => score >= f.minimo).nome;
}

function pontosPrazo(dias) {
  if (dias < 0) return [REGRAS.prazo.vencido, 'Prazo vencido'];
  if (dias <= 2) return [REGRAS.prazo.ate2dias, 'Prazo em até 2 dias'];
  if (dias <= 7) return [REGRAS.prazo.de3a7dias, 'Prazo de 3 a 7 dias'];
  return [0, null];
}

export function priorizar(demanda, hoje, { afastamentos = [] } = {}) {
  if (!dataValida(hoje)) throw new ErroValidacao('Data de referência inválida');
  if (!(demanda.tipo in REGRAS.tipo)) throw new ErroValidacao(`Tipo de demanda inválido: ${demanda.tipo}`);
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
  somar(REGRAS.tipo[demanda.tipo], REGRAS.tipo[demanda.tipo] ? ROTULO_TIPO[demanda.tipo] : null);

  // Licenciamento usa as mesmas origens do processo (MP, Judiciário, Procuradoria, ouvidoria, denúncia).
  if ((demanda.tipo === 'processo' || demanda.tipo === 'licenciamento') && demanda.origem in REGRAS.origemProcesso) {
    somar(REGRAS.origemProcesso[demanda.origem], `Origem: ${ROTULO_ORIGEM[demanda.origem]}`);
  }
  if (demanda.origem === 'chefia') somar(REGRAS.chefia, 'Origem: chefia ou coordenação');

  if (demanda.tipo === 'operacao') {
    const pendentes = relatoriosPendentes(demanda);
    const faixa = REGRAS.relatoriosPendentes.find((f) => pendentes >= f.minimo);
    if (faixa) somar(faixa.pontos, `${pendentes} relatórios pendentes`);
  }

  if (afastamentos.some((a) => dataValida(a.inicio) && dataValida(a.fim) && prazo >= a.inicio && prazo <= a.fim)) {
    somar(REGRAS.afastamento, 'Prazo dentro de férias, licença-prêmio ou compensação');
  }

  return { score, faixa: faixaDoScore(score), motivos };
}

// Ajuste manual (docs/REGRAS_PRIORIDADE.md, T14): a faixa escolhida define o grupo na fila; o score calculado não muda.
// Devolve o nome da faixa manual, ou null quando a prioridade é automática.
export function faixaManual(demanda) {
  return PRIORIDADE_MANUAL[demanda.prioridade_manual] ?? null;
}

const posicaoDaFaixa = (nome) => REGRAS.faixas.findIndex((f) => f.nome === nome);

// Fila aberta ordenada por: faixa efetiva (a manual, se houver), maior score calculado, prazo mais próximo, data de criação.
// `faixa` é a efetiva; `faixa_calculada` e `score` vêm sempre do cálculo. Demandas com erro de validação não derrubam as demais; vão para `erros`.
export function priorizarFila(demandas, hoje, contexto = {}) {
  const fila = [];
  const erros = [];
  for (const demanda of demandas) {
    try {
      const resultado = priorizar(demanda, hoje, contexto);
      if (resultado.foraDaFila) continue;
      const manual = faixaManual(demanda);
      fila.push({
        demanda, prazo: prazoDemanda(demanda), ...resultado,
        faixa: manual ?? resultado.faixa, faixa_calculada: resultado.faixa, modo: manual ? 'manual' : 'automatica',
      });
    } catch (e) {
      if (!(e instanceof ErroValidacao)) throw e;
      erros.push({ demanda, erro: e.message });
    }
  }
  fila.sort(
    (a, b) =>
      posicaoDaFaixa(a.faixa) - posicaoDaFaixa(b.faixa) ||
      b.score - a.score ||
      a.prazo.localeCompare(b.prazo) ||
      (a.demanda.criada_em || '').localeCompare(b.demanda.criada_em || '')
  );
  return { fila, erros };
}
