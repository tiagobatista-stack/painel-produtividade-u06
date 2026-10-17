import { calcularIndicadores, relatoriosPendentes, autosALavrar } from './indicadores.js';
import { ErroCadastro, FILTROS_PADRAO, alterarStatus, filtrosEmUso, listarDemandas } from './demandas.js';
import { esforcoHoras } from './operacoes.js';
import { carregar } from './armazenamento.js';
import { ETAPAS, ORIGENS, STATUS, TIPOS } from './rotulos.js';
import {
  $, elemento, estado, formatarData, hojeAtual, hojeLocal, mostrarAviso, opcoes, persistir, restaurarFoco, textoPrazo,
} from './ui-comum.js';
import { abrirFormulario, iniciarFormulario } from './ui-formulario.js';
import { blocoAnotacoes } from './ui-anotacoes.js';
import { abrirRetorno, blocoPontos, botaoSobrestamento, iniciarOperacoes, temPlanejados } from './ui-operacao.js';
import { desenharAfastamentos, desenharAgenda, desenharBanner, iniciarAfastamentos } from './ui-afastamentos.js';
import { desenharResumo, iniciarExportacao } from './ui-exportacao.js';

const INDICADORES = [
  ['abertas', 'Abertas'],
  ['vencidas', 'Vencidas'],
  ['proximos7', 'Próximos 7 dias'],
  ['relatoriosPendentes', 'Relatórios pendentes'],
  ['autosALavrar', 'Autos a lavrar'],
  ['concluidasSemana', 'Concluídas na semana'],
  ['sobrestados', 'Sobrestados'],
];
const FAIXAS = ['Crítica', 'Alta', 'Média', 'Baixa'];
const campoData = $('data-referencia');
const filtroBusca = $('filtro-busca');
const filtroTipo = $('filtro-tipo');
const filtroStatus = $('filtro-status');
const filtroPrioridade = $('filtro-prioridade');
// ---------- Indicadores e fila ----------

function desenharIndicadores(valores) {
  $('indicadores').replaceChildren(
    ...INDICADORES.map(([chave, rotulo]) => {
      const li = elemento('li', 'indicador');
      li.append(elemento('span', 'indicador-valor', String(valores[chave])), elemento('span', 'indicador-rotulo', rotulo));
      return li;
    })
  );
}

function classeFaixa(faixa) {
  return `faixa-${faixa.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()}`;
}

