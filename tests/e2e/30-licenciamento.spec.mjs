// Tipo "Licenciamento" (RF43): na lista de tipos do formulário, com os mesmos campos e a mesma pontuação do processo, no filtro, no painel,
// no calendário e no exemplo. Dados fictícios.
import { test, expect, abrir, abrirPainel, cartao, fecharPainel, irParaAba, painel, usarDataDoExemplo } from './apoio.mjs';

const TITULO = 'Licença fictícia de teste';
const dialogo = (page, nome = 'Nova demanda') => page.getByRole('dialog', { name: nome });
const campo = (page, rotulo, nome = 'Nova demanda') => dialogo(page, nome).getByLabel(rotulo, { exact: true });
const guardada = (page, titulo = TITULO) => page.evaluate((t) => JSON.parse(localStorage.getItem('painel-demandas:v1')).demandas.find((d) => d.titulo === t), titulo);
const opcoes = (page, rotulo) => campo(page, rotulo).locator('option').allTextContents();

async function abrirNova(page) {
  await abrir(page);
  await page.getByRole('button', { name: 'Nova demanda' }).click();
  await expect(dialogo(page)).toBeVisible();
}

async function cadastrarLicenciamento(page) {
  await abrirNova(page);
  await campo(page, 'Tipo').selectOption({ label: 'Licenciamento' });
  await campo(page, 'Título').fill(TITULO);
  await campo(page, 'Origem').selectOption({ label: 'Ministério Público' });
  await campo(page, 'Prazo').fill('2026-10-14'); // vencido na data do exemplo (15/10/2026)
  await campo(page, 'Protocolo/referência').fill('SEMA-PRO-FICT-0900');
  await campo(page, 'Etapa').selectOption({ label: 'Análise' });
}

test.describe('Licenciamento: cadastro e edição', () => {
  test('"Licenciamento" está na lista de tipos, depois do Processo SIGADOC', async ({ page }) => {
    await abrirNova(page);
    expect(await opcoes(page, 'Tipo')).toEqual(['Processo SIGADOC', 'Licenciamento', 'Reunião', 'Palestra', 'Outra']);
  });

  test('tem os mesmos campos do processo: origens, etapas, protocolo, município, localização, anotações', async ({ page }) => {
    await abrirNova(page);
    await campo(page, 'Tipo').selectOption({ label: 'Processo SIGADOC' });
    const origensDoProcesso = await opcoes(page, 'Origem');
    const etapasDoProcesso = await opcoes(page, 'Etapa');
    await campo(page, 'Tipo').selectOption({ label: 'Licenciamento' });
    expect(await opcoes(page, 'Origem')).toEqual(origensDoProcesso); // as mesmas origens, inclusive Ministério Público
    expect(origensDoProcesso).toContain('Ministério Público');
    expect(await opcoes(page, 'Etapa')).toEqual(etapasDoProcesso);
    expect(etapasDoProcesso).toEqual(['Sem etapa', 'Triagem', 'Análise', 'Parecer', 'Devolvido']);
    for (const rotulo of ['Descrição', 'Status', 'Prioridade', 'Responsável', 'Prazo', 'Município', 'Protocolo/referência', 'Etapa', 'Esforço estimado (h)', 'Endereço ou referência espacial', 'Latitude', 'Longitude', 'Anotações']) {
      await expect(campo(page, rotulo), rotulo).toBeVisible();
    }
    for (const rotulo of ['Data e hora', 'Local', 'Público esperado (pessoas)']) await expect(campo(page, rotulo), rotulo).toBeHidden(); // são de reunião e palestra
    // Trocar de tipo continua escondendo o que não é dele.
    await campo(page, 'Tipo').selectOption({ label: 'Reunião' });
    await expect(campo(page, 'Etapa')).toBeHidden();
    await expect(campo(page, 'Data e hora')).toBeVisible();
  });

  test('a prévia soma +15 do tipo e a origem do processo: vencido, Ministério Público → Crítica · 90', async ({ page }) => {
    await cadastrarLicenciamento(page);
    const previa = page.locator('#previa-prioridade');
    await expect(previa).toContainText('Prioridade calculada: Crítica · 90');
    await expect(previa).toContainText('Licenciamento (+15)');
    await expect(previa).toContainText('Origem: Ministério Público (+25)');
  });

  test('cadastra, vê no card e no painel (processo, etapa, motivos) e persiste ao recarregar', async ({ page }) => {
    await cadastrarLicenciamento(page);
    await dialogo(page).getByRole('button', { name: 'Salvar' }).click();
    await expect(dialogo(page)).toBeHidden();
    const c = cartao(page, TITULO);
    await expect(c.locator('.etiqueta')).toHaveText('Licenciamento');
    await expect(c.locator('.status')).toHaveText('Crítica');
    const p = await abrirPainel(page, TITULO);
    await expect(p.locator('.prioridade')).toHaveText('Prioridade Crítica · 90 pontos');
    await expect(p.getByText('Processo SEMA-PRO-FICT-0900 · etapa: Análise')).toBeVisible();
    await expect(p.getByText('Origem: Ministério Público', { exact: true })).toBeVisible();
    await expect(p).toContainText('Licenciamento (+15)');
    await expect(p).toContainText('Origem: Ministério Público (+25)');
    await fecharPainel(page);

    const g = await guardada(page);
    expect([g.tipo, g.origem, g.protocolo, g.etapa, g.id]).toEqual(['licenciamento', 'mp', 'SEMA-PRO-FICT-0900', 'analise', 'DEM-0015']);
    await page.reload();
    await usarDataDoExemplo(page);
    await expect(cartao(page, TITULO).locator('.etiqueta')).toHaveText('Licenciamento');
  });

  test('edita a etapa e o protocolo; o tipo não muda', async ({ page }) => {
    await cadastrarLicenciamento(page);
    await dialogo(page).getByRole('button', { name: 'Salvar' }).click();
    const p = await abrirPainel(page, TITULO);
    await p.getByRole('button', { name: `Editar ${TITULO}` }).click();
    await expect(campo(page, 'Tipo', 'Editar demanda')).toBeDisabled();
    expect(await campo(page, 'Tipo', 'Editar demanda').locator('option').allTextContents()).toEqual(['Licenciamento']);
    await expect(campo(page, 'Etapa', 'Editar demanda')).toHaveValue('analise');
    await campo(page, 'Etapa', 'Editar demanda').selectOption({ label: 'Parecer' });
    await campo(page, 'Protocolo/referência', 'Editar demanda').fill('SEMA-PRO-FICT-0901');
    await dialogo(page, 'Editar demanda').getByRole('button', { name: 'Salvar' }).click();
    await expect(painel(page).getByText('Processo SEMA-PRO-FICT-0901 · etapa: Parecer')).toBeVisible();
    expect((await guardada(page)).tipo).toBe('licenciamento');
  });

  test('aceita localização e município como os outros tipos', async ({ page }) => {
    await abrirNova(page);
    await campo(page, 'Tipo').selectOption({ label: 'Licenciamento' });
    await campo(page, 'Título').fill(TITULO);
    await campo(page, 'Prazo').fill('2026-10-25');
    await campo(page, 'Município').fill('juína');
    await campo(page, 'Latitude').fill('-12,5');
    await campo(page, 'Longitude').fill('-27,2');
    await dialogo(page).getByRole('button', { name: 'Salvar' }).click();
    const p = await abrirPainel(page, TITULO);
    await expect(p.getByText('Município: Juína', { exact: true })).toBeVisible();
    await expect(p.locator('.painel-coordenada')).toContainText('(-12,500000, -27,200000)');
  });
});

