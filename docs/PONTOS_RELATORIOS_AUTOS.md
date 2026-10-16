# Pontos, relatórios, autos, anotações e mapa

Cada operação chega por uma planilha e **cada ponto é uma demanda**: ele pode ter relatório sozinho ou ser somado a outros pontos no mesmo relatório. O objetivo é **monitorar se cada ponto teve o relatório finalizado e os seus autos lavrados**. Só dados fictícios no repositório: a planilha real fica no navegador de quem usa e nunca vai ao repositório nem à Vercel (matriz de governança, cenários C3 e C5).

Requisitos RF34 a RF41 em `docs/REQUISITOS.md`; critérios em `docs/CRITERIOS_ACEITE.md`.

## O que foi acrescentado

| Tema | O que muda |
|---|---|
| Relatório agrupado (RF34) | No painel lateral da operação, marcar 2 ou mais pontos da mesma etapa (Vistoriado ou Em elaboração) e "Agrupar em um relatório" cria `R1`, `R2`… Mudar a situação do relatório muda todos os pontos dele. "Desfazer agrupamento" só enquanto não está concluído. |
| Vários autos por ponto (RF35) | "Registrar auto" (tipo e data) quantas vezes for preciso, depois do relatório concluído. Remover o último auto volta o ponto a "Relatório concluído". |
| Aba Pontos (RF36) | Todos os pontos de todas as operações, com a situação do relatório e dos autos, contadores que filtram, busca, filtro por operação e situação. O que falta vem primeiro. Sem coordenadas na tela. |
| Anotações (RF37) | Caixa de texto em toda demanda (também operação) e em cada ponto: o que já foi feito e o que está pendente. |
| Coordenadas em graus, minutos e segundos (RF38) | A colagem da planilha aceita `20° 30' 15,500" W` e `15° 10' 20,250" S`, além de decimais. |
| Exportações (RF39) | CSV de pontos com `RELATORIO`, `AUTOS` e `OBSERVACOES` no fim; CSV de demandas com `OBSERVACOES`. |
| Calendário da programação (RF40) | O período de saída a retorno aparece em todos os dias, mais o evento de retorno; operação concluída ou sobrestada fica como faixa discreta, sem prazo. |
| Mapa local (RF41) | Visão "Mapa" na aba Pontos. |

## Situação do ponto

Derivada da etapa do ponto:

| Situação | Etapa do ponto |
|---|---|
| Planejado | `planejado` (a equipe ainda não voltou) |
| Aguardando relatório | `vistoriado` ou `relatorio_elaboracao` |
| Relatório concluído, auto a lavrar | `relatorio_concluido` |
| Com auto lavrado | `auto_lavrado` (um ou mais autos) |
| Encerrado sem auto | `encerrado_nao_constatado` ou `encerrado_nao_acessado` |

## Regras

- **Contagem de relatórios:** "Relatórios pendentes" (indicador, esforço em horas e pontuação da operação) conta **relatórios**: pontos agrupados valem 1. Sem grupos o número é o de pontos, então o exemplo, T1–T14 e os critérios existentes não mudam. Com grupos, a pontuação da operação pode ser menor (os pesos não mudam).
- **Etapas do relatório:** vistoriado, em elaboração e concluído valem para todo o relatório; o auto e o encerramento são de cada ponto. Um ponto que já passou do relatório (auto ou encerrado) pode voltar sozinho a "Relatório concluído".
- **Autos:** só com o relatório concluído; tipo da lista; a data não pode ser anterior à do relatório; escolher "Auto lavrado" no seletor de etapa registra 1 auto de infração na data de referência. Com mais de um auto, mudar a etapa do ponto é recusado até remover os autos.
- **Resumo semanal:** "relatórios concluídos" conta relatórios (grupo = 1); "autos lavrados" conta cada auto pela sua data.
- **Anotações:** texto simples, sempre mostrado como texto (nunca como HTML). Demanda até 2000 caracteres e ponto até 500. Texto vazio apaga. O rascunho que ainda não foi salvo permanece enquanto o painel é redesenhado, mas se perde ao recarregar a página.
- **Compatibilidade:** `relatorios`, `autos` e `observacoes` são opcionais. Uma cópia JSON anterior continua válida, e um ponto antigo em "Auto lavrado" sem lista de autos vale como 1 auto de tipo não informado.

