// Férias e licença-prêmio: cadastro e avisos. Funções puras e imutáveis.
import { dataValida, diasEntre, estaConcluida, estaSobrestada, prazoDemanda, somarDias } from './indicadores.js';
import { ErroCadastro } from './demandas.js';
import { SITUACOES_AFASTAMENTO, TIPOS_AFASTAMENTO } from './rotulos.js';

export const JANELA_AVISO_DIAS = 30;

function normalizar(dados) {
  const erros = {};
  const limpo = { tipo: dados.tipo, inicio: String(dados.inicio ?? '').trim(), fim: String(dados.fim ?? '').trim(), situacao: dados.situacao };
  if (!(limpo.tipo in TIPOS_AFASTAMENTO)) erros.tipo = 'Escolha o tipo de afastamento.';
  if (!dataValida(limpo.inicio)) erros.inicio = 'Informe uma data de início válida.';
  if (!dataValida(limpo.fim)) erros.fim = 'Informe uma data de fim válida.';
  else if (dataValida(limpo.inicio) && limpo.fim < limpo.inicio) erros.fim = 'O fim não pode ser anterior ao início.';
  if (!(limpo.situacao in SITUACOES_AFASTAMENTO)) erros.situacao = 'Escolha a situação.';
  if (Object.keys(erros).length) throw new ErroCadastro(erros);
  return limpo;
}

export function proximoIdAfastamento(lista) {
  const maior = lista.reduce((max, a) => {
    const m = /^AFA-(\d+)$/.exec(a.id || '');
    return m ? Math.max(max, Number(m[1])) : max;
  }, 0);
  return `AFA-${String(maior + 1).padStart(4, '0')}`;
}

export function criarAfastamento(dados, existentes) {
  return { id: proximoIdAfastamento(existentes), ...normalizar(dados) };
}

export function editarAfastamento(original, dados) {
  return { ...original, ...normalizar(dados) };
}

export function removerAfastamento(lista, id) {
  return lista.filter((a) => a.id !== id);
}

export function ordenarAfastamentos(lista) {
  return [...lista].sort((a, b) => a.inicio.localeCompare(b.inicio) || a.id.localeCompare(b.id));
}

// Sobrestadas têm o prazo suspenso e ficam de fora dos avisos.
const abertas = (demandas) => demandas.filter((d) => !estaConcluida(d) && !estaSobrestada(d));

// Avisos de um afastamento: prazos que caem no período e viagens de operação que coincidem com ele.
// Afastamentos já encerrados (fim anterior a hoje) não geram aviso.
export function avisosAfastamento(afastamento, demandas, hoje) {
  if (afastamento.fim < hoje) return { prazos: [], viagens: [] };
  const prazos = [];
  const viagens = [];
  for (const d of abertas(demandas)) {
    const prazo = prazoDemanda(d);
    if (prazo !== null && prazo >= afastamento.inicio && prazo <= afastamento.fim) prazos.push({ demanda: d, prazo });
    if (d.tipo === 'operacao' && dataValida(d.saida) && dataValida(d.retorno) && d.saida <= afastamento.fim && d.retorno >= afastamento.inicio) {
      viagens.push({ demanda: d, saida: d.saida, retorno: d.retorno });
    }
  }
  prazos.sort((a, b) => a.prazo.localeCompare(b.prazo));
  return { prazos, viagens };
}

// Afastamentos que começam entre hoje e hoje + janela, em ordem de início.
export function afastamentosProximos(afastamentos, hoje, janela = JANELA_AVISO_DIAS) {
  const limite = somarDias(hoje, janela);
  return ordenarAfastamentos(afastamentos)
    .filter((a) => a.inicio >= hoje && a.inicio <= limite)
    .map((a) => ({ afastamento: a, dias: diasEntre(hoje, a.inicio) }));
}
