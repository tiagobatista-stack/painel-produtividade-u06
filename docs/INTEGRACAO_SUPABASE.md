# Integração com o Supabase (S3–S7)

> **Situação: PLANEJADO.** Nada deste documento está implementado. Nenhuma chave, URL de projeto ou dado real aparece aqui; `<ref-do-projeto>` é um marcador. Cada etapa vira um PR próprio, com plano → OK → PR, e só começa com o OK do responsável.

## Por que integrar

O painel está se tornando uma plataforma de apoio ao analista: recebe demandas de várias fontes (gabinete, chefia, MP, Judiciário, operações de alerta, licenciamento) e acompanha cada uma do recebimento até a finalização, cruzando processos com dados de campo (pontos, vistorias) e com camadas públicas do Geoportal da SEMA. Hoje tudo vive no `localStorage` de um navegador (`js/armazenamento.js`). Um banco PostgreSQL com PostGIS permite histórico central, trilha de condução auditável, consultas espaciais e acesso por mais de um dispositivo.

**Escopo deste documento:** S3 a S7. As etapas anteriores ainda não foram aprovadas; a **proposta** (a confirmar na pergunta 1) é:
- **S1:** `supabase init` (cria `supabase/`) e projeto de laboratório.
- **S2:** migração com as tabelas base `demandas`, `pontos`, `anotacoes`, `afastamentos` e `parametros`, mais seed fictício gerado de `data/seed.json`. O esquema de cada tabela (colunas, tipos, chaves) é desenhado em S2, a partir dos campos de `js/demandas.js` e `js/pontos.js`; `anotacoes` e `pontos` ligam-se à demanda por `demanda_id`.

S3 só começa depois que S1 e S2 estiverem aprovadas.

**Dados:** só fictícios, num projeto Supabase de laboratório. Dado real exige autorização da SEMA e um cenário próprio na matriz de governança.

---

## 1. Princípios e convenções (valem para S3–S7)

### 1.1 Portabilidade
- Só **PostgreSQL + PostGIS padrão**. Nada que prenda o projeto à Supabase além do cliente `supabase-js` e do Auth (que fica atrás da camada de armazenamento).
- Toda mudança de esquema **só por migração versionada** em `supabase/migrations/`. Nada de alterar tabela pelo painel web.
- O app **só acessa dados pela camada `js/armazenamento.js`**. Nenhum módulo de interface chama o Supabase direto. `js/regras.js` continua puro e é a única fonte das regras de prioridade (não se duplica em SQL).

### 1.2 Fluxo de trabalho
- Banco local com a **Supabase CLI** (`supabase start`, exige Docker Desktop). Testes de banco rodam contra ele.
- Na integração GitHub da Supabase, **"Deploy to production" continua DESLIGADO** até OK explícito do responsável.
- **Dados sempre fictícios** fora de uso autorizado. O seed do banco é gerado do mesmo `data/seed.json` fictício.
- Chaves: a chave **pública** (publishable/anon) só como variável de ambiente; a chave **secreta** (`service_role`, `sb_secret_…`) nunca no navegador, no repositório nem no build.

### 1.3 Convenções das migrações (prompts oficiais da Supabase)
Referência: <https://supabase.com/docs/guides/ai-tools/ai-prompts>.

**Arquivos**
- Nome `supabase/migrations/YYYYMMDDHHmmss_descricao.sql`, com horário em **UTC**.
- Comentário de cabeçalho: propósito, tabelas afetadas, observações.
- SQL em **minúsculas**. Comandos destrutivos (`drop`, `truncate`, `alter … drop column`) com **comentário extenso** explicando o motivo e o efeito.

**RLS**
- **RLS ligado em toda tabela nova**, inclusive as de dado público (`municipios_mt`).
- Políticas **separadas por operação** (`select`, `insert`, `update`, `delete`) e **por papel** (`anon`, `authenticated`); **nunca `for all`**.
- `select` e `delete` só com `using`; `insert` só com `with check`; `update` com `using` **e** `with check`.
- `auth.uid()` sempre como `(select auth.uid())` (avaliado uma vez por consulta).
- **Índice** em toda coluna usada por política (`responsavel_id`, `demanda_id`…).
- Nomes descritivos entre aspas (`"analista lê as próprias demandas"`). Preferir políticas **permissive**.

