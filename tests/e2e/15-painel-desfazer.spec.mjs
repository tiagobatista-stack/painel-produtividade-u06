import { test, expect, abrir, abrirPainel, cadastrarProcesso, cartao, fecharPainel, painel, usarDataDoExemplo } from './apoio.mjs';

const TITULO = 'Organizar arquivos digitais da equipe'; // DEM-0011, tipo "outra", prazo 25/10, faixa Baixa
const guardadas = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('painel-demandas:v1')).demandas.length);
const titulos = (page) => page.locator('#fila .demanda-titulo').allTextContents();
const toast = (page) => page.locator('#mensagem');
const desfazer = (page) => toast(page).getByRole('button', { name: 'Desfazer' });

test.describe('card compacto e painel lateral (RF20)', () => {
  test('o card mostra só tipo, título, faixa e prazo', async ({ page }) => {
    await abrir(page);
    const c = cartao(page, TITULO);
    await expect(c.locator('.etiqueta')).toHaveText('Outra');
    await expect(c.locator('.status')).toHaveText('Baixa');
    await expect(c.locator('.demanda-titulo')).toHaveText(TITULO);
    await expect(c.locator('.demanda-prazo')).toContainText('Prazo: 25/10/2026 · em 10 dias');
    await expect(c).toHaveClass(/faixa-baixa/); // a faixa também aparece na cor da borda
    await expect(c.getByRole('button')).toHaveCount(1); // só o botão que abre o painel
    await expect(c.locator('select, details, .prioridade, .acoes-cartao')).toHaveCount(0);
    await expect(c.getByRole('button', { name: /Editar|Excluir/ })).toHaveCount(0);
  });

  test('o painel traz motivos, status, histórico, editar e excluir; abre pelo teclado e devolve o foco', async ({ page }) => {
    await abrir(page);
    const botao = cartao(page, TITULO).getByRole('button');
    await botao.focus();
    await page.keyboard.press('Enter');
    const p = painel(page);
    await expect(p).toBeVisible();
    await expect(p.getByRole('heading', { name: TITULO })).toBeVisible();
    await expect(p.locator('.prioridade')).toHaveText('Prioridade Baixa · 0 pontos');
    await expect(p.getByRole('heading', { name: 'Por que esta prioridade?' })).toBeVisible();
    await expect(p.getByLabel('Status')).toBeVisible();
    await expect(p.getByRole('button', { name: `Editar ${TITULO}` })).toBeVisible();
    await expect(p.getByRole('button', { name: `Excluir ${TITULO}` })).toBeVisible();
    await expect(p.getByRole('button', { name: 'Fechar' })).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(p).toBeHidden();
    await expect(botao).toBeFocused();

    await botao.click();
    await p.getByRole('button', { name: 'Fechar' }).click();
    await expect(p).toBeHidden();
    await expect(botao).toBeFocused();
  });

  test('o foco fica preso no painel enquanto ele está aberto', async ({ page }) => {
    await abrir(page);
    await abrirPainel(page, TITULO);
    for (let i = 0; i < 14; i++) {
      await page.keyboard.press('Tab');
      // o Tab pode sair para a interface do navegador, mas nunca cai num elemento da página fora do painel
      const naPaginaForaDoPainel = await page.evaluate(() => {
        const a = document.activeElement;
        return Boolean(a) && a !== document.body && !a.closest('#painel-demanda');
      });
      expect(naPaginaForaDoPainel, `Tab ${i + 1}`).toBe(false);
    }
  });

  test('clicar fora do painel também fecha', async ({ page, isMobile }) => {
    test.skip(isMobile, 'no celular o painel ocupa a tela toda');
    await abrir(page);
    await abrirPainel(page, TITULO);
    await page.mouse.click(40, 400); // na área escurecida, à esquerda do painel
    await expect(painel(page)).toBeHidden();
  });

  test('a operação mostra os pontos no painel, e o card dela continua compacto', async ({ page }) => {
    await abrir(page);
    const c = cartao(page, 'operação de setembro (Sul)');
    await expect(c.locator('details')).toHaveCount(0);
    const p = await abrirPainel(page, 'operação de setembro (Sul)');
    await expect(p.locator('details.pontos > summary')).toContainText('Pontos (');
    await expect(p.getByRole('button', { name: /^Sobrestar operação/ })).toBeVisible();
  });
});

