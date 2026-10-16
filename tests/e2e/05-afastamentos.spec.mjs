import { test, expect, abrir, importarExemplo } from './apoio.mjs';

test.describe('férias, licenças e agenda', () => {
  test('mostra as férias do exemplo com aviso de prazo no período', async ({ page }) => {
    await abrir(page);
    const lista = page.locator('#lista-afastamentos .afastamento');
    await expect(lista).toHaveCount(2);
    await expect(lista.first()).toContainText('Férias · 03/11/2026 a 17/11/2026 · Aprovado');
    await expect(lista.first()).toContainText('1 prazo cai no período');
    await expect(lista.first()).toContainText('Informação técnica para ofício do Poder Judiciário');
  });

  test('cria, edita e remove um afastamento', async ({ page }) => {
    await abrir(page);
    await page.getByRole('button', { name: 'Novo afastamento' }).click();
    const dialogo = page.getByRole('dialog', { name: 'Novo afastamento' });
    await dialogo.getByLabel('Início').fill('2026-12-01');
    await dialogo.getByLabel('Fim').fill('2026-11-30');
    await dialogo.getByRole('button', { name: 'Salvar' }).click();
    await expect(dialogo.getByRole('alert')).toContainText('O fim não pode ser anterior ao início.');
    await expect(dialogo.getByLabel('Fim')).toBeFocused();
    await dialogo.getByLabel('Tipo').selectOption({ label: 'Licença-prêmio' });
    await dialogo.getByLabel('Fim').fill('2026-12-10');
    await dialogo.getByLabel('Situação').selectOption({ label: 'Solicitado' });
    await dialogo.getByRole('button', { name: 'Salvar' }).click();
    await expect(dialogo).toBeHidden();

    const lista = page.locator('#lista-afastamentos .afastamento');
    await expect(lista).toHaveCount(3);
    await expect(lista.nth(1)).toContainText('Licença-prêmio · 01/12/2026 a 10/12/2026 · Solicitado'); // ordenada por início

    await lista.nth(1).getByRole('button', { name: /^Editar/ }).click();
    await page.getByRole('dialog', { name: 'Editar afastamento' }).getByLabel('Situação').selectOption({ label: 'Aprovado' });
    await page.getByRole('dialog', { name: 'Editar afastamento' }).getByRole('button', { name: 'Salvar' }).click();
    await expect(lista.nth(1)).toContainText('Aprovado');

    page.once('dialog', (d) => d.accept()); // confirmação de remoção
    await lista.nth(1).getByRole('button', { name: /^Remover/ }).click();
    await expect(lista).toHaveCount(2);
  });

  test('a viagem da operação importada que coincide com as férias gera aviso', async ({ page }) => {
    await abrir(page);
    await importarExemplo(page);
    await expect(page.locator('#lista-afastamentos .afastamento').first()).toContainText('coincide com o período');
    await expect(page.locator('#lista-afastamentos .afastamento').first()).toContainText('ajustar a escala com a coordenação');
    await expect(page.locator('#aviso-afastamento')).toContainText('viagem de operação coincide');
  });

  test('prazo dentro das férias soma pontos (+20)', async ({ page }) => {
    await abrir(page);
    const c = page.locator('#fila > li', { hasText: 'Informação técnica para ofício do Poder Judiciário' });
    await expect(c.locator('.prioridade')).toHaveText('Prioridade Alta · 60 pontos');
    await c.getByText('Por que esta prioridade?').click();
    await expect(c).toContainText('Prazo dentro de férias ou licença-prêmio (+20)');
  });

  test('a agenda lista os compromissos dos próximos 7 dias e acompanha a data', async ({ page }) => {
    await abrir(page);
    const eventos = page.locator('#agenda .evento');
    await expect(eventos).toHaveCount(3);
    await expect(eventos.nth(0)).toContainText('Prazo de relatórios');
    await expect(eventos.nth(1)).toContainText('Reunião de alinhamento com a coordenação');
    await expect(eventos.nth(1)).toContainText('09:00');
    await expect(eventos.nth(2)).toContainText('Palestra sobre prevenção de desmatamento');
    await page.getByLabel('Data de referência').fill('2026-10-27');
    await expect(page.locator('#agenda')).toContainText('Reunião de planejamento da próxima operação');
    await expect(page.locator('#agenda')).toContainText('Início de férias');
  });
});
