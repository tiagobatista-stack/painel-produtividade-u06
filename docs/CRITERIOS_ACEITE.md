# Critérios de aceite

Data de referência dos testes: 2026-10-15. Cada critério gera uma evidência literal (saída de comando, print ou arquivo).

| Requisito | Critério de aceite | Evidência | Marco |
|---|---|---|---|
| RF01 | Nova demanda de cada tipo é criada e aparece na fila | Print + teste e2e | M3 |
| RF02 | Ao trocar o tipo, os campos do formulário mudam | Print | M3 |
| RF03 | Casos T1–T14 passam | `node --test` | M2 |
| RF04 | Fila ordenada por score, prazo e criação; busca e filtros reduzem a lista | Teste e2e (filtrar por tipo) | M1/M3 |
| RF05 | Mudança de status registra evento no histórico | Print do histórico | M3 |
| RF06 | Seed exibe: 10 abertas (11 demandas em aberto menos 1 sobrestada), 2 vencidas (DEM-0002 e DEM-0003), 5 nos próximos 7 dias, 9 relatórios pendentes (6 + 3), 2 autos a lavrar, 2 concluídas na semana e 1 sobrestado (DEM-0006); desde o M8, 4 em destaque e 3 na aba Relatórios | Print do painel | M1 |
| RF07 | Colar as linhas da planilha de exemplo gera a operação com prazo = retorno + N | Teste e2e | M4 |
| RF08 | "Registrar retorno" marca todos os pontos como vistoriados; etapas avançam até o auto | Teste e2e (lavrar auto) | M4 |
| RF09 | Prazo dentro das férias soma +20 e aparece aviso | T4 + print | M4 |
| RF10 | Agenda de 7 dias lista reuniões, palestras, saídas, prazos e afastamentos | Print | M4 |
| RF11 | O resumo semanal, na tela e no arquivo TXT, mostra a mesma contagem: na semana de 12 a 18/10/2026 do exemplo são 2 demandas concluídas, 5 relatórios, 4 autos e 2 relatórios sem auto. Os CSV de demandas (13 linhas) e de pontos (21 linhas, com coordenadas fictícias) e o JSON completo baixam | Arquivos baixados + print do resumo + teste e2e (exportar CSV) | M5 |
| RF12 | "Limpar filtros" zera busca, tipo, status e prioridade sem apagar demandas | Teste Playwright no PR | Evolução |
| RF13 | Primeira abertura carrega o seed; recarregar mantém as alterações | Teste manual/e2e | M3 |
| RF14 | Processo em "Aguardando", ou operação sobrestada pela ação "Sobrestar operação", sai da fila ativa e de abertas/vencidas/7 dias, aparece em "Sobrestados" e no filtro de status; ao voltar a outro status, o prazo registrado vale de novo | T12, T13 + print | M4 |
| RF15 | Ao abrir, "Foco de hoje" mostra no máximo 3 itens; no seed (15/10/2026): DEM-0003, DEM-0002 e DEM-0001. Cada aba abre pelo endereço (`#quadro`, `#agenda`…) | `tests/e2e/13-abas`, `14-foco-indicadores`, `tests/foco.test.mjs` + print | M8 (entregue) |
| RF16 | No seed, as colunas têm: A fazer 7, Em andamento 3, Sobrestado 1 (DEM-0006), Concluída na semana 2; a ordem dentro da coluna é a do motor | Teste de `js/quadro.js` + e2e | M9 (proposto) |
| RF17 | Com limite 3, uma 4ª demanda em andamento muda o cabeçalho para "4/3" com aviso, e a mudança é aceita | Teste e2e | M9 (proposto) |
| RF18 | Mover um processo de "A fazer" para "Em andamento" (arrastando e pelo botão "Iniciar") grava o evento no histórico; o card de operação não oferece arrastar | Teste e2e + teclado manual | M9 (proposto) |
| RF19 | No seed, a faixa Urgente tem DEM-0002 e DEM-0003, e a Data fixa tem DEM-0008, DEM-0009 e DEM-0010 | Teste de `js/quadro.js` | M9 (proposto) |
| RF20 | O card mostra só tipo, título, faixa e prazo; editar e excluir ficam no painel; excluir (sem confirmação) e clicar "Desfazer" restaura a demanda | `tests/e2e/15-painel-desfazer` | M8 (entregue) |
| RF21 | Idade, tempo até concluir e vazão batem com as datas do histórico do seed | Teste de `js/quadro.js` | M9 (proposto) |
| RF22 | Capturar um título cria item em "Entrada", fora da fila e sem placar (T15); processá-lo com tipo e prazo o leva para "A fazer" com placar calculado | T15 + teste e2e | M10 (proposto) |
| RF23–RF24 | Próxima ação aparece no card; filtro por contexto reduz o quadro | Teste e2e | M10 (proposto) |
| RF25 | Sobrestado com `cobrar_em` igual à data de referência aparece em "Foco de hoje" como "cobrar retorno", sem voltar a pontuar (T16) | T16 + teste e2e | M10 (proposto) |
| RF26 | Reunião de outro dia não aparece em "Foco de hoje"; no próprio dia, aparece (T17) | T17 + teste e2e | M10 (proposto) |
| RF27 | Concluir o checklist grava a data da revisão; recarregar mantém a data | Teste e2e | M10 (proposto) |
| RNF01 | Legível a 360 px | Print mobile | M1 |
| RNF02 | Seed sem dado real | Revisão no M0 | M0 |
| RNF03 | Funciona sem backend | Testes e2e sobre o `public/` servido de forma estática; nenhuma requisição além de GET da própria origem | M7 |
| RNF04 | Foco visível e navegação por teclado | Teste manual | M3 |
| RNF05 | Retorno do MCP igual ao do painel para T1–T6 (score, faixa e motivos) | Saída de `node tools/teste-mcp.mjs` e `tests/mcp.test.mjs`; chamada literal do MCP na sessão do Claude, depois de registrado | M6 |
| RNF07 | Nenhuma violação da política de conteúdo nos testes e2e depois das melhorias; quadro operável só pelo teclado | Testes e2e existentes + teste manual | M9 (proposto) |
| RNF08 | Uma cópia JSON exportada antes do M10 é carregada sem erro depois do M10 | Teste de compatibilidade | M10 (proposto) |
| RNF06 | `npm run build` gera `public/` só com o que o navegador precisa (25 arquivos desde o M8), sem testes, documentos nem legado | Saída do build e `tests/build.test.mjs` | M7 |
