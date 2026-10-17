import { test, expect, abrir, definirDataDeReferencia, filtros, indicadores, irParaAba, painel } from './apoio.mjs';

const DEM_0003 = 'Manifestação em procedimento do Ministério Público (fictício)';
const DEM_0002 = 'Relatórios de vistoria — operação de setembro (Sul)';
const DEM_0001 = 'Relatórios de vistoria — operação de outubro (Norte)';

const caixa = (page, rotulo) => page.locator('#indicadores').getByRole('button', { name: new RegExp(`^${rotulo}:`) });
const titulos = (page) => page.locator('#fila .demanda-titulo').allTextContents();

test.describe('Sem o bloco "Foco de hoje": o topo da fila cumpre esse papel', () => {
  test('o bloco não existe mais, e os três primeiros da fila são os de maior prioridade (seed em 15/10/2026)', async ({ page }) => {
    await abrir(page);
    await expect(page.locator('#foco, #foco-lista')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Foco de hoje' })).toHaveCount(0);
    expect((await titulos(page)).slice(0, 3)).toEqual([DEM_0003, DEM_0002, DEM_0001]); // 90, 80 e 68 pontos
    await expect(page.locator('#fila .demanda').nth(0)).toContainText('vencida há 2 dias');
    await expect(page.locator('#fila .demanda').nth(2)).toContainText('em 2 dias');
  });

  test('o primeiro da fila abre o painel da demanda; Esc devolve o foco ao item', async ({ page }) => {
    await abrir(page);
    const primeiro = page.locator('#fila .demanda-abrir').first();
    await primeiro.click();
    await expect(painel(page)).toBeVisible();
    await expect(painel(page).getByRole('heading', { name: DEM_0003 })).toBeVisible();
    await expect(painel(page).locator('.prioridade')).toHaveText('Prioridade Crítica · 90 pontos');
    await page.keyboard.press('Escape');
    await expect(painel(page)).toBeHidden();
    await expect(primeiro).toBeFocused();
  });
});

test.describe('Indicadores em destaque (RF15)', () => {
  test('são 4 botões; os demais indicadores foram para a aba Relatórios', async ({ page }) => {
    await abrir(page);
    await expect(page.locator('#indicadores button')).toHaveCount(4);
    expect(await indicadores(page)).toEqual(['2', '5', '1', '2']);
    await expect(page.locator('#indicadores .indicador-rotulo')).toHaveText(['Vencidas', 'Próximos 7 dias', 'Sobrestados', 'Concluídas na semana']);
    await irParaAba(page, 'Relatórios');
    await expect(page.locator('#indicadores-relatorio .indicador-rotulo')).toHaveText(['Abertas', 'Relatórios pendentes', 'Autos a lavrar']);
  });

  test('"Vencidas" fica vermelho só quando é maior que zero', async ({ page }) => {
    await abrir(page);
    const vencidas = caixa(page, 'Vencidas');
    const cor = () => vencidas.locator('.indicador-valor').evaluate((el) => getComputedStyle(el).color);
    await expect(vencidas).toHaveClass(/indicador-alerta/);
    expect(await cor()).toBe('rgb(185, 28, 28)');

    await definirDataDeReferencia(page, '2026-10-01'); // nada vence antes de 06/10
    await expect(vencidas.locator('.indicador-valor')).toHaveText('0');
    await expect(vencidas).not.toHaveClass(/indicador-alerta/);
    expect(await cor()).toBe('rgb(31, 36, 51)'); // o texto neutro da paleta (não o vermelho)
    await expect(caixa(page, 'Sobrestados')).not.toHaveClass(/indicador-alerta/); // só "Vencidas" tem alerta
  });

  test('cada indicador filtra a fila, e o número da caixa é o tamanho da lista', async ({ page }) => {
    await abrir(page);
    const f = filtros(page);
    const casos = [
      ['Vencidas', '2 demandas', 'Abertas (ativas)', 'Vencidas'],
      ['Próximos 7 dias', '5 demandas', 'Abertas (ativas)', 'Próximos 7 dias'],
      ['Sobrestados', '1 demanda', 'Sobrestado (aguardando)', 'Todos'],
      ['Concluídas na semana', '2 demandas', 'Concluída', 'Concluídas na semana'],
    ];
    for (const [rotulo, contagem, status, prazo] of casos) {
      await caixa(page, rotulo).click();
      await expect(page.locator('#contagem')).toHaveText(contagem);
      await expect(caixa(page, rotulo)).toHaveAttribute('aria-pressed', 'true');
      await expect(caixa(page, rotulo)).toBeFocused();
      await expect(f.getByLabel('Status').locator('option:checked')).toHaveText(status);
      await expect(f.getByLabel('Prazo').locator('option:checked')).toHaveText(prazo);
      await expect(page.locator('#indicadores [aria-pressed="true"]')).toHaveCount(1);
      await expect(f.getByRole('button', { name: 'Limpar filtros' })).toBeEnabled();
    }
  });

  test('as vencidas aparecem na ordem do motor e o segundo clique volta à fila completa', async ({ page }) => {
    await abrir(page);
    await caixa(page, 'Vencidas').click();
    expect(await titulos(page)).toEqual([DEM_0003, DEM_0002]);
    await caixa(page, 'Vencidas').click();
    await expect(caixa(page, 'Vencidas')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#contagem')).toHaveText('11 demandas');
    await expect(filtros(page).getByRole('button', { name: 'Limpar filtros' })).toBeDisabled();
  });

  test('clicar zera busca, tipo e prioridade para a lista bater com o número da caixa', async ({ page }) => {
    await abrir(page);
    const f = filtros(page);
    await f.getByLabel('Buscar').fill('reunião');
    await f.getByLabel('Prioridade').selectOption({ label: 'Baixa' });
    await expect(page.locator('#contagem')).toHaveText('1 demanda'); // reunião de prioridade baixa
    await caixa(page, 'Próximos 7 dias').click();
    await expect(f.getByLabel('Buscar')).toHaveValue('');
    await expect(f.getByLabel('Prioridade')).toHaveValue('');
    await expect(page.locator('#contagem')).toHaveText('5 demandas');
  });

  test('o select "Prazo" é o mesmo filtro: escolher "Vencidas" marca a caixa, e "Limpar filtros" desmarca', async ({ page }) => {
    await abrir(page);
    const f = filtros(page);
    await f.getByLabel('Prazo').selectOption({ label: 'Vencidas' });
    await expect(page.locator('#contagem')).toHaveText('2 demandas');
    await expect(caixa(page, 'Vencidas')).toHaveAttribute('aria-pressed', 'true');
    await f.getByLabel('Status').selectOption({ label: 'Concluída' }); // combinação sem sentido: lista vazia, sem erro
    await expect(page.locator('#contagem')).toHaveText('0 demandas');
    await expect(caixa(page, 'Vencidas')).toHaveAttribute('aria-pressed', 'false');
    await f.getByRole('button', { name: 'Limpar filtros' }).click();
    await expect(page.locator('#contagem')).toHaveText('11 demandas');
    await expect(f.getByLabel('Prazo')).toHaveValue('');
    await expect(page.locator('#indicadores [aria-pressed="true"]')).toHaveCount(0);
  });
});
