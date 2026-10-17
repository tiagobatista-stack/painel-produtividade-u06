// Calendário mensal: prazos, compromissos e afastamentos (férias, licença-prêmio e compensação) em grade de segunda a domingo.
import { calendarioMes, somarMeses } from './agenda.js';
import { ROTULOS_EVENTO, SITUACOES_AFASTAMENTO, TIPOS_AFASTAMENTO } from './rotulos.js';
import { $, elemento, estado, formatarData } from './ui-comum.js';

const DIAS_SEMANA = [
  ['seg', 'segunda-feira'], ['ter', 'terça-feira'], ['qua', 'quarta-feira'], ['qui', 'quinta-feira'],
  ['sex', 'sexta-feira'], ['sáb', 'sábado'], ['dom', 'domingo'],
];
const MAX_NO_DIA = 3; // eventos visíveis na célula; o restante vira "+N"
const PRAZOS = ['prazo_processo', 'prazo_demanda', 'prazo_relatorio'];
const SITUACAO_OPERACAO = { aberta: 'em andamento', sobrestada: 'sobrestada', concluida: 'concluída' };

let mesDaReferencia = null; // mês (AAAA-MM) da data de referência
let mesExibido = null;
let diaAberto = null; // dia com a lista de compromissos aberta abaixo da grade

