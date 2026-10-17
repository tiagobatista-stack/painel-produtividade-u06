import { readFileSync } from 'node:fs';
import { test, expect, abrir, abrirMenuExportar, cadastrarProcesso, importarExemplo, irParaAba, resumo } from './apoio.mjs';

async function baixar(page, botao) {
  const item = page.getByRole('button', { name: botao });
  if (!(await item.isVisible())) await abrirMenuExportar(page); // as exportações ficam no menu "Exportar" da aba Relatórios
  const [download] = await Promise.all([page.waitForEvent('download'), item.click()]);
  return { nome: download.suggestedFilename(), conteudo: readFileSync(await download.path()) };
}
const linhas = (buffer) => buffer.toString('utf8').replace(/^﻿/, '').split('\r\n').filter(Boolean);

test.describe('resumo da semana e exportações', () => {
  test('exporta o CSV de demandas pensado para o Excel em português', async ({ page }) => {
    await abrir(page);
    const { nome, conteudo } = await baixar(page, 'Exportar demandas (CSV)');
    expect(nome).toBe('demandas-2026-10-15.csv');
    expect([...conteudo.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]); // BOM UTF-8
    const l = linhas(conteudo);
    expect(l).toHaveLength(15); // cabeçalho + 14 demandas
    expect(l[0]).toMatch(/^ID;TIPO;TITULO;/);
    const colunaSobrestada = l[0].split(';').indexOf('SOBRESTADA');
    expect(l.some((x) => x.includes('Sobrestado (aguardando)') && x.split(';')[colunaSobrestada] === 'sim')).toBe(true);
    expect(l[0]).toMatch(/;ENDERECO;COORD_X;COORD_Y$/); // endereço e coordenadas no fim, só nas demandas que têm localização
    const dem3 = l.find((x) => x.startsWith('DEM-0003;'));
    expect(dem3.endsWith(';Rodovia Fictícia, km 40 (referência fictícia);-27,2;-12,5')).toBe(true);
    expect(l.find((x) => x.startsWith('DEM-0011;'))).toMatch(/;;;$/); // sem localização: três células vazias
    await expect(page.locator('#mensagem')).toContainText('Arquivo gerado: demandas-2026-10-15.csv');
  });

  test('exporta o CSV de pontos com as coordenadas fictícias e as colunas da planilha', async ({ page }) => {
    await abrir(page);
    const { nome, conteudo } = await baixar(page, 'Exportar pontos (CSV)');
    expect(nome).toBe('pontos-2026-10-15.csv');
    const l = linhas(conteudo);
    expect(l).toHaveLength(22); // 13 + 8 pontos
    expect(l[0].startsWith('N_PONTO;EQUIPE;COORD_X;COORD_Y;MUNICIPIO;DAT_SAIDA;DAT_RETOR;NOT_PLANEJ;')).toBe(true);
    expect(l[1].startsWith('1;Equipe Fictícia Norte;-20,113;-15,193;')).toBe(true);
  });

  test('o resumo semanal em texto traz os mesmos números da tela', async ({ page }) => {
    await abrir(page);
    const naTela = await resumo(page); // concluídas, relatórios, autos, sem auto
    expect(naTela).toEqual(['2', '5', '4', '2']);
    const { nome, conteudo } = await baixar(page, 'Resumo semanal (TXT)');
    expect(nome).toBe('resumo-semanal-2026-10-15.txt');
    const texto = conteudo.toString('utf8');
    expect(texto).toContain('Semana de 12/10/2026 a 18/10/2026');
    expect(texto).toContain(`Demandas concluídas: ${naTela[0]} (Processo SIGADOC: 1; Reunião: 1)`);
    expect(texto).toContain(`Relatórios de vistoria concluídos: ${naTela[1]} (${naTela[3]} sem auto)`);
    expect(texto).toContain(`Autos de infração lavrados: ${naTela[2]}`);
  });

  test('a cópia completa em JSON reflete o que está no navegador', async ({ page }) => {
    await abrir(page);
    await cadastrarProcesso(page, { titulo: 'Processo para o JSON' });
    const { nome, conteudo } = await baixar(page, 'Cópia completa (JSON)');
    expect(nome).toBe('painel-2026-10-15.json');
    const dados = JSON.parse(conteudo.toString('utf8'));
    expect(dados.versao).toBe(1);
    expect(dados.demandas).toHaveLength(15);
    expect(dados.demandas.some((d) => d.titulo === 'Processo para o JSON')).toBe(true);
    expect(dados.afastamentos).toHaveLength(2);
  });

  test('fórmulas vindas de texto digitado ou colado não viram fórmula no CSV', async ({ page }) => {
    await abrir(page);
    await cadastrarProcesso(page, { titulo: '=HYPERLINK("http://exemplo")' });
    const { conteudo } = await baixar(page, 'Exportar demandas (CSV)');
    const linha = linhas(conteudo).find((x) => x.includes('HYPERLINK'));
    expect(linha).toContain(`"'=HYPERLINK(""http://exemplo"")"`);
    expect(linhas(conteudo).some((x) => x.split(';').some((c) => /^[=+@]/.test(c)))).toBe(false);
  });

  test('os pontos da operação importada saem no CSV e podem ser colados de volta na importação', async ({ page }) => {
    await abrir(page);
    await importarExemplo(page);
    const { conteudo } = await baixar(page, 'Exportar pontos (CSV)');
    const leste = linhas(conteudo).filter((x) => x.includes(';DEM-0015;'));
    expect(leste).toHaveLength(13);
    expect(leste[0].startsWith('1;Equipe Fictícia Leste;-20,5137;-15,5937;Município Fictício A;09/11/2026;13/11/2026;')).toBe(true);

    const csv = [linhas(conteudo)[0], ...leste].join('\r\n');
    await irParaAba(page, 'Demandas');
    await page.getByRole('button', { name: 'Importar operação' }).click();
    const dialogo = page.getByRole('dialog', { name: 'Importar operação' });
    await dialogo.getByLabel('Linhas da planilha').fill(`﻿${csv}`);
    await expect(dialogo.locator('#imp-previa')).toContainText('Planilha válida');
    await expect(dialogo.locator('#imp-previa')).toContainText('13 pontos');
  });
});
