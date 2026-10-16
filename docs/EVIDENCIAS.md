# Checklist de evidências — Piloto IA 06

Entrega no Moodle (atividade Piloto IA 06; o questionário da unidade é enviado à parte). Regra: o que não for possível por conta ou rede vai **com justificativa**, nunca com link inventado.

## Como coletar o que dá para automatizar

```
npm run evidencias -- https://painel-produtividade-u06.vercel.app
```

O script (`scripts/coletar-evidencias.mjs`) roda os comandos de verdade e grava as saídas literais em `evidencias-privadas/AAAA-MM-DD_HHMM/` (pasta ignorada pelo Git; **anexe de lá ao Moodle, não ao repositório**). Sem a URL, ele coleta só a parte local. Ele sai com código 1 se algo falhar. Rode-o **depois do merge final**, para o hash do commit coincidir com o que está publicado.

## Os 8 itens

| # | Evidência | Como obter | Onde fica | Quem |
|---|---|---|---|---|
| 1 | URL de produção, aberta em janela anônima | Abrir https://painel-produtividade-u06.vercel.app/ numa janela anônima e tirar print | print do usuário | **Usuário** |
| 2 | Link do repositório e hash do commit publicado | `01-git.txt` (commit e histórico); repositório https://github.com/tiagobatista-stack/painel-produtividade-u06 | `01-git.txt` | Script |
| 3 | Saída de `node --test` com T1–T13 aprovados | `npm run quality` (o script guarda a saída inteira) | `02-quality.txt` | Script |
| 4 | Relatório Playwright, local e contra a URL real | `npx playwright test` e `SITE_URL=… npx playwright test` | `04-e2e-local.txt`, `07-e2e-producao.txt`, `relatorio-playwright-*/index.html` | Script |
| 5 | Print dos checks do GitHub Actions no PR | Página do PR → seção *Checks* (jobs `regras` e `navegador`) | print do usuário | **Usuário** |
| 6 | URL de Preview com a melhoria e confirmação da nova produção após o merge | Comentário da Vercel no PR (botão *Visit Preview*) + o que o script confere na produção | print do Preview; `06-producao.txt` | **Usuário** (Preview) e script (produção) |
| 7 | Retorno literal do MCP `demandas-lab` para o caso T1 | `node tools/teste-mcp.mjs`; e, dentro da sessão do Claude Code, o prompt de `docs/MCP.md` depois de registrar o servidor | `03-mcp-t1.txt`; print da sessão | Script + **usuário** (registro e sessão) |
| 8 | Matriz de 5 cenários exportada em CSV | `docs/MATRIZ_GOVERNANCA.csv` (gerada de `docs/matriz-governanca.json` por `npm run matriz`; conferida por `tests/matriz.test.mjs`) | o próprio arquivo | Pronto |

## Além do checklist, e que a aula também pede

- **Reversão** (slide 39): `git restore` × `git revert` simulados em branch descartável (ver o registro no histórico da sessão; nada foi enviado).
- **Prompt injection** (slide 43): `docs/CONTEUDO_EXTERNO_NAO_CONFIAVEL.md`, com a análise sem execução e o controle adotado.
- **Branch, PR, Preview e merge** (slides 33 a 38): PR #1 (`feature/limpar-filtros`, commit `f30869e`), merge `5dec4b0`. O teste `tests/e2e/09-limpar-filtros.spec.mjs` **falhou 9/9 contra a produção antes do merge e passou 18/18 depois**: é a prova de que a melhoria só chegou à produção com o merge.

## O que este checklist não prova

- A janela anônima, os checks do Actions e o Preview dependem de você (o repositório é privado e não há `gh` aqui).
- Os testes de interface rodam no Chromium do Playwright, não no Edge nem no Safari.
- O CSV foi conferido pelos testes e pela leitura dos arquivos, não aberto no Excel.
- O cliente MCP real foi exercitado por uma chamada temporária e headless; o registro permanente no Claude Code depende da sua autorização.
