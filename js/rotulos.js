// Rótulos de exibição compartilhados pela interface e pela busca.
export const TIPOS = { operacao: 'Operação de alertas', processo: 'Processo SIGADOC', licenciamento: 'Licenciamento', reuniao: 'Reunião', palestra: 'Palestra', outra: 'Outra' };
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
// Opções do filtro "Prazo" da fila (cada uma é um indicador da tela).
export const FILTRO_PRAZO = { '': 'Todos', vencidas: 'Vencidas', proximos7: 'Próximos 7 dias', semana: 'Concluídas na semana' };
// Tipos de auto lavrado num ponto (lista curta e genérica). `tipo: null` só existe em ponto antigo, anterior ao registro de autos.
export const TIPOS_AUTO = {
  auto_infracao: 'Auto de infração', termo_embargo: 'Termo de embargo', termo_apreensao: 'Termo de apreensão', termo_interdicao: 'Termo de interdição', outro: 'Outro',
};
export const ROTULO_AUTO_SEM_TIPO = 'Auto (tipo não informado)';
// Situação de um ponto quanto ao relatório e aos autos (derivada da etapa).
export const SITUACOES_PONTO = {
  planejado: 'Planejado',
  aguardando_relatorio: 'Aguardando relatório',
  a_lavrar: 'Relatório concluído, auto a lavrar',
  com_auto: 'Com auto lavrado',
  encerrado_sem_auto: 'Encerrado sem auto',
};
export const TIPOS_AFASTAMENTO = { ferias: 'Férias', licenca_premio: 'Licença-prêmio', compensacao: 'Compensação' };
// Tipos de evento da agenda e do calendário.
export const ROTULOS_EVENTO = {
  reuniao: 'Reunião', palestra: 'Palestra', saida_operacao: 'Saída de operação', retorno_operacao: 'Retorno de operação', prazo_relatorio: 'Prazo de relatórios',
  prazo_processo: 'Prazo de processo', prazo_licenciamento: 'Prazo de licenciamento', prazo_demanda: 'Prazo', afastamento: 'Afastamento',
};
export const SITUACOES_AFASTAMENTO = { planejado: 'Planejado', solicitado: 'Solicitado', aprovado: 'Aprovado' };

// Etapas por tipo (só o processo usa etapa). A chave é o valor gravado; o rótulo é o que a tela mostra.
const ETAPAS_DE_PROCESSO = { triagem: 'Triagem', analise: 'Análise', parecer: 'Parecer', devolvido: 'Devolvido' };
export const ETAPAS = {
  processo: ETAPAS_DE_PROCESSO,
  licenciamento: ETAPAS_DE_PROCESSO, // mesmo conjunto de etapas do processo
};
// Valores de etapa gravados antes da lista fixa → etapa equivalente.
export const ETAPA_ANTIGA = { parecer: 'parecer', analise: 'analise', despacho: 'analise', aguardando_informacao: 'triagem', concluido: 'devolvido' };

// Ajuste manual de prioridade: chave gravada → faixa do motor (js/regras.js).
export const PRIORIDADE_MANUAL = { baixa: 'Baixa', media: 'Média', alta: 'Alta', critica: 'Crítica' };
