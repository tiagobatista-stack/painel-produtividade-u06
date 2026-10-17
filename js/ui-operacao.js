// Interface das operações de alertas: importação da planilha, registrar retorno e etapas dos pontos.
import { somarDias } from './indicadores.js';
import { ErroCadastro, validarParametros } from './demandas.js';
import { lerPlanilha } from './planilha.js';
import {
  OBSERVACAO_PONTO_MAX, agruparRelatorio, alterarEtapaPonto, alterarEtapaRelatorio, criarOperacao, desfazerRelatorio, registrarAuto, registrarRetorno, removerAuto,
  retomarOperacao, salvarObservacaoPonto, sobrestarOperacao,
} from './operacoes.js';
import { autosDoPonto, relatorioDoPonto } from './indicadores.js';
import { ETAPAS_PONTO, ROTULO_AUTO_SEM_TIPO, TIPOS_AUTO } from './rotulos.js';
import { $, criarGestorErros, elemento, estado, formatarData, hojeAtual, mostrarAviso, mostrarMensagem, opcoes, persistir } from './ui-comum.js';
import { caixaDeAnotacao } from './ui-anotacoes.js';

const dlgAuto = $('dialogo-auto');
const gestorAuto = criarGestorErros({ resumo: $('auto-resumo-erros'), campos: ['tipo', 'data'], idCampo: (c) => `auto-${c}`, idErro: (c) => `auto-erro-${c}` });
let operacaoDoAuto = null;
let pontoDoAuto = null;
let gatilhoAuto = null;
let registrouAuto = false;
const selecionados = new Map(); // id da operação -> números dos pontos marcados para agrupar
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
  estado.focoApos = `abrir-${op.id}`;
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

// Mostra o aviso dentro do painel lateral quando ele está aberto (o aviso da página fica atrás da janela modal).
export function avisarNoPainel(mensagem) {
  const painel = $('painel-demanda');
  if (painel.open) {
    $('painel-aviso').textContent = mensagem;
    $('painel-aviso').hidden = !mensagem;
  } else {
    mostrarAviso(mensagem);
  }
}

// Aplica uma regra à operação, salva e redesenha. Em caso de erro mostra o aviso e redesenha para devolver os controles ao estado anterior.
function aplicar(idOperacao, regra, { foco, mensagem } = {}) {
  const i = estado.dados.demandas.findIndex((d) => d.id === idOperacao);
  try {
    estado.dados.demandas[i] = regra(estado.dados.demandas[i]);
  } catch (e) {
    if (!(e instanceof ErroCadastro)) throw e;
    avisarNoPainel(Object.values(e.erros)[0]);
    estado.focoApos = foco ?? null;
    estado.atualizar();
    return false;
  }
  avisarNoPainel('');
  mostrarAviso('');
  persistir();
  if (mensagem && !$('painel-demanda').open) mostrarMensagem(mensagem);
  estado.pontosAbertos.add(idOperacao);
  estado.focoApos = foco ?? null;
  estado.atualizar();
  return true;
}

function mudarEtapa(idOperacao, numero, novaEtapa) {
  aplicar(idOperacao, (op) => alterarEtapaPonto(op, numero, novaEtapa, hojeAtual()), { foco: `ponto-${idOperacao}-${numero}` });
}

// ---------- Autos ----------

function abrirAuto(operacao, ponto, gatilho) {
  operacaoDoAuto = operacao;
  pontoDoAuto = ponto;
  gatilhoAuto = gatilho;
  gestorAuto.limpar();
  $('auto-resumo').textContent = `${operacao.titulo} · ponto ${ponto.n} (${ponto.municipio})`;
  opcoes($('auto-tipo'), Object.entries(TIPOS_AUTO), 'auto_infracao');
  const hoje = hojeAtual();
  $('auto-data').value = ponto.data_relatorio && hoje < ponto.data_relatorio ? ponto.data_relatorio : hoje;
  dlgAuto.showModal();
  $('auto-tipo').focus();
}

function confirmarAuto(evento) {
  evento.preventDefault();
  const i = estado.dados.demandas.findIndex((d) => d.id === operacaoDoAuto.id);
  try {
    estado.dados.demandas[i] = registrarAuto(estado.dados.demandas[i], pontoDoAuto.n, { tipo: $('auto-tipo').value, data: $('auto-data').value }, hojeAtual());
  } catch (e) {
    if (!(e instanceof ErroCadastro)) throw e;
    gestorAuto.mostrar(e.erros);
    return;
  }
  persistir();
  registrouAuto = true;
  dlgAuto.close();
  estado.pontosAbertos.add(operacaoDoAuto.id);
  estado.focoApos = `auto-${operacaoDoAuto.id}-${pontoDoAuto.n}`;
  estado.atualizar();
}

