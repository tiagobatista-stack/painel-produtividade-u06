// Mapa com camadas (Leaflet local). Nenhum teste usa a rede real: os servidores de mapa são interceptados e respondem com uma
// imagem de 1 pixel (ou com falha, no teste de recuo). As coordenadas do exemplo e da demanda de teste são fictícias.
import { test, expect, abrir, fecharPainel, irParaAba, painel, usarDataDoExemplo } from './apoio.mjs';

const SERVIDORES = /^https:\/\/(tile\.openstreetmap\.org|geo\.sema\.mt\.gov\.br)\//;
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

const mapa = (page) => page.locator('#pontos-mapa');
const visao = (page, nome) => page.getByRole('group', { name: 'Visão dos pontos' }).getByRole('button', { name: nome, exact: true });
const camada = (page, nome) => page.getByRole('group', { name: 'Camada do mapa' }).getByRole('button', { name: nome, exact: true });
const marcadores = (page) => page.locator('#mapa-leaflet .leaflet-marker-icon');
const filtrosPontos = (page) => page.getByRole('search', { name: 'Buscar e filtrar pontos' });

async function simularServidores(page, pedidos = []) {
  await page.route(SERVIDORES, (rota) => {
    pedidos.push(rota.request().url());
    return rota.fulfill({ status: 200, contentType: 'image/png', body: PNG });
  });
  return pedidos;
}

async function abrirMapa(page) {
  await abrir(page);
  await irParaAba(page, 'Pontos');
  await visao(page, 'Mapa').click();
  await expect(mapa(page)).toBeVisible();
}

