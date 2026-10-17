# Requisitos — Painel de Produtividade (Painel de Demandas)

Aplicação didática, estática, sobre **dados fictícios**. Não se conecta ao SIGADOC nem a bases reais de alertas.

> **Faixa reservada — linha "Localização e Vistoria":** RF42, RF43, RF48 e RF49 a RF70; RNF11 a RNF15; casos de teste T19 a T30 (T19 a T22 já usados pelo Licenciamento). Não usar estes números em outra linha de trabalho. Estão **especificados e ainda não implementados**, exceto o **RF42 e o RF48 (entregues no PR B: coordenadas e endereço no cadastro e na edição)**, o **RF43 (tipo Licenciamento, entregue)** e o mapa v1 (RF41). O mapa e a ação de campo são detalhados em `docs/MAPA.md` e `docs/ACAO_DE_CAMPO.md`.

## Funcionais

| ID | Requisito | Marco |
|---|---|---|
| RF01 | Cadastrar demanda: processo SIGADOC (origem MP, Judiciário, Procuradoria de Justiça, ouvidoria, denúncia ou chefia), reunião, palestra, operação de alertas, **licenciamento** (RF43) ou outra | M3 |
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
| RF15 | Organizar a página em abas com o estado no endereço (`#quadro`, `#agenda`, `#afastamentos`, `#relatorios`; a aba do `#quadro` se chama **"Demandas"**), topo fixo só com o título e "Nova demanda", 4 indicadores em destaque (Vencidas, Próximos 7 dias, Sobrestados, Concluídas na semana) que filtram a fila, os demais na aba Relatórios; exportações no menu "Exportar" da aba Relatórios. **O bloco "Foco de hoje" foi removido** na refatoração visual (o topo da fila, já ordenado pelo motor, cumpre esse papel) e a data de referência foi para o rodapé (RNF16). Altera RF04, RF06, RF10 e RF11 | M8 |
| RF16 | Visão em quadro com colunas por status (A fazer, Em andamento, Sobrestado, Concluída na semana), ordenadas pelo motor, e alternância Lista/Quadro salva no navegador. Altera RF04. | M9 |
| RF17 | Limite configurável de itens em andamento (padrão 3), com aviso visual ao ultrapassar, sem bloquear. Altera RF05. | M9 |
| RF18 | Mover card entre colunas arrastando ou por botões (Iniciar, Aguardar, Retomar, Concluir), com teclado; operação só por "Sobrestar/Retomar". Altera RF05. | M9 |
| RF19 | Classes de serviço em faixas: Urgente (vencida ou Crítica), Data fixa (reunião, palestra), Padrão (processo, operação), Rotina (outra). Altera RF04. | M9 |
| RF20 | Card compacto (tipo, título, faixa de prioridade na cor da borda e em texto, e prazo relativo); motivos, pontos, histórico, status, edição e exclusão ficam num painel lateral. Excluir sem caixa de confirmação, com "Desfazer" por cerca de 8 s. Altera RF04 e RF05. A "próxima ação" no card é do RF23 (M10) | M8 |
| RF21 | Métricas de fluxo: idade do card ("parado há N dias"), tempo até concluir e vazão semanal. Altera RF11. | M9 |
| RF28 | Kanban de projetos (`kanban.html`, página à parte do painel): quadro com 4 colunas de status (Backlog, Em andamento, Em revisão, Concluído) e contagem por coluna | Removido do produto em 2026-10-17 |
| RF29 | Card do Kanban com título, descrição, prioridade (Alta, Média, Baixa, escolhida pelo usuário) e prazo opcional; criar, editar e excluir com validação | Removido do produto em 2026-10-17 |
| RF30 | Mover cards do Kanban por arrastar ou por botões `◀ ▶` (com teclado), com histórico e anúncio da mudança | Removido do produto em 2026-10-17 |
| RF31 | Filtros do Kanban: busca, prioridade, prazo (atrasados, próximos 7 dias, sem prazo) e status, combináveis, com "Limpar filtros" | Removido do produto em 2026-10-17 |
| RF32 | Persistência local do Kanban em chave própria (`kanban-dt:v1`), com recuperação de dado inválido, "Restaurar exemplo" e "Desfazer" na exclusão | Removido do produto em 2026-10-17 |
| RF33 | Aba Design Thinking (Empatizar, Definir, Idear, Prototipar, Testar): notas por etapa e promoção de uma ideia a card do Backlog | Removido do produto em 2026-10-17 |
| RF34 | Relatório agrupado: somar 2 ou mais pontos da mesma operação num só relatório (mesma etapa, Vistoriado ou Em elaboração); as etapas do relatório valem para todos os pontos dele, o agrupamento desfaz-se enquanto o relatório não está concluído, e o indicador "Relatórios pendentes" e as horas por relatório contam relatórios, não pontos | Pontos |
| RF35 | Vários autos por ponto, cada um com tipo (Auto de infração, Termo de embargo, Termo de apreensão, Termo de interdição, Outro) e data; só com o relatório concluído; remover o último volta o ponto a "Relatório concluído"; ponto antigo em "Auto lavrado" vale como 1 auto de tipo não informado | Pontos |
| RF36 | Aba "Pontos": cada ponto de cada operação como uma demanda, com situação do relatório e dos autos (Planejado, Aguardando relatório, Relatório concluído com auto a lavrar, Com auto lavrado, Encerrado sem auto), contadores que filtram, busca, filtro por operação e por situação; sem coordenadas na tela | Pontos |
| RF37 | Anotações (observações) em todas as demandas, inclusive operações, e em cada ponto: caixa de texto para o que já foi executado e o que está pendente, com rascunho preservado, marcador "Com anotações" no card, busca e coluna OBSERVACOES nos CSV | Pontos |
| RF38 | Importar a planilha com coordenadas em graus, minutos e segundos (`dd° mm' ss,sss" H`, hemisférios N, S, E, L, W, O) além de decimais; valores impossíveis são recusados sem repetir o valor digitado | Pontos |
| RF39 | CSV de pontos com as colunas RELATORIO, AUTOS e OBSERVACOES no fim da linha; CSV de demandas com OBSERVACOES; resumo semanal contando relatórios (grupo = 1) e cada auto pela sua data | Pontos |
| RF40 | Calendário e agenda com a programação da operação: período de saída a retorno em todos os dias do intervalo (inclusive operação concluída ou sobrestada, em tom discreto) e evento de retorno | Pontos |
| RF41 | **Mapa dos pontos e das demandas** (produto principal: a localização é central porque as demandas exigem vistoria e definem viagens, equipe e relatórios), na visão Lista \| Mapa. **Entregue:** SVG local na aba "Pontos" ("Sem mapa-base", sem requisição externa) e o **v1 com camadas**: Leaflet local, OpenStreetMap e satélite (mosaico Sentinel-2 da SEMA, sem Google), demandas com coordenada como marcador próprio, popup, escala, coordenada em GMS sob o cursor com botão de copiar, e nenhum pedido a servidor de mapa antes de o usuário escolher a camada. **Especificado, em etapas** (`docs/MAPA.md`): clicar no mapa (RF63), exportações (RF64) e camadas WMS da SEMA (RF65). A coordenada na Nova demanda (RF42) foi entregue e faz a demanda aparecer no mapa. O mapa funciona sem as camadas se a chave ou o servidor falhar | Pontos |

