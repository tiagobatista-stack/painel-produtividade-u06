import { test, expect, abrir, abrirPainel, cartao, complementares, fecharPainel, filtros, importarExemplo, painel } from './apoio.mjs';

const OPERACAO = 'Equipe Fictícia Leste'; // DEM-0014 depois de importar a planilha de exemplo (13 pontos)
const PROCESSO = 'Informação técnica para ofício do Poder Judiciário'; // DEM-0004

// Importa a planilha de exemplo, registra o retorno (13 pontos vistoriados) e deixa o painel da operação aberto.
async function operacaoVistoriada(page) {
  await abrir(page);
  await importarExemplo(page);
  const p = await abrirPainel(page, OPERACAO);
  await p.getByRole('button', { name: /Registrar retorno de/ }).click();
  await page.getByRole('dialog', { name: 'Registrar retorno' }).getByRole('button', { name: 'Registrar retorno' }).click();
  await expect(p.locator('details.pontos')).toHaveJSProperty('open', true);
  return p;
}
const ponto = (p, n) => p.locator('li.ponto', { hasText: `Ponto ${n} ·` });
const marcar = (p, n) => p.getByRole('checkbox', { name: `Marcar o ponto ${n} para agrupar` });
const guardada = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('painel-demandas:v1')).demandas.find((d) => d.id === 'DEM-0014'));
const pendentes = async (page) => Number((await complementares(page))[1]);
const aLavrar = async (page) => Number((await complementares(page))[2]);

async function agrupar(p, numeros) {
  for (const n of numeros) await marcar(p, n).check();
  await p.getByRole('button', { name: new RegExp(`^Agrupar ${numeros.length} pontos marcados em um relatório`) }).click();
}
const situacaoDoRelatorio = (p, id = 'R1') => p.locator(`#relatorio-DEM-0014-${id}`);

