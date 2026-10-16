# Proposta — Plataforma de Gestão de Demandas

Oct 15, 2026 · @TIAGO

## Resumo

A proposta de **Painel de Demandas**: uma aplicação web estática que reúne reuniões, palestras, análises de processos SIGADOC e relatórios de alertas de desmatamento numa única fila priorizada por prazo e criticidade. O ciclo da Unidade VI continua o mesmo (Git → GitHub → Vercel → Playwright → CI → branch/PR/Preview → MCP → matriz de governança); muda apenas o domínio da aplicação.

O que será entregue na atividade Piloto IA 06:

- URL pública na Vercel com o painel funcionando sobre **dados fictícios**.

- Repositório GitHub com histórico em marcos M0–M7, testes e workflow de CI.

- Motor de priorização testável, compartilhado entre a interface, os testes e um MCP local.

- Uma melhoria entregue por branch, Pull Request e Preview antes de ir para produção.

- Matriz de governança com 5 cenários de uso de agentes de IA nesse fluxo de trabalho.

A aplicação é didática: não se conecta ao SIGADOC nem a bases reais de alertas, e não substitui sistemas oficiais da SEMA-MT.

## Problema e objetivo

O objetivo é que nenhuma demanda entregue ao analista com ou sem prazo se perca e que a produtividade da semana possa ser demonstrada com números. Hoje as demandas de um fiscal ou analista chegam por canais distintos: convites de reunião, pedidos de palestra, processos tramitados no SIGADOC (demandas do Ministério Público, Poder Judiciário, Procuradoria de Justiça, denúncias e ouvidorias entre outros) e fiscalização Alertas de desmatamento encaminhados  ao analista que exigem relatório técnico e lavratura de autos de inspeção, podendo  ou não ser lavrados autos  de infração, termos de embargo, termos  de apreensão, termos  de  doação entre  outos  .

Sem uma fila única, três problemas se repetem:

- Prazos de processos e alertas competem com a agenda de reuniões sem critério explícito de prioridade.

- Não há registro consolidado do que foi feito, o que dificulta relatórios de produtividade.

- Cada viagem mensal de fiscalização gera de uma vez dezenas de relatórios de vistoria e autos de infração, que competem com os demais prazos.

**Público-alvo:** um servidor ou um núcleo pequeno de fiscalização. **Indicadores do painel:** demandas abertas, vencidas, prazos dos próximos 7 dias, relatórios de vistoria pendentes, autos a lavrar e concluídas na semana.

## Escopo

O laboratório cobre sete módulos, todos sobre dados fictícios gravados no navegador; integrações reais ficam para uma fase 2 com autorização institucional.

| Módulo              | O que faz no laboratório                                                                                    | Fase 2 (fora do escopo)                                                                                 |
|---------------------|-------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------|
| Painel              | Indicadores (inclui relatórios pendentes e autos a lavrar), fila priorizada e aviso de afastamento próximo  | Painel por equipe e por coordenação                                                                     |
| Demandas            | Cadastro, edição, busca, filtros e mudança de status                                                        | Atribuição entre servidores, notificações                                                               |
| Agenda              | Reuniões, palestras, saídas de operação, prazos de relatório e início de afastamento nos próximos 7 dias    | Sincronização com calendário institucional                                                              |
| Processos SIGADOC   | Número fictício, assunto, etapa da análise e prazo                                                          | Consulta ao SIGADOC, se houver API autorizada                                                           |
| Operação de alertas | Importação da planilha enviada pela coordenação, etapa de cada ponto até o auto, prazo comum dos relatórios | Integração com o sistema de lavratura de autos e cruzamento com camadas SEMA-MT (CAR, embargos, UC, TI) |
| Férias e licenças   | Agendamento de férias e licença-prêmio; aviso de prazos e viagens que caem no período                       | Saldo e aprovação pelo sistema de RH                                                                    |
| Relatórios          | CSV de demandas e de pontos, JSON e resumo semanal com relatórios e autos da semana                         | Relatório PDF institucional                                                                             |

Também fora do escopo: autenticação e perfis de acesso, backend e banco de dados, e qualquer dado pessoal ou de processo real.

## Fluxo da operação de alertas e dos afastamentos

A coordenação define os pontos e o analista não escolhe o que fiscalizar; por isso o painel trata a viagem mensal como um lote de relatórios com prazo comum e acompanha cada ponto até o auto.

