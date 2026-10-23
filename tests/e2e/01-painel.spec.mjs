import { test, expect, abrir, abrirPainel, complementares, fecharPainel, indicadores, irParaAba, painel, resumo, definirDataDeReferencia } from './apoio.mjs';

test.describe('painel com o exemplo fictício', () => {
  test('abre com título, aviso de dados fictícios, indicadores, resumo da semana e agenda', async ({ page }) => {
    await abrir(page);
    await expect(page).toHaveTitle('Painel de Demandas');
    await expect(page.getByRole('heading', { level: 1, name: 'Painel de Demandas' })).toBeVisible();
    await expect(page.getByText('Exemplo didático com dados fictícios.')).toBeVisible();
    expect(await indicadores(page)).toEqual(['2', '5', '1', '2']); // vencidas, próximos 7 dias, sobrestados, concluídas na semana
    await expect(page.locator('#aviso-afastamento')).toContainText('Férias começam em 19 dias');
    await expect(page.locator('#contagem')).toHaveText('11 demandas');
    await irParaAba(page, 'Relatórios');
    expect(await complementares(page)).toEqual(['11', '9', '2']); // abertas, relatórios pendentes, autos a lavrar
    expect(await resumo(page)).toEqual(['2', '5', '4', '2']);
    await irParaAba(page, 'Agenda');
    await expect(page.locator('#agenda-7-dias .evento')).toHaveCount(4);
  });

  test('mostra os 6 tipos de demanda no exemplo', async ({ page }) => {
    await abrir(page);
    await page.getByRole('search').getByLabel('Status').selectOption({ label: 'Concluída' });
    const etiquetas = new Set();
    for (const status of ['Abertas (ativas)', 'Sobrestado (aguardando)', 'Concluída']) {
      await page.getByRole('search').getByLabel('Status').selectOption({ label: status });
      for (const t of await page.locator('#fila .etiqueta').allTextContents()) etiquetas.add(t);
    }
    expect([...etiquetas].sort()).toEqual(['Licenciamento', 'Operação de alertas', 'Outra', 'Palestra', 'Processo SIGADOC', 'Reunião']);
  });

  test('a fila vem ordenada por prioridade, com score e motivos', async ({ page }) => {
    await abrir(page);
    // O card mostra só a faixa; o placar de cada demanda está no painel lateral.
    expect(await page.locator('#fila .demanda-abrir .status').allTextContents()).toEqual([
      'Crítica', 'Crítica', 'Alta', 'Alta', 'Alta', 'Média', 'Média', 'Média', 'Baixa', 'Baixa', 'Baixa',
    ]);
    const prioridades = [];
    for (let i = 0; i < 11; i++) {
      await page.locator('#fila .demanda-abrir').nth(i).click();
      prioridades.push(await painel(page).locator('.prioridade').textContent());
      await fecharPainel(page);
    }
    expect(prioridades).toEqual([
      'Prioridade Crítica · 90 pontos', 'Prioridade Crítica · 80 pontos', 'Prioridade Alta · 68 pontos', 'Prioridade Alta · 60 pontos',
      'Prioridade Alta · 55 pontos', 'Prioridade Média · 40 pontos', 'Prioridade Média · 35 pontos', 'Prioridade Média · 25 pontos', 'Prioridade Baixa · 20 pontos',
      'Prioridade Baixa · 10 pontos', 'Prioridade Baixa · 0 pontos',
    ]);
    const primeiro = await abrirPainel(page, 'Manifestação em procedimento');
    await expect(primeiro.getByRole('heading', { name: 'Por que esta prioridade?' })).toBeVisible();
    await expect(primeiro).toContainText('Prazo vencido (+50)');
    await expect(primeiro).toContainText('vencida há 2 dias');
  });

  test('mudar a data de referência recalcula tudo', async ({ page }) => {
    await abrir(page);
    await definirDataDeReferencia(page, '2026-10-30');
    expect((await indicadores(page))[0]).toBe('9'); // vencidas
    await irParaAba(page, 'Agenda');
    await expect(page.locator('#agenda-7-dias')).toContainText('Início de férias'); // 03/11 entra na janela de 7 dias
    await definirDataDeReferencia(page, '2026-10-19');
    await irParaAba(page, 'Relatórios');
    expect(await resumo(page)).toEqual(['0', '0', '0', '0']); // semana seguinte, nada concluído
    await expect(page.locator('#resumo-tipos')).toHaveText('Nenhuma demanda concluída nesta semana.');
  });
});
