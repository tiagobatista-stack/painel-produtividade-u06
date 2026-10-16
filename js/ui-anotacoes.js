// Caixa de anotações (o que já foi feito e o que está pendente), usada na demanda e em cada ponto da operação.
// O texto digitado e ainda não salvo (rascunho) sobrevive aos redesenhos da tela, que acontecem a cada alteração de dados.
import { elemento } from './ui-comum.js';

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
