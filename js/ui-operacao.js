// Interface das operações de alertas: importação da planilha, registrar retorno e etapas dos pontos.
import { somarDias } from './indicadores.js';
import { ErroCadastro, validarParametros } from './demandas.js';
import { lerPlanilha } from './planilha.js';
import { alterarEtapaPonto, criarOperacao, registrarRetorno } from './operacoes.js';
import { ETAPAS_PONTO } from './rotulos.js';
import { $, elemento, estado, formatarData, hojeAtual, mostrarAviso, mostrarMensagem, opcoes, persistir } from './ui-comum.js';

const dlgImportacao = $('dialogo-importacao');
const dlgRetorno = $('dialogo-retorno');
let gatilhoImportacao = null;
let gatilhoRetorno = null;
let operacaoDoRetorno = null;
let importou = false;
let registrou = false;

const MAX_ERROS_VISIVEIS = 8;

// ---------- Importação ----------

function listaDeErros(titulo, mensagens) {
  const bloco = elemento('div', 'erro');
  const lista = elemento('ul');
  mensagens.slice(0, MAX_ERROS_VISIVEIS).forEach((m) => lista.append(elemento('li', '', m)));
  if (mensagens.length > MAX_ERROS_VISIVEIS) lista.append(elemento('li', '', `… e mais ${mensagens.length - MAX_ERROS_VISIVEIS}.`));
  bloco.append(elemento('strong', '', titulo), lista);
  return bloco;
}

function analisarImportacao() {
  const previa = $('imp-previa');
  const confirmar = $('imp-confirmar');
  confirmar.disabled = true;
  const texto = $('imp-texto').value;
  if (texto.trim() === '') {
    previa.replaceChildren(elemento('p', 'nota', 'Cole as linhas da planilha (com a linha de cabeçalho) ou use a planilha de exemplo.'));
    return null;
  }
  const leitura = lerPlanilha(texto);
  if (!leitura.ok) {
    previa.replaceChildren(listaDeErros('A planilha tem problemas:', leitura.erros.map((e) => (e.linha ? `Linha ${e.linha}${e.campo ? `, ${e.campo}` : ''}: ${e.mensagem}` : e.mensagem))));
    return null;
  }
  let parametros;
  try {
    parametros = validarParametros({ prazo_dias: $('imp-prazo').value, horas_ponto: $('imp-horas').value });
  } catch (e) {
    if (!(e instanceof ErroCadastro)) throw e;
    previa.replaceChildren(listaDeErros('Parâmetros inválidos:', Object.values(e.erros)));
    return null;
  }
  const op = leitura.operacao;
  const prazo = somarDias(op.retorno, parametros.prazo_dias);
  const resumo = elemento('div', 'previa-ok');
  resumo.append(
    elemento('strong', '', 'Planilha válida'),
    elemento('p', '', `${op.equipe} · ${op.pontos.length} ${op.pontos.length === 1 ? 'ponto' : 'pontos'} em ${op.municipios.length} ${op.municipios.length === 1 ? 'município' : 'municípios'} (${op.municipios.join(', ')})`),
    elemento('p', '', `Saída ${formatarData(op.saida)} · retorno ${formatarData(op.retorno)}`),
    elemento('p', '', `Prazo dos relatórios: ${formatarData(prazo)} (retorno + ${parametros.prazo_dias} dias)`)
  );
  previa.replaceChildren(resumo);
  confirmar.disabled = false;
  return { operacao: op, parametros };
}

function abrirImportacao(gatilho) {
  gatilhoImportacao = gatilho;
  $('imp-texto').value = '';
  $('imp-prazo').value = estado.seed.parametros.prazo_dias;
  $('imp-horas').value = estado.seed.parametros.horas_ponto;
  analisarImportacao();
  dlgImportacao.showModal();
  $('imp-texto').focus();
}

function confirmarImportacao(evento) {
  evento.preventDefault();
  const analise = analisarImportacao();
  if (!analise) return;
  let op;
  try {
    op = criarOperacao(analise.operacao, analise.parametros, estado.dados.demandas, hojeAtual());
  } catch (e) {
    if (!(e instanceof ErroCadastro)) throw e;
    $('imp-previa').replaceChildren(listaDeErros('Não foi possível importar:', Object.values(e.erros)));
    return;
  }
  estado.dados.demandas.push(op);
  persistir();
  importou = true;
  dlgImportacao.close();
  mostrarMensagem(`Operação importada: ${op.pontos.length} pontos, prazo dos relatórios em ${formatarData(somarDias(op.retorno, op.prazo_dias))}. Use "Registrar retorno" quando a equipe voltar.`);
  estado.focoApos = `editar-${op.id}`;
  estado.atualizar();
}

// ---------- Registrar retorno ----------

export function abrirRetorno(operacao, gatilho) {
  operacaoDoRetorno = operacao;
  gatilhoRetorno = gatilho;
  const planejados = operacao.pontos.filter((p) => p.etapa === 'planejado').length;
  $('ret-resumo').textContent = `${operacao.titulo}: ${planejados} ${planejados === 1 ? 'ponto passa' : 'pontos passam'} de "Planejado" para "Vistoriado (relatório pendente)".`;
  $('ret-data').value = operacao.retorno;
  $('ret-erro').textContent = '';
  $('ret-data').removeAttribute('aria-invalid');
  dlgRetorno.showModal();
  $('ret-data').focus();
}

