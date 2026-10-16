import { test, expect, abrir, filtros } from './apoio.mjs';

test.describe('busca e filtros', () => {
  test('filtra por tipo', async ({ page }) => {
    await abrir(page);
    await filtros(page).getByLabel('Tipo').selectOption({ label: 'Operação de alertas' });
    await expect(page.locator('#contagem')).toHaveText('2 demandas');
    await expect(page.locator('#fila .etiqueta')).toHaveText(['Operação de alertas', 'Operação de alertas']);
    await filtros(page).getByLabel('Tipo').selectOption({ label: 'Reunião' });
    await expect(page.locator('#contagem')).toHaveText('2 demandas');
    await expect(page.locator('#fila .etiqueta')).toHaveText(['Reunião', 'Reunião']);
  });

  test('filtra por prioridade e por status', async ({ page }) => {
    await abrir(page);
    await filtros(page).getByLabel('Prioridade').selectOption({ label: 'Crítica' });
    await expect(page.locator('#contagem')).toHaveText('2 demandas');
    await filtros(page).getByLabel('Prioridade').selectOption({ label: 'Todas' });
    await filtros(page).getByLabel('Status').selectOption({ label: 'Concluída' });
    await expect(page.locator('#contagem')).toHaveText('2 demandas');
    await expect(page.locator('#fila .prioridade').first()).toContainText('Concluída em');
    await filtros(page).getByLabel('Status').selectOption({ label: 'Sobrestado (aguardando)' });
    await expect(page.locator('#contagem')).toHaveText('1 demanda');
    await expect(page.locator('#fila')).toContainText('Resposta a manifestação de ouvidoria');
  });

  test('a busca ignora acentos e maiúsculas e combina com os filtros', async ({ page }) => {
    await abrir(page);
    await filtros(page).getByLabel('Buscar').fill('MINISTERIO');
    await expect(page.locator('#contagem')).toHaveText('1 demanda');
    await expect(page.locator('#fila')).toContainText('Manifestação em procedimento do Ministério Público');
    await filtros(page).getByLabel('Buscar').fill('SEMA-PRO-FICT-0063');
    await expect(page.locator('#fila')).toContainText('Resposta à chefia');
    await filtros(page).getByLabel('Buscar').fill('auditório');
    await expect(page.locator('#fila')).toContainText('Palestra sobre prevenção');
    await filtros(page).getByLabel('Buscar').fill('município fictício');
    await expect(page.locator('#contagem')).toHaveText('2 demandas'); // as duas operações, pelos municípios dos pontos
    await filtros(page).getByLabel('Tipo').selectOption({ label: 'Reunião' });
    await expect(page.locator('#fila-vazia')).toBeVisible();
    await expect(page.locator('#contagem')).toHaveText('0 demandas');
  });

  test('Enter na busca não recarrega a página', async ({ page }) => {
    await abrir(page);
    await filtros(page).getByLabel('Buscar').fill('reunião');
    await filtros(page).getByLabel('Buscar').press('Enter');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('#contagem')).toHaveText('2 demandas'); // o filtro continua aplicado
  });
});