**Funções**
- `security invoker` por padrão; `security definer` só com justificativa escrita no próprio arquivo.
- `set search_path = ''` e nomes totalmente qualificados (`public.demandas`, `extensions.st_contains`…).
- `immutable` ou `stable` sempre que possível (`stable` quando a função lê tabela).

**Estilo**
- `snake_case`; tabelas no **plural**, colunas no **singular**; chave estrangeira `<tabela_no_singular>_id` (`demanda_id`, `fonte_id`).
- `comment on table` em todas as tabelas; schema explícito nas consultas (`public.`, `auth.`, `extensions.`).

### 1.4 Decisão: migrações versionadas × esquema declarativo
| | Migrações versionadas (escritas à mão) | Esquema declarativo (`supabase/schemas` → `supabase db diff`) |
|---|---|---|
| Como funciona | Cada mudança é um `.sql` novo em `supabase/migrations` | O estado desejado fica em `supabase/schemas/*.sql`; a CLI gera a migração pela diferença; também existe o comando experimental `supabase db schema declarative sync` (pg-delta, `[experimental.pgdelta]` no `config.toml`) |
| Prós | Simples, explícito, revisável linha a linha; nada experimental; casa com a regra "toda mudança por migração" | Uma "fonte" legível do esquema atual; menos SQL repetido em `alter` |
| Contras | Para ver o esquema atual é preciso ler várias migrações (ou `supabase db dump`) | Ferramenta em mudança (migra → pg-delta, parte experimental); DML (carga de dados) e alguns objetos ainda pedem migração manual; a migração gerada precisa de revisão do mesmo jeito |

**Recomendação (PLANEJADO):** **migrações versionadas escritas à mão** em S3–S7, com `supabase db dump --schema public` gerando uma cópia de referência do esquema só para leitura. Reavaliar o fluxo declarativo quando o pg-delta sair do modo experimental.

### 1.5 Prompts oficiais no repositório
Recomendação (não criar agora): guardar cópias dos prompts oficiais da Supabase (funções, RLS, migrações, estilo SQL, esquema declarativo) em `docs/supabase-prompts/`, com a **data e a URL de origem** no topo de cada arquivo, e citar a pasta no `CLAUDE.md` para o agente segui-las. Revisar as cópias a cada etapa, porque a documentação muda.

---

## 2. S3 — Adaptador Supabase, `config.json` no build, CSP e `vendor/supabase-js` — PLANEJADO

**Objetivo.** Permitir que o painel guarde os dados no Supabase sem mudar a interface, mantendo o modo local como padrão.

**O que muda (arquivos previstos).**
- `js/armazenamento.js`: interface única **assíncrona** com dois adaptadores.
  - `local`: `localStorage` como hoje, embrulhado em `Promise` (mesma chave `painel-demandas:v1`, mesma migração `migrarDemanda`). Hoje as funções recebem o `storage` como parâmetro (`carregar(storage, seed, contexto)`, `salvar(storage, dados)`), o que permite testar com storage falso; o adaptador `local` mantém esse parâmetro e o `supabase` recebe o cliente da mesma forma.
  - `supabase`: usa `supabase-js` e grava **por registro** (demanda, ponto, anotação, afastamento), não o blob inteiro.
  - Operações previstas: `carregar()`, `salvar(dados)` (compatibilidade), `listarDemandas()`, `salvarDemanda(d)`, `removerDemanda(id)`, `salvarAfastamento(a)`, `removerAfastamento(id)`.
- `js/app.js` (`iniciar`) e `js/ui-comum.js` (`persistir`): passam a usar `await`.
- `scripts/build.mjs`: gera `public/data/config.json` a partir de variáveis de ambiente.
- `vercel.json`: CSP.
- `vendor/supabase-js/`: build UMD em versão fixa + `LICENSE`.
- Testes novos ou ajustados (ver abaixo).

