// Mini-mapa do ponto da demanda no painel lateral (RF66). Nenhum teste usa a rede real: os servidores de mapa são interceptados.
// Coordenadas fictícias, em pleno Atlântico.
import { test, expect, abrir, abrirPainel, fecharPainel } from './apoio.mjs';

const SERVIDORES = /^https:\/\/(tile\.openstreetmap\.org|geo\.sema\.mt\.gov\.br)\//;
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const TITULO = 'Vistoria fictícia no oceano';

const DEMANDA = {
  id: 'DEM-9001', tipo: 'outra', titulo: TITULO, origem: 'propria', status: 'a_fazer', prazo: '2026-10-20',
  criada_em: '2026-10-09', esforco_h: 2, historico: [], municipio: 'Município Fictício Z', coord_x: -20.2, coord_y: -15.2,
};

const painel = (page) => page.locator('#painel-demanda');
const grupo = (page) => painel(page).getByRole('group', { name: 'Camada do mini-mapa' });
const camada = (page, nome) => grupo(page).getByRole('button', { name: nome, exact: true });
const miniMapa = (page) => painel(page).locator('.mini-mapa');

async function simularServidores(page, pedidos = []) {
  await page.route(SERVIDORES, (rota) => {
    pedidos.push(rota.request().url());
    return rota.fulfill({ status: 200, contentType: 'image/png', body: PNG });
  });
  return pedidos;
}

// Acrescenta ao armazenamento uma demanda com coordenada (e, se pedido, a camada já escolhida na aba Pontos).
async function abrirComDemanda(page, { camadaSalva } = {}) {
  await abrir(page);
  await page.evaluate(([d, c]) => {
    const dados = JSON.parse(localStorage.getItem('painel-demandas:v1'));
    dados.demandas.push(d);
    localStorage.setItem('painel-demandas:v1', JSON.stringify(dados));
    if (c) localStorage.setItem('painel-demandas:camada-mapa', c);
  }, [DEMANDA, camadaSalva ?? null]);
  await page.reload();
  await abrir(page);
}

