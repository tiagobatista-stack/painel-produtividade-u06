# Requisitos — Painel de Produtividade (Painel de Demandas)

Aplicação didática, estática, sobre **dados fictícios**. Não se conecta ao SIGADOC nem a bases reais de alertas.

## Funcionais

| ID | Requisito | Marco |
|---|---|---|
| RF01 | Cadastrar demanda: processo SIGADOC (origem MP, Judiciário, Procuradoria de Justiça, ouvidoria, denúncia ou chefia), reunião, palestra, operação de alertas ou outra | M3 |
| RF02 | Exibir campos específicos conforme o tipo escolhido | M3 |
| RF03 | Calcular prioridade automaticamente pelo motor de regras | M2 |
| RF04 | Listar a fila ordenada por prioridade e prazo, com busca e filtros por tipo, status e prioridade | M1/M3 |
| RF05 | Alterar status (a fazer → em andamento → aguardando/sobrestado → concluída) e guardar o histórico | M3 |
| RF06 | Mostrar indicadores: abertas, vencidas, próximos 7 dias, relatórios pendentes, autos a lavrar, sobrestados, concluídas | M1 |
| RF07 | Importar operação colando as linhas da planilha da coordenação; prazo dos relatórios = retorno + N dias | M4 |
| RF08 | Registrar a etapa de cada ponto até auto lavrado ou sem auto, com ação em lote "registrar retorno" | M4 |
| RF09 | Agendar férias e licença-prêmio e avisar sobre prazos e viagens que caem no período | M4 |
| RF10 | Exibir agenda dos próximos 7 dias: reuniões, palestras, saídas de operação, prazos de relatório e afastamentos | M4 |
| RF11 | Exportar CSV de demandas e de pontos, JSON e resumo semanal com relatórios e autos da semana | M5 |
| RF12 | Botão "Limpar filtros" (melhoria entregue por branch e PR) | Evolução |
| RF13 | Persistir no navegador e carregar o exemplo fictício na primeira abertura | M3 |
| RF14 | Sobrestar demanda aguardando resposta do interessado, ou operação aguardando a identificação do autuado: status "Aguardando" (na operação, pela ação "Sobrestar operação") suspende o prazo, tira a demanda da fila ativa e dos indicadores de prazo, e a lista no filtro e no indicador "Sobrestados" | M4 |

## Não funcionais

| ID | Requisito |
|---|---|
| RNF01 | Layout responsivo até 360 px |
| RNF02 | Nenhum dado real ou pessoal |
| RNF03 | Funciona sem backend |
| RNF04 | Navegação por teclado e contraste legível |
| RNF05 | Motor de regras único, usado por interface, testes e MCP |
| RNF06 | `npm run build` gera `public/` para a Vercel |

## Modelo de dados (resumo)

- **Demanda**: `id`, `tipo` (operacao, processo, reuniao, palestra, outra), `titulo`, `origem` (mp, judiciario, procuradoria, ouvidoria, denuncia, chefia, propria), `prazo`, `status` (a_fazer, em_andamento, aguardando, concluida), `esforco_h`, `criada_em`, `historico[]`. A prioridade é calculada, não armazenada.
- **Processo**: `processo`, `etapa`. **Reunião/palestra**: `data_hora`, `local`, `publico`.
- **Operação**: `equipe`, `saida`, `retorno`, `prazo_dias`, `horas_ponto`, `pontos[]`, `sobrestada` (opcional; verdadeiro enquanto o prazo está suspenso). Prazo = retorno + `prazo_dias`; esforço = pendentes × `horas_ponto`.
- **Ponto**: `n`, `coord_x`, `coord_y`, `municipio`, `nota`, `etapa`, `data_relatorio`, `data_auto`. Etapas: `planejado`, `vistoriado`, `relatorio_elaboracao`, `relatorio_concluido`, `auto_lavrado`, `encerrado_nao_constatado`, `encerrado_nao_acessado`.
- **Afastamento** (lista própria no seed, não dentro da demanda): `id`, `tipo` (ferias, licenca_premio), `inicio`, `fim`, `situacao` (planejado, solicitado, aprovado).

## Definições dos indicadores

- **Abertas**: ativas, isto é, nem concluídas nem sobrestadas. **Vencidas**: abertas com prazo anterior a hoje.
- **Sobrestados**: demandas com status "Aguardando" (prazo suspenso, fora da fila ativa).
- **Próximos 7 dias**: abertas com prazo entre hoje e hoje + 7.
- **Relatórios pendentes**: pontos em `vistoriado` ou `relatorio_elaboracao`.
- **Autos a lavrar**: pontos em `relatorio_concluido`.
- **Concluídas na semana**: concluídas com `concluida_em` na semana corrente (segunda a domingo).

## Exportações (RF11)

- **CSV de demandas:** todas as demandas, inclusive concluídas e sobrestadas, sem coordenadas; faixa e score só para as ativas.
- **CSV de pontos:** pontos de todas as operações, com coordenadas; as 8 primeiras colunas são as da planilha da coordenação, e as linhas de uma operação podem ser coladas de volta na importação.
- **Formato:** pensado para o Excel em português (separador `;`, UTF-8 com BOM, datas dd/mm/aaaa, vírgula decimal). Texto que começa com `=`, `+`, `-`, `@` ou tabulação recebe um apóstrofo, para não virar fórmula.
- **JSON:** cópia completa do que está no navegador. Restaurar a partir do JSON não faz parte do RF11.
- **Resumo semanal (TXT):** semana de segunda a domingo conforme a data de referência. Relatórios concluídos = pontos com data de relatório na semana; autos lavrados = pontos com data de auto na semana; sem auto = pontos encerrados como não constatado ou não acessado.
- **Coordenadas do exemplo são fictícias**, em pleno Atlântico, longe de qualquer local real. Arquivos exportados com dados reais devem ficar em local institucional, nunca no repositório (o `.gitignore` ignora os nomes padrão).

## Fora do escopo

Autenticação e perfis, backend e banco de dados, integração com SIGADOC e sistema de autos, cruzamento com camadas SEMA-MT, cálculo de saldo de férias e dados reais.
