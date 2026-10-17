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
| RF15 | Formulário de demanda reorganizado: Tipo, Origem, Título, Descrição, Status, Prioridade, Responsável, Prazo, Município, Protocolo/referência e Anotações; Etapa como lista conforme o tipo; duas colunas a partir de 600 px; Tipo, Título e Prazo obrigatórios; prazo começa vazio | Evolução · PR A |
| RF16 | Prioridade automática com ajuste manual: o padrão é "Automática (calculada)"; o ajuste para Baixa, Média, Alta ou Crítica exige motivo; a faixa manual define o grupo na fila e, dentro dele, vale o score calculado; o cartão mostra a faixa manual e a calculada | Evolução · PR A |
| RF17 | Prévia da prioridade calculada no rodapé do formulário (faixa, score e motivos), atualizada ao mudar tipo, origem, prazo, status ou dados da operação | Evolução · PR A |
| RF18 | Anotações em lista com caixa de seleção: adicionar por Enter ou botão (colar várias linhas cria um item por linha), marcar como feita, editar, remover com "Desfazer"; marcar direto no cartão da fila; contador "Anotações n/m"; conclusão registrada no histórico | Evolução · PR A |
| RF19 | Localização da demanda: endereço ou referência espacial, latitude e longitude em graus, minutos e segundos (N/S, L/O e E/W), conversão para graus decimais, aviso quando o ponto fica fora de Mato Grosso e botão "Localizar" que abre o mapa em nova aba | Evolução · PR B (planejado) |

## Não funcionais

| ID | Requisito |
|---|---|
| RNF01 | Layout responsivo até 360 px |
| RNF02 | Nenhum dado real ou pessoal |
| RNF03 | Funciona sem backend |
| RNF04 | Navegação por teclado e contraste legível |
| RNF05 | Motor de regras único, usado por interface, testes e MCP |
| RNF06 | `npm run build` gera `public/` para a Vercel |
| RNF07 | Todo texto digitado pelo usuário (título, descrição, anotações, endereço) é exibido como texto puro, nunca interpretado como HTML |
| RNF08 | A página não faz requisições de rede além da própria origem (CSP `connect-src 'self'`); o botão "Localizar" apenas abre um link em nova aba |

## Modelo de dados (resumo)