1.  A coordenação envia a planilha da operação. O exemplo recebido tem 13 pontos em 2 municípios, viagem de 5 dias e as colunas N_PONTO, EQUIPE, COORD_X, COORD_Y, MUNICIPIO, DAT_SAIDA, DAT_RETOR e NOT_PLANEJ.

2.  O analista cola as linhas da planilha no painel; a operação vira uma demanda com prazo igual ao retorno mais N dias.

3.  Na volta da viagem, a ação "registrar retorno" marca os pontos como vistoriados.

4.  Cada ponto avança: relatório em elaboração → relatório concluído → auto lavrado, ou encerrado sem auto (não constatado ou não acessado).

5.  Os indicadores somam relatórios pendentes e autos a lavrar; a operação é concluída quando todos os pontos estão encerrados.

A nota de planejamento é lida apenas para marcar o indício (corte raso, exploração seletiva, fora de CAR); a prioridade é da operação como um todo, não de cada ponto.

**Férias e licença-prêmio:** o servidor agenda períodos com tipo, início, fim e situação (planejado, solicitado, aprovado). Demandas com prazo dentro do período sobem na fila para serem antecipadas, e uma viagem de operação que coincide com o período gera aviso para ajustar a escala com a coordenação. O painel não calcula saldo nem direito ao afastamento; isso continua no sistema de RH.

Em aberto: o prazo interno do relatório após o retorno (N dias) e a média de horas por relatório precisam ser definidos com a coordenação; a proposta usa 10 dias e 3 h como parâmetros editáveis.

## Requisitos e modelo de dados

São 13 requisitos funcionais e 6 não funcionais; cada um vira critério de aceite em docs/CRITERIOS_ACEITE.md.

**Funcionais**

| ID   | Requisito                                                                                                                                       | Marco    |
|------|-------------------------------------------------------------------------------------------------------------------------------------------------|----------|
| RF01 | Cadastrar demanda: processo SIGADOC (origem MP, Judiciário, Procuradoria de Justiça, ouvidoria, denúncia ou chefia), reunião, palestra ou outra | M3       |
| RF02 | Exibir campos específicos conforme o tipo escolhido                                                                                             | M3       |
| RF03 | Calcular prioridade automaticamente pelo motor de regras                                                                                        | M2       |
| RF04 | Listar a fila ordenada por prioridade e prazo, com busca e filtros por tipo, status e prioridade                                                | M1/M3    |
| RF05 | Alterar status (a fazer → em andamento → aguardando → concluída) e guardar o histórico                                                          | M3       |
| RF06 | Mostrar indicadores: abertas, vencidas, 7 dias, relatórios pendentes, autos a lavrar, concluídas                                                | M1       |
| RF07 | Importar operação colando as linhas da planilha da coordenação; prazo dos relatórios = retorno + N dias                                         | M4       |
| RF08 | Registrar a etapa de cada ponto até auto lavrado ou sem auto, com ação em lote "registrar retorno"                                              | M4       |
| RF09 | Agendar férias e licença-prêmio e avisar sobre prazos e viagens que caem no período                                                             | M4       |
| RF10 | Exibir agenda dos próximos 7 dias: reuniões, palestras, saídas de operação, prazos de relatório e afastamentos                                  | M4       |
| RF11 | Exportar CSV de demandas e de pontos, JSON e resumo semanal com relatórios e autos da semana                                                    | M5       |
| RF12 | Botão "Limpar filtros" (melhoria entregue por branch e PR)                                                                                      | Evolução |
| RF13 | Persistir no navegador e carregar o exemplo fictício na primeira abertura                                                                       | M3       |

**Não funcionais:** layout responsivo até 360 px; nenhum dado real ou pessoal; funciona sem backend; navegação por teclado e contraste legível; motor de regras único usado por interface, testes e MCP; build gera public/ para a Vercel.

**Modelo da demanda** (campos comuns + campos por tipo)

