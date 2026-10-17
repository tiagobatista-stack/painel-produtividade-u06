# Kanban de projetos com Design Thinking

> **Não faz parte do produto.** Era só metodologia de desenvolvimento. A ferramenta (`kanban.html` e seus arquivos) foi removida do site em 2026-10-17 e continua disponível no histórico do Git: o último commit da `main` que a contém é `8afbe8d` (introduzida em `abc903a`). Este documento fica como registro da metodologia; os requisitos RF28 a RF33 abaixo descrevem o que a ferramenta fazia, e os arquivos e testes citados já não existem na `main`.

Página à parte do painel de demandas (`kanban.html`), no mesmo repositório e no mesmo deploy. **Não altera** o painel, o motor de prioridade (`js/regras.js`), os casos T1–T14, o seed nem o MCP. Só dados fictícios.

## O que a página faz

| ID | Requisito | Critério de aceite | Verificação |
|---|---|---|---|
| RF28 | Quadro com 4 colunas de status: Backlog, Em andamento, Em revisão e Concluído, cada uma com a contagem de cards | No exemplo (data de referência 15/10/2026): 3, 2, 2 e 1 | `tests/kanban.test.mjs`, `tests/e2e/17-kanban` |
| RF29 | Card com título (obrigatório, até 120 caracteres), descrição (até 500), prioridade (Alta, Média ou Baixa, escolhida pelo usuário) e prazo opcional; criar, editar e excluir, com validação e foco no primeiro erro | Título vazio, texto longo e data impossível são recusados com mensagem ao lado do campo; o card novo entra no Backlog | `tests/kanban.test.mjs`, `17-kanban` |
| RF30 | Mover cards por arrastar (API nativa) ou pelos botões `◀ ▶`, que funcionam com teclado e no celular; a mudança fica no histórico do card e é anunciada para leitores de tela | Mover por botão e por arrastar muda a coluna e grava `Status: A → B` | `tests/kanban.test.mjs`, `17-kanban` |
| RF31 | Filtros: busca (número, título e descrição, sem acento nem caixa), prioridade, prazo (atrasados, próximos 7 dias, sem prazo) e status; combináveis, com contagem "N de M cards" e botão "Limpar filtros" | No exemplo: prioridade Alta → 2 cards; atrasados → 1; próximos 7 dias → 3; sem prazo → 1 | `tests/kanban.test.mjs`, `17-kanban` |
| RF32 | Persistência no `localStorage`, na chave própria `kanban-dt:v1` (não mistura com `painel-demandas:v1`); dado corrompido ou inválido volta ao exemplo; "Restaurar exemplo" e exclusão têm "Desfazer" por cerca de 8 s | Os cards e as notas sobrevivem ao recarregar; JSON inválido não quebra a página | `tests/kanban.test.mjs`, `17-kanban` |
| RF33 | Aba **Design Thinking** com as 5 etapas (Empatizar, Definir, Idear, Prototipar, Testar): notas por etapa e, nas ideias (etapa Idear), o botão "Promover para o Backlog", que cria um card de prioridade Média com a nota como descrição e liga os dois; uma ideia só vira card uma vez enquanto o card existir | No exemplo, as etapas têm 2, 1, 2, 1 e 0 notas; promover N-0004 cria K-0009 no Backlog | `tests/design-thinking.test.mjs`, `18-design-thinking` |

Regras de apresentação:

- **Ordem na coluna:** prioridade (Alta, Média, Baixa), depois prazo mais próximo (sem prazo por último), depois criação.
- **Atrasado:** prazo anterior à data de referência e card ainda não concluído. A cor nunca é o único sinal: a prioridade aparece em texto e o atraso, no texto do prazo ("atrasado há 2 dias").
- **Abas pelo endereço:** `#quadro` e `#design-thinking`; endereço desconhecido cai no Quadro. Nenhum `id` da página pode ser igual ao nome de uma aba.
- **Data de referência:** o campo do topo funciona como no painel (padrão: hoje; "Usar data do exemplo" põe 15/10/2026).
- **Navegação entre páginas:** link "Kanban de projetos" no topo do painel e "Painel de demandas" no topo do Kanban.

## Modelo de dados

```
card: { id: 'K-0001', titulo, descricao, prioridade: alta|media|baixa, prazo?: 'AAAA-MM-DD',
        status: backlog|andamento|revisao|concluido, criado_em, historico: [{ data, evento }] }
nota: { id: 'N-0001', etapa: empatizar|definir|idear|prototipar|testar, texto (até 300), card_id? }
armazenado: { versao: 1, cards: [...], notas: [...] }       // chave kanban-dt:v1
```

O exemplo fictício está em `data/kanban-exemplo.json` (8 cards e 6 notas).

## Arquitetura

```
js/kanban.js               # puro: status, prioridades, criar/editar/mover/remover/restaurar, filtros, ordem, agrupamento
js/design-thinking.js      # puro: etapas, notas, promoção de ideia a card
js/kanban-armazenamento.js # localStorage (storage por parâmetro; dado inválido volta ao exemplo)
js/kanban-estado.js        # estado e foco compartilhados pela interface
js/ui-kanban.js            # aba Quadro: colunas, filtros, mover, formulário, excluir e Desfazer
js/ui-dt.js                # aba Design Thinking
js/kanban-app.js           # abas pelo endereço, carga, data de referência, "Restaurar exemplo"
kanban.html, css/kanban.css
tests/kanban.test.mjs, tests/design-thinking.test.mjs, tests/e2e/17-kanban.spec.mjs, tests/e2e/18-design-thinking.spec.mjs
```

Reaproveita utilitários do painel: `dataValida`, `diasEntre` e `somarDias` (`js/indicadores.js`), `normalizarBusca` (`js/demandas.js`) e, da interface, `criarGestorErros`, `mostrarMensagem` e `opcoes` (`js/ui-comum.js`). O build (`scripts/build.mjs`) passou a incluir `kanban.html`, e `tests/build.test.mjs` confere que as duas páginas alcançam tudo o que está em `public/`.

## Limites

- O arrastar nativo não funciona em celular; os botões `◀ ▶` são o caminho principal ali.
- A prioridade é escolhida pelo usuário: o motor do painel não se aplica a cards genéricos.
- Os dados ficam só no navegador: sem conta, sincronização ou backup.
