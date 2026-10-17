// Municípios de Mato Grosso como SUGESTÃO: a lista (data/municipios-mt.json, do IBGE) ajuda a digitar e a padronizar o nome, mas
// o campo aceita qualquer texto. Só se troca o valor digitado quando ele corresponde a um município da lista ignorando caixa,
// acento e espaços ("juína" vira "Juína"); fora da lista o valor fica como foi digitado. Módulo puro, sem DOM.

// Chave de comparação: sem acento, sem caixa, apóstrofos iguais e espaços únicos ("Conquista D'Oeste" = "conquista d’oeste").
export function chaveDoMunicipio(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[’‘´`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

// `dados` é o conteúdo de data/municipios-mt.json. Devolve null se o formato não servir (a tela segue com texto livre).
export function criarIndiceDeMunicipios(dados) {
  const lista = dados?.municipios;
  if (!Array.isArray(lista) || lista.length === 0) return null;
  const nomes = lista.map((m) => (typeof m?.nome === 'string' ? m.nome.trim() : '')).filter(Boolean);
  if (nomes.length === 0) return null;
  return { nomes, porChave: new Map(nomes.map((n) => [chaveDoMunicipio(n), n])), total: nomes.length };
}

// Padroniza o nome. Sem índice (lista não carregada) só apara os espaços, como o campo sempre fez.
// Devolve { valor, naLista }: naLista é true/false com índice e valor preenchido; null sem índice ou sem valor.
export function normalizarMunicipio(valor, indice) {
  const texto = typeof valor === 'string' ? valor.replace(/\s+/g, ' ').trim() : '';
  if (!texto || !indice) return { valor: texto, naLista: null };
  const oficial = indice.porChave.get(chaveDoMunicipio(texto));
  return oficial ? { valor: oficial, naLista: true } : { valor: texto, naLista: false };
}
