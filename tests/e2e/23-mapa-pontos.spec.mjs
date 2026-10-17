// Mapa local dos pontos. As coordenadas do exemplo e as das planilhas coladas aqui são fictícias.
import { test, expect, abrir, fecharPainel, irParaAba, painel } from './apoio.mjs';

const mapa = (page) => page.locator('#pontos-mapa');
const marcadores = (page) => page.locator('#mapa-svg-caixa .marcador');
const visao = (page, nome) => page.getByRole('group', { name: 'Visão dos pontos' }).getByRole('button', { name: nome, exact: true });
const legenda = (page) => page.locator('#mapa-legenda .legenda-item');

async function abrirMapa(page) {
  await abrir(page);
  await irParaAba(page, 'Pontos');
  await visao(page, 'Mapa').click();
  await expect(mapa(page)).toBeVisible();
}

test.describe('mapa dos pontos, classificado por situação', () => {
  test('um marcador por ponto, com forma e cor por situação, e a lista some enquanto o mapa está aberto', async ({ page }) => {
    await abrirMapa(page);
    await expect(visao(page, 'Mapa')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#pontos-lista')).toBeHidden();
    await expect(marcadores(page)).toHaveCount(21);
    await expect(page.locator('#mapa-svg-caixa .marcador-aguardando_relatorio')).toHaveCount(9);
    await expect(page.locator('#mapa-svg-caixa .marcador-a_lavrar')).toHaveCount(2);
    await expect(page.locator('#mapa-svg-caixa .marcador-com_auto')).toHaveCount(6);
    await expect(page.locator('#mapa-svg-caixa .marcador-encerrado_sem_auto')).toHaveCount(4);
    // formas diferentes por situação (não só cores)
    const tags = async (situacao) => page.locator(`#mapa-svg-caixa .marcador-${situacao} .marcador-forma`).first().evaluate((e) => e.tagName.toLowerCase());
    expect(await tags('aguardando_relatorio')).toBe('rect');
    expect(await tags('a_lavrar')).toBe('polygon');
    expect(await tags('encerrado_sem_auto')).toBe('polygon');
    expect(await tags('com_auto')).toBe('circle');
  });

  test('legenda com a contagem por situação, escala e rótulos de município', async ({ page }) => {
    await abrirMapa(page);
    await expect(legenda(page)).toHaveText([
      'Planejado: 0', 'Aguardando relatório: 9', 'Relatório concluído, auto a lavrar: 2', 'Com auto lavrado: 6', 'Encerrado sem auto: 4',
    ]);
    await expect(page.locator('#mapa-svg-caixa .mapa-municipio')).toHaveCount(4); // municípios fictícios A, B, C e D
    await expect(page.locator('#mapa-svg-caixa .mapa-municipio').first()).toContainText('Município Fictício');
    await expect(page.locator('#mapa-svg-caixa .mapa-escala-rotulo')).toContainText('km');
    await expect(page.locator('#mapa-svg-caixa svg')).toHaveAttribute('aria-label', /sem mapa-base/);
  });

  test('o mapa usa os mesmos filtros e contadores da lista', async ({ page }) => {
    await abrirMapa(page);
    await page.locator('#pontos-indicadores button', { hasText: 'Auto a lavrar' }).click();
    await expect(marcadores(page)).toHaveCount(2);
    await expect(legenda(page).nth(2)).toHaveText('Relatório concluído, auto a lavrar: 2');
    await expect(legenda(page).nth(1)).toHaveText('Aguardando relatório: 0');
    await page.getByRole('search', { name: 'Buscar e filtrar pontos' }).getByRole('button', { name: 'Limpar filtros' }).click();
    await expect(marcadores(page)).toHaveCount(21);
    await page.getByRole('search', { name: 'Buscar e filtrar pontos' }).getByLabel('Operação').selectOption({ label: 'Equipe Fictícia Sul · saída 22/09/2026' });
    await expect(marcadores(page)).toHaveCount(8);
  });

  test('a visão escolhida fica salva; a Lista continua disponível', async ({ page }) => {
    await abrirMapa(page);
    await page.reload();
    await abrir(page);
    await irParaAba(page, 'Pontos');
    await expect(mapa(page)).toBeVisible();
    await expect(visao(page, 'Mapa')).toHaveAttribute('aria-pressed', 'true');
    await visao(page, 'Lista').click();
    await expect(mapa(page)).toBeHidden();
    await expect(page.locator('#pontos-lista > li')).toHaveCount(21);
    await expect(visao(page, 'Lista')).toBeFocused();
  });

  test('cada marcador é operável pelo teclado e abre o painel da operação', async ({ page }) => {
    await abrirMapa(page);
    const m = page.locator('[data-foco="mapa-DEM-0001-7"]');
    await expect(m).toHaveAttribute('role', 'button');
    await expect(m).toHaveAttribute('aria-label', /Ponto 7, Município Fictício B, operação Equipe Fictícia Norte: Relatório concluído, auto a lavrar\. Abrir a operação/);
    await m.focus();
    await page.keyboard.press('Enter');
    await expect(painel(page)).toBeVisible();
    await expect(painel(page).getByRole('heading', { name: /operação de outubro \(Norte\)/ })).toBeVisible();
    await fecharPainel(page);
    await expect(m).toBeFocused();
    await m.press(' ');
    await expect(painel(page)).toBeVisible();
  });

  test('mudar a situação de um ponto no painel muda o marcador', async ({ page }) => {
    await abrirMapa(page);
    await page.locator('[data-foco="mapa-DEM-0001-10"]').click();
    await painel(page).locator('details.pontos > summary').click();
    await painel(page).locator('li.ponto', { hasText: 'Ponto 10 ·' }).getByLabel('Etapa').selectOption({ label: 'Relatório concluído' });
    await fecharPainel(page);
    await expect(page.locator('[data-foco="mapa-DEM-0001-10"]')).toHaveClass(/marcador-a_lavrar/);
    await expect(page.locator('#mapa-svg-caixa .marcador-a_lavrar')).toHaveCount(3);
    await expect(page.locator('#mapa-svg-caixa .marcador-aguardando_relatorio')).toHaveCount(8);
  });

  test('ponto sem coordenadas não vai para o mapa e fica numa lista própria', async ({ page }) => {
    await abrir(page);
    await page.getByRole('button', { name: 'Importar operação' }).click();
    const d = page.getByRole('dialog', { name: 'Importar operação' });
    const CAB = 'N_PONTO\tEQUIPE\tCOORD_X\tCOORD_Y\tMUNICIPIO\tDAT_SAIDA\tDAT_RETOR\tNOT_PLANEJ';
    const l = (n, x, y) => [n, 'Equipe Fictícia Oeste', x, y, 'Município Fictício E', '16/11/2026', '20/11/2026', ''].join('\t');
    await d.getByLabel('Linhas da planilha').fill([CAB, l(1, `20° 30' 00" W`, `15° 20' 00" S`), l(2, '', ''), l(3, '-20,9', '')].join('\n'));
    await expect(d.locator('#imp-previa')).toContainText('Planilha válida');
    await d.getByRole('button', { name: 'Importar', exact: true }).click();
    await expect(d).toBeHidden();

    await irParaAba(page, 'Pontos');
    await visao(page, 'Mapa').click();
    await expect(marcadores(page)).toHaveCount(22); // 21 + o ponto 1 da nova operação
    await expect(page.locator('#mapa-sem-coordenada')).toBeVisible();
    const sem = page.locator('#mapa-sem-coordenada-lista > li');
    await expect(sem).toHaveCount(2); // pontos 2 e 3 (o 3 só tem a longitude)
    await expect(sem.first()).toContainText('Ponto 2 · Município Fictício E');
    await sem.first().getByRole('button', { name: /sem coordenadas/ }).click();
    await expect(painel(page)).toBeVisible();
  });

  test('sem nenhum ponto com coordenadas, o mapa avisa em vez de desenhar', async ({ page }) => {
    await abrirMapa(page);
    await page.getByRole('search', { name: 'Buscar e filtrar pontos' }).getByLabel('Buscar').fill('nada disso existe');
    await expect(marcadores(page)).toHaveCount(0);
    await expect(page.locator('#mapa-vazio')).toBeVisible();
    await expect(page.locator('#mapa-svg-caixa svg')).toHaveCount(0);
  });

  test('o mapa não faz nenhuma requisição externa (nem de mapa-base)', async ({ page }) => {
    const externas = [];
    page.on('request', (r) => {
      const u = new URL(r.url());
      if (!['localhost', '127.0.0.1'].includes(u.hostname) && u.protocol.startsWith('http')) externas.push(r.url());
    });
    await abrirMapa(page);
    await expect(marcadores(page)).toHaveCount(21);
    expect(externas).toEqual([]);
  });

  test('o mapa cabe na largura da tela, sem rolagem horizontal da página', async ({ page }) => {
    await abrirMapa(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const caixa = await page.locator('#mapa-svg-caixa svg').boundingBox();
    expect(caixa.x).toBeGreaterThanOrEqual(0);
    expect(caixa.x + caixa.width).toBeLessThanOrEqual(page.viewportSize().width + 1);
  });
});
