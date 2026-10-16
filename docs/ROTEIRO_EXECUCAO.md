# Roteiro de execução — Painel de Demandas (Piloto IA 06)

Base: `docs/PROPOSTA_PAINEL_DEMANDAS.md`. Data de referência dos testes: 2026-10-15.

## Regras de condução

Cada marco segue o mesmo ciclo: **plano → seu OK → implementação → evidência literal → commit**. Nenhum marco começa antes de o anterior passar no critério de aceite. Só dados fictícios entram no repositório.

## Etapa 0 — Pré-requisitos e decisões

| Verificar | Comando / ação | Evidência |
|---|---|---|
| Node ≥ 18 | `node -v` | versão |
| Git | `git --version` | versão |
| Contas | GitHub e Vercel logados | — |
| Claude Code | `claude --version` | versão |

Decisões antes do M0:

1. **`index.html` atual** (Dashboard de Produtividade SEMA-MT) foi movido para `legado/index.html` e fica só como referência.
2. **Nome do repositório**: `painel-produtividade-u06` (definido).
3. **Parâmetros**: N = 10 dias e 3 h/relatório (editáveis); pesos de prioridade como na proposta.
4. **Dependências externas**: evitar CDN no projeto novo (ou fixar versão), para o painel funcionar sem rede instável.

## Marcos

| # | Entrega | Comando de verificação | Critério de aceite | Commit |
|---|---|---|---|---|
| M0 | README, CLAUDE.md, docs/ (REQUISITOS, REGRAS_PRIORIDADE, CRITERIOS_ACEITE), data/seed.json, .gitignore, package.json, vercel.json | `git init; git add .; git commit` | Claude explica o projeto só pelos docs; seed sem dado real | `chore: baseline painel-demandas` |
| M1 | index.html, css/styles.css, js/app.js | abrir no navegador, janela de 360 px | 5 tipos visíveis, indicadores e fila | `feat: painel estático (M1)` |
| M2 | js/regras.js, tests/regras.test.mjs | `node --test` | T1–T11 verdes | `feat: motor de prioridade (M2)` |
| M3 | formulário por tipo, edição, busca, filtros, status, localStorage | manual + recarregar | nova demanda com prioridade, persiste | `feat: cadastro e filtros (M3)` |
| M4 | importação da planilha, etapas por ponto, "registrar retorno", agenda 7 dias, afastamentos | planilha de exemplo (13 pontos) | prazo = retorno + N; +20 dentro das férias | `feat: operação e afastamentos (M4)` |
| M5 | CSV demandas/pontos, JSON, resumo semanal | comparar com a tela | contagens conferem | `feat: relatórios (M5)` |
| M6 | tools/demandas-mcp.mjs | chamar `priorizar_demanda` com T1 | retorno = painel para T1–T6 | `feat: MCP local (M6)` |
| M7 | scripts/build.mjs → public/, tests/e2e, .github/workflows/qualidade.yml | `npm run build`, `npx playwright test` | CI verde; URL validada em janela anônima | `ci: qualidade e publicação (M7)` |

## Pós-M7

1. **Publicação**: criar repositório vazio, `git remote add origin`, `git push`; Vercel com Build `npm run build`, Output `public`.
2. **Playwright contra a produção**: cadastrar demanda, filtrar por tipo, importar operação e lavrar auto, exportar CSV, versão mobile.
3. **Evolução**: `feature/limpar-filtros` (RF12) → teste Playwright → PR → checks verdes → Preview → merge → confirmar produção.
4. **Reversão**: `git revert` da melhoria numa branch descartável; explicar restore × revert.
5. **Prompt injection**: `docs/CONTEUDO_EXTERNO_NAO_CONFIAVEL.md` com despacho fictício; análise sem execução.
6. **Matriz de governança**: 5 cenários exportados em CSV.

## Trilha de recuperação para a aula de 3 horas

| Janela | Atividade | Plano B |
|---|---|---|
| 0:00–0:20 | Contas, repositório vazio, ambiente | — |
| 0:20–0:50 | Concepção + M0 | usar docs prontos |
| 0:50–1:20 | M1 e M2 ao vivo | usar versão de recuperação do M2 |
| 1:20–1:50 | Recuperação M3–M7, Git, GitHub, Vercel | versão pronta |
| 1:50–2:20 | Playwright local e na produção; CI | rodar só local e justificar |
| 2:20–2:45 | Branch, PR, Preview, merge | — |
| 2:45–3:00 | MCP, injection, matriz, Moodle | priorizar MCP e matriz |

**Risco principal:** a versão de recuperação (M3–M7) precisa existir e ser testada de ponta a ponta **antes** da aula, incluindo o deploy na Vercel.

## Checklist de evidências (Moodle)

- [ ] URL de produção, em janela anônima
- [ ] Link do repositório e hash do commit publicado
- [ ] Saída de `node --test` com T1–T11 aprovados
- [ ] Relatório Playwright (local e contra a URL real)
- [ ] Print dos checks do GitHub Actions no PR
- [ ] URL de Preview + confirmação da produção após o merge
- [ ] Retorno literal do MCP para o caso T1
- [ ] Matriz de 5 cenários em CSV

O que não for possível por conta ou rede vai com justificativa, nunca com link inventado.