async function abrirComCamada(page, nome, pedidos) {
  await simularServidores(page, pedidos);
  await abrirMapa(page);
  await camada(page, nome).click();
  await expect(camada(page, nome)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#mapa-leaflet')).toBeVisible();
}

const DEMANDA = {
  id: 'DEM-9001', tipo: 'outra', titulo: 'Vistoria fictícia no oceano', origem: 'propria', status: 'a_fazer', prazo: '2026-10-20',
  criada_em: '2026-10-09', esforco_h: 2, historico: [], municipio: 'Município Fictício Z', coord_x: -20.2, coord_y: -15.2,
};

// Acrescenta ao armazenamento do navegador uma demanda com coordenada (o formulário com coordenadas vem no PR B).
async function comDemandaCoordenada(page) {
  await abrir(page);
  await page.evaluate((d) => {
    const dados = JSON.parse(localStorage.getItem('painel-demandas:v1'));
    dados.demandas.push(d);
    localStorage.setItem('painel-demandas:v1', JSON.stringify(dados));
  }, DEMANDA);
  await page.reload();
  await usarDataDoExemplo(page);
  await irParaAba(page, 'Pontos');
  await visao(page, 'Mapa').click();
}

test.describe('mapa com camadas: OpenStreetMap e satélite', () => {
  test('ao abrir o Mapa nenhum servidor é consultado; só a escolha da camada dispara os pedidos', async ({ page }) => {
    const pedidos = await simularServidores(page);
    await abrirMapa(page);
    await expect(camada(page, 'Sem mapa-base')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#mapa-svg-caixa .marcador')).toHaveCount(21);
    await expect(page.locator('#mapa-leaflet-area')).toBeHidden();
    await page.waitForTimeout(500);
    expect(pedidos).toEqual([]);

    await camada(page, 'OpenStreetMap').click();
    await expect(page.locator('#mapa-leaflet')).toBeVisible();
    await expect.poll(() => pedidos.length).toBeGreaterThan(0);
    expect(pedidos.every((u) => u.startsWith('https://tile.openstreetmap.org/'))).toBe(true);
    await expect(page.locator('#mapa-nota')).toContainText('tile.openstreetmap.org');
    await expect(page.locator('#mapa-nota')).toContainText('Nenhum dado das fichas é enviado');
  });

  test('os marcadores são os itens da lista filtrada, e limpar o filtro devolve todos', async ({ page }) => {
    await abrirComCamada(page, 'OpenStreetMap');
    await expect(marcadores(page)).toHaveCount(25);
    await page.locator('#pontos-indicadores button', { hasText: 'Auto a lavrar' }).click();
    await expect(marcadores(page)).toHaveCount(2);
    await expect(page.locator('#mapa-legenda .legenda-item').nth(2)).toHaveText('Relatório concluído, auto a lavrar: 2');
    await filtrosPontos(page).getByRole('button', { name: 'Limpar filtros' }).click();
    await expect(marcadores(page)).toHaveCount(25);
    await filtrosPontos(page).getByLabel('Operação').selectOption({ label: 'Equipe Fictícia Sul · saída 22/09/2026' });
    await expect(marcadores(page)).toHaveCount(8);
    await filtrosPontos(page).getByLabel('Buscar').fill('nada disso existe');
    await expect(marcadores(page)).toHaveCount(0);
    await expect(page.locator('#mapa-vazio')).toBeVisible();
  });

  test('o popup mostra título, prioridade, prazo e etapa, e "Abrir no painel" abre a operação', async ({ page }) => {
    await abrirComCamada(page, 'OpenStreetMap');
    const m = page.locator('[data-foco="mapa-DEM-0001-7"]');
    await m.focus(); // no enquadramento inicial os pontos do mesmo município ficam sobrepostos: pelo teclado não há ambiguidade
    await page.keyboard.press('Enter');
    const popup = page.locator('.leaflet-popup');
    await expect(popup).toBeVisible();
    await expect(popup.locator('.popup-titulo')).toHaveText('Ponto 7 · Município Fictício B');
    await expect(popup).toContainText('Equipe Fictícia Norte');
    await expect(popup).toContainText('Prioridade da operação: Alta'); // a mesma faixa da fila (operação do exemplo: vence em 2 dias, 68 pontos)
    await expect(popup).toContainText('Prazo dos relatórios: 17/10/2026 · em 2 dias');
    await expect(popup).toContainText('Etapa: Relatório concluído');
    await popup.getByRole('button', { name: 'Abrir no painel' }).click();
    await expect(painel(page)).toBeVisible();
    await expect(painel(page).getByRole('heading', { name: /operação de outubro \(Norte\)/ })).toBeVisible();
    await fecharPainel(page);
  });

  test('o marcador é operável pelo teclado (Enter abre o popup) e tem nome acessível', async ({ page }) => {
    await abrirComCamada(page, 'OpenStreetMap');
    const m = page.locator('[data-foco="mapa-DEM-0001-7"]');
    await expect(m).toHaveAttribute('role', 'button');
    await expect(m).toHaveAttribute('aria-label', /Ponto 7 · Município Fictício B, operação Equipe Fictícia Norte: Relatório concluído, auto a lavrar\. Abrir os detalhes/);
    await m.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.leaflet-popup')).toBeVisible();
    await expect(page.locator('.leaflet-popup .popup-titulo')).toHaveText('Ponto 7 · Município Fictício B');
  });

  test('trocar de camada mantém marcadores e filtro; o satélite pede o mosaico da SEMA e cada camada mostra a atribuição', async ({ page }) => {
    const pedidos = [];
    await abrirComCamada(page, 'OpenStreetMap', pedidos);
    await page.locator('#pontos-indicadores button', { hasText: 'Auto a lavrar' }).click();
    await expect(marcadores(page)).toHaveCount(2);
    await expect(page.locator('.leaflet-control-attribution')).toContainText('contribuidores do OpenStreetMap');
    await expect(page.locator('.leaflet-control-attribution a[href="https://www.openstreetmap.org/copyright"]')).toHaveText('OpenStreetMap');

    await camada(page, 'Satélite').click();
    await expect(camada(page, 'Satélite')).toHaveAttribute('aria-pressed', 'true');
    await expect(camada(page, 'OpenStreetMap')).toHaveAttribute('aria-pressed', 'false');
    await expect(marcadores(page)).toHaveCount(2);
    await expect(page.locator('#pontos-indicadores button[aria-pressed="true"]')).toContainText('Auto a lavrar');
    await expect(page.locator('.leaflet-control-attribution')).toContainText('Sentinel-2');
    await expect.poll(() => pedidos.some((u) => u.startsWith('https://geo.sema.mt.gov.br/geoserver/ows'))).toBe(true);
    const sema = new URL(pedidos.find((u) => u.startsWith('https://geo.sema.mt.gov.br/')));
    expect(sema.searchParams.get('layers')).toBe('Mosaicos:SENTINEL_2_2025');
    expect(sema.searchParams.get('service')?.toUpperCase()).toBe('WMS');
    expect(sema.searchParams.get('version')).toBe('1.3.0');
    expect(sema.searchParams.get('width')).toBe('512');
    expect(sema.searchParams.get('format')).toBe('image/jpeg');
    await expect(page.locator('#mapa-nota')).toContainText('geo.sema.mt.gov.br');

    await camada(page, 'Sem mapa-base').click();
    await expect(page.locator('#mapa-leaflet-area')).toBeHidden();
    await expect(page.locator('#mapa-svg-caixa .marcador')).toHaveCount(2);
  });

  test('a camada escolhida fica salva e volta depois de recarregar', async ({ page }) => {
    const pedidos = [];
    await abrirComCamada(page, 'Satélite', pedidos);
    await page.reload();
    await usarDataDoExemplo(page);
    await irParaAba(page, 'Pontos');
    await expect(visao(page, 'Mapa')).toHaveAttribute('aria-pressed', 'true');
    await expect(camada(page, 'Satélite')).toHaveAttribute('aria-pressed', 'true');
    await expect(marcadores(page)).toHaveCount(25);
  });

  test('o mapa mostra a coordenada em GMS sob o cursor e o clique fixa o ponto para copiar', async ({ page, context, isMobile }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await abrirComCamada(page, 'OpenStreetMap');
    const caixa = await page.locator('#mapa-leaflet').boundingBox();
    const ponto = { x: caixa.x + caixa.width / 2, y: caixa.y + 14 }; // no alto, longe dos marcadores e dos controles
    const gms = /\d+° \d{2}' \d{2},\d{2}" [NS], \d+° \d{2}' \d{2},\d{2}" [LO]/;
    await expect(page.locator('#mapa-copiar')).toBeDisabled();
    if (!isMobile) {
      await page.mouse.move(ponto.x, ponto.y);
      await expect(page.locator('#mapa-coordenada')).toHaveText(new RegExp(`^Cursor: ${gms.source} \\(-?\\d+,\\d{6}, -?\\d+,\\d{6}\\)$`));
    }
    await page.mouse.click(ponto.x, ponto.y);
    await expect(page.locator('#mapa-coordenada')).toHaveText(new RegExp(`^Ponto marcado: ${gms.source} \\(-?\\d+,\\d{6}, -?\\d+,\\d{6}\\)$`));
    await expect(page.locator('#mapa-copiar')).toBeEnabled();
    const marcado = (await page.locator('#mapa-coordenada').textContent()).match(gms)[0];
    await page.locator('#mapa-copiar').click();
    await expect(page.locator('#mensagem')).toContainText(`Coordenada copiada: ${marcado}`);
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(marcado);
    // No exemplo (Mato Grosso fictício, hemisfério sul e oeste) a coordenada é S e O.
    expect(marcado).toMatch(/ S, .* O$/);
  });

  test('sem conseguir carregar a camada, o mapa avisa e volta para "Sem mapa-base", sem perder os marcadores', async ({ page }) => {
    await page.route(SERVIDORES, (rota) => rota.abort());
    await abrirMapa(page);
    await camada(page, 'OpenStreetMap').click();
    await expect(page.locator('#erro')).toContainText('Não foi possível carregar o mapa-base');
    await expect(camada(page, 'Sem mapa-base')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#mapa-leaflet-area')).toBeHidden();
    await expect(page.locator('#mapa-svg-caixa .marcador')).toHaveCount(21);
    // Escolher de novo tenta outra vez (aqui o servidor continua bloqueado e o recuo se repete).
    await page.route(SERVIDORES, (rota) => rota.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
    await camada(page, 'Satélite').click();
    await expect(camada(page, 'Satélite')).toHaveAttribute('aria-pressed', 'true');
    await expect(marcadores(page)).toHaveCount(25);
  });

  test('demanda com coordenada vira marcador próprio, com prioridade no popup, e obedece aos filtros', async ({ page }) => {
    await simularServidores(page);
    await comDemandaCoordenada(page);
    await camada(page, 'OpenStreetMap').click();
    await expect(marcadores(page)).toHaveCount(26);
    const demanda = page.locator('[data-foco="mapa-demanda-DEM-9001"]');
    await expect(demanda).toHaveAttribute('aria-label', /Demanda Vistoria fictícia no oceano, prioridade Baixa\. Abrir os detalhes/);
    await expect(demanda.locator('.marcador-letra')).toHaveText('B');
    await expect(page.locator('#mapa-legenda .legenda-item').last()).toHaveText('Demandas com coordenada (letra = faixa): 5');

    await demanda.click();
    const popup = page.locator('.leaflet-popup');
    await expect(popup.locator('.popup-titulo')).toHaveText('Vistoria fictícia no oceano');
    await expect(popup).toContainText('Prioridade: Baixa');
    await expect(popup).toContainText('Prazo: 20/10/2026');
    await expect(popup).toContainText('Situação: A fazer');
    await popup.getByRole('button', { name: 'Abrir no painel' }).click();
    await expect(painel(page).getByRole('heading', { name: 'Vistoria fictícia no oceano' })).toBeVisible();
    await fecharPainel(page);

    await filtrosPontos(page).getByLabel('Buscar').fill('oceano');
    await expect(marcadores(page)).toHaveCount(1); // a busca vale para a demanda; nenhum ponto combina
    await filtrosPontos(page).getByRole('button', { name: 'Limpar filtros' }).click();
    await expect(marcadores(page)).toHaveCount(26);
    await filtrosPontos(page).getByLabel('Operação').selectOption({ label: 'Equipe Fictícia Sul · saída 22/09/2026' });
    await expect(marcadores(page)).toHaveCount(8); // escolher uma operação esconde as demandas
  });

  test('o mapa cabe na largura da tela, sem rolagem horizontal da página', async ({ page }) => {
    await abrirComCamada(page, 'OpenStreetMap');
    await expect(marcadores(page)).toHaveCount(25);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const caixa = await page.locator('#mapa-leaflet').boundingBox();
    expect(caixa.x).toBeGreaterThanOrEqual(0);
    expect(caixa.x + caixa.width).toBeLessThanOrEqual(page.viewportSize().width + 1);
    expect(caixa.height).toBeGreaterThanOrEqual(300);
  });

  test('voltar para a Lista fecha o mapa e para os pedidos de blocos', async ({ page }) => {
    const pedidos = [];
    await abrirComCamada(page, 'OpenStreetMap', pedidos);
    await expect.poll(() => pedidos.length).toBeGreaterThan(0);
    await visao(page, 'Lista').click();
    await expect(mapa(page)).toBeHidden();
    await page.waitForTimeout(300);
    const antes = pedidos.length;
    await page.waitForTimeout(500);
    expect(pedidos.length).toBe(antes);
    await visao(page, 'Mapa').click();
    await expect(marcadores(page)).toHaveCount(25);
  });
});