| Campo                                                                              | Tipo                     | Exemplo fictício                                                               |
|------------------------------------------------------------------------------------|--------------------------|--------------------------------------------------------------------------------|
| id                                                                                 | texto                    | DEM-0001                                                                       |
| tipo                                                                               | lista                    | operacao, processo, reuniao, palestra, outra                                   |
| titulo                                                                             | texto                    | Relatórios de vistoria — operação de outubro                                   |
| origem                                                                             | lista                    | mp, judiciario, procuradoria, ouvidoria, denuncia, chefia, propria             |
| prazo                                                                              | data                     | na operação: retorno + prazo_dias                                              |
| status                                                                             | lista                    | na operação, derivado das etapas dos pontos                                    |
| esforco_h                                                                          | número                   | na operação: relatórios pendentes × horas por relatório                        |
| prioridade                                                                         | calculado                | Alta (score 68)                                                                |
| processo, etapa                                                                    | texto (SIGADOC)          | SEMA-PRO-FICT-0042 · parecer                                                   |
| equipe, saida, retorno, prazo_dias, horas_ponto                                    | operação                 | Equipe Fictícia Norte · 2026-10-03 · 2026-10-07 · 10 · 3                       |
| pontos\[\]: n, coord_x, coord_y, municipio, nota, etapa, data_relatorio, data_auto | lista (operação)         | 7 · sem coordenada · Município Fictício A · "Possível corte raso…" · relatorio |
| data_hora, local, publico                                                          | misto (reunião/palestra) | 2026-10-20 09:00 · auditório · 40 pessoas                                      |
| afastamentos\[\]: tipo, inicio, fim, situacao                                      | lista                    | ferias · 2026-11-03 · 2026-11-17 · aprovado                                    |
| historico                                                                          | lista de eventos         | Ponto 7: auto lavrado (2026-10-14)                                             |

## Regras de priorização

A prioridade é a soma de pontos por prazo, tipo, origem, volume de relatórios da operação e afastamento agendado; ela substitui o “permitido / condicionado / não autorizado” do GOVSAFE como regra de negócio testável. Os pesos abaixo são uma proposta inicial, a validar com a chefia antes de qualquer uso real.

| Critério           | Condição                                                                  | Pontos |
|--------------------|---------------------------------------------------------------------------|--------|
| Prazo              | vencido                                                                   | +50    |
| Prazo              | vence em 0 a 2 dias                                                       | +30    |
| Prazo              | vence em 3 a 7 dias                                                       | +15    |
| Tipo               | operação de alertas (ação pontual planejada mensalmente pela coordenação) | +20    |
| Tipo               | processo SIGADOC                                                          | +15    |
| Tipo               | reunião                                                                   | +10    |
| Tipo               | palestra                                                                  | +5     |
| Origem do processo | Ministério Público, Poder Judiciário ou Procuradoria de Justiça           | +25    |
| Origem do processo | Ouvidoria                                                                 | +15    |
| Origem do processo | Denúncia                                                                  | +10    |
| Origem             | Chefia ou coordenação                                                     | +10    |
| Operação           | 10 ou mais relatórios pendentes                                           | +15    |
| Operação           | 5 a 9 relatórios pendentes                                                | +8     |
| Afastamento        | prazo dentro de férias ou licença-prêmio agendada                         | +20    |

**Faixas:** Crítica ≥ 70 · Alta 45–69 · Média 25–44 · Baixa \< 25. Demanda concluída sai da fila. Desempate: maior score, depois prazo mais próximo, depois data de criação. Prazo ausente ou inválido gera erro de validação, sem cálculo.

**Esclarecimentos das regras** (a confirmar com a chefia):

- Os pontos se somam sem teto; "Chefia ou coordenação" vale para qualquer tipo, e "Origem do processo" só se aplica a processos SIGADOC.
- Prazo com mais de 7 dias não pontua; prazo hoje (0 dias) entra na faixa de 0 a 2 dias.
- Na operação, o prazo é retorno + N dias, e o status deriva das etapas dos pontos (concluída quando todos estão encerrados).
- O afastamento só soma +20 quando o prazo cai dentro do período, inclusive nas datas de início e fim.

**Casos de teste** (data de referência fixa: 2026-10-15)

