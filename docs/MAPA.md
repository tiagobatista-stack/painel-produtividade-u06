# Mapa — roteiro e condições (RF41, RF63 a RF65)

**Produto principal do painel:** ver no mapa os pontos das operações e as demandas. A localização é central porque as demandas exigem vistoria e definem viagens, equipe e relatórios. Tudo aqui usa dados fictícios; coordenadas reais nunca vão ao repositório (RNF11).

Estado: o SVG local da aba Pontos e o **mapa v1** (Leaflet local, OpenStreetMap, satélite da SEMA, demandas com coordenada, coordenada sob o cursor) estão **entregues**. As etapas 2 a 5 estão **especificadas e não implementadas**.

## Roteiro de entregas

| Etapa | Entrega | Requisito |
|---|---|---|
| v1 (entregue) | Mapa dos pontos das operações com Leaflet local: Lista \| Mapa, filtros da lista, OpenStreetMap e satélite da SEMA; popup; escala; coordenada em GMS sob o cursor, com botão de copiar | RF41 |
| 2 (entregue) | PR B: coordenada (decimal ou GMS) e endereço na Nova demanda e na edição; demandas com coordenada aparecem no mapa | RF42, RF48 |
| 3 | Clicar no mapa para preencher a coordenada | RF63 |
| 4 | Exportar GeoJSON, KML e GPX | RF64 |
| 5 | Camadas da SEMA via WMS (UC, TI, embargos, CAR) | RF65 |

## Camadas

- **OpenStreetMap** (ruas) e **Satélite**: o mosaico Sentinel-2 anual da própria SEMA-MT por WMS (`Mosaicos:SENTINEL_2_2025`, servidor `geo.sema.mt.gov.br`, sem chave), dado público da SEMA. **Google Satélite fica fora.** O EOX Sentinel-2 cloudless foi descartado (licença não comercial; a página cita "dashboards" como uso comercial) e o Esri World Imagery ficou como segunda opção, só depois de esclarecer os termos.
- **Composição de bandas a confirmar:** o bloco de teste sobre Mato Grosso parece uma composição em **cores falsas** (vegetação em verde vivo, área urbana em rosa), não cor natural; o catálogo também lista camadas `_NIR`. Confirmar com a CGMA qual é a composição e se há camada em cor natural.
- **Cobertura:** o mosaico só cobre Mato Grosso. Fora do estado (como as coordenadas fictícias do exemplo, no Atlântico) o fundo vem em branco.
- **Limite do servidor:** o GeoServer da SEMA responde `X-Rate-Limit-Limit: 15` e atrasa em 5 s o excesso; por isso blocos de 512 px e sem redesenho durante o zoom. Resolução de 10 m: serve para contexto e verificação de área, não para detalhe de imóvel.
- **Sem mapa-base:** o SVG local atual, que também é o plano B: se uma camada não carregar (rede, bloqueio, chave inválida), o mapa volta a ele com aviso, sem perder marcadores nem filtros (RNF13).
- Cada camada mostra a atribuição que a sua licença exige. **Termos de uso de cada camada: a confirmar com a SEMA antes de implementar**; este documento não os afirma.
- A camada escolhida fica salva no navegador. Nenhum pedido de blocos acontece antes de o usuário escolher uma camada (RNF15).

## Política de conteúdo (`vercel.json`)

Hoje: `img-src 'self' data:`. Mudança prevista, **só em `img-src`**, com os servidores por nome e sem curingas:

```
img-src 'self' data: https://tile.openstreetmap.org https://<servidor-do-satélite-escolhido> https://geo.sema.mt.gov.br
```

`script-src`, `style-src` e `connect-src 'self'` **não mudam**: blocos de imagem e WMS são carregados como imagem, sem requisição de dados. O Leaflet fica em `vendor/`, com a licença, sem CDN e sem script, estilo ou manipulador embutido. O teste do `vercel.json` confere exatamente esta lista (`img-src 'self' data: https://tile.openstreetmap.org https://geo.sema.mt.gov.br`) e que ela é igual aos servidores de `js/camadas-mapa.js`, o único arquivo de `js/` com endereço externo. O Leaflet é carregado por `<script src defer>` da mesma origem; ele só usa `element.style` (não `setAttribute('style')`), e os popups são montados com nós DOM.

