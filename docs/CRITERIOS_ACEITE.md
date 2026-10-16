# Critérios de aceite

Data de referência dos testes: 2026-10-15. Cada critério gera uma evidência literal (saída de comando, print ou arquivo).

| Requisito | Critério de aceite | Evidência | Marco |
|---|---|---|---|
| RF01 | Nova demanda de cada tipo é criada e aparece na fila | Print + teste e2e | M3 |
| RF02 | Ao trocar o tipo, os campos do formulário mudam | Print | M3 |
| RF03 | Casos T1–T14 passam | `node --test` | M2 |
| RF04 | Fila ordenada por score, prazo e criação; busca e filtros reduzem a lista | Teste e2e (filtrar por tipo) | M1/M3 |
| RF05 | Mudança de status registra evento no histórico | Print do histórico | M3 |
| RF06 | Seed exibe: 10 abertas (11 demandas em aberto menos 1 sobrestada), 2 vencidas (DEM-0002 e DEM-0003), 5 nos próximos 7 dias, 9 relatórios pendentes (6 + 3), 2 autos a lavrar, 2 concluídas na semana e 1 sobrestado (DEM-0006) | Print do painel | M1 |
| RF07 | Colar as linhas da planilha de exemplo gera a operação com prazo = retorno + N | Teste e2e | M4 |
| RF08 | "Registrar retorno" marca todos os pontos como vistoriados; etapas avançam até o auto | Teste e2e (lavrar auto) | M4 |
| RF09 | Prazo dentro das férias soma +20 e aparece aviso | T4 + print | M4 |
| RF10 | Agenda de 7 dias lista reuniões, palestras, saídas, prazos e afastamentos | Print | M4 |
| RF11 | O resumo semanal, na tela e no arquivo TXT, mostra a mesma contagem: na semana de 12 a 18/10/2026 do exemplo são 2 demandas concluídas, 5 relatórios, 4 autos e 2 relatórios sem auto. Os CSV de demandas (13 linhas) e de pontos (21 linhas, com coordenadas fictícias) e o JSON completo baixam | Arquivos baixados + print do resumo + teste e2e (exportar CSV) | M5 |
| RF12 | "Limpar filtros" zera busca, tipo, status e prioridade sem apagar demandas | Teste Playwright no PR | Evolução |
| RF13 | Primeira abertura carrega o seed; recarregar mantém as alterações | Teste manual/e2e | M3 |
| RF14 | Processo em "Aguardando", ou operação sobrestada pela ação "Sobrestar operação", sai da fila ativa e de abertas/vencidas/7 dias, aparece em "Sobrestados" e no filtro de status; ao voltar a outro status, o prazo registrado vale de novo | T12, T13 + print | M4 |
| RNF01 | Legível a 360 px | Print mobile | M1 |
| RNF02 | Seed sem dado real | Revisão no M0 | M0 |
| RNF03 | Funciona sem backend | Testes e2e sobre o `public/` servido de forma estática; nenhuma requisição além de GET da própria origem | M7 |
| RNF04 | Foco visível e navegação por teclado | Teste manual | M3 |
| RNF05 | Retorno do MCP igual ao do painel para T1–T6 (score, faixa e motivos) | Saída de `node tools/teste-mcp.mjs` e `tests/mcp.test.mjs`; chamada literal do MCP na sessão do Claude, depois de registrado | M6 |
| RNF06 | `npm run build` gera `public/` só com o que o navegador precisa (20 arquivos), sem testes, documentos nem legado | Saída do build e `tests/build.test.mjs` | M7 |