test.describe('relatório agrupado e autos de cada ponto', () => {
  test('somar 3 pontos no mesmo relatório conta 1 relatório pendente, e o botão só habilita com 2 ou mais pontos', async ({ page }) => {
    const p = await operacaoVistoriada(page);
    expect(await pendentes(page)).toBe(22); // 9 + 13 pontos vistoriados
    const botao = p.getByRole('button', { name: /^Agrupar \d+ pontos? marcados? em um relatório/ });
    await expect(botao).toBeDisabled();
    await marcar(p, 1).check();
    await expect(p.getByRole('button', { name: /^Agrupar 1 ponto marcado em um relatório/ })).toBeDisabled();
    await marcar(p, 2).check();
    await marcar(p, 3).check();
    await expect(p.getByRole('button', { name: /^Agrupar 3 pontos marcados em um relatório/ })).toBeEnabled();
    await p.getByRole('button', { name: /^Agrupar 3 pontos marcados/ }).click();

    for (const n of [1, 2, 3]) await expect(ponto(p, n)).toContainText('Relatório R1');
    await expect(ponto(p, 4)).not.toContainText('Relatório R1');
    await expect(marcar(p, 1)).toHaveCount(0); // ponto já agrupado não é marcável de novo
    await expect(situacaoDoRelatorio(p)).toHaveValue('vistoriado');
    await expect(p).toContainText('pontos 1, 2, 3');
    expect(await pendentes(page)).toBe(20); // 22 - 3 + 1
    await expect(p.locator('details.pontos')).toContainText('As etapas do relatório valem para todo o relatório R1');
  });

  test('pontos em etapas diferentes não se agrupam; a mensagem aparece dentro do painel', async ({ page }) => {
    const p = await operacaoVistoriada(page);
    await ponto(p, 2).getByLabel('Etapa').selectOption({ label: 'Relatório em elaboração' });
    await agrupar(p, [1, 2]);
    await expect(page.locator('#painel-aviso')).toContainText('mesma etapa');
    await expect(page.locator('#painel-aviso')).toBeVisible();
    expect((await guardada(page)).relatorios).toBeUndefined();
  });

  test('concluir o relatório conclui todos os pontos dele; o auto continua sendo de cada ponto', async ({ page }) => {
    const p = await operacaoVistoriada(page);
    await agrupar(p, [1, 2, 3]);
    const antes = await aLavrar(page);
    await situacaoDoRelatorio(p).selectOption({ label: 'Relatório concluído' });
    for (const n of [1, 2, 3]) await expect(ponto(p, n).getByLabel('Etapa')).toHaveValue('relatorio_concluido');
    await expect(ponto(p, 4).getByLabel('Etapa')).toHaveValue('vistoriado');
    expect(await aLavrar(page)).toBe(antes + 3);
    expect(await pendentes(page)).toBe(19); // 22 - 3 + 1 (R1 agrupado) = 20, e concluir R1 tira mais um
    await expect(p.getByRole('button', { name: 'Desfazer o agrupamento do relatório R1' })).toBeDisabled();

    // mudar a etapa de um ponto agrupado vale para o relatório inteiro
    await ponto(p, 2).getByLabel('Etapa').selectOption({ label: 'Relatório em elaboração' });
    for (const n of [1, 2, 3]) await expect(ponto(p, n).getByLabel('Etapa')).toHaveValue('relatorio_elaboracao');
    await expect(situacaoDoRelatorio(p)).toHaveValue('relatorio_elaboracao');
    await expect(p.getByRole('button', { name: 'Desfazer o agrupamento do relatório R1' })).toBeEnabled();
  });

  test('desfazer o agrupamento devolve a cada ponto o seu relatório', async ({ page }) => {
    const p = await operacaoVistoriada(page);
    await agrupar(p, [1, 2]);
    expect(await pendentes(page)).toBe(21);
    await p.getByRole('button', { name: 'Desfazer o agrupamento do relatório R1' }).click();
    await expect(p.getByText('Relatório R1', { exact: true })).toHaveCount(0);
    await expect(marcar(p, 1)).toBeVisible();
    expect(await pendentes(page)).toBe(22);
    expect((await guardada(page)).relatorios).toBeUndefined();
  });

  test('um ponto pode ter vários autos, cada um com tipo e data; remover o último volta a "Relatório concluído"', async ({ page }) => {
    const p = await operacaoVistoriada(page);
    await ponto(p, 5).getByLabel('Etapa').selectOption({ label: 'Relatório concluído' });
    const antes = await aLavrar(page);

    await ponto(p, 5).getByRole('button', { name: 'Registrar auto no ponto 5' }).click();
    const d = page.getByRole('dialog', { name: 'Registrar auto' });
    await expect(d.getByLabel('Tipo do auto')).toHaveValue('auto_infracao');
    await d.getByLabel('Data do auto').fill('2026-10-01'); // antes do relatório (15/10)
    await d.getByRole('button', { name: 'Registrar auto' }).click();
    await expect(d.getByRole('alert')).toContainText('não pode ser anterior à do relatório');
    await d.getByLabel('Data do auto').fill('2026-10-16');
    await d.getByRole('button', { name: 'Registrar auto' }).click();
    await expect(d).toBeHidden();
    await expect(ponto(p, 5).getByLabel('Etapa')).toHaveValue('auto_lavrado');
    await expect(ponto(p, 5).locator('.auto')).toHaveText([/^Auto de infração · 16\/10\/2026/]);
    expect(await aLavrar(page)).toBe(antes - 1);

    await ponto(p, 5).getByRole('button', { name: 'Registrar outro auto no ponto 5' }).click();
    await d.getByLabel('Tipo do auto').selectOption({ label: 'Termo de embargo' });
    await d.getByLabel('Data do auto').fill('2026-10-17');
    await d.getByRole('button', { name: 'Registrar auto' }).click();
    await expect(ponto(p, 5).locator('.auto')).toHaveText([/^Auto de infração · 16\/10\/2026/, /^Termo de embargo · 17\/10\/2026/]);

    // com mais de um auto, mudar a etapa é recusado até remover os autos
    await ponto(p, 5).getByLabel('Etapa').selectOption({ label: 'Relatório concluído' });
    await expect(page.locator('#painel-aviso')).toContainText('mais de um auto');
    await expect(ponto(p, 5).getByLabel('Etapa')).toHaveValue('auto_lavrado');

    await ponto(p, 5).getByRole('button', { name: 'Remover Auto de infração do ponto 5' }).click();
    await expect(ponto(p, 5).locator('.auto')).toHaveText([/^Termo de embargo/]);
    await ponto(p, 5).getByRole('button', { name: 'Remover Termo de embargo do ponto 5' }).click();
    await expect(ponto(p, 5).getByLabel('Etapa')).toHaveValue('relatorio_concluido');
    await expect(ponto(p, 5).locator('.auto')).toHaveCount(0);
    expect(await aLavrar(page)).toBe(antes);
  });

  test('o auto só aparece depois do relatório concluído, e o ponto antigo "auto lavrado" aceita mais autos', async ({ page }) => {
    await abrir(page);
    const p = await abrirPainel(page, 'operação de outubro (Norte)'); // DEM-0001: pontos 1 a 4 já com auto, sem lista de autos
    await expect(ponto(p, 1).locator('.auto')).toHaveText([/^Auto \(tipo não informado\) · 13\/10\/2026/]);
    await expect(ponto(p, 10).getByRole('button', { name: /Registrar auto/ })).toHaveCount(0); // vistoriado
    await p.locator('details.pontos > summary').click();
    await ponto(p, 1).getByRole('button', { name: 'Registrar outro auto no ponto 1' }).click();
    const d = page.getByRole('dialog', { name: 'Registrar auto' });
    await d.getByLabel('Tipo do auto').selectOption({ label: 'Termo de apreensão' });
    await d.getByLabel('Data do auto').fill('2026-10-15');
    await d.getByRole('button', { name: 'Registrar auto' }).click();
    await expect(ponto(p, 1).locator('.auto')).toHaveText([/^Auto \(tipo não informado\) · 13\/10\/2026/, /^Termo de apreensão · 15\/10\/2026/]);
  });

  test('relatórios, autos e etapas persistem ao recarregar', async ({ page }) => {
    const p = await operacaoVistoriada(page);
    await agrupar(p, [1, 2, 3]);
    await situacaoDoRelatorio(p).selectOption({ label: 'Relatório concluído' });
    await ponto(p, 1).getByRole('button', { name: 'Registrar auto no ponto 1' }).click();
    await page.getByRole('dialog', { name: 'Registrar auto' }).getByRole('button', { name: 'Registrar auto' }).click();
    const op = await guardada(page);
    expect(op.relatorios).toEqual([{ id: 'R1', pontos: [1, 2, 3], criado_em: '2026-10-15' }]);
    expect(op.pontos[0].autos).toHaveLength(1);

    await page.reload();
    await abrir(page);
    await abrirPainel(page, OPERACAO);
    await painel(page).locator('details.pontos > summary').click();
    await expect(ponto(painel(page), 2)).toContainText('Relatório R1');
    await expect(ponto(painel(page), 1).locator('.auto')).toHaveCount(1);
  });
});

