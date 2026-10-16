# Pontos, relatórios, autos, anotações e mapa

Cada operação chega por uma planilha e **cada ponto é uma demanda**: ele pode ter relatório sozinho ou ser somado a outros pontos no mesmo relatório. O objetivo é **monitorar se cada ponto teve o relatório finalizado e os seus autos lavrados**. Só dados fictícios no repositório: a planilha real fica no navegador de quem usa e nunca vai ao repositório nem à Vercel (matriz de governança, cenários C3 e C5).

Requisitos RF34 a RF42 em `docs/REQUISITOS.md`; critérios em `docs/CRITERIOS_ACEITE.md`.

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
| Mapa (RF41) | Visão "Mapa" na aba Pontos: hoje um SVG local sem mapa-base; **especificado** para ter duas camadas iniciais, OpenStreetMap e Google Satélite (seção "Camadas do mapa"). |
| Coordenada na Nova demanda (RF42) | **Especificado:** entrada de latitude e longitude, em decimal ou GMS, no formulário de demanda (seção "Coordenada na Nova demanda"). |

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

## Mapa

Visão **Lista | Mapa** na aba Pontos, com a mesma lista filtrada.

### Hoje (implementado): mapa local em SVG

- **Sem mapa-base e sem serviço externo:** posição relativa dos pontos por longitude e latitude, com grade, escala aproximada e rótulo de município.
- **Projeção:** equiretangular, com a longitude corrigida pelo cosseno da latitude média; serve para ver agrupamento e posição relativa, não para medir distâncias com precisão.
- **Marcadores:** cada situação tem cor **e forma** (círculo vazado, quadrado, losango, círculo cheio, triângulo), com legenda e contagem. Marcadores muito próximos são afastados um pouco para poderem ser vistos e acionados; a ordem do afastamento é estável.
- **Teclado:** cada marcador é um botão (Enter ou Espaço abre o painel da operação). Pontos sem coordenada ficam numa lista própria, com o botão para abrir a operação.

### Camadas do mapa (RF41, especificado, ainda não implementado)

O mapa terá **duas camadas de visualização iniciais**, escolhidas por um seletor:

| Camada | O que mostra | Observação |
|---|---|---|
| **OpenStreetMap** | Mapa de ruas, rios, limites e rótulos | Exige a atribuição "© contribuidores do OpenStreetMap" visível no mapa. |
| **Google Satélite** | Imagem de satélite | Exige a atribuição do Google e o uso por um caminho permitido pelos termos do Google (ver condições). |
| **Sem mapa-base** (já existe) | O SVG local de hoje | Fica como terceira opção e como **plano B**: se uma camada não carregar (rede, bloqueio, chave inválida), o mapa volta a ela com um aviso, sem perder marcadores nem filtros. |

Regras que valem em qualquer camada: marcadores por situação (cor e forma), legenda com contagem, os mesmos filtros da lista, acesso por teclado, lista dos pontos sem coordenadas, e troca de camada sem perder o filtro nem o foco. A camada escolhida fica salva no navegador.

**Condições e decisões do responsável antes de implementar.** As camadas mudam o que o projeto decidiu até aqui, então ficam registradas em vez de assumidas:

1. **Privacidade das coordenadas.** Para desenhar a camada, o navegador pede blocos de imagem ao OpenStreetMap e ao Google, que passam a saber a **região visualizada** (e o IP de quem consulta). Para operações reais, cujo planejamento é sigiloso até a ação (matriz de governança, cenários C3 e C5), isso é uma exposição. Proposta para decidir: nenhuma requisição de blocos antes de o usuário escolher uma camada (padrão "Sem mapa-base"), com um aviso curto ao ativar; ou o padrão ser uma das camadas, aceitando o risco. **Decisão pendente: camada padrão.**
2. **Política de conteúdo (`vercel.json`).** Hoje `img-src` aceita só `'self' data:`. Cada camada exige liberar os servidores de blocos (e, no caso do Google pelo caminho oficial, também `script-src` e `connect-src`). Isso afrouxa a política em um único ponto e muda o teste de `vercel.json`. Os servidores liberados devem ser listados por nome, sem curingas.
3. **Google Satélite e os termos do Google.** Os blocos de satélite do Google **não podem ser puxados direto por endereço**, fora de um produto do Google, sem violar os termos. O caminho permitido é a **Google Maps Platform** (API de JavaScript ou API de blocos), que exige **chave de API, conta com faturamento e restrição de domínio**. Pontos a decidir: (a) onde a chave fica (nunca no repositório: regra "sem tokens ou senhas"; por exemplo, variável de ambiente na Vercel injetada no build, restrita ao domínio); (b) aceitar o script do Google no `script-src`, hoje só `'self'`; (c) se, caso essas condições não sejam aceitáveis, trocar o satélite por um provedor de imagem com termos abertos para esse uso, mantendo o nome da camada. **Decisão pendente: caminho do Google e onde fica a chave.**
4. **OpenStreetMap e a política dos servidores de blocos.** O servidor público de blocos do OpenStreetMap é para uso leve, com atribuição e sem pedidos em massa. Serve a um painel pequeno de uso interno; se o uso crescer, usar um provedor próprio ou contratado.
5. **Como desenhar.** Duas opções: uma biblioteca de mapa (por exemplo, Leaflet) **copiada para o repositório, sem CDN**, ou um desenhador mínimo próprio de blocos. Em qualquer caso o código fica em `js/` e a camada local em SVG continua existindo. **Decisão pendente.**
6. **Testes.** Nenhum teste usa a rede real: os e2e interceptam as requisições de blocos com imagens falsas e conferem a troca de camada, a atribuição, o aviso de falha e o recuo para "Sem mapa-base". Coordenadas de teste continuam fictícias.

Até essas decisões, o mapa em produção continua o SVG local.

### Coordenada na Nova demanda (RF42, especificado, ainda não implementado)

O botão **"Nova demanda"** (e a edição da demanda) ganha uma **entrada de coordenada** opcional, em decimal ou graus, minutos e segundos (GMS):

- **Campos:** Latitude e Longitude, cada um aceitando os dois formatos. Exemplos válidos: `-10,504306`, `-10.504306`, `10° 30' 15,5" S`. Para a longitude: `-56,172292` ou `56° 10' 20,25" W` (O vale como W). Texto de ajuda sob os campos com um exemplo de cada formato.
- **Regras:** as mesmas da importação da planilha: minutos e segundos menores que 60; latitude até 90 e longitude até 180; hemisfério do eixo certo (N e S na latitude; E, L, W e O na longitude); S, W e O ficam negativos. Informar só uma das duas é erro. Vazio é permitido.
- **Gravação:** sempre em decimal, em `coord_x` (longitude) e `coord_y` (latitude) da demanda, os mesmos nomes dos pontos de operação. Quem digita em GMS vê o decimal gravado depois de salvar.
- **Erros:** mensagem ao lado do campo e no resumo do formulário, foco no primeiro campo inválido, e **sem repetir o valor digitado**.
- **Onde aparece:** na edição da demanda e no painel lateral. **Decisões pendentes:** (a) mostrar a demanda com coordenada no mapa como marcador próprio (recomendado, por status da demanda, distinto dos pontos de operação); (b) se o CSV de demandas passa a exportar a coordenada (hoje o CSV de demandas é sem coordenadas, e o de pontos as inclui).
- **Código previsto:** o leitor de coordenadas que hoje está em `js/planilha.js` (decimal e GMS) passa para um módulo compartilhado (`js/coordenadas.js`), usado pela importação e pelo formulário, para as duas entradas aceitarem exatamente o mesmo formato.
- **Dados:** a coordenada é sensível em uso real (alvos de fiscalização); neste exemplo só valores fictícios, e coordenadas reais nunca vão ao repositório nem a capturas de tela.

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
- O mapa em produção é o SVG local: sem estradas, limites nem satélite, com posições relativas. As camadas OpenStreetMap e Google Satélite estão especificadas, mas dependem das decisões acima.
- Os dados ficam só no navegador: sem conta, sincronização ou backup. As anotações podem conter informação sensível em uso real: o painel publicado é público, então anotações reais nunca devem ir ao repositório nem a capturas de tela.