**Decisões.**
- **Impacto do síncrono → assíncrono:**
  - `carregar` e `persistir` hoje retornam na hora. Com o adaptador, viram `Promise`, e todos os chamadores de `persistir()` (salvar, editar, desfazer, importar planilha, anotações) passam a tratar a resposta.
  - A interface atualiza na hora (gravação otimista) e mostra aviso se a gravação falhar.
  - Os testes unitários de `armazenamento` passam a usar `await`. Os módulos puros (`regras`, `demandas`, `pontos`…) não mudam.
  - O e2e continua em modo `local`.
- **`config.json`:** `{ "armazenamento": "local" | "supabase", "supabaseUrl": "...", "supabaseChavePublica": "..." }`.
  - Variáveis de ambiente previstas: `PAINEL_ARMAZENAMENTO`, `SUPABASE_URL`, `SUPABASE_CHAVE_PUBLICA`. Sem variável, o modo é `local`.
  - O arquivo **não é versionado**: só existe em `public/`.
- **O build falha** se detectar chave secreta: prefixo `sb_secret_`, ou JWT legado cujo payload tenha `role` igual a `service_role`, ou nome de variável com `service_role`/`secret`. A mensagem de erro **não** imprime o valor.
- **A Vercel** publica com o modo definido pela variável. **Produção continua `local`** até OK do responsável. Os previews podem usar o projeto de laboratório.
- **CSP:** `connect-src 'self' https://<ref-do-projeto>.supabase.co` (sem `wss://`: Realtime fora do escopo); `script-src 'self'` continua igual.
  - Como o `vercel.json` é estático, o ref entra no arquivo quando o projeto existir. O PR de S3 decide se ele vai fixo ou se a CSP é gerada no build.
- **Sem rede ou com erro do Supabase:** mensagem clara ("Não foi possível falar com o banco. Nada foi salvo."). **Nenhuma troca silenciosa para o modo local**: dados não podem se dividir entre dois lugares sem o usuário saber.

**Riscos e segurança.**
- Vazamento de chave secreta → bloqueio no build + grep no CI.
- Chave pública exposta é esperado, mas só é segura com **RLS em todas as tabelas** (S4).
- Biblioteca de terceiros → versão fixa, `LICENSE` junto, sem CDN.
- Concorrência: duas abas gravando a mesma demanda → regra "a última gravação vence", registrada; controle de versão fica para depois.

**Testes.**
- *Unitários:* adaptador `local` com storage falso, com os mesmos casos de hoje; adaptador `supabase` com cliente falso (sem rede); build gera `config.json` padrão `local`; build **falha** com cada formato de chave secreta; `vendor/supabase-js` tem versão esperada e `LICENSE`.
- *E2E:* todos os atuais em modo `local` continuam verdes; `08-seguranca` confere a CSP nova e que, em modo `local`, nenhuma requisição sai para `*.supabase.co`.
- *Banco local:* teste opcional (`supabase start`) que carrega o seed fictício e lê pelo adaptador.

**Critério de aceite.** Modo `local` idêntico ao atual (todos os testes verdes); modo `supabase` lê e grava no banco local; build recusa chave secreta; CSP só libera `https://<ref-do-projeto>.supabase.co`; produção segue em `local`.

**Fora desta etapa.** Auth (S4); Realtime; sincronização offline; produção em modo `supabase`.

---

## 3. S4 — Auth por link mágico e `responsavel_id` — PLANEJADO

**Objetivo.** Cada analista entra com o próprio e-mail e só vê e altera as próprias demandas.

**O que muda (arquivos previstos).**
- `supabase/migrations/…_responsavel_e_politicas.sql`.
- `js/armazenamento.js` (sessão no adaptador `supabase`); tela de entrar/sair (`index.html`, `js/ui-*.js`, `css/`).
- `supabase/config.toml` (Auth local).
- Testes.

**Decisões.**
- **Login:** e-mail com **link mágico**, sem senha; botão **Sair**.
  - URLs de redirecionamento permitidas: a de produção, o padrão dos previews da Vercel e `http://localhost:<porta>` do `npm start`. Configurado no painel da Supabase (Authentication → URL Configuration) e em `supabase/config.toml` para o local.