test.describe('anotações: o que já foi feito e o que está pendente', () => {
  // As anotações da demanda são uma lista com caixa de seleção (formulário "Editar demanda"; marcar no painel).
  async function editarAnotacoes(page, p, texto) {
    await p.getByRole('button', { name: /^Editar / }).click();
    const dialogo = page.getByRole('dialog', { name: 'Editar demanda' });
    await dialogo.getByLabel('Anotações', { exact: true }).fill(texto);
    await dialogo.getByLabel('Anotações', { exact: true }).press('Enter');
    return dialogo;
  }

  test('a demanda tem anotações em lista; ficam no histórico, no card e na busca', async ({ page }) => {
    await abrir(page);
    const p = await abrirPainel(page, PROCESSO);
    await expect(p.getByText(/^Anotações \d+\/\d+$/)).toHaveCount(0);
    const dialogo = await editarAnotacoes(page, p, 'Feito: minuta enviada à chefia.');
    await dialogo.getByLabel('Anotações', { exact: true }).fill('Pendente: aguardar a resposta do jurídico.');
    await dialogo.getByLabel('Anotações', { exact: true }).press('Enter');
    await dialogo.getByRole('checkbox', { name: 'Feito: minuta enviada à chefia.' }).check();
    await dialogo.getByRole('button', { name: 'Salvar demanda' }).click();
    await expect(p.getByText('Anotações 1/2')).toBeVisible();
    await p.getByText('Anotações 1/2').click();
    await expect(p.getByRole('checkbox', { name: 'Feito: minuta enviada à chefia.' })).toBeChecked();
    await p.getByText(/^Histórico \(\d+\)/).click();
    await expect(p).toContainText('Anotação concluída: Feito: minuta enviada à chefia.');
    await fecharPainel(page);

    await expect(cartao(page, PROCESSO).locator('.demanda-obs')).toHaveText('Anotações 1/2');
    await filtros(page).getByLabel('Buscar').fill('resposta do jurídico');
    await expect(page.locator('#fila > li')).toHaveCount(1);
    await expect(cartao(page, PROCESSO)).toHaveCount(1);

    await page.reload();
    await abrir(page);
    await expect(cartao(page, PROCESSO).locator('.demanda-obs')).toHaveText('Anotações 1/2');
  });

  test('remover todas as anotações tira o indicador do card; marcar no painel não precisa abrir o formulário', async ({ page }) => {
    await abrir(page);
    let p = await abrirPainel(page, PROCESSO);
    const dialogo = await editarAnotacoes(page, p, 'Primeira versão.');
    await dialogo.getByRole('button', { name: 'Salvar demanda' }).click();
    await p.getByText('Anotações 0/1').click();
    await p.getByRole('checkbox', { name: 'Primeira versão.' }).check();
    await expect(p.getByText('Anotações 1/1')).toBeVisible();
    await p.getByRole('button', { name: /^Editar / }).click();
    const d2 = page.getByRole('dialog', { name: 'Editar demanda' });
    await d2.getByRole('button', { name: 'Remover anotação: Primeira versão.' }).click();
    await d2.getByRole('button', { name: 'Salvar demanda' }).click();
    await fecharPainel(page);
    await expect(cartao(page, PROCESSO).locator('.demanda-obs')).toHaveCount(0);
  });

  test('a anotação da operação (lista) e a de cada ponto (texto) são separadas e persistem', async ({ page }) => {
    await abrir(page);
    const p = await abrirPainel(page, 'operação de outubro (Norte)');
    const dialogo = await editarAnotacoes(page, p, 'Operação: faltam as fotos dos pontos 10 a 13.');
    await dialogo.getByRole('button', { name: 'Salvar demanda' }).click();
    await p.locator('details.pontos > summary').click();
    await ponto(p, 10).getByText('Anotação do ponto', { exact: true }).click();
    await ponto(p, 10).getByRole('textbox', { name: 'Anotação do ponto 10' }).fill('Pendente: fotografar a área.');
    await ponto(p, 10).getByRole('button', { name: 'Salvar anotação do ponto 10' }).click();
    await expect(ponto(p, 10).getByRole('textbox', { name: 'Anotação do ponto 10' })).toHaveValue('Pendente: fotografar a área.');
    await expect(ponto(p, 10)).toContainText('Anotação do ponto (preenchida)');
    await expect(ponto(p, 11).getByText('Anotação do ponto', { exact: true })).toBeVisible(); // os outros pontos seguem sem anotação

    const salvo = await page.evaluate(() => JSON.parse(localStorage.getItem('painel-demandas:v1')).demandas.find((d) => d.id === 'DEM-0001'));
    expect(salvo.anotacoes.map((a) => a.texto)).toEqual(['Operação: faltam as fotos dos pontos 10 a 13.']);
    expect(salvo.observacoes).toBeUndefined();
    expect(salvo.pontos.find((x) => x.n === 10).observacoes).toBe('Pendente: fotografar a área.');
    expect(salvo.pontos.find((x) => x.n === 11).observacoes).toBeUndefined();
  });

  test('anotação longa demais é recusada pelo limite do campo', async ({ page }) => {
    await abrir(page);
    const p = await abrirPainel(page, PROCESSO);
    await p.getByRole('button', { name: /^Editar / }).click();
    const dialogo = page.getByRole('dialog', { name: 'Editar demanda' });
    await expect(dialogo.getByLabel('Anotações', { exact: true })).toHaveAttribute('maxlength', '280');
    await dialogo.getByRole('button', { name: 'Cancelar' }).click();
  });
});
