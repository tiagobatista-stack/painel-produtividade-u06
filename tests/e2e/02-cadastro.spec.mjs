import { test, expect, abrir, cadastrarProcesso, cartao, indicadores, usarDataDoExemplo } from './apoio.mjs';

test.describe('cadastro, edição e status', () => {
  test('cadastra uma demanda e ela aparece com a prioridade calculada, e persiste ao recarregar', async ({ page }) => {
    await abrir(page);
    await cadastrarProcesso(page, { titulo: 'Processo novo de teste' });
    await expect(page.locator('#contagem')).toHaveText('11 demandas');
    const nova = cartao(page, 'Processo novo de teste');
    await expect(nova.locator('.prioridade')).toHaveText('Prioridade Crítica · 90 pontos');
    expect((await indicadores(page)).slice(0, 2)).toEqual(['11', '3']);

    await page.reload();
    await usarDataDoExemplo(page);
    await expect(page.locator('#contagem')).toHaveText('11 demandas');
    await expect(cartao(page, 'Processo novo de teste')).toBeVisible();
  });

  test('o formulário valida os campos e anuncia os erros', async ({ page }) => {
    await abrir(page);
    await page.getByRole('button', { name: 'Nova demanda' }).click();
    const dialogo = page.getByRole('dialog', { name: 'Nova demanda' });
    await dialogo.getByLabel('Prazo', { exact: true }).fill('');
    await dialogo.getByRole('button', { name: 'Salvar' }).click();
    await expect(dialogo.getByRole('alert')).toContainText('Informe o título.');
    await expect(dialogo.getByRole('alert')).toContainText('Informe o número do processo');
    await expect(dialogo.getByLabel('Título')).toHaveAttribute('aria-invalid', 'true');
    await expect(dialogo.getByLabel('Título')).toBeFocused();
    await dialogo.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialogo).toBeHidden();
    await expect(page.locator('#contagem')).toHaveText('10 demandas');
  });

  test('prazo impossível (31/02) é recusado', async ({ page }) => {
    await abrir(page);
    await page.getByRole('button', { name: 'Nova demanda' }).click();
    const dialogo = page.getByRole('dialog', { name: 'Nova demanda' });
    await dialogo.getByLabel('Título').fill('Prazo impossível');
    await dialogo.getByLabel('Nº do processo (fictício)').fill('SEMA-PRO-FICT-1');
    // O campo de data do navegador não aceita 31/02; o valor chega vazio e o formulário recusa.
    await dialogo.getByLabel('Prazo', { exact: true }).evaluate((el) => { el.value = '2026-02-31'; });
    await dialogo.getByRole('button', { name: 'Salvar' }).click();
    await expect(dialogo.getByRole('alert')).toContainText('Informe um prazo válido.');
  });

  test('os campos do formulário mudam conforme o tipo', async ({ page }) => {
    await abrir(page);
    await page.getByRole('button', { name: 'Nova demanda' }).click();
    const dialogo = page.getByRole('dialog', { name: 'Nova demanda' });
    await expect(dialogo.getByLabel('Nº do processo (fictício)')).toBeVisible();
    await dialogo.getByLabel('Tipo').selectOption({ label: 'Palestra' });
    await expect(dialogo.getByLabel('Público esperado (pessoas)')).toBeVisible();
    await expect(dialogo.getByLabel('Local')).toBeVisible();
    await expect(dialogo.getByLabel('Nº do processo (fictício)')).toBeHidden();
    await expect(dialogo.getByLabel('Origem').locator('option')).toHaveText(['Chefia', 'Própria']);
    await dialogo.getByLabel('Tipo').selectOption({ label: 'Processo SIGADOC' });
    await expect(dialogo.getByLabel('Origem').locator('option')).toHaveCount(7);
  });

  test('edita uma demanda e registra no histórico', async ({ page }) => {
    await abrir(page);
    await page.getByRole('button', { name: /^Editar Reunião de alinhamento/ }).click();
    const dialogo = page.getByRole('dialog', { name: 'Editar demanda' });
    await expect(dialogo.getByLabel('Tipo')).toBeDisabled();
    await dialogo.getByLabel('Título').fill('Reunião remarcada');
    await dialogo.getByRole('button', { name: 'Salvar' }).click();
    const c = cartao(page, 'Reunião remarcada');
    await expect(c).toBeVisible();
    await c.getByText(/Histórico/).click();
    await expect(c).toContainText('Editada');
  });

  test('muda o status, guarda o histórico e a demanda concluída sai da fila', async ({ page }) => {
    await abrir(page);
    const c = cartao(page, 'Reunião de planejamento da próxima operação');
    await c.getByLabel('Status').selectOption({ label: 'Em andamento' });
    await c.getByText(/Histórico/).click();
    await expect(c).toContainText('Status: A fazer → Em andamento');
    await c.getByLabel('Status').selectOption({ label: 'Concluída' });
    await expect(page.locator('#contagem')).toHaveText('9 demandas');
    await expect(page.locator('#titulo-fila')).toBeFocused(); // o foco não se perde quando o cartão sai da lista
    expect((await indicadores(page))[5]).toBe('3'); // concluídas na semana
  });

  test('sobrestar um processo suspende o prazo: sai da fila e entra em "Sobrestados"', async ({ page }) => {
    await abrir(page);
    await cartao(page, 'Resposta à chefia sobre processo').getByLabel('Status').selectOption({ label: 'Sobrestado (aguardando)' });
    const v = await indicadores(page);
    expect([v[0], v[6]]).toEqual(['9', '2']);
    await page.getByRole('search').getByLabel('Status').selectOption({ label: 'Sobrestado (aguardando)' });
    await expect(page.locator('#contagem')).toHaveText('2 demandas');
    await expect(cartao(page, 'Resposta à chefia sobre processo')).toContainText('prazo suspenso');
    // retomar: o prazo registrado volta a valer
    await cartao(page, 'Resposta à chefia sobre processo').getByLabel('Status').selectOption({ label: 'Em andamento' });
    await page.getByRole('search').getByLabel('Status').selectOption({ label: 'Abertas (ativas)' });
    await expect(page.locator('#contagem')).toHaveText('10 demandas');
    await expect(cartao(page, 'Resposta à chefia sobre processo')).toContainText('Prazo: 16/10/2026');
  });
});
