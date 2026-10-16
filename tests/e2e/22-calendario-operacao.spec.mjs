import { test, expect, abrir, importarExemplo, irParaAba } from './apoio.mjs';

const secao = (page) => page.locator('section[aria-labelledby="titulo-calendario"]');
const dia = (page, texto) => secao(page).getByRole('button', { name: new RegExp(texto) });
const detalhe = (page) => page.locator('#calendario-detalhe');
const NORTE = 'Equipe Fictícia Norte';

test.describe('programação da operação no calendário', () => {
  test('o período da operação (saída a retorno) cobre cada dia, com saída, retorno e prazo como compromissos', async ({ page }) => {
    await abrir(page);
    await irParaAba(page, 'Agenda');
    await expect(dia(page, `^sábado, 3 de outubro de 2026: 1 compromisso, operação ${NORTE}$`)).toBeVisible(); // saída
    await expect(dia(page, `^domingo, 4 de outubro de 2026: nenhum compromisso, operação ${NORTE}$`)).toBeVisible();
    await expect(dia(page, `^segunda-feira, 5 de outubro de 2026: nenhum compromisso, operação ${NORTE}$`)).toBeVisible();
    await expect(dia(page, `^quarta-feira, 7 de outubro de 2026: 1 compromisso, operação ${NORTE}$`)).toBeVisible(); // retorno
    await expect(dia(page, '^quinta-feira, 8 de outubro de 2026: nenhum compromisso$')).toBeVisible(); // fora do período
    await expect(secao(page).locator('.periodo-aberta')).toHaveCount(5); // 3 a 7 de outubro
    await expect(secao(page).locator('.periodo-concluida, .periodo-sobrestada')).toHaveCount(0);
  });

  test('o dia do retorno lista o período e o retorno, e o link leva à operação', async ({ page }) => {
    await abrir(page);
    await irParaAba(page, 'Agenda');
    await dia(page, '^quarta-feira, 7 de outubro de 2026').click();
    await expect(detalhe(page).locator('.evento')).toHaveCount(2);
    await expect(detalhe(page)).toContainText('Operação');
    await expect(detalhe(page)).toContainText(`${NORTE} · 03/10/2026 a 07/10/2026 · em andamento`);
    await expect(detalhe(page)).toContainText('Retorno de operação');
    await detalhe(page).getByRole('button', { name: /Retorno: Equipe Fictícia Norte/ }).click();
    await expect(page.locator('#fila .demanda', { hasText: 'operação de outubro (Norte)' })).toBeFocused();
  });

  test('a operação importada entra no mês da viagem: saída, período, retorno e prazo dos relatórios', async ({ page }) => {
    await abrir(page);
    await importarExemplo(page);
    await irParaAba(page, 'Agenda');
    await page.getByRole('button', { name: 'Próximo mês' }).click();
    await expect(page.locator('#calendario-mes')).toHaveText('Novembro de 2026');
    const LESTE = 'Equipe Fictícia Leste';
    await expect(dia(page, `^segunda-feira, 9 de novembro de 2026: 1 compromisso, Férias, operação ${LESTE}$`)).toBeVisible(); // saída
    await expect(dia(page, `^quarta-feira, 11 de novembro de 2026: nenhum compromisso, Férias, operação ${LESTE}$`)).toBeVisible();
    await expect(dia(page, `^sexta-feira, 13 de novembro de 2026: 1 compromisso, Férias, operação ${LESTE}$`)).toBeVisible(); // retorno
    await expect(dia(page, '^sábado, 14 de novembro de 2026: nenhum compromisso, Férias$')).toBeVisible();
    await expect(dia(page, '^segunda-feira, 23 de novembro de 2026: 1 compromisso$')).toBeVisible(); // prazo dos relatórios (retorno + 10)
    await expect(secao(page).locator('.periodo-aberta')).toHaveCount(5); // 9 a 13 de novembro
  });

  test('a programação não aumenta a largura da página', async ({ page }) => {
    await abrir(page);
    await irParaAba(page, 'Agenda');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
