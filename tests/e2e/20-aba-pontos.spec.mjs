import { test, expect, abrir, abrirPainel, fecharPainel, importarExemplo, irParaAba, painel } from './apoio.mjs';

const aba = (page) => page.locator('#aba-pontos');
const linhas = (page) => page.locator('#pontos-lista > li');
const linha = (page, trecho) => linhas(page).filter({ hasText: trecho });
const contador = (page, rotulo) => page.locator('#pontos-indicadores button', { hasText: rotulo });
const filtrosDosPontos = (page) => page.getByRole('search', { name: 'Buscar e filtrar pontos' });
const valores = (page) => page.locator('#pontos-indicadores .indicador-valor').allTextContents();

async function irParaPontos(page) {
  await abrir(page);
  await irParaAba(page, 'Pontos');
  await expect(aba(page)).toBeVisible();
}

test.describe('aba Pontos: relatório e autos de cada ponto', () => {
  test('mostra os 21 pontos do exemplo, contados por situação, sem coordenadas', async ({ page }) => {
    await irParaPontos(page);
    await expect(page).toHaveURL(/#pontos$/);
    expect(await valores(page)).toEqual(['21', '9', '2', '6', '4']); // pontos, aguardando relatório, a lavrar, com auto, sem auto
    await expect(page.locator('#pontos-contagem')).toHaveText('21 pontos');
    await expect(linhas(page)).toHaveCount(21);
    await expect(aba(page)).not.toContainText('-20,113'); // as coordenadas não aparecem
    await expect(aba(page)).not.toContainText('-15.193');
    // o que falta vem primeiro
    await expect(linhas(page).first()).toContainText('Aguardando relatório');
    await expect(linhas(page).last()).toContainText('Encerrado sem auto');
  });

  test('cada ponto mostra operação, município, relatório, autos e situação', async ({ page }) => {
    await irParaPontos(page);
    const p1 = linha(page, 'Equipe Fictícia Norte').filter({ hasText: 'Ponto 1 ·' });
    await expect(p1).toContainText('Ponto 1 · Município Fictício A');
    await expect(p1).toContainText('saída 03/10/2026 · retorno 07/10/2026');
    await expect(p1).toContainText('Relatório: relatório próprio · concluído em 09/10/2026');
    await expect(p1).toContainText('Autos (1): Auto (tipo não informado) (13/10/2026)');
    await expect(p1.locator('.selo-situacao')).toHaveText('Com auto lavrado');
    const p10 = linha(page, 'Equipe Fictícia Norte').filter({ hasText: 'Ponto 10 ·' });
    await expect(p10).toContainText('Relatório: relatório próprio · pendente');
    await expect(p10).toContainText('Autos: nenhum');
    await expect(p10.locator('.selo-situacao')).toHaveText('Aguardando relatório');
    const p7 = linha(page, 'Equipe Fictícia Norte').filter({ hasText: 'Ponto 7 ·' });
    await expect(p7.locator('.selo-situacao')).toHaveText('Relatório concluído, auto a lavrar');
  });

  test('os contadores filtram a lista e clicar de novo volta a todos', async ({ page }) => {
    await irParaPontos(page);
    await contador(page, 'Auto a lavrar').click();
    await expect(linhas(page)).toHaveCount(2);
    await expect(contador(page, 'Auto a lavrar')).toHaveAttribute('aria-pressed', 'true');
    await expect(filtrosDosPontos(page).getByLabel('Situação')).toHaveValue('a_lavrar');
    await expect(page.locator('#pontos-contagem')).toHaveText('2 de 21 pontos');
    await expect(contador(page, 'Auto a lavrar')).toBeFocused();
    await contador(page, 'Auto a lavrar').click();
    await expect(linhas(page)).toHaveCount(21);
    await expect(contador(page, 'Auto a lavrar')).toHaveAttribute('aria-pressed', 'false');
  });

  test('filtros: operação, situação e busca, com "Limpar filtros"', async ({ page }) => {
    await irParaPontos(page);
    const f = filtrosDosPontos(page);
    await expect(f.getByRole('button', { name: 'Limpar filtros' })).toBeDisabled();
    await f.getByLabel('Operação').selectOption({ label: 'Equipe Fictícia Sul · saída 22/09/2026' });
    await expect(linhas(page)).toHaveCount(8);
    await f.getByLabel('Situação').selectOption({ label: 'Com auto lavrado' });
    await expect(linhas(page)).toHaveCount(2);
    await expect(page.locator('#pontos-contagem')).toHaveText('2 de 21 pontos');
    await f.getByLabel('Situação').selectOption({ label: 'Todas' });
    await f.getByLabel('Buscar').fill('ponto 5');
    await expect(linhas(page)).toHaveCount(1);
    await f.getByLabel('Buscar').fill('nada disso');
    await expect(page.locator('#pontos-vazio')).toBeVisible();
    await f.getByRole('button', { name: 'Limpar filtros' }).click();
    await expect(linhas(page)).toHaveCount(21);
    await expect(f.getByLabel('Buscar')).toBeFocused();
    await expect(f.getByRole('button', { name: 'Limpar filtros' })).toBeDisabled();
  });

  test('"Abrir operação" abre o painel da operação e devolve o foco ao botão', async ({ page }) => {
    await irParaPontos(page);
    const botao = page.getByRole('button', { name: 'Abrir a operação Equipe Fictícia Norte, ponto 10' });
    await botao.click();
    await expect(painel(page)).toBeVisible();
    await expect(painel(page).getByRole('heading', { name: /operação de outubro \(Norte\)/ })).toBeVisible();
    await fecharPainel(page);
    await expect(botao).toBeFocused();
  });

  test('a aba acompanha as mudanças: relatório agrupado, autos e anotação aparecem na lista', async ({ page }) => {
    await irParaPontos(page);
    await page.getByRole('button', { name: 'Abrir a operação Equipe Fictícia Norte, ponto 10' }).click();
    const p = painel(page);
    await p.locator('details.pontos > summary').click();
    for (const n of [10, 11, 12]) await p.getByRole('checkbox', { name: `Marcar o ponto ${n} para agrupar` }).check();
    await p.getByRole('button', { name: /^Agrupar 3 pontos marcados/ }).click();
    await p.locator('#relatorio-DEM-0001-R1').selectOption({ label: 'Relatório concluído' });
    await p.locator('li.ponto', { hasText: 'Ponto 10 ·' }).getByText('Anotação do ponto', { exact: true }).click();
    await p.getByRole('textbox', { name: 'Anotação do ponto 10' }).fill('Pendente: confirmar o autuado.');
    await p.getByRole('button', { name: 'Salvar anotação do ponto 10' }).click();
    await fecharPainel(page);

    const l10 = linha(page, 'Ponto 10 ·').filter({ hasText: 'Equipe Fictícia Norte' });
    await expect(l10).toContainText('Relatório: R1 (pontos 10, 11, 12) · concluído em 15/10/2026');
    await expect(l10).toContainText('Anotação: Pendente: confirmar o autuado.');
    await expect(l10.locator('.selo-situacao')).toHaveText('Relatório concluído, auto a lavrar');
    expect(await valores(page)).toEqual(['21', '6', '5', '6', '4']); // aguardando 9 - 3, a lavrar 2 + 3

    await page.getByRole('search', { name: 'Buscar e filtrar pontos' }).getByLabel('Buscar').fill('confirmar o autuado');
    await expect(linhas(page)).toHaveCount(1);
    await page.getByRole('search', { name: 'Buscar e filtrar pontos' }).getByLabel('Buscar').fill('R1');
    await expect(linhas(page)).toHaveCount(3);
  });

  test('a operação importada aparece na lista e no filtro de operação', async ({ page }) => {
    await abrir(page);
    await importarExemplo(page);
    await irParaAba(page, 'Pontos');
    await expect(linhas(page)).toHaveCount(34); // 21 + 13
    expect((await valores(page))[0]).toBe('34');
    await expect(linha(page, 'Equipe Fictícia Leste').first().locator('.selo-situacao')).toHaveText('Planejado');
    await filtrosDosPontos(page).getByLabel('Operação').selectOption({ label: 'Equipe Fictícia Leste · saída 09/11/2026' });
    await expect(linhas(page)).toHaveCount(13);
    await expect(linhas(page).first()).toContainText('Relatório: relatório próprio · aguardando o retorno da equipe');
  });

  test('cabe em 360 px, sem rolagem horizontal da página', async ({ page }) => {
    await irParaPontos(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    for (const c of await linhas(page).first().evaluateAll((els) => els.map((e) => e.getBoundingClientRect()))) {
      expect(c.left).toBeGreaterThanOrEqual(0);
      expect(c.right).toBeLessThanOrEqual(await page.evaluate(() => window.innerWidth));
    }
  });
});
