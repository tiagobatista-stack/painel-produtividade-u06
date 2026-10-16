import { test, expect, abrir, abrirPainel, cadastrarProcesso, importarExemplo } from './apoio.mjs';

test.describe('segurança e conteúdo publicado', () => {
  test('a página é servida com política de conteúdo e demais cabeçalhos de segurança', async ({ page }) => {
    const resposta = await page.goto('/');
    const h = resposta.headers();
    expect(h['content-security-policy']).toContain("default-src 'self'");
    expect(h['content-security-policy']).toContain("script-src 'self'");
    expect(h['content-security-policy']).not.toContain('unsafe-inline');
    expect(h['x-content-type-options']).toBe('nosniff');
    expect(h['x-frame-options']).toBe('DENY');
    expect(h['referrer-policy']).toBe('no-referrer');
  });

  test('o painel funciona sem pedir nada fora da própria origem', async ({ page }) => {
    const origem = new URL((await page.goto('/')).url()).origin;
    const externos = [];
    page.on('request', (r) => { if (!r.url().startsWith(origem) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) externos.push(r.url()); });
    await page.reload();
    await abrir(page);
    await importarExemplo(page);
    await cadastrarProcesso(page, { titulo: 'Fluxo sem rede externa' });
    expect(externos).toEqual([]);
  });

  test('só os arquivos do build são publicados: nada de testes, documentos, legado ou configuração', async ({ page }) => {
    for (const caminho of ['/package.json', '/vercel.json', '/CLAUDE.md', '/docs/MCP.md', '/tests/build.test.mjs', '/tools/demandas-mcp.mjs', '/scripts/build.mjs', '/legado/index.html', '/node_modules/', '/.git/config', '/.env']) {
      const r = await page.request.get(caminho);
      expect(r.status(), caminho).toBe(404);
    }
    for (const caminho of ['/', '/index.html', '/css/styles.css', '/js/app.js', '/data/seed.json', '/data/planilha-exemplo.tsv']) {
      expect((await page.request.get(caminho)).status(), caminho).toBe(200);
    }
  });

  test('texto com HTML digitado no formulário aparece como texto, sem executar', async ({ page }) => {
    let alertas = 0;
    page.on('dialog', (d) => { alertas++; d.dismiss(); });
    await abrir(page);
    const perigoso = '<img src=x onerror=alert(1)><script>alert(2)</script>';
    await cadastrarProcesso(page, { titulo: perigoso, processo: '<b>SEMA</b>' });
    const c = page.locator('#fila > li', { hasText: 'onerror=alert(1)' });
    await expect(c.locator('.demanda-titulo')).toHaveText(perigoso);
    await expect(page.locator('#fila img, #fila script, #fila b')).toHaveCount(0);
    // o painel lateral também mostra o texto como texto
    const painel = await abrirPainel(page, 'onerror=alert(1)');
    await expect(painel.locator('#painel-titulo')).toHaveText(perigoso);
    await expect(page.locator('#painel-demanda img, #painel-demanda script, #painel-demanda b')).toHaveCount(0);
    expect(alertas).toBe(0);
  });

  test('HTML dentro de uma planilha colada também é tratado como texto', async ({ page }) => {
    let alertas = 0;
    page.on('dialog', (d) => { alertas++; d.dismiss(); });
    await abrir(page);
    await page.getByRole('button', { name: 'Importar operação' }).click();
    const dialogo = page.getByRole('dialog', { name: 'Importar operação' });
    const planilha = [
      'N_PONTO\tEQUIPE\tCOORD_X\tCOORD_Y\tMUNICIPIO\tDAT_SAIDA\tDAT_RETOR\tNOT_PLANEJ',
      '1\t<img src=x onerror=alert(1)>\t\t\t<b>Cidade</b>\t01/11/2026\t05/11/2026\t<script>alert(2)</script>',
    ].join('\n');
    await dialogo.getByLabel('Linhas da planilha').fill(planilha);
    await expect(dialogo.locator('#imp-previa')).toContainText('Planilha válida');
    await expect(dialogo.locator('#imp-previa img, #imp-previa b, #imp-previa script')).toHaveCount(0);
    await dialogo.getByRole('button', { name: 'Importar', exact: true }).click();
    const op = await abrirPainel(page, 'onerror=alert(1)'); // os pontos ficam no painel lateral
    await op.locator('summary', { hasText: 'Pontos' }).click();
    await expect(op).toContainText('<script>alert(2)</script>'); // a nota do ponto, como texto
    await expect(page.locator('#fila img, #fila script, #fila b, #painel-demanda img, #painel-demanda script, #painel-demanda b')).toHaveCount(0);
    expect(alertas).toBe(0);
  });

  test('os dados ficam só no navegador: nenhuma requisição leva os dados cadastrados', async ({ page }) => {
    const corpos = [];
    page.on('request', (r) => { if (r.method() !== 'GET') corpos.push(`${r.method()} ${r.url()}`); });
    await abrir(page);
    await cadastrarProcesso(page, { titulo: 'Dado só local' });
    await importarExemplo(page);
    expect(corpos).toEqual([]); // sem POST/PUT: nada é enviado a servidor algum
    const guardado = await page.evaluate(() => localStorage.getItem('painel-demandas:v1'));
    expect(guardado).toContain('Dado só local');
  });
});
