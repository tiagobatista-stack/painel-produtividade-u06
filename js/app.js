import { calcularIndicadores, filaOrdenada, relatoriosPendentes, autosALavrar, diasEntre, dataValida } from './indicadores.js';

const TIPOS = { operacao: 'Operação de alertas', processo: 'Processo SIGADOC', reuniao: 'Reunião', palestra: 'Palestra', outra: 'Outra' };
const ORIGENS = {
  mp: 'Ministério Público', judiciario: 'Poder Judiciário', procuradoria: 'Procuradoria de Justiça',
  ouvidoria: 'Ouvidoria', denuncia: 'Denúncia', chefia: 'Chefia', propria: 'Própria',
};
const STATUS = { a_fazer: 'A fazer', em_andamento: 'Em andamento', aguardando: 'Aguardando', concluida: 'Concluída' };
const INDICADORES = [
  ['abertas', 'Abertas'],
  ['vencidas', 'Vencidas'],
  ['proximos7', 'Próximos 7 dias'],
  ['relatoriosPendentes', 'Relatórios pendentes'],
  ['autosALavrar', 'Autos a lavrar'],
  ['concluidasSemana', 'Concluídas na semana'],
];

const campoData = document.getElementById('data-referencia');
const botaoSeed = document.getElementById('usar-data-seed');
const listaIndicadores = document.getElementById('indicadores');
const listaFila = document.getElementById('fila');
const vazio = document.getElementById('fila-vazia');
const erro = document.getElementById('erro');

let seed = null;

function hojeLocal() {
  return new Date().toLocaleDateString('en-CA');
}

function formatarData(iso) {
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

function textoPrazo(prazo, hoje) {
  if (prazo === null) return { texto: 'Sem prazo válido', vencida: false };
  const dias = diasEntre(hoje, prazo);
  if (dias < 0) return { texto: `${formatarData(prazo)} · vencida há ${-dias} ${dias === -1 ? 'dia' : 'dias'}`, vencida: true };
  if (dias === 0) return { texto: `${formatarData(prazo)} · vence hoje`, vencida: false };
  return { texto: `${formatarData(prazo)} · em ${dias} ${dias === 1 ? 'dia' : 'dias'}`, vencida: false };
}

function elemento(tag, classe, texto) {
  const el = document.createElement(tag);
  if (classe) el.className = classe;
  if (texto !== undefined) el.textContent = texto;
  return el;
}

function desenharIndicadores(valores) {
  listaIndicadores.replaceChildren(
    ...INDICADORES.map(([chave, rotulo]) => {
      const li = elemento('li', 'indicador');
      li.append(elemento('span', 'indicador-valor', String(valores[chave])), elemento('span', 'indicador-rotulo', rotulo));
      return li;
    })
  );
}

function desenharFila(hoje) {
  const fila = filaOrdenada(seed.demandas);
  vazio.hidden = fila.length > 0;
  listaFila.replaceChildren(
    ...fila.map(({ demanda: d, prazo }) => {
      const info = textoPrazo(prazo, hoje);
      const li = elemento('li', `demanda tipo-${d.tipo}${info.vencida ? ' vencida' : ''}`);
      const topo = elemento('div', 'demanda-topo');
      topo.append(elemento('span', 'etiqueta', TIPOS[d.tipo]), elemento('span', 'status', STATUS[d.status]));
      const detalhes = elemento('p', 'demanda-detalhe', `Origem: ${ORIGENS[d.origem]}`);
      li.append(topo, elemento('h3', 'demanda-titulo', d.titulo), detalhes, elemento('p', 'demanda-prazo', `Prazo: ${info.texto}`));
      if (d.tipo === 'operacao') {
        const pend = relatoriosPendentes(d);
        const autos = autosALavrar(d);
        li.append(elemento('p', 'demanda-detalhe', `${pend} ${pend === 1 ? 'relatório pendente' : 'relatórios pendentes'} · ${autos} ${autos === 1 ? 'auto a lavrar' : 'autos a lavrar'}`));
      }
      return li;
    })
  );
}

function atualizar() {
  const hoje = dataValida(campoData.value) ? campoData.value : hojeLocal();
  desenharIndicadores(calcularIndicadores(seed.demandas, hoje));
  desenharFila(hoje);
}

async function iniciar() {
  campoData.value = hojeLocal();
  try {
    const resposta = await fetch('data/seed.json');
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
    seed = await resposta.json();
  } catch (e) {
    erro.textContent = 'Não foi possível carregar data/seed.json. Abra o painel por "npm start" (não por arquivo local).';
    erro.hidden = false;
    return;
  }
  botaoSeed.textContent = `Usar data do exemplo (${formatarData(seed.hoje_referencia)})`;
  botaoSeed.addEventListener('click', () => {
    campoData.value = seed.hoje_referencia;
    atualizar();
  });
  campoData.addEventListener('input', atualizar);
  atualizar();
}

iniciar();