- **Cadastro aberto DESLIGADO:** só usuários convidados (Authentication → Users → Invite) ou lista de e-mails permitidos.
  - Painel: Authentication → Sign In / Providers, desligar "Allow new users to sign up". Local: `[auth] enable_signup = false` no `config.toml`.
  - **Limites de envio de e-mail:** o SMTP embutido do plano tem limite baixo por hora, próprio para teste. Conferir o valor atual em Authentication → Rate Limits e, se for preciso, configurar SMTP próprio. Nenhuma credencial de SMTP vai ao repositório.
- **Coluna `responsavel_id`:** `uuid references auth.users(id)`, `default (select auth.uid())`, `not null`, com índice, nas tabelas de dados (`demandas`, `afastamentos`). Tabelas filhas (`pontos`, `anotacoes`) herdam o acesso pela `demanda_id`.
- **Políticas** para `authenticated`, uma por operação, limitadas a `responsavel_id = (select auth.uid())`. `anon` **sem nenhuma política** nas tabelas de demanda (acesso negado).
- **Migração única dos dados locais:** o usuário exporta o JSON do modo local e importa na conta logada.
  - Cada registro recebe `responsavel_id` da sessão.
  - É idempotente pelo `id` (`DEM-xxxx`), com prévia antes de gravar.

**Riscos e segurança.**
- Política errada expõe dados de outro analista → teste de RLS com dois usuários.
- Link mágico em e-mail encaminhado → validade curta do link (configuração do Auth).
- Redirecionamento aberto → lista fechada de URLs.

**Testes.**
- *Unitários:* fluxo de sessão no adaptador com cliente falso; importação do JSON (prévia, idempotência, atribuição de responsável).
- *E2E:* modo `local` sem login (como hoje); com banco local, entrar com link mágico pelo Inbucket/Mailpit da CLI, sair, e tela sem dados quando não logado.
- *Banco local:* usuários fictícios A e B. A não lê, não altera e não apaga as demandas de B; `anon` não lê nada; `insert` com `responsavel_id` de outro usuário é recusado.

**Critério de aceite.** Só convidados entram; cada um vê só o que é seu (provado pelo teste com dois usuários); `anon` sem acesso; importação do JSON local funciona sem duplicar.

**Fora desta etapa.** Compartilhamento por equipe ou regional. **Desenho futuro:**
- tabela `regionais` e `membros_regionais` (`regional_id`, `usuario_id`, `papel`: analista, coordenação);
- `demandas.regional_id`;
- políticas de `select` para membros da mesma regional, e de `update` só para o responsável ou a coordenação;
- tudo com índices nas colunas das políticas.

---

## 4. S5 — `municipios_mt` e RPC de município pela coordenada (RF49) — PLANEJADO

**Objetivo.** Descobrir o município de uma coordenada no banco, usando limites oficiais públicos.

**O que muda (arquivos previstos).**
- `supabase/migrations/…_municipios_mt.sql` (tabela, índice, RLS, função).
- `scripts/carregar-municipios-mt.mjs` (carga dos limites, roda localmente).
- `docs/MUNICIPIOS_MT.md` (seção da carga).
- `js/armazenamento.js` (chamada da RPC no modo `supabase`).
- Testes.

**Decisões.**
- **Tabela `public.municipios_mt`:** `codigo_ibge text unique not null`, `nome text not null`, `geom geometry(MultiPolygon,4674) not null` (SIRGAS 2000, **simplificada**), `fonte text`, `extraido_em date`; índice **GIST** em `geom`.
- **Origem dos limites:** malha municipal do IBGE e/ou `Geoportal:LIM_MUNICIPIOS_MT`.
  - A camada do Geoportal exige authkey, que só o responsável tem. O script roda localmente com `SEMA_AUTHKEY` (como `scripts/gerar-municipios-mt.mjs`) e grava a fonte e a data de extração.
  - A conferência atual com o Geoportal está `nao_executada` (`docs/MUNICIPIOS_MT.md`).
- **Como os dados entram:** por **script de carga documentado** (ou migração de dados), **não** pelo seed de exemplo.
  - Motivo: é dado de referência público e oficial, não exemplo fictício. Precisa existir em todos os ambientes, tem fonte e data próprias, e não deve ser apagado nem trocado quando o seed fictício muda.
  - O script decide a tolerância de simplificação e registra o número de municípios lidos.
