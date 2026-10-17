// Gera data/municipios-mt.json: municípios de Mato Grosso (nome oficial e código IBGE) a partir da API de localidades do IBGE.
// Dado geográfico público, sem dado pessoal. Rode quando quiser atualizar a lista (a extração fica registrada no arquivo):
//   node scripts/gerar-municipios-mt.mjs
//
// Conferência com o Geoportal da SEMA (camada Geoportal:LIM_MUNICIPIOS_MT, "Limites Municipais"): a camada só aparece no WFS
// com a authkey. A chave NUNCA fica no script nem no repositório: vem da variável de ambiente SEMA_AUTHKEY ou do arquivo local
// config.local.json ({ "authkey": "..." }, fora do Git). Sem chave, ou se o pedido falhar, a conferência é registrada como não
// executada, com o motivo e a data, e a lista do IBGE é gravada do mesmo jeito.
//   PowerShell:  $env:SEMA_AUTHKEY = "..."; node scripts/gerar-municipios-mt.mjs
//   node scripts/gerar-municipios-mt.mjs --sem-geoportal   (pula a conferência)
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SAIDA = join(RAIZ, 'data', 'municipios-mt.json');
const IBGE = 'https://servicodados.ibge.gov.br/api/v1/localidades/estados/51/municipios';
const GEOPORTAL = 'https://geo.sema.mt.gov.br/geoserver/ows';
const CAMADA = 'Geoportal:LIM_MUNICIPIOS_MT';
// Nomes de coluna que um campo de município costuma ter. Só são usados DEPOIS de registrar as colunas brutas do primeiro registro.
const CANDIDATOS_DO_CAMPO = ['nm_mun', 'nm_municip', 'nm_municipio', 'municipio', 'nome', 'name', 'nm_mun_', 'nomemun'];

const hoje = () => new Date().toISOString().slice(0, 10);
const semAcento = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[’‘´`]/g, "'").replace(/\s+/g, ' ').trim();
const ocultar = (texto, chave) => (chave ? texto.replaceAll(chave, '***') : texto); // a chave não vai para a tela nem para o arquivo

function lerChave() {
  if (process.env.SEMA_AUTHKEY?.trim()) return { chave: process.env.SEMA_AUTHKEY.trim(), origem: 'variável de ambiente SEMA_AUTHKEY' };
  const arquivo = join(RAIZ, 'config.local.json');
  if (existsSync(arquivo)) {
    try {
      const chave = JSON.parse(readFileSync(arquivo, 'utf8')).authkey;
      if (typeof chave === 'string' && chave.trim()) return { chave: chave.trim(), origem: 'config.local.json' };
    } catch {
      // arquivo ilegível: tratado como ausente
    }
  }
  return { chave: null, origem: null };
}

async function listaDoIbge() {
  const resposta = await fetch(IBGE, { signal: AbortSignal.timeout(60_000) });
  if (!resposta.ok) throw new Error(`IBGE respondeu HTTP ${resposta.status}`);
  const bruto = await resposta.json();
  const lista = bruto.map((m) => ({ codigo: Number(m.id), nome: String(m.nome).trim() })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  if (lista.length === 0) throw new Error('IBGE devolveu lista vazia');
  if (new Set(lista.map((m) => m.codigo)).size !== lista.length) throw new Error('códigos repetidos na resposta do IBGE');
  if (new Set(lista.map((m) => semAcento(m.nome))).size !== lista.length) throw new Error('nomes repetidos (ignorando caixa e acento) na resposta do IBGE');
  if (!lista.every((m) => /^51\d{5}$/.test(String(m.codigo)))) throw new Error('código fora do padrão de Mato Grosso (51xxxxx)');
  return lista;
}

async function conferirComGeoportal(lista, { chave, origem }) {
  const registro = { data: hoje(), camada: CAMADA };
  if (!chave) return { ...registro, status: 'nao_executada', motivo: 'sem authkey (defina SEMA_AUTHKEY ou crie config.local.json)' };
  const url = `${GEOPORTAL}?service=WFS&version=1.1.0&request=GetFeature&typeName=${encodeURIComponent(CAMADA)}&outputFormat=${encodeURIComponent('application/json')}&authkey=${encodeURIComponent(chave)}`;
  try {
    const resposta = await fetch(url, { signal: AbortSignal.timeout(120_000) });
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
    const geo = await resposta.json();
    const feicoes = geo.features ?? [];
    if (feicoes.length === 0) throw new Error('camada sem registros');
    // 1) Registrar as colunas brutas do primeiro registro, antes de assumir qual é o campo do município.
    const colunas = Object.keys(feicoes[0].properties ?? {});
    console.log(`Colunas brutas do primeiro registro (${origem}): ${JSON.stringify(colunas)}`);
    console.log(`Primeiro registro (propriedades): ${JSON.stringify(feicoes[0].properties)}`);
    // 2) Só então escolher o campo, por nome conhecido (sem diferenciar caixa); se nenhum servir, não assumir nada.
    const campo = colunas.find((c) => CANDIDATOS_DO_CAMPO.includes(c.toLowerCase()));
    if (!campo) return { ...registro, status: 'campo_nao_identificado', colunas, total: feicoes.length, motivo: 'nenhuma coluna com nome conhecido de município; confira as colunas registradas' };
    const nomes = feicoes.map((f) => String(f.properties[campo] ?? '').trim()).filter(Boolean);
    const chaveIbge = new Map(lista.map((m) => [semAcento(m.nome), m.nome]));
    const chaveGeo = new Map(nomes.map((n) => [semAcento(n), n]));
    const soNoIbge = [...chaveIbge].filter(([k]) => !chaveGeo.has(k)).map(([, n]) => n);
    const soNoGeoportal = [...chaveGeo].filter(([k]) => !chaveIbge.has(k)).map(([, n]) => n);
    return { ...registro, status: 'executada', campo, colunas, total: chaveGeo.size, registros: feicoes.length, so_no_ibge: soNoIbge, so_no_geoportal: soNoGeoportal };
  } catch (e) {
    return { ...registro, status: 'falhou', motivo: ocultar(String(e.message ?? e), chave) };
  }
}

const semGeoportal = process.argv.includes('--sem-geoportal');
const lista = await listaDoIbge();
const geoportal = semGeoportal
  ? { data: hoje(), camada: CAMADA, status: 'nao_executada', motivo: 'pulada por --sem-geoportal' }
  : await conferirComGeoportal(lista, lerChave());

const saida = {
  _aviso: 'Gerado por scripts/gerar-municipios-mt.mjs. Dado geográfico público (IBGE); sem dado pessoal. Não editar à mão.',
  fonte: IBGE,
  extraido_em: hoje(),
  total: lista.length,
  geoportal,
  municipios: lista,
};
writeFileSync(SAIDA, `${JSON.stringify(saida, null, 2)}\n`);
console.log(`IBGE: ${lista.length} municípios gravados em data/municipios-mt.json (extraído em ${saida.extraido_em}).`);
console.log(`Geoportal (${CAMADA}): ${geoportal.status}${geoportal.motivo ? ` — ${geoportal.motivo}` : ''}`);
if (geoportal.status === 'executada') {
  console.log(`  Geoportal: ${geoportal.total} municípios. Só no IBGE: ${JSON.stringify(geoportal.so_no_ibge)}. Só no Geoportal: ${JSON.stringify(geoportal.so_no_geoportal)}.`);
}
