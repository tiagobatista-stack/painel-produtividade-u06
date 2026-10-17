// Endereço, latitude e longitude no formulário de demanda (nova e edição), "Localizar", painel lateral e mapa (RF42 e RF48).
// Todas as coordenadas são fictícias, em pleno Atlântico. Nenhum servidor de mapa é consultado de verdade.
import { test, expect, abrir, abrirPainel, cartao, fecharPainel, irParaAba, painel } from './apoio.mjs';

const TITULO = 'Vistoria fictícia com localização';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

const dialogo = (page, nome = 'Nova demanda') => page.getByRole('dialog', { name: nome });
const campo = (page, rotulo, nome = 'Nova demanda') => dialogo(page, nome).getByLabel(rotulo, { exact: true });
const avisos = (page) => page.locator('#avisos-coordenada');

async function abrirNova(page) {
  await abrir(page);
  await page.getByRole('button', { name: 'Nova demanda' }).click();
  await expect(dialogo(page)).toBeVisible();
}

async function preencherBasico(page, titulo = TITULO) {
  await campo(page, 'Título').fill(titulo);
  await campo(page, 'Prazo').fill('2026-10-25');
}

async function salvar(page, nome = 'Nova demanda') {
  await dialogo(page, nome).getByRole('button', { name: 'Salvar' }).click();
}

// Cria a demanda de teste, com as coordenadas e o endereço dados, e devolve o painel dela aberto.
async function criarComLocalizacao(page, { latitude, longitude, endereco = '' }) {
  await abrirNova(page);
  await campo(page, 'Tipo').selectOption({ label: 'Outra' });
  await preencherBasico(page);
  await campo(page, 'Endereço ou referência espacial').fill(endereco);
  await campo(page, 'Latitude').fill(latitude);
  await campo(page, 'Longitude').fill(longitude);
  await salvar(page);
  await expect(dialogo(page)).toBeHidden();
  return abrirPainel(page, TITULO);
}