## Modelo de dados

```
operação:   relatorios?: [{ id: 'R1', pontos: [1, 2, 3], criado_em }]    observacoes?: texto (até 2000)
ponto:      etapa, data_relatorio, data_auto (primeiro auto),
            autos?: [{ id: 'A1', tipo: auto_infracao|termo_embargo|termo_apreensao|termo_interdicao|outro, data }],
            observacoes?: texto (até 500)
demanda:    observacoes?: texto (até 2000)
```

## Importação com graus, minutos e segundos

`dd° mm' ss,sss" H`, também com `′ ″ ’ ”`, espaços variáveis, vírgula ou ponto decimal e hemisfério opcional. S, W e O (oeste) ficam negativos. Na coluna COORD_X (longitude) só valem E, L, W e O; na COORD_Y (latitude), N e S, o que denuncia colunas trocadas. Minutos e segundos precisam ser menores que 60; graus até 180 (X) e 90 (Y). A mensagem de erro orienta o formato e **não repete o valor digitado**.

## Mapa local

Visão **Lista | Mapa** na aba Pontos, com a mesma lista filtrada.

- **Sem mapa-base e sem serviço externo.** Um mapa de ruas (por exemplo, com blocos do OpenStreetMap) exigiria abrir a política de conteúdo e **enviaria as coordenadas dos alvos de fiscalização a terceiros**. Por isso o desenho é um SVG local: posição relativa dos pontos por longitude e latitude, com grade, escala aproximada e rótulo de município.
- **Projeção:** equiretangular, com a longitude corrigida pelo cosseno da latitude média; serve para ver agrupamento e posição relativa, não para medir distâncias com precisão.
- **Marcadores:** cada situação tem cor **e forma** (círculo vazado, quadrado, losango, círculo cheio, triângulo), com legenda e contagem. Marcadores muito próximos são afastados um pouco para poderem ser vistos e acionados; a ordem do afastamento é estável.
- **Teclado:** cada marcador é um botão (Enter ou Espaço abre o painel da operação). Pontos sem coordenada ficam numa lista própria, com o botão para abrir a operação.
- Contorno de municípios, se for desejado, entra depois como arquivo público guardado no próprio repositório.

## Arquitetura

```
js/operacoes.js       # agrupar/desfazer relatório, relatório em lote, registrar/remover auto, anotação do ponto (puro)
js/indicadores.js     # relatoriosPendentes (conta relatórios), relatorioDoPonto, autosDoPonto
js/pontos.js          # pontosDasOperacoes, listarPontos, situação, resumo (puro)
js/mapa.js            # projeção, grade, escala, afastamento de marcadores (puro)
js/planilha.js        # coordenadas em graus, minutos e segundos
js/resumo.js, js/exportacao.js, js/agenda.js   # relatório = grupo, colunas novas, período da operação
js/ui-operacao.js, js/ui-painel.js, js/ui-anotacoes.js   # painel lateral: agrupar, autos, anotações
js/ui-pontos.js, js/ui-mapa.js, js/ui-calendario.js      # aba Pontos, mapa, calendário
tests/relatorios-autos.test.mjs, planilha-coordenadas.test.mjs, pontos.test.mjs, mapa.test.mjs
tests/e2e/19-pontos-relatorios-autos, 20-aba-pontos, 21-planilha-coordenadas, 22-calendario-operacao, 23-mapa-pontos
```

## Limites

- A importação continua por **colar** a planilha (sem biblioteca para ler `.xlsx`: a política de conteúdo e o "sem dependências" do projeto).
- Tipos de auto: lista curta e genérica; ajustar em `js/rotulos.js` (`TIPOS_AUTO`) se a rotina pedir outros.
- O mapa não mostra estradas nem limites; as posições são relativas.
- Os dados ficam só no navegador: sem conta, sincronização ou backup. As anotações podem conter informação sensível em uso real: o painel publicado é público, então anotações reais nunca devem ir ao repositório nem a capturas de tela.
