---
description: Retoma o projeto lendo só o essencial e conferindo ESTADO.md contra o git
---

1. Leia apenas `docs/ESTADO.md`, `tarefas.md` e `docs/DECISOES.md`. Não abra outros docs sem necessidade.
2. Rode `git status -sb`, `git log --oneline -8` e `gh pr list --state open`.
3. Compare o hash de `main` e o PR aberto do ESTADO com o que o git mostrou. Se divergirem, diga o que mudou (commits ou PRs novos) e não confie no ESTADO nesse trecho.
4. Responda em no máximo 8 linhas: onde paramos, o que está aberto, a próxima ação e o que precisa do OK do usuário. Não edite nada.