function listaDeAutos(operacao, ponto) {
  const autos = autosDoPonto(ponto);
  const caixa = elemento('div', 'ponto-autos');
  if (autos.length) {
    const lista = elemento('ul', 'autos');
    for (const a of autos) {
      const rotulo = a.tipo ? TIPOS_AUTO[a.tipo] : ROTULO_AUTO_SEM_TIPO;
      const li = elemento('li', 'auto', `${rotulo} · ${a.data ? formatarData(a.data) : 'sem data'}`);
      const remover = elemento('button', 'perigo', 'Remover');
      remover.type = 'button';
      remover.setAttribute('aria-label', `Remover ${rotulo} do ponto ${ponto.n}`);
      remover.addEventListener('click', () => aplicar(operacao.id, (op) => removerAuto(op, ponto.n, a.id, hojeAtual()), { foco: `ponto-${operacao.id}-${ponto.n}` }));
      li.append(' ', remover);
      lista.append(li);
    }
    caixa.append(lista);
  }
  if (ponto.etapa === 'relatorio_concluido' || ponto.etapa === 'auto_lavrado') {
    const registrar = elemento('button', '', autos.length ? 'Registrar outro auto' : 'Registrar auto');
    registrar.type = 'button';
    registrar.dataset.foco = `auto-${operacao.id}-${ponto.n}`;
    registrar.setAttribute('aria-label', `${registrar.textContent} no ponto ${ponto.n}`);
    registrar.addEventListener('click', () => abrirAuto(operacao, ponto, registrar));
    caixa.append(registrar);
  }
  return caixa;
}

// ---------- Relatórios agrupados ----------

const elegivelParaAgrupar = (operacao, p) => (p.etapa === 'vistoriado' || p.etapa === 'relatorio_elaboracao') && !relatorioDoPonto(operacao, p.n);

const ETAPAS_DO_RELATORIO = [['vistoriado', 'Vistoriado (relatório pendente)'], ['relatorio_elaboracao', 'Relatório em elaboração'], ['relatorio_concluido', 'Relatório concluído']];

function blocoRelatorios(operacao) {
  const marcados = selecionados.get(operacao.id) ?? new Set();
  const bloco = elemento('div', 'relatorios-bloco');
  bloco.append(elemento('h4', '', 'Relatórios'));
  bloco.append(elemento('p', 'nota', 'Cada ponto tem o seu relatório, a não ser que seja somado a outros no mesmo relatório. Marque 2 ou mais pontos da mesma etapa para agrupá-los.'));

  const agrupar = elemento('button', '', `Agrupar ${marcados.size} ${marcados.size === 1 ? 'ponto marcado' : 'pontos marcados'} em um relatório`);
  agrupar.type = 'button';
  agrupar.disabled = marcados.size < 2;
  agrupar.addEventListener('click', () => {
    const numeros = [...marcados];
    selecionados.delete(operacao.id);
    aplicar(operacao.id, (op) => agruparRelatorio(op, numeros, hojeAtual()), { foco: `ponto-${operacao.id}-${numeros[0]}` });
  });
  bloco.append(agrupar);

  for (const grupo of operacao.relatorios ?? []) {
    const membros = operacao.pontos.filter((p) => grupo.pontos.includes(p.n));
    const etapas = new Set(membros.map((p) => p.etapa));
    const concluido = membros.every((p) => p.etapa !== 'vistoriado' && p.etapa !== 'relatorio_elaboracao');
    const linha = elemento('div', 'relatorio-grupo');
    linha.append(elemento('strong', '', grupo.id), elemento('span', '', ` · pontos ${grupo.pontos.join(', ')}`));
    const rotulo = elemento('label', 'rotulo-status', 'Situação do relatório');
    const select = elemento('select');
    select.id = `relatorio-${operacao.id}-${grupo.id}`;
    rotulo.htmlFor = select.id;
    select.dataset.foco = select.id;
    const atual = etapas.size === 1 && ETAPAS_DO_RELATORIO.some(([c]) => c === [...etapas][0]) ? [...etapas][0] : concluido ? 'relatorio_concluido' : 'vistoriado';
    opcoes(select, ETAPAS_DO_RELATORIO, atual);
    select.addEventListener('change', () => aplicar(operacao.id, (op) => alterarEtapaRelatorio(op, grupo.id, select.value, hojeAtual()), { foco: select.id }));
    const desfazer = elemento('button', '', 'Desfazer agrupamento');
    desfazer.type = 'button';
    desfazer.setAttribute('aria-label', `Desfazer o agrupamento do relatório ${grupo.id}`);
    desfazer.disabled = concluido;
    desfazer.addEventListener('click', () => aplicar(operacao.id, (op) => desfazerRelatorio(op, grupo.id, hojeAtual()), { foco: `ponto-${operacao.id}-${grupo.pontos[0]}` }));
    linha.append(rotulo, select, desfazer);
    bloco.append(linha);
  }
  return bloco;
}

