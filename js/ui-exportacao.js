// Interface do resumo da semana e das exportações (CSV, JSON, resumo em texto).
import { ARQUIVOS, csvDemandas, csvPontos, jsonCompleto } from './exportacao.js';
import { resumoSemanal, textoResumoSemanal } from './resumo.js';
import { TIPOS } from './rotulos.js';
import { $, elemento, estado, formatarData, hojeAtual, mostrarMensagem } from './ui-comum.js';

const CARTOES = [
  ['Demandas concluídas', (r) => r.concluidas.total],
  ['Relatórios concluídos', (r) => r.relatoriosConcluidos],
  ['Autos lavrados', (r) => r.autosLavrados],
  ['Relatórios sem auto', (r) => r.relatoriosSemAuto],
];

export function desenharResumo(hoje) {
  const r = resumoSemanal(estado.dados.demandas, hoje);
  $('resumo-periodo').textContent = `Semana de ${formatarData(r.inicio)} a ${formatarData(r.fim)} (segunda a domingo), conforme a data de referência.`;
  $('resumo-semana').replaceChildren(
    ...CARTOES.map(([rotulo, valor]) => {
      const li = elemento('li', 'indicador');
      li.append(elemento('span', 'indicador-valor', String(valor(r))), elemento('span', 'indicador-rotulo', rotulo));
      return li;
    })
  );
  const tipos = Object.entries(r.concluidas.porTipo).filter(([, n]) => n > 0).map(([t, n]) => `${TIPOS[t]}: ${n}`);
  $('resumo-tipos').textContent = tipos.length ? `Concluídas por tipo — ${tipos.join(' · ')}` : 'Nenhuma demanda concluída nesta semana.';
}

function baixar(nome, conteudo, mime) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: mime }));
  const link = elemento('a');
  link.href = url;
  link.download = nome;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportar(chave, gerar) {
  const hoje = hojeAtual();
  const nome = ARQUIVOS[chave].nome(hoje);
  baixar(nome, gerar(hoje), ARQUIVOS[chave].mime);
  mostrarMensagem(`Arquivo gerado: ${nome}. Guarde-o em local institucional; não o envie ao repositório.`);
}

export function iniciarExportacao() {
  const contexto = () => ({ afastamentos: estado.dados.afastamentos });
  $('exp-demandas').addEventListener('click', () => exportar('demandas', (hoje) => csvDemandas(estado.dados.demandas, hoje, contexto())));
  $('exp-pontos').addEventListener('click', () => exportar('pontos', () => csvPontos(estado.dados.demandas)));
  $('exp-json').addEventListener('click', () => exportar('json', () => jsonCompleto(estado.dados, new Date().toISOString())));
  $('exp-resumo').addEventListener('click', () =>
    exportar('resumo', (hoje) => textoResumoSemanal(resumoSemanal(estado.dados.demandas, hoje), hoje))
  );
}