test.describe('Licenciamento: lista, painel, calendário e exemplo', () => {
  test('o exemplo traz um licenciamento fictício, com os campos comuns, Média · 25', async ({ page }) => {
    await abrir(page);
    const c = cartao(page, 'Análise de pedido de licença de operação');
    await expect(c.locator('.etiqueta')).toHaveText('Licenciamento');
    await expect(c.locator('.status')).toHaveText('Média');
    const p = await abrirPainel(page, 'Análise de pedido de licença de operação');
    await expect(p.locator('.prioridade')).toHaveText('Prioridade Média · 25 pontos');
    await expect(p.getByText('Processo SEMA-PRO-FICT-0140 · etapa: Análise')).toBeVisible();
    await expect(p.getByText('Município: Cidade Fictícia Beta', { exact: true })).toBeVisible();
    await expect(p.getByText('Responsável: Equipe de Licenciamento Fictícia')).toBeVisible();
    await expect(p).toContainText('Anotações 1/2');
    await expect(p).toContainText('Licenciamento (+15)');
    await expect(p).toContainText('Origem: chefia ou coordenação (+10)');
  });

  test('o processo "sobre licenciamento" do exemplo continua sendo um processo', async ({ page }) => {
    await abrir(page);
    await expect(cartao(page, 'Resposta à chefia sobre processo de licenciamento').locator('.etiqueta')).toHaveText('Processo SIGADOC');
  });

  test('o filtro por tipo tem "Licenciamento" e mostra só os licenciamentos', async ({ page }) => {
    await abrir(page);
    const tipo = page.getByRole('search', { name: 'Buscar e filtrar demandas' }).getByLabel('Tipo');
    expect(await tipo.locator('option').allTextContents()).toEqual(['Todos', 'Operação de alertas', 'Processo SIGADOC', 'Licenciamento', 'Reunião', 'Palestra', 'Outra']);
    await tipo.selectOption({ label: 'Licenciamento' });
    await expect(page.locator('#fila > li')).toHaveCount(1);
    await expect(page.locator('#fila .demanda-titulo')).toHaveText('Análise de pedido de licença de operação de empreendimento fictício');
  });

  test('o prazo aparece no calendário como "Prazo de licenciamento" e leva ao cartão', async ({ page }) => {
    await abrir(page);
    await irParaAba(page, 'Agenda');
    const secao = page.locator('section[aria-labelledby="titulo-calendario"]');
    await secao.getByRole('button', { name: /30 de outubro de 2026/ }).click();
    const detalhe = page.locator('#calendario-detalhe');
    await expect(detalhe).toBeVisible();
    await expect(detalhe).toContainText('Prazo de licenciamento');
    await detalhe.getByRole('button', { name: /SEMA-PRO-FICT-0140 — Análise de pedido de licença/ }).click();
    await expect(page.locator('#fila .demanda', { hasText: 'Análise de pedido de licença de operação' })).toBeFocused();
  });

  test('no quadro, o licenciamento fica em "A fazer", na faixa de serviço "Padrão" (como o processo)', async ({ page }) => {
    await abrir(page);
    await page.getByRole('group', { name: 'Visão da fila' }).getByRole('button', { name: 'Quadro', exact: true }).click();
    await expect(page.locator('#visao-quadro')).toBeVisible();
    const padrao = page.getByRole('list', { name: 'A fazer, faixa Padrão', exact: true });
    await expect(padrao.locator('.demanda-titulo', { hasText: 'Análise de pedido de licença de operação' })).toHaveCount(1);
    await expect(padrao.locator('.demanda-titulo', { hasText: 'Informação técnica para ofício do Poder Judiciário' })).toHaveCount(1); // o processo está na mesma faixa
  });
});
