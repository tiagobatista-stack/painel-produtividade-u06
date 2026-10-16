import { test, expect, abrir, abrirPainel, fecharPainel, indicadores } from './apoio.mjs';

const T_PROCESSO = 'Informação técnica para ofício do Poder Judiciário'; // DEM-0004, processo, A fazer
const T_OPERACAO = 'Relatórios de vistoria — operação de outubro'; // DEM-0001, operação, Em andamento
const T_CONCLUIDA = 'Reunião de acompanhamento semanal'; // DEM-0012

const botaoVisao = (page, nome) => page.getByRole('group', { name: 'Visão da fila' }).getByRole('button', { name: nome, exact: true });
const celula = (page, coluna, faixa) => page.getByRole('list', { name: `${coluna}, faixa ${faixa}`, exact: true });
const cabecalho = (page, coluna) => page.locator(`.quadro-cab[data-coluna="${coluna}"]`);
const cartaoQuadro = (page, trecho) => page.locator('.quadro-cartao', { hasText: trecho });
const abrirQuadro = async (page) => {
  await abrir(page);
  await botaoVisao(page, 'Quadro').click();
  await expect(page.locator('#visao-quadro')).toBeVisible();
};

test.describe('quadro Kanban (RF16 a RF21)', () => {
  test('a lista continua sendo a visão padrão e o quadro some da página', async ({ page }) => {
    await abrir(page);
    await expect(botaoVisao(page, 'Lista')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#visao-quadro')).toBeHidden();
    await expect(page.locator('#fila > li')).not.toHaveCount(0);
  });

  test('RF16: colunas do exemplo e escolha da visão salva no navegador', async ({ page }) => {
    await abrirQuadro(page);
    await expect(botaoVisao(page, 'Quadro')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#fila > li')).toHaveCount(0); // a lista não repete os cartões
    await expect(cabecalho(page, 'a_fazer').locator('.quadro-contagem')).toHaveText('7');
    await expect(cabecalho(page, 'em_andamento').locator('.quadro-contagem')).toHaveText('3/3');
    await expect(cabecalho(page, 'aguardando').locator('.quadro-contagem')).toHaveText('1');
    await expect(cabecalho(page, 'concluida').locator('.quadro-contagem')).toHaveText('2');
    await expect(cabecalho(page, 'em_andamento')).not.toHaveClass(/acima-do-limite/);
    await expect(page.locator('#quadro-metricas')).toContainText('Tempo médio até concluir: 9,5 dias');

    await page.reload();
    await expect(page.locator('#visao-quadro')).toBeVisible();
    await botaoVisao(page, 'Lista').click();
    await expect(page.locator('#visao-quadro')).toBeHidden();
    await page.reload();
    await expect(page.locator('#visao-quadro')).toBeHidden();
    await expect(page.locator('#fila > li')).not.toHaveCount(0);
  });

  test('RF19: faixas Urgente e Data fixa com as demandas do exemplo', async ({ page }) => {
    await abrirQuadro(page);
    await expect(page.getByRole('heading', { name: 'Urgente', level: 3 })).toBeVisible();
    await expect(celula(page, 'Em andamento', 'Urgente').locator('.demanda-titulo')).toHaveText([
      /Manifestação em procedimento do Ministério Público/,
      /Relatórios de vistoria — operação de setembro/,
    ]);
    await expect(page.getByRole('heading', { name: 'Data fixa', level: 3 })).toBeVisible();
    await expect(celula(page, 'A fazer', 'Data fixa').locator('.demanda-titulo')).toHaveCount(3);
    await expect(celula(page, 'Em andamento', 'Data fixa').locator('.demanda-titulo')).toHaveCount(0);
    await expect(celula(page, 'A fazer', 'Rotina').locator('.demanda-titulo')).toHaveText(['Organizar arquivos digitais da equipe']);
  });

  test('RF21: o cartão mostra há quantos dias está parado', async ({ page }) => {
    await abrirQuadro(page);
    await expect(cartaoQuadro(page, T_PROCESSO).locator('.quadro-idade')).toHaveText('Parado há 10 dias');
    await expect(cartaoQuadro(page, T_CONCLUIDA).locator('.quadro-idade')).toHaveText('Concluída em 7 dias');
  });

  test('RF18: "Iniciar" move o card, grava o histórico e o limite só avisa (RF17)', async ({ page }) => {
    await abrirQuadro(page);
    await cartaoQuadro(page, T_PROCESSO).getByRole('button', { name: /^Iniciar/ }).click();

    await expect(cabecalho(page, 'a_fazer').locator('.quadro-contagem')).toHaveText('6');
    await expect(cabecalho(page, 'em_andamento').locator('.quadro-contagem')).toHaveText('4/3');
    await expect(cabecalho(page, 'em_andamento')).toHaveClass(/acima-do-limite/);
    await expect(cabecalho(page, 'em_andamento')).toContainText('Acima do limite: 4 em andamento (limite 3).');
    await expect(page.locator('#quadro-anuncio')).toHaveText('DEM-0004 movida para Em andamento.');
    await expect(cartaoQuadro(page, T_PROCESSO).locator('.quadro-idade')).toHaveText('Parado desde hoje');
    await expect(cartaoQuadro(page, T_PROCESSO).getByRole('button', { name: /^Concluir/ })).toBeVisible();
    await expect(cartaoQuadro(page, T_PROCESSO).getByRole('button', { name: /^Iniciar/ })).toHaveCount(0);
    await expect(cartaoQuadro(page, T_PROCESSO).locator('.demanda-abrir')).toBeFocused(); // o foco fica no cartão movido

    await page.getByRole('spinbutton', { name: 'Limite' }).fill('4');
    await page.getByRole('spinbutton', { name: 'Limite' }).press('Enter');
    await expect(cabecalho(page, 'em_andamento').locator('.quadro-contagem')).toHaveText('4/4');
    await expect(cabecalho(page, 'em_andamento')).not.toHaveClass(/acima-do-limite/);
    await page.reload();
    await expect(cabecalho(page, 'em_andamento').locator('.quadro-contagem')).toHaveText('4/4'); // limite e demanda salvos

    await cartaoQuadro(page, T_PROCESSO).locator('.demanda-abrir').click();
    await expect(page.locator('#painel-demanda')).toContainText('Status: A fazer → Em andamento');
    await fecharPainel(page);
  });

  test('RF18: Aguardar, Retomar e Concluir pelos botões, com o teclado', async ({ page }) => {
    await abrirQuadro(page);
    const aguardar = cartaoQuadro(page, T_PROCESSO).getByRole('button', { name: /^Aguardar/ });
    await aguardar.focus();
    await page.keyboard.press('Enter');
    await expect(cabecalho(page, 'aguardando').locator('.quadro-contagem')).toHaveText('2');
    await cartaoQuadro(page, T_PROCESSO).getByRole('button', { name: /^Retomar/ }).click();
    await expect(cabecalho(page, 'aguardando').locator('.quadro-contagem')).toHaveText('1');
    await cartaoQuadro(page, T_PROCESSO).getByRole('button', { name: /^Concluir/ }).click();
    await expect(cabecalho(page, 'concluida').locator('.quadro-contagem')).toHaveText('3');
    await expect(cartaoQuadro(page, T_PROCESSO).getByRole('button', { name: /^(Iniciar|Aguardar|Retomar|Concluir)/ })).toHaveCount(0);
    await expect(page.locator('#quadro-anuncio')).toHaveText('DEM-0004 movida para Concluída (semana).');
  });

  test('RF18: o card de operação não arrasta e só oferece Sobrestar/Retomar', async ({ page }) => {
    await abrirQuadro(page);
    const op = cartaoQuadro(page, T_OPERACAO);
    await expect(op).not.toHaveAttribute('draggable', 'true');
    await expect(op.getByRole('button', { name: /^Iniciar|^Aguardar|^Concluir/ })).toHaveCount(0);
    await op.getByRole('button', { name: /^Sobrestar operação/ }).click();
    await expect(cabecalho(page, 'aguardando').locator('.quadro-contagem')).toHaveText('2');
    await expect(cartaoQuadro(page, T_OPERACAO).getByRole('button', { name: /^Retomar operação/ })).toBeVisible();
  });

  test('RF18: arrastar um processo de "A fazer" para "Em andamento"', async ({ page, isMobile }) => {
    test.skip(isMobile, 'o arrastar nativo é do desktop; no celular valem os botões');
    await abrirQuadro(page);
    const card = cartaoQuadro(page, T_PROCESSO);
    await expect(card).toHaveAttribute('draggable', 'true');
    await card.dragTo(celula(page, 'Em andamento', 'Padrão')); // mesma faixa: origem e destino cabem na tela
    await expect(cabecalho(page, 'em_andamento').locator('.quadro-contagem')).toHaveText('4/3');
    await expect(cabecalho(page, 'a_fazer').locator('.quadro-contagem')).toHaveText('6');
    await expect(page.locator('#quadro-anuncio')).toHaveText('DEM-0004 movida para Em andamento.');
    await expect(cartaoQuadro(page, T_CONCLUIDA)).not.toHaveAttribute('draggable', 'true'); // concluída não arrasta
  });

  test('um indicador volta para a lista, filtrada', async ({ page }) => {
    await abrirQuadro(page);
    await page.getByRole('button', { name: /^Vencidas:/ }).click();
    await expect(page.locator('#visao-quadro')).toBeHidden();
    expect((await indicadores(page))[0]).toBe('2');
    await expect(page.locator('#fila > li')).toHaveCount(2);
  });

  test('o painel lateral abre a partir do cartão do quadro', async ({ page }) => {
    await abrirQuadro(page);
    await cartaoQuadro(page, T_PROCESSO).locator('.demanda-abrir').click();
    const p = page.locator('#painel-demanda');
    await expect(p.getByRole('heading', { name: new RegExp(T_PROCESSO) })).toBeVisible();
    await fecharPainel(page);
    await expect(cartaoQuadro(page, T_PROCESSO).locator('.demanda-abrir')).toBeFocused();
  });

  test('a página não ganha rolagem horizontal com o quadro aberto', async ({ page }) => {
    await abrirQuadro(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    // o quadro rola dentro da própria área, não a página
    expect(await page.locator('#quadro-grade').evaluate((e) => e.scrollWidth >= e.clientWidth)).toBe(true);
  });
});
