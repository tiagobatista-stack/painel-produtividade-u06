# Estado do projeto

> Atualize ao encerrar a sessão (`/encerrar`). `/retomar` confere este arquivo com o `git log`.

**Atualizado em:** 2026-10-23 · **main:** `3eed4cb` · **PR aberto:** nenhum (além do de documentação de retomada, se ainda não mesclado) · **Árvore local:** limpa

## Último marco

PR #27 mesclado: formulário "Editar ponto", vistoria por ponto (data escolhida pelo analista na janela saída–retorno, com reagendamento), coerência entre vistoria e etapa, coordenada fora de MT com confirmação, "Remover auto" com confirmação e tipo do auto obrigatório.

Testes na entrega: 390 unitários, 527 e2e (7 ignorados), build sem erro.

## Próxima ação

Seed no noroeste de MT: coordenadas fictícias na caixa 9°–12° S e 57°–60° O, nomes e situações fictícios. Plano aprovado; **não iniciado**. Mexe em `data/seed.json`, nos testes e docs que citam o Atlântico e na regra de dados do `CLAUDE.md` (a regra só muda nesse PR).

## Fila (ordem decidida)

1. Seed no noroeste de MT
2. Mini-mapa dos pontos da operação
3. Melhorias da lista de pontos (prioridade calculada e explicável, "Organizar por")
4. Calendário dos pontos

## Decisões pendentes

- Prioridade do ponto: critérios propostos (prazo dos relatórios, etapa, vistoria próxima, área, reagendamentos); aguardam OK. Ver `docs/DECISOES.md`, D10.
- Supabase: S1 e S2 indefinidos; 10 perguntas abertas no fim de `docs/INTEGRACAO_SUPABASE.md`.

## Bloqueios

- Conferência dos municípios com o Geoportal: só o usuário tem a `authkey` (`SEMA_AUTHKEY`).
- A `main` não exige PR nem os 2 checks (proteção recomendada, não ativada).

## Pendências sem prazo

- Importação das colunas opcionais da planilha (RF59); exportação GeoJSON e KML (RF64); Roteiro de Fiscalização (RF60); proximidade (RF54).
- 3 branches remotas não mescladas para decidir: `docs/mapa-camadas`, `refactor/design-thinking-metodo`, `feature/pontos-relatorios-autos`.