| Caso | Entrada                                                                        | Score | Faixa esperada    |
|------|--------------------------------------------------------------------------------|-------|-------------------|
| T1   | Operação vencida há 1 dia, 12 relatórios pendentes, coordenação                | 95    | Crítica           |
| T2   | Processo SIGADOC vencido, origem Ministério Público                            | 90    | Crítica           |
| T3   | Operação, vence em 2 dias, 7 relatórios pendentes, coordenação                 | 68    | Alta              |
| T4   | Processo SIGADOC, vence em 22 dias, dentro das férias, origem Poder Judiciário | 60    | Alta              |
| T5   | Processo SIGADOC, vence em 1 dia, chefia                                       | 55    | Alta              |
| T6   | Reunião, vence em 5 dias, chefia                                               | 35    | Média             |
| T7   | Qualquer demanda concluída (na operação: todos os pontos encerrados)           | —     | fora da fila      |
| T8   | Prazo vazio                                                                    | —     | erro de validação |
| T9   | Operação, prazo em 20 dias, origem própria, com 4 / 5 / 9 / 10 relatórios pendentes | 20 / 28 / 28 / 35 | Baixa / Média / Média / Média |
| T10  | Reunião, origem própria, prazo em 7 dias e em 8 dias                           | 25 / 10 | Média / Baixa     |
| T11  | Processo SIGADOC, origem ouvidoria, prazo em 22 dias (2026-11-06), afastamento de 2026-11-01 a 2026-11-05 (não cobre o prazo) | 30 | Média |

A função fica em js/regras.js, sem acesso a tela ou armazenamento, e é importada pela interface, pelos testes Node e pelo MCP.

## Backlog M0–M7

Oito marcos, um commit (ou mais) por marco, e nenhum marco começa antes de o anterior passar no seu critério de aceite.

| Marco                      | Entrega                                                                                                                               | Critério de aceite                                                                               |
|----------------------------|---------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------|
| M0 Fundação                | README, CLAUDE.md, docs/REQUISITOS.md, docs/REGRAS_PRIORIDADE.md, docs/CRITERIOS_ACEITE.md, data/seed.json (demandas, 2 operações e 2 afastamentos fictícios), .gitignore, package.json, vercel.json; git init e commit baseline | Claude explica o projeto lendo só os docs; nenhum dado real no seed                              |
| M1 Painel estático         | index.html, css/, js/app.js com indicadores e fila                                                                                    | Exemplo visível com os 5 tipos; layout legível em 360 px                                         |
| M2 Motor de prioridade     | js/regras.js + tests/regras.test.mjs                                                                                                  | Casos T1–T11 passam em node --test                                                               |
| M3 Cadastro e filtros      | Formulário por tipo, edição, busca, filtros, status, persistência local                                                               | Nova demanda aparece com prioridade calculada e continua após recarregar                         |
| M4 Operação e afastamentos | Importação da planilha, etapa por ponto, "registrar retorno", agenda de 7 dias, férias e licença-prêmio                               | Planilha fictícia de exemplo gera a operação com prazo correto; prazo dentro das férias soma +20 |
| M5 Relatórios              | CSV de demandas e de pontos, JSON e resumo semanal                                                                                    | Contagem de relatórios e autos da semana confere com a tela                                      |
| M6 MCP local               | tools/demandas-mcp.mjs com listar_regras, priorizar_demanda, resumo_operacao                                                          | Retorno do MCP igual ao do painel para T1–T6                                                     |
| M7 Qualidade e publicação  | npm run build → public/, Playwright e2e, workflow do GitHub Actions, deploy na Vercel                                                 | CI verde; URL de produção validada em janela anônima                                             |

**Fechamento** (depois do M7): reversão simulada com git revert numa branch descartável, docs/CONTEUDO_EXTERNO_NAO_CONFIAVEL.md (prompt injection), matriz de governança em CSV e checklist das 8 evidências. Antes da aula, a versão de recuperação (M3–M7 prontos) deve ser testada de ponta a ponta. Detalhes em docs/ROTEIRO_EXECUCAO.md.

Nas 3 horas presenciais, use a trilha de recuperação: M0–M2 conduzidos ao vivo e M3–M7 partindo de uma versão pronta, como a aula já prevê para o GOVSAFE.

## Arquitetura

Tudo roda no navegador, sem backend; a única peça compartilhada é o motor de prioridade, o que garante a mesma resposta na tela, nos testes e no MCP.

<img src="media/image1.png" style="width:6in;height:3.5in" alt="arquitetura · projeto local e publicação" />

arquitetura · projeto local e publicação

O código-fonte é editado na raiz; public/ é gerada pelo build e é o que a Vercel publica. js/regras.js deve ser um módulo ES (export function priorizar) para funcionar no navegador e no Node.

