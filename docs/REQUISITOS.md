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
| RF09 | Agendar férias, licença-prêmio e compensação e avisar sobre prazos e viagens que caem no período | M4 |
| RF10 | Exibir agenda dos próximos 7 dias: reuniões, palestras, saídas de operação, prazos de relatório e afastamentos | M4 |
| RF11 | Exportar CSV de demandas e de pontos, JSON e resumo semanal com relatórios e autos da semana | M5 |
| RF12 | Botão "Limpar filtros" (melhoria entregue por branch e PR) | Evolução |
| RF13 | Persistir no navegador e carregar o exemplo fictício na primeira abertura | M3 |
| RF14 | Sobrestar demanda aguardando resposta do interessado, ou operação aguardando a identificação do autuado: status "Aguardando" (na operação, pela ação "Sobrestar operação") suspende o prazo, tira a demanda da fila ativa e dos indicadores de prazo, e a lista no filtro e no indicador "Sobrestados" | M4 |
| RF15 | Organizar a página em abas com o estado no endereço (`#quadro`, `#agenda`, `#afastamentos`, `#relatorios`), topo fixo com a data de referência e "Nova demanda", e faixa "Foco de hoje" de até 3 itens (vencidas, as que vencem hoje, maior placar); 4 indicadores em destaque (Vencidas, Próximos 7 dias, Sobrestados, Concluídas na semana) que filtram a fila, os demais na aba Relatórios; exportações no menu "Exportar" da aba Relatórios. Altera RF04, RF06, RF10 e RF11 | M8 |
| RF16 | Visão em quadro com colunas por status (A fazer, Em andamento, Sobrestado, Concluída na semana), ordenadas pelo motor, e alternância Lista/Quadro salva no navegador. Altera RF04. | M9 |
| RF17 | Limite configurável de itens em andamento (padrão 3), com aviso visual ao ultrapassar, sem bloquear. Altera RF05. | M9 |
| RF18 | Mover card entre colunas arrastando ou por botões (Iniciar, Aguardar, Retomar, Concluir), com teclado; operação só por "Sobrestar/Retomar". Altera RF05. | M9 |
| RF19 | Classes de serviço em faixas: Urgente (vencida ou Crítica), Data fixa (reunião, palestra), Padrão (processo, operação), Rotina (outra). Altera RF04. | M9 |
| RF20 | Card compacto (tipo, título, faixa de prioridade na cor da borda e em texto, e prazo relativo); motivos, pontos, histórico, status, edição e exclusão ficam num painel lateral. Excluir sem caixa de confirmação, com "Desfazer" por cerca de 8 s. Altera RF04 e RF05. A "próxima ação" no card é do RF23 (M10) | M8 |
| RF21 | Métricas de fluxo: idade do card ("parado há N dias"), tempo até concluir e vazão semanal. Altera RF11. | M9 |
| RF28 | Kanban de projetos (`kanban.html`, página à parte do painel): quadro com 4 colunas de status (Backlog, Em andamento, Em revisão, Concluído) e contagem por coluna | Kanban |
| RF29 | Card do Kanban com título, descrição, prioridade (Alta, Média, Baixa, escolhida pelo usuário) e prazo opcional; criar, editar e excluir com validação | Kanban |
| RF30 | Mover cards do Kanban por arrastar ou por botões `◀ ▶` (com teclado), com histórico e anúncio da mudança | Kanban |
| RF31 | Filtros do Kanban: busca, prioridade, prazo (atrasados, próximos 7 dias, sem prazo) e status, combináveis, com "Limpar filtros" | Kanban |
| RF32 | Persistência local do Kanban em chave própria (`kanban-dt:v1`), com recuperação de dado inválido, "Restaurar exemplo" e "Desfazer" na exclusão | Kanban |
| RF33 | Aba Design Thinking (Empatizar, Definir, Idear, Prototipar, Testar): notas por etapa e promoção de uma ideia a card do Backlog | Kanban |
| RF34 | Relatório agrupado: somar 2 ou mais pontos da mesma operação num só relatório (mesma etapa, Vistoriado ou Em elaboração); as etapas do relatório valem para todos os pontos dele, o agrupamento desfaz-se enquanto o relatório não está concluído, e o indicador "Relatórios pendentes" e as horas por relatório contam relatórios, não pontos | Pontos |
| RF35 | Vários autos por ponto, cada um com tipo (Auto de infração, Termo de embargo, Termo de apreensão, Termo de interdição, Outro) e data; só com o relatório concluído; remover o último volta o ponto a "Relatório concluído"; ponto antigo em "Auto lavrado" vale como 1 auto de tipo não informado | Pontos |
| RF36 | Aba "Pontos": cada ponto de cada operação como uma demanda, com situação do relatório e dos autos (Planejado, Aguardando relatório, Relatório concluído com auto a lavrar, Com auto lavrado, Encerrado sem auto), contadores que filtram, busca, filtro por operação e por situação; sem coordenadas na tela | Pontos |
| RF37 | Anotações (observações) em todas as demandas, inclusive operações, e em cada ponto: caixa de texto para o que já foi executado e o que está pendente, com rascunho preservado, marcador "Com anotações" no card, busca e coluna OBSERVACOES nos CSV | Pontos |
| RF38 | Importar a planilha com coordenadas em graus, minutos e segundos (`dd° mm' ss,sss" H`, hemisférios N, S, E, L, W, O) além de decimais; valores impossíveis são recusados sem repetir o valor digitado | Pontos |
| RF39 | CSV de pontos com as colunas RELATORIO, AUTOS e OBSERVACOES no fim da linha; CSV de demandas com OBSERVACOES; resumo semanal contando relatórios (grupo = 1) e cada auto pela sua data | Pontos |
| RF40 | Calendário e agenda com a programação da operação: período de saída a retorno em todos os dias do intervalo (inclusive operação concluída ou sobrestada, em tom discreto) e evento de retorno | Pontos |
| RF41 | Mapa local dos pontos na aba "Pontos" (visão Lista \| Mapa): SVG sem mapa-base nem requisição externa, marcadores por situação em cor e forma, legenda com contagem, mesmos filtros da lista, operável pelo teclado, e lista dos pontos sem coordenadas | Pontos |

