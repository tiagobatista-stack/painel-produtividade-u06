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

test('dados salvos antes dos campos novos abrem sem erro e são migrados (processo → protocolo, etapa, anotacoes)', () => {
  const antigo = {
    versao: 1,
    afastamentos: [],
    demandas: [
      { id: 'DEM-0001', tipo: 'processo', titulo: 'Salvo antes', origem: 'mp', status: 'a_fazer', prazo: '2026-10-20', criada_em: '2026-10-01', processo: 'SEMA-PRO-FICT-0007', etapa: 'aguardando_informacao', historico: [] },
      { id: 'DEM-0002', tipo: 'outra', titulo: 'Sem nada novo', origem: 'propria', status: 'a_fazer', prazo: '2026-10-25', criada_em: '2026-10-01', historico: [] },
    ],
  };
  const { dados, origem } = carregar(storageFalso({ [CHAVE]: JSON.stringify(antigo) }), seed);
  assert.equal(origem, 'armazenamento');
  assert.deepEqual([dados.demandas[0].protocolo, dados.demandas[0].etapa, 'processo' in dados.demandas[0]], ['SEMA-PRO-FICT-0007', 'triagem', false]);
  assert.deepEqual(dados.demandas.map((d) => d.anotacoes), [[], []]);
  // salvar e reabrir mantém o formato novo
  const storage = storageFalso();
  assert.equal(salvar(storage, dados), true);
  assert.deepEqual(carregar(storage, seed).dados.demandas, dados.demandas);
});

test('o exemplo carregado já vem migrado e sem alterar o seed', () => {
  const { dados } = carregar(storageFalso(), seed);
  assert.ok(dados.demandas.every((d) => Array.isArray(d.anotacoes) && !('processo' in d)));
  assert.equal(dados.demandas.find((d) => d.id === 'DEM-0003').etapa, 'parecer');
  assert.equal(dados.demandas.find((d) => d.id === 'DEM-0005').etapa, 'analise'); // era "despacho"
  assert.equal(dados.demandas.find((d) => d.id === 'DEM-0013').etapa, 'devolvido'); // era "concluido"
  assert.equal(seed.demandas.find((d) => d.id === 'DEM-0003').anotacoes.length, 3);
});
