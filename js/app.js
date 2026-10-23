import { calcularIndicadores, estaConcluida, estaSobrestada } from './indicadores.js';
import { ErroCadastro, FILTROS_PADRAO, alterarStatus, filtrosEmUso, listarDemandas, removerDemanda, restaurarDemanda } from './demandas.js';
import { carregar } from './armazenamento.js';
import { criarIndiceDeMunicipios } from './municipios.js';
import { FILTRO_PRAZO, FILTRO_VISTORIA, STATUS, TIPOS } from './rotulos.js';
import {
  $, elemento, estado, formatarData, hojeAtual, hojeLocal, mostrarAviso, mostrarMensagem, opcoes, persistir, restaurarFoco,
} from './ui-comum.js';
import { iniciarOperacoes } from './ui-operacao.js';
import { desenharAfastamentos, desenharAgenda, desenharBanner, iniciarAfastamentos } from './ui-afastamentos.js';
import { desenharResumo, iniciarExportacao } from './ui-exportacao.js';
import { desenharCalendario, iniciarCalendario } from './ui-calendario.js';
import { abrirAba, iniciarAbas } from './ui-abas.js';
import { desenharPontos, iniciarPontos } from './ui-pontos.js';
import { abrirPainel, desenharPainel, fecharPainel, iniciarPainel } from './ui-painel.js';
import { abrirFormularioDoPonto, atualizarPontoAberto, iniciarFormularioDoPonto } from './ui-ponto.js';
import { cartao } from './ui-cartao.js';
import { abrirFormulario, iniciarFormulario } from './ui-formulario.js';
import { definirVisao, desenharQuadro, iniciarQuadro, visaoAtual } from './ui-quadro.js';

const INDICADORES = [
  ['vencidas', 'Vencidas'],
  ['proximos7', 'Próximos 7 dias'],
  ['sobrestados', 'Sobrestados'],
  ['concluidasSemana', 'Concluídas na semana'],
];
const COMPLEMENTARES = [
  ['abertas', 'Abertas'],
  ['relatoriosPendentes', 'Relatórios pendentes'],
  ['autosALavrar', 'Autos a lavrar'],
];
// Filtro que cada indicador aplica na fila.
const FILTRO_DO_INDICADOR = {
  vencidas: { status: 'abertas', prazo: 'vencidas' },
  proximos7: { status: 'abertas', prazo: 'proximos7' },
  sobrestados: { status: 'aguardando', prazo: '' },
  concluidasSemana: { status: 'concluida', prazo: 'semana' },
};
const FAIXAS = ['Crítica', 'Alta', 'Média', 'Baixa'];
const campoData = $('data-referencia');
const filtroBusca = $('filtro-busca');
const filtroTipo = $('filtro-tipo');
const filtroStatus = $('filtro-status');
const filtroPrioridade = $('filtro-prioridade');
const filtroPrazo = $('filtro-prazo');
const filtroVistoria = $('filtro-vistoria');
// ---------- Indicadores e fila ----------

// Os 4 indicadores em destaque são botões: cada um filtra a fila (e zera busca, tipo e prioridade, para a lista bater com o número).
function desenharIndicadores(valores) {
  const ativo = indicadorAtivo();
  $('indicadores').replaceChildren(
    ...INDICADORES.map(([chave, rotulo]) => {
      const valor = valores[chave];
      const botao = elemento('button', chave === 'vencidas' && valor > 0 ? 'indicador indicador-alerta' : 'indicador');
      botao.type = 'button';
      botao.dataset.foco = `indicador-${chave}`;
      botao.setAttribute('aria-label', `${rotulo}: ${valor}`);
      botao.setAttribute('aria-pressed', String(ativo === chave));
      botao.append(elemento('span', 'indicador-valor', String(valor)), elemento('span', 'indicador-rotulo', rotulo));
      botao.addEventListener('click', () => clicarIndicador(chave));
      const li = elemento('li');
      li.append(botao);
      return li;
    })
  );
  // Os demais indicadores ficam na aba Relatórios, só para leitura.
  $('indicadores-relatorio').replaceChildren(
    ...COMPLEMENTARES.map(([chave, rotulo]) => {
      const li = elemento('li', 'indicador');
      li.append(elemento('span', 'indicador-valor', String(valores[chave])), elemento('span', 'indicador-rotulo', rotulo));
      return li;
    })
  );
}

// Qual indicador está aplicado agora? Só conta quando os filtros são exatamente os dele.
function indicadorAtivo() {
  const f = filtrosAtuais();
  if (f.busca.trim() !== '' || f.tipo !== '' || f.prioridade !== '' || f.vistoria !== '') return null;
  return INDICADORES.map(([chave]) => chave).find((chave) => FILTRO_DO_INDICADOR[chave].status === f.status && FILTRO_DO_INDICADOR[chave].prazo === f.prazo) ?? null;
}

