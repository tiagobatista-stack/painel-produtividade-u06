---
description: Encerra a sessão deixando o projeto retomável
---

1. Rode `git status -sb`, `git log --oneline -5` e `gh pr list --state open`.
2. Atualize `docs/ESTADO.md` (data, hash da `main`, PR aberto, último marco, próxima ação, decisões pendentes e bloqueios) e marque em `tarefas.md` o que foi concluído, com o hash.
3. Acrescente a `docs/DECISOES.md` apenas decisões novas desta sessão: uma linha, com ID e data.
4. Mostre o diff desses arquivos e aguarde o OK do usuário antes de commitar.