test.describe('excluir sem confirmação, com Desfazer (RF20)', () => {
  test('não abre caixa de confirmação; Desfazer devolve a demanda à mesma posição e a restauração persiste', async ({ page }) => {
    let caixas = 0;
    page.on('dialog', (d) => { caixas++; d.dismiss(); });
    await abrir(page);
    const antes = await titulos(page);
    const total = await guardadas(page);

    const p = await abrirPainel(page, TITULO);
    await p.getByRole('button', { name: `Excluir ${TITULO}` }).click();
    await expect(p).toBeHidden();
    await expect(toast(page)).toContainText('Demanda excluída.');
    await expect(cartao(page, TITULO)).toHaveCount(0);
    await expect(desfazer(page)).toBeFocused(); // o foco vai para o "Desfazer": quem usa teclado não se perde
    expect(caixas).toBe(0);
    expect(await guardadas(page)).toBe(total - 1);

    await page.keyboard.press('Enter'); // Desfazer pelo teclado
    await expect(toast(page)).toContainText('Demanda restaurada.');
    expect(await titulos(page)).toEqual(antes); // mesma ordem de antes
    expect(await guardadas(page)).toBe(total);
    await expect(cartao(page, TITULO).getByRole('button')).toBeFocused();

    await page.reload();
    await usarDataDoExemplo(page); // a data de referência é só da tela: depois de recarregar vale a data real, e a ordem mudaria
    await expect(page.locator('#fila .demanda-titulo').first()).toBeVisible();
    expect(await titulos(page)).toEqual(antes);
  });

  test('o Desfazer some em cerca de 8 s e a exclusão fica valendo, sem perder o foco', async ({ page }) => {
    await page.clock.install();
    await abrir(page);
    const p = await abrirPainel(page, TITULO);
    await p.getByRole('button', { name: `Excluir ${TITULO}` }).click();
    await expect(desfazer(page)).toBeVisible();
    await page.clock.fastForward(7000);
    await expect(desfazer(page)).toBeVisible(); // ainda dentro dos ~8 s
    await page.clock.fastForward(2000);
    await expect(toast(page)).toBeHidden();
    await expect(page.locator('#titulo-fila')).toBeFocused();
    await expect(cartao(page, TITULO)).toHaveCount(0);
    expect(await guardadas(page)).toBe(13);
  });

  test('uma operação excluída volta com todos os pontos', async ({ page }) => {
    await abrir(page);
    const alvo = 'operação de setembro (Sul)';
    const p = await abrirPainel(page, alvo);
    const pontos = await p.locator('details.pontos > summary').textContent();
    await p.getByRole('button', { name: /^Excluir/ }).click();
    await expect(cartao(page, alvo)).toHaveCount(0);
    await desfazer(page).click();
    const volta = await abrirPainel(page, alvo);
    await expect(volta.locator('details.pontos > summary')).toHaveText(pontos);
    await fecharPainel(page);
  });

  test('se o número foi reaproveitado por outra demanda, o Desfazer é recusado com aviso', async ({ page }) => {
    await abrir(page);
    await cadastrarProcesso(page, { titulo: 'Processo que será excluído' }); // DEM-0015
    const p = await abrirPainel(page, 'Processo que será excluído');
    await p.getByRole('button', { name: /^Excluir/ }).click();
    await expect(desfazer(page)).toBeVisible();
    await cadastrarProcesso(page, { titulo: 'Outro processo', processo: 'SEMA-PRO-FICT-0998' }); // recebe de novo o DEM-0015
    await desfazer(page).click();
    await expect(page.locator('#erro')).toContainText('Não foi possível desfazer: o número DEM-0015 já foi usado por outra demanda.');
    await expect(cartao(page, 'Outro processo')).toHaveCount(1);
    await expect(cartao(page, 'Processo que será excluído')).toHaveCount(0);
  });
});
