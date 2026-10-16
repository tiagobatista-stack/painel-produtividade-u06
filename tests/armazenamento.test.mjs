import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { carregar, salvar, CHAVE } from '../js/armazenamento.js';
import { criarDemanda } from '../js/demandas.js';

const seed = JSON.parse(readFileSync(new URL('../data/seed.json', import.meta.url), 'utf8'));

function storageFalso(inicial = {}) {
  const dados = { ...inicial };
  return { dados, getItem: (k) => dados[k] ?? null, setItem: (k, v) => { dados[k] = v; } };
}

test('primeira abertura carrega o exemplo (RF13), sem alterar o seed', () => {
  const { dados, origem } = carregar(storageFalso(), seed);
  assert.equal(origem, 'seed');
  assert.equal(dados.demandas.length, 13);
  assert.equal(dados.afastamentos.length, 2);
  dados.demandas.pop();
  assert.equal(seed.demandas.length, 13);
});

test('salvar e recarregar mantém as alterações', () => {
  const storage = storageFalso();
  const { dados } = carregar(storage, seed);
  dados.demandas.push(criarDemanda({ tipo: 'outra', titulo: 'Nova', origem: 'propria', prazo: '2026-10-25', status: 'a_fazer' }, dados.demandas, '2026-10-15'));
  assert.equal(salvar(storage, dados), true);
  const de_novo = carregar(storage, seed);
  assert.equal(de_novo.origem, 'armazenamento');
  assert.equal(de_novo.dados.demandas.length, 14);
  assert.equal(de_novo.dados.demandas.at(-1).id, 'DEM-0014');
  assert.ok(storage.dados[CHAVE].includes('"versao":1'));
});

test('JSON corrompido ou formato desconhecido cai no exemplo', () => {
  for (const ruim of ['{nao é json', '{"versao":2,"demandas":[],"afastamentos":[]}', '{"versao":1,"demandas":"x"}', 'null']) {
    const { origem, dados } = carregar(storageFalso({ [CHAVE]: ruim }), seed);
    assert.equal(origem, 'seed', ruim);
    assert.equal(dados.demandas.length, 13);
  }
});

test('storage indisponível: carregar usa o exemplo e salvar devolve false', () => {
  const quebrado = { getItem() { throw new Error('bloqueado'); }, setItem() { throw new Error('cheio'); } };
  assert.equal(carregar(quebrado, seed).origem, 'seed');
  assert.equal(carregar(null, seed).origem, 'seed');
  assert.equal(salvar(quebrado, { demandas: [], afastamentos: [] }), false);
});