painel-produtividade-u06/  
├── index.html  
├── css/styles.css  
├── js/app.js \# interface  
├── js/regras.js \# motor de prioridade (puro)  
├── data/seed.json \# exemplo fictício  
├── tests/regras.test.mjs \# T1–T11  
├── tests/e2e/ \# Playwright  
├── tools/demandas-mcp.mjs  
├── scripts/build.mjs \# copia para public/  
├── docs/  
├── .github/workflows/qualidade.yml  
├── vercel.json  
└── package.json

## Mapeamento para o ciclo da Unidade VI

Cada etapa da aula se aplica sem mudança de ferramenta; o que muda é o conteúdo verificado em cada uma.

| Slides | Etapa                      | Adaptação para o Painel de Demandas                                                                                       | Evidência                                            |
|--------|----------------------------|---------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------|
| 03–05  | Contas e repositório       | Repositório vazio com um único nome usado no laboratório todo                                                             | URL HTTPS do repositório                             |
| 11–13  | Concepção                  | Tabela requisito → critério → evidência a partir de RF01–RF13                                                             | Tabela gerada pelo Claude, sem edições               |
| 15–17  | Construção por marcos      | M1, M2 e M3 conforme o backlog                                                                                            | Diff e testes de cada marco                          |
| 19–21  | Git local                  | .gitignore com node_modules/, .env, test-results/; commit “chore: baseline painel-demandas”                               | git log --oneline -3                                 |
| 22     | GitHub                     | origin apontando para o repositório criado                                                                                | Commit visível no GitHub                             |
| 23–26  | Build e Vercel             | Build Command npm run build, Output public                                                                                | URL de produção validada                             |
| 27–31  | Playwright                 | Testes e2e: cadastrar demanda, filtrar por tipo, importar operação e lavrar auto de um ponto, exportar CSV, versão mobile | Relatório HTML com nº de aprovados                   |
| 32     | GitHub Actions             | Jobs regras (node --test) e navegador (Playwright)                                                                        | Checks verdes no PR                                  |
| 33–38  | Branch, PR, Preview, merge | feature/limpar-filtros (RF12) ou feature/destaque-vencidas                                                                | Preview com a melhoria; produção sem ela até o merge |
| 39     | Reversão                   | Simular git revert da melhoria numa branch descartável                                                                    | Explicação restore × revert                          |
| 40–41  | MCP local                  | Servidor demandas-lab; chamada priorizar_demanda com o caso T1                                                            | Argumentos e retorno literais                        |
| 43     | Prompt injection           | docs/CONTEUDO_EXTERNO_NAO_CONFIAVEL.md com um despacho fictício contendo instruções ao agente                             | Análise do risco, sem execução                       |
| 45     | Governança                 | Matriz de 5 cenários (seção seguinte)                                                                                     | CSV exportado                                        |

O nome do repositório é painel-produtividade-u06 (a aula padroniza govsafe360-u06; o nome foi definido para este projeto).

## Governança e dados

A regra central é simples: a URL da Vercel é pública, então só dados fictícios entram no repositório e no deploy. Processos SIGADOC e alertas cruzados com CAR podem conter dados pessoais (nomes, CPF, imóveis) e informação de fiscalização em curso, sujeitos à LGPD (Lei 13.709/2018) e ao sigilo funcional.

**Matriz de 5 cenários de uso de agentes de IA** (decisões didáticas, não normativas)

| Cenário                                                                         | Dado                             | Ambiente               | Autonomia         | Aprovação                     | Controle                               | Decisão        | Justificativa                                             |
|---------------------------------------------------------------------------------|----------------------------------|------------------------|-------------------|-------------------------------|----------------------------------------|----------------|-----------------------------------------------------------|
| Claude gera o resumo semanal a partir do seed fictício                          | Fictício                         | Local                  | Leitura           | Não exigida                   | Seed revisado no M0                    | Permitido      | Sem dado real e sem efeito externo                        |
| Claude edita código, cria branch e abre PR                                      | Fictício                         | Desenvolvimento        | Escrita           | Antes de commit, push e merge | PR + CI + Preview                      | Condicionado   | Mudança reversível, mas chega à produção                  |
| Servidor cola a planilha real da operação no painel aberto no próprio navegador | Restrito (alvos de fiscalização) | Local, só no navegador | Nenhuma do agente | Autorização da chefia         | Nunca vai ao repositório nem ao deploy | Condicionado   | Planejamento operacional sigiloso até a ação              |
| Colar despacho real do SIGADOC no chat para resumir                             | Restrito / pessoal               | Serviço externo        | Leitura           | Sem base institucional        | —                                      | Não autorizado | Dado pessoal e processo em curso fora do ambiente oficial |
| Publicar na Vercel a planilha da operação com coordenadas reais                 | Restrito                         | Produção pública       | Publicação        | —                             | —                                      | Não autorizado | Expõe alvos antes da fiscalização; exposição irreversível |

