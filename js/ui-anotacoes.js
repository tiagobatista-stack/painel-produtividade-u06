// Interface das anotações: editor dentro do formulário e lista marcável no cartão da fila.
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
    // Texto digitado e ainda não incluído também é guardado ao salvar, para não se perder.
    obter() {
      if (campoNovo.value.trim()) adicionar(campoNovo.value);
      return itens;
    },
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
