// Situação da vistoria (RF50): campo no cadastro e na edição, linha no painel e filtro "Vistoria" da lista. Dados fictícios.
import { test, expect, abrir, abrirPainel, cartao, fecharPainel, filtros, painel } from './apoio.mjs';

const TITULO = 'Vistoria fictícia a programar';

const dialogo = (page, nome = 'Nova demanda') => page.getByRole('dialog', { name: nome });
const campo = (page, rotulo, nome = 'Nova demanda') => dialogo(page, nome).getByLabel(rotulo, { exact: true });
const filtroVistoria = (page) => filtros(page).getByLabel('Vistoria', { exact: true });

async function abrirNova(page) {
  await abrir(page);
  await page.getByRole('button', { name: 'Nova demanda' }).click();
  await expect(dialogo(page)).toBeVisible();
}

async function preencherBasico(page) {
  await campo(page, 'Tipo').selectOption({ label: 'Outra' });
  await campo(page, 'Título').fill(TITULO);
  await campo(page, 'Prazo').fill('2026-10-25');
}

const salvar = (page, nome = 'Nova demanda') => dialogo(page, nome).getByRole('button', { name: 'Salvar' }).click();

test.describe('situação da vistoria (RF50)', () => {
  test('o filtro "Pede vistoria" mostra as pendentes e as programadas do exemplo, e "Limpar filtros" volta ao padrão', async ({ page }) => {
    await abrir(page);
    const todas = await page.locator('#fila > li').count();
    await filtroVistoria(page).selectOption({ label: 'Pede vistoria (pendente ou programada)' });
    await expect(page.locator('#fila > li')).toHaveCount(2);
    await expect(cartao(page, 'Informação técnica para ofício do Poder Judiciário')).toBeVisible();
    await expect(cartao(page, 'Análise de denúncia sobre supressão vegetal')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Limpar filtros' })).toBeEnabled();

    await filtroVistoria(page).selectOption({ label: 'Vistoriada' });
    await expect(page.locator('#fila > li')).toHaveCount(1); // DEM-0003, em andamento
    await expect(cartao(page, 'Manifestação em procedimento do Ministério Público')).toBeVisible();
  });

  test('cada situação do filtro mostra só as demandas dela', async ({ page }) => {
    await abrir(page);
    await filtroVistoria(page).selectOption({ label: 'Vistoria pendente' });
    await expect(page.locator('#fila > li')).toHaveCount(1);
    await expect(cartao(page, 'Informação técnica para ofício do Poder Judiciário')).toBeVisible();
    await filtroVistoria(page).selectOption({ label: 'Vistoria programada' });
    await expect(page.locator('#fila > li')).toHaveCount(1);
    await expect(cartao(page, 'Análise de denúncia sobre supressão vegetal')).toBeVisible();
    await filtroVistoria(page).selectOption({ label: 'Não acessada' });
    await expect(page.locator('#fila > li')).toHaveCount(0);
    await page.getByRole('button', { name: 'Limpar filtros' }).click();
    await expect(filtroVistoria(page)).toHaveValue('');
    expect(await page.locator('#fila > li').count()).toBeGreaterThan(2);
  });

  test('o painel mostra a situação, e a vistoriada traz a data', async ({ page }) => {
    await abrir(page);
    const programada = await abrirPainel(page, 'Análise de denúncia sobre supressão vegetal');
    await expect(programada).toContainText('Vistoria: Vistoria programada');
    await fecharPainel(page);
    const pendente = await abrirPainel(page, 'Informação técnica para ofício do Poder Judiciário');
    await expect(pendente).toContainText('Vistoria: Vistoria pendente');
    await fecharPainel(page);
    const vistoriada = await abrirPainel(page, 'Manifestação em procedimento do Ministério Público');
    await expect(vistoriada).toContainText('Vistoria: Vistoriada em 10/10/2026');
  });

  test('cadastro: a situação começa em "Não requer vistoria"; a data só aparece em "Vistoriada" e é obrigatória', async ({ page }) => {
    await abrirNova(page);
    await preencherBasico(page);
    await expect(campo(page, 'Situação da vistoria')).toHaveValue('nao_requer');
    await expect(dialogo(page).locator('#campo-data-vistoria')).toBeHidden();

    await campo(page, 'Situação da vistoria').selectOption({ label: 'Vistoriada' });
    await expect(campo(page, 'Data da vistoria')).toBeVisible();
    await salvar(page);
    await expect(dialogo(page).locator('#e-data_vistoria')).toHaveText('Informe a data da vistoria.');
    await expect(dialogo(page)).toBeVisible();

    await campo(page, 'Data da vistoria').fill('2026-10-12');
    await salvar(page);
    await expect(dialogo(page)).toBeHidden();
    const p = await abrirPainel(page, TITULO);
    await expect(p).toContainText('Vistoria: Vistoriada em 12/10/2026');
  });

  test('cadastro com "Vistoria pendente" entra no filtro "Pede vistoria"; a edição volta a "Não requer" e sai dele', async ({ page }) => {
    await abrirNova(page);
    await preencherBasico(page);
    await campo(page, 'Situação da vistoria').selectOption({ label: 'Vistoria pendente' });
    await expect(dialogo(page).locator('#campo-data-vistoria')).toBeHidden();
    await salvar(page);
    await expect(dialogo(page)).toBeHidden();

    await filtroVistoria(page).selectOption({ label: 'Pede vistoria (pendente ou programada)' });
    await expect(page.locator('#fila > li')).toHaveCount(3);
    const p = await abrirPainel(page, TITULO);
    await p.getByRole('button', { name: /^Editar / }).click();
    await expect(campo(page, 'Situação da vistoria', 'Editar demanda')).toHaveValue('pendente');
    await campo(page, 'Situação da vistoria', 'Editar demanda').selectOption({ label: 'Não requer vistoria' });
    await salvar(page, 'Editar demanda');
    await expect(dialogo(page, 'Editar demanda')).toBeHidden();
    await expect(painel(page).locator('.demanda-detalhe', { hasText: /^Vistoria:/ })).toHaveCount(0); // a linha some (o histórico guarda a mudança)
    await fecharPainel(page);
    await expect(page.locator('#fila > li')).toHaveCount(2);
  });

  test('a operação não tem o campo de situação da vistoria (os pontos têm a etapa deles)', async ({ page }) => {
    await abrir(page);
    const p = await abrirPainel(page, 'operação de outubro (Norte)');
    await p.getByRole('button', { name: /^Editar / }).click();
    await expect(dialogo(page, 'Editar demanda')).toBeVisible();
    await expect(dialogo(page, 'Editar demanda').locator('#campo-vistoria')).toBeHidden();
    await expect(dialogo(page, 'Editar demanda').locator('#campo-data-vistoria')).toBeHidden();
  });
});
