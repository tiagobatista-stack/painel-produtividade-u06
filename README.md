# painel-demandas

Painel de Demandas: fila única priorizada por prazo e criticidade para reuniões, palestras, processos SIGADOC e operações de alertas de desmatamento. Projeto didático (Unidade VI, Piloto IA 06) com **dados fictícios**; não se conecta a sistemas reais.

## Documentação

- `docs/PROPOSTA_PAINEL_DEMANDAS.md` — proposta completa
- `docs/ROTEIRO_EXECUCAO.md` — roteiro por marco (M0–M7)
- `docs/REQUISITOS.md`, `docs/REGRAS_PRIORIDADE.md`, `docs/CRITERIOS_ACEITE.md`, `docs/ARQUITETURA.md`, `docs/MCP.md`
- `data/seed.json` — exemplo fictício
- `legado/` — dashboard anterior, apenas referência

## Status

M0 a M6 concluídos. M7 (qualidade e publicação): build para `public/`, testes e2e com Playwright, workflow do GitHub Actions e cabeçalhos de segurança prontos e verificados localmente. Falta publicar: repositório no GitHub e deploy na Vercel (exigem as contas e a autorização do usuário).

## Aviso

A URL publicada na Vercel é pública: somente dados fictícios entram neste repositório.

## Comandos

- `npm start` — servidor local da pasta do projeto (http://localhost:5173)
- `npm run quality` — testes do motor, da planilha, das exportações, do MCP e do build (`node --test`)
- `npm run build` — gera `public/` (só o que o navegador precisa); é o que a Vercel publica
- `npm run test:e2e` — Playwright (desktop e mobile): constrói `public/`, serve e testa. Com `SITE_URL` testa um endereço publicado: `$env:SITE_URL = "https://SEU-PROJETO.vercel.app"; npm run test:e2e`
- `npm run report:e2e` — abre o relatório HTML do Playwright
- `npm run mcp:test` — testa o servidor MCP local (`docs/MCP.md`)

Na primeira vez, `npx playwright install chromium` baixa o navegador dos testes.

## Segurança do que é publicado

`vercel.json` define uma política de conteúdo restritiva (sem script, estilo ou manipulador embutido e sem recursos externos), `nosniff`, `X-Frame-Options` e `Referrer-Policy`. Os testes e2e falham se houver erro de console ou violação dessa política, e conferem que só os arquivos do build são servidos.