const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
const nomeDoMes = (mes) => {
  const nome = new Date(`${mes}-01T00:00:00Z`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return nome[0].toUpperCase() + nome.slice(1); // "Outubro de 2026"
};
const nomeDoDia = (data) =>
  new Date(`${data}T00:00:00Z`).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

// Prazo de demanda aberta que já passou aparece como vencido.
function classeEvento(e, hoje) {
  if (PRAZOS.includes(e.tipo)) return e.data < hoje ? 'atrasado' : 'prazo';
  return 'compromisso';
}

function rotuloDia(dia, hoje) {
  const quando = `${nomeDoDia(dia.data)}${dia.data === hoje ? ' (hoje)' : ''}`;
  const eventos = dia.eventos.length ? plural(dia.eventos.length, 'compromisso', 'compromissos') : 'nenhum compromisso';
  const afastamentos = dia.afastamentos.map((a) => `, ${TIPOS_AFASTAMENTO[a.tipo]}`).join('');
  const operacoes = dia.operacoes.map((o) => `, operação ${o.equipe}`).join('');
  return `${quando}: ${eventos}${afastamentos}${operacoes}`;
}

function celula(dia, hoje) {
  const classes = [];
  if (!dia.doMes) classes.push('fora-do-mes');
  if (dia.data === hoje) classes.push('hoje');
  const td = elemento('td', classes.join(' '));
  const botao = elemento('button', 'dia');
  botao.type = 'button';
  botao.dataset.foco = `dia-${dia.data}`;
  botao.setAttribute('aria-pressed', String(dia.data === diaAberto));
  botao.setAttribute('aria-label', rotuloDia(dia, hoje));
  botao.append(elemento('span', 'dia-numero', String(Number(dia.data.slice(8)))));
  for (const a of dia.afastamentos) botao.append(elemento('span', `faixa faixa-${a.tipo}`, TIPOS_AFASTAMENTO[a.tipo]));
  for (const o of dia.operacoes) botao.append(elemento('span', `periodo periodo-${o.situacao}`, `Operação ${o.equipe.replace(/^Equipe\s+/i, '')}`));
  for (const e of dia.eventos.slice(0, MAX_NO_DIA)) botao.append(elemento('span', `chip chip-${classeEvento(e, hoje)}`, e.titulo));
  if (dia.eventos.length > MAX_NO_DIA) botao.append(elemento('span', 'chip-mais', `+${dia.eventos.length - MAX_NO_DIA}`));
  botao.addEventListener('click', () => {
    diaAberto = diaAberto === dia.data ? null : dia.data;
    estado.focoApos = `dia-${dia.data}`;
    estado.atualizar();
  });
  td.append(botao);
  return td;
}

function itemDetalhe(hora, tipo, conteudo, classe = '') {
  const li = elemento('li', `evento ${classe}`.trim());
  li.append(elemento('span', 'evento-hora', hora), elemento('span', 'evento-tipo', tipo), conteudo);
  return li;
}

function desenharDetalhe(semanas, hoje) {
  const dia = diaAberto && semanas.flat().find((d) => d.data === diaAberto);
  $('calendario-detalhe').hidden = !dia;
  if (!dia) return;
  $('calendario-detalhe-titulo').textContent = `${nomeDoDia(dia.data)}${dia.data === hoje ? ' (hoje)' : ''}`;
  const itens = dia.afastamentos.map((a) =>
    itemDetalhe('período', TIPOS_AFASTAMENTO[a.tipo], elemento('span', 'evento-titulo', `${formatarData(a.inicio)} a ${formatarData(a.fim)} · ${SITUACOES_AFASTAMENTO[a.situacao]}`), `evento-${a.tipo}`)
  );
  for (const o of dia.operacoes) {
    const ir = elemento('button', 'evento-titulo link', `${o.equipe} · ${formatarData(o.saida)} a ${formatarData(o.retorno)} · ${SITUACAO_OPERACAO[o.situacao]}`);
    ir.type = 'button';
    ir.addEventListener('click', () => estado.irParaDemanda(o.id));
    itens.push(itemDetalhe('período', 'Operação', ir, `evento-operacao evento-operacao-${o.situacao}`));
  }
  for (const e of dia.eventos) {
    const ir = elemento('button', 'evento-titulo link', e.titulo);
    ir.type = 'button';
    ir.addEventListener('click', () => estado.irParaDemanda(e.id));
    const vencido = classeEvento(e, hoje) === 'atrasado';
    itens.push(itemDetalhe(e.hora ?? 'dia todo', `${ROTULOS_EVENTO[e.tipo]}${vencido ? ' (vencido)' : ''}`, ir, vencido ? 'evento-atrasado' : ''));
  }
  $('calendario-detalhe-lista').replaceChildren(...(itens.length ? itens : [elemento('li', 'nota', 'Nenhum compromisso neste dia.')]));
}

export function desenharCalendario(hoje) {
  // O calendário acompanha a data de referência; a navegação vale até ela mudar de mês.
  if (hoje.slice(0, 7) !== mesDaReferencia) {
    mesDaReferencia = hoje.slice(0, 7);
    mesExibido = mesDaReferencia;
    diaAberto = null;
  }
  const semanas = calendarioMes(estado.dados.demandas, estado.dados.afastamentos, mesExibido);
  $('calendario-mes').textContent = nomeDoMes(mesExibido);

  const cabeca = elemento('thead');
  const linha = elemento('tr');
  for (const [curto, longo] of DIAS_SEMANA) {
    const th = elemento('th');
    th.scope = 'col';
    const abbr = elemento('abbr', '', curto);
    abbr.title = longo;
    th.append(abbr);
    linha.append(th);
  }
  cabeca.append(linha);
  const corpo = elemento('tbody');
  for (const semana of semanas) {
    const tr = elemento('tr');
    tr.append(...semana.map((dia) => celula(dia, hoje)));
    corpo.append(tr);
  }
  $('calendario').replaceChildren(cabeca, corpo);
  desenharDetalhe(semanas, hoje);
}

function irParaMes(mes, foco) {
  mesExibido = mes;
  diaAberto = null;
  estado.focoApos = foco;
  estado.atualizar();
}

export function iniciarCalendario() {
  $('mes-anterior').addEventListener('click', () => irParaMes(somarMeses(mesExibido, -1), 'mes-anterior'));
  $('mes-seguinte').addEventListener('click', () => irParaMes(somarMeses(mesExibido, 1), 'mes-seguinte'));
  $('mes-referencia').addEventListener('click', () => irParaMes(mesDaReferencia, 'mes-referencia'));
}
