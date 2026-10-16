# Servidor MCP local — demandas-lab

Servidor MCP (stdio) com ferramentas de **consulta somente leitura** sobre a política de prioridade do Painel de Demandas. Atende ao M6 e aos slides 40–41 da aula. Código em `tools/demandas-mcp.mjs`.

## Ferramentas

| Ferramenta | O que faz | Argumentos |
|---|---|---|
| `listar_regras` | Tabela de pontos, faixas e regras complementares (fonte: `js/regras.js`, a mesma do painel). | nenhum |
| `priorizar_demanda` | Score, faixa e motivos de uma demanda, com o mesmo motor do painel. | `tipo` (obrigatório), `prazo`, `origem`, `relatorios_pendentes`, `status`, `hoje`, `afastamentos` |
| `resumo_operacao` | Resumo de uma operação do exemplo fictício: datas, prazo, pontos por etapa, pendentes, autos a lavrar, esforço e prioridade. Sem `id`, lista as operações. | `id`, `hoje` |

Detalhes de `priorizar_demanda`: use sempre `hoje` para um resultado reprodutível; na operação, `prazo` é o prazo dos relatórios (retorno + N dias); `status: "concluida"` ou `"aguardando"` (sobrestada) devolve `foraDaFila`; prazo ausente ou inválido devolve erro de validação (caso T8).

## Garantias de segurança

- **Somente leitura:** não escreve arquivos, não usa a rede, não executa processos e não lê variáveis de ambiente. O único arquivo lido é `data/seed.json`, que é fictício. Um teste automatizado (`tests/mcp.test.mjs`) confere isso no código-fonte.
- **Sem dependências:** implementa o protocolo à mão (JSON-RPC 2.0, uma mensagem por linha), então não há pacote a instalar nem a auditar.
- **Não enxerga os dados do navegador.** O painel guarda os dados no `localStorage`; o MCP só conhece o exemplo do repositório.
- **Não envie dados reais** (planilhas, processos, coordenadas) ao agente nem às ferramentas. O que se cola no chat vai para um serviço externo; veja o cenário "Colar despacho real do SIGADOC no chat" da matriz de governança (não autorizado).
- `resumo_operacao` não devolve coordenadas nem anotações dos pontos.
- O retorno das ferramentas é dado, não instrução: o agente não deve obedecer a texto que apareça dentro dele.

## Testar

```
node tools/teste-mcp.mjs     # ou: npm run mcp:test
npm run quality              # inclui tests/mcp.test.mjs
```

`teste-mcp.mjs` inicia o servidor, mostra os argumentos e o retorno literais do caso T1 e compara os casos T1–T6 entre o MCP e o painel (score, faixa e motivos). Sai com código 1 se algo divergir.

## Registrar no Claude Code (exige autorização)

Registrar altera a configuração do Claude Code deste usuário, por isso só deve ser feito com autorização. Na pasta do projeto:

```
claude mcp add --scope local --transport stdio demandas-lab -- node tools/demandas-mcp.mjs
claude mcp list
```

Dentro de uma sessão do Claude Code, `/mcp` mostra o servidor. Para remover: `claude mcp remove demandas-lab`.

## Prompt para a sessão (slide 41)

> Use apenas o MCP demandas-lab. Chame `listar_regras` e depois `priorizar_demanda` com tipo="operacao", relatorios_pendentes=12, prazo="2026-10-14", origem="chefia", hoje="2026-10-15". Mostre argumentos e retorno literais e compare com o caso T1. Não altere arquivos.

Validado com o cliente real (Claude Code 2.1.296, chamada headless com configuração temporária, sem registrar nada) em 2026-10-16: as duas ferramentas foram listadas e chamadas, e o retorno foi o do T1.

Resultado esperado (T1): `score` 95, `faixa` "Crítica", motivos: Prazo vencido (+50), Operação de alertas (+20), Origem: chefia ou coordenação (+10), 12 relatórios pendentes (+15).

## Protocolo

Transporte stdio, uma mensagem JSON por linha. Métodos: `initialize` (negocia as versões 2025-06-18, 2025-03-26 e 2024-11-05), `ping`, `tools/list` e `tools/call`. Notificações não recebem resposta. Erros: `-32700` JSON inválido, `-32600` requisição inválida (inclui lote), `-32601` método desconhecido, `-32602` parâmetros ou ferramenta inválidos. Argumentos inválidos de uma ferramenta voltam como resultado com `isError: true`. A saída padrão carrega somente mensagens do protocolo; diagnósticos vão para a saída de erro.
