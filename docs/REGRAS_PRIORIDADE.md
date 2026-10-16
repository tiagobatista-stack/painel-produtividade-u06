# Regras de prioridade

Função pura `priorizar(demanda, hoje)` em `js/regras.js` (M2), retornando `{score, faixa, motivos}`. Sem acesso a tela ou armazenamento. Pesos são proposta inicial, a validar com a chefia.

## Pontuação (soma, sem teto)

| Critério | Condição | Pontos |
|---|---|---|
| Prazo | vencido | +50 |
| Prazo | vence em 0 a 2 dias | +30 |
| Prazo | vence em 3 a 7 dias | +15 |
| Prazo | mais de 7 dias | 0 |
| Tipo | operação de alertas | +20 |
| Tipo | processo SIGADOC | +15 |
| Tipo | reunião | +10 |
| Tipo | palestra | +5 |
| Tipo | outra | 0 |
| Origem do processo (só tipo processo) | Ministério Público, Poder Judiciário ou Procuradoria de Justiça | +25 |
| Origem do processo (só tipo processo) | Ouvidoria | +15 |
| Origem do processo (só tipo processo) | Denúncia | +10 |
| Origem (qualquer tipo) | Chefia ou coordenação | +10 |
| Operação | 10 ou mais relatórios pendentes | +15 |
| Operação | 5 a 9 relatórios pendentes | +8 |
| Afastamento | prazo dentro de férias ou licença-prêmio agendada (início e fim inclusos) | +20 |

## Faixas

Crítica ≥ 70 · Alta 45–69 · Média 25–44 · Baixa < 25.

## Regras complementares

- Demanda concluída sai da fila (na operação: todos os pontos encerrados).
- **Sobrestamento:** demanda com status "Aguardando" (aguarda resposta do interessado; no painel, "Sobrestado (aguardando)") tem o prazo suspenso. Sai da fila ativa, não pontua, não conta como aberta, vencida nem próximos 7 dias e aparece no indicador "Sobrestados" e no filtro de status. Vale para todos os tipos, exceto operação, cujo status é derivado dos pontos. O prazo não é validado enquanto sobrestada. Ao voltar para outro status, o prazo registrado volta a valer, sem recálculo (a demanda pode retomar já vencida).
- Desempate: maior score, depois prazo mais próximo, depois data de criação.
- Prazo ausente ou inválido gera erro de validação, sem cálculo.
- Operação: prazo = retorno + `prazo_dias`; relatórios pendentes = pontos em `vistoriado` ou `relatorio_elaboracao`; status derivado das etapas.
- Prazo de hoje (0 dias) entra na faixa de 0 a 2 dias.

## Casos de teste (hoje = 2026-10-15)

| Caso | Entrada | Score | Faixa esperada |
|---|---|---|---|
| T1 | Operação vencida há 1 dia, 12 relatórios pendentes, coordenação | 95 | Crítica |
| T2 | Processo SIGADOC vencido, origem Ministério Público | 90 | Crítica |
| T3 | Operação, vence em 2 dias, 7 relatórios pendentes, coordenação | 68 | Alta |
| T4 | Processo SIGADOC, vence em 22 dias, dentro das férias, origem Poder Judiciário | 60 | Alta |
| T5 | Processo SIGADOC, vence em 1 dia, chefia | 55 | Alta |
| T6 | Reunião, vence em 5 dias, chefia | 35 | Média |
| T7 | Qualquer demanda concluída | — | fora da fila |
| T8 | Prazo vazio | — | erro de validação |
| T9 | Operação, prazo em 20 dias, origem própria, com 4 / 5 / 9 / 10 relatórios pendentes | 20 / 28 / 28 / 35 | Baixa / Média / Média / Média |
| T10 | Reunião, origem própria, prazo em 7 dias e em 8 dias | 25 / 10 | Média / Baixa |
| T11 | Processo, origem ouvidoria, prazo 2026-11-06, afastamento de 2026-11-01 a 2026-11-05 | 30 | Média |
| T12 | Processo vencido há 5 dias, origem Ministério Público, status Aguardando (sobrestado) — também com prazo vazio | — | fora da fila (sobrestada) |
| T13 | O mesmo processo após voltar para "Em andamento" (prazo registrado mantido) | 90 | Crítica |

## Conferência do seed (hoje = 2026-10-15)

Os números abaixo, os casos T1–T13 e os indicadores de `docs/CRITERIOS_ACEITE.md` usam a **data de referência fixa 2026-10-15** (`hoje_referencia` no seed). O M1 deve aceitar uma **data de referência configurável**, com padrão igual à data de hoje; `priorizar(demanda, hoje)` já recebe a data como argumento e os testes sempre passam 2026-10-15.

| ID | Cálculo | Score | Faixa |
|---|---|---|---|
| DEM-0002 | vencida 50 + operação 20 + chefia 10 (3 pendentes: 0) | 80 | Crítica |
| DEM-0003 | vencido 50 + processo 15 + MP 25 | 90 | Crítica |
| DEM-0001 | 2 dias 30 + operação 20 + chefia 10 + 6 pendentes 8 | 68 | Alta |
| DEM-0004 | processo 15 + Judiciário 25 + férias 20 | 60 | Alta |
| DEM-0005 | 1 dia 30 + processo 15 + chefia 10 | 55 | Alta |
| DEM-0007 | 5 dias 15 + processo 15 + denúncia 10 | 40 | Média |
| DEM-0008 | 5 dias 15 + reunião 10 + chefia 10 | 35 | Média |
| DEM-0006 | status Aguardando: sobrestada, prazo suspenso | — | fora da fila |
| DEM-0010 | 7 dias 15 + palestra 5 | 20 | Baixa |
| DEM-0009 | reunião 10 | 10 | Baixa |
| DEM-0011 | — | 0 | Baixa |
| DEM-0012, DEM-0013 | concluídas | — | fora da fila |
