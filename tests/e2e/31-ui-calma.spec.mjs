// Refatoração visual "calma": uma cor de destaque e neutros, fila em uma coluna com linhas compactas, menos bordas, escala de 4 tamanhos de fonte,
// aba "Demandas", data de referência no rodapé e aviso de férias discreto. Só aparência: regras, dados e ids não mudam.
import { test, expect, abrir, abrirControlesDeReferencia, cartao, definirDataDeReferencia, painel } from './apoio.mjs';

const TELAS = [
  { nome: '1366 px', width: 1366, height: 900 },
  { nome: '390 px', width: 390, height: 844 },
];
const estilo = (locator, propriedade) => locator.evaluate((el, p) => getComputedStyle(el)[p], propriedade);
const SEM_FUNDO = ['rgba(0, 0, 0, 0)', 'transparent'];
const BRANCO = 'rgb(255, 255, 255)';
const AZUL = 'rgb(30, 42, 94)';
const SELO_NEUTRO = 'rgb(236, 238, 243)';

test.describe('estrutura da página', () => {
  test('o bloco "Foco de hoje" não existe, e a aba se chama "Demandas" (o alternador Lista | Quadro continua)', async ({ page }) => {
    await abrir(page);
    await expect(page.getByRole('heading', { name: 'Foco de hoje' })).toHaveCount(0);
    await expect(page.locator('#foco, .foco, #foco-lista')).toHaveCount(0);
    const abas = page.getByRole('navigation', { name: 'Seções do painel' });
    await expect(abas.getByRole('link')).toHaveText(['Demandas', 'Pontos', 'Agenda', 'Afastamentos', 'Relatórios']);
    await expect(abas.getByRole('link', { name: 'Demandas' })).toHaveAttribute('aria-current', 'page');
    await expect(abas.getByRole('link', { name: 'Quadro', exact: true })).toHaveCount(0);
    const visao = page.getByRole('group', { name: 'Visão da fila' });
    await expect(visao.getByRole('button')).toHaveText(['Lista', 'Quadro']);
    await visao.getByRole('button', { name: 'Quadro', exact: true }).click();
    await expect(page.locator('#visao-quadro')).toBeVisible();
  });

  test('o endereço #quadro continua abrindo a aba Demandas', async ({ page }) => {
    await page.goto('/#quadro');
    await expect(page.getByRole('navigation', { name: 'Seções do painel' }).getByRole('link', { name: 'Demandas' })).toHaveAttribute('aria-current', 'page');
  });
});

