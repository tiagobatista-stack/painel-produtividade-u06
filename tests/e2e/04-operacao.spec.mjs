import { test, expect, abrir, abrirPainel, cartao, complementares, fecharPainel, importarExemplo, indicadores } from './apoio.mjs';

const OPERACAO = 'Equipe Fictícia Leste';

test.describe('operação de alertas', () => {
  test('importa a planilha, registra o retorno e lavra o auto de um ponto', async ({ page }) => {
    await abrir(page);
    await importarExemplo(page);
    await expect(page.locator('#mensagem')).toContainText('Operação importada: 13 pontos');
    const op = await abrirPainel(page, OPERACAO);
    await expect(op).toContainText('saída 09/11/2026 · retorno 13/11/2026');
    expect((await complementares(page))[1]).toBe('9'); // pontos planejados ainda não são relatórios pendentes

    await op.getByRole('button', { name: /Registrar retorno de/ }).click();
    const retorno = page.getByRole('dialog', { name: 'Registrar retorno' });
    await expect(retorno.getByLabel('Data efetiva de retorno')).toHaveValue('2026-11-13');
    await retorno.getByRole('button', { name: 'Registrar retorno' }).click();
    await expect(page.locator('#mensagem')).toContainText('Retorno registrado');
    expect((await complementares(page))[1]).toBe('22'); // 9 + 13 pontos vistoriados
    await expect(op).toContainText('13 relatórios pendentes');
    await expect(op.locator('details.pontos')).toHaveJSProperty('open', true);

    // o auto só vem depois do relatório concluído
    const ponto1 = page.locator('#ponto-DEM-0015-1');
    await ponto1.selectOption({ label: 'Auto lavrado' });
    await expect(page.locator('#painel-aviso')).toContainText('O auto só pode ser lavrado depois do relatório concluído.');
    await expect(ponto1).toHaveValue('vistoriado');

    await ponto1.selectOption({ label: 'Relatório concluído' });
    await expect(page.locator('#painel-aviso')).toBeHidden();
    expect((await complementares(page))[2]).toBe('3'); // autos a lavrar: 2 + 1
    await page.locator('#ponto-DEM-0015-1').selectOption({ label: 'Auto lavrado' });
    expect((await complementares(page))[2]).toBe('2');
    await expect(page.locator('#ponto-DEM-0015-1')).toHaveValue('auto_lavrado');
    await expect(page.locator('#ponto-DEM-0015-1')).toBeFocused();

    // o resumo da semana já conta o relatório e o auto de hoje (15/10/2026)
    await expect(page.locator('#resumo-semana .indicador-valor').nth(1)).toHaveText('6'); // 5 + 1
    await expect(page.locator('#resumo-semana .indicador-valor').nth(2)).toHaveText('5'); // 4 + 1
  });

  test('não importa a mesma operação duas vezes e recusa planilha inválida', async ({ page }) => {
    await abrir(page);
    await importarExemplo(page);
    await page.getByRole('button', { name: 'Importar operação' }).click();
    const dialogo = page.getByRole('dialog', { name: 'Importar operação' });
    await dialogo.getByRole('button', { name: 'Usar planilha de exemplo' }).click();
    await dialogo.getByRole('button', { name: 'Importar', exact: true }).click();
    await expect(dialogo.locator('#imp-previa')).toContainText('já foi importada');
    await dialogo.getByLabel('Linhas da planilha').fill('N_PONTO\tEQUIPE\tMUNICIPIO\tDAT_SAIDA\tDAT_RETOR\n1\tEq A\tCid\t01/11/2026\t05/11/2026\n2\tEq B\tCid\t01/11/2026\t05/11/2026');
    await expect(dialogo.locator('#imp-previa')).toContainText('Equipe diferente da linha 2');
    await expect(dialogo.getByRole('button', { name: 'Importar', exact: true })).toBeDisabled();
  });

  test('a prévia mostra o prazo retorno + N e recalcula ao mudar N', async ({ page }) => {
    await abrir(page);
    await page.getByRole('button', { name: 'Importar operação' }).click();
    const dialogo = page.getByRole('dialog', { name: 'Importar operação' });
    await dialogo.getByRole('button', { name: 'Usar planilha de exemplo' }).click();
    await expect(dialogo.locator('#imp-previa')).toContainText('23/11/2026 (retorno + 10 dias)');
    await dialogo.getByLabel('Prazo dos relatórios (dias após o retorno)').fill('3');
    await expect(dialogo.locator('#imp-previa')).toContainText('16/11/2026 (retorno + 3 dias)');
    await dialogo.getByLabel('Prazo dos relatórios (dias após o retorno)').fill('-1');
    await expect(dialogo.getByRole('button', { name: 'Importar', exact: true })).toBeDisabled();
  });

  test('sobrestar a operação (aguardando o autuado) e retomar', async ({ page }) => {
    await abrir(page);
    const norte = await abrirPainel(page, 'operação de outubro (Norte)');
    await norte.getByRole('button', { name: 'Sobrestar operação' }).click();
    await expect(page.locator('#mensagem')).toContainText('Operação sobrestada');
    await fecharPainel(page);
    await expect(page.locator('#contagem')).toHaveText('10 demandas'); // abertas
    expect((await complementares(page))[1]).toBe('3'); // relatórios pendentes
    expect((await indicadores(page))[2]).toBe('2'); // sobrestados
    await page.getByRole('search').getByLabel('Status').selectOption({ label: 'Sobrestado (aguardando)' });
    const sobrestada = await abrirPainel(page, 'operação de outubro (Norte)');
    await expect(sobrestada.locator('.prioridade')).toContainText('aguardando identificação do autuado');
    await sobrestada.getByRole('button', { name: 'Retomar operação' }).click();
    await fecharPainel(page);
    await page.getByRole('search').getByLabel('Status').selectOption({ label: 'Abertas (ativas)' });
    await expect(page.locator('#contagem')).toHaveText('11 demandas');
    const retomada = await abrirPainel(page, 'operação de outubro (Norte)');
    await expect(retomada.locator('.prioridade')).toHaveText('Prioridade Alta · 68 pontos');
  });

  test('edita os parâmetros da operação e o esforço é recalculado', async ({ page }) => {
    await abrir(page);
    const sul = await abrirPainel(page, 'operação de setembro (Sul)');
    await expect(sul).toContainText('esforço estimado 9 h'); // 3 pendentes × 3 h
    await sul.getByRole('button', { name: /^Editar/ }).click();
    const dialogo = page.getByRole('dialog', { name: 'Editar demanda' });
    await expect(dialogo.getByLabel('Prazo', { exact: true })).toBeHidden();
    await dialogo.getByLabel('Horas por relatório').fill('4');
    await dialogo.getByRole('button', { name: 'Salvar' }).click();
    await expect(sul).toContainText('esforço estimado 12 h'); // o painel segue aberto e se atualiza
  });
});