## Evolução proposta: Kanban e GTD (M9–M10)

O M8 (RF15 e RF20) e o M9 (RF16 a RF19 e RF21) foram entregues e passaram para a tabela principal. **Nota:** onde os itens abaixo falam em "Foco de hoje", o bloco foi removido na refatoração visual (RNF16); vale o topo da fila. Os demais ainda não foram implementados. Detalhes, diagnóstico e decisões pendentes em `docs/MELHORIAS_KANBAN_GTD.md`. A coluna "Altera" indica quais requisitos já existentes cada novo requisito modifica.

| ID | Requisito | Altera | Marco |
|---|---|---|---|
| RF22 | Captura rápida só com título para a caixa de entrada (status `entrada`), processada depois para entrar na fila | RF01, RF05, RF13 | M10 |
| RF23 | Campo opcional "próxima ação" exibido no card | RF01, RF20 | M10 |
| RF24 | Campo opcional "contexto" (computador, campo, reunião, telefone) e filtro "O que posso fazer agora" | RF01, RF04 | M10 |
| RF25 | Sobrestamento com "aguardando de" e "cobrar em"; na data de cobrança, o item aparece em "Foco de hoje" | RF14, RF15 | M10 |
| RF26 | Reuniões e palestras ficam na faixa "Data fixa" e na agenda; só entram em "Foco de hoje" no próprio dia | RF10, RF15 | M10 |
| RF27 | Revisão semanal guiada (checklist) no lugar do bloco "Resumo da semana", com a data da última revisão salva no navegador | RF11 | M10 |
| RF44 | Formulário de demanda reorganizado: Tipo, Origem, Título, Descrição, Status, Prioridade, Responsável, Prazo, Município, Protocolo/referência e Anotações; Etapa como lista conforme o tipo; duas colunas a partir de 600 px; Tipo, Título e Prazo obrigatórios; prazo começa vazio | Evolução · PR A |
| RF45 | Prioridade automática com ajuste manual: o padrão é "Automática (calculada)"; o ajuste para Baixa, Média, Alta ou Crítica exige motivo; a faixa manual define o grupo na fila e, dentro dele, vale o score calculado; o cartão mostra a faixa manual e a calculada | Evolução · PR A |
| RF46 | Prévia da prioridade calculada no rodapé do formulário (faixa, score e motivos), atualizada ao mudar tipo, origem, prazo, status ou dados da operação | Evolução · PR A |
| RF47 | Anotações em lista com caixa de seleção: adicionar por Enter ou botão (colar várias linhas cria um item por linha), marcar como feita, editar, remover com "Desfazer"; marcar direto no painel lateral da demanda; contador "Anotações n/m" (também no cartão); conclusão registrada no histórico | Evolução · PR A |
| RF48 | Endereço ou referência espacial e botão **"Localizar"**: abre o OpenStreetMap em nova aba (o ponto, se houver coordenada; a busca do endereço, se só houver endereço), **sem requisição de rede feita pela página** e sem geocodificação. As coordenadas são do RF42 | Evolução · PR B (entregue) |