function cartao(item, hoje) {
  const { demanda: d, prazo, score, faixa, faixa_calculada: faixaCalculada, modo, motivos, concluida, sobrestada } = item;
  const info = textoPrazo(prazo, hoje);
  const classes = ['demanda'];
  if (faixa) classes.push(classeFaixa(faixa));
  if (concluida) classes.push('concluida');
  if (sobrestada) classes.push('sobrestada');
  if (info.vencida && !concluida && !sobrestada) classes.push('vencida');
  const li = elemento('li', classes.join(' '));

  const topo = elemento('div', 'demanda-topo');
  topo.append(elemento('span', 'etiqueta', TIPOS[d.tipo]), elemento('span', 'status', STATUS[d.status]));
  li.append(topo, elemento('h3', 'demanda-titulo', d.titulo));

  if (concluida) {
    li.append(elemento('p', 'prioridade', d.concluida_em ? `Concluída em ${formatarData(d.concluida_em)}` : 'Concluída'));
  } else if (sobrestada) {
    li.append(elemento('p', 'prioridade', d.tipo === 'operacao' ? 'Sobrestada: prazo suspenso, aguardando identificação do autuado' : 'Sobrestado: prazo suspenso, aguardando resposta do interessado'));
  } else {
    li.append(elemento('p', 'prioridade', modo === 'manual'
      ? `Prioridade ${faixa} (manual) · calculada: ${faixaCalculada} ${score}`
      : `Prioridade ${faixa} · ${score} pontos`));
  }
  li.append(elemento('p', 'demanda-detalhe', `Origem: ${ORIGENS[d.origem]}`));
  if (sobrestada) li.append(elemento('p', 'demanda-detalhe', `Prazo registrado: ${formatarData(prazo)} (não conta enquanto sobrestado)`));
  else if (!concluida) li.append(elemento('p', 'demanda-prazo', `Prazo: ${info.texto}`));
  if (d.descricao) li.append(elemento('p', 'demanda-descricao', d.descricao));
  const etapa = ETAPAS[d.tipo]?.[d.etapa];
  if (d.protocolo || etapa) {
    const rotuloProtocolo = d.tipo === 'processo' ? 'Processo' : 'Protocolo';
    li.append(elemento('p', 'demanda-detalhe', [d.protocolo && `${rotuloProtocolo} ${d.protocolo}`, etapa && `etapa: ${etapa}`].filter(Boolean).join(' · ')));
  }
  if (d.responsavel) li.append(elemento('p', 'demanda-detalhe', `Responsável: ${d.responsavel}`));
  if (d.municipio) li.append(elemento('p', 'demanda-detalhe', `Município: ${d.municipio}`));
  if (d.data_hora) {
    const [dia, hora] = d.data_hora.split('T');
    li.append(elemento('p', 'demanda-detalhe', `${formatarData(dia)} às ${hora} · ${d.local}${d.publico !== undefined ? ` · ${d.publico} pessoas` : ''}`));
  }
  if (d.tipo === 'operacao') {
    const pend = relatoriosPendentes(d);
    const autos = autosALavrar(d);
    li.append(elemento('p', 'demanda-detalhe', `${d.equipe} · saída ${formatarData(d.saida)} · retorno ${formatarData(d.retorno)}`));
    li.append(elemento('p', 'demanda-detalhe', `${pend} ${pend === 1 ? 'relatório pendente' : 'relatórios pendentes'} · ${autos} ${autos === 1 ? 'auto a lavrar' : 'autos a lavrar'} · esforço estimado ${esforcoHoras(d)} h`));
  }

  if (motivos) {
    const detalhes = elemento('details', 'motivos');
    const lista = elemento('ul');
    if (modo === 'manual') lista.append(elemento('li', '', `Ajuste manual: ${faixa}. Motivo: ${d.motivo_ajuste}`));
    lista.append(...motivos.map((m) => elemento('li', '', m)));
    detalhes.append(elemento('summary', '', 'Por que esta prioridade?'), lista);
    li.append(detalhes);
  }
  if (d.tipo === 'operacao') li.append(blocoPontos(d));
  const anotacoes = blocoAnotacoes(d);
  if (anotacoes) li.append(anotacoes);

  if (d.historico?.length) {
    const detalhes = elemento('details', 'motivos');
    const lista = elemento('ul');
    lista.append(...d.historico.map((h) => elemento('li', '', `${formatarData(h.data)} — ${h.evento}`)));
    detalhes.append(elemento('summary', '', `Histórico (${d.historico.length})`), lista);
    li.append(detalhes);
  }

  const acoes = elemento('div', 'acoes-cartao');
  if (d.tipo !== 'operacao') {
    const rotulo = elemento('label', 'rotulo-status', 'Status');
    const select = elemento('select');
    select.id = `status-${d.id}`;
    rotulo.htmlFor = select.id;
    select.dataset.foco = `status-${d.id}`;
    opcoes(select, Object.entries(STATUS), d.status);
    select.addEventListener('change', () => mudarStatus(d.id, select.value));
    acoes.append(rotulo, select);
  }
  const editar = elemento('button', '', 'Editar');
  editar.type = 'button';
  editar.dataset.foco = `editar-${d.id}`;
  editar.setAttribute('aria-label', `Editar ${d.titulo}`);
  editar.addEventListener('click', () => abrirFormulario(d, editar));
  acoes.append(editar);
  if (temPlanejados(d)) {
    const retorno = elemento('button', 'primario', 'Registrar retorno');
    retorno.type = 'button';
    retorno.dataset.foco = `retorno-${d.id}`;
    retorno.setAttribute('aria-label', `Registrar retorno de ${d.titulo}`);
    retorno.addEventListener('click', () => abrirRetorno(d, retorno));
    acoes.append(retorno);
  }
  if (d.tipo === 'operacao' && !concluida) acoes.append(botaoSobrestamento(d));
  li.append(acoes);
  return li;
}