test.describe('paleta: uma cor de destaque e neutros', () => {
  test('vencida: só o texto do prazo fica vermelho, sem fundo rosa no cartão nem no indicador', async ({ page }) => {
    await abrir(page);
    const vencida = cartao(page, 'Manifestação em procedimento do Ministério Público');
    await expect(vencida).toHaveClass(/vencida/);
    expect(await estilo(vencida, 'backgroundColor')).toBe(BRANCO);
    expect(SEM_FUNDO).toContain(await estilo(vencida.locator('.demanda-abrir'), 'backgroundColor'));
    expect(await estilo(vencida, 'borderLeftWidth')).toBe('1px'); // sem a faixa grossa colorida de antes
    expect(await estilo(vencida.locator('.demanda-prazo'), 'color')).toBe('rgb(185, 28, 28)'); // o vermelho está só no texto
    expect(await estilo(vencida.locator('.demanda-titulo'), 'color')).not.toBe('rgb(185, 28, 28)');
    const indicador = page.locator('#indicadores button.indicador-alerta');
    await expect(indicador).toHaveCount(1);
    expect(SEM_FUNDO).toContain(await estilo(indicador, 'backgroundColor'));
    expect(await estilo(indicador.locator('.indicador-valor'), 'color')).toBe('rgb(185, 28, 28)');
  });

  test('selo de prioridade: Crítica e Alta com cor, Média e Baixa neutras', async ({ page }) => {
    await abrir(page);
    const fundo = async (titulo) => estilo(cartao(page, titulo).locator('.status'), 'backgroundColor');
    const critica = await fundo('Manifestação em procedimento do Ministério Público'); // Crítica
    const alta = await fundo('Relatórios de vistoria — operação de outubro (Norte)'); // Alta
    const media = await fundo('Reunião de alinhamento com a coordenação'); // Média
    const baixa = await fundo('Organizar arquivos digitais da equipe'); // Baixa
    expect(critica).toBe(AZUL); // o destaque (azul-marinho), cheio
    expect(alta).not.toBe(SELO_NEUTRO);
    expect(alta).not.toBe(critica);
    expect(media).toBe(SELO_NEUTRO);
    expect(baixa).toBe(SELO_NEUTRO);
    expect(await estilo(cartao(page, 'Manifestação em procedimento').locator('.status'), 'color')).toBe(BRANCO);
    for (const faixa of ['Crítica', 'Alta', 'Média', 'Baixa']) await expect(page.locator('#fila .status', { hasText: faixa }).first()).toBeVisible(); // o texto da faixa continua no selo
  });

  test('estado em tom suave: sobrestado em roxo, concluída em verde-água, sem fundo no cartão', async ({ page }) => {
    await abrir(page);
    const filtroStatus = page.getByRole('search', { name: 'Buscar e filtrar demandas' }).getByLabel('Status');
    await filtroStatus.selectOption({ label: 'Sobrestado (aguardando)' });
    const sob = page.locator('#fila .demanda.sobrestada').first();
    await expect(sob).toBeVisible();
    expect(await estilo(sob, 'backgroundColor')).toBe(BRANCO);
    expect(await estilo(sob.locator('.status'), 'backgroundColor')).toBe('rgb(241, 237, 248)');
    await filtroStatus.selectOption({ label: 'Concluída' });
    const conc = page.locator('#fila .demanda.concluida').first();
    expect(await estilo(conc, 'backgroundColor')).toBe(BRANCO);
    expect(await estilo(conc.locator('.status'), 'backgroundColor')).toBe('rgb(230, 243, 240)');
  });
});

