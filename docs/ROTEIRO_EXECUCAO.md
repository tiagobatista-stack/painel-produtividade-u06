# Roteiro de execução — Painel de Demandas (Piloto IA 06)

Base: `docs/PROPOSTA_PAINEL_DEMANDAS.md` e `docs/AULA_INTERATIVA.html` (47 slides, método de referência). Data de referência dos testes: 2026-10-15.

## Regras de condução

Cada marco: **plano → seu OK → implementação → evidência literal → commit**. Nenhum marco começa antes de o anterior passar no critério de aceite. Só dados fictícios no repositório. Claude nunca faz commit, push, merge ou deploy sem autorização.

**Design Thinking é método, não tela.** O plano de cada marco registra, em poucas linhas e antes do OK, as cinco etapas: Empatizar, Definir, Idear, Prototipar e Testar. O quadro para preencher e o ciclo já aplicado ao painel estão em `docs/DESIGN_THINKING.md`.

## Diferenças em relação à aula

- **Repositório:** a aula usa `govsafe360-u06`; este projeto usa `painel-produtividade-u06`. Título e commit baseline: "painel-demandas". Ao seguir os slides, trocar o nome.
- **Servidor MCP:** a aula usa `govsafe-lab` e `tools/govsafe-mcp.mjs`; aqui são `demandas-lab` e `tools/demandas-mcp.mjs`.
- **Numeração dos marcos:** a aula tem M1 interface, M2 motor, M3 CRUD, M4 auditoria/exportações, M5 MCP. Aqui M1 e M2 coincidem; M3 = cadastro e filtros; M4 = operação e afastamentos (novo); M5 = relatórios (≈ M4 da aula); M6 = MCP (≈ M5 da aula); M7 = qualidade e publicação.
- **Recuperação:** a aula entrega zips prontos (DO_ZERO e RECUPERACAO). Aqui a versão de recuperação é o estado do M7: `git tag recuperacao-m7` e um zip numa pasta separada, testado antes da aula.

## Etapa 0 — Pré-requisitos e decisões (slides 01–10)

| Slide | Ação | Comando / critério |
|---|---|---|
| 03 | Conta GitHub, 2FA | nome de usuário anotado |
| 04 | Repositório vazio `painel-produtividade-u06`, sem README/.gitignore/licença | URL HTTPS copiada |
| 05 | Conta Vercel vinculada ao GitHub | **Parar aqui: ainda NÃO publicar** |
| 06 | Git | `git --version` |
| 07 | VS Code, Claude Code, Node, npm | versões de cada um |
| 08–09 | Sessão Claude (Desktop ou VS Code) na pasta do projeto | primeira resposta explica o projeto, sem editar nada |
| 10 | `/status` e `/permissions` dentro do Claude | diretório e permissões conferidos |

Decisões já tomadas: `legado/` (dashboard antigo e a aula) mantido como referência local, fora do Git; nome do repositório; afastamentos em lista própria; etapas `encerrado_*`; N = 10 dias e 3 h por relatório (editáveis).

## Concepção e M0 (slides 11–13) — concluído

Docs: REQUISITOS, REGRAS_PRIORIDADE, CRITERIOS_ACEITE, ARQUITETURA; seed fictício; commit baseline `33bee47`. Slide 11: prompt de rastreabilidade requisito → critério → evidência (tabela sem edições). Slide 12: Claude cita `CLAUDE.md` e `docs/ARQUITETURA.md` e distingue código-fonte de `public/`. Slide 13: contrato de trabalho colado numa sessão antes dos marcos.

## Construção (slides 14–18)

| # | Entrega | Verificação | Critério | Commit |
|---|---|---|---|---|
| M1 | index.html, css/, js/app.js; data de referência configurável (padrão = hoje) | navegador + 360 px | 5 tipos, indicadores e fila | `feat: painel estático (M1)` |
| M2 | js/regras.js, tests/regras.test.mjs | `npm run quality` | T1–T11 verdes | `feat: motor de prioridade (M2)` |
| M3 | formulário por tipo, edição, busca, filtros, status, localStorage | manual + recarregar | persiste após recarregar | `feat: cadastro e filtros (M3)` |
| M4 | importação da planilha, etapas por ponto, "registrar retorno", agenda 7 dias, afastamentos | planilha de exemplo (13 pontos) | prazo = retorno + N; +20 nas férias | `feat: operação e afastamentos (M4)` |
| M5 | CSV, JSON, resumo semanal | comparar com a tela | contagens conferem | `feat: relatórios (M5)` |
| M6 | tools/demandas-mcp.mjs, tools/teste-mcp.mjs | `node tools/teste-mcp.mjs` | retorno = painel para T1–T6 | `feat: MCP local (M6)` |
| M7 | scripts/build.mjs, tests/e2e, playwright.config (SITE_URL), qualidade.yml, .gitlab-ci.yml ilustrativo | `npm run quality`, `npm run build`, `npm run test:e2e` | CI verde | `ci: qualidade e publicação (M7)` |

Ao final do M7: `git tag recuperacao-m7` e zip em pasta separada.

## Git, GitHub e publicação (slides 19–26)

| Slide | Ação | Comando literal |
|---|---|---|
| 19 | Diagnóstico Git antes de qualquer mudança | `git status` |
| 20 | Autoria local (pendente: nome e e-mail a informar) | `git config --local user.name "..."` · `git config --local user.email "..."` |
| 21 | Baseline com lista de arquivos conferida | `git log --oneline` |
| 22 | origin e push da `main` (com autorização) | `git remote add origin <URL HTTPS>` · `git push -u origin main` |
| 23 | Qualidade e build; `public/` atualizada | `npm run quality` · `npm run build` |
| 24–25 | Vercel: importar repositório; Build `npm run build`, Output `public` | painel Vercel (ou Claude, com autorização) |
| 26 | **Validar a produção ANTES de criar branch**: janela anônima, título, CSS, dados fictícios; anotar URL e commit | logs se falhar |

