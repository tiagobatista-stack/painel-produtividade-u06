import { test, expect, abrir, cartao } from './apoio.mjs';

const abrirNovo = async (page) => {
  await page.getByRole('button', { name: 'Nova demanda' }).click();
  return page.getByRole('dialog', { name: 'Nova demanda' });
};

const colar = (campo, texto) =>
  campo.evaluate((el, t) => {
    const dt = new DataTransfer();
    dt.setData('text', t);
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  }, texto);

const semRolagemHorizontal = (page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

test.describe('formulário de demanda: campos, prioridade e anotações', () => {
  test('abre com foco no título, aviso visível, prazo vazio e dicas nos campos menos óbvios', async ({ page }) => {
    await abrir(page);
    const dialogo = await abrirNovo(page);
    await expect(dialogo.getByLabel('Título')).toBeFocused();
    await expect(dialogo.getByLabel('Título')).toHaveAttribute('placeholder', 'Ex.: Renovar licença ambiental');
    await expect(dialogo.getByText('Use apenas dados fictícios: a publicação na internet é pública.')).toBeVisible();
    await expect(dialogo.getByLabel('Prazo', { exact: true })).toHaveValue(''); // a data de referência não é padrão
    await expect(dialogo.getByLabel('Descrição')).toHaveAttribute('placeholder', 'Contexto, objetivo e próximos passos');
    await expect(dialogo.getByLabel('Responsável')).toHaveAttribute('placeholder', 'Nome ou equipe');
    await expect(dialogo.getByLabel('Município')).toHaveAttribute('placeholder', 'Ex.: Cuiabá - MT');
    await expect(dialogo.getByLabel('Protocolo/referência')).toHaveAttribute('placeholder', 'SEMA-PRO-FICT-0000');
    await expect(dialogo.getByLabel('Prioridade')).toHaveValue('');
    await expect(dialogo.getByLabel('Prioridade').locator('option')).toHaveText(['Automática (calculada)', 'Baixa', 'Média', 'Alta', 'Crítica']);
    await expect(dialogo.getByLabel('Etapa').locator('option')).toHaveText(['Sem etapa', 'Triagem', 'Análise', 'Parecer', 'Devolvido']);
    await expect(dialogo.getByLabel('Prioridade')).toHaveAccessibleDescription(/ajuste manual exige motivo/);
    // obrigatórios marcados por aria-required (o asterisco é desenhado por CSS)
    for (const rotulo of ['Tipo', 'Título']) await expect(dialogo.getByLabel(rotulo, { exact: true })).toHaveAttribute('aria-required', 'true');
    await expect(dialogo.getByLabel('Prazo', { exact: true })).toHaveAttribute('aria-required', 'true');
    await dialogo.getByRole('button', { name: 'Fechar' }).click();
    await expect(dialogo).toBeHidden();
  });

  test('prévia: Processo SIGADOC + Ministério Público + prazo vencido → "Crítica · 90", atualizada ao mudar os campos', async ({ page }) => {
    await abrir(page);
    const dialogo = await abrirNovo(page);
    const previa = dialogo.locator('#previa-prioridade');
    await expect(previa).toHaveAttribute('aria-live', 'polite');
    await expect(previa).toContainText('informe o prazo');
    await dialogo.getByLabel('Origem').selectOption({ label: 'Ministério Público' });
    await dialogo.getByLabel('Prazo', { exact: true }).fill('2026-10-14');
    await expect(previa).toContainText('Crítica · 90');
    await expect(previa).toContainText('Prazo vencido (+50)');
    await dialogo.getByLabel('Origem').selectOption({ label: 'Ouvidoria' });
    await expect(previa).toContainText('Crítica · 80');
    await dialogo.getByLabel('Status').selectOption({ label: 'Sobrestado (aguardando)' });
    await expect(previa).toContainText('Sobrestada');
    await dialogo.getByLabel('Status').selectOption({ label: 'Concluída' });
    await expect(previa).toContainText('fora da fila');
    await dialogo.getByLabel('Status').selectOption({ label: 'A fazer' });
    await dialogo.getByLabel('Tipo').selectOption({ label: 'Reunião' });
    await dialogo.getByLabel('Origem').selectOption({ label: 'Própria' });
    await expect(previa).toContainText('Alta · 60'); // vencido 50 + reunião 10
  });

  test('ajuste manual exige motivo; a prévia continua mostrando a prioridade calculada; o cartão mostra as duas', async ({ page }) => {
    await abrir(page);
    const dialogo = await abrirNovo(page);
    await dialogo.getByLabel('Título').fill('Demanda com ajuste');
    await dialogo.getByLabel('Prazo', { exact: true }).fill('2026-10-14');
    await expect(dialogo.getByLabel('Motivo do ajuste')).toBeHidden();
    await dialogo.getByLabel('Prioridade').selectOption({ label: 'Baixa' });
    await expect(dialogo.getByLabel('Motivo do ajuste')).toBeFocused();
    await dialogo.getByRole('button', { name: 'Salvar demanda' }).click();
    await expect(dialogo.getByRole('alert')).toContainText('Informe o motivo do ajuste.');
    await expect(dialogo.getByLabel('Motivo do ajuste')).toHaveAttribute('aria-invalid', 'true');
    await expect(dialogo.locator('#previa-prioridade')).toContainText('Crítica · 90'); // calculada, não a manual
    await expect(dialogo.locator('#previa-prioridade')).toContainText('Ajuste manual: Baixa');
    await dialogo.getByLabel('Motivo do ajuste').fill('Aguarda decisão de outra área');
    await dialogo.getByRole('button', { name: 'Salvar demanda' }).click();
    await expect(dialogo).toBeHidden();

    const c = cartao(page, 'Demanda com ajuste');
    await expect(c.locator('.prioridade')).toHaveText('Prioridade Baixa (manual) · calculada: Crítica 90');
    await c.getByText('Por que esta prioridade?').click();
    await expect(c).toContainText('Ajuste manual: Baixa. Motivo: Aguarda decisão de outra área');
    await expect(c).toContainText('Prazo vencido (+50)');
    // a faixa manual define o grupo: a demanda (90 calculados) abre o grupo Baixa, depois de todas as Média
    const titulos = await page.locator('#fila .demanda-titulo').allTextContents();
    expect(titulos.indexOf('Demanda com ajuste')).toBe(titulos.indexOf('Palestra sobre prevenção de desmatamento') - 1); // primeira do grupo Baixa (score 90 > 20)
    // o filtro por prioridade usa a faixa efetiva
    await page.getByRole('search').getByLabel('Prioridade').selectOption({ label: 'Baixa' });
    await expect(cartao(page, 'Demanda com ajuste')).toBeVisible();
    await page.getByRole('search').getByLabel('Prioridade').selectOption({ label: 'Crítica' });
    await expect(cartao(page, 'Demanda com ajuste')).toHaveCount(0);
  });

  test('anotações: Enter e botão adicionam, colar várias linhas cria um item por linha; marcar no cartão atualiza "1/3" e o histórico', async ({ page }) => {
    await abrir(page);
    const dialogo = await abrirNovo(page);
    await dialogo.getByLabel('Título').fill('Demanda com anotações');
    await dialogo.getByLabel('Prazo', { exact: true }).fill('2026-10-30');
    const nova = dialogo.getByLabel('Anotações', { exact: true });
    await nova.fill('Primeira');
    await nova.press('Enter');
    await expect(dialogo).toBeVisible(); // Enter não envia o formulário
    await colar(nova, 'Segunda\nTerceira\n\n');
    await expect(dialogo.getByRole('checkbox')).toHaveCount(4); // 3 anotações + "Mostrar concluídas"
    await dialogo.getByRole('checkbox', { name: 'Terceira' }).check();
    await expect(dialogo.getByRole('checkbox', { name: 'Terceira' })).toBeChecked();
    await expect(dialogo.locator('.lista-anotacoes li').last()).toContainText('Terceira'); // concluída vai para o fim
    await dialogo.getByRole('checkbox', { name: 'Terceira' }).uncheck();
    await dialogo.getByRole('button', { name: 'Salvar demanda' }).click();
    await expect(dialogo).toBeHidden();

    const c = cartao(page, 'Demanda com anotações');
    await expect(c.getByText('Anotações 0/3')).toBeVisible();
    await c.getByText('Anotações 0/3').click();
    await c.getByRole('checkbox', { name: 'Segunda' }).check();
    await expect(c.getByText('Anotações 1/3')).toBeVisible();
    await expect(c.getByRole('checkbox', { name: 'Segunda' })).toBeFocused(); // o foco acompanha o item
    await expect(c.locator('.anotacao-cartao').last()).toContainText('Segunda'); // concluída vai para o fim
    await c.getByText(/Histórico/).click();
    await expect(c).toContainText('Anotação concluída: Segunda');
    await expect(c.locator('.prioridade')).toHaveText(/^Prioridade .* pontos$/); // anotações não alteram a prioridade

    await page.reload();
    await expect(page.getByRole('button', { name: 'Usar data do exemplo' })).toBeVisible();
    await page.getByRole('button', { name: /Usar data do exemplo/ }).click();
    await expect(cartao(page, 'Demanda com anotações').getByText('Anotações 1/3')).toBeVisible(); // persiste
  });

  test('anotações no formulário: editar ao clicar, remover com "Desfazer" por 5 s e mostrar/ocultar concluídas', async ({ page }) => {
    await abrir(page);
    const dialogo = await abrirNovo(page);
    const nova = dialogo.getByLabel('Anotações', { exact: true });
    await colar(nova, 'Alfa\nBeta\nGama');
    await dialogo.getByRole('button', { name: 'Beta', exact: true }).click(); // clicar no texto edita
    await dialogo.getByRole('textbox', { name: /^Editar anotação: Beta/ }).fill('Beta revisada');
    await dialogo.getByRole('textbox', { name: /^Editar anotação/ }).press('Enter');
    await expect(dialogo.getByRole('checkbox', { name: 'Beta revisada' })).toBeVisible();
    await expect(dialogo).toBeVisible();

    await dialogo.getByRole('button', { name: 'Remover anotação: Alfa' }).click();
    await expect(dialogo.getByRole('checkbox', { name: 'Alfa' })).toHaveCount(0);
    await dialogo.getByRole('button', { name: 'Desfazer' }).click();
    await expect(dialogo.getByRole('checkbox', { name: 'Alfa' })).toBeVisible();
    await expect(dialogo.locator('.lista-anotacoes li').first()).toContainText('Alfa'); // volta à mesma posição

    await dialogo.getByRole('button', { name: 'Remover anotação: Gama' }).click();
    await expect(dialogo.getByRole('button', { name: 'Desfazer' })).toBeVisible();
    await expect(dialogo.getByRole('button', { name: 'Desfazer' })).toBeHidden({ timeout: 8000 }); // some depois de 5 s
    await expect(dialogo.getByRole('checkbox', { name: 'Gama' })).toHaveCount(0);

    await dialogo.getByRole('checkbox', { name: 'Alfa' }).check();
    await dialogo.getByLabel('Mostrar concluídas').uncheck();
    await expect(dialogo.getByRole('checkbox', { name: 'Alfa' })).toHaveCount(0);
    await dialogo.getByLabel('Mostrar concluídas').check();
    await expect(dialogo.getByRole('checkbox', { name: 'Alfa' })).toBeChecked();
  });

  test('anotações por teclado: marcar com Espaço no cartão', async ({ page }) => {
    await abrir(page);
    const c = cartao(page, 'Manifestação em procedimento do Ministério Público');
    await c.getByText(/Anotações 1\/3/).press('Enter'); // abre pelo teclado
    const caixa = c.getByRole('checkbox', { name: 'Redigir a minuta da manifestação' });
    await caixa.focus();
    await caixa.press('Space');
    await expect(c.getByText('Anotações 2/3')).toBeVisible();
  });

  test('texto com HTML em título, descrição e anotação aparece como texto puro, sem executar', async ({ page }) => {
    let alertas = 0;
    page.on('dialog', (d) => { alertas++; d.dismiss(); });
    await abrir(page);
    const dialogo = await abrirNovo(page);
    const perigoso = '<img src=x onerror=alert(1)>';
    await dialogo.getByLabel('Título').fill('Título com HTML');
    await dialogo.getByLabel('Descrição').fill(perigoso);
    await dialogo.getByLabel('Prazo', { exact: true }).fill('2026-10-30');
    await dialogo.getByLabel('Anotações', { exact: true }).fill(perigoso);
    await dialogo.getByLabel('Anotações', { exact: true }).press('Enter');
    await expect(dialogo.getByRole('checkbox', { name: perigoso })).toBeVisible();
    await expect(dialogo.locator('.lista-anotacoes img')).toHaveCount(0);
    await dialogo.getByRole('button', { name: 'Salvar demanda' }).click();
    const c = cartao(page, 'Título com HTML');
    await expect(c.locator('.demanda-descricao')).toHaveText(perigoso);
    await c.getByText(/Anotações 0\/1/).click();
    await expect(c.locator('.anotacao-cartao')).toHaveText(perigoso);
    await expect(c.locator('img')).toHaveCount(0);
    await expect(page.locator('#fila img')).toHaveCount(0);
    expect(alertas).toBe(0);
  });

  test('migração: processo antigo abre com protocolo e etapa da lista; Etapa e Protocolo editáveis', async ({ page }) => {
    await abrir(page);
    await page.getByRole('button', { name: /^Editar Resposta à chefia sobre processo/ }).click(); // era etapa "despacho"
    const dialogo = page.getByRole('dialog', { name: 'Editar demanda' });
    await expect(dialogo.getByLabel('Protocolo/referência')).toHaveValue('SEMA-PRO-FICT-0063');
    await expect(dialogo.getByLabel('Etapa')).toHaveValue('analise');
    await dialogo.getByLabel('Etapa').selectOption({ label: 'Parecer' });
    await dialogo.getByLabel('Responsável').fill('Equipe Teste');
    await dialogo.getByRole('button', { name: 'Salvar demanda' }).click();
    const c = cartao(page, 'Resposta à chefia sobre processo');
    await expect(c).toContainText('Processo SEMA-PRO-FICT-0063 · etapa: Parecer');
    await expect(c).toContainText('Responsável: Equipe Teste');
  });

  test('layout: duas colunas a partir de 600 px, uma no celular, cabeçalho e rodapé fixos, sem rolagem horizontal', async ({ page }) => {
    await abrir(page);
    for (const [largura, duasColunas] of [[1366, true], [390, false]]) {
      await page.setViewportSize({ width: largura, height: 700 });
      const dialogo = await abrirNovo(page);
      const tipo = await dialogo.getByLabel('Tipo').boundingBox();
      const origem = await dialogo.getByLabel('Origem').boundingBox();
      if (duasColunas) {
        expect(Math.abs(tipo.y - origem.y)).toBeLessThan(2);
        expect(origem.x).toBeGreaterThan(tipo.x + tipo.width - 1);
      } else {
        expect(origem.y).toBeGreaterThan(tipo.y + tipo.height - 1);
        expect(Math.abs(origem.x - tipo.x)).toBeLessThan(2);
      }
      // título, descrição e anotações ocupam a linha inteira
      const titulo = await dialogo.getByLabel('Título').boundingBox();
      expect(titulo.width).toBeGreaterThan(duasColunas ? tipo.width * 1.8 : tipo.width * 0.95);
      expect(await semRolagemHorizontal(page)).toBe(true);
      expect(await dialogo.locator('.dlg-corpo').evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
      // cabeçalho e rodapé ficam visíveis; o corpo é que rola
      await expect(dialogo.getByRole('heading', { name: 'Nova demanda' })).toBeInViewport();
      await expect(dialogo.getByRole('button', { name: 'Salvar demanda' })).toBeInViewport();
      await expect(dialogo.getByRole('button', { name: 'Cancelar' })).toBeInViewport();
      const rolavel = await dialogo.locator('.dlg-corpo').evaluate((el) => el.scrollHeight > el.clientHeight);
      expect(rolavel).toBe(true);
      await dialogo.getByLabel('Anotações', { exact: true }).scrollIntoViewIfNeeded();
      await expect(dialogo.getByRole('heading', { name: 'Nova demanda' })).toBeInViewport();
      await expect(dialogo.getByRole('button', { name: 'Salvar demanda' })).toBeInViewport();
      // Cancelar à esquerda, Salvar à direita
      const cancelar = await dialogo.getByRole('button', { name: 'Cancelar' }).boundingBox();
      const salvar = await dialogo.getByRole('button', { name: 'Salvar demanda' }).boundingBox();
      expect(cancelar.x).toBeLessThan(salvar.x);
      await dialogo.getByRole('button', { name: 'Cancelar' }).click();
      await expect(dialogo).toBeHidden();
    }
  });

  test('layout do painel e do cartão com anotações em 1366 e 390 px, sem rolagem horizontal', async ({ page }) => {
    await abrir(page);
    for (const largura of [1366, 390]) {
      await page.setViewportSize({ width: largura, height: 800 });
      await cartao(page, 'Manifestação em procedimento do Ministério Público').getByText(/Anotações/).click();
      expect(await semRolagemHorizontal(page)).toBe(true);
    }
  });
});
