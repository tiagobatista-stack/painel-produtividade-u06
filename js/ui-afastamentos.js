// Interface de férias, licença-prêmio e compensação, aviso de afastamento próximo e agenda dos próximos 7 dias.
import { agenda, DIAS_AGENDA } from './agenda.js';
import {
  afastamentosProximos, avisosAfastamento, criarAfastamento, editarAfastamento, ordenarAfastamentos, removerAfastamento,
} from './afastamentos.js';
import { ErroCadastro } from './demandas.js';
import { ROTULOS_EVENTO, SITUACOES_AFASTAMENTO, TIPOS_AFASTAMENTO } from './rotulos.js';
import {
  $, criarGestorErros, elemento, estado, formatarData, hojeAtual, mostrarMensagem, opcoes, persistir,
} from './ui-comum.js';

const dialogo = $('dialogo-afastamento');
const CAMPOS = ['tipo', 'inicio', 'fim', 'situacao'];
const gestor = criarGestorErros({ resumo: $('a-resumo-erros'), campos: CAMPOS, idCampo: (c) => `a-${c}`, idErro: (c) => `ea-${c}` });

let editando = null;
let gatilho = null;
let salvou = false;

const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
const dataBreve = (iso) => formatarData(iso).slice(0, 5);

// ---------- Agenda ----------

export function desenharAgenda(hoje) {
  const eventos = agenda(estado.dados.demandas, estado.dados.afastamentos, hoje);
  const caixa = $('agenda');
  if (eventos.length === 0) {
    caixa.replaceChildren(elemento('p', 'nota', `Nenhum compromisso nos próximos ${DIAS_AGENDA} dias.`));
    return;
  }
  const dias = new Map();
  for (const e of eventos) dias.set(e.data, [...(dias.get(e.data) ?? []), e]);
  caixa.replaceChildren(
    ...[...dias].map(([data, lista]) => {
      const bloco = elemento('div', 'agenda-dia');
      const diaSemana = new Date(`${data}T00:00:00Z`).toLocaleDateString('pt-BR', { weekday: 'short', timeZone: 'UTC' });
      bloco.append(elemento('h3', '', `${diaSemana}, ${formatarData(data)}${data === hoje ? ' (hoje)' : ''}`));
      const ul = elemento('ul', 'agenda-lista');
      for (const e of lista) {
        const li = elemento('li', `evento evento-${e.tipo}`);
        li.append(elemento('span', 'evento-hora', e.hora ?? 'dia todo'), elemento('span', 'evento-tipo', ROTULOS_EVENTO[e.tipo]), elemento('span', 'evento-titulo', e.titulo));
        ul.append(li);
      }
      bloco.append(ul);
      return bloco;
    })
  );
}

// ---------- Aviso de afastamento próximo ----------

export function desenharBanner(hoje) {
  const proximos = afastamentosProximos(estado.dados.afastamentos, hoje);
  const caixa = $('aviso-afastamento');
  caixa.hidden = proximos.length === 0;
  caixa.replaceChildren(
    ...proximos.map(({ afastamento: a, dias }) => {
      const { prazos, viagens } = avisosAfastamento(a, estado.dados.demandas, hoje);
      const verbo = a.tipo === 'ferias' ? 'começam' : 'começa';
      const quando = dias === 0 ? `${verbo} hoje` : `${verbo} em ${plural(dias, 'dia', 'dias')}`;
      const partes = [`${TIPOS_AFASTAMENTO[a.tipo]} ${quando} (${formatarData(a.inicio)} a ${formatarData(a.fim)}).`];
      if (prazos.length) partes.push(`${plural(prazos.length, 'demanda tem', 'demandas têm')} prazo no período: considere antecipar.`);
      if (viagens.length) partes.push(`${plural(viagens.length, 'viagem de operação coincide', 'viagens de operação coincidem')} com o período: ajuste a escala com a coordenação.`);
      return elemento('p', '', partes.join(' '));
    })
  );
}

// ---------- Lista de afastamentos ----------