## Evolução proposta: Kanban e GTD (M9–M10)

O M8 (RF15 e RF20) e o M9 (RF16 a RF19 e RF21) foram entregues e passaram para a tabela principal. Os demais ainda não foram implementados. Detalhes, diagnóstico e decisões pendentes em `docs/MELHORIAS_KANBAN_GTD.md`. A coluna "Altera" indica quais requisitos já existentes cada novo requisito modifica.

| ID | Requisito | Altera | Marco |
|---|---|---|---|
| RF22 | Captura rápida só com título para a caixa de entrada (status `entrada`), processada depois para entrar na fila | RF01, RF05, RF13 | M10 |
| RF23 | Campo opcional "próxima ação" exibido no card | RF01, RF20 | M10 |
| RF24 | Campo opcional "contexto" (computador, campo, reunião, telefone) e filtro "O que posso fazer agora" | RF01, RF04 | M10 |
| RF25 | Sobrestamento com "aguardando de" e "cobrar em"; na data de cobrança, o item aparece em "Foco de hoje" | RF14, RF15 | M10 |
| RF26 | Reuniões e palestras ficam na faixa "Data fixa" e na agenda; só entram em "Foco de hoje" no próprio dia | RF10, RF15 | M10 |
| RF27 | Revisão semanal guiada (checklist) no lugar do bloco "Resumo da semana", com a data da última revisão salva no navegador | RF11 | M10 |

## Não funcionais

| ID | Requisito |
|---|---|
| RNF01 | Layout responsivo até 360 px |
| RNF02 | Nenhum dado real ou pessoal |
| RNF03 | Funciona sem backend |
| RNF04 | Navegação por teclado e contraste legível |
| RNF05 | Motor de regras único, usado por interface, testes e MCP |
| RNF06 | `npm run build` gera `public/` para a Vercel (as duas páginas: `index.html` e `kanban.html`) |
| RNF07 | Melhorias de interface sem biblioteca externa nem código embutido (política de conteúdo do `vercel.json`); arrastar com API nativa e alternativa por teclado (proposto, M9) |
| RNF08 | Campos novos opcionais: dados já salvos e cópias JSON antigas continuam válidos sem migração (proposto, M10) |

## Modelo de dados (resumo)

- **Demanda**: `id`, `tipo` (operacao, processo, reuniao, palestra, outra), `titulo`, `origem` (mp, judiciario, procuradoria, ouvidoria, denuncia, chefia, propria), `prazo`, `status` (a_fazer, em_andamento, aguardando, concluida), `esforco_h`, `criada_em`, `historico[]`. A prioridade é calculada, não armazenada.
- **Processo**: `processo`, `etapa`. **Reunião/palestra**: `data_hora`, `local`, `publico`.
- **Operação**: `equipe`, `saida`, `retorno`, `prazo_dias`, `horas_ponto`, `pontos[]`, `sobrestada` (opcional; verdadeiro enquanto o prazo está suspenso). Prazo = retorno + `prazo_dias`; esforço = pendentes × `horas_ponto`.
- **Ponto**: `n`, `coord_x`, `coord_y`, `municipio`, `nota`, `etapa`, `data_relatorio`, `data_auto`. Etapas: `planejado`, `vistoriado`, `relatorio_elaboracao`, `relatorio_concluido`, `auto_lavrado`, `encerrado_nao_constatado`, `encerrado_nao_acessado`.
- **Afastamento** (lista própria no seed, não dentro da demanda): `id`, `tipo` (ferias, licenca_premio, compensacao), `inicio`, `fim`, `situacao` (planejado, solicitado, aprovado).

- **Campos propostos (M10, opcionais):** na demanda, `proxima_acao`, `contexto` (computador, campo, reuniao, telefone), `aguardando_de` e `cobrar_em`; novo status `entrada` (caixa de entrada). Na configuração do navegador, `limite_em_andamento` (padrão 3), a visão escolhida (lista ou quadro) e a data da última revisão semanal.

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

- **Kanban de projetos** (RF28 a RF33; modelo próprio, separado da demanda, em `docs/KANBAN_DESIGN_THINKING.md`): **card** (`id` K-0001, `titulo`, `descricao`, `prioridade`, `prazo` opcional, `status`, `criado_em`, `historico[]`) e **nota** de Design Thinking (`id` N-0001, `etapa`, `texto`, `card_id` opcional), guardados em `kanban-dt:v1`.

- **Pontos, relatórios e autos** (RF34 a RF41): na operação, `relatorios` (opcional: `[{ id, pontos[], criado_em }]`), no ponto `autos` (opcional: `[{ id, tipo, data }]`) e `observacoes` (opcional, até 500 caracteres); na demanda, `observacoes` (opcional, até 2000). `data_relatorio` e `data_auto` (data do primeiro auto) continuam preenchidos. Tudo opcional: dados salvos antes continuam válidos. Detalhes em `docs/PONTOS_RELATORIOS_AUTOS.md`.

## Fora do escopo

Autenticação e perfis, backend e banco de dados, integração com SIGADOC e sistema de autos, cruzamento com camadas SEMA-MT, cálculo de saldo de férias e dados reais.
