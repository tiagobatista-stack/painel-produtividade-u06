// Quadro Kanban: agrupa e ordena o resultado do motor. Funções puras (sem DOM nem armazenamento); não mudam nenhum peso de pontuação.
import { diasEntre, inicioDaSemana, somarDias, estaConcluida } from './indicadores.js';
import { listarDemandas } from './demandas.js';
import { priorizarFila } from './regras.js';

export const LIMITE_PADRAO = 3;
export const LIMITE_MIN = 1;
export const LIMITE_MAX = 20;

export const COLUNAS = [
  { chave: 'a_fazer', rotulo: 'A fazer' },
  { chave: 'em_andamento', rotulo: 'Em andamento' },
  { chave: 'aguardando', rotulo: 'Sobrestado' },
  { chave: 'concluida', rotulo: 'Concluída (semana)' },
];

// Classes de serviço, na ordem das faixas do quadro.
export const CLASSES = [
  { chave: 'urgente', rotulo: 'Urgente' },
  { chave: 'data_fixa', rotulo: 'Data fixa' },
  { chave: 'padrao', rotulo: 'Padrão' },
  { chave: 'rotina', rotulo: 'Rotina' },
];

const ROTULO_COLUNA = Object.fromEntries(COLUNAS.map((c) => [c.chave, c.rotulo]));

export function rotuloDaColuna(chave) {
  return ROTULO_COLUNA[chave] ?? chave;
}

// Urgente vale só para demanda aberta (vencida ou faixa Crítica) e prevalece sobre as demais.
// Sobrestada e concluída usam a classe pelo tipo.
export function classeDeServico(item, hoje) {
  const { demanda: d } = item;
  const aberta = !item.concluida && !item.sobrestada;
  if (aberta && ((item.prazo !== null && item.prazo < hoje) || item.faixa === 'Crítica')) return 'urgente';
  if (d.tipo === 'reuniao' || d.tipo === 'palestra') return 'data_fixa';
  if (d.tipo === 'outra') return 'rotina';
  return 'padrao';
}

// Dias parado: desde o último evento "Status: …" do histórico ou, na falta dele, desde a criação.
export function idadeEmDias(demanda, hoje) {
  const eventos = (demanda.historico || []).filter((h) => typeof h.evento === 'string' && h.evento.startsWith('Status:'));
  const ultima = eventos.length ? eventos[eventos.length - 1].data : demanda.criada_em;
  return ultima ? Math.max(0, diasEntre(ultima, hoje)) : null;
}

export function tempoAteConcluir(demanda) {
  return demanda.criada_em && demanda.concluida_em ? diasEntre(demanda.criada_em, demanda.concluida_em) : null;
}

// Concluídas por semana (segunda a domingo), da mais antiga para a semana corrente.
export function vazaoSemanal(demandas, hoje, semanas = 4) {
  const atual = inicioDaSemana(hoje);
  return Array.from({ length: semanas }, (_, i) => {
    const inicio = somarDias(atual, -7 * (semanas - 1 - i));
    const fim = somarDias(inicio, 6);
    const total = demandas.filter((d) => estaConcluida(d) && d.concluida_em >= inicio && d.concluida_em <= fim).length;
    return { inicio, fim, total };
  });
}

// Média, em dias, do tempo até concluir (só demandas concluídas com as duas datas). Null se não há nenhuma.
export function tempoMedioAteConcluir(demandas) {
  const tempos = demandas.filter(estaConcluida).map(tempoAteConcluir).filter((t) => t !== null);
  return tempos.length ? tempos.reduce((a, b) => a + b, 0) / tempos.length : null;
}

// Operação não arrasta (status derivado dos pontos) e concluída não volta pelo quadro.
export function podeArrastar(demanda) {
  return demanda.tipo !== 'operacao' && demanda.status !== 'concluida';
}

// Botões de movimento do card. A operação só tem Sobrestar/Retomar, que a interface liga ao fluxo próprio dela.
export function movimentosPermitidos(demanda) {
  if (demanda.tipo === 'operacao') return [];
  switch (demanda.status) {
    case 'a_fazer': return [{ rotulo: 'Iniciar', para: 'em_andamento' }, { rotulo: 'Aguardar', para: 'aguardando' }];
    case 'em_andamento': return [{ rotulo: 'Aguardar', para: 'aguardando' }, { rotulo: 'Concluir', para: 'concluida' }];
    case 'aguardando': return [{ rotulo: 'Retomar', para: 'em_andamento' }];
    default: return [];
  }
}

// Pode soltar este card nesta coluna? Só para outra coluna, e nunca para uma demanda que não arrasta.
export function podeMoverPara(demanda, coluna) {
  return podeArrastar(demanda) && coluna !== demanda.status && COLUNAS.some((c) => c.chave === coluna);
}

// Monta as 4 colunas. Cada item é o da fila do motor mais `classe` e `idade`.
// Abertas seguem a ordem de priorizarFila; sobrestadas e concluídas (semana corrente) usam a ordem de listarDemandas.
export function montarQuadro(demandas, hoje, contexto = {}, { limite = LIMITE_PADRAO } = {}) {
  const { fila } = priorizarFila(demandas, hoje, contexto);
  const sobrestadas = listarDemandas(demandas, { status: 'aguardando' }, hoje, contexto).itens;
  const concluidas = listarDemandas(demandas, { status: 'concluida', prazo: 'semana' }, hoje, contexto).itens;
  const marcar = (item) => ({ ...item, classe: classeDeServico(item, hoje), idade: idadeEmDias(item.demanda, hoje) });
  const itensPorColuna = {
    a_fazer: fila.filter((x) => x.demanda.status === 'a_fazer'),
    em_andamento: fila.filter((x) => x.demanda.status === 'em_andamento'),
    aguardando: sobrestadas,
    concluida: concluidas,
  };
  const colunas = COLUNAS.map(({ chave, rotulo }) => {
    const itens = itensPorColuna[chave].map(marcar);
    const coluna = { chave, rotulo, itens, total: itens.length };
    if (chave === 'em_andamento') Object.assign(coluna, { limite, acimaDoLimite: itens.length > limite });
    return coluna;
  });
  return { colunas, classes: CLASSES.map((c) => c.chave) };
}
