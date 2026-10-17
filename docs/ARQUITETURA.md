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

## Evolução (M8 e M9 entregues; M10 planejado)

Proposta em `docs/MELHORIAS_KANBAN_GTD.md`. A estrutura se mantém: o motor continua único e a interface ganha módulos de apresentação.

```
js/foco.js           # (M8, entregue) puro: "Foco de hoje" (vencidas, vencem hoje, maior placar; até 3), a partir de priorizarFila
js/ui-abas.js        # (M8, entregue) abas pelo endereço (#quadro, #agenda, #afastamentos, #relatorios)
js/ui-foco.js        # (M8, entregue) faixa "Foco de hoje"
js/ui-painel.js      # (M8, entregue) painel lateral da demanda (motivos, pontos, histórico, status, editar, excluir)
js/quadro.js         # (M9, entregue) puro: agrupa por coluna e classe de serviço, conta o limite de itens em andamento, calcula idade e tempo até concluir
js/ui-quadro.js      # (M9, entregue) quadro, arrastar nativo e botões de mover
js/ui-cartao.js      # (M9, entregue) card compacto compartilhado pela lista e pelo quadro
tests/foco.test.mjs  # (M8, entregue) node --test sobre o seed
tests/quadro.test.mjs  # (M9, entregue) node --test sobre o seed
tests/e2e/13-abas, 14-foco-indicadores, 15-painel-desfazer  # (M8, entregue)
tests/e2e/16-quadro  # (M9, entregue); 17 e 18 são do Kanban de projetos (docs/KANBAN_DESIGN_THINKING.md); os do M10 começam em 24
```

- No M8 o filtro `prazo` de `listarDemandas` (`js/demandas.js`) reaproveita as listas de `itensDosIndicadores` (`js/indicadores.js`): o número de cada indicador e a fila filtrada por ele vêm da mesma fonte. `js/regras.js` não mudou.
- `js/quadro.js` recebe o resultado de `priorizar` e não recalcula pontos.
- O status `entrada` (M10) entra em `js/rotulos.js` e `js/demandas.js`, e `js/regras.js` só ganha a regra de tirá-lo da fila. O MCP (`tools/demandas-mcp.mjs`) passa a reconhecer o status, sem ferramenta nova.
- O Kanban de projetos (`kanban.html`, `js/kanban*.js`, `js/design-thinking.js`, `js/ui-kanban.js`, `js/ui-dt.js`) é independente do motor: tem modelo e armazenamento próprios (`kanban-dt:v1`) e só reaproveita utilitários de data, busca e formulário. Ver `docs/KANBAN_DESIGN_THINKING.md`.
- Pontos, relatórios e autos (`docs/PONTOS_RELATORIOS_AUTOS.md`): as regras ficam em `js/operacoes.js` (agrupar relatório, relatório em lote, autos, anotação do ponto), a contagem em `js/indicadores.js` (`relatoriosPendentes` conta relatórios; `autosDoPonto` trata o ponto antigo), a lista e a situação de cada ponto em `js/pontos.js`, a geometria do mapa em `js/mapa.js` (todos puros) e a interface em `js/ui-pontos.js`, `js/ui-mapa.js`, `js/ui-anotacoes.js`, `js/ui-operacao.js` e `js/ui-painel.js`. O mapa é SVG local, sem mapa-base: nada sai do navegador.
- Mapa com camadas (`docs/MAPA.md`, **entregue**): `js/camadas-mapa.js` (camadas e servidores; único arquivo de `js/` com endereço externo, conferido com o `img-src` do `vercel.json`), `js/coordenadas.js` (leitor de decimal e GMS, usado pela importação e pelo formulário, e formatador de decimal para GMS), os dados dos marcadores em `js/mapa.js` (puros) e a interface em `js/ui-mapa-leaflet.js` e `js/ui-mapa.js`. O Leaflet 1.9.4 fica em `vendor/leaflet/` com a licença, carregado por `<script src defer>` da mesma origem, sem CDN.
- Localização da demanda (**entregue no PR B**): endereço, latitude e longitude no formulário (`js/ui-formulario.js`, `js/demandas.js`), "Localizar" por link do OpenStreetMap (`linkParaLocalizar` em `js/camadas-mapa.js`; a página não faz requisição), painel lateral e CSV de demandas. O formulário assume S e O quando falta o hemisfério; a importação da planilha mantém o comportamento anterior.
- Município (`docs/MUNICIPIOS_MT.md`): `js/municipios.js` (puro: índice da lista de MT e normalização por caixa e acento, só como sugestão), `data/municipios-mt.json` (IBGE, gerado por `scripts/gerar-municipios-mt.mjs`), carregado por `js/app.js` e usado no formulário, na importação da planilha e na migração dos dados salvos. Sem a lista, o campo segue texto livre.
- Vistoria e ação de campo (**planejado, não implementado**; `docs/ACAO_DE_CAMPO.md`): módulos puros para proximidade (haversine), município pela coordenada, ação de campo e Roteiro de Fiscalização. A página do roteiro não usa estilo nem script embutido.
- Tudo continua sem biblioteca externa e sem código embutido, por causa da política de conteúdo do `vercel.json`.

## Riscos e limites

Só dados fictícios no repositório e no deploy (a URL da Vercel é pública). Sem autenticação, backend ou banco. Persistência apenas no `localStorage` do navegador.