## Linha Localização e Vistoria (RF42, RF43 e RF49 a RF65)

O fluxo da demanda que exige vistoria é: **análise → decisão de vistoria → planejamento → vistoria → providências** (RF53). Saída de referência: `docs/modelos/roteiro-fiscalizacao-previa.html` (dados fictícios).

| ID | Requisito | Marco |
|---|---|---|
| RF42 | **Coordenada na Nova demanda e na edição** (RF42 fundido com a entrada de coordenada do antigo RF48): campos Latitude e Longitude em **decimal ou GMS**. Guarda `coord_y` e `coord_x` (decimal, 6 casas) e `coord_y_texto` e `coord_x_texto` (como digitado). **Hemisfério opcional:** sem ele, assume S (latitude) e O (longitude) e mostra "hemisfério não informado: assumido S/O"; decimal positivo sem sinal segue a mesma regra. N, L e E são aceitos e disparam o aviso de fora de Mato Grosso (latitude de 7° a 18° S, longitude de 50° a 62° O), sem bloquear. Usa o mesmo conversor da importação (`js/coordenadas.js`) com a opção `assumirSulOeste` ligada **só no formulário**; a importação mantém o comportamento atual. Coordenadas no painel lateral. CSV de demandas com `COORD_X`, `COORD_Y` e `ENDERECO`, com o mesmo aviso de dados sensíveis do CSV de pontos. **Entregue** (todas as demandas, menos a operação; seed com 4 demandas de localização fictícia no Atlântico) | PR B (entregue) |
| RF43 | **Tipo "Licenciamento"** (entregue): na lista de tipos do formulário, nos filtros, nas exportações, no calendário (prazo), no quadro (classe Padrão), no resumo semanal, no MCP e no motor de prioridade, com os mesmos campos, etapas e origens do processo e **+15 pontos** (valor numa só tabela, a alterar no futuro). Exemplo fictício: DEM-0014. Ver `docs/REGRAS_PRIORIDADE.md` | Pontos |
| RF49 | **Município:** automático pela coordenada quando houver, senão informado. Limites de `Geoportal:LIM_MUNICIPIOS_MT` salvos como GeoJSON simplificado em `data/`, gerado por script local documentado | Localização |
| RF50 | **Situação da vistoria** em todas as demandas: não requer, pendente, programada, vistoriada (com data) ou não acessada | Localização |
| RF51 | A coordenada só existe quando há local a vistoriar. **Denúncia: nunca registrar o denunciante** | Localização |
| RF52 | **Município descentralizado** (`Geoportal:MUNICIPIOS_DESCENTRALIZADOS`): indicador só para triagem, sem efeito na prioridade | Localização |
| RF53 | **Fluxo da demanda:** análise → decisão de vistoria → planejamento → vistoria → providências | Localização |
| RF54 | **Proximidade:** lista as demandas pendentes e os pontos de operação a até X km **em linha reta** (padrão 3 km; opções 3, 5 e 10), no painel lateral, no mapa e na ficha. Informa que é linha reta e só sugestão. Planejados para depois: corredor da rota e agrupamento automático | Localização |
| RF55 | **Ação de campo** (substitui "Viagem"): período, municípios, unidade, demandas e pontos, equipe planejada. A operação de alertas pode receber demandas de terceiros, e pode existir ação só com demandas de terceiros. **Sem cálculo de diárias e sem cadastro de veículo** (a SEMA tem sistema próprio); a ação gera a lista usada no pedido de diárias | Localização |
| RF56 | **Servidores:** lista salva no navegador (nome, matrícula, função: fiscal, motorista, apoio ou policial) | Localização |
| RF57 | **Equipe presente na vistoria**, em cada demanda e ponto: começa igual à planejada e é editável; serve ao relatório e à lavratura do auto | Localização |
| RF58 | **Campos de vistoria** por demanda e ponto. Antes: tipo/assunto, processo, código, imóvel/local, área desmatada (ha), CAR estadual, situação do CAR, CAR federal, responsáveis 0..n (nome, CPF, telefone, endereço), observações numeradas e nota de planejamento. Depois: data e hora, equipe presente, resultado (constatado, não constatado, não acessado) e providências (nº do auto, da notificação e do termo de embargo) | Localização |
| RF59 | **Importação da planilha** com colunas opcionais `PROCESSO`, `CODIGO`, `TIPO`, `IMOVEL`, `AREA_HA`, `CAR_ESTADUAL`, `CAR_FEDERAL`, `SITUACAO_CAR`; ausentes ficam vazias e a planilha atual continua válida | Localização |
| RF60 | **Roteiro de Fiscalização**, em página própria para imprimir ou salvar em PDF, com o layout e a ordem dos campos de `docs/modelos/roteiro-fiscalizacao-previa.html` (ver `docs/ACAO_DE_CAMPO.md`) | Localização |
| RF61 | Roteiro também em **CSV, KML e GPX**, com **ponto decimal** nas coordenadas (ver "Formato das coordenadas fora da tela" em `docs/MAPA.md`) | Localização |
| RF62 | **Indicadores:** pendentes de vistoria por município, demandas com vizinhas no raio, vistoriadas no mês | Localização |
| RF63 | **Clicar no mapa** preenche a coordenada da demanda | Mapa |
| RF64 | **Exportar do mapa** em GeoJSON, KML e GPX, sempre com **ponto decimal**; e o botão "copiar coordenada" do mapa passa a copiar `-11.053889, -58.847500` (latitude, longitude, ponto decimal, 6 casas), pronto para QGIS, GPS e planilha | Mapa |
| RF65 | **Camadas da SEMA via WMS** (UC, TI, embargos, CAR), sem WFS no navegador | Mapa |

