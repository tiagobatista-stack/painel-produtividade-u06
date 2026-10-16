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