function aplicarFiltros({ busca = '', tipo = '', status = FILTROS_PADRAO.status, prioridade = '', prazo = '', vistoria = '' }) {
  filtroBusca.value = busca;
  filtroTipo.value = tipo;
  filtroStatus.value = status;
  filtroPrioridade.value = prioridade;
  filtroPrazo.value = prazo;
  filtroVistoria.value = vistoria;
}

// Clicar no indicador aplica o filtro; clicar de novo volta ao padrão.
function clicarIndicador(chave) {
  aplicarFiltros(indicadorAtivo() === chave ? FILTROS_PADRAO : FILTRO_DO_INDICADOR[chave]);
  definirVisao('lista'); // filtrar é comportamento de lista
  estado.focoApos = `indicador-${chave}`;
  atualizar();
}

// Leva ao cartão da demanda na fila: abre o Quadro, ajusta os filtros para que ele apareça, rola até ele, destaca e põe o foco nele.
function irParaDemanda(id) {
  const d = estado.dados.demandas.find((x) => x.id === id);
  if (!d) return;
  let status = FILTROS_PADRAO.status;
  if (estaConcluida(d)) status = 'concluida';
  else if (estaSobrestada(d)) status = 'aguardando';
  aplicarFiltros({ status });
  definirVisao('lista'); // o cartão é procurado na lista
  abrirAba('quadro');
  estado.focoApos = `cartao-${id}`;
  atualizar();
  const alvo = document.querySelector(`[data-foco="cartao-${id}"]`);
  if (!alvo) return;
  alvo.scrollIntoView({ block: 'center' });
  alvo.classList.add('destaque');
  setTimeout(() => alvo.classList.remove('destaque'), 2500);
}

function filtrosAtuais() {
  return { busca: filtroBusca.value, tipo: filtroTipo.value, status: filtroStatus.value, prioridade: filtroPrioridade.value, prazo: filtroPrazo.value, vistoria: filtroVistoria.value };
}

function desenharFila(hoje) {
  const { itens, erros } = listarDemandas(estado.dados.demandas, filtrosAtuais(), hoje, { afastamentos: estado.dados.afastamentos });
  $('fila-vazia').hidden = itens.length > 0;
  $('contagem').textContent = `${itens.length} ${itens.length === 1 ? 'demanda' : 'demandas'}`;
  // Só a visão ativa tem cartões na página: os data-foco (abrir-…, sobrestar-…) não podem se repetir.
  $('fila').replaceChildren(...(visaoAtual() === 'lista' ? itens.map((item) => cartao(item, hoje)) : []));
  $('erros-validacao').hidden = erros.length === 0;
  $('lista-erros').replaceChildren(...erros.map((x) => elemento('li', '', `${x.demanda.id || '(sem id)'} — ${x.demanda.titulo || ''}: ${x.erro}`)));
}

function atualizar() {
  const hoje = hojeAtual();
  $('limpar-filtros').disabled = !filtrosEmUso(filtrosAtuais());
  $('referencia-texto').textContent = formatarData(hoje);
  desenharBanner(hoje);
  desenharIndicadores(calcularIndicadores(estado.dados.demandas, hoje));
  desenharResumo(hoje);
  desenharCalendario(hoje);
  desenharPontos();
  desenharAgenda(hoje);
  desenharFila(hoje);
  desenharQuadro(hoje);
  desenharAfastamentos(hoje);
  desenharPainel(hoje);
  atualizarPontoAberto();
  restaurarFoco();
}

// Volta busca, tipo, status e prioridade ao padrão. Não apaga demandas nem mexe na data de referência.
function limparFiltros() {
  filtroBusca.value = FILTROS_PADRAO.busca;
  filtroTipo.value = FILTROS_PADRAO.tipo;
  filtroStatus.value = FILTROS_PADRAO.status;
  filtroPrioridade.value = FILTROS_PADRAO.prioridade;
  filtroPrazo.value = FILTROS_PADRAO.prazo;
  filtroVistoria.value = FILTROS_PADRAO.vistoria;
  filtroBusca.focus(); // antes de desabilitar o botão, para o foco não se perder
  atualizar();
}