## Não funcionais

| ID | Requisito |
|---|---|
| RNF01 | Layout responsivo até 360 px |
| RNF02 | Nenhum dado real ou pessoal |
| RNF03 | Funciona sem backend |
| RNF04 | Navegação por teclado e contraste legível |
| RNF05 | Motor de regras único, usado por interface, testes e MCP |
| RNF06 | `npm run build` gera `public/` para a Vercel (uma só página: `index.html`; o Kanban de projetos foi removido do site) |
| RNF07 | Melhorias de interface sem biblioteca externa nem código embutido (política de conteúdo do `vercel.json`); arrastar com API nativa e alternativa por teclado (proposto, M9) |
| RNF08 | Campos novos opcionais: dados já salvos e cópias JSON antigas continuam válidos sem migração (proposto, M10) |
| RNF09 | Todo texto digitado pelo usuário (título, descrição, anotações, endereço) é exibido como texto puro, nunca interpretado como HTML |
| RNF10 | A página não faz requisições de rede além da própria origem (CSP `connect-src 'self'`); o botão "Localizar" apenas abre um link em nova aba |
| RNF11 | Ficha, contatos, equipe e coordenadas reais ficam só no navegador, nunca no repositório nem na Vercel. O seed usa "CPF fictício" (sem número) e coordenadas no Atlântico. Dado geográfico **público** (limites municipais, lista de municípios descentralizados) pode ir ao repositório; dado pessoal, nunca |
| RNF12 | A política de conteúdo muda só em `img-src`, com servidores listados por nome e sem curingas; `script-src`, `style-src` e `connect-src` ficam como estão (ver `docs/MAPA.md`) |
| RNF13 | Mapa e ação de campo funcionam sem rede e sem camadas externas; se a chave ou o servidor falhar, o mapa avisa e cai em "Sem mapa-base" |
| RNF14 | Testes e CI não dependem de rede: os e2e bloqueiam os servidores de mapa |
| RNF15 | Camadas externas só carregam depois de o usuário escolhê-las; o pedido de blocos revela ao servidor a região vista, nunca as coordenadas das fichas |
| RNF16 | **Interface calma** (refatoração visual, sem mudar regras, dados nem ids): uma só cor de destaque (azul-marinho) mais neutros; vermelho só no texto "vencida" e nos erros, sem fundo rosa; selo de prioridade pequeno (Crítica e Alta com cor, Média e Baixa neutras); roxo, verde-água e bege só para estado, em tom suave; fila em **uma coluna**, em linhas compactas (selo, título, "tipo · origem" e prazo à direita); indicadores e filtros sem caixa (borda só nos cartões da fila e nos campos); escala de **4 tamanhos de fonte: 12, 14, 16 e 20 px**, com rótulos de tipo em 12 px sem caixa alta forçada; **data de referência no rodapé** ("Referência: dd/mm/aaaa · alterar"); aviso de férias numa linha discreta com botão fechar, lembrado no navegador pela identidade do afastamento |

