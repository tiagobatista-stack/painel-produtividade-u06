// Interface das anotações: editor no formulário, lista marcável no painel da demanda e caixa de texto do ponto da operação.
// O texto das anotações entra sempre por textContent (via `elemento`), nunca como HTML.
import {
  ErroAnotacao, TEXTO_MAX, adicionarAnotacoes, alternarAnotacao, contarAnotacoes, desfazerRemocao, editarAnotacao, ordenarAnotacoes, removerAnotacao,
} from './anotacoes.js';
import { alternarAnotacaoDaDemanda } from './demandas.js';
import { $, elemento, estado, hojeAtual, persistir } from './ui-comum.js';

const TEMPO_DESFAZER_MS = 5000;

// ---------- Editor no formulário ----------

export function criarEditorAnotacoes() {
  const lista = $('f-anotacoes-lista');
  const campoNovo = $('f-anotacao-nova');
  const erro = $('e-anotacoes');
  const aviso = $('f-anotacoes-desfazer');
  const mostrarConcluidas = $('f-mostrar-concluidas');

  let itens = [];
  let editandoId = null;
  let desfazer = null; // { removida, indice, temporizador }

  const focarItem = (id, seletor = 'input[type="checkbox"]') => lista.querySelector(`[data-id="${id}"] ${seletor}`)?.focus();

  function limparAviso() {
    if (desfazer) clearTimeout(desfazer.temporizador);
    desfazer = null;
    aviso.hidden = true;
    aviso.replaceChildren();
  }

  function desenhar() {
    const { feitas } = contarAnotacoes(itens);
    // A opção só faz sentido quando há anotação concluída; sem nenhuma, some (e volta a mostrar tudo).
    mostrarConcluidas.parentElement.hidden = feitas === 0;
    if (feitas === 0) mostrarConcluidas.checked = true;
    mostrarConcluidas.parentElement.lastChild.textContent = ` Mostrar concluídas (${feitas})`;
    const visiveis = ordenarAnotacoes(itens).filter((a) => mostrarConcluidas.checked || !a.feita);
    lista.replaceChildren(...visiveis.map(itemDaLista));
  }

  function itemDaLista(a) {
    const li = elemento('li', `anotacao${a.feita ? ' feita' : ''}`);
    li.dataset.id = a.id;

    const caixa = elemento('input');
    caixa.type = 'checkbox';
    caixa.checked = a.feita;
    caixa.setAttribute('aria-label', a.texto);
    caixa.addEventListener('change', () => {
      itens = alternarAnotacao(itens, a.id, hojeAtual());
      desenhar();
      focarItem(a.id);
    });

    let texto;
    if (editandoId === a.id) {
      texto = elemento('input', 'anotacao-edicao');
      texto.value = a.texto;
      texto.maxLength = TEXTO_MAX;
      texto.setAttribute('aria-label', `Editar anotação: ${a.texto}`);
      texto.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); concluirEdicao(a.id, texto.value); }
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancelarEdicao(a.id); }
      });
      texto.addEventListener('blur', () => { if (editandoId === a.id) concluirEdicao(a.id, texto.value); });
    } else {
      texto = elemento('button', 'anotacao-texto', a.texto);
      texto.type = 'button';
      texto.title = 'Clique para editar';
      texto.addEventListener('click', () => {
        editandoId = a.id;
        desenhar();
        const campo = lista.querySelector(`[data-id="${a.id}"] .anotacao-edicao`);
        campo?.focus();
        campo?.select();
      });
    }

    const remover = elemento('button', 'remover', '×');
    remover.type = 'button';
    remover.setAttribute('aria-label', `Remover anotação: ${a.texto}`);
    remover.addEventListener('click', () => removerItem(a.id));

    li.append(caixa, texto, remover);
    return li;
  }

  function concluirEdicao(id, valor) {
    erro.textContent = '';
    try {
      itens = editarAnotacao(itens, id, valor);
    } catch (e) {
      if (!(e instanceof ErroAnotacao)) throw e;
      erro.textContent = e.message;
    }
    editandoId = null;
    desenhar();
    focarItem(id, '.anotacao-texto');
  }

  function cancelarEdicao(id) {
    editandoId = null;
    desenhar();
    focarItem(id, '.anotacao-texto');
  }

  function removerItem(id) {
    const r = removerAnotacao(itens, id);
    if (!r.removida) return;
    itens = r.lista;
    limparAviso();
    const botao = elemento('button', '', 'Desfazer');
    botao.type = 'button';
    botao.addEventListener('click', () => {
      itens = desfazerRemocao(itens, desfazer.removida, desfazer.indice);
      const id = desfazer.removida.id;
      limparAviso();
      desenhar();
      focarItem(id);
    });
    aviso.append(elemento('span', '', 'Anotação removida.'), botao);
    aviso.hidden = false;
    desfazer = { removida: r.removida, indice: r.indice, temporizador: setTimeout(limparAviso, TEMPO_DESFAZER_MS) };
    desenhar();
    campoNovo.focus();
  }

  function adicionar(texto) {
    erro.textContent = '';
    try {
      itens = adicionarAnotacoes(itens, texto, hojeAtual());
    } catch (e) {
      if (!(e instanceof ErroAnotacao)) throw e;
      erro.textContent = e.message;
      return false;
    }
    campoNovo.value = '';
    desenhar();
    return true;
  }

  campoNovo.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault(); // Enter inclui a anotação; não envia o formulário
    adicionar(campoNovo.value);
  });
  campoNovo.addEventListener('paste', (e) => {
    const colado = e.clipboardData?.getData('text') ?? '';
    if (!/[\r\n]/.test(colado)) return;
    e.preventDefault();
    adicionar(colado);
  });
  $('f-anotacao-add').addEventListener('click', () => {
    adicionar(campoNovo.value);
    campoNovo.focus();
  });
  mostrarConcluidas.addEventListener('change', desenhar);

  return {
    carregar(lista_) {
      itens = lista_.map((a) => ({ ...a }));
      editandoId = null;
      campoNovo.value = '';
      erro.textContent = '';
      mostrarConcluidas.checked = true;
      limparAviso();
      desenhar();
    },
    // Texto digitado e ainda não incluído vira anotação ao salvar. Se não puder (muito longo, ou lista cheia), o texto fica na caixa,
    // a mensagem aparece e `erro` vem preenchido: quem salva precisa parar, para o texto não se perder.
    concluirPendente() {
      if (!campoNovo.value.trim()) return { adicionadas: 0 };
      const antes = itens.length;
      if (!adicionar(campoNovo.value)) return { adicionadas: 0, erro: erro.textContent };
      return { adicionadas: itens.length - antes };
    },
    obter: () => itens,
    editando: () => editandoId !== null,
    cancelarEdicaoAtual() { if (editandoId !== null) cancelarEdicao(editandoId); },
    encerrar: limparAviso,
  };
}