// Devolve true quando a mudança foi aceita (o quadro usa isso para anunciar a movimentação).
function mudarStatus(id, novoStatus, focoApos = `status-${id}`) {
  const i = estado.dados.demandas.findIndex((d) => d.id === id);
  try {
    estado.dados.demandas[i] = alterarStatus(estado.dados.demandas[i], novoStatus, hojeAtual());
  } catch (e) {
    if (!(e instanceof ErroCadastro)) throw e;
    mostrarAviso(Object.values(e.erros)[0]);
    return false;
  }
  persistir();
  estado.focoApos = focoApos;
  atualizar();
  return true;
}

// Exclui sem pedir confirmação: por cerca de 8 s a mensagem oferece "Desfazer" (a demanda volta à mesma posição, com os pontos).
// Só a última exclusão pode ser desfeita, e o prazo acaba ao recarregar a página.
function excluirDemanda(d) {
  const indice = estado.dados.demandas.findIndex((x) => x.id === d.id);
  if (indice < 0) return;
  fecharPainel(false);
  estado.dados.demandas = removerDemanda(estado.dados.demandas, d.id);
  persistir();
  mostrarMensagem('Demanda excluída.', { acao: { rotulo: 'Desfazer', fazer: () => desfazerExclusao(d, indice) } });
  estado.focoApos = 'desfazer';
  atualizar();
}

function desfazerExclusao(d, indice) {
  try {
    estado.dados.demandas = restaurarDemanda(estado.dados.demandas, d, indice);
  } catch (e) {
    if (!(e instanceof ErroCadastro)) throw e;
    mostrarAviso(Object.values(e.erros)[0]);
    return;
  }
  mostrarAviso('');
  persistir();
  mostrarMensagem('Demanda restaurada.');
  estado.focoApos = `abrir-${d.id}`;
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
  iniciarAbas(); // antes de carregar os dados: abrir direto em #relatorios não pisca o Quadro
  estado.atualizar = atualizar;
  estado.irParaDemanda = irParaDemanda;
  estado.abrirPainel = abrirPainel;
  estado.editarPonto = abrirFormularioDoPonto;
  try {
    const resposta = await fetch('data/seed.json');
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
    estado.seed = await resposta.json();
  } catch {
    mostrarAviso('Não foi possível carregar data/seed.json. Abra o painel por "npm start" (não por arquivo local).');
    return;
  }

  // A lista de municípios é só sugestão: se não carregar, o campo continua aceitando texto livre.
  try {
    const resposta = await fetch('data/municipios-mt.json');
    if (resposta.ok) estado.municipios = criarIndiceDeMunicipios(await resposta.json());
  } catch {
    estado.municipios = null;
  }

  estado.storage = acessarStorage();
  const carga = carregar(estado.storage, estado.seed, { municipios: estado.municipios });
  estado.dados = carga.dados;
  if (carga.origem === 'seed') persistir();

  opcoes(filtroTipo, [['', 'Todos'], ...Object.entries(TIPOS)], '');
  opcoes(filtroStatus, [['abertas', 'Abertas (ativas)'], ...Object.entries(STATUS)], 'abertas');
  opcoes(filtroPrioridade, [['', 'Todas'], ...FAIXAS.map((f) => [f, f])], '');
  opcoes(filtroPrazo, Object.entries(FILTRO_PRAZO), '');
  opcoes(filtroVistoria, Object.entries(FILTRO_VISTORIA), '');

  $('usar-data-seed').textContent = `Usar data do exemplo (${formatarData(estado.seed.hoje_referencia)})`;
  $('usar-data-seed').addEventListener('click', () => {
    campoData.value = estado.seed.hoje_referencia;
    atualizar();
  });
  campoData.addEventListener('input', atualizar);
  // A data de referência fica no rodapé ("Referência: dd/mm/aaaa · alterar"); os controles só aparecem ao pedir.
  $('alterar-referencia').addEventListener('click', () => {
    const abrir = $('referencia-controles').hidden;
    $('referencia-controles').hidden = !abrir;
    $('alterar-referencia').setAttribute('aria-expanded', String(abrir));
    if (abrir) campoData.focus();
  });
  for (const f of [filtroBusca, filtroTipo, filtroStatus, filtroPrioridade, filtroPrazo, filtroVistoria]) f.addEventListener('input', atualizar);
  $('filtros').addEventListener('submit', (e) => e.preventDefault());
  $('limpar-filtros').addEventListener('click', limparFiltros);

  iniciarFormulario();
  iniciarFormularioDoPonto();
  iniciarOperacoes();
  iniciarAfastamentos();
  iniciarCalendario();
  iniciarPontos();
  iniciarQuadro({ mudarStatus });
  iniciarPainel({ editar: (d, botao) => abrirFormulario(d, botao), excluir: excluirDemanda, mudarStatus });
  iniciarExportacao();
  atualizar();
}

iniciar();
