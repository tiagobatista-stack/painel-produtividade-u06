// Visão em quadro (Kanban): colunas por status, faixas por classe de serviço, limite de itens em andamento e mover cards.
// Só apresenta o resultado de js/quadro.js; o status muda pelo mesmo caminho do painel lateral (mudarStatus, do app.js).
import {
  CLASSES, LIMITE_MAX, LIMITE_MIN, LIMITE_PADRAO, montarQuadro, movimentosPermitidos, podeArrastar, podeMoverPara, rotuloDaColuna,
  tempoAteConcluir, tempoMedioAteConcluir, vazaoSemanal,
} from './quadro.js';
import { $, elemento, estado, formatarData } from './ui-comum.js';
import { cartao } from './ui-cartao.js';
import { botaoSobrestamento } from './ui-operacao.js';

const CHAVE_VISAO = 'painel-demandas:visao';
const CHAVE_LIMITE = 'painel-demandas:limite';
const numero = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

let visao = 'lista';
let limite = LIMITE_PADRAO;
let idArrastando = null;
let mudarStatus = () => false;

function ler(chave) {
  try {
    return estado.storage?.getItem(chave) ?? null;
  } catch {
    return null;
  }
}

function gravar(chave, valor) {
  try {
    estado.storage?.setItem(chave, valor);
  } catch {
    // preferência de tela: sem armazenamento ela só vale até recarregar
  }
}

export const visaoAtual = () => visao;

// Troca entre Lista e Quadro e lembra a escolha no navegador. A tela é redesenhada por quem chamou.
export function definirVisao(nova) {
  visao = nova === 'quadro' ? 'quadro' : 'lista';
  gravar(CHAVE_VISAO, visao);
}

function limiteValido(valor) {
  const n = Number(valor);
  return Number.isInteger(n) && n >= LIMITE_MIN && n <= LIMITE_MAX ? n : null;
}

function cabecalhoDaColuna(coluna) {
  const cab = elemento('div', 'quadro-cab');
  cab.dataset.coluna = coluna.chave;
  const titulo = elemento('h3', '', coluna.rotulo);
  const contagem = elemento('span', 'quadro-contagem', coluna.limite === undefined ? String(coluna.total) : `${coluna.total}/${coluna.limite}`);
  cab.append(titulo, contagem);
  if (coluna.limite !== undefined) {
    const campo = elemento('label', 'quadro-limite', 'Limite ');
    const entrada = elemento('input');
    entrada.type = 'number';
    entrada.min = String(LIMITE_MIN);
    entrada.max = String(LIMITE_MAX);
    entrada.value = String(coluna.limite);
    entrada.dataset.foco = 'quadro-limite';
    entrada.addEventListener('change', () => {
      const novo = limiteValido(entrada.value);
      if (novo !== null) {
        limite = novo;
        gravar(CHAVE_LIMITE, String(novo));
      }
      estado.focoApos = 'quadro-limite';
      estado.atualizar();
    });
    campo.append(entrada);
    cab.append(campo);
    if (coluna.acimaDoLimite) {
      cab.classList.add('acima-do-limite');
      cab.append(elemento('p', 'quadro-aviso', `Acima do limite: ${coluna.total} em andamento (limite ${coluna.limite}).`));
    }
  }
  return cab;
}

function acoesDoCartao(item) {
  const { demanda: d } = item;
  const acoes = elemento('div', 'quadro-acoes');
  if (item.concluida) {
    const dias = tempoAteConcluir(d);
    if (dias !== null) acoes.append(elemento('span', 'quadro-idade', `Concluída em ${dias} ${dias === 1 ? 'dia' : 'dias'}`));
    return acoes;
  }
  if (item.idade !== null) acoes.append(elemento('span', 'quadro-idade', item.idade === 0 ? 'Parado desde hoje' : `Parado há ${item.idade} ${item.idade === 1 ? 'dia' : 'dias'}`));
  if (d.tipo === 'operacao') {
    acoes.append(botaoSobrestamento(d));
    return acoes;
  }
  for (const { rotulo, para } of movimentosPermitidos(d)) {
    const botao = elemento('button', '', rotulo);
    botao.type = 'button';
    botao.setAttribute('aria-label', `${rotulo}: ${d.titulo}`);
    botao.addEventListener('click', () => mover(d, para));
    acoes.append(botao);
  }
  return acoes;
}