// Anotação de um ponto (o que já foi feito e o que falta): fica numa seção recolhida do ponto.
function anotacaoDoPonto(operacao, ponto) {
  const detalhes = elemento('details', 'ponto-obs');
  detalhes.open = estado.pontosAbertos.has(`obs-${operacao.id}-${ponto.n}`);
  detalhes.addEventListener('toggle', () => {
    if (detalhes.open) estado.pontosAbertos.add(`obs-${operacao.id}-${ponto.n}`);
    else estado.pontosAbertos.delete(`obs-${operacao.id}-${ponto.n}`);
  });
  detalhes.append(elemento('summary', '', ponto.observacoes ? 'Anotação do ponto (preenchida)' : 'Anotação do ponto'));
  detalhes.append(
    caixaDeAnotacao({
      chave: `${operacao.id}-p${ponto.n}`,
      titulo: `Anotação do ponto ${ponto.n}`,
      valor: ponto.observacoes ?? '',
      max: OBSERVACAO_PONTO_MAX,
      linhas: 3,
      aoSalvar: (texto) =>
        aplicar(operacao.id, (op) => salvarObservacaoPonto(op, ponto.n, texto, hojeAtual()), { foco: `anotacao-${operacao.id}-p${ponto.n}` }),
    })
  );
  return detalhes;
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
  const marcados = selecionados.get(d.id) ?? new Set();
  for (const p of d.pontos) {
    const li = elemento('li', 'ponto');
    const info = elemento('div', 'ponto-info');
    info.append(elemento('strong', '', `Ponto ${p.n}`), elemento('span', '', ` · ${p.municipio}`));
    const grupo = relatorioDoPonto(d, p.n);
    if (grupo) info.append(elemento('span', 'selo-relatorio', `Relatório ${grupo.id}`));
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
      if (grupo) select.setAttribute('aria-describedby', `dica-${d.id}-${p.n}`);
    }
    li.append(info, rotulo, select);
    if (grupo) {
      const dica = elemento('p', 'nota ponto-dica', `As etapas do relatório valem para todo o relatório ${grupo.id}; o auto é de cada ponto.`);
      dica.id = `dica-${d.id}-${p.n}`;
      li.append(dica);
    }
    if (elegivelParaAgrupar(d, p)) {
      const caixa = elemento('label', 'ponto-marcar');
      const marca = elemento('input');
      marca.type = 'checkbox';
      marca.checked = marcados.has(p.n);
      marca.addEventListener('change', () => {
        const conjunto = selecionados.get(d.id) ?? new Set();
        if (marca.checked) conjunto.add(p.n);
        else conjunto.delete(p.n);
        selecionados.set(d.id, conjunto);
        estado.focoApos = null;
        estado.atualizar();
        document.querySelector(`[data-foco="marcar-${d.id}-${p.n}"]`)?.focus();
      });
      marca.dataset.foco = `marcar-${d.id}-${p.n}`;
      caixa.append(marca, ` Marcar o ponto ${p.n} para agrupar`);
      li.append(caixa);
    }
    li.append(listaDeAutos(d, p), anotacaoDoPonto(d, p));
    lista.append(li);
  }
  detalhes.append(lista, blocoRelatorios(d));
  return detalhes;
}

// Botão "Sobrestar operação" / "Retomar operação" do cartão.
export function botaoSobrestamento(d) {
  const sobrestada = Boolean(d.sobrestada);
  const botao = elemento('button', '', sobrestada ? 'Retomar operação' : 'Sobrestar operação');
  botao.type = 'button';
  botao.dataset.foco = `sobrestar-${d.id}`;
  botao.setAttribute('aria-label', `${sobrestada ? 'Retomar operação' : 'Sobrestar operação'}: ${d.titulo}`);
  botao.addEventListener('click', () => {
    const i = estado.dados.demandas.findIndex((x) => x.id === d.id);
    try {
      estado.dados.demandas[i] = (sobrestada ? retomarOperacao : sobrestarOperacao)(estado.dados.demandas[i], hojeAtual());
    } catch (e) {
      if (!(e instanceof ErroCadastro)) throw e;
      mostrarAviso(Object.values(e.erros)[0]);
      return;
    }
    mostrarAviso('');
    persistir();
    mostrarMensagem(sobrestada ? 'Operação retomada: o prazo registrado volta a valer.' : 'Operação sobrestada: prazo suspenso, fora da fila ativa. Use o filtro "Sobrestado" para vê-la.');
    estado.focoApos = `sobrestar-${d.id}`;
    estado.atualizar();
  });
  return botao;
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

  $('form-auto').addEventListener('submit', confirmarAuto);
  $('auto-cancelar').addEventListener('click', () => dlgAuto.close());
  dlgAuto.addEventListener('close', () => {
    if (!registrouAuto && gatilhoAuto?.isConnected) gatilhoAuto.focus();
    registrouAuto = false;
  });

  $('form-retorno').addEventListener('submit', confirmarRetorno);
  $('ret-cancelar').addEventListener('click', () => dlgRetorno.close());
  dlgRetorno.addEventListener('close', () => {
    if (!registrou && gatilhoRetorno?.isConnected) gatilhoRetorno.focus();
    registrou = false;
  });
}
