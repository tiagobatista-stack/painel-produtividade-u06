import { test, expect, abrir, abrirMenuExportar, abrirPainel, cadastrarProcesso, importarExemplo } from './apoio.mjs';

// Versão mobile (360 px): só roda no projeto "mobile".
test.skip(({ isMobile }) => !isMobile, 'somente no projeto mobile');

const semRolagemHorizontal = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test.describe('versão mobile (360 px)', () => {
  test('a página cabe na largura, sem rolagem horizontal', async ({ page }) => {
    await abrir(page);
    expect(await page.evaluate(() => window.innerWidth)).toBe(360);
    expect(await semRolagemHorizontal(page)).toBe(true);
    await expect(page.locator('#fila > li').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nova demanda' })).toBeVisible();
    await abrirMenuExportar(page); // as exportações ficam no menu "Exportar" da aba Relatórios
    expect(await semRolagemHorizontal(page)).toBe(true);
  });

  test('os cartões da fila ocupam uma coluna e cabem na tela', async ({ page }) => {
    await abrir(page);
    const caixas = await page.locator('#fila > li').evaluateAll((els) => els.slice(0, 4).map((e) => e.getBoundingClientRect()));
    for (const c of caixas) {
      expect(c.left).toBeGreaterThanOrEqual(0);
      expect(c.right).toBeLessThanOrEqual(360);
    }
    expect(new Set(caixas.map((c) => Math.round(c.left))).size).toBe(1); // todos alinhados: uma coluna
  });

  test('os diálogos cabem na largura e funcionam por toque', async ({ page }) => {
    await abrir(page);
    await page.getByRole('button', { name: 'Nova demanda' }).tap();
    const dialogo = page.getByRole('dialog', { name: 'Nova demanda' });
    const caixa = await dialogo.boundingBox();
    expect(caixa.x).toBeGreaterThanOrEqual(0);
    expect(caixa.x + caixa.width).toBeLessThanOrEqual(360);
    await dialogo.getByRole('button', { name: 'Cancelar' }).tap();
    await expect(dialogo).toBeHidden();

    await page.getByRole('button', { name: 'Importar operação' }).tap();
    const importacao = page.getByRole('dialog', { name: 'Importar operação' });
    await importacao.getByRole('button', { name: 'Usar planilha de exemplo' }).tap();
    await expect(importacao.locator('#imp-previa')).toContainText('Planilha válida');
    const c2 = await importacao.boundingBox();
    expect(c2.x + c2.width).toBeLessThanOrEqual(360);
    await importacao.getByRole('button', { name: 'Cancelar' }).tap();
  });

  test('cadastrar e importar continuam funcionando no celular, sem estourar a largura', async ({ page }) => {
    await abrir(page);
    await cadastrarProcesso(page, { titulo: 'Processo no celular' });
    await expect(page.locator('#contagem')).toHaveText('12 demandas');
    await importarExemplo(page);
    await expect(page.locator('#contagem')).toHaveText('13 demandas');
    const op = await abrirPainel(page, 'Equipe Fictícia Leste'); // os pontos e o retorno ficam no painel lateral
    await op.getByRole('button', { name: /Registrar retorno de/ }).tap();
    await page.getByRole('dialog', { name: 'Registrar retorno' }).getByRole('button', { name: 'Registrar retorno' }).tap();
    await expect(op.locator('details.pontos')).toHaveJSProperty('open', true);
    expect(await semRolagemHorizontal(page)).toBe(true);
  });

  test('o texto continua legível: nenhum controle principal menor que 32 px de altura', async ({ page }) => {
    await abrir(page);
    const alturas = await page.locator('button:visible, select:visible').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
    expect(alturas.length).toBeGreaterThan(10);
    expect(Math.min(...alturas)).toBeGreaterThanOrEqual(32);
  });
});
