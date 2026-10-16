# Melhorias de interface: Kanban e GTD (proposta M8–M10)

Status: **M8 (RF15 e RF20) e M9 (RF16 a RF19 e RF21) entregues; M10 ainda é proposta**. Avaliação feita em 16/10/2026 sobre a produção (https://painel-produtividade-u06.vercel.app/, janela de cerca de 800 px) e o código da `main`. Os requisitos propostos estão em `docs/REQUISITOS.md` (RF15–RF27), os critérios em `docs/CRITERIOS_ACEITE.md` e as regras novas em `docs/REGRAS_PRIORIDADE.md`. Cada marco segue a regra de condução do projeto: **plano → OK → implementação → evidência literal → commit**.

## Objetivo

A página deve mostrar primeiro o que o analista precisa fazer agora. Os indicadores, os relatórios e as exportações continuam disponíveis, mas em segundo plano. O motor de prioridade (`js/regras.js`) continua sendo a única fonte das regras. O quadro Kanban e as listas do GTD são outra forma de apresentar o resultado do motor e não mudam o placar.

## Diagnóstico da versão atual

| # | Observação | Efeito |
|---|---|---|
| D1 | A página tem uma única coluna de cerca de 4.600 px. A fila começa por volta de 1.800 px, depois dos indicadores, do resumo, das exportações, do calendário e da agenda. | O trabalho do dia exige rolagem longa. |
| D2 | Os 7 indicadores têm o mesmo peso visual: "Abertas 10" aparece igual a "Vencidas 2". | Não há ponto de partida para o olhar. |
| D3 | Cada card repete o seletor de status, "Editar" e a lixeira. A lixeira fica colada no "Editar". Os cards de operação têm 3 seções expansíveis. | Cards longos e risco de excluir por engano. |
| D4 | As 4 exportações e o aviso sobre dados ficam no alto da página. | Uma função semanal ocupa espaço de uso diário. |
| D5 | Reuniões e palestras (data e hora fixas) disputam a mesma fila com processos e operações (prazo). | Mistura compromisso marcado com trabalho a fazer. |
| D6 | O status (`a_fazer`, `em_andamento`, `aguardando`, `concluida`) só aparece num seletor dentro do card. | O fluxo do trabalho não é visível. |
| D7 | "Nova demanda" exige o formulário completo. | Registrar algo rápido, como um telefonema ou um e-mail, tem atrito. |

Pontos fortes a manter: a explicação do placar ("Por que esta prioridade?"), o destaque de prazo vencido, o prazo relativo ("vence hoje", "em 4 dias"), o aviso de afastamento com sugestão de antecipar e o sobrestamento com prazo suspenso.

## Proposta

### Kanban

1. **Quadro de status** (RF16). As colunas são os status atuais: **A fazer | Em andamento | Sobrestado | Concluída (semana)**. A coluna **Entrada** só existe a partir do M10. Dentro de cada coluna, a ordem é a do motor: maior placar, prazo mais próximo e data de criação. Um botão "Lista / Quadro" alterna as visões, e a escolha fica salva no navegador.
2. **Limite de itens em andamento** (RF17). O valor padrão é 3 e pode ser configurado. O cabeçalho mostra "n/limite" e muda de cor quando o limite é ultrapassado. O limite **avisa e não bloqueia**.
3. **Mover cards** (RF18). Arrastar com o recurso nativo do navegador, sem biblioteca. Também há botões no card, "Iniciar", "Aguardar", "Retomar" e "Concluir", que funcionam com teclado e no celular. O status das operações vem dos pontos: o card de operação não arrasta e só oferece "Sobrestar" e "Retomar".
4. **Classes de serviço** (RF19), como faixas horizontais do quadro, calculadas a partir de dados que já existem:

   | Classe | Regra | Exemplo no seed |
   |---|---|---|
   | Urgente | aberta e (vencida ou faixa Crítica) | DEM-0002, DEM-0003 |
   | Data fixa | tipo reunião ou palestra | DEM-0008, DEM-0009, DEM-0010 |
   | Padrão | tipo processo ou operação que não seja urgente | DEM-0001, DEM-0004, DEM-0005, DEM-0007 |
   | Rotina | tipo outra | DEM-0011 |

5. **Cards compactos com painel lateral** (RF20). A frente do card mostra o tipo, o título, a faixa de prioridade (na cor da borda) e o prazo relativo. Os motivos do placar, os pontos, o histórico, a edição e a exclusão abrem num painel lateral ao clicar.
6. **Métricas de fluxo** (RF21):
   - **Idade:** "parado há N dias", contado a partir do último evento de status no `historico[]` ou da `criada_em`.
   - **Tempo até concluir:** `concluida_em` menos `criada_em`.
   - **Vazão:** concluídas por semana, um cálculo que o resumo semanal já faz.

### GTD

1. **Captura rápida e caixa de entrada** (RF22). Um campo "Capturar…" no topo salva só o título, com status `entrada`. Depois, ao processar o item, você escolhe o tipo, o prazo e os demais campos, e ele entra na fila.
2. **Próxima ação** (RF23). Campo opcional `proxima_acao`, com a ação concreta seguinte, como "redigir minuta do parecer". Ela aparece na frente do card.
3. **Contextos** (RF24). Campo opcional `contexto`: `computador` (SIGADOC), `campo` (operação), `reuniao` ou `telefone`. Vira o filtro "O que posso fazer agora".
4. **Aguardando com data de cobrança** (RF25). O sobrestamento ganha `aguardando_de` (o quê ou quem) e `cobrar_em` (data). Quando a data chega, o item aparece em "Foco de hoje" como "cobrar retorno".
5. **Agenda separada da lista** (RF26). Reuniões e palestras ficam na faixa "Data fixa" e na agenda. Elas não entram em "Foco de hoje", a menos que sejam no próprio dia.
6. **Revisão semanal guiada** (RF27). O bloco "Resumo da semana" vira um checklist:
   - esvaziar a caixa de entrada;
   - revisar os sobrestados e as cobranças;
   - olhar os próximos 14 dias;
   - conferir os afastamentos;
   - exportar o resumo.

   A data da última revisão fica salva no navegador.

### Layout

1. **Topo fixo** com a data de referência, o campo de captura (M10) e "Nova demanda".
2. **"Foco de hoje"** (RF15), com no máximo 3 itens nesta ordem: vencidas, as que vencem hoje e as de maior placar.
3. **Abas** no lugar da rolagem única: **Quadro | Agenda e calendário | Afastamentos | Relatórios**. A aba atual fica no endereço da página (`#quadro`, `#agenda`…). As exportações vão para um menu "Exportar ▾" na aba Relatórios.
4. **Indicadores enxutos**: 4 botões que filtram o quadro (Vencidas, 7 dias, Sobrestados, Concluídas na semana). "Vencidas" fica vermelho só quando for maior que zero. Os demais indicadores vão para a aba Relatórios.
5. **Excluir com "Desfazer"** numa mensagem temporária de cerca de 8 s, sem caixa de confirmação.
6. **Atalhos**: `N` para nova demanda, `/` para buscar e `C` para capturar. Eles ficam desativados enquanto um campo de texto tem o foco.
7. **No celular**, até 360 px: uma coluna por vez, em abas ou rolagem horizontal com encaixe.

## Marcos

| Marco | Entrega | Mexe em | Verificação | Risco |
|---|---|---|---|---|
| M8 | Layout: abas, "Foco de hoje", indicadores enxutos, cards compactos com painel lateral, menu "Exportar", excluir com "Desfazer" (RF15, RF20) | `index.html`, `css/`, `js/app.js`, `js/ui-*.js`, `tests/e2e/` | `npm run quality` sem mudanças; e2e novos e atualizados; print desktop e 360 px | Baixo, só interface |
| M9 | Quadro: colunas, limite de itens em andamento, mover cards, classes de serviço, métricas de fluxo (RF16–RF19, RF21) | novo `js/quadro.js` (puro), novo `js/ui-quadro.js`, `tests/quadro.test.mjs`, e2e | testes do `quadro.js`; e2e mover card e limite; teclado | Médio |
| M10 | GTD: entrada, próxima ação, contexto, aguardando com cobrança, agenda separada, revisão semanal (RF22–RF27) | `js/demandas.js`, `js/rotulos.js`, `js/regras.js` (só a regra de `entrada`), `data/seed.json`, `tools/demandas-mcp.mjs`, testes | T15–T17 novos; T1–T14 sem mudança; `npm run mcp:test` | Maior: muda o modelo de dados |

Branches sugeridas: `feature/layout-abas` (M8), `feature/quadro-kanban` (M9) e `feature/gtd-entrada` (M10). Cada uma tem PR, CI verde e Preview antes do merge, como foi feito com o RF12.

## Restrições técnicas

- **Política de conteúdo (`vercel.json`):** sem script, estilo ou manipulador embutido e sem recursos externos. O arrastar usa a API nativa do navegador, e todo o código fica em `js/`. Os testes e2e já falham diante de qualquer violação.
- **Motor único:** `js/quadro.js` só agrupa e ordena o retorno de `priorizar`. Nenhum peso de pontuação muda.
- **Compatibilidade de dados:** os campos novos são opcionais. Dados já salvos no `localStorage` e cópias JSON antigas continuam válidos sem migração.
- **Exportações:** o CSV de demandas ganha as colunas `proxima_acao`, `contexto`, `aguardando_de` e `cobrar_em` só no M10, no fim da linha, para não quebrar planilhas existentes.
- **Só dados fictícios** nos exemplos, nos prints e nos testes, como em todo o projeto.

## Decisões pendentes (com a chefia)

1. Valor padrão do limite de itens em andamento: 3 é a proposta.
2. Se uma demanda **Urgente** pode passar do limite sem aviso.
3. Lista final de contextos.
4. Se a revisão semanal deve gerar registro no histórico das demandas revisadas.
5. Se "Concluída (semana)" mostra só a semana corrente ou os últimos 7 dias.