test.describe('mini-mapa da demanda no painel', () => {
  test('com coordenada: aparece logo abaixo dos botões (Editar), com um só marcador, e sem pedir nada à rede', async ({ page }) => {
    const pedidos = await simularServidores(page);
    await abrirComDemanda(page);
    const p = await abrirPainel(page, TITULO);
    await expect(p.getByRole('heading', { name: 'Localização no mapa' })).toBeVisible();
    await expect(miniMapa(page)).toBeVisible();
    await expect(miniMapa(page).locator('.leaflet-marker-icon')).toHaveCount(1);
    await expect(miniMapa(page)).toHaveAttribute('aria-label', /Mapa com a localização de Vistoria fictícia no oceano/);
    // Fica depois do botão Editar, no fluxo do painel.
    const editar = await p.getByRole('button', { name: /^Editar / }).boundingBox();
    const mapa = await miniMapa(page).boundingBox();
    expect(mapa.y).toBeGreaterThan(editar.y + editar.height - 1);
    // RNF15: sem escolha de camada, nenhum bloco é pedido.
    await expect(camada(page, 'Sem mapa-base')).toHaveAttribute('aria-pressed', 'true');
    await page.waitForTimeout(500);
    expect(pedidos).toEqual([]);
  });

  test('sem coordenada (e operação): não há mini-mapa; uma demanda do exemplo com coordenada tem', async ({ page }) => {
    await simularServidores(page);
    await abrirComDemanda(page);
    const sem = await abrirPainel(page, 'Organizar arquivos digitais');
    await expect(sem.getByRole('heading', { name: 'Localização no mapa' })).toHaveCount(0);
    await expect(miniMapa(page)).toHaveCount(0);
    await fecharPainel(page);
    const operacao = await abrirPainel(page, 'operação de outubro (Norte)');
    await expect(operacao.getByRole('heading', { name: 'Localização no mapa' })).toHaveCount(0);
    await fecharPainel(page);
    const palestra = await abrirPainel(page, 'Palestra sobre prevenção');
    await expect(palestra.getByRole('heading', { name: 'Localização no mapa' })).toBeVisible();
  });

  test('escolher OpenStreetMap ou satélite pede só os blocos daquela camada; a escolha da aba Pontos não muda', async ({ page }) => {
    const pedidos = await simularServidores(page);
    await abrirComDemanda(page);
    await abrirPainel(page, TITULO);
    await camada(page, 'OpenStreetMap').click();
    await expect(camada(page, 'OpenStreetMap')).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => pedidos.length).toBeGreaterThan(0);
    expect(pedidos.every((u) => u.startsWith('https://tile.openstreetmap.org/'))).toBe(true);
    await expect(miniMapa(page).locator('.leaflet-control-attribution')).toContainText('OpenStreetMap');
    await camada(page, 'Satélite (Sentinel-2, SEMA)').click();
    await expect.poll(() => pedidos.some((u) => u.startsWith('https://geo.sema.mt.gov.br/geoserver/ows'))).toBe(true);
    await expect(miniMapa(page).locator('.leaflet-control-attribution')).toContainText('Sentinel-2');
    expect(await page.evaluate(() => localStorage.getItem('painel-demandas:camada-mapa'))).toBeNull();
  });

  test('abre com a camada que o usuário já escolheu na aba Pontos', async ({ page }) => {
    const pedidos = await simularServidores(page);
    await abrirComDemanda(page, { camadaSalva: 'osm' });
    await abrirPainel(page, TITULO);
    await expect(camada(page, 'OpenStreetMap')).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => pedidos.length).toBeGreaterThan(0);
  });

  test('servidor bloqueado: volta a "Sem mapa-base" com aviso, e o marcador continua', async ({ page }) => {
    await page.route(SERVIDORES, (rota) => rota.abort());
    await abrirComDemanda(page);
    await abrirPainel(page, TITULO);
    await camada(page, 'OpenStreetMap').click();
    await expect(camada(page, 'Sem mapa-base')).toHaveAttribute('aria-pressed', 'true', { timeout: 15000 });
    await expect(painel(page).getByRole('status').filter({ hasText: 'Voltei para "Sem mapa-base"' })).toBeVisible();
    await expect(miniMapa(page).locator('.leaflet-marker-icon')).toHaveCount(1);
  });

  test('uma atualização da tela com o painel aberto não recria o mapa nem refaz os pedidos; fechar e reabrir volta ao padrão', async ({ page }) => {
    const pedidos = await simularServidores(page);
    await abrirComDemanda(page);
    const p = await abrirPainel(page, TITULO);
    await camada(page, 'OpenStreetMap').click();
    await expect.poll(() => pedidos.length).toBeGreaterThan(0);
    await page.waitForTimeout(500);
    const antes = pedidos.length;
    // Mudar o status refaz o painel: o mapa muda de lugar na página, mas continua o mesmo.
    await p.getByLabel('Status').selectOption({ label: 'Em andamento' });
    await expect(miniMapa(page).locator('.leaflet-marker-icon')).toHaveCount(1);
    await expect(camada(page, 'OpenStreetMap')).toHaveAttribute('aria-pressed', 'true');
    await page.waitForTimeout(500);
    expect(pedidos.length).toBe(antes);
    await fecharPainel(page);
    await abrirPainel(page, TITULO);
    await expect(camada(page, 'Sem mapa-base')).toHaveAttribute('aria-pressed', 'true');
  });

  test('o mini-mapa cabe no painel em tela de celular, sem rolagem horizontal', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await simularServidores(page);
    await abrirComDemanda(page);
    const p = await abrirPainel(page, TITULO);
    const caixa = await miniMapa(page).boundingBox();
    expect(caixa.width).toBeGreaterThan(250);
    expect(caixa.x + caixa.width).toBeLessThanOrEqual(390);
    expect(await p.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  });
});