**Referer do OpenStreetMap.** A página envia `Referrer-Policy: no-referrer`, e a política de uso dos blocos do OSM pede um Referer válido. Só a camada do OSM usa `referrerPolicy: 'origin'`, que envia a origem do site e nunca o endereço com dados. Verificado em 17/10/2026 com a rede real: 15 de 15 blocos carregaram (HTTP 200), com Referer só da origem.

## Chave do WMS da SEMA (`authkey`)

- **O v1 não usa chave:** os mosaicos são públicos e o catálogo anônimo não pede autenticação. A chave só entra com as camadas temáticas (RF65): as de UC, TI, embargos e CAR **não aparecem no catálogo anônimo**, e não foi possível confirmar se existem nem se exigem chave.
- Quando houver chave, ela fica em arquivo de configuração **fora do Git** (`.gitignore`), com um `config.exemplo.js` no repositório sem valor.
- **Aviso:** em site estático o arquivo de configuração é baixado por quem abre a página; a chave é, na prática, pública. Deve ser uma chave só de leitura, emitida para esse uso. Se falhar ou faltar, o mapa funciona sem as camadas da SEMA.

## O que fica de fora do v1

- **WFS no navegador:** depende de CORS no servidor da SEMA e exigiria `connect-src`; não entra no v1.
- **Corredor da rota** e **agrupamento automático** de demandas próximas: planejados para depois (RF54).

## Formato das coordenadas fora da tela (decisão registrada, a implementar)

- **Na tela** as coordenadas continuam com **vírgula decimal** (pt-BR): `-11,053889`, `11° 03' 14" S`.
- **Exportações CSV, GeoJSON e KML (e GPX): sempre com ponto decimal**, que é o que os formatos e as ferramentas de SIG esperam: `-11.053889`. GeoJSON, KML e GPX já exigem o ponto; a decisão estende a regra às colunas de coordenada dos CSV.
- **Botão "copiar coordenada" do mapa:** no PR do mapa que vem a seguir passa a copiar `-11.053889, -58.847500` (latitude, vírgula e espaço, longitude, ponto decimal, 6 casas), em vez do texto em graus, minutos e segundos que o v1 copia hoje. Assim a cópia cola direto no QGIS, no GPS e em planilha.
- **Atenção ao CSV atual:** hoje os CSV de demandas e de pontos escrevem as coordenadas com vírgula decimal, para abrir no Excel em português, e os testes esperam isso (`tests/exportacao.test.mjs`, `tests/e2e/06-exportacao.spec.mjs`). Trocar para ponto muda `COORD_X` e `COORD_Y` e a ida e volta do CSV de pontos com a importação da planilha. Isso fica para um PR próprio, com os testes atualizados.

## Privacidade

O pedido de blocos revela ao servidor **a região visualizada** e o IP de quem consulta, nunca as coordenadas das fichas. Para operações reais, cujo planejamento é sigiloso até a ação, a decisão de usar camadas externas é do responsável (matriz de governança, cenários C3, C5 e C6).

## Testes (sem rede)

Unitários de conversão de coordenadas (`tests/coordenadas.test.mjs`) e de dados e filtro dos marcadores (`tests/mapa.test.mjs`). E2e (`tests/e2e/25-mapa-camadas.spec.mjs`) com os servidores de mapa **interceptados** (imagem de 1 pixel) ou bloqueados: nenhum pedido antes da escolha da camada, marcadores = itens da lista filtrada, popup, teclado, troca de camada, atribuição, coordenada sob o cursor e cópia, demanda com coordenada, recuo para "Sem mapa-base" e largura em 360 px. Coordenadas de teste fictícias (Atlântico).

## Limitações conhecidas do v1

- **Marcadores sobrepostos:** no enquadramento automático, os pontos de uma mesma operação ficam a poucas centenas de metros e se empilham; é preciso aproximar. O agrupamento automático está planejado para depois (RF54).
- **Demandas no mapa:** aparecem as demandas abertas com coordenada (4 no exemplo, todas fictícias, em pleno Atlântico, mais as que o usuário cadastrar). Operações aparecem pelos pontos. A busca vale para as demandas; escolher uma operação ou uma situação de ponto as esconde.
- **Camada escolhida fica salva:** quem escolheu OpenStreetMap ou Satélite volta a pedir blocos ao abrir o mapa na vez seguinte.