## Qualidade (slides 27–32)

| Slide | Ação | Comando literal |
|---|---|---|
| 27 | Dependências e Chromium | `npx playwright install chromium` |
| 28 | Testes locais e relatório | `npm run test:e2e` · `npm run report:e2e` |
| 29 | Testes contra a produção | `$env:SITE_URL = "https://SUA_URL_REAL.vercel.app"; npm run test:e2e` |
| 30 | Playwright MCP e captura com dados fictícios | `claude mcp add --scope local playwright -- npx @playwright/mcp@latest` · `claude mcp list` · `/mcp` |
| 31 | Conferir cobertura: cadastro, filtros, exportação, mobile; anotar URL e nº de aprovados | relatório HTML |
| 32 | Actions: abrir `.github/workflows/qualidade.yml`; conferir a execução real na aba Actions | após push autorizado |

## Evolução (slides 33–39)

1. Confirmar produção acessível e `git status` limpo. `git switch -c feature/limpar-filtros` (RF12).
2. Plano → diff mínimo → teste Playwright → verificar que o botão limpa busca e filtros sem apagar cadastros.
3. Selecionar só os arquivos da melhoria no `git add`; commit com aprovação.
4. Push da branch; PR `main` ← `feature/limpar-filtros`, sem merge. Checks do Actions verdes; testar a melhoria no **Preview**, não na produção.
5. Após aprovação explícita: merge; validar a nova produção e anotar commit.
6. Reversão (slide 39): só numa branch descartável; `git revert`, nunca `reset --hard` nem `push --force`; explicar restore × revert.

## Integrações e governança (slides 40–46)

| Slide | Ação | Comando literal |
|---|---|---|
| 40 | Testar e registrar o MCP | `node tools/teste-mcp.mjs` · `claude mcp add --scope local --transport stdio demandas-lab -- node tools/demandas-mcp.mjs` · `claude mcp list` |
| 41 | `listar_regras` e `priorizar_demanda` (caso T1), argumentos e retorno literais | `/mcp` |
| 42 | Conectores/plugins (Desktop): só leitura, conta didática, remover acessos temporários | — |
| 43 | `docs/CONTEUDO_EXTERNO_NAO_CONFIAVEL.md` com despacho fictício; análise sem execução | prompt conservador |
| 44 | GitLab: só comparar (`.gitlab-ci.yml` ilustrativo; sem criar repositório) | — |
| 45 | Matriz de 5 cenários com responsável e evidência; exportar CSV/JSON | conferir as 5 linhas |
| 46 | Piloto IA 06 no Moodle; questionário da unidade separado | checklist abaixo |
| 47 | Reconstruir o percurso e registrar o que ainda é didático | — |

## Evolução pós-aula: Kanban e GTD (M8–M10, proposto)

Mesma condução dos marcos anteriores: plano → OK → implementação → evidência → commit, uma branch e um PR por marco. Detalhes em `docs/MELHORIAS_KANBAN_GTD.md`.

| # | Entrega | Verificação | Critério | Branch | Situação |
|---|---|---|---|---|---|
| M8 | Abas, topo fixo, "Foco de hoje", indicadores enxutos, cards compactos com painel lateral, menu "Exportar", "Desfazer" | `npm run quality` sem mudanças; `npm run test:e2e`; print desktop e 360 px | RF15, RF20 | `feature/layout-abas` | **Entregue** (aguarda commit e PR) |
| M9 | Quadro por status, limite de itens em andamento, mover cards, classes de serviço, métricas de fluxo | `tests/quadro.test.mjs`; e2e mover card e limite; teclado | RF16–RF19, RF21, RNF07 | `feature/quadro-kanban` | Proposto |
| M10 | Caixa de entrada, próxima ação, contexto, cobrança do sobrestado, agenda separada, revisão semanal | T1–T14 sem mudança e T15–T17 verdes; `npm run mcp:test` | RF22–RF27, RNF08 | `feature/gtd-entrada` | Proposto |

## Trilha de recuperação para a aula de 3 horas

| Janela | Atividade | Plano B |
|---|---|---|
| 0:00–0:20 | Contas, repositório vazio, ambiente (03–10) | — |
| 0:20–0:50 | Concepção e M0 (11–13) | docs prontos |
| 0:50–1:20 | M1 e M2 ao vivo (15–16) | tag recuperacao-m7 |
| 1:20–1:50 | Recuperação, Git, GitHub, Vercel (18–26) | versão pronta |
| 1:50–2:20 | Playwright local e produção; CI (27–32) | só local, com justificativa |
| 2:20–2:45 | Branch, PR, Preview, merge (33–38) | — |
| 2:45–3:00 | MCP, injection, matriz, Moodle (40–46) | priorizar MCP e matriz |

**Risco principal:** a versão de recuperação (M3–M7) precisa existir e ser testada de ponta a ponta, incluindo o deploy na Vercel, antes da aula.

## Checklist de evidências (Moodle)

- [ ] URL de produção, em janela anônima
- [ ] Link do repositório e hash do commit publicado
- [ ] Saída de `npm run quality` com T1–T14 aprovados
- [ ] Relatório Playwright (local e contra a URL real)
- [ ] Print dos checks do GitHub Actions no PR
- [ ] URL de Preview com a melhoria e confirmação da produção após o merge
- [ ] Retorno literal do MCP `demandas-lab` para o caso T1
- [ ] Matriz de 5 cenários em CSV/JSON

O que não for possível por conta ou rede vai com justificativa, nunca com link inventado.