- **RLS:** ligado. Uma política de `select` para `anon` e outra para `authenticated` (dado geográfico público). **Nenhuma** política de `insert`, `update` ou `delete`: a carga é feita pelo script com acesso administrativo local, nunca pela API do navegador.
- **Função:**
  ```sql
  create or replace function public.municipio_por_coordenada(lat double precision, lon double precision)
  returns table (codigo_ibge text, nome text)
  language sql
  stable
  security invoker
  set search_path = ''
  as $$
    select m.codigo_ibge, m.nome
    from public.municipios_mt as m
    where extensions.st_contains(
      m.geom,
      extensions.st_setsrid(extensions.st_makepoint(lon, lat), 4674)
    );
  $$;
  ```
  - Atenção à ordem: `st_makepoint(x, y)` recebe **longitude primeiro**. No painel, `coord_x` é a longitude (O) e `coord_y` a latitude (S).
  - Ponto fora de MT retorna conjunto vazio. Ponto exatamente na divisa pode cair em dois municípios ou em nenhum: o app trata 0 ou 2+ resultados como "não identificado, informe".
- **App:** chama a RPC **só no modo `supabase`**. O modo local continua com a solução em JavaScript prevista no RF49 (GeoJSON simplificado em `data/`, ainda não implementada).

**Riscos e segurança.**
- Geometria simplificada demais erra perto da divisa → tolerância documentada e teste com ponto perto da divisa.
- A authkey da SEMA nunca vai ao repositório nem ao banco.
- Inversão lat/lon → teste dedicado.

**Testes.**
- *Banco local:*
  - um ponto conhecido dentro de um município retorna o `codigo_ibge` esperado;
  - um ponto fora de MT retorna vazio;
  - lat/lon invertidos não retornam o mesmo município;
  - `anon` lê `municipios_mt`; `anon` e `authenticated` não inserem, não alteram e não apagam.
  - Pontos de teste: coordenadas de sedes municipais públicas ou centroides calculados, nunca coordenada de caso real.
- *Unitários:* adaptador chama a RPC com parâmetros na ordem certa (cliente falso).
- *E2E:* em modo `local`, nenhuma chamada à RPC.

**Critério de aceite.** RPC responde corretamente nos casos de teste; RLS só de leitura comprovada; carga documentada com fonte, data e contagem.

**Fora desta etapa.** Camadas WMS da SEMA (RF65); proximidade e roteiros; outras camadas vetoriais no banco.

---

## 5. S6 — `eventos` (trilha de condução) e `fontes` (ingestão de várias origens) — PLANEJADO

**Objetivo.** Registrar tudo o que acontece com uma demanda, do recebimento à finalização, e importar demandas e pontos de várias origens sem duplicar.

**O que muda (arquivos previstos).**
- `supabase/migrations/…_eventos.sql`, `…_fontes_e_lotes.sql`.
- `js/armazenamento.js`.
- Tela de importação com prévia (`js/ui-*.js`, reaproveitando `js/planilha.js`).
- Relatórios (`js/resumo.js`, `js/indicadores.js`).
- Testes.

**Decisões.**
- **Tabela `public.eventos`, só de acréscimo:** `id bigint generated always as identity`, `demanda_id` (FK, índice), `tipo text` (`criada`, `status`, `etapa`, `vistoria`, `anotacao`, `ajuste_prioridade`…), `autor_id uuid default (select auth.uid())`, `ocorrido_em timestamptz default now()`, `dados jsonb`.
  - Políticas **só de `select` e `insert`** para `authenticated`, nenhuma de `update` nem de `delete`.
  - `insert` com `with check`: autor = usuário atual e demanda do próprio usuário.
- **Gatilho em `public.demandas`** (`after insert or update`) registra mudanças relevantes: status, etapa, prazo, responsável.
  - A função do gatilho é `security invoker`, então passa pela política de `insert` acima.
  - Se for preciso `security definer` (por exemplo, para impedir eventos forjados pela API), a justificativa vai escrita na migração.