function filtrosAtuais() {
  return { busca: filtroBusca.value, tipo: filtroTipo.value, status: filtroStatus.value, prioridade: filtroPrioridade.value };
}

function desenharFila(hoje) {
  const { itens, erros } = listarDemandas(estado.dados.demandas, filtrosAtuais(), hoje, { afastamentos: estado.dados.afastamentos });
  $('fila-vazia').hidden = itens.length > 0;
  $('contagem').textContent = `${itens.length} ${itens.length === 1 ? 'demanda' : 'demandas'}`;
  $('fila').replaceChildren(...itens.map((item) => cartao(item, hoje)));
  $('erros-validacao').hidden = erros.length === 0;
  $('lista-erros').replaceChildren(...erros.map((x) => elemento('li', '', `${x.demanda.id || '(sem id)'} — ${x.demanda.titulo || ''}: ${x.erro}`)));
}

function atualizar() {
  const hoje = hojeAtual();
  $('limpar-filtros').disabled = !filtrosEmUso(filtrosAtuais());
  desenharBanner(hoje);
  desenharIndicadores(calcularIndicadores(estado.dados.demandas, hoje));
  desenharResumo(hoje);
  desenharAgenda(hoje);
  desenharFila(hoje);
  desenharAfastamentos(hoje);
  restaurarFoco();
}

// Volta busca, tipo, status e prioridade ao padrão. Não apaga demandas nem mexe na data de referência.
function limparFiltros() {
  filtroBusca.value = FILTROS_PADRAO.busca;
  filtroTipo.value = FILTROS_PADRAO.tipo;
  filtroStatus.value = FILTROS_PADRAO.status;
  filtroPrioridade.value = FILTROS_PADRAO.prioridade;
  filtroBusca.focus(); // antes de desabilitar o botão, para o foco não se perder
  atualizar();
}

function mudarStatus(id, novoStatus) {
  const i = estado.dados.demandas.findIndex((d) => d.id === id);
  try {
    estado.dados.demandas[i] = alterarStatus(estado.dados.demandas[i], novoStatus, hojeAtual());
  } catch (e) {
    if (!(e instanceof ErroCadastro)) throw e;
    mostrarAviso(Object.values(e.erros)[0]);
    return;
  }
  persistir();
  estado.focoApos = `status-${id}`;
  atualizar();
}

// ---------- Início ----------

function acessarStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

async function iniciar() {
  campoData.value = hojeLocal();
  estado.atualizar = atualizar;
  try {
    const resposta = await fetch('data/seed.json');
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
    estado.seed = await resposta.json();
  } catch {
    mostrarAviso('Não foi possível carregar data/seed.json. Abra o painel por "npm start" (não por arquivo local).');
    return;
  }

  estado.storage = acessarStorage();
  const carga = carregar(estado.storage, estado.seed);
  estado.dados = carga.dados;
  if (carga.origem === 'seed') persistir();

  opcoes(filtroTipo, [['', 'Todos'], ...Object.entries(TIPOS)], '');
  opcoes(filtroStatus, [['abertas', 'Abertas (ativas)'], ...Object.entries(STATUS)], 'abertas');
  opcoes(filtroPrioridade, [['', 'Todas'], ...FAIXAS.map((f) => [f, f])], '');

  $('usar-data-seed').textContent = `Usar data do exemplo (${formatarData(estado.seed.hoje_referencia)})`;
  $('usar-data-seed').addEventListener('click', () => {
    campoData.value = estado.seed.hoje_referencia;
    atualizar();
  });
  campoData.addEventListener('input', atualizar);
  for (const f of [filtroBusca, filtroTipo, filtroStatus, filtroPrioridade]) f.addEventListener('input', atualizar);
  $('filtros').addEventListener('submit', (e) => e.preventDefault());
  $('limpar-filtros').addEventListener('click', limparFiltros);

  iniciarFormulario();
  iniciarOperacoes();
  iniciarAfastamentos();
  iniciarExportacao();
  atualizar();
}

iniciar();
