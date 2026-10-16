import { test, expect, abrir, irParaAba } from './apoio.mjs';

const nav = (page) => page.getByRole('navigation', { name: 'Seções do painel' });
const aba = (page, nome) => page.locator(`[data-aba-painel="${nome}"]`);
const ROTULOS = { quadro: 'Quadro', agenda: 'Agenda', afastamentos: 'Afastamentos', relatorios: 'Relatórios' };

test.describe('abas pelo endereço e topo fixo (RF15)', () => {
  test('abre no Quadro e cada aba mostra só o seu conteúdo', async ({ page }) => {
    await abrir(page);
    await expect(nav(page).getByRole('link', { name: 'Quadro' })).toHaveAttribute('aria-current', 'page');
    await expect(aba(page, 'quadro')).toBeVisible();
    for (const nome of ['agenda', 'afastamentos', 'relatorios']) await expect(aba(page, nome)).toBeHidden();
    // "Quadro" mostra a fila atual (o quadro Kanban é do M9)
    await expect(page.locator('#fila > li')).toHaveCount(10);

    for (const nome of ['agenda', 'afastamentos', 'relatorios']) {
      await irParaAba(page, ROTULOS[nome]);
      await expect(page).toHaveURL(new RegExp(`#${nome}$`));
      await expect(aba(page, nome)).toBeVisible();
      await expect(aba(page, 'quadro')).toBeHidden();
    }
  });

  test('o endereço abre a aba direto, e Voltar e Avançar acompanham', async ({ page }) => {
    await page.goto('/#relatorios');
    await expect(aba(page, 'relatorios')).toBeVisible();
    await expect(nav(page).getByRole('link', { name: 'Relatórios' })).toHaveAttribute('aria-current', 'page');
    await expect(aba(page, 'quadro')).toBeHidden();

    await irParaAba(page, 'Agenda');
    await page.goBack();
    await expect(aba(page, 'relatorios')).toBeVisible();
    await expect(nav(page).getByRole('link', { name: 'Relatórios' })).toHaveAttribute('aria-current', 'page');
    await page.goForward();
    await expect(aba(page, 'agenda')).toBeVisible();
    await expect(page).toHaveURL(/#agenda$/);
  });

  test('nenhum elemento tem id igual ao nome de uma aba (o endereço viraria âncora)', async ({ page }) => {
    await abrir(page);
    for (const nome of Object.keys(ROTULOS)) await expect(page.locator(`[id="${nome}"]`), nome).toHaveCount(0);
  });

  test('endereço desconhecido cai no Quadro e o endereço é corrigido', async ({ page }) => {
    await page.goto('/#nao-existe');
    await expect(aba(page, 'quadro')).toBeVisible();
    await expect(page).toHaveURL(/#quadro$/);
    await expect(nav(page).getByRole('link', { name: 'Quadro' })).toHaveAttribute('aria-current', 'page');
  });

  test('as abas se operam pelo teclado, com foco visível', async ({ page }) => {
    await abrir(page);
    await nav(page).getByRole('link', { name: 'Quadro' }).focus();
    await page.keyboard.press('Tab');
    const agenda = nav(page).getByRole('link', { name: 'Agenda' });
    await expect(agenda).toBeFocused();
    expect(await agenda.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe('none'); // contorno de foco visível
    await page.keyboard.press('Enter');
    await expect(aba(page, 'agenda')).toBeVisible();
    await expect(agenda).toHaveAttribute('aria-current', 'page');
    await expect(agenda).toBeFocused();
  });

  test('o topo fica fixo ao rolar, com a data de referência e "Nova demanda"', async ({ page }) => {
    await abrir(page);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
    expect((await page.locator('header.topo').boundingBox()).y).toBe(0);
    await expect(page.getByLabel('Data de referência')).toBeInViewport();
    await expect(page.getByRole('button', { name: 'Nova demanda' })).toBeInViewport();

    // e continua funcionando lá embaixo: "Nova demanda" abre o formulário
    await page.getByRole('button', { name: 'Nova demanda' }).click();
    await expect(page.getByRole('dialog', { name: 'Nova demanda' })).toBeVisible();
  });

  test('o foco não fica escondido sob o topo fixo ao navegar pelo teclado', async ({ page }) => {
    await abrir(page);
    const baixo = page.locator('#fila .demanda-abrir').last();
    await baixo.focus();
    const topoBaixo = (await page.locator('header.topo').boundingBox()).height;
    expect((await baixo.boundingBox()).y).toBeGreaterThanOrEqual(topoBaixo - 1);
  });

  test('cabe na largura em todas as abas, e as quatro abas aparecem inteiras', async ({ page }) => {
    await abrir(page);
    for (const rotulo of Object.values(ROTULOS)) {
      await irParaAba(page, rotulo);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), rotulo).toBe(true);
    }
    expect(await nav(page).evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true); // sem rolagem dentro da barra de abas
  });
});
