import { test, expect, abrir, filtros, indicadores } from './apoio.mjs';

const botao = (page) => page.getByRole('button', { name: 'Limpar filtros' });
const titulos = (page) => page.locator('#fila .demanda-titulo').allTextContents();
const demandasGuardadas = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('painel-demandas:v1')).demandas.length);

// Aplica um filtro isolado pelo nome do campo.
async function aplicar(page, campo, valor) {
  const f = filtros(page);
  if (campo === 'Buscar') await f.getByLabel('Buscar').fill(valor);
  else await f.getByLabel(campo).selectOption({ label: valor });
}

test.describe('Limpar filtros (RF12)', () => {
  test('começa desabilitado e só habilita quando há algum filtro aplicado', async ({ page }) => {
    await abrir(page);
    await expect(botao(page)).toBeDisabled();

    await aplicar(page, 'Buscar', 'minist');
    await expect(botao(page)).toBeEnabled();
    await aplicar(page, 'Buscar', '');
    await expect(botao(page)).toBeDisabled();

    await aplicar(page, 'Buscar', '    '); // só espaços não filtra nada
    await expect(botao(page)).toBeDisabled();
    await aplicar(page, 'Buscar', '');

    await aplicar(page, 'Tipo', 'Reunião');
    await expect(botao(page)).toBeEnabled();
    await aplicar(page, 'Tipo', 'Todos');
    await expect(botao(page)).toBeDisabled();

    await aplicar(page, 'Status', 'Concluída');
    await expect(botao(page)).toBeEnabled();
    await aplicar(page, 'Status', 'Abertas (ativas)');
    await expect(botao(page)).toBeDisabled();

    await aplicar(page, 'Prioridade', 'Crítica');
    await expect(botao(page)).toBeEnabled();
  });

  test('limpa busca, tipo, status e prioridade de uma vez', async ({ page }) => {
    await abrir(page);
    const original = await titulos(page);
    expect(original).toHaveLength(10);

    await aplicar(page, 'Buscar', 'reunião');
    await aplicar(page, 'Tipo', 'Reunião');
    await aplicar(page, 'Status', 'Concluída');
    await aplicar(page, 'Prioridade', 'Alta');
    await expect(page.locator('#contagem')).toHaveText('0 demandas');
    await expect(page.locator('#fila-vazia')).toBeVisible();

    await botao(page).click();

    const f = filtros(page);
    await expect(f.getByLabel('Buscar')).toHaveValue('');
    await expect(f.getByLabel('Tipo')).toHaveValue('');
    await expect(f.getByLabel('Status')).toHaveValue('abertas');
    await expect(f.getByLabel('Prioridade')).toHaveValue('');
    await expect(page.locator('#fila-vazia')).toBeHidden();
    await expect(page.locator('#contagem')).toHaveText('10 demandas');
    expect(await titulos(page)).toEqual(original); // a mesma fila, na mesma ordem
    await expect(botao(page)).toBeDisabled();
  });

  test('não apaga demandas nem mexe na data de referência, nos indicadores ou nos dados guardados', async ({ page }) => {
    await abrir(page);
    const antes = { indicadores: await indicadores(page), guardadas: await demandasGuardadas(page) };
    expect(antes.guardadas).toBe(13);

    await aplicar(page, 'Status', 'Concluída');
    await expect(page.locator('#contagem')).toHaveText('2 demandas');
    await botao(page).click();

    await expect(page.getByLabel('Data de referência')).toHaveValue('2026-10-15');
    expect(await indicadores(page)).toEqual(antes.indicadores);
    expect(await demandasGuardadas(page)).toBe(13);
    // as concluídas continuam existindo: basta filtrar por elas de novo
    await aplicar(page, 'Status', 'Concluída');
    await expect(page.locator('#contagem')).toHaveText('2 demandas');
  });

  for (const [campo, valor] of [['Buscar', 'minist'], ['Tipo', 'Operação de alertas'], ['Status', 'Sobrestado (aguardando)'], ['Prioridade', 'Crítica']]) {
    test(`limpa um filtro isolado: ${campo}`, async ({ page }) => {
      await abrir(page);
      await aplicar(page, campo, valor);
      await expect(page.locator('#contagem')).not.toHaveText('10 demandas');
      await botao(page).click();
      await expect(page.locator('#contagem')).toHaveText('10 demandas');
      await expect(botao(page)).toBeDisabled();
    });
  }

  test('funciona pelo teclado e devolve o foco ao campo de busca', async ({ page }) => {
    await abrir(page);
    await aplicar(page, 'Tipo', 'Reunião');
    await botao(page).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#contagem')).toHaveText('10 demandas');
    await expect(filtros(page).getByLabel('Buscar')).toBeFocused(); // o foco não se perde ao desabilitar o botão

    await aplicar(page, 'Prioridade', 'Baixa');
    await botao(page).focus();
    await page.keyboard.press('Space');
    await expect(page.locator('#contagem')).toHaveText('10 demandas');
    await expect(filtros(page).getByLabel('Buscar')).toBeFocused();
  });

  test('o botão é um controle do formulário de busca, com nome acessível', async ({ page }) => {
    await abrir(page);
    await expect(filtros(page).getByRole('button', { name: 'Limpar filtros' })).toBeVisible();
    await expect(botao(page)).toHaveAttribute('type', 'button'); // não envia o formulário nem recarrega a página
  });
});