## Modelo de dados (resumo)

- **Demanda**: `id`, `tipo` (operacao, processo, reuniao, palestra, outra e, a partir do RF43, licenciamento), `titulo`, `origem` (mp, judiciario, procuradoria, ouvidoria, denuncia, chefia, propria), `prazo`, `status` (a_fazer, em_andamento, aguardando, concluida), `esforco_h`, `criada_em`, `historico[]`. A prioridade é calculada, não armazenada.
- **Processo**: `processo`, `etapa`. **Reunião/palestra**: `data_hora`, `local`, `publico`.
- **Operação**: `equipe`, `saida`, `retorno`, `prazo_dias`, `horas_ponto`, `pontos[]`, `sobrestada` (opcional; verdadeiro enquanto o prazo está suspenso). Prazo = retorno + `prazo_dias`; esforço = pendentes × `horas_ponto`.
- **Ponto**: `n`, `coord_x`, `coord_y`, `municipio`, `nota`, `etapa`, `data_relatorio`, `data_auto`. Etapas: `planejado`, `vistoriado`, `relatorio_elaboracao`, `relatorio_concluido`, `auto_lavrado`, `encerrado_nao_constatado`, `encerrado_nao_acessado`.
- **Afastamento** (lista própria no seed, não dentro da demanda): `id`, `tipo` (ferias, licenca_premio, compensacao), `inicio`, `fim`, `situacao` (planejado, solicitado, aprovado).

