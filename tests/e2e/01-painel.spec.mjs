import { test, expect, abrir, cartao, indicadores, resumo } from './apoio.mjs';

test.describe('painel com o exemplo fictício', () => {
  test('abre com título, aviso de dados fictícios, indicadores, resumo da semana e agenda', async ({ page }) => {
    await abrir(page);
    await expect(page).toHaveTitle('Painel de Demandas');
    await expect(page.getByRole('heading', { level: 1, name: 'Painel de Demandas' })).toBeVisible();
    await expect(page.getByText('Exemplo didático com dados fictícios.')).toBeVisible();
    expect(await indicadores(page)).toEqual(['10', '2', '5', '9', '2', '2', '1']);
    expect(await resumo(page)).toEqual(['2', '5', '4', '2']);
    await expect(page.locator('#agenda .evento')).toHaveCount(3);
    await expect(page.locator('#aviso-afastamento')).toContainText('Férias começam em 19 dias');
    await expect(page.locator('#contagem')).toHaveText('10 demandas');
  });

  test('mostra os 5 tipos de demanda no exemplo', async ({ page }) => {
    await abrir(page);
    await page.getByRole('search').getByLabel('Status').selectOption({ label: 'Concluída' });
    const etiquetas = new Set();
    for (const status of ['Abertas (ativas)', 'Sobrestado (aguardando)', 'Concluída']) {
      await page.getByRole('search').getByLabel('Status').selectOption({ label: status });
      for (const t of await page.locator('#fila .etiqueta').allTextContents()) etiquetas.add(t);
    }
    expect([...etiquetas].sort()).toEqual(['Operação de alertas', 'Outra', 'Palestra', 'Processo SIGADOC', 'Reunião']);
  });

  test('a fila vem ordenada por prioridade, com score e motivos', async ({ page }) => {
    await abrir(page);
    const prioridades = await page.locator('#fila .prioridade').allTextContents();
    expect(prioridades).toEqual([
      'Prioridade Crítica · 90 pontos', 'Prioridade Crítica · 80 pontos', 'Prioridade Alta · 68 pontos', 'Prioridade Alta · 60 pontos',
      'Prioridade Alta · 55 pontos', 'Prioridade Média · 40 pontos', 'Prioridade Média · 35 pontos', 'Prioridade Baixa · 20 pontos',
      'Prioridade Baixa · 10 pontos', 'Prioridade Baixa · 0 pontos',
    ]);
    const primeiro = cartao(page, 'Manifestação em procedimento');
    await primeiro.getByText('Por que esta prioridade?').click();
    await expect(primeiro.locator('details.motivos').first()).toContainText('Prazo vencido (+50)');
    await expect(primeiro).toContainText('vencida há 2 dias');
  });

  test('mudar a data de referência recalcula tudo', async ({ page }) => {
    await abrir(page);
    await page.getByLabel('Data de referência').fill('2026-10-30');
    expect((await indicadores(page))[1]).toBe('9'); // vencidas
    await expect(page.locator('#agenda')).toContainText('Início de férias'); // 03/11 entra na janela de 7 dias
    await page.getByLabel('Data de referência').fill('2026-10-19');
    expect(await resumo(page)).toEqual(['0', '0', '0', '0']); // semana seguinte, nada concluído
    await expect(page.locator('#resumo-tipos')).toHaveText('Nenhuma demanda concluída nesta semana.');
  });
});