- **Demanda**: `id`, `tipo` (operacao, processo, reuniao, palestra, outra), `titulo`, `origem` (mp, judiciario, procuradoria, ouvidoria, denuncia, chefia, propria), `prazo`, `status` (a_fazer, em_andamento, aguardando, concluida), `esforco_h`, `criada_em`, `historico[]`. A prioridade é calculada, não armazenada.
- **Processo**: `processo`, `etapa`. **Reunião/palestra**: `data_hora`, `local`, `publico`.
- **Operação**: `equipe`, `saida`, `retorno`, `prazo_dias`, `horas_ponto`, `pontos[]`, `sobrestada` (opcional; verdadeiro enquanto o prazo está suspenso). Prazo = retorno + `prazo_dias`; esforço = pendentes × `horas_ponto`.
- **Ponto**: `n`, `coord_x`, `coord_y`, `municipio`, `nota`, `etapa`, `data_relatorio`, `data_auto`. Etapas: `planejado`, `vistoriado`, `relatorio_elaboracao`, `relatorio_concluido`, `auto_lavrado`, `encerrado_nao_constatado`, `encerrado_nao_acessado`.
- **Campos novos da demanda (RF15 a RF18):** `descricao` (até 2000 caracteres), `responsavel`, `municipio`, `protocolo` (no tipo processo é o próprio número do processo e substitui o antigo `processo`), `etapa` (processo: `triagem`, `analise`, `parecer` ou `devolvido`), `prioridade_manual` (ausente = automática; ou `baixa`, `media`, `alta`, `critica`), `motivo_ajuste` (obrigatório, até 200 caracteres, com ajuste manual) e `anotacoes[]`. Os campos de texto curto aceitam até 120 caracteres. Só Tipo, Título e Prazo são obrigatórios; o protocolo é opcional.
- **Migração (dados salvos no navegador e seed):** a cada carga, `migrarDemanda` copia `processo` para `protocolo`, converte a etapa antiga para a da lista (`despacho` → `analise`, `aguardando_informacao` → `triagem`, `concluido` → `devolvido`; valor desconhecido fica sem etapa) e garante `anotacoes: []`. É idempotente e não muda a versão do armazenamento.
- **Campos do PR B (RF19, planejado):** `endereco`, `lat_gms` e `lon_gms` (texto como digitado), `lat` e `lon` (graus decimais, 6 casas).
- **Anotação:** `id` (`A-1`, `A-2`…), `texto` (até 280 caracteres), `feita`, `criada_em`, `concluida_em`. Até 100 por demanda. Não altera a prioridade.
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
- **Com RF15 a RF18:** o CSV de demandas troca a coluna `PROCESSO` por `PROTOCOLO` (mesmo dado, sem duplicar) e acrescenta, depois de `SOBRESTADA`, as colunas `DESCRICAO`, `RESPONSAVEL`, `MUNICIPIO`, `PRIORIDADE_MODO` (`automatica` ou `manual`), `MOTIVO_AJUSTE` e `ANOTACOES` (formato `[x] texto | [ ] texto`). `FAIXA` é a efetiva (a manual, se houver) e `SCORE` é sempre o calculado. O JSON leva todos os campos.
- **Com o PR B (planejado):** o CSV de demandas ganha também `ENDERECO`, `LATITUDE` e `LONGITUDE` (decimais), e passa a valer para ele o mesmo aviso sobre coordenadas do CSV de pontos.
- **Coordenadas do exemplo são fictícias**, em pleno Atlântico, longe de qualquer local real. Arquivos exportados com dados reais devem ficar em local institucional, nunca no repositório (o `.gitignore` ignora os nomes padrão).

## Formulário de demanda (RF15 a RF18 entregues no PR A; RF19 planejado no PR B)

| Linha | Campos (duas colunas a partir de 600 px) |
|---|---|
| 1 | Tipo \| Origem |
| 2 | Título (foco ao abrir; exemplo "Ex.: Renovar licença ambiental") |
| 3 | Descrição ("Contexto, objetivo e próximos passos") |
| 4 | Status \| Prioridade |
| 5 | Responsável ("Nome ou equipe") \| Prazo |
| 6 | Município ("Ex.: Cuiabá - MT") \| Protocolo/referência ("SEMA-PRO-FICT-0000") |
| 7 | Etapa (só processo) \| Esforço estimado (h); na operação, Prazo dos relatórios \| Horas por relatório. Reunião e palestra mostram antes Data e hora \| Local (e Público) |
| 8 | Endereço ou referência espacial + "Localizar" (PR B) |
| 9 | Latitude em GMS \| Longitude em GMS (PR B) |
| 10 | Anotações |
| Rodapé | Prévia da prioridade calculada · Cancelar · Salvar demanda |

- **Coordenadas (PR B):** aceitam `°`, `'`, `"`, espaços, vírgula ou ponto decimal; minutos e segundos menores que 60; hemisfério obrigatório. Ponto fora de Mato Grosso (latitude de 7° a 18° S, longitude de 50° a 62° O) gera aviso, sem bloquear. Exemplos: 11° 25' 12,00" S → -11,420000; 58° 45' 00,00" O → -58,750000.
- **"Localizar" (PR B):** com coordenadas válidas, abre o ponto no OpenStreetMap em nova aba; sem coordenadas e com endereço, abre a busca do endereço. Nada é enviado sem o clique do usuário, e o aviso abaixo do botão informa que o texto vai para o serviço de mapas.
- **Dados de exemplo:** o seed continua sem coordenadas e com protocolos no formato `SEMA-PRO-FICT-…`.

## Fora do escopo

Autenticação e perfis, backend e banco de dados, busca automática de endereço por serviço externo (geocodificação), integração com SIGADOC e sistema de autos, cruzamento com camadas SEMA-MT, cálculo de saldo de férias e dados reais.