- **Campos propostos (M10, opcionais):** na demanda, `proxima_acao`, `contexto` (computador, campo, reuniao, telefone), `aguardando_de` e `cobrar_em`; novo status `entrada` (caixa de entrada). Na configuração do navegador, `limite_em_andamento` (padrão 3), a visão escolhida (lista ou quadro) e a data da última revisão semanal.
- **Campos novos da demanda (RF44 a RF47):** `descricao` (até 2000 caracteres), `responsavel`, `municipio`, `protocolo` (no tipo processo é o próprio número do processo e substitui o antigo `processo`), `etapa` (processo: `triagem`, `analise`, `parecer` ou `devolvido`), `prioridade_manual` (ausente = automática; ou `baixa`, `media`, `alta`, `critica`), `motivo_ajuste` (obrigatório, até 200 caracteres, com ajuste manual) e `anotacoes[]`. Os campos de texto curto aceitam até 120 caracteres. Só Tipo, Título e Prazo são obrigatórios; o protocolo é opcional.
- **Migração (dados salvos no navegador e seed):** a cada carga, `migrarDemanda` copia `processo` para `protocolo`, converte a etapa antiga para a da lista (`despacho` → `analise`, `aguardando_informacao` → `triagem`, `concluido` → `devolvido`; valor desconhecido fica sem etapa) e garante `anotacoes: []`. É idempotente e não muda a versão do armazenamento.
- **Campos da linha Localização e Vistoria (todos opcionais, sem migração; `endereco`, `coord_*` e `coord_*_texto` entregues no PR B, o restante planejado):** na demanda, `endereco`, `coord_x` e `coord_y` (graus decimais, 6 casas; longitude e latitude, como nos pontos), `coord_x_texto` e `coord_y_texto` (como digitado), `municipio`, `vistoria` (`situacao`: nao_requer, pendente, programada, vistoriada, nao_acessada; `data`, `hora`, `equipe_presente[]`, `resultado`, `providencias`) e `ficha` (`assunto`, `processo`, `codigo`, `imovel`, `area_ha`, `car_estadual`, `situacao_car`, `car_federal`, `responsaveis[]` com nome, CPF, telefone e endereço, e `observacoes[]` numeradas). **Ação de campo:** `id`, `periodo`, `municipios[]`, `unidade`, `itens[]` (demandas e pontos) e `equipe[]`. **Servidor:** `nome`, `matricula`, `funcao` (fiscal, motorista, apoio, policial). Ficha, servidores e ações ficam só no navegador (RNF11).
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

