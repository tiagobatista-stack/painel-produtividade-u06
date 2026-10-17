// Rótulos de exibição compartilhados pela interface e pela busca.
export const TIPOS = { operacao: 'Operação de alertas', processo: 'Processo SIGADOC', reuniao: 'Reunião', palestra: 'Palestra', outra: 'Outra' };
export const ORIGENS = {
  mp: 'Ministério Público', judiciario: 'Poder Judiciário', procuradoria: 'Procuradoria de Justiça',
  ouvidoria: 'Ouvidoria', denuncia: 'Denúncia', chefia: 'Chefia', propria: 'Própria',
};
export const STATUS = { a_fazer: 'A fazer', em_andamento: 'Em andamento', aguardando: 'Sobrestado (aguardando)', concluida: 'Concluída' };

export const ETAPAS_PONTO = {
  planejado: 'Planejado',
  vistoriado: 'Vistoriado (relatório pendente)',
  relatorio_elaboracao: 'Relatório em elaboração',
  relatorio_concluido: 'Relatório concluído',
  auto_lavrado: 'Auto lavrado',
  encerrado_nao_constatado: 'Encerrado: não constatado',
  encerrado_nao_acessado: 'Encerrado: não acessado',
};
export const TIPOS_AFASTAMENTO = { ferias: 'Férias', licenca_premio: 'Licença-prêmio' };
export const SITUACOES_AFASTAMENTO = { planejado: 'Planejado', solicitado: 'Solicitado', aprovado: 'Aprovado' };

// Etapas por tipo (só o processo usa etapa). A chave é o valor gravado; o rótulo é o que a tela mostra.
export const ETAPAS = {
  processo: { triagem: 'Triagem', analise: 'Análise', parecer: 'Parecer', devolvido: 'Devolvido' },
};
// Valores de etapa gravados antes da lista fixa → etapa equivalente.
export const ETAPA_ANTIGA = { parecer: 'parecer', analise: 'analise', despacho: 'analise', aguardando_informacao: 'triagem', concluido: 'devolvido' };

// Ajuste manual de prioridade: chave gravada → faixa do motor (js/regras.js).
export const PRIORIDADE_MANUAL = { baixa: 'Baixa', media: 'Média', alta: 'Alta', critica: 'Crítica' };
