# Kanban de projetos

Página à parte do painel de demandas (`kanban.html`), no mesmo repositório e no mesmo deploy. **Não altera** o painel, o motor de prioridade (`js/regras.js`), os casos T1–T14, o seed nem o MCP. Só dados fictícios.

> **Design Thinking não é uma tela.** A página chegou a ter uma aba de notas por etapa (RF33), retirada: o Design Thinking é o **método** de trabalho do projeto e está descrito em `docs/DESIGN_THINKING.md`.

## O que a página faz

| ID | Requisito | Critério de aceite | Verificação |
|---|---|---|---|
| RF28 | Quadro com 4 colunas de status: Backlog, Em andamento, Em revisão, Concluído, cada uma com a contagem de cards | No exemplo (data de referência 15/10/2026): 3, 2, 2 e 1 | `tests/kanban.test.mjs`, `tests/e2e/17-kanban` |
| RF29 | Card com título (obrigatório, até 120 caracteres), descrição (até 500), prioridade (Alta, Média ou Baixa, escolhida pelo usuário) e prazo opcional; criar, editar e excluir, com validação e foco no primeiro erro | Título vazio, texto longo e data impossível são recusados com mensagem ao lado do campo; o card novo entra no Backlog | `tests/kanban.test.mjs`, `17-kanban` |
| RF30 | Mover cards por arrastar (API nativa) ou pelos botões `◀ ▶`, que funcionam com teclado e no celular; a mudança fica no histórico do card e é anunciada para leitores de tela | Mover por botão e por arrastar muda a coluna e grava `Status: A → B` | `tests/kanban.test.mjs`, `17-kanban` |
| RF31 | Filtros: busca (número, título e descrição, sem acento nem caixa), prioridade, prazo (atrasados, próximos 7 dias, sem prazo) e status; combináveis, com contagem "N de M cards" e botão "Limpar filtros" | No exemplo: prioridade Alta → 2 cards; atrasados → 1; próximos 7 dias → 3; sem prazo → 1 | `tests/kanban.test.mjs`, `17-kanban` |
| RF32 | Persistência no `localStorage`, na chave própria `kanban-dt:v1` (não mistura com `painel-demandas:v1`); dado corrompido ou inválido volta ao exemplo; "Restaurar exemplo" e exclusão têm "Desfazer" por cerca de 8 s | Os cards sobrevivem ao recarregar; JSON inválido não quebra a página | `tests/kanban.test.mjs`, `17-kanban` |

RF33 (aba Design Thinking) foi **retirado**; os números seguintes não foram renumerados.

Regras de apresentação:

- **Ordem na coluna:** prioridade (Alta, Média, Baixa), depois prazo mais próximo (sem prazo por último), depois criação.
- **Atrasado:** prazo anterior à data de referência e card ainda não concluído. A cor nunca é o único sinal: a prioridade aparece em texto e o atraso, no texto do prazo ("atrasado há 2 dias").
- **Data de referência:** o campo do topo funciona como no painel (padrão: hoje; "Usar data do exemplo" põe 15/10/2026).
- **Navegação entre páginas:** link "Kanban de projetos" no topo do painel e "Painel de demandas" no topo do Kanban.

## Modelo de dados

```
card:       { id: 'K-0001', titulo, descricao, prioridade: alta|media|baixa, prazo?: 'AAAA-MM-DD',
              status: backlog|andamento|revisao|concluido, criado_em, historico: [{ data, evento }] }
armazenado: { versao: 1, cards: [...] }        // chave kanban-dt:v1
```

O exemplo fictício está em `data/kanban-exemplo.json` (8 cards).

**A chave guarda "dt" no nome por história.** Ela não foi renomeada para os cards já salvos nos navegadores continuarem valendo. Uma cópia antiga que traga `notas` (da aba retirada) carrega normalmente: as notas são ignoradas e somem no próximo salvamento.

## Arquitetura

```
js/kanban.js               # puro: status, prioridades, criar/editar/mover/remover/restaurar, filtros, ordem, agrupamento
js/kanban-armazenamento.js # localStorage (storage por parâmetro; dado inválido volta ao exemplo)
js/kanban-estado.js        # estado e foco compartilhados pela interface
js/ui-kanban.js            # colunas, filtros, mover, formulário, excluir e Desfazer
js/kanban-app.js           # carga, data de referência, "Restaurar exemplo"
kanban.html, css/kanban.css
tests/kanban.test.mjs, tests/e2e/17-kanban.spec.mjs
```

Reaproveita utilitários do painel: `dataValida`, `diasEntre` e `somarDias` (`js/indicadores.js`), `normalizarBusca` (`js/demandas.js`) e, da interface, `criarGestorErros`, `mostrarMensagem` e `opcoes` (`js/ui-comum.js`). O build (`scripts/build.mjs`) inclui `kanban.html`, e `tests/build.test.mjs` confere que as duas páginas alcançam tudo o que está em `public/`.

## Limites

- O arrastar nativo não funciona em celular; os botões `◀ ▶` são o caminho principal ali.
- A prioridade é escolhida pelo usuário: o motor do painel não se aplica a cards genéricos.
- Os dados ficam só no navegador: sem conta, sincronização ou backup.