// ---------- Lista marcável no cartão ----------

export function blocoAnotacoes(d) {
  const lista = ordenarAnotacoes(d.anotacoes ?? []);
  if (!lista.length) return null;
  const { feitas, total } = contarAnotacoes(lista);
  const detalhes = elemento('details', 'motivos anotacoes-cartao');
  detalhes.open = estado.anotacoesAbertas.has(d.id);
  detalhes.addEventListener('toggle', () => {
    if (detalhes.open) estado.anotacoesAbertas.add(d.id);
    else estado.anotacoesAbertas.delete(d.id);
  });
  const ul = elemento('ul');
  for (const a of lista) {
    const li = elemento('li');
    const rotulo = elemento('label', `anotacao-cartao${a.feita ? ' feita' : ''}`);
    const caixa = elemento('input');
    caixa.type = 'checkbox';
    caixa.checked = a.feita;
    caixa.dataset.foco = `anotacao-${d.id}-${a.id}`;
    caixa.addEventListener('change', () => {
      const i = estado.dados.demandas.findIndex((x) => x.id === d.id);
      estado.dados.demandas[i] = alternarAnotacaoDaDemanda(estado.dados.demandas[i], a.id, hojeAtual());
      persistir();
      estado.anotacoesAbertas.add(d.id);
      estado.focoApos = caixa.dataset.foco;
      estado.atualizar();
    });
    rotulo.append(caixa, elemento('span', '', a.texto));
    li.append(rotulo);
    ul.append(li);
  }
  detalhes.append(elemento('summary', '', `Anotações ${feitas}/${total}`), ul);
  return detalhes;
}

// ---------- Caixa de texto livre (anotação de cada ponto da operação) ----------
// O que já foi feito e o que está pendente.
// O texto digitado e ainda não salvo (rascunho) sobrevive aos redesenhos da tela, que acontecem a cada alteração de dados.
const rascunhos = new Map(); // chave -> texto digitado e não salvo
const recemSalvas = new Set(); // chaves que mostram "Anotações salvas." uma vez, depois do redesenho

const normalizar = (texto) => texto.replaceAll('\r\n', '\n').trim();

// chave: identifica a caixa (ex.: "DEM-0003" ou "DEM-0001-p4"); `idCampo` do textarea é `anotacao-${chave}` e vai em data-foco.
// aoSalvar(texto) devolve false se recusou (a caixa mantém o rascunho); salvar bem-sucedido apaga o rascunho.
export function caixaDeAnotacao({ chave, titulo, valor = '', max, linhas = 4, ajuda, aoSalvar, classe = 'anotacao' }) {
  const bloco = elemento('div', classe);
  const idCampo = `anotacao-${chave}`;
  const rotulo = elemento('label', 'rotulo-anotacao', titulo);
  rotulo.htmlFor = idCampo;

  const area = elemento('textarea');
  area.id = idCampo;
  area.dataset.foco = idCampo;
  area.rows = linhas;
  area.maxLength = max;
  area.setAttribute('aria-describedby', `${idCampo}-estado`);
  area.value = rascunhos.get(chave) ?? valor;

  const estado = elemento('p', 'nota anotacao-estado');
  estado.id = `${idCampo}-estado`;
  estado.setAttribute('aria-live', 'polite');
  const salvar = elemento('button', 'primario', 'Salvar anotações');
  salvar.type = 'button';
  salvar.setAttribute('aria-label', `Salvar ${titulo.toLowerCase()}`);

  const atualizar = () => {
    const mudou = normalizar(area.value) !== valor;
    salvar.disabled = !mudou;
    estado.textContent = mudou ? `Alterações ainda não salvas · ${area.value.length}/${max}` : `${area.value.length}/${max}`;
  };
  area.addEventListener('input', () => {
    rascunhos.set(chave, area.value);
    atualizar();
  });
  salvar.addEventListener('click', () => {
    // O redesenho acontece dentro de aoSalvar: o rascunho e o aviso "salvas" precisam estar ajustados antes dele.
    const rascunho = rascunhos.get(chave);
    rascunhos.delete(chave);
    recemSalvas.add(chave);
    if (aoSalvar(area.value) === false) {
      recemSalvas.delete(chave);
      if (rascunho !== undefined) rascunhos.set(chave, rascunho);
    }
  });
  atualizar();
  if (recemSalvas.delete(chave)) estado.textContent = `Anotações salvas · ${area.value.length}/${max}`;

  bloco.append(rotulo);
  if (ajuda) bloco.append(elemento('p', 'nota', ajuda));
  bloco.append(area, estado, salvar);
  return bloco;
}
