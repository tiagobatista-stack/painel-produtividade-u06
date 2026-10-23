# Ação de campo, vistoria e Roteiro de Fiscalização (RF49 a RF62)

Especificado, **não implementado**. Dados fictícios. Referência visual: `docs/modelos/roteiro-fiscalizacao-previa.html` (layout e ordem dos campos; não é código do app).

## Fluxo da demanda (RF53)

análise → decisão de vistoria → planejamento → vistoria → providências.

- **Situação da vistoria** (RF50, **entregue**, todas as demandas menos a operação): não requer, pendente, programada, vistoriada (com data), não acessada. Programada e vistoriada têm a **data da vistoria** (uma só); só a programada aparece no calendário. Campo no cadastro e na edição, filtro "Vistoria" na lista e coluna `VISTORIA` no CSV.
- **Coordenada só quando há local a vistoriar** (RF51). **Denúncia: nunca registrar o denunciante**; o roteiro mostra "Não informado na denúncia" e que o denunciante fica sob sigilo.
- **Município** (RF49): automático pela coordenada, senão informado. Os limites vêm de `Geoportal:LIM_MUNICIPIOS_MT`, simplificados em GeoJSON em `data/`, gerados por um script local documentado. **Município descentralizado** (RF52, `Geoportal:MUNICIPIOS_DESCENTRALIZADOS`): indicador só para triagem. Esses dados geográficos são públicos (RNF11); os termos de uso do Geoportal ficam **a confirmar**.
- **Nada disso altera a prioridade:** proximidade, município e situação da vistoria não têm peso no motor. T1 a T18 continuam valendo.

## Proximidade (RF54)

Lista as demandas pendentes e os pontos de operação a até **X km em linha reta** (padrão 3; opções 3, 5 e 10), no painel lateral, no mapa e na ficha. Distância por fórmula de haversine entre `coord_y` e `coord_x`. A tela diz "linha reta, só sugestão": não é distância por estrada. Corredor da rota e agrupamento automático ficam para depois.

## Ação de campo (RF55)

Substitui o antigo "Viagem". Campos: período, municípios, unidade, demandas e pontos, equipe planejada. A operação de alertas pode receber demandas de terceiros, e pode existir ação só com demandas de terceiros.

**Sem cálculo de diárias e sem cadastro de veículo** (a SEMA tem sistema próprio). A ação gera a lista usada no pedido de diárias.

## Equipe (RF56 e RF57)

- Lista de servidores salva **só no navegador**: nome, matrícula, função (fiscal, motorista, apoio, policial).
- **Equipe planejada** na ação de campo.
- **Equipe presente na vistoria**, em cada demanda e ponto: começa igual à planejada e é editável; serve ao relatório e à lavratura do auto.

## Campos de vistoria por demanda e ponto (RF58 e RF59)

| Momento | Campos |
|---|---|
| Antes | tipo/assunto, processo, código, imóvel/local, área desmatada (ha), CAR estadual, situação do CAR, CAR federal, responsáveis 0..n (nome, CPF, telefone, endereço), observações numeradas, nota de planejamento |
| Depois | data e hora, equipe presente, resultado (constatado, não constatado, não acessado), providências (nº do auto, da notificação e do termo de embargo) |

**Importação da planilha:** colunas opcionais `PROCESSO`, `CODIGO`, `TIPO`, `IMOVEL`, `AREA_HA`, `CAR_ESTADUAL`, `CAR_FEDERAL`, `SITUACAO_CAR`. Ausentes ficam vazias; a planilha atual continua válida.

## Roteiro de Fiscalização (RF60 e RF61)

Página própria, para imprimir ou salvar em PDF. Ordem do modelo:

1. **Cabeçalho:** título (Alertas, Demandas ou Misto), período, municípios, unidade.
2. **Resumo:** itens, pontos de alerta, demandas de terceiros, dias de campo. **Equipe planejada** (nome, matrícula, função).
3. **Itens agrupados por dia** (data, dia da semana, quantidade).
4. **Um cartão por item:** verde para alerta, âmbar para terceiros. Cabeçalho com "Ponto n" ou "Demanda DEM-nnnn" e o município; assunto em destaque com as etiquetas (origem e, nas demandas, a prioridade e os pontos); campos na ordem Processo, Código, Imóvel/local, Desmate, Coordenadas (**em GMS**), Situação do CAR, CAR estadual, CAR federal; nota de planejamento (alertas); Responsável/contato; Observações numeradas; "Próximos no raio de 3 km" (com a distância); e o quadro tracejado.
5. **Quadro tracejado "Registro da vistoria — preencher em campo":** data e hora, equipe presente (caixas com os nomes da equipe planejada), resultado, providências (auto, notificação, termo de embargo). Depois de preenchido em campo, é lançado no painel.
6. **Rodapé:** "Uso interno — contém dados pessoais (LGPD)", data de geração e código da ação de campo.

Textos para campo vazio: "A identificar em campo" (sem responsável), "A medir em campo" (sem área), "Fora de CAR", "—".

**Exportações do roteiro:** CSV e KML (RF61). O CSV tem o mesmo aviso de dados sensíveis dos demais.

**Implementação:** fontes do sistema (a política de conteúdo tem `font-src 'self'`), sem estilo ou script embutido, cartões gerados dos dados, tema único claro com cores explícitas para impressão.

## Indicadores (RF62)

Pendentes de vistoria por município; demandas com vizinhas no raio; vistoriadas no mês.

## Dados pessoais (RNF11)

Ficha, contatos, equipe e coordenadas reais ficam só no navegador, nunca no repositório nem na Vercel. O seed usa "CPF fictício" (sem número) e coordenadas no Atlântico. O roteiro impresso contém dados pessoais: uso interno.
