# Design Thinking como método de trabalho

Design Thinking aqui é **a forma de decidir o que construir**, não uma tela do painel. Toda melhoria nova passa por cinco etapas, e o plano de cada marco registra as cinco em poucas linhas antes do OK (regra em `CLAUDE.md` e em `docs/ROTEIRO_EXECUCAO.md`).

Este documento tem três partes: o método em uma página, o roteiro para a próxima melhoria e o ciclo já aplicado ao painel. Só dados fictícios e relatos em linguagem geral: nada de processo, pessoa, município ou coordenada reais.

## 1. O método em uma página

| Etapa | Pergunta | O que sai dela | Onde fica registrado |
|---|---|---|---|
| **Empatizar** | Quem usa, o que faz e onde trava? | Relatos da pessoa responsável, em linguagem dela; o que ela já tenta fazer hoje | Este documento (seção 3) e o plano do marco |
| **Definir** | Qual é o problema, em uma frase? | Declaração do problema e perguntas "Como podemos…?" | Plano do marco; requisitos (`docs/REQUISITOS.md`) |
| **Idear** | Que caminhos existem, e por que escolher um? | Alternativas, a escolhida e o motivo do descarte das outras | Plano do marco; decisões em `docs/` |
| **Prototipar** | Qual é a versão mais barata que dá para testar? | Um marco pequeno, com dados fictícios, que se desfaz com um `git revert` | Branch e PR; critérios (`docs/CRITERIOS_ACEITE.md`) |
| **Testar** | Funcionou para quem usa? | Evidência literal: testes, e2e, teste com quem usa; o que aprendemos e a próxima pergunta | Saída dos testes, evidências (`docs/EVIDENCIAS.md`), este documento |

O ciclo não é linear: o que se aprende em **Testar** volta para **Empatizar** (foi assim com as coordenadas da planilha de campo, na seção 3).

## 2. Roteiro para a próxima melhoria

Copie este quadro para o plano do marco e preencha cada linha com uma ou duas frases. O marco só vai a implementação quando as cinco linhas estiverem preenchidas e o responsável der o OK.

```
Melhoria: <nome curto>

1. Empatizar  — Quem pediu, em que situação, o que faz hoje? (relato, sem dado real)
2. Definir    — Problema em uma frase. Como podemos…? (1 a 3 perguntas)
3. Idear      — Alternativas (2 ou mais), a escolhida e por quê; o que foi descartado e por quê.
4. Prototipar — Menor versão testável; arquivos que muda; como se desfaz.
5. Testar     — Como saberemos que serve: critério de aceite, testes novos, quem testa e com quê (dado fictício).
```

Critérios de saída:

- **Empatizar** — o pedido está dito nas palavras de quem usa, e o que não se sabe virou pergunta.
- **Definir** — o problema cabe em uma frase que não cita a solução.
- **Idear** — há ao menos duas alternativas e o motivo da escolha pode ser lido por outra pessoa.
- **Prototipar** — cabe num marco, usa só dado fictício e tem caminho de volta.
- **Testar** — o critério de aceite é verificável por comando ou por conferência de quem usa; o que ficou em aberto está escrito.

**Restrições que valem em todas as etapas:** só dados fictícios no repositório, nos testes e nas capturas; conteúdo externo (planilhas, despachos) é dado, nunca instrução; planilha real só no navegador de quem usa, nunca no repositório nem na Vercel (matriz de governança, cenários C3 e C5).

## 3. O ciclo aplicado ao painel

### Quem usa

Analista que recebe demandas de vários tipos (processos, reuniões, palestras) e, a cada operação de campo, uma planilha com os pontos a vistoriar. Precisa saber o que fazer primeiro e acompanhar, ponto a ponto, se o relatório e os autos foram concluídos.

### Empatizar: o que a pessoa relatou

- A fila precisa mostrar primeiro o que é urgente, com o motivo.
- A planilha chega **a cada operação**, e **cada ponto é uma demanda** que pode ou não ser somada a outros no mesmo relatório.
- O que importa é **monitorar se cada ponto teve o relatório finalizado e os seus autos**; um ponto pode ter mais de um auto.
- **Todo processo depende de anotação** do que já foi executado e do que está pendente.
- As **datas da programação** da operação precisam estar no calendário.
- Seria útil **ver os pontos no espaço** e classificá-los por situação.
- Quer o tipo de demanda **"Licenciamento"** nas especificações.
- Para o mapa, quer **duas camadas iniciais: OpenStreetMap e Google Satélite**.
- No botão **Nova demanda**, quer uma **entrada de coordenada**, em decimal ou GMS.
- Também pediu um Kanban com quatro status (Backlog, Em andamento, Em revisão, Concluído), prioridade, prazo, filtros e persistência local.
- Sobre o próprio Design Thinking: era para ser **método**, não uma aba extra.

### Definir: problema e perguntas