test.describe('localização no formulário de demanda', () => {
  test('endereço, latitude e longitude existem em todos os tipos (menos a operação) e são opcionais', async ({ page }) => {
    await abrirNova(page);
    for (const tipo of ['Processo SIGADOC', 'Reunião', 'Palestra', 'Outra']) {
      await campo(page, 'Tipo').selectOption({ label: tipo });
      for (const rotulo of ['Endereço ou referência espacial', 'Latitude', 'Longitude']) await expect(campo(page, rotulo), `${tipo}: ${rotulo}`).toBeVisible();
    }
    // Sem preencher nada de localização, a demanda é salva.
    await campo(page, 'Tipo').selectOption({ label: 'Outra' });
    await preencherBasico(page, 'Demanda sem localização');
    await salvar(page);
    await expect(dialogo(page)).toBeHidden();
    const p = await abrirPainel(page, 'Demanda sem localização');
    await expect(p).not.toContainText('Coordenadas:');
    await expect(p.getByRole('button', { name: /Localizar/ })).toHaveCount(0);
  });

  test('a operação não mostra os campos de localização (os pontos têm a coordenada deles)', async ({ page }) => {
    await abrir(page);
    const p = await abrirPainel(page, 'operação de outubro (Norte)');
    await p.getByRole('button', { name: /^Editar / }).click();
    await expect(dialogo(page, 'Editar demanda')).toBeVisible();
    for (const rotulo of ['Endereço ou referência espacial', 'Latitude', 'Longitude']) await expect(campo(page, rotulo, 'Editar demanda')).toBeHidden();
  });

  test('cadastra com graus, minutos e segundos e vê endereço e coordenadas no painel lateral', async ({ page }) => {
    const p = await criarComLocalizacao(page, { latitude: `17° 30' 00" S`, longitude: `29° 15' 00" O`, endereco: 'Referência fictícia, km 7' });
    await expect(p.getByText('Endereço: Referência fictícia, km 7')).toBeVisible();
    await expect(p.locator('.painel-coordenada')).toHaveText(`Coordenadas: 17° 30' 00,00" S, 29° 15' 00,00" O (-17,500000, -29,250000)`);
    await expect(p.getByRole('button', { name: /^Localizar .* no OpenStreetMap/ })).toBeVisible();
    // O que foi guardado: decimal com 6 casas, texto como digitado e o histórico.
    const guardada = await page.evaluate((t) => JSON.parse(localStorage.getItem('painel-demandas:v1')).demandas.find((d) => d.titulo === t), TITULO);
    expect([guardada.coord_y, guardada.coord_x, guardada.coord_y_texto, guardada.coord_x_texto]).toEqual([-17.5, -29.25, `17° 30' 00" S`, `29° 15' 00" O`]);
  });

  test('cadastra em decimal sem hemisfério: assume S e O e avisa, sem bloquear', async ({ page }) => {
    await abrirNova(page);
    await campo(page, 'Tipo').selectOption({ label: 'Outra' });
    await preencherBasico(page);
    await expect(avisos(page)).toBeHidden();
    await campo(page, 'Latitude').fill('17,5');
    await expect(avisos(page)).toContainText('Latitude: hemisfério não informado: assumido S.');
    await campo(page, 'Longitude').fill('29,25');
    await expect(avisos(page)).toContainText('Longitude: hemisfério não informado: assumido O.');
    await expect(avisos(page)).toContainText('fora de Mato Grosso'); // o exemplo fica no Atlântico: aviso, não erro
    await salvar(page);
    await expect(dialogo(page)).toBeHidden();
    const p = await abrirPainel(page, TITULO);
    await expect(p.locator('.painel-coordenada')).toContainText('(-17,500000, -29,250000)');
  });

  test('N, L e E são aceitos e avisam que o ponto fica fora de Mato Grosso', async ({ page }) => {
    await abrirNova(page);
    await campo(page, 'Latitude').fill(`11° 25' 12" N`);
    await campo(page, 'Longitude').fill(`58° 45' 00" L`);
    await expect(avisos(page)).toHaveCount(1);
    await expect(avisos(page)).toContainText('fora de Mato Grosso');
    await expect(avisos(page)).not.toContainText('hemisfério não informado');
    // Dentro de Mato Grosso, com S e O escritos, nenhum aviso.
    await campo(page, 'Latitude').fill(`11° 25' 12" S`);
    await campo(page, 'Longitude').fill(`58° 45' 00" O`);
    await expect(avisos(page)).toBeHidden();
  });

  test('só uma das coordenadas, valor inválido ou impossível: erro ao lado do campo, sem repetir o digitado', async ({ page }) => {
    await abrirNova(page);
    await preencherBasico(page);
    await campo(page, 'Latitude').fill('-17,5');
    await salvar(page);
    await expect(dialogo(page)).toBeVisible();
    await expect(page.locator('#e-longitude')).toHaveText('Informe também a longitude.');
    await expect(page.locator('#e-latitude')).toHaveText('');
    await campo(page, 'Latitude').fill('abc123');
    await campo(page, 'Longitude').fill(`10° 60' 00" O`);
    await salvar(page);
    await expect(page.locator('#e-latitude')).toContainText('Latitude inválida');
    await expect(page.locator('#e-longitude')).toContainText('Longitude inválida');
    await expect(page.locator('#e-latitude')).not.toContainText('abc123');
    await expect(page.locator('#resumo-erros')).not.toContainText('abc123');
    await expect(page.locator('#resumo-erros')).toBeVisible();
    // Corrigindo, salva.
    await campo(page, 'Latitude').fill('-17,5');
    await campo(page, 'Longitude').fill('-29,25');
    await salvar(page);
    await expect(dialogo(page)).toBeHidden();
  });

  test('edita: os campos voltam como foram digitados; muda, registra no histórico e limpar remove a coordenada', async ({ page }) => {
    const p = await criarComLocalizacao(page, { latitude: `17° 30' 00" S`, longitude: '-29,25', endereco: 'Antes' });
    await p.getByRole('button', { name: `Editar ${TITULO}` }).click();
    await expect(campo(page, 'Latitude', 'Editar demanda')).toHaveValue(`17° 30' 00" S`);
    await expect(campo(page, 'Longitude', 'Editar demanda')).toHaveValue('-29,25');
    await expect(campo(page, 'Endereço ou referência espacial', 'Editar demanda')).toHaveValue('Antes');
    await campo(page, 'Latitude', 'Editar demanda').fill('-18');
    await campo(page, 'Longitude', 'Editar demanda').fill('-30');
    await campo(page, 'Endereço ou referência espacial', 'Editar demanda').fill('Depois');
    await salvar(page, 'Editar demanda');
    await expect(dialogo(page, 'Editar demanda')).toBeHidden();
    const p2 = painel(page); // o painel segue aberto e já mostra os dados novos
    await expect(p2).toBeVisible();
    await expect(p2.locator('.painel-coordenada')).toContainText('(-18,000000, -30,000000)');
    await expect(p2.getByText('Endereço: Depois')).toBeVisible();
    await p2.getByText(/^Histórico \(/).click();
    await expect(p2.getByText('Localização alterada')).toBeVisible();

    await p2.getByRole('button', { name: `Editar ${TITULO}` }).click();
    for (const rotulo of ['Endereço ou referência espacial', 'Latitude', 'Longitude']) await campo(page, rotulo, 'Editar demanda').fill('');
    await salvar(page, 'Editar demanda');
    const p3 = painel(page);
    await expect(p3).toBeVisible();
    await expect(p3).not.toContainText('Coordenadas:');
    await expect(p3).not.toContainText('Endereço:');
    const guardada = await page.evaluate((t) => JSON.parse(localStorage.getItem('painel-demandas:v1')).demandas.find((d) => d.titulo === t), TITULO);
    expect(['coord_x', 'coord_y', 'coord_x_texto', 'coord_y_texto', 'endereco'].some((c) => c in guardada)).toBe(false);
  });

  test('"Localizar" abre o OpenStreetMap em nova aba e a página não faz requisição de rede', async ({ page, context }) => {
    const externas = [];
    page.on('request', (r) => {
      const u = new URL(r.url());
      if (!['localhost', '127.0.0.1'].includes(u.hostname) && u.protocol.startsWith('http')) externas.push(r.url());
    });
    await context.route('https://www.openstreetmap.org/**', (rota) => rota.fulfill({ status: 200, contentType: 'text/html', body: '<title>OSM de teste</title>' }));
    await abrirNova(page);

    // Sem endereço nem coordenadas: não abre nada e explica.
    await dialogo(page).getByRole('button', { name: 'Localizar' }).click();
    await expect(page.locator('#e-endereco')).toHaveText('Informe o endereço ou as coordenadas para localizar.');
    expect(context.pages()).toHaveLength(1);

    // Só endereço: busca do endereço.
    await campo(page, 'Endereço ou referência espacial').fill('Estrada Fictícia, km 12');
    const [busca] = await Promise.all([context.waitForEvent('page'), dialogo(page).getByRole('button', { name: 'Localizar' }).click()]);
    expect(busca.url()).toBe('https://www.openstreetmap.org/search?query=Estrada%20Fict%C3%ADcia%2C%20km%2012');
    await busca.close();

    // Com coordenadas (sem hemisfério: S e O): o ponto.
    await campo(page, 'Latitude').fill('17,5');
    await campo(page, 'Longitude').fill('29,25');
    const [ponto] = await Promise.all([context.waitForEvent('page'), dialogo(page).getByRole('button', { name: 'Localizar' }).click()]);
    expect(ponto.url()).toBe('https://www.openstreetmap.org/?mlat=-17.5&mlon=-29.25#map=16/-17.5/-29.25');
    await ponto.close();

    // Coordenada inválida aparece como erro; não é ignorada em silêncio.
    await campo(page, 'Latitude').fill('abc');
    await dialogo(page).getByRole('button', { name: 'Localizar' }).click();
    await expect(page.locator('#e-latitude')).toContainText('Latitude inválida');
    expect(context.pages()).toHaveLength(1);

    expect(externas).toEqual([]); // a página em si nunca falou com o serviço de mapas
  });

  test('"Localizar" no painel lateral abre o ponto da demanda', async ({ page, context }) => {
    await context.route('https://www.openstreetmap.org/**', (rota) => rota.fulfill({ status: 200, contentType: 'text/html', body: 'ok' }));
    await abrir(page);
    const p = await abrirPainel(page, 'Manifestação em procedimento do Ministério Público');
    const [aba] = await Promise.all([context.waitForEvent('page'), p.getByRole('button', { name: /^Localizar .* no OpenStreetMap/ }).click()]);
    expect(aba.url()).toBe('https://www.openstreetmap.org/?mlat=-12.5&mlon=-27.2#map=16/-12.5/-27.2');
  });

  test('o exemplo traz demandas com localização fictícia: painel, busca por endereço e marcador no mapa', async ({ page }) => {
    await page.route(/^https:\/\/(tile\.openstreetmap\.org|geo\.sema\.mt\.gov\.br)\//, (rota) => rota.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
    await abrir(page);
    const p = await abrirPainel(page, 'Manifestação em procedimento do Ministério Público');
    await expect(p.getByText('Endereço: Rodovia Fictícia, km 40 (referência fictícia)')).toBeVisible();
    await expect(p.locator('.painel-coordenada')).toHaveText(`Coordenadas: 12° 30' 00,00" S, 27° 12' 00,00" O (-12,500000, -27,200000)`);
    await fecharPainel(page);
    await expect(cartao(page, 'Organizar arquivos digitais')).toHaveCount(1);
    await page.getByRole('search', { name: 'Buscar e filtrar demandas' }).getByLabel('Buscar').fill('ponte');
    await expect(page.locator('#fila .demanda-titulo')).toHaveText(['Análise de denúncia sobre supressão vegetal (fictícia)']); // achou pelo endereço
    await page.getByRole('search', { name: 'Buscar e filtrar demandas' }).getByLabel('Buscar').fill('');

    await irParaAba(page, 'Pontos');
    await page.getByRole('group', { name: 'Visão dos pontos' }).getByRole('button', { name: 'Mapa', exact: true }).click();
    await page.getByRole('group', { name: 'Camada do mapa' }).getByRole('button', { name: 'OpenStreetMap', exact: true }).click();
    await expect(page.locator('#mapa-leaflet .leaflet-marker-icon')).toHaveCount(25); // 21 pontos + 4 demandas
    await expect(page.locator('[data-foco="mapa-demanda-DEM-0003"]')).toHaveAttribute('aria-label', /Demanda Manifestação em procedimento do Ministério Público \(fictício\), prioridade Crítica/);
  });

  test('uma demanda recém-criada com coordenada aparece como marcador no mapa', async ({ page }) => {
    await page.route(/^https:\/\/(tile\.openstreetmap\.org|geo\.sema\.mt\.gov\.br)\//, (rota) => rota.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
    await criarComLocalizacao(page, { latitude: '-19', longitude: '-29', endereco: 'Ponto de teste' });
    await fecharPainel(page);
    await irParaAba(page, 'Pontos');
    await page.getByRole('group', { name: 'Visão dos pontos' }).getByRole('button', { name: 'Mapa', exact: true }).click();
    await page.getByRole('group', { name: 'Camada do mapa' }).getByRole('button', { name: 'OpenStreetMap', exact: true }).click();
    await expect(page.locator('#mapa-leaflet .leaflet-marker-icon')).toHaveCount(26);
    await expect(page.locator('#mapa-legenda .legenda-item').last()).toHaveText('Demandas com coordenada (letra = faixa): 5');
  });

  test('os campos cabem na tela, sem rolagem horizontal', async ({ page }) => {
    await abrirNova(page);
    for (const rotulo of ['Endereço ou referência espacial', 'Latitude', 'Longitude']) {
      const caixa = await campo(page, rotulo).boundingBox();
      expect(caixa.x).toBeGreaterThanOrEqual(0);
      expect(caixa.x + caixa.width).toBeLessThanOrEqual(page.viewportSize().width + 1);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(await dialogo(page).evaluate((d) => d.scrollWidth <= d.clientWidth + 1)).toBe(true);
  });
});