- **CSV de demandas:** todas as demandas, inclusive concluídas e sobrestadas; `ENDERECO`, `COORD_X` e `COORD_Y` no fim, vazios nas que não têm localização; faixa e score só para as ativas.
- **CSV de pontos:** pontos de todas as operações, com coordenadas; as 8 primeiras colunas são as da planilha da coordenação, e as linhas de uma operação podem ser coladas de volta na importação.
- **Formato:** pensado para o Excel em português (separador `;`, UTF-8 com BOM, datas dd/mm/aaaa, vírgula decimal). Texto que começa com `=`, `+`, `-`, `@` ou tabulação recebe um apóstrofo, para não virar fórmula.
- **Ponto decimal nas coordenadas (decisão registrada, ainda não implementada):** as exportações CSV, GeoJSON e KML (e GPX) devem escrever coordenadas **sempre com ponto decimal**; a vírgula decimal fica só na tela (pt-BR). **Atenção:** hoje os CSV de demandas e de pontos escrevem as coordenadas com vírgula (como o resto dos números, para abrir no Excel em português) e os testes esperam isso; a mudança afeta `COORD_X` e `COORD_Y` e a volta do CSV de pontos para a importação da planilha, e será feita em PR próprio. Ver `docs/MAPA.md`.
- **JSON:** cópia completa do que está no navegador. Restaurar a partir do JSON não faz parte do RF11.
- **Resumo semanal (TXT):** semana de segunda a domingo conforme a data de referência. Relatórios concluídos = pontos com data de relatório na semana; autos lavrados = pontos com data de auto na semana; sem auto = pontos encerrados como não constatado ou não acessado.
- **Com RF44 a RF47:** o CSV de demandas troca a coluna `PROCESSO` por `PROTOCOLO` (mesmo dado, sem duplicar) e acrescenta, depois de `SOBRESTADA`, as colunas `DESCRICAO`, `RESPONSAVEL`, `MUNICIPIO`, `PRIORIDADE_MODO` (`automatica` ou `manual`), `MOTIVO_AJUSTE` e `ANOTACOES` (formato `[x] texto | [ ] texto`). `FAIXA` é a efetiva (a manual, se houver) e `SCORE` é sempre o calculado. O JSON leva todos os campos.
- **CSV de demandas (PR B, entregue):** ganha `ENDERECO`, `COORD_X` (longitude) e `COORD_Y` (latitude), no fim da linha, vazios nas demandas sem localização e na operação (que tem coordenada nos pontos). Vale para ele o mesmo aviso sobre coordenadas do CSV de pontos.
- **Coordenadas do exemplo são fictícias**, em pleno Atlântico, longe de qualquer local real. Arquivos exportados com dados reais devem ficar em local institucional, nunca no repositório (o `.gitignore` ignora os nomes padrão).

- **Kanban de projetos** (RF28 a RF33; **removido do produto em 2026-10-17**, só metodologia; o modelo abaixo descreve o que existia; modelo próprio, separado da demanda, em `docs/KANBAN_DESIGN_THINKING.md`): **card** (`id` K-0001, `titulo`, `descricao`, `prioridade`, `prazo` opcional, `status`, `criado_em`, `historico[]`) e **nota** de Design Thinking (`id` N-0001, `etapa`, `texto`, `card_id` opcional), guardados em `kanban-dt:v1`.

- **Pontos, relatórios e autos** (RF34 a RF41): na operação, `relatorios` (opcional: `[{ id, pontos[], criado_em }]`), no ponto `autos` (opcional: `[{ id, tipo, data }]`) e `observacoes` (opcional, até 500 caracteres); na demanda, `observacoes` (opcional, até 2000). `data_relatorio` e `data_auto` (data do primeiro auto) continuam preenchidos. Tudo opcional: dados salvos antes continuam válidos. Detalhes em `docs/PONTOS_RELATORIOS_AUTOS.md`.
## Formulário de demanda (RF44 a RF47 entregues no PR A; RF42 e RF48 entregues no PR B)

