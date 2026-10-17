// Leitura da planilha da operação colada pelo analista (texto copiado do Excel). Função pura.
// Colunas: N_PONTO, EQUIPE, COORD_X, COORD_Y, MUNICIPIO, DAT_SAIDA, DAT_RETOR, NOT_PLANEJ.
import { MENSAGEM_COORDENADA, lerNumero } from './coordenadas.js';
import { dataValida } from './indicadores.js';

const COLUNAS = ['N_PONTO', 'EQUIPE', 'COORD_X', 'COORD_Y', 'MUNICIPIO', 'DAT_SAIDA', 'DAT_RETOR', 'NOT_PLANEJ'];
const OBRIGATORIAS = ['N_PONTO', 'EQUIPE', 'MUNICIPIO', 'DAT_SAIDA', 'DAT_RETOR'];
const MAX_PONTOS = 200;
const MAX_NOTA = 200;

const chave = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').trim().toUpperCase().replace(/[\s-]+/g, '_');

// Divide o texto em linhas e células. Aceita tab, ponto e vírgula ou vírgula, e células entre aspas.
function tabular(texto) {
  const primeira = texto.split(/\r?\n/).find((l) => l.trim() !== '') ?? '';
  const sep = primeira.includes('\t') ? '\t' : primeira.includes(';') ? ';' : ',';
  const linhas = [];
  let linha = [];
  let celula = '';
  let aspas = false;
  const fechaLinha = () => {
    linha.push(celula);
    celula = '';
    if (linha.some((c) => c.trim() !== '')) linhas.push(linha);
    linha = [];
  };
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) {
      if (c === '"' && texto[i + 1] === '"') { celula += '"'; i++; }
      else if (c === '"') aspas = false;
      else celula += c;
    } else if (c === '"' && celula === '') aspas = true;
    else if (c === sep) { linha.push(celula); celula = ''; }
    else if (c === '\n') fechaLinha();
    else if (c !== '\r') celula += c;
  }
  fechaLinha();
  return linhas;
}

export function lerData(valor) {
  const v = String(valor ?? '').trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) {
    m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(v);
    if (m) m = [null, m[3], m[2].padStart(2, '0'), m[1].padStart(2, '0')];
  }
  if (!m) return null;
  const iso = `${m[1]}-${m[2]}-${m[3]}`;
  return dataValida(iso) ? iso : null;
}

// Retorna { ok, erros: [{ linha, campo, mensagem }], operacao?: { equipe, saida, retorno, pontos, municipios } }
export function lerPlanilha(texto) {
  const erros = [];
  const erro = (linha, campo, mensagem) => erros.push({ linha, campo, mensagem });
  // O Excel grava CSV em UTF-8 com BOM; ele não faz parte do cabeçalho.
  const linhas = tabular(String(texto ?? '').replace(/^\uFEFF/, ''));
  if (linhas.length === 0) return { ok: false, erros: [{ linha: 0, campo: null, mensagem: 'Cole as linhas da planilha.' }] };

  const nomes = linhas[0].map(chave);
  const temCabecalho = COLUNAS.filter((c) => nomes.includes(c)).length >= 4;
  let indice;
  let dados;
  let primeiraLinha;
  if (temCabecalho) {
    indice = Object.fromEntries(COLUNAS.map((c) => [c, nomes.indexOf(c)]));
    const faltam = OBRIGATORIAS.filter((c) => indice[c] < 0);
    if (faltam.length) return { ok: false, erros: [{ linha: 1, campo: null, mensagem: `Faltam as colunas: ${faltam.join(', ')}.` }] };
    dados = linhas.slice(1);
    primeiraLinha = 2;
  } else {
    if (linhas[0].length < 7) {
      return { ok: false, erros: [{ linha: 1, campo: null, mensagem: 'Sem cabeçalho, a linha precisa ter as 8 colunas na ordem N_PONTO a NOT_PLANEJ.' }] };
    }
    indice = Object.fromEntries(COLUNAS.map((c, i) => [c, i]));
    dados = linhas;
    primeiraLinha = 1;
  }
  if (dados.length === 0) return { ok: false, erros: [{ linha: 0, campo: null, mensagem: 'A planilha não tem linhas de pontos.' }] };
  if (dados.length > MAX_PONTOS) return { ok: false, erros: [{ linha: 0, campo: null, mensagem: `Máximo de ${MAX_PONTOS} pontos por operação.` }] };

  const cel = (l, nome) => (indice[nome] >= 0 ? String(l[indice[nome]] ?? '').trim() : '');
  const pontos = [];
  const vistos = new Set();
  let ref = null;

  dados.forEach((l, i) => {
    const n = primeiraLinha + i;
    const numero = Number(cel(l, 'N_PONTO'));
    if (!Number.isInteger(numero) || numero < 1) erro(n, 'N_PONTO', 'N_PONTO deve ser um número inteiro maior que zero.');
    else if (vistos.has(numero)) erro(n, 'N_PONTO', `Ponto ${numero} repetido.`);
    else vistos.add(numero);

    const equipe = cel(l, 'EQUIPE');
    if (!equipe) erro(n, 'EQUIPE', 'Informe a equipe.');
    const municipio = cel(l, 'MUNICIPIO');
    if (!municipio) erro(n, 'MUNICIPIO', 'Informe o município.');
    const saida = lerData(cel(l, 'DAT_SAIDA'));
    if (!saida) erro(n, 'DAT_SAIDA', 'DAT_SAIDA inválida (use dd/mm/aaaa ou aaaa-mm-dd).');
    const retorno = lerData(cel(l, 'DAT_RETOR'));
    if (!retorno) erro(n, 'DAT_RETOR', 'DAT_RETOR inválida (use dd/mm/aaaa ou aaaa-mm-dd).');
    if (saida && retorno && retorno < saida) erro(n, 'DAT_RETOR', 'O retorno é anterior à saída.');

    const x = lerNumero(cel(l, 'COORD_X'), 'x');
    const y = lerNumero(cel(l, 'COORD_Y'), 'y');
    if (x.invalido) erro(n, 'COORD_X', MENSAGEM_COORDENADA('COORD_X', 'E ou W'));
    if (y.invalido) erro(n, 'COORD_Y', MENSAGEM_COORDENADA('COORD_Y', 'N ou S'));

    if (equipe && saida && retorno) {
      if (!ref) ref = { equipe, saida, retorno, n };
      else {
        if (chave(equipe) !== chave(ref.equipe)) erro(n, 'EQUIPE', `Equipe diferente da linha ${ref.n}. Cole uma operação por vez.`);
        if (saida !== ref.saida) erro(n, 'DAT_SAIDA', `Saída diferente da linha ${ref.n}. Cole uma operação por vez.`);
        if (retorno !== ref.retorno) erro(n, 'DAT_RETOR', `Retorno diferente da linha ${ref.n}. Cole uma operação por vez.`);
      }
    }
    pontos.push({
      n: numero,
      coord_x: x.valor ?? null,
      coord_y: y.valor ?? null,
      municipio,
      nota: cel(l, 'NOT_PLANEJ').slice(0, MAX_NOTA),
    });
  });

  if (erros.length) return { ok: false, erros };
  const municipios = [...new Set(pontos.map((p) => p.municipio))];
  return { ok: true, erros: [], operacao: { equipe: ref.equipe, saida: ref.saida, retorno: ref.retorno, pontos, municipios } };
}
