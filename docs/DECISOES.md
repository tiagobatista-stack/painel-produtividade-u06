# Decisões

Não reabrir sem motivo. Decisão nova = linha nova, com data. Detalhes de cada requisito: `docs/REQUISITOS.md` (busque por RFnn).

| ID | Data | Decisão |
|---|---|---|
| D01 | 2026-10 | Só dados fictícios. Dado geográfico público (limites e listas de municípios) pode ir ao repositório; coordenada, ficha, contato e equipe de caso real, nunca. |
| D02 | 2026-10 | Mapa: sem Google; satélite = mosaico Sentinel-2 da SEMA; nenhum bloco de mapa é pedido à rede antes de o usuário escolher a camada (RNF15). |
| D03 | 2026-10 | Coordenada com vírgula na tela e ponto decimal nas exportações; "copiar coordenada" = `-11.053889, -58.847500`. GPX removido do projeto. |
| D04 | 2026-10 | Situação da vistoria (RF50): 5 estados, data única em programada e vistoriada; só a programada vai ao calendário. Não muda a prioridade. |
| D05 | 2026-10 | Calendário só com o que exige programação e prazo. Saída e retorno da operação são editáveis. |
| D06 | 2026-10 | Cada ponto de operação é uma demanda individual, editável em formulário próprio (RF67). A data da vistoria do ponto é escolhida pelo analista na janela saída–retorno; fora dela só avisa (RF68). |
| D07 | 2026-10 | (código em `0e31416`, ainda fora da `main`) Vistoria e etapa do ponto não se contradizem (tabela de coerência no RF68). "Auto lavrado" só por "Registrar auto"; o tipo do auto é obrigatório; "Remover auto" pede confirmação. |
| D08 | 2026-10 | (código em `0e31416`, ainda fora da `main`) Coordenada que muda para fora de MT: aviso em vermelho, confirmação ao salvar e detecção de latitude e longitude invertidas. |
| D09 | 2026-10 | Seed fictício no noroeste de MT (caixa 9°–12° S, 57°–60° O); nomes de município continuam fictícios. A regra do `CLAUDE.md` só muda no PR do seed. |
| D10 | 2026-10 | Prioridade do ponto: calculada e explicável (critérios a aprovar). Lista: "Organizar por" etapa (padrão) ou município; "agrupar" só para seleção em lote. |
| D11 | 2026-10 | Ordem: seed, mini-mapa, melhorias da lista, calendário. Um PR por vez; o merge é do usuário, com Regras e Navegador verdes. |
| D12 | 2026-10 | Commits com a identidade `tbagro <tiagobatista@sema.mt.gov.br>`; nada de commit, push ou merge sem aprovação. |
