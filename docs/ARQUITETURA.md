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
├── js/app.js            # interface
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

## Evolução (M8 entregue; M9 e M10 planejados)

Proposta em `docs/MELHORIAS_KANBAN_GTD.md`. A estrutura se mantém: o motor continua único e a interface ganha módulos de apresentação.

```
js/foco.js           # (M8, entregue) puro: "Foco de hoje" (vencidas, vencem hoje, maior placar; até 3), a partir de priorizarFila
js/ui-abas.js        # (M8, entregue) abas pelo endereço (#quadro, #agenda, #afastamentos, #relatorios)
js/ui-foco.js        # (M8, entregue) faixa "Foco de hoje"
js/ui-painel.js      # (M8, entregue) painel lateral da demanda (motivos, pontos, histórico, status, editar, excluir)
js/quadro.js         # (M9) puro: agrupa por coluna e classe de serviço, conta o limite de itens em andamento, calcula idade e tempo até concluir
js/ui-quadro.js      # (M9) quadro, arrastar nativo e botões de mover
tests/foco.test.mjs  # (M8, entregue) node --test sobre o seed
tests/quadro.test.mjs  # (M9) node --test sobre o seed
tests/e2e/13-abas, 14-foco-indicadores, 15-painel-desfazer  # (M8, entregue); os specs 16 em diante ficam para M9 e M10
```

- No M8 o filtro `prazo` de `listarDemandas` (`js/demandas.js`) reaproveita as listas de `itensDosIndicadores` (`js/indicadores.js`): o número de cada indicador e a fila filtrada por ele vêm da mesma fonte. `js/regras.js` não mudou.
- `js/quadro.js` recebe o resultado de `priorizar` e não recalcula pontos.
- O status `entrada` (M10) entra em `js/rotulos.js` e `js/demandas.js`, e `js/regras.js` só ganha a regra de tirá-lo da fila. O MCP (`tools/demandas-mcp.mjs`) passa a reconhecer o status, sem ferramenta nova.
- Tudo continua sem biblioteca externa e sem código embutido, por causa da política de conteúdo do `vercel.json`.

## Riscos e limites

Só dados fictícios no repositório e no deploy (a URL da Vercel é pública). Sem autenticação, backend ou banco. Persistência apenas no `localStorage` do navegador.