- **Uso:** a trilha substitui o campo `historico` e alimenta relatórios e a lavratura (datas de relatório e de auto).
- **Tabela `public.fontes`:** `manual`, `planilha_coordenacao`, `importacao_json`, `geoportal`… (`id`, `codigo` único, `nome`, `descricao`).
- **`demandas` e `pontos`** ganham `fonte_id` + `chave_externa`, com `unique (fonte_id, chave_externa)`. A reimportação faz **upsert idempotente** (mesma chave → atualiza, nunca duplica).
- **Tabela `public.lotes_ingestao`:** `fonte_id`, `nome_arquivo`, `hash_arquivo` (SHA-256), `linhas_lidas`, `linhas_aceitas`, `linhas_rejeitadas`, `autor_id`, `criado_em`, `situacao` (`previa`, `confirmado`, `descartado`).
- **Importação em duas fases:** (1) **prévia**: lê, valida, mostra aceitas e rejeitadas com motivo, sem gravar demandas; (2) **confirmação**: grava e registra o lote. Mesmo hash já confirmado → aviso.
- **Explícito:** **não há integração automática com o SIGADOC nem com outros sistemas da SEMA.** Só importações manuais de arquivos autorizados.

**Riscos e segurança.**
- A trilha precisa ser confiável → sem `update`/`delete`, testado.
- Planilha pode trazer dado sigiloso (cenário C3 da matriz) → no laboratório, só fictício.
- Conteúdo importado é dado não confiável (sem executar nada que venha nele).
- Crescimento da tabela `eventos` → índice por `demanda_id, ocorrido_em`.

**Testes.**
- *Banco local:*
  - `update` e `delete` em `eventos` recusados para `authenticated`;
  - o gatilho grava evento ao mudar status ou etapa;
  - usuário A não lê eventos das demandas de B;
  - reimportar o mesmo arquivo não duplica (contagem igual);
  - `unique (fonte_id, chave_externa)` respeitado.
- *Unitários:* validação da prévia (linhas aceitas e rejeitadas com motivo), cálculo do hash, montagem do upsert.
- *E2E:* importação com prévia → confirmação (banco local); modo `local` continua importando como hoje.

**Critério de aceite.** Cada mudança relevante gera um evento imutável; reimportação idempotente comprovada; lote registrado com contagens; nenhuma integração automática.

**Fora desta etapa.** Integração com SIGADOC ou APIs da SEMA; importação agendada; notificações.

---

## 6. S7 — MCP lendo do Supabase (somente leitura, só com autorização) — PLANEJADO

**Objetivo.** Permitir que o agente consulte os dados do banco para resumos e relatórios, sem poder escrever.

**O que muda (arquivos previstos).**
- `docs/MCP.md`; possivelmente `tools/demandas-mcp.mjs` e `tools/teste-mcp.mjs` (opção b).
- `docs/MATRIZ_GOVERNANCA.csv` (cenário novo, via `npm run matriz`).
- Nenhum registro de MCP sem OK.