function confirmarRetorno(evento) {
  evento.preventDefault();
  const i = estado.dados.demandas.findIndex((d) => d.id === operacaoDoRetorno.id);
  try {
    estado.dados.demandas[i] = registrarRetorno(estado.dados.demandas[i], hojeAtual(), $('ret-data').value);
  } catch (e) {
    if (!(e instanceof ErroCadastro)) throw e;
    $('ret-erro').textContent = Object.values(e.erros)[0];
    $('ret-data').setAttribute('aria-invalid', 'true');
    $('ret-data').focus();
    return;
  }
  persistir();
  registrou = true;
  dlgRetorno.close();
  mostrarMensagem('Retorno registrado: os pontos foram marcados como vistoriados.');
  estado.pontosAbertos.add(operacaoDoRetorno.id);
  estado.focoApos = `editar-${operacaoDoRetorno.id}`;
  estado.atualizar();
}

// ---------- Pontos no cartão da operação ----------

function mudarEtapa(idOperacao, numero, novaEtapa) {
  const i = estado.dados.demandas.findIndex((d) => d.id === idOperacao);
  try {
    estado.dados.demandas[i] = alterarEtapaPonto(estado.dados.demandas[i], numero, novaEtapa, hojeAtual());
  } catch (e) {
    if (!(e instanceof ErroCadastro)) throw e;
    mostrarAviso(Object.values(e.erros)[0]);
    estado.focoApos = `ponto-${idOperacao}-${numero}`;
    estado.atualizar(); // redesenha e devolve o seletor à etapa anterior
    return;
  }
  mostrarAviso('');
  persistir();
  estado.focoApos = `ponto-${idOperacao}-${numero}`;
  estado.atualizar();
}

export function blocoPontos(d) {
  const detalhes = elemento('details', 'pontos');
  detalhes.open = estado.pontosAbertos.has(d.id);
  detalhes.addEventListener('toggle', () => {
    if (detalhes.open) estado.pontosAbertos.add(d.id);
    else estado.pontosAbertos.delete(d.id);
  });
  detalhes.append(elemento('summary', '', `Pontos (${d.pontos.length})`));
  const lista = elemento('ul', 'lista-pontos');
  for (const p of d.pontos) {
    const li = elemento('li', 'ponto');
    const info = elemento('div', 'ponto-info');
    info.append(elemento('strong', '', `Ponto ${p.n}`), elemento('span', '', ` · ${p.municipio}`));
    if (p.nota) info.append(elemento('span', 'ponto-nota', ` · ${p.nota}`));
    const rotulo = elemento('label', 'rotulo-status', 'Etapa');
    const select = elemento('select');
    select.id = `ponto-${d.id}-${p.n}`;
    rotulo.htmlFor = select.id;
    select.dataset.foco = select.id;
    if (p.etapa === 'planejado') {
      opcoes(select, [['planejado', 'Planejado (registre o retorno)']], 'planejado');
      select.disabled = true;
    } else {
      opcoes(select, Object.entries(ETAPAS_PONTO).filter(([chave]) => chave !== 'planejado'), p.etapa);
      select.addEventListener('change', () => mudarEtapa(d.id, p.n, select.value));
    }
    li.append(info, rotulo, select);
    lista.append(li);
  }
  detalhes.append(lista);
  return detalhes;
}

export function temPlanejados(d) {
  return d.tipo === 'operacao' && d.pontos.some((p) => p.etapa === 'planejado');
}

// ---------- Inicialização ----------

export function iniciarOperacoes() {
  $('importar-operacao').addEventListener('click', (e) => abrirImportacao(e.currentTarget));
  for (const id of ['imp-texto', 'imp-prazo', 'imp-horas']) $(id).addEventListener('input', analisarImportacao);
  $('imp-exemplo').addEventListener('click', async () => {
    try {
      const resposta = await fetch('data/planilha-exemplo.tsv');
      if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
      $('imp-texto').value = await resposta.text();
    } catch {
      $('imp-previa').replaceChildren(listaDeErros('Não foi possível carregar a planilha de exemplo.', ['Abra o painel por "npm start".']));
      return;
    }
    analisarImportacao();
  });
  $('form-importacao').addEventListener('submit', confirmarImportacao);
  $('imp-cancelar').addEventListener('click', () => dlgImportacao.close());
  dlgImportacao.addEventListener('close', () => {
    if (!importou && gatilhoImportacao?.isConnected) gatilhoImportacao.focus();
    importou = false;
  });

  $('form-retorno').addEventListener('submit', confirmarRetorno);
  $('ret-cancelar').addEventListener('click', () => dlgRetorno.close());
  dlgRetorno.addEventListener('close', () => {
    if (!registrou && gatilhoRetorno?.isConnected) gatilhoRetorno.focus();
    registrou = false;
  });
}