function mover(demanda, para) {
  if (!podeMoverPara(demanda, para)) return;
  if (mudarStatus(demanda.id, para, `abrir-${demanda.id}`)) $('quadro-anuncio').textContent = `${demanda.id} movida para ${rotuloDaColuna(para)}.`;
}

function cartaoDoQuadro(item, hoje) {
  const li = cartao(item, hoje);
  li.classList.add('quadro-cartao');
  li.append(acoesDoCartao(item));
  if (podeArrastar(item.demanda)) {
    li.draggable = true;
    li.querySelector('.demanda-abrir').draggable = true; // o botão ocupa quase todo o card e, sem isto, o navegador não inicia o arrasto a partir dele
    li.addEventListener('dragstart', (e) => {
      idArrastando = item.demanda.id;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', idArrastando);
      li.classList.add('arrastando');
    });
    li.addEventListener('dragend', () => {
      idArrastando = null;
      li.classList.remove('arrastando');
      for (const c of document.querySelectorAll('.quadro-celula.alvo')) c.classList.remove('alvo');
    });
  }
  return li;
}

function demandaArrastada() {
  return estado.dados.demandas.find((d) => d.id === idArrastando) ?? null;
}

function celula(chaveColuna, rotuloColuna, rotuloClasse, itens, hoje) {
  const lista = elemento('ul', 'quadro-celula');
  lista.dataset.coluna = chaveColuna;
  lista.setAttribute('aria-label', `${rotuloColuna}, faixa ${rotuloClasse}`);
  lista.append(...itens.map((item) => cartaoDoQuadro(item, hoje)));
  lista.addEventListener('dragover', (e) => {
    const d = demandaArrastada();
    if (!d || !podeMoverPara(d, chaveColuna)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    lista.classList.add('alvo');
  });
  lista.addEventListener('dragleave', () => lista.classList.remove('alvo'));
  lista.addEventListener('drop', (e) => {
    e.preventDefault();
    lista.classList.remove('alvo');
    const d = demandaArrastada();
    idArrastando = null;
    if (d && podeMoverPara(d, chaveColuna)) mover(d, chaveColuna);
  });
  return lista;
}

function metricas(hoje) {
  const demandas = estado.dados.demandas;
  const medio = tempoMedioAteConcluir(demandas);
  const vazao = vazaoSemanal(demandas, hoje).map((s) => `${formatarData(s.inicio).slice(0, 5)}: ${s.total}`).join(' · ');
  return `Tempo médio até concluir: ${medio === null ? 'sem concluídas' : `${numero.format(medio)} dias`}. Concluídas por semana (últimas 4, a partir de segunda): ${vazao}.`;
}

export function desenharQuadro(hoje) {
  const emQuadro = visao === 'quadro';
  $('visao-lista').hidden = emQuadro;
  $('visao-quadro').hidden = !emQuadro;
  $('botao-visao-lista').setAttribute('aria-pressed', String(!emQuadro));
  $('botao-visao-quadro').setAttribute('aria-pressed', String(emQuadro));
  if (!emQuadro) return;

  const { colunas } = montarQuadro(estado.dados.demandas, hoje, { afastamentos: estado.dados.afastamentos }, { limite });
  const grade = $('quadro-grade');
  const filhos = colunas.map(cabecalhoDaColuna);
  for (const classe of CLASSES) {
    const porColuna = colunas.map((c) => c.itens.filter((x) => x.classe === classe.chave));
    if (porColuna.every((itens) => itens.length === 0)) continue;
    filhos.push(elemento('h3', 'quadro-faixa', classe.rotulo));
    colunas.forEach((c, i) => filhos.push(celula(c.chave, c.rotulo, classe.rotulo, porColuna[i], hoje)));
  }
  grade.replaceChildren(...filhos);
  $('quadro-vazio').hidden = colunas.some((c) => c.total > 0);
  $('quadro-metricas').textContent = metricas(hoje);
}

// `funcoes.mudarStatus(id, status, focoApos)` devolve true quando a mudança foi aceita.
export function iniciarQuadro(funcoes) {
  mudarStatus = funcoes.mudarStatus;
  visao = ler(CHAVE_VISAO) === 'quadro' ? 'quadro' : 'lista';
  limite = limiteValido(ler(CHAVE_LIMITE)) ?? LIMITE_PADRAO;
  for (const [id, nome] of [['botao-visao-lista', 'lista'], ['botao-visao-quadro', 'quadro']]) {
    $(id).addEventListener('click', () => {
      definirVisao(nome);
      estado.focoApos = id;
      estado.atualizar();
    });
  }
}
