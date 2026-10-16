// Estado e utilitários de tela compartilhados pelos módulos de interface.
import { dataValida, diasEntre } from './indicadores.js';
import { salvar } from './armazenamento.js';

export const $ = (id) => document.getElementById(id);

// Estado único da aplicação. `atualizar` é definido por app.js.
export const estado = {
  seed: null,
  dados: null, // { versao, demandas, afastamentos }
  storage: null,
  focoApos: null, // valor de data-foco a restaurar depois de redesenhar
  pontosAbertos: new Set(), // operações com a lista de pontos aberta
  indicadorAberto: null, // chave do indicador com a lista aberta, ou null
  atualizar: () => {},
  irParaDemanda: () => {}, // leva ao cartão da demanda na fila; definido por app.js
};

export function hojeLocal() {
  return new Date().toLocaleDateString('en-CA');
}

export function hojeAtual() {
  const v = $('data-referencia').value;
  return dataValida(v) ? v : hojeLocal();
}

export function formatarData(iso) {
  if (!iso) return '—';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

export function textoPrazo(prazo, hoje) {
  if (prazo === null) return { texto: 'Sem prazo válido', vencida: false };
  const dias = diasEntre(hoje, prazo);
  if (dias < 0) return { texto: `${formatarData(prazo)} · vencida há ${-dias} ${dias === -1 ? 'dia' : 'dias'}`, vencida: true };
  if (dias === 0) return { texto: `${formatarData(prazo)} · vence hoje`, vencida: false };
  return { texto: `${formatarData(prazo)} · em ${dias} ${dias === 1 ? 'dia' : 'dias'}`, vencida: false };
}

export function elemento(tag, classe, texto) {
  const el = document.createElement(tag);
  if (classe) el.className = classe;
  if (texto !== undefined) el.textContent = texto;
  return el;
}

export function opcoes(select, pares, selecionado) {
  select.replaceChildren(...pares.map(([valor, rotulo]) => {
    const o = elemento('option', '', rotulo);
    o.value = valor;
    return o;
  }));
  if (selecionado !== undefined) select.value = selecionado;
}

export function mostrarAviso(mensagem) {
  const aviso = $('erro');
  aviso.textContent = mensagem;
  aviso.hidden = !mensagem;
}

let temporizador = null;
export function mostrarMensagem(mensagem) {
  const caixa = $('mensagem');
  caixa.textContent = mensagem;
  caixa.hidden = !mensagem;
  clearTimeout(temporizador);
  if (mensagem) temporizador = setTimeout(() => mostrarMensagem(''), 8000);
}

export function persistir() {
  if (!salvar(estado.storage, estado.dados)) {
    mostrarAviso('Não foi possível salvar no navegador. As alterações valem só até recarregar a página.');
  }
}

// Gestor de erros de formulário: mensagem ao lado do campo, resumo anunciado e foco no primeiro campo inválido.
export function criarGestorErros({ resumo, campos, idCampo, idErro }) {
  const limpar = () => {
    resumo.hidden = true;
    resumo.replaceChildren();
    for (const c of campos) {
      $(idErro(c)).textContent = '';
      const input = $(idCampo(c));
      input.removeAttribute('aria-invalid');
      input.removeAttribute('aria-describedby');
    }
  };
  const mostrar = (erros) => {
    limpar();
    const lista = elemento('ul');
    let primeiro = null;
    for (const c of campos.filter((x) => x in erros)) {
      $(idErro(c)).textContent = erros[c];
      const input = $(idCampo(c));
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', idErro(c));
      lista.append(elemento('li', '', erros[c]));
      primeiro ??= input;
    }
    const semCampo = Object.entries(erros).filter(([c]) => !campos.includes(c));
    for (const [, mensagem] of semCampo) lista.append(elemento('li', '', mensagem));
    resumo.append(elemento('strong', '', 'Corrija antes de salvar:'), lista);
    resumo.hidden = false;
    (primeiro && !primeiro.closest('[hidden]') ? primeiro : resumo).focus();
  };
  return { limpar, mostrar };
}

// Devolve o foco ao controle que o usuário acabou de usar. Se ele saiu da lista (ex.: a demanda foi
// concluída ou sobrestada e o filtro a esconde), o foco vai para o título da fila, e não se perde no corpo da página.
export function restaurarFoco() {
  if (estado.focoApos) {
    const alvo = document.querySelector(`[data-foco="${estado.focoApos}"]`) ?? $('titulo-fila');
    alvo.focus();
    estado.focoApos = null;
  }
}
