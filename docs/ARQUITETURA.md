# Arquitetura

Tudo roda no navegador, sem backend. A única peça compartilhada é o motor de prioridade, o que garante a mesma resposta na tela, nos testes e no MCP.

## Código-fonte × pasta gerada

- **Código-fonte (editado na raiz):** `index.html`, `css/`, `js/`, `data/`, `tests/`, `tools/`, `scripts/`, `docs/`.
- **Pasta gerada:** `public/`, criada por `npm run build` (`scripts/build.mjs`) e publicada pela Vercel. Está no `.gitignore`; nunca se edita à mão.
- **Referência:** `legado/index.html` (dashboard antigo), fora do build e da publicação.

```
painel-produtividade-u06/
├── index.html
├── css/styles.css
├── js/app.js            # interface
├── js/regras.js         # motor de prioridade (puro, módulo ES)
├── data/seed.json       # exemplo fictício
├── tests/regras.test.mjs  # T1–T11 (node --test)
├── tests/e2e/           # Playwright
├── tools/demandas-mcp.mjs # servidor MCP local
├── tools/teste-mcp.mjs  # teste do servidor MCP
├── scripts/build.mjs    # copia o necessário para public/
├── docs/
├── legado/
├── .github/workflows/qualidade.yml
├── .gitlab-ci.yml       # ilustrativo (slide 44), sem repositório GitLab
├── vercel.json
└── package.json
```

## Fluxo

1. Editar o código-fonte → `npm run quality` (testes do motor) → `npm run build` (gera `public/`).
2. `git push` envia ao GitHub; o GitHub Actions executa a qualidade; a Vercel publica `public/` (Preview em branches, Production em `main`).
3. `js/regras.js` exporta `priorizar` como módulo ES, importado pela interface, pelos testes Node e pelo MCP.

## Riscos e limites

Só dados fictícios no repositório e no deploy (a URL da Vercel é pública). Sem autenticação, backend ou banco. Persistência apenas no `localStorage` do navegador.