**Decisões: comparação.**
| | (a) MCP oficial da Supabase | (b) Estender o `demandas-lab` |
|---|---|---|
| Como | Servidor hospedado `https://mcp.supabase.com/mcp?project_ref=<ref-do-projeto>&read_only=true` (opcional `&features=database,docs`). Autenticação por OAuth no navegador, sem token pessoal | O `tools/demandas-mcp.mjs` lê pela API REST da Supabase com a **sessão do usuário** (JWT) e a chave pública |
| Somente leitura | `read_only=true` executa as consultas com um usuário Postgres somente leitura; `project_ref` restringe a um projeto e desliga as ferramentas de conta (conferido na documentação oficial: <https://supabase.com/docs/guides/getting-started/mcp>) | Garantido pelo código (só `select`) **e** pela RLS, que vale para o JWT do usuário |
| RLS | O papel somente leitura **não** passa pelas políticas por usuário: enxerga todas as linhas do projeto | Vale integralmente: o agente vê só o que o analista vê |
| Ferramentas | SQL livre de leitura, docs, logs | Só as ferramentas do domínio (`listar_regras`, `priorizar_demanda`, `resumo_operacao` + leitura de demandas) |
| Prós | Pronto, mantido pela Supabase | Superfície mínima, regras de prioridade de `js/regras.js` reaproveitadas, RLS por usuário |
| Contras | Superfície maior; enxerga o projeto inteiro | Código a manter; gestão do JWT local |

**Recomendação (PLANEJADO):**
- **(b)** para uso de rotina, porque respeita a RLS por usuário e expõe só o domínio.
- **(a)** só no projeto de **laboratório**, com `read_only=true`, `project_ref` e `features` mínimas, para diagnóstico de esquema.

**Regras.**
- Nunca usar `service_role`.
- Acesso só por papel somente leitura (a) ou JWT do usuário com RLS (b).
- Registro apenas com `claude mcp add --scope local`, e só com OK do responsável.
- Nenhuma ferramenta de escrita. Aprovação manual das chamadas de ferramenta continua ligada.

**Riscos e segurança.**
- **Prompt injection:** títulos, anotações, observações e qualquer texto vindo do banco são **dado não confiável**. O agente não executa instruções contidas neles (mesma regra de `docs/CONTEUDO_EXTERNO_NAO_CONFIAVEL.md`), e o teste de conteúdo externo ganha casos com texto malicioso vindo do banco.
- **Dados reais:** só com autorização da SEMA. Adicionar à matriz de governança o cenário "agente consulta o banco via MCP somente leitura" (dado, ambiente, autonomia leitura, aprovação, controle, evidência).

**Testes.**
- *Unitários:* `npm run mcp:test` com cliente falso: nenhuma ferramenta escreve, e texto malicioso nos dados não muda o comportamento.
- *Banco local:* (b) com JWT do usuário A não retorna dados de B.
- *Manual:* (a) no laboratório, conferir que um `insert` é recusado no modo `read_only`.

**Critério de aceite.** Leitura funciona; escrita impossível (comprovada); RLS vale na opção (b); cenário na matriz; registro só após OK.

**Fora desta etapa.** Qualquer escrita via MCP; uso em produção com dado real sem autorização.

---

## 7. Resumo S3–S7

| Etapa | Depende de | Ordem | PR previsto | Riscos principais |
|---|---|---|---|---|
| S3 Adaptador + config + CSP + vendor | S1–S2 (a confirmar) | 1ª | `feat/armazenamento-supabase` | Chave secreta vazar; regressão do modo local na mudança para assíncrono |
| S4 Auth + `responsavel_id` | S3 | 2ª | `feat/auth-link-magico` | RLS errada expor dados; redirecionamento aberto; limite de e-mail |
| S5 `municipios_mt` + RPC | S3 (RLS de leitura independe de S4) | 3ª (pode correr junto com S4) | `feat/municipio-por-coordenada` | Inversão lat/lon; simplificação na divisa; authkey |
| S6 `eventos` + `fontes` + lotes | S4 (autor e RLS) | 4ª | `feat/trilha-e-ingestao` | Trilha adulterável; duplicação na reimportação; dado sigiloso em planilha |
| S7 MCP leitura | S4 (JWT); S6 para relatórios completos | 5ª | `docs/mcp-supabase` (+ código se opção b) | Prompt injection; visão ampla na opção (a); uso com dado real |

## 8. Perguntas abertas

1. **S1 e S2:** o que exatamente cobrem? (Sugestão: S1 = criar `supabase/` com `supabase init` e o projeto de laboratório; S2 = tabelas base `demandas`, `pontos`, `anotacoes`, `afastamentos`, `parametros` + seed fictício gerado de `data/seed.json`.) Devem ser documentadas aqui também?
2. **Região e plano** do projeto de laboratório (sugestão: `sa-east-1`, plano gratuito)?
3. **CSP:** fixar o ref no `vercel.json` ou gerar a CSP no build a partir da variável?
4. **Previews da Vercel** podem usar o modo `supabase` com o projeto de laboratório?
5. **Convites:** quem pode convidar usuários? SMTP próprio desde já ou o embutido no laboratório?
6. **Limites municipais:** IBGE, Geoportal ou os dois (com conferência)? Qual tolerância de simplificação é aceitável?
7. **`historico` atual:** migrar para `eventos` na importação ou começar a trilha do zero?
8. **Fluxo de esquema:** confirma migrações versionadas à mão (recomendado) em vez do esquema declarativo?
9. **Prompts oficiais:** guardar as cópias em `docs/supabase-prompts/` e citar no `CLAUDE.md`?
10. **MCP:** confirma a opção (b) para rotina e a (a) só no laboratório?