for (const tela of TELAS) {
  test.describe(`fila em linhas compactas, em ${tela.nome}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: tela.width, height: tela.height });
    });

    test('uma só coluna: todos os cartões com a mesma largura, um embaixo do outro', async ({ page }) => {
      await abrir(page);
      const caixas = await page.locator('#fila > li').evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }));
      expect(caixas).toHaveLength(11);
      for (const c of caixas) {
        expect(Math.abs(c.x - caixas[0].x)).toBeLessThan(1);
        expect(Math.abs(c.w - caixas[0].w)).toBeLessThan(1);
      }
      for (let i = 1; i < caixas.length; i++) expect(caixas[i].y).toBeGreaterThanOrEqual(caixas[i - 1].y + caixas[i - 1].h - 1);
    });

    test('a linha tem selo, título, "tipo · origem" e prazo; o resto fica no painel lateral', async ({ page }) => {
      await abrir(page);
      const c = cartao(page, 'Manifestação em procedimento do Ministério Público');
      await expect(c.locator('.status')).toHaveText('Crítica');
      await expect(c.locator('.demanda-titulo')).toHaveText('Manifestação em procedimento do Ministério Público (fictício)');
      await expect(c.locator('.etiqueta')).toHaveText('Processo SIGADOC');
      await expect(c.locator('.demanda-origem')).toHaveText('Ministério Público');
      await expect(c.locator('.demanda-prazo')).toContainText('Prazo: 13/10/2026 · vencida há 2 dias');
      await expect(c.getByRole('button')).toHaveCount(1); // um só botão por linha: abre o painel
      await expect(c.locator('select, details, .prioridade, .acoes-cartao, .demanda-descricao')).toHaveCount(0);
      await c.getByRole('button').click();
      await expect(painel(page).locator('.prioridade')).toHaveText('Prioridade Crítica · 90 pontos'); // os detalhes estão no painel
    });

    test('o prazo fica à direita; no desktop tudo cabe numa linha, no celular o prazo sobe ao lado do selo', async ({ page }) => {
      await abrir(page);
      const c = cartao(page, 'Reunião de alinhamento com a coordenação');
      const selo = await c.locator('.status').boundingBox();
      const titulo = await c.locator('.demanda-titulo').boundingBox();
      const prazo = await c.locator('.demanda-prazo').boundingBox();
      const linha = await c.boundingBox();
      expect(prazo.x + prazo.width).toBeGreaterThan(linha.x + linha.width - 20); // encostado à direita
      if (tela.width >= 600) {
        const centro = (b) => b.y + b.height / 2;
        expect(Math.abs(centro(selo) - centro(prazo))).toBeLessThan(20);
        expect(titulo.x).toBeGreaterThan(selo.x + selo.width); // selo, depois título, depois prazo
        expect(prazo.x).toBeGreaterThan(titulo.x);
        expect(linha.height).toBeLessThan(80); // linha compacta
      } else {
        expect(Math.abs(selo.y - prazo.y)).toBeLessThan(10); // selo e prazo na mesma linha
        expect(titulo.y).toBeGreaterThan(selo.y + selo.height - 2); // o título vem embaixo
      }
    });

    test('a página não rola na horizontal', async ({ page }) => {
      await abrir(page);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });
  });
}

test.describe('menos bordas', () => {
  test('indicadores e filtros sem caixa; borda só nos cartões da fila e nos campos', async ({ page }) => {
    await abrir(page);
    const indicador = page.locator('#indicadores .indicador').first();
    for (const lado of ['Top', 'Left', 'Right']) expect(await estilo(indicador, `border${lado}Width`), `indicador ${lado}`).toBe('0px');
    expect(SEM_FUNDO).toContain(await estilo(indicador, 'backgroundColor'));
    const filtros = page.locator('#filtros');
    for (const lado of ['Top', 'Left', 'Right', 'Bottom']) expect(await estilo(filtros, `border${lado}Width`), `filtros ${lado}`).toBe('0px');
    expect(SEM_FUNDO).toContain(await estilo(filtros, 'backgroundColor'));
    // Têm borda: os campos dos filtros e os cartões da fila.
    expect(await estilo(page.locator('#filtro-busca'), 'borderTopWidth')).toBe('1px');
    expect(await estilo(page.locator('#filtro-tipo'), 'borderTopWidth')).toBe('1px');
    expect(await estilo(page.locator('#fila > li').first(), 'borderTopWidth')).toBe('1px');
    // A aba atual só tem sublinhado, sem caixa.
    const atual = page.getByRole('navigation', { name: 'Seções do painel' }).getByRole('link', { name: 'Demandas' });
    expect(await estilo(atual, 'borderTopWidth')).toBe('0px');
    expect(await estilo(atual, 'borderBottomWidth')).toBe('2px');
  });
});

test.describe('tipografia: escala de 4 tamanhos', () => {
  const ESCALA = [12, 14, 16, 20];

  // Tamanhos usados por elementos visíveis com texto, fora do SVG do mapa e do Leaflet (que têm unidades próprias) e das barras do
  // calendário (texto oculto de propósito, tamanho 0).
  async function tamanhosVisiveis(page, raiz) {
    return page.evaluate((seletor) => {
      const achados = {};
      for (const el of document.querySelectorAll(`${seletor} *`)) {
        if (el.closest('svg, .leaflet-container') || !(el instanceof HTMLElement)) continue;
        if (el.offsetParent === null && getComputedStyle(el).position !== 'fixed') continue;
        const temTexto = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim() !== '');
        const px = parseFloat(getComputedStyle(el).fontSize);
        if ((temTexto || ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(el.tagName)) && px > 0) {
          (achados[px] ??= []).push(`${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}.${el.className}`.slice(0, 50));
        }
      }
      return achados;
    }, raiz);
  }

  for (const tela of TELAS) {
    test(`a página inicial só usa 12, 14, 16 e 20 px, em ${tela.nome}`, async ({ page }) => {
      await page.setViewportSize({ width: tela.width, height: tela.height });
      await abrir(page);
      const achados = await tamanhosVisiveis(page, 'body');
      for (const [px, quem] of Object.entries(achados)) expect(ESCALA, `${px}px em ${quem.slice(0, 3).join(', ')}`).toContain(Number(px));
      expect(Object.keys(achados).map(Number).sort((a, b) => a - b)).toEqual(expect.arrayContaining([12, 14])); // 12 e 14 são o corpo da página
    });
  }

  test('o painel lateral e o formulário também seguem a escala', async ({ page }) => {
    await abrir(page);
    await cartao(page, 'Manifestação em procedimento do Ministério Público').getByRole('button').click();
    for (const [px, quem] of Object.entries(await tamanhosVisiveis(page, '#painel-demanda'))) expect(ESCALA, `painel ${px}px em ${quem[0]}`).toContain(Number(px));
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Nova demanda' }).click();
    for (const [px, quem] of Object.entries(await tamanhosVisiveis(page, '#dialogo'))) expect(ESCALA, `formulário ${px}px em ${quem[0]}`).toContain(Number(px));
  });

  test('as outras abas também (Pontos, Agenda, Afastamentos e Relatórios)', async ({ page }) => {
    await abrir(page);
    const abas = page.getByRole('navigation', { name: 'Seções do painel' });
    for (const nome of ['Pontos', 'Agenda', 'Afastamentos', 'Relatórios']) {
      await abas.getByRole('link', { name: nome, exact: true }).click();
      for (const [px, quem] of Object.entries(await tamanhosVisiveis(page, 'main'))) expect(ESCALA, `${nome}: ${px}px em ${quem[0]}`).toContain(Number(px));
    }
  });

  test('rótulos de tipo em 12 px, sem caixa alta forçada', async ({ page }) => {
    await abrir(page);
    const etiqueta = page.locator('#fila .etiqueta').first();
    expect(await estilo(etiqueta, 'fontSize')).toBe('12px');
    expect(await estilo(etiqueta, 'textTransform')).toBe('none');
    await expect(etiqueta).toHaveText('Processo SIGADOC'); // o texto não é gritado em maiúsculas
  });
});

test.describe('data de referência no rodapé', () => {
  test('sai do cabeçalho e vai para "Referência: dd/mm/aaaa · alterar" no rodapé', async ({ page }) => {
    await abrir(page);
    const rodape = page.locator('footer.rodape-pagina');
    await expect(rodape).toContainText('Referência: 15/10/2026');
    await expect(page.locator('header.topo').getByLabel('Data de referência')).toHaveCount(0);
    await expect(page.locator('header.topo').getByRole('button', { name: /Usar data do exemplo/ })).toHaveCount(0);
    await expect(page.locator('header.topo').getByRole('button')).toHaveText(['Nova demanda']);
  });

  test('"alterar" abre os controles (data e "Usar data do exemplo"); a data muda a tela e o texto do rodapé', async ({ page }) => {
    await abrir(page);
    const alterar = page.getByRole('button', { name: 'alterar', exact: true });
    await expect(alterar).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('#referencia-controles')).toBeHidden();
    await alterar.click();
    await expect(alterar).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#referencia-controles')).toBeVisible();
    await expect(page.getByLabel('Data de referência')).toBeFocused();
    await page.getByLabel('Data de referência').fill('2026-10-16');
    await expect(page.locator('footer.rodape-pagina')).toContainText('Referência: 16/10/2026');
    await expect(page.locator('#fila .demanda-prazo').first()).toContainText('vencida há 3 dias'); // a data de referência segue valendo
    await page.getByRole('button', { name: /Usar data do exemplo \(15\/10\/2026\)/ }).click();
    await expect(page.locator('footer.rodape-pagina')).toContainText('Referência: 15/10/2026');
    await alterar.click(); // fecha de novo
    await expect(page.locator('#referencia-controles')).toBeHidden();
    await expect(alterar).toHaveAttribute('aria-expanded', 'false');
  });

  test('o rodapé fica no fim da página, sem cobrir a fila, e cabe na largura', async ({ page }) => {
    await abrir(page);
    await abrirControlesDeReferencia(page);
    const rodape = await page.locator('footer.rodape-pagina').boundingBox();
    const ultimo = await page.locator('#fila > li').last().boundingBox();
    expect(rodape.y).toBeGreaterThan(ultimo.y + ultimo.height);
    expect(rodape.x + rodape.width).toBeLessThanOrEqual(page.viewportSize().width + 1);
  });
});

test.describe('aviso de férias discreto', () => {
  test('é uma linha acima dos indicadores, com botão fechar, e o texto de sempre', async ({ page }) => {
    await abrir(page);
    const aviso = page.locator('#aviso-afastamento');
    await expect(aviso).toBeVisible();
    await expect(aviso).toContainText('Férias começam em 19 dias (03/11/2026 a 17/11/2026). 1 demanda tem prazo no período: considere antecipar.');
    expect(SEM_FUNDO).toContain(await estilo(aviso, 'backgroundColor')); // sem caixa colorida
    expect(await estilo(aviso, 'borderTopWidth')).toBe('0px');
    expect(await estilo(aviso, 'fontSize')).toBe('12px');
    const caixa = await aviso.boundingBox();
    const indicadores = await page.locator('#indicadores').boundingBox();
    expect(caixa.y + caixa.height).toBeLessThanOrEqual(indicadores.y); // acima dos indicadores
    await expect(aviso.getByRole('button', { name: 'Fechar o aviso de afastamento' })).toBeVisible();
  });

  test('fechar esconde o aviso, leva o foco ao título dos indicadores e é lembrado ao recarregar', async ({ page }) => {
    await abrir(page);
    await page.locator('#aviso-afastamento').getByRole('button', { name: 'Fechar o aviso de afastamento' }).click();
    await expect(page.locator('#aviso-afastamento')).toBeHidden();
    await expect(page.locator('#titulo-indicadores')).toBeFocused();
    await page.reload();
    await abrir(page);
    await expect(page.locator('#aviso-afastamento')).toBeHidden(); // lembrado no navegador
    // Mudar a data sem mudar de afastamento não o traz de volta (o fechamento vale para o afastamento, não para a contagem de dias).
    await definirDataDeReferencia(page, '2026-10-20');
    await expect(page.locator('#aviso-afastamento')).toBeHidden();
  });

  test('volta a aparecer quando outro afastamento passa a estar próximo', async ({ page }) => {
    await abrir(page);
    await page.locator('#aviso-afastamento').getByRole('button', { name: 'Fechar o aviso de afastamento' }).click();
    await expect(page.locator('#aviso-afastamento')).toBeHidden();
    await definirDataDeReferencia(page, '2026-11-10'); // as férias já começaram; a licença-prêmio (07/12) entra na janela de 30 dias
    await expect(page.locator('#aviso-afastamento')).toBeVisible();
    await expect(page.locator('#aviso-afastamento')).toContainText('Licença-prêmio começa em 27 dias');
  });

  test('sem armazenamento disponível o aviso ainda fecha (até recarregar)', async ({ page }) => {
    await page.addInitScript(() => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (chave, valor) {
        if (String(chave).includes('aviso-afastamento')) throw new Error('bloqueado');
        return original.call(this, chave, valor);
      };
    });
    await abrir(page);
    await page.locator('#aviso-afastamento').getByRole('button', { name: 'Fechar o aviso de afastamento' }).click();
    await expect(page.locator('#aviso-afastamento')).toBeHidden();
  });
});