| Linha | Campos (duas colunas a partir de 600 px) |
|---|---|
| 1 | Tipo \| Origem |
| 2 | Título (foco ao abrir; exemplo "Ex.: Renovar licença ambiental") |
| 3 | Descrição ("Contexto, objetivo e próximos passos") |
| 4 | Status \| Prioridade |
| 5 | Responsável ("Nome ou equipe") \| Prazo |
| 6 | Município ("Ex.: Cuiabá", com a lista de MT como sugestão) \| Protocolo/referência ("SEMA-PRO-FICT-0000") |
| 7 | Etapa (só processo) \| Esforço estimado (h); na operação, Prazo dos relatórios \| Horas por relatório. Reunião e palestra mostram antes Data e hora \| Local (e Público) |
| 8 | Endereço ou referência espacial + "Localizar" (RF48) |
| 9 | Latitude \| Longitude, em decimal ou GMS (RF42) |
| 10 | Anotações |
| Rodapé | Prévia da prioridade calculada · Cancelar · Salvar demanda |

- **Coordenadas (RF42):** valem para todos os tipos, menos a operação, e são opcionais; aceitam decimal ou GMS, com `°`, `'`, `"`, espaços, vírgula ou ponto decimal; minutos e segundos menores que 60. **Hemisfério opcional:** sem ele, assume S e O e mostra "hemisfério não informado: assumido S/O"; N, L e E são aceitos e geram o aviso de fora de Mato Grosso (latitude de 7° a 18° S, longitude de 50° a 62° O), sem bloquear. Exemplos: 11° 25' 12,00" S → -11,420000; 58° 45' 00,00" O → -58,750000; `11,42` (sem sinal) → -11,420000 com o aviso. Guarda também o texto digitado.
- **"Localizar" (RF48):** com coordenadas válidas, abre o ponto no OpenStreetMap em nova aba; sem coordenadas e com endereço, abre a busca do endereço. A página não faz requisição de rede; o link só abre com o clique, e o aviso abaixo do botão informa que o texto vai para o serviço de mapas.
- **Dados de exemplo:** o seed traz quatro demandas com endereço e coordenadas fictícias (no Atlântico), a DEM-0011 sem localização, municípios fictícios e protocolos no formato `SEMA-PRO-FICT-…`.

## Ajustes do formulário (branch `fix/form-demanda-ajustes`)

- **Anotação pendente:** o texto que ficou na caixa de nova anotação vira anotação ao salvar, com o aviso "1 anotação pendente foi adicionada." (ou "n anotações pendentes foram adicionadas."). Se não puder entrar (lista com 100 anotações, ou mais de 280 caracteres), o salvamento para, a mensagem aparece e o texto fica na caixa.
- **Município:** lista dos municípios de MT como **sugestão** (`data/municipios-mt.json`, do IBGE; ver `docs/MUNICIPIOS_MT.md`), busca enquanto digita, padronização por caixa e acento ("juína" vira "Juína"), texto livre aceito, marca discreta "fora da lista de MT" só no formulário, migração dos valores já salvos e importação da planilha.
- **Coordenadas:** sob cada campo, em tempo real e na mesma linha do aviso, o valor convertido com hífen (`= -11,053889`), o hemisfério assumido e "fora de MT", avaliado por eixo.
- **Ajuste manual igual à calculada:** a tela mostra "igual à calculada; use Automática", o motivo deixa de ser exigido e a demanda é gravada como Automática, com aviso depois de salvar. Vale também para a operação.
- **Legibilidade:** dicas e avisos dos campos com no mínimo 12 px; a opção "Mostrar concluídas" só aparece quando há anotação concluída.

## Fora do escopo

Autenticação e perfis, backend e banco de dados, integração com SIGADOC e sistema de autos, geocodificação ou busca automática de endereço, cálculo de diárias, cadastro de veículo, WFS no navegador, corredor de rota e agrupamento automático (planejados para depois), Google Satélite, cálculo de saldo de férias e dados reais.
