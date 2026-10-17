// O "Kanban de projetos" era só metodologia de desenvolvimento e foi removido do site: o cabeçalho não tem mais o link, as páginas e
// arquivos dele respondem 404 e o build não os gera. O Quadro do painel (aba #quadro) é do produto e continua.
import { existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { test, expect, abrir } from './apoio.mjs';

const PUBLIC = fileURLToPath(new URL('../../public/', import.meta.url));
const TELAS = [
  { nome: '1366 px', width: 1366, height: 800 },
  { nome: '390 px', width: 390, height: 844 },
];

const listar = (pasta) => readdirSync(pasta, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? listar(join(pasta, e.name)) : [join(pasta, e.name)]));

for (const tela of TELAS) {
  test(`o cabeçalho tem "Nova demanda" e não tem link para o Kanban, em ${tela.nome}`, async ({ page }) => {
    await page.setViewportSize({ width: tela.width, height: tela.height });
    await abrir(page);
    const topo = page.locator('header.topo');
    await expect(topo.getByRole('button', { name: 'Nova demanda' })).toBeVisible();
    await expect(topo.getByLabel('Data de referência')).toBeVisible();
    await expect(topo.getByRole('button', { name: /Usar data do exemplo/ })).toBeVisible();
    await expect(topo.getByRole('link')).toHaveCount(0); // nenhum link no cabeçalho
    await expect(page.locator('a[href*="kanban" i]')).toHaveCount(0); // nem em qualquer outro lugar da página
    await expect(page.getByText('Kanban de projetos')).toHaveCount(0);
    // O botão cabe na tela e a página não rola na horizontal.
    const botao = await topo.getByRole('button', { name: 'Nova demanda' }).boundingBox();
    expect(botao.x).toBeGreaterThanOrEqual(0);
    expect(botao.x + botao.width).toBeLessThanOrEqual(tela.width + 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

test('o Quadro do painel continua: a aba existe e abre', async ({ page }) => {
  await abrir(page);
  const abas = page.getByRole('navigation', { name: 'Seções do painel' });
  await abas.getByRole('link', { name: 'Quadro', exact: true }).click();
  await expect(abas.getByRole('link', { name: 'Quadro', exact: true })).toHaveAttribute('aria-current', 'page');
});

test('kanban.html e os arquivos do Kanban respondem 404', async ({ page }) => {
  for (const caminho of ['/kanban.html', '/css/kanban.css', '/js/kanban-app.js', '/js/kanban.js', '/js/ui-kanban.js', '/js/ui-dt.js', '/js/design-thinking.js', '/data/kanban-exemplo.json']) {
    const resposta = await page.request.get(caminho);
    expect(resposta.status(), caminho).toBe(404);
  }
});

test.describe('o build local', () => {
  test.skip(Boolean(process.env.SITE_URL?.trim()), 'com SITE_URL o teste vai à produção e não há build local para conferir');

  test('não gera public/kanban.html nem nenhum arquivo do Kanban', async () => {
    expect(existsSync(join(PUBLIC, 'index.html')), 'o build existe').toBe(true);
    expect(existsSync(join(PUBLIC, 'kanban.html'))).toBe(false);
    const nomes = listar(PUBLIC).map((f) => f.slice(PUBLIC.length).replaceAll('\\', '/'));
    expect(nomes.filter((n) => /kanban|design-thinking|ui-dt/i.test(n))).toEqual([]);
    expect(nomes.filter((n) => n.endsWith('.html'))).toEqual(['index.html']);
  });
});
