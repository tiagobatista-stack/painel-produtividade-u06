// Persistência no navegador (localStorage). O storage é recebido por parâmetro para permitir testes sem navegador.
import { migrarDemanda } from './demandas.js';

export const CHAVE = 'painel-demandas:v1';

const copia = (x) => JSON.parse(JSON.stringify(x));

function formatoValido(d) {
  return d && d.versao === 1 && Array.isArray(d.demandas) && Array.isArray(d.afastamentos);
}

// Retorna { dados, origem } com origem 'armazenamento' ou 'seed' (primeira abertura, dado corrompido ou storage indisponível).
// `contexto.municipios` (opcional) é o índice de municípios: padroniza o nome nos dados carregados, sem mudar a versão do armazenamento.
export function carregar(storage, seed, contexto = {}) {
  const migrar = (demanda) => migrarDemanda(demanda, contexto);
  const padrao = { versao: 1, demandas: copia(seed.demandas).map(migrar), afastamentos: copia(seed.afastamentos) };
  try {
    const bruto = storage?.getItem(CHAVE);
    if (bruto) {
      const dados = JSON.parse(bruto);
      if (formatoValido(dados)) return { dados: { ...dados, demandas: dados.demandas.map(migrar) }, origem: 'armazenamento' };
    }
  } catch {
    // storage indisponível ou JSON corrompido: cai no exemplo
  }
  return { dados: padrao, origem: 'seed' };
}

// Retorna true se gravou; false se o storage está indisponível ou cheio.
export function salvar(storage, dados) {
  try {
    storage.setItem(CHAVE, JSON.stringify({ versao: 1, demandas: dados.demandas, afastamentos: dados.afastamentos }));
    return true;
  } catch {
    return false;
  }
}
