// Pontos das operações como demandas próprias: situação do relatório e dos autos de cada um, para o monitoramento.
// Funções puras (sem DOM nem armazenamento). Nada aqui altera as operações recebidas.
import { autosDoPonto, prazoDemanda, relatorioDoPonto } from './indicadores.js';
import { normalizarBusca } from './demandas.js';
import { SITUACOES_PONTO, TIPOS_AUTO } from './rotulos.js';

// Da mais urgente para a menos: o que falta primeiro.
export const ORDEM_SITUACOES = ['aguardando_relatorio', 'a_lavrar', 'planejado', 'com_auto', 'encerrado_sem_auto'];
export const FILTROS_PONTOS_PADRAO = Object.freeze({ busca: '', operacao: '', situacao: '' });

// Situação do ponto quanto ao relatório e aos autos, derivada da etapa.
export function situacaoDoPonto(ponto) {
  switch (ponto.etapa) {
    case 'vistoriado':
    case 'relatorio_elaboracao':
      return 'aguardando_relatorio';
    case 'relatorio_concluido':
      return 'a_lavrar';
    case 'auto_lavrado':
      return 'com_auto';
    case 'encerrado_nao_constatado':
    case 'encerrado_nao_acessado':
      return 'encerrado_sem_auto';
    default:
      return 'planejado';
  }
}

// Uma linha por ponto de todas as operações, com o relatório (grupo ou próprio) e os autos. Sem filtro nem ordem.
export function pontosDasOperacoes(demandas) {
  return demandas
    .filter((d) => d.tipo === 'operacao')
    .flatMap((op) =>
      op.pontos.map((p) => {
        const grupo = relatorioDoPonto(op, p.n);
        return {
          operacaoId: op.id,
          operacao: op.titulo,
          equipe: op.equipe,
          saida: op.saida,
          retorno: op.retorno,
          prazo: prazoDemanda(op),
          sobrestada: Boolean(op.sobrestada),
          n: p.n,
          municipio: p.municipio,
          nota: p.nota ?? '',
          observacoes: p.observacoes ?? '',
          etapa: p.etapa,
          situacao: situacaoDoPonto(p),
          relatorio: grupo ? { id: grupo.id, pontos: grupo.pontos } : null,
          dataRelatorio: p.data_relatorio ?? null,
          autos: autosDoPonto(p),
          coordX: p.coord_x ?? null,
          coordY: p.coord_y ?? null,
        };
      })
    );
}

function textoPesquisavel(l) {
  const autos = l.autos.map((a) => (a.tipo ? TIPOS_AUTO[a.tipo] : 'auto')).join(' ');
  return normalizarBusca([l.operacaoId, l.operacao, l.equipe, `ponto ${l.n}`, l.municipio, l.nota, l.observacoes, l.relatorio?.id, autos].filter(Boolean).join(' '));
}

export function filtrosPontosEmUso(filtros) {
  const f = { ...FILTROS_PONTOS_PADRAO, ...filtros };
  return f.busca.trim() !== '' || f.operacao !== '' || f.situacao !== '';
}

// Filtra e ordena: primeiro o que falta (aguardando relatório, auto a lavrar), depois por operação e número do ponto.
// filtros: { busca, operacao (id), situacao }. A busca olha operação, equipe, município, notas, relatório e tipo de auto.
export function listarPontos(demandas, filtros = {}) {
  const { busca = '', operacao = '', situacao = '' } = filtros;
  const termos = normalizarBusca(busca).split(/\s+/).filter(Boolean);
  return pontosDasOperacoes(demandas)
    .filter((l) => (!operacao || l.operacaoId === operacao) && (!situacao || l.situacao === situacao) && termos.every((t) => textoPesquisavel(l).includes(t)))
    .sort(
      (a, b) =>
        ORDEM_SITUACOES.indexOf(a.situacao) - ORDEM_SITUACOES.indexOf(b.situacao) || a.operacaoId.localeCompare(b.operacaoId) || a.n - b.n
    );
}

// Contagem por situação (todas as chaves, mesmo zeradas) e total.
export function resumoDosPontos(linhas) {
  const porSituacao = Object.fromEntries(Object.keys(SITUACOES_PONTO).map((s) => [s, 0]));
  for (const l of linhas) porSituacao[l.situacao] += 1;
  return { total: linhas.length, ...porSituacao };
}

// Texto do relatório do ponto para a tela: "R1 (pontos 1, 2, 3) · concluído em 12/10/2026" ou "relatório próprio · em elaboração".
export function descricaoDoRelatorio(linha, formatarData) {
  const quem = linha.relatorio ? `${linha.relatorio.id} (pontos ${linha.relatorio.pontos.join(', ')})` : 'relatório próprio';
  switch (linha.etapa) {
    case 'planejado':
      return `${quem} · aguardando o retorno da equipe`;
    case 'vistoriado':
      return `${quem} · pendente`;
    case 'relatorio_elaboracao':
      return `${quem} · em elaboração`;
    case 'encerrado_nao_constatado':
    case 'encerrado_nao_acessado':
      return `${quem} · encerrado sem auto${linha.dataRelatorio ? ` (relatório de ${formatarData(linha.dataRelatorio)})` : ''}`;
    default:
      return `${quem} · concluído${linha.dataRelatorio ? ` em ${formatarData(linha.dataRelatorio)}` : ''}`;
  }
}
