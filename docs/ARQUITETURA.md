# Arquitetura

Tudo roda no navegador, sem backend. A única peça compartilhada é o motor de prioridade, o que garante a mesma resposta na tela, nos testes e no MCP.

## Código-fonte × pasta gerada

- **Código-fonte (editado na raiz):** `index.html`, `css/`, `js/`, `data/`, `tests/`, `tools/`, `scripts/`, `docs/`.
- **Pasta gerada:** `public/`, criada por `npm run build` (`scripts/build.mjs`) e publicada pela Vercel. Está no `.gitignore`; nunca se edita à mão.
- **Referência:** `legado/` (dashboard antigo e a aula), local e fora do Git, do build e da publicação.

```
painel-produtividade-u06/
├── index.html
├── css/styles.css
├── js/app.js            # interface: indicadores, fila e cartões
├── js/ui-formulario.js  # formulário de demanda e prévia da prioridade
├── js/ui-anotacoes.js   # anotações no formulário e no cartão
├── js/anotacoes.js      # anotações (funções puras)
├── js/demandas.js       # cadastro, edição, filtros e migração (funções puras)
├── js/regras.js         # motor de prioridade (puro, módulo ES)
├── data/seed.json       # exemplo fictício
├── tests/regras.test.mjs  # T1–T14 (node --test)
├── tests/e2e/           # Playwright
├── tools/demandas-mcp.mjs # servidor MCP local (somente leitura; ver docs/MCP.md)
├── tools/teste-mcp.mjs  # teste do servidor MCP
├── tools/mcp-apoio.mjs  # cliente JSON-RPC e casos T1–T6 usados pelos testes do MCP
├── scripts/build.mjs    # copia o necessário para public/
├── scripts/serve.mjs    # servidor local (aplica os cabeçalhos do vercel.json)
├── playwright.config.mjs # desktop e mobile; SITE_URL testa um endereço publicado
├── docs/
├── legado/              # referência local, fora do Git
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
