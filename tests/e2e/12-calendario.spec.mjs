import { test, expect, abrir } from './apoio.mjs';

const secao = (page) => page.locator('section[aria-labelledby="titulo-calendario"]');
const titulo = (page) => page.locator('#calendario-mes');
const dia = (page, texto) => secao(page).getByRole('button', { name: new RegExp(texto) });
const detalhe = (page) => page.locator('#calendario-detalhe');

test.describe('Calendário mensal e compensação', () => {
  test('abre no mês da data de referência, com prazos, compromissos e o dia de hoje marcado', async ({ page }) => {
    await abrir(page);
    await expect(titulo(page)).toHaveText('Outubro de 2026');
    await expect(secao(page).locator('td.hoje')).toHaveText(/^15/);
    await expect(dia(page, '^terça-feira, 20 de outubro de 2026: 2 compromissos$')).toBeVisible();
    await expect(secao(page).locator('.chip-atrasado')).toHaveCount(2); // prazos vencidos de 06/10 e 13/10

    await dia(page, '20 de outubro de 2026').click();
    await expect(dia(page, '20 de outubro de 2026')).toHaveAttribute('aria-pressed', 'true');
    await expect(detalhe(page)).toBeVisible();
    await expect(detalhe(page).locator('.evento')).toHaveCount(2);
    await expect(detalhe(page)).toContainText('Prazo de processo');

    // O processo do dia leva ao cartão na fila.
    await detalhe(page).getByRole('button', { name: /SEMA-PRO-FICT-\d+ — Análise de denúncia/ }).click();
    await expect(page.locator('#fila .demanda', { hasText: 'Análise de denúncia sobre supressão vegetal' })).toBeFocused();
  });

  test('navega entre meses e mostra o período inteiro da licença-prêmio', async ({ page }) => {
    await abrir(page);
    await page.getByRole('button', { name: 'Próximo mês' }).click();
    await expect(titulo(page)).toHaveText('Novembro de 2026');
    await expect(page.getByRole('button', { name: 'Próximo mês' })).toBeFocused();
    await expect(dia(page, '^terça-feira, 3 de novembro de 2026: nenhum compromisso, Férias$')).toBeVisible();

    await page.getByRole('button', { name: 'Próximo mês' }).click();
    await expect(titulo(page)).toHaveText('Dezembro de 2026');
    await expect(secao(page).locator('.faixa-licenca_premio')).toHaveCount(28); // 07/12 a 03/01 visíveis na grade
    await expect(dia(page, '^domingo, 6 de dezembro de 2026: nenhum compromisso$')).toBeVisible(); // véspera: sem licença
    await expect(dia(page, '^segunda-feira, 7 de dezembro de 2026: nenhum compromisso, Licença-prêmio$')).toBeVisible();

    await page.getByRole('button', { name: 'Mês atual' }).click();
    await expect(titulo(page)).toHaveText('Outubro de 2026');
    await page.getByRole('button', { name: 'Mês anterior' }).click();
    await expect(titulo(page)).toHaveText('Setembro de 2026');

    // Mudar a data de referência leva o calendário ao novo mês.
    await page.getByLabel('Data de referência').fill('2027-01-04');
    await expect(titulo(page)).toHaveText('Janeiro de 2027');
  });

  test('compensação cadastrada aparece no calendário, na lista e soma +20 ao prazo que cai no período', async ({ page }) => {
    await abrir(page);
    await page.getByRole('button', { name: 'Novo afastamento' }).click();
    const dialogo = page.getByRole('dialog', { name: 'Novo afastamento' });
    await dialogo.getByLabel('Tipo').selectOption({ label: 'Compensação' });
    await dialogo.getByLabel('Início').fill('2026-10-26');
    await dialogo.getByLabel('Fim').fill('2026-10-28');
    await dialogo.getByLabel('Situação').selectOption({ label: 'Aprovado' });
    await dialogo.getByRole('button', { name: 'Salvar' }).click();
    await expect(dialogo).toBeHidden();

    await expect(page.locator('#lista-afastamentos')).toContainText('Compensação · 26/10/2026 a 28/10/2026 · Aprovado');
    await expect(secao(page).locator('.faixa-compensacao')).toHaveCount(3);
    await expect(dia(page, '27 de outubro de 2026: 1 compromisso, Compensação')).toBeVisible();

    const reuniao = page.locator('#fila > li', { hasText: 'Reunião de planejamento da próxima operação' }); // prazo 27/10
    await expect(reuniao.locator('.prioridade')).toHaveText('Prioridade Média · 30 pontos');
    await reuniao.getByText('Por que esta prioridade?').click();
    await expect(reuniao).toContainText('Prazo dentro de férias, licença-prêmio ou compensação (+20)');
  });
});
