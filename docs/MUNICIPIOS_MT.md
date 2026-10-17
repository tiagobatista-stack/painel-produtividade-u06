# Municípios de Mato Grosso (lista de sugestão)

O campo **Município** do formulário de demanda sugere os municípios de Mato Grosso, para digitar menos e padronizar o nome. A lista é **só sugestão**: o campo aceita qualquer texto, e os nomes fictícios do exemplo (`Cidade Fictícia Alfa`, `Município Fictício A`…) continuam válidos.

## Fonte e extração

- **Fonte:** API de localidades do IBGE, `https://servicodados.ibge.gov.br/api/v1/localidades/estados/51/municipios` (nome oficial, com acento, e código IBGE de 7 dígitos).
- **Arquivo:** `data/municipios-mt.json`, gerado por `scripts/gerar-municipios-mt.mjs`. Dado geográfico público, sem dado pessoal (exceção prevista no `CLAUDE.md`).
- **Última extração:** 2026-10-17, com **142 municípios** (o IBGE já inclui Boa Esperança do Norte; bases mais antigas têm um a menos). O número vem do próprio arquivo (`total`): **não está fixado no código nem nos testes**, que conferem a coerência do arquivo (códigos `51xxxxx` únicos, nomes únicos ignorando caixa e acento, ordem alfabética, `total` igual ao tamanho da lista).
- **Para atualizar:** `node scripts/gerar-municipios-mt.mjs` (precisa de internet). O arquivo é regravado com a nova data, e as mudanças aparecem no diff do Git.

## Conferência com o Geoportal da SEMA

A camada `Geoportal:LIM_MUNICIPIOS_MT` ("Limites Municipais") só aparece no WFS **com a authkey**; o catálogo anônimo não a lista. Por isso o script confere com ela só quando recebe a chave, que **nunca** fica no script nem no repositório:

```
PowerShell:  $env:SEMA_AUTHKEY = "..."; node scripts/gerar-municipios-mt.mjs
ou, em arquivo local fora do Git (config.local.json, no .gitignore):  { "authkey": "..." }
```

O pedido é um `GetFeature` em `application/json`. **Antes de assumir qual coluna é o nome do município, o script imprime as colunas brutas do primeiro registro** e só então escolhe o campo por um nome conhecido; se nenhum servir, registra `campo_nao_identificado` com as colunas, sem adivinhar. As diferenças (nomes só no IBGE, nomes só no Geoportal, contagem) ficam registradas no bloco `geoportal` do próprio arquivo.

**Resultado atual:** `nao_executada` em 2026-10-17 (sem authkey (defina SEMA_AUTHKEY ou crie config.local.json)). Ou seja, **a conferência de nomes e contagem com o Geoportal ainda não foi feita**; rode o script com a chave para registrá-la.

## Como o campo usa a lista (regra "sugestão")

1. **Sugestões:** a caixa de texto abre a lista dos municípios e filtra enquanto se digita (`<datalist>` nativo, sem biblioteca).
2. **Normalização:** só quando o valor corresponde a um município da lista **ignorando caixa, acento e espaços** ("juína", "JUINA" → "Juína"). Fora da lista, o texto fica como foi digitado, só com os espaços aparados. Não se adivinha: "Cuiabá - MT" fica como está.
3. **Marcação:** fora da lista, o formulário mostra discretamente "fora da lista de MT" sob o campo (só no formulário; o painel lateral não marca).
4. **Onde se aplica:** ao salvar (cadastro e edição), ao confirmar o campo, ao importar a planilha (o município de cada ponto), e ao carregar dados já salvos no navegador (migração idempotente, sem mudar a versão do armazenamento). O mapa, o CSV e as buscas usam o nome padronizado; por isso "juína" e "Juína" não viram dois rótulos.
5. **Sem a lista** (arquivo não carregou, ou veio inválido): o campo continua texto livre, sem marcação e sem troca de nome.

Módulo: `js/municipios.js` (puro). Testes: `tests/municipios.test.mjs` e `tests/e2e/27-form-ajustes.spec.mjs`.
