// Município: lista de MT (data/municipios-mt.json, do IBGE) como sugestão, normalização e migração. Dados fictícios nos casos de teste.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chaveDoMunicipio, criarIndiceDeMunicipios, normalizarMunicipio } from '../js/municipios.js';
import { criarDemanda, editarDemanda, migrarDemanda } from '../js/demandas.js';
import { carregar, CHAVE } from '../js/armazenamento.js';
import { lerPlanilha } from '../js/planilha.js';

const arquivo = JSON.parse(readFileSync(new URL('../data/municipios-mt.json', import.meta.url), 'utf8'));
const seed = JSON.parse(readFileSync(new URL('../data/seed.json', import.meta.url), 'utf8'));
const indice = criarIndiceDeMunicipios(arquivo);
const HOJE = '2026-10-15';

const outra = { tipo: 'outra', titulo: 'Tarefa de teste', origem: 'propria', prazo: '2026-10-25', status: 'a_fazer' };

// ---- O arquivo gerado pelo script ----

test('data/municipios-mt.json: estrutura, fonte e contagem vêm do próprio arquivo (nada de número fixo)', () => {
  assert.match(arquivo.fonte, /^https:\/\/servicodados\.ibge\.gov\.br\/api\/v1\/localidades\/estados\/51\/municipios$/);
  assert.match(arquivo.extraido_em, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(Number.isInteger(arquivo.total) && arquivo.total > 0, true);
  assert.equal(arquivo.municipios.length, arquivo.total, 'total coerente com a lista');
  assert.equal(indice.total, arquivo.total);
  assert.equal(indice.nomes.length, arquivo.total);
});

test('data/municipios-mt.json: códigos do IBGE de Mato Grosso, nomes únicos (mesmo sem caixa e acento) e em ordem alfabética', () => {
  const lista = arquivo.municipios;
  for (const m of lista) {
    assert.match(String(m.codigo), /^51\d{5}$/, m.nome);
    assert.equal(typeof m.nome, 'string');
    assert.equal(m.nome, m.nome.trim());
    assert.ok(m.nome.length > 0 && m.nome.length <= 60, m.nome);
  }
  assert.equal(new Set(lista.map((m) => m.codigo)).size, lista.length, 'códigos repetidos');
  assert.equal(new Set(lista.map((m) => chaveDoMunicipio(m.nome))).size, lista.length, 'nomes repetidos ignorando caixa e acento');
  const nomes = lista.map((m) => m.nome);
  assert.deepEqual(nomes, [...nomes].sort((a, b) => a.localeCompare(b, 'pt-BR')), 'ordem alfabética');
});

test('data/municipios-mt.json: conhece municípios de nome com acento, apóstrofo e o mais recente; sem nome fictício', () => {
  const nomes = new Set(arquivo.municipios.map((m) => m.nome));
  for (const nome of ['Cuiabá', 'Juína', 'Água Boa', 'Boa Esperança do Norte']) assert.ok(nomes.has(nome), nome);
  assert.ok(arquivo.municipios.some((m) => /D'Oeste/i.test(m.nome)), 'nome com apóstrofo');
  assert.equal([...nomes].some((n) => /fict/i.test(n)), false);
});

test('data/municipios-mt.json: a conferência com o Geoportal fica registrada, com data e motivo quando não rodou, sem a chave', () => {
  const g = arquivo.geoportal;
  assert.ok(['nao_executada', 'falhou', 'campo_nao_identificado', 'executada'].includes(g.status), g.status);
  assert.match(g.data, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(g.camada, 'Geoportal:LIM_MUNICIPIOS_MT');
  if (g.status !== 'executada') assert.ok(g.motivo, 'registrar por que não foi executada');
  assert.equal(/authkey=|[0-9a-f]{16,}/i.test(JSON.stringify(arquivo)), false, 'nenhuma chave no arquivo');
});

// ---- Normalização ----

test('a chave de comparação ignora caixa, acento, espaços e o tipo de apóstrofo', () => {
  assert.equal(chaveDoMunicipio('  JUÍNA '), 'juina');
  assert.equal(chaveDoMunicipio('Conquista D’Oeste'), chaveDoMunicipio("conquista d'oeste"));
  assert.equal(chaveDoMunicipio('Vila   Bela'), 'vila bela');
  assert.equal(chaveDoMunicipio(undefined), '');
});

test('só normaliza quando o valor combina com a lista ignorando caixa e acento', () => {
  assert.deepEqual(normalizarMunicipio('juína', indice), { valor: 'Juína', naLista: true });
  assert.deepEqual(normalizarMunicipio('JUINA', indice), { valor: 'Juína', naLista: true });
  assert.deepEqual(normalizarMunicipio('  cuiaba  ', indice), { valor: 'Cuiabá', naLista: true });
  assert.deepEqual(normalizarMunicipio('boa esperanca do norte', indice), { valor: 'Boa Esperança do Norte', naLista: true });
  const doeste = arquivo.municipios.find((m) => /D'Oeste/i.test(m.nome)).nome;
  assert.deepEqual(normalizarMunicipio(doeste.toLowerCase().replace("'", '’'), indice), { valor: doeste, naLista: true });
  assert.equal(normalizarMunicipio('Juína', indice).valor, 'Juína'); // já oficial: igual
});

test('fora da lista o valor é aceito como foi digitado (só com os espaços aparados) e marcado como fora da lista', () => {
  assert.deepEqual(normalizarMunicipio('Cidade Fictícia Alfa', indice), { valor: 'Cidade Fictícia Alfa', naLista: false });
  assert.deepEqual(normalizarMunicipio('  Município   Fictício A ', indice), { valor: 'Município Fictício A', naLista: false });
  assert.deepEqual(normalizarMunicipio('Cuiabá - MT', indice), { valor: 'Cuiabá - MT', naLista: false }); // não adivinha o que sobra
  assert.deepEqual(normalizarMunicipio('Juina do Norte', indice), { valor: 'Juina do Norte', naLista: false });
});

test('sem lista (não carregou) ou sem valor: nada é trocado e não há marcação', () => {
  assert.deepEqual(normalizarMunicipio('juína', null), { valor: 'juína', naLista: null });
  assert.deepEqual(normalizarMunicipio('juína', undefined), { valor: 'juína', naLista: null });
  assert.deepEqual(normalizarMunicipio('   ', indice), { valor: '', naLista: null });
  assert.deepEqual(normalizarMunicipio(undefined, indice), { valor: '', naLista: null });
  assert.deepEqual(normalizarMunicipio(42, indice), { valor: '', naLista: null });
});

test('o índice recusa formato que não serve (a tela segue com texto livre)', () => {
  for (const ruim of [null, undefined, {}, { municipios: [] }, { municipios: 'x' }, { municipios: [{ codigo: 1 }] }, { municipios: [null] }]) {
    assert.equal(criarIndiceDeMunicipios(ruim), null);
  }
});

// ---- Onde se aplica: cadastro, edição, migração, armazenamento e importação ----

test('cadastro e edição padronizam o município pela lista; sem lista, só apara', () => {
  const nova = criarDemanda({ ...outra, municipio: ' juína ' }, seed.demandas, HOJE, { municipios: indice });
  assert.equal(nova.municipio, 'Juína');
  assert.equal(criarDemanda({ ...outra, municipio: ' juína ' }, seed.demandas, HOJE).municipio, 'juína');
  assert.equal(criarDemanda({ ...outra, municipio: 'Cidade Fictícia Alfa' }, seed.demandas, HOJE, { municipios: indice }).municipio, 'Cidade Fictícia Alfa');
  const editada = editarDemanda(nova, { ...outra, municipio: 'CUIABA' }, HOJE, { municipios: indice });
  assert.equal(editada.municipio, 'Cuiabá');
  const vazia = editarDemanda(nova, { ...outra, municipio: '' }, HOJE, { municipios: indice });
  assert.equal('municipio' in vazia, false);
});

test('sem duplicatas por caixa e acento: três grafias viram um nome só', () => {
  const nomes = ['juína', 'JUINA', 'Juína'].map((municipio) => criarDemanda({ ...outra, municipio }, seed.demandas, HOJE, { municipios: indice }).municipio);
  assert.deepEqual([...new Set(nomes)], ['Juína']);
});

test('migração: padroniza o município da demanda e o dos pontos (e a lista de municípios da operação), sem mudar o resto', () => {
  const op = structuredClone(seed.demandas.find((d) => d.tipo === 'operacao'));
  op.pontos[0].municipio = 'juína';
  op.pontos[1].municipio = 'Juína';
  op.municipios = ['juína', 'Juína', 'Município Fictício B'];
  const m = migrarDemanda({ ...op, municipio: 'cuiabá' }, { municipios: indice });
  assert.equal(m.municipio, 'Cuiabá');
  assert.equal(m.pontos[0].municipio, 'Juína');
  assert.equal(m.pontos[1].municipio, 'Juína');
  assert.deepEqual(m.municipios, ['Juína', ...new Set(m.pontos.slice(2).map((p) => p.municipio))]);
  assert.deepEqual(m.pontos.slice(2), op.pontos.slice(2)); // pontos já corretos ou fictícios ficam iguais
  assert.equal(m.titulo, op.titulo);
  assert.deepEqual(migrarDemanda(m, { municipios: indice }), m, 'idempotente');
});

test('migração sem lista não troca nada, e `.map(migrarDemanda)` (que passa o índice do array) não a atrapalha', () => {
  const demandas = [{ ...seed.demandas[2], municipio: 'juína' }];
  assert.equal(demandas.map(migrarDemanda)[0].municipio, 'juína');
  assert.equal(migrarDemanda(demandas[0], { municipios: null }).municipio, 'juína');
  assert.equal(migrarDemanda(demandas[0], 0).municipio, 'juína');
});

test('o armazenamento padroniza o que estava salvo ao carregar; o exemplo fictício continua igual', () => {
  const salvos = structuredClone(seed.demandas);
  salvos.find((d) => d.id === 'DEM-0003').municipio = 'juína';
  const storage = { getItem: (k) => (k === CHAVE ? JSON.stringify({ versao: 1, demandas: salvos, afastamentos: seed.afastamentos }) : null) };
  const carga = carregar(storage, seed, { municipios: indice });
  assert.equal(carga.origem, 'armazenamento');
  assert.equal(carga.dados.demandas.find((d) => d.id === 'DEM-0003').municipio, 'Juína');
  const semLista = carregar(storage, seed);
  assert.equal(semLista.dados.demandas.find((d) => d.id === 'DEM-0003').municipio, 'juína');
  // Primeira abertura: o seed tem municípios fictícios, que não estão na lista e não mudam.
  const primeira = carregar({ getItem: () => null }, seed, { municipios: indice });
  assert.equal(primeira.origem, 'seed');
  assert.equal(primeira.dados.demandas.find((d) => d.id === 'DEM-0003').municipio, 'Cidade Fictícia Alfa');
  assert.equal(primeira.dados.demandas.find((d) => d.tipo === 'operacao').pontos[0].municipio, 'Município Fictício A');
});

test('a importação da planilha padroniza o município dos pontos; sem lista, fica como veio', () => {
  const tsv = [
    'N_PONTO\tEQUIPE\tCOORD_X\tCOORD_Y\tMUNICIPIO\tDAT_SAIDA\tDAT_RETOR\tNOT_PLANEJ',
    '1\tEquipe Fictícia\t-20,1\t-15,1\tjuína\t2026-11-09\t2026-11-13\tteste',
    '2\tEquipe Fictícia\t-20,2\t-15,2\tJUINA\t2026-11-09\t2026-11-13\tteste',
    '3\tEquipe Fictícia\t-20,3\t-15,3\tMunicípio Fictício A\t2026-11-09\t2026-11-13\tteste',
  ].join('\n');
  const com = lerPlanilha(tsv, { municipios: indice });
  assert.equal(com.ok, true);
  assert.deepEqual(com.operacao.pontos.map((p) => p.municipio), ['Juína', 'Juína', 'Município Fictício A']);
  assert.deepEqual(com.operacao.municipios, ['Juína', 'Município Fictício A']); // sem duplicata por caixa ou acento
  const sem = lerPlanilha(tsv);
  assert.deepEqual(sem.operacao.pontos.map((p) => p.municipio), ['juína', 'JUINA', 'Município Fictício A']);
});
