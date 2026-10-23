// Formulário "Editar ponto" (RF67) e vistoria por ponto, com data, aviso fora do período e reagendamento (RF68). Dados fictícios.
import { test, expect, abrir, irParaAba, painel } from './apoio.mjs';

const lista = (page) => page.locator('#pontos-lista');
const cartaoDoPonto = (page, trecho) => lista(page).locator('li', { hasText: trecho });
const PONTO_8_NORTE = 'Ponto 8 · Município Fictício B'; // DEM-0001, em elaboração
const dialogo = (page, numero) => page.getByRole('dialog', { name: `Editar ponto ${numero}` });
const campo = (page, numero, rotulo) => dialogo(page, numero).getByLabel(rotulo, { exact: true });
const salvar = (page, numero) => dialogo(page, numero).getByRole('button', { name: 'Salvar ponto' }).click();

async function abrirAbaPontos(page) {
  await abrir(page);
  await irParaAba(page, 'Pontos');
  await expect(lista(page)).toBeVisible();
}

test.describe('editar o ponto pela aba Pontos', () => {
  test('cada cartão tem "Editar ponto" e "Abrir operação"; o formulário abre com os dados do ponto', async ({ page }) => {
    await abrirAbaPontos(page);
    const cartoes = lista(page).locator('li');
    await expect(cartoes).toHaveCount(21);
    await expect(lista(page).getByRole('button', { name: /^Editar o ponto / })).toHaveCount(21);
    await expect(lista(page).getByRole('button', { name: /^Abrir a operação / })).toHaveCount(21);

    await cartaoDoPonto(page, PONTO_8_NORTE).filter({ hasText: 'Equipe Fictícia Norte' }).getByRole('button', { name: /^Editar o ponto 8/ }).click();
    await expect(dialogo(page, 8)).toBeVisible();
    await expect(dialogo(page, 8)).toContainText('Relatórios de vistoria — operação de outubro (Norte)');
    await expect(dialogo(page, 8)).toContainText('período previsto 03/10/2026 a 07/10/2026 · ponto 8 de 13');
    await expect(campo(page, 8, 'Município')).toHaveValue('Município Fictício B');
    await expect(campo(page, 8, 'Assunto (nota do planejamento)')).toHaveValue('Exploração seletiva');
    await expect(campo(page, 8, 'Latitude')).toHaveValue('-15,144');
    await expect(campo(page, 8, 'Longitude')).toHaveValue('-20,204');
    await expect(campo(page, 8, 'Situação da vistoria')).toHaveValue('vistoriada');
    await expect(campo(page, 8, 'Data da vistoria')).toHaveValue('2026-10-05');
    await expect(campo(page, 8, 'Etapa')).toHaveValue('relatorio_elaboracao');
  });

  test('salva os dados do ponto, que passam a valer na busca e no histórico; o foco volta ao botão', async ({ page }) => {
    await abrirAbaPontos(page);
    const botao = cartaoDoPonto(page, PONTO_8_NORTE).filter({ hasText: 'Equipe Fictícia Norte' }).getByRole('button', { name: /^Editar o ponto 8/ });
    await botao.click();
    await campo(page, 8, 'Processo').fill('SEMA-PRO-FICT-0808');
    await campo(page, 8, 'Código do alerta').fill('ALT-FICT-0808');
    await campo(page, 8, 'Imóvel ou local').fill('Fazenda Exemplo Oito');
    await campo(page, 8, 'Área desmatada (ha)').fill('7,5');
    await campo(page, 8, 'Responsável').fill('Responsável fictício Oito');
    await campo(page, 8, 'Anotações do ponto').fill('Feito: vistoria. Pendente: fotos.');
    await salvar(page, 8);
    await expect(dialogo(page, 8)).toBeHidden();
    await expect(page.locator('#mensagem')).toContainText('Ponto 8 atualizado.');
    await expect(botao).toBeFocused();

    await page.getByRole('search', { name: 'Buscar e filtrar pontos' }).getByLabel('Buscar').fill('ALT-FICT-0808');
    await expect(lista(page).locator('li')).toHaveCount(1);
    await expect(lista(page).locator('li').first()).toContainText('Ponto 8 · Município Fictício B');
    await expect(lista(page).locator('li').first()).toContainText('Anotação: Feito: vistoria. Pendente: fotos.');
  });

  test('erros ficam ao lado do campo e nada é gravado até corrigir', async ({ page }) => {
    await abrirAbaPontos(page);
    await cartaoDoPonto(page, PONTO_8_NORTE).filter({ hasText: 'Equipe Fictícia Norte' }).getByRole('button', { name: /^Editar o ponto 8/ }).click();
    await campo(page, 8, 'Município').fill('');
    await campo(page, 8, 'Área desmatada (ha)').fill('muita');
    await campo(page, 8, 'Latitude').fill('-15,1');
    await campo(page, 8, 'Longitude').fill('');
    await salvar(page, 8);
    await expect(dialogo(page, 8)).toBeVisible();
    await expect(dialogo(page, 8).locator('#pt-e-municipio')).toHaveText('Informe o município.');
    await expect(dialogo(page, 8).locator('#pt-e-area_ha')).toContainText('Informe a área em hectares');
    await expect(dialogo(page, 8).locator('#pt-e-longitude')).toHaveText('Informe também a longitude.');
    await campo(page, 8, 'Município').fill('Município Fictício B');
    await campo(page, 8, 'Área desmatada (ha)').fill('');
    await campo(page, 8, 'Longitude').fill('-20,3');
    await salvar(page, 8);
    await expect(dialogo(page, 8)).toBeHidden();
  });

  test('vistoria: programada exige a data; fora do período previsto só avisa; reagendar fica no histórico da operação', async ({ page }) => {
    await abrirAbaPontos(page);
    await cartaoDoPonto(page, PONTO_8_NORTE).filter({ hasText: 'Equipe Fictícia Norte' }).getByRole('button', { name: /^Editar o ponto 8/ }).click();
    await campo(page, 8, 'Situação da vistoria').selectOption({ label: 'Vistoria programada' });
    await campo(page, 8, 'Data da vistoria').fill('');
    await salvar(page, 8);
    await expect(dialogo(page, 8).locator('#pt-e-data_vistoria')).toHaveText('Informe a data da vistoria programada.');
    await campo(page, 8, 'Data da vistoria').fill('2026-10-06');
    await expect(dialogo(page, 8).locator('#pt-a-data_vistoria')).toHaveText('');
    await campo(page, 8, 'Data da vistoria').fill('2026-10-20');
    await expect(dialogo(page, 8).locator('#pt-a-data_vistoria')).toHaveText('fora do período previsto da operação (03/10/2026 a 07/10/2026)');
    await salvar(page, 8);
    await expect(dialogo(page, 8)).toBeHidden();
    await expect(cartaoDoPonto(page, PONTO_8_NORTE).filter({ hasText: 'Equipe Fictícia Norte' })).toContainText('Vistoria: Vistoria programada · 20/10/2026');

    // Reagendar de novo e abrir a operação para ver o histórico.
    await cartaoDoPonto(page, PONTO_8_NORTE).filter({ hasText: 'Equipe Fictícia Norte' }).getByRole('button', { name: /^Editar o ponto 8/ }).click();
    await campo(page, 8, 'Data da vistoria').fill('2026-10-22');
    await salvar(page, 8);
    await cartaoDoPonto(page, PONTO_8_NORTE).filter({ hasText: 'Equipe Fictícia Norte' }).getByRole('button', { name: /^Abrir a operação / }).click();
    await painel(page).getByText(/^Histórico \(/).click();
    await expect(painel(page)).toContainText('Ponto 8: vistoria vistoriada → vistoria programada em 20/10/2026');
    await expect(painel(page)).toContainText('Ponto 8: vistoria reprogramada 20/10/2026 → 22/10/2026');
  });

  test('etapa pelo formulário: muda com as regras de sempre; etapa recusada mostra o motivo e não grava', async ({ page }) => {
    await abrirAbaPontos(page);
    const ponto11 = cartaoDoPonto(page, 'Ponto 11 · Município Fictício B').filter({ hasText: 'Equipe Fictícia Norte' });
    await ponto11.getByRole('button', { name: /^Editar o ponto 11/ }).click();
    await campo(page, 11, 'Etapa').selectOption({ label: 'Auto lavrado' });
    await campo(page, 11, 'Assunto (nota do planejamento)').fill('Nota que não deve ser gravada');
    await salvar(page, 11);
    await expect(dialogo(page, 11).locator('#pt-e-etapa')).toHaveText('O auto só pode ser lavrado depois do relatório concluído.');
    await expect(dialogo(page, 11)).toBeVisible();
    await campo(page, 11, 'Etapa').selectOption({ label: 'Relatório em elaboração' });
    await salvar(page, 11);
    await expect(dialogo(page, 11)).toBeHidden();
    await expect(ponto11).toContainText('Relatório: relatório próprio · em elaboração');
    // O erro anterior não gravou a nota.
    await page.getByRole('search', { name: 'Buscar e filtrar pontos' }).getByLabel('Buscar').fill('Nota que não deve');
    await expect(lista(page).locator('li')).toHaveCount(1); // gravou só no segundo salvar, que levou a nota digitada junto
  });

  test('os autos do ponto aparecem no formulário, com "Registrar outro auto" quando o ponto já tem auto', async ({ page }) => {
    await abrirAbaPontos(page);
    await cartaoDoPonto(page, 'Ponto 1 · Município Fictício A').filter({ hasText: 'Equipe Fictícia Norte' }).getByRole('button', { name: /^Editar o ponto 1/ }).click();
    await expect(dialogo(page, 1).locator('#pt-autos')).toContainText('Auto (tipo não informado) · 13/10/2026');
    await expect(dialogo(page, 1).getByRole('button', { name: 'Registrar outro auto' })).toBeVisible();
    await dialogo(page, 1).getByRole('button', { name: 'Registrar outro auto' }).click();
    await page.getByRole('dialog', { name: 'Registrar auto' }).getByRole('button', { name: 'Registrar auto' }).click();
    await expect(page.getByRole('dialog', { name: 'Registrar auto' })).toBeHidden();
    await expect(dialogo(page, 1)).toBeVisible(); // o formulário do ponto segue aberto e já lista os dois autos
    await expect(dialogo(page, 1).locator('#pt-autos li')).toHaveCount(2);
  });

  test('cancelar e Esc fecham sem gravar e devolvem o foco', async ({ page }) => {
    await abrirAbaPontos(page);
    const botao = cartaoDoPonto(page, PONTO_8_NORTE).filter({ hasText: 'Equipe Fictícia Norte' }).getByRole('button', { name: /^Editar o ponto 8/ });
    await botao.click();
    await campo(page, 8, 'Processo').fill('SEMA-PRO-FICT-9999');
    await dialogo(page, 8).getByRole('button', { name: 'Cancelar' }).click();
    await expect(botao).toBeFocused();
    await botao.click();
    await expect(campo(page, 8, 'Processo')).toHaveValue('');
    await page.keyboard.press('Escape');
    await expect(dialogo(page, 8)).toBeHidden();
    await expect(botao).toBeFocused();
  });
});

test.describe('"Abrir operação" leva até o ponto', () => {
  test('o painel abre com a lista de pontos aberta, o ponto em destaque e o foco no "Editar ponto" dele', async ({ page }) => {
    await abrirAbaPontos(page);
    await cartaoDoPonto(page, 'Ponto 10 · Município Fictício B').filter({ hasText: 'Equipe Fictícia Norte' }).getByRole('button', { name: /^Abrir a operação / }).click();
    await expect(painel(page)).toBeVisible();
    const linha = painel(page).locator('[data-ponto="DEM-0001-10"]');
    await expect(linha).toBeVisible();
    await expect(linha).toHaveClass(/destaque/);
    await expect(linha.getByRole('button', { name: /^Editar o ponto 10/ })).toBeFocused();
    await expect(painel(page).locator('.lista-pontos .ponto-editar')).toHaveCount(13); // um "Editar ponto" por linha
  });

  test('"Editar ponto" no painel abre o formulário do ponto; salvar atualiza o painel que segue aberto', async ({ page }) => {
    await abrir(page);
    await page.locator('#fila .demanda', { hasText: 'operação de outubro (Norte)' }).getByRole('button').click();
    await painel(page).getByText(/^Pontos \(13\)/).click();
    await painel(page).getByRole('button', { name: /^Editar o ponto 12 / }).click();
    await expect(dialogo(page, 12)).toBeVisible();
    await campo(page, 12, 'Assunto (nota do planejamento)').fill('Assunto revisado');
    await salvar(page, 12);
    await expect(dialogo(page, 12)).toBeHidden();
    await expect(painel(page)).toBeVisible();
    await expect(painel(page).locator('[data-ponto="DEM-0001-12"]')).toContainText('Assunto revisado');
    await expect(painel(page).getByRole('button', { name: /^Editar o ponto 12 / })).toBeFocused();
  });
});

test.describe('registrar retorno com vistorias reagendadas', () => {
  test('pontos programados para depois do retorno continuam planejados', async ({ page }) => {
    await abrir(page);
    await page.getByRole('button', { name: 'Importar operação' }).click();
    const imp = page.getByRole('dialog', { name: 'Importar operação' });
    await imp.getByRole('button', { name: /exemplo/i }).click();
    await expect(imp.locator('#imp-previa')).toContainText('Planilha válida');
    await imp.getByRole('button', { name: /^Importar/ }).click();
    await irParaAba(page, 'Pontos');
    await page.getByRole('search', { name: 'Buscar e filtrar pontos' }).getByLabel('Operação').selectOption({ label: 'Equipe Fictícia Leste · saída 09/11/2026' });
    await cartaoDoPonto(page, 'Ponto 3 ·').getByRole('button', { name: /^Editar o ponto 3/ }).click();
    await campo(page, 3, 'Situação da vistoria').selectOption({ label: 'Vistoria programada' });
    await campo(page, 3, 'Data da vistoria').fill('2026-11-20');
    await expect(dialogo(page, 3).locator('#pt-a-data_vistoria')).toContainText('fora do período previsto da operação');
    await expect(campo(page, 3, 'Etapa')).toBeDisabled(); // ponto planejado: a etapa só muda ao registrar o retorno
    await salvar(page, 3);
    await expect(dialogo(page, 3)).toBeHidden();

    await irParaAba(page, 'Demandas');
    await page.locator('#fila .demanda', { hasText: 'Equipe Fictícia Leste' }).getByRole('button').click();
    await painel(page).getByRole('button', { name: 'Registrar retorno' }).click();
    const ret = page.getByRole('dialog', { name: 'Registrar retorno' });
    await expect(ret).toContainText('1 ponto fica planejado: a vistoria foi reagendada para depois do retorno.');
    await ret.getByRole('button', { name: /^Registrar/ }).last().click();
    await expect(ret).toBeHidden();
    await expect(page.locator('#mensagem')).toContainText('1 continua planejado (vistoria reagendada)');
  });
});

test.describe('formulário do ponto em tela de celular', () => {
  test('cabe na largura, sem rolagem horizontal', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await abrirAbaPontos(page);
    await cartaoDoPonto(page, PONTO_8_NORTE).filter({ hasText: 'Equipe Fictícia Norte' }).getByRole('button', { name: /^Editar o ponto 8/ }).click();
    const caixa = await dialogo(page, 8).boundingBox();
    expect(caixa.x).toBeGreaterThanOrEqual(0);
    expect(caixa.x + caixa.width).toBeLessThanOrEqual(360);
    expect(await dialogo(page, 8).evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    await expect(page.locator('#pt-autos')).toBeVisible();
  });
});
