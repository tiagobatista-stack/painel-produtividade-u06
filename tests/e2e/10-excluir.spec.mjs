import { test, expect, abrir, indicadores } from './apoio.mjs';

const TITULO = 'Organizar arquivos digitais da equipe';
const cartaoDe = (page) => page.locator('#fila .demanda', { hasText: TITULO });
const demandasGuardadas = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('painel-demandas:v1')).demandas.length);

test.describe('Excluir demanda (lixeira)', () => {
  test('cancelar a confirmação mantém a demanda', async ({ page }) => {
    await abrir(page);
    const total = await demandasGuardadas(page);
    page.once('dialog', (d) => d.dismiss());
    await cartaoDe(page).getByRole('button', { name: `Excluir ${TITULO}` }).click();
    await expect(cartaoDe(page)).toHaveCount(1);
    expect(await demandasGuardadas(page)).toBe(total);
  });

  test('confirmar exclui, recalcula os indicadores e persiste após recarregar', async ({ page }) => {
    await abrir(page);
    const total = await demandasGuardadas(page);
    const abertas = Number((await indicadores(page))[0]);
    let mensagem = '';
    page.once('dialog', (d) => { mensagem = d.message(); d.accept(); });
    await cartaoDe(page).getByRole('button', { name: `Excluir ${TITULO}` }).click();

    expect(mensagem).toContain(`Excluir a demanda "${TITULO}"?`);
    await expect(cartaoDe(page)).toHaveCount(0);
    await expect(page.getByRole('status')).toHaveText('Demanda excluída.');
    await expect(page.locator('#titulo-fila')).toBeFocused();
    expect(Number((await indicadores(page))[0])).toBe(abertas - 1);
    expect(await demandasGuardadas(page)).toBe(total - 1);

    await page.reload();
    await abrir(page);
    await expect(cartaoDe(page)).toHaveCount(0);
  });
});
