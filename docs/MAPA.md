# Mapa — roteiro e condições (RF41, RF63 a RF65)

**Produto principal do painel:** ver no mapa os pontos das operações e as demandas. A localização é central porque as demandas exigem vistoria e definem viagens, equipe e relatórios. Tudo aqui usa dados fictícios; coordenadas reais nunca vão ao repositório (RNF11).

Estado: o SVG local da aba Pontos está entregue. O restante está **especificado e não implementado**.

## Roteiro de entregas

| Etapa | Entrega | Requisito |
|---|---|---|
| v1 | Mapa dos pontos das operações com Leaflet local: Lista \| Mapa, filtros da fila, OpenStreetMap e uma camada de satélite | RF41 |
| 2 | PR B: coordenada (decimal ou GMS) e endereço na Nova demanda; demandas com coordenada aparecem no mapa | RF42, RF48 |
| 3 | Clicar no mapa para preencher a coordenada | RF63 |
| 4 | Exportar GeoJSON, KML e GPX | RF64 |
| 5 | Camadas da SEMA via WMS (UC, TI, embargos, CAR) | RF65 |

## Camadas

- **OpenStreetMap** (ruas) e **uma camada de satélite** (a escolher no plano da v1, comparando o mosaico da própria SEMA via WMS, EOX Sentinel-2 cloudless e Esri World Imagery em licença, atribuição e uso permitido). **Google Satélite fica fora.**
- **Sem mapa-base:** o SVG local atual, que também é o plano B: se uma camada não carregar (rede, bloqueio, chave inválida), o mapa volta a ele com aviso, sem perder marcadores nem filtros (RNF13).
- Cada camada mostra a atribuição que a sua licença exige. **Termos de uso de cada camada: a confirmar com a SEMA antes de implementar**; este documento não os afirma.
- A camada escolhida fica salva no navegador. Nenhum pedido de blocos acontece antes de o usuário escolher uma camada (RNF15).

## Política de conteúdo (`vercel.json`)

Hoje: `img-src 'self' data:`. Mudança prevista, **só em `img-src`**, com os servidores por nome e sem curingas:

```
img-src 'self' data: https://tile.openstreetmap.org https://<servidor-do-satélite-escolhido> https://geo.sema.mt.gov.br
```

`script-src`, `style-src` e `connect-src 'self'` **não mudam**: blocos de imagem e WMS são carregados como imagem, sem requisição de dados. O Leaflet fica em `vendor/`, com a licença, sem CDN e sem script, estilo ou manipulador embutido. O teste do `vercel.json` passa a conferir exatamente esta lista. O hostname do satélite é definido no plano da v1.

## Chave do WMS da SEMA (`authkey`)

- Fica em arquivo de configuração **fora do Git** (`.gitignore`), com um `config.exemplo.js` no repositório sem valor.
- **Aviso:** em site estático o arquivo de configuração é baixado por quem abre a página; a chave é, na prática, pública. Deve ser uma chave só de leitura, emitida para esse uso. Se falhar ou faltar, o mapa funciona sem as camadas da SEMA.

## O que fica de fora do v1

- **WFS no navegador:** depende de CORS no servidor da SEMA e exigiria `connect-src`; não entra no v1.
- **Corredor da rota** e **agrupamento automático** de demandas próximas: planejados para depois (RF54).

## Privacidade

O pedido de blocos revela ao servidor **a região visualizada** e o IP de quem consulta, nunca as coordenadas das fichas. Para operações reais, cujo planejamento é sigiloso até a ação, a decisão de usar camadas externas é do responsável (matriz de governança, cenários C3, C5 e C6).

## Testes (sem rede)

Unitários de conversão de coordenadas e de filtro. E2e com os servidores de mapa **bloqueados**: marcadores = itens da lista filtrada, popup, troca de camada e recuo para "Sem mapa-base". Coordenadas de teste fictícias (Atlântico).