export function desenharAfastamentos(hoje) {
  const lista = ordenarAfastamentos(estado.dados.afastamentos);
  $('afastamentos-vazio').hidden = lista.length > 0;
  $('lista-afastamentos').replaceChildren(
    ...lista.map((a) => {
      const li = elemento('li', 'afastamento');
      li.append(elemento('p', 'afastamento-titulo', `${TIPOS_AFASTAMENTO[a.tipo]} · ${formatarData(a.inicio)} a ${formatarData(a.fim)} · ${SITUACOES_AFASTAMENTO[a.situacao]}`));
      const { prazos, viagens } = avisosAfastamento(a, estado.dados.demandas, hoje);
      if (prazos.length) {
        li.append(
          elemento('p', 'aviso-item', `${plural(prazos.length, 'prazo cai', 'prazos caem')} no período (antecipar): ${prazos.map((x) => `${x.demanda.titulo} (${dataBreve(x.prazo)})`).join('; ')}.`)
        );
      }
      for (const v of viagens) {
        li.append(elemento('p', 'aviso-item', `A viagem "${v.demanda.titulo}" (${dataBreve(v.saida)} a ${dataBreve(v.retorno)}) coincide com o período: ajustar a escala com a coordenação.`));
      }
      const acoes = elemento('div', 'acoes-cartao');
      const editar = elemento('button', '', 'Editar');
      editar.type = 'button';
      editar.dataset.foco = `editar-${a.id}`;
      editar.setAttribute('aria-label', `Editar ${TIPOS_AFASTAMENTO[a.tipo]} de ${formatarData(a.inicio)}`);
      editar.addEventListener('click', () => abrirDialogo(a, editar));
      const remover = elemento('button', '', 'Remover');
      remover.type = 'button';
      remover.setAttribute('aria-label', `Remover ${TIPOS_AFASTAMENTO[a.tipo]} de ${formatarData(a.inicio)}`);
      remover.addEventListener('click', () => removerItem(a));
      acoes.append(editar, remover);
      li.append(acoes);
      return li;
    })
  );
}

function removerItem(a) {
  if (!window.confirm(`Remover ${TIPOS_AFASTAMENTO[a.tipo]} de ${formatarData(a.inicio)} a ${formatarData(a.fim)}?`)) return;
  estado.dados.afastamentos = removerAfastamento(estado.dados.afastamentos, a.id);
  persistir();
  mostrarMensagem('Afastamento removido.');
  estado.focoApos = 'novo-afastamento';
  estado.atualizar();
}

// ---------- Formulário ----------

function abrirDialogo(afastamento, origemDoClique) {
  editando = afastamento;
  gatilho = origemDoClique;
  $('form-afastamento').reset();
  gestor.limpar();
  $('afastamento-titulo').textContent = afastamento ? 'Editar afastamento' : 'Novo afastamento';
  opcoes($('a-tipo'), Object.entries(TIPOS_AFASTAMENTO), afastamento ? afastamento.tipo : 'ferias');
  opcoes($('a-situacao'), Object.entries(SITUACOES_AFASTAMENTO), afastamento ? afastamento.situacao : 'planejado');
  $('a-inicio').value = afastamento ? afastamento.inicio : hojeAtual();
  $('a-fim').value = afastamento ? afastamento.fim : '';
  dialogo.showModal();
  $('a-tipo').focus();
}

function enviar(evento) {
  evento.preventDefault();
  const entrada = Object.fromEntries(new FormData($('form-afastamento')));
  try {
    if (editando) {
      const i = estado.dados.afastamentos.findIndex((a) => a.id === editando.id);
      estado.dados.afastamentos[i] = editarAfastamento(editando, entrada);
      estado.focoApos = `editar-${editando.id}`;
    } else {
      const novo = criarAfastamento(entrada, estado.dados.afastamentos);
      estado.dados.afastamentos.push(novo);
      estado.focoApos = `editar-${novo.id}`;
    }
  } catch (e) {
    if (!(e instanceof ErroCadastro)) throw e;
    gestor.mostrar(e.erros);
    return;
  }
  persistir();
  salvou = true;
  dialogo.close();
  mostrarMensagem('Afastamento salvo.');
  estado.atualizar();
}

export function iniciarAfastamentos() {
  $('novo-afastamento').addEventListener('click', (e) => abrirDialogo(null, e.currentTarget));
  $('novo-afastamento').dataset.foco = 'novo-afastamento';
  $('form-afastamento').addEventListener('submit', enviar);
  $('a-cancelar').addEventListener('click', () => dialogo.close());
  dialogo.addEventListener('close', () => {
    if (!salvou && gatilho?.isConnected) gatilho.focus();
    salvou = false;
  });
}