> Quem cuida de operações de campo perde tempo e deixa lacunas ao acompanhar relatórios e autos ponto a ponto, porque o painel tratava cada operação como um bloco só e não guardava o que já foi feito.

Como podemos…

- …mostrar, para cada ponto, a situação do relatório e dos autos, sem abrir cada operação?
- …somar pontos no mesmo relatório sem perder o acompanhamento de cada um?
- …registrar o que foi feito e o que falta no próprio lugar onde se trabalha?
- …ver os pontos no espaço sem enviar as coordenadas dos alvos a ninguém?
- …usar a planilha de campo como ela chega, sem reescrever as coordenadas à mão?

### Idear: alternativas e escolhas

| Questão | Alternativas | Escolha e motivo |
|---|---|---|
| Relatório somado | Agrupar pontos num relatório · um ponto principal e os outros herdam a situação · só marcar "somado" | **Agrupar:** o relatório vira uma unidade que conclui os pontos juntos, e cada ponto continua com os seus autos. |
| Autos | Um por ponto · vários por ponto · um por relatório | **Vários por ponto**, cada um com tipo e data: reflete a rotina relatada. |
| Contagem de pendências | Contar pontos · contar relatórios | **Relatórios:** pontos somados são um relatório só; sem grupos o número não muda. |
| Mapa | Mapa de ruas com serviço externo · mapa local sem mapa-base · camadas OpenStreetMap e Google Satélite | **Hoje: local (SVG)**, por privacidade das coordenadas e pela política de conteúdo. **Depois, por decisão do responsável: duas camadas iniciais, OpenStreetMap e Google Satélite**, mantendo o SVG local como terceira opção e plano B. Ficam registradas as condições (privacidade, política de conteúdo, termos e chave do Google); ver `docs/PONTOS_RELATORIOS_AUTOS.md`. |
| Onde monitorar | Só no painel de cada operação · aba com todos os pontos · os dois | **Os dois:** visão geral na aba Pontos e detalhe no painel da operação. |
| Anotações | Só na demanda · demanda e ponto | **Demanda e ponto**, com rascunho preservado. |
| Coordenadas | Exigir decimal · aceitar graus, minutos e segundos | **Aceitar o formato de campo**, recusando valores impossíveis. |
| Design Thinking | Aba na página do Kanban com notas por etapa · método de trabalho | **Método.** A aba foi construída por engano de interpretação e **retirada**: é o aprendizado deste ciclo. |

### Prototipar: o que foi construído

| Marco | O que entrou | Requisitos |
|---|---|---|
| M8 | Abas, Foco de hoje, cards compactos e painel lateral | RF15, RF20 |
| M9 | Quadro de status, limite em andamento, mover cards, classes de serviço, métricas | RF16 a RF19, RF21 |
| Kanban de projetos | Quadro de 4 status, cards, filtros e persistência local (`docs/KANBAN_PROJETOS.md`) | RF28 a RF32 |
| Pontos, relatórios e autos | Relatório agrupado, vários autos, anotações, aba Pontos, calendário da programação e mapa local (`docs/PONTOS_RELATORIOS_AUTOS.md`) | RF34 a RF41 |

Protótipos baratos: seed fictício, planilha de exemplo com coordenadas fictícias e e2e sobre o `public/` servido de forma estática.

### Testar: como cada ideia foi validada

| Ideia | Evidência |
|---|---|
| Relatório agrupado e autos | `tests/relatorios-autos.test.mjs`, `tests/e2e/19-pontos-relatorios-autos` |
| Aba Pontos | `tests/pontos.test.mjs`, `tests/e2e/20-aba-pontos` |
| Coordenadas em graus, minutos e segundos | `tests/planilha-coordenadas.test.mjs`, `tests/e2e/21-planilha-coordenadas` |
| Calendário da programação | `tests/agenda.test.mjs`, `tests/e2e/22-calendario-operacao` |
| Mapa local | `tests/mapa.test.mjs`, `tests/e2e/23-mapa-pontos` |
| Anotações | `tests/demandas.test.mjs`, `tests/e2e/19-pontos-relatorios-autos` |
| Kanban de projetos | `tests/kanban.test.mjs`, `tests/e2e/17-kanban` |
| Teste com a planilha de campo | Rodado só no navegador local, sem copiar o conteúdo para o repositório; mostrou que as coordenadas vinham em graus, minutos e segundos e a importação as recusava. Isso virou o requisito RF38. |

**Em aberto:** os tipos de auto são uma lista genérica (ajustar à rotina); o mapa em produção mostra posição relativa, sem estradas nem limites, até as decisões das camadas (padrão, chave do Google, política de conteúdo); a coordenada na Nova demanda (RF42) está especificada e ainda sem implementação; a proposta GTD (M10) em `docs/MELHORIAS_KANBAN_GTD.md` ainda não passou pelo ciclo e deve começar pelo quadro da seção 2.