Controles mínimos no projeto: .gitignore para .env e evidências privadas; IDs e nomes de município fictícios no seed; screenshots do Playwright só com o seed; nenhum token ou senha em prompt.

## Prompts para o Claude Code

Cada prompt limita o marco, exige plano antes de editar e pede evidências; use-os depois do contrato de trabalho do slide 13.

**M0 — Fundação**

Crie SOMENTE a fundação do projeto Painel de Demandas: README.md, CLAUDE.md, docs/REQUISITOS.md (RF01–RF13), docs/REGRAS_PRIORIDADE.md (tabela de pontos e casos T1–T11), docs/CRITERIOS_ACEITE.md, .gitignore, package.json, vercel.json e data/seed.json com dados FICTÍCIOS: processos SIGADOC, reuniões, palestras, 2 operações de alertas no formato da planilha (N_PONTO, EQUIPE, COORD_X, COORD_Y, MUNICIPIO, DAT_SAIDA, DAT_RETOR, NOT_PLANEJ, sem coordenadas reais) e 2 afastamentos (férias e licença-prêmio). Não crie interface ainda. Apresente o plano e aguarde meu OK antes de escrever.

**M1 — Painel estático**

@docs/REQUISITOS.md @data/seed.json  
Implemente SOMENTE M1: painel com indicadores (abertas, vencidas, próximos 7 dias, relatórios pendentes, autos a lavrar, concluídas na semana) e fila de demandas com tipo, prazo e status. Layout responsivo até 360 px. Sem cadastro, sem MCP. Plano primeiro; depois mostre arquivos e diff.

**M2 — Motor de prioridade**

@docs/REGRAS_PRIORIDADE.md  
Implemente SOMENTE M2: função pura priorizar(demanda, hoje) em js/regras.js, retornando {score, faixa, motivos}. Crie tests/regras.test.mjs com os casos T1–T11 e data de referência 2026-10-15. Rode node --test e mostre a saída literal.

**Evolução — branch e PR**

Na branch feature/limpar-filtros, planeje e, após minha autorização, implemente SOMENTE o botão "Limpar filtros": limpa busca, tipo, status e prioridade sem apagar demandas. Acrescente um teste Playwright. Mostre o diff; não faça commit nem push sem aprovação.

**MCP**

Use apenas o MCP demandas-lab. Chame listar_regras e depois priorizar_demanda com tipo="operacao", relatorios_pendentes=12, prazo="2026-10-14", origem="chefia", hoje="2026-10-15". Mostre argumentos e retorno literais e compare com o caso T1. Não altere arquivos.

## Evidências e cronograma

A entrega no Moodle fecha quando os oito itens abaixo estiverem marcados; o que não for possível por conta ou rede vai com justificativa, nunca com link inventado.

- [ ] URL de produção da Vercel, aberta em janela anônima

- [ ] Link do repositório e hash do commit publicado

- [ ] Saída de node --test com T1–T11 aprovados

- [ ] Relatório Playwright (local e contra a URL real)

- [ ] Print dos checks do GitHub Actions no PR

- [ ] URL de Preview com a melhoria e confirmação da nova produção após o merge

- [ ] Retorno literal do MCP demandas-lab para o caso T1

- [ ] Matriz de 5 cenários exportada em CSV

**Sessão presencial de 3 horas**

1.  0:00–0:20 — Contas, repositório vazio e verificação do ambiente (slides 03–10).

2.  0:20–0:50 — Concepção: requisitos, regras de prioridade e M0 com o Claude.

3.  0:50–1:20 — M1 e M2 ao vivo; testes T1–T11 passando.

4.  1:20–1:50 — Versão de recuperação (M3–M7 prontos), Git local, GitHub e deploy na Vercel.

5.  1:50–2:20 — Playwright local e contra a produção; CI no GitHub Actions.

6.  2:20–2:45 — Branch feature/limpar-filtros, PR, Preview e merge.

7.  2:45–3:00 — MCP, prompt injection, matriz de governança e envio no Moodle.
