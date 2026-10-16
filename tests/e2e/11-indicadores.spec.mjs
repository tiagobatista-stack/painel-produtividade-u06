import { test, expect, abrir, filtros } from './apoio.mjs';

const caixa = (page, nome) => page.locator('#indicadores').getByRole('button', { name: new RegExp(`^${nome}:`) });
const painel = (page) => page.locator('#painel-indicador');
const itens = (page) => painel(page).locator('.item-indicador');

test.describe('Indicadores clicáveis', () => {
  test('a caixa abre e fecha a lista das demandas que formam o número', async ({ page }) => {
    await abrir(page);
    const vencidas = caixa(page, 'Vencidas');
    await expect(vencidas).toHaveAttribute('aria-expanded', 'false');
    await expect(painel(page)).toBeHidden();

    await vencidas.click();
    await expect(vencidas).toHaveAttribute('aria-expanded', 'true');
    await expect(painel(page)).toBeVisible();
    await expect(painel(page).getByRole('heading')).toHaveText('Vencidas (2)');
    await expect(itens(page)).toHaveCount(2);

    // Só um painel aberto por vez: outra caixa troca o conteúdo.
    await caixa(page, 'Relatórios pendentes').click();
    await expect(vencidas).toHaveAttribute('aria-expanded', 'false');
    await expect(painel(page).getByRole('heading')).toHaveText('Relatórios pendentes (9)');
    await expect(itens(page)).toHaveCount(2);
    await expect(itens(page).first()).toContainText('3 relatórios pendentes');

    // Esc fecha e devolve o foco à caixa.
    await page.keyboard.press('Escape');
    await expect(painel(page)).toBeHidden();
    await expect(caixa(page, 'Relatórios pendentes')).toBeFocused();

    await caixa(page, 'Abertas').click();
    await painel(page).getByRole('button', { name: 'Fechar' }).click();
    await expect(painel(page)).toBeHidden();
  });

  test('escolher uma demanda leva até o cartão dela na fila', async ({ page }) => {
    await abrir(page);
    await filtros(page).getByLabel('Buscar').fill('reunião'); // o cartão escolhido está fora desta busca
    await caixa(page, 'Vencidas').click();
    const primeiro = itens(page).first();
    const titulo = await primeiro.locator('.item-indicador-titulo').textContent();
    await primeiro.click();

    await expect(painel(page)).toBeHidden();
    await expect(filtros(page).getByLabel('Buscar')).toHaveValue('');
    const cartao = page.locator('#fila .demanda', { hasText: titulo });
    await expect(cartao).toBeFocused();
    await expect(cartao).toBeInViewport();
    await expect(cartao).toHaveClass(/destaque/);
  });

  test('sobrestados e concluídas trocam o filtro de status para mostrar o cartão', async ({ page }) => {
    await abrir(page);
    await caixa(page, 'Sobrestados').click();
    await itens(page).first().click();
    await expect(filtros(page).getByLabel('Status')).toHaveValue('aguardando');
    await expect(page.locator('#fila .demanda.sobrestada').first()).toBeFocused();

    await caixa(page, 'Concluídas na semana').click();
    await expect(itens(page)).toHaveCount(2);
    await itens(page).nth(1).click();
    await expect(filtros(page).getByLabel('Status')).toHaveValue('concluida');
    await expect(page.locator('#fila .demanda.concluida:focus')).toHaveCount(1);
  });
});
