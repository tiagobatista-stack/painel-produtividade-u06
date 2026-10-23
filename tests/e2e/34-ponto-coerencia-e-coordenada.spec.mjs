// Formulário do ponto: a vistoria acompanha a etapa (sem combinações contraditórias) e a coordenada fora de Mato Grosso tem aviso em
// vermelho, detecção de latitude e longitude invertidas e confirmação ao salvar. Dados fictícios.
import { test, expect, abrir, importarExemplo, irParaAba } from './apoio.mjs';

const lista = (page) => page.locator('#pontos-lista');
const cartao = (page, trecho, equipe = 'Equipe Fictícia Norte') => lista(page).locator('li', { hasText: trecho }).filter({ hasText: equipe });
const dialogo = (page, numero) => page.getByRole('dialog', { name: `Editar ponto ${numero}` });
const campo = (page, numero, rotulo) => dialogo(page, numero).getByLabel(rotulo, { exact: true });
const salvar = (page, numero) => dialogo(page, numero).getByRole('button', { name: 'Salvar ponto' }).click();
const opcoesDe = (select) => select.locator('option').allTextContents();
const PONTO_8 = 'Ponto 8 · Município Fictício B'; // DEM-0001: relatório em elaboração, vistoriada em 05/10/2026, coordenada ainda fora de MT

async function abrirPonto(page, trecho, numero, equipe) {
  await abrir(page);
  await irParaAba(page, 'Pontos');
  await cartao(page, trecho, equipe).getByRole('button', { name: new RegExp(`^Editar o ponto ${numero}`) }).click();
  await expect(dialogo(page, numero)).toBeVisible();
}

test.describe('vistoria e etapa do ponto não se contradizem', () => {
  test('ponto já vistoriado: a vistoria só pode ser "Vistoriada"', async ({ page }) => {
    await abrirPonto(page, PONTO_8, 8);
    expect(await opcoesDe(campo(page, 8, 'Situação da vistoria'))).toEqual(['Vistoriada']);
    await expect(campo(page, 8, 'Data da vistoria')).toHaveValue('2026-10-05');
  });

  test('ponto planejado: a vistoria não oferece "Vistoriada", e a etapa fica bloqueada até registrar o retorno', async ({ page }) => {
    await abrir(page);
    await importarExemplo(page); // pontos planejados
    await irParaAba(page, 'Pontos');
    await cartao(page, 'Ponto 3 ·', 'Equipe Fictícia Leste').getByRole('button', { name: /^Editar o ponto 3/ }).click();
    expect(await opcoesDe(campo(page, 3, 'Situação da vistoria'))).toEqual(['A programar', 'Vistoria programada', 'Não realizada']);
    await expect(campo(page, 3, 'Etapa')).toBeDisabled();
  });

  test('mudar a etapa para "Encerrado: não acessado" leva a vistoria a "Não realizada", sem data; voltar leva a "Vistoriada"', async ({ page }) => {
    await abrirPonto(page, PONTO_8, 8);
    await campo(page, 8, 'Etapa').selectOption({ label: 'Encerrado: não acessado' });
    await expect(campo(page, 8, 'Situação da vistoria')).toHaveValue('nao_acessada');
    expect(await opcoesDe(campo(page, 8, 'Situação da vistoria'))).toEqual(['Não realizada']);
    await expect(dialogo(page, 8).locator('#pt-a-vistoria')).toHaveText('A situação da vistoria acompanhou a etapa.');
    await expect(campo(page, 8, 'Data da vistoria')).toBeHidden();
    await salvar(page, 8);
    await expect(dialogo(page, 8)).toBeHidden();
    await expect(cartao(page, PONTO_8)).toContainText('Vistoria: Não realizada');
    await expect(cartao(page, PONTO_8)).not.toContainText('Vistoria: Vistoriada');

    // Voltar a "Vistoriado": a vistoria acompanha e a data cai na do retorno da operação (07/10/2026), editável.
    await cartao(page, PONTO_8).getByRole('button', { name: /^Editar o ponto 8/ }).click();
    expect(await opcoesDe(campo(page, 8, 'Situação da vistoria'))).toEqual(['Não realizada']);
    await campo(page, 8, 'Etapa').selectOption({ label: 'Vistoriado (relatório pendente)' });
    await expect(campo(page, 8, 'Situação da vistoria')).toHaveValue('vistoriada');
    await expect(campo(page, 8, 'Data da vistoria')).toHaveValue('2026-10-07');
    await salvar(page, 8);
    await expect(dialogo(page, 8)).toBeHidden();
    await expect(cartao(page, PONTO_8)).toContainText('Vistoria: Vistoriada · 07/10/2026');
  });

  test('mudar entre etapas de relatório mantém a vistoria e a data', async ({ page }) => {
    await abrirPonto(page, PONTO_8, 8);
    await campo(page, 8, 'Etapa').selectOption({ label: 'Relatório concluído' });
    await expect(campo(page, 8, 'Situação da vistoria')).toHaveValue('vistoriada');
    await expect(dialogo(page, 8).locator('#pt-a-vistoria')).toHaveText('');
    await expect(campo(page, 8, 'Data da vistoria')).toHaveValue('2026-10-05');
  });
});

test.describe('coordenada fora de Mato Grosso', () => {
  const aviso = (page) => dialogo(page, 8).locator('#pt-aviso-coordenada');
  const confirmar = (page) => dialogo(page, 8).getByLabel('Confirmo a coordenada fora de Mato Grosso');
  const trocar = (page) => dialogo(page, 8).getByRole('button', { name: 'Trocar latitude e longitude' });

  test('coordenada que já estava fora de MT (o exemplo) mostra o aviso, mas salvar outros dados não pede confirmação', async ({ page }) => {
    await abrirPonto(page, PONTO_8, 8);
    await expect(aviso(page)).toContainText('Coordenada fora de Mato Grosso');
    await expect(confirmar(page)).toBeHidden(); // não mudou: nada a confirmar
    await campo(page, 8, 'Assunto (nota do planejamento)').fill('Só o assunto mudou');
    await salvar(page, 8);
    await expect(dialogo(page, 8)).toBeHidden();
  });

  test('coordenada dentro de MT: sem aviso e sem confirmação', async ({ page }) => {
    await abrirPonto(page, PONTO_8, 8);
    await campo(page, 8, 'Latitude').fill('-11,5');
    await campo(page, 8, 'Longitude').fill('-58,3');
    await expect(aviso(page)).toBeHidden();
    await expect(confirmar(page)).toBeHidden();
    await salvar(page, 8);
    await expect(dialogo(page, 8)).toBeHidden();
  });

  test('mudar para fora de MT: aviso em vermelho e o salvar só passa com a confirmação marcada', async ({ page }) => {
    await abrirPonto(page, PONTO_8, 8);
    await campo(page, 8, 'Latitude').fill('-15,5');
    await campo(page, 8, 'Longitude').fill('-20,5');
    await expect(aviso(page)).toBeVisible();
    await expect(aviso(page)).toContainText('Coordenada fora de Mato Grosso');
    await expect(aviso(page)).toHaveCSS('color', 'rgb(185, 28, 28)'); // vermelho de alerta
    await expect(confirmar(page)).toBeVisible();
    await expect(confirmar(page)).not.toBeChecked();
    await expect(trocar(page)).toBeHidden(); // trocando continuaria fora de MT

    await salvar(page, 8);
    await expect(dialogo(page, 8)).toBeVisible();
    await expect(dialogo(page, 8).locator('#pt-e-latitude')).toHaveText('Coordenada fora de Mato Grosso: marque a confirmação para salvar.');
    await confirmar(page).check();
    await salvar(page, 8);
    await expect(dialogo(page, 8)).toBeHidden();

    // Gravou a coordenada confirmada; ao reabrir, ela é a "que já estava": sem nova confirmação.
    await cartao(page, PONTO_8).getByRole('button', { name: /^Editar o ponto 8/ }).click();
    await expect(campo(page, 8, 'Latitude')).toHaveValue('-15,5');
    await expect(confirmar(page)).toBeHidden();
  });

  test('latitude e longitude invertidas: avisa, oferece "Trocar" e, trocadas, entram em MT sem confirmação', async ({ page }) => {
    await abrirPonto(page, PONTO_8, 8);
    await campo(page, 8, 'Latitude').fill('-58,3');
    await campo(page, 8, 'Longitude').fill('-11,5');
    await expect(aviso(page)).toContainText('parecem invertidas');
    await expect(aviso(page)).toHaveCSS('color', 'rgb(185, 28, 28)');
    await expect(trocar(page)).toBeVisible();
    await expect(confirmar(page)).toBeVisible();

    await trocar(page).click();
    await expect(campo(page, 8, 'Latitude')).toHaveValue('-11,5');
    await expect(campo(page, 8, 'Longitude')).toHaveValue('-58,3');
    await expect(aviso(page)).toBeHidden();
    await expect(trocar(page)).toBeHidden();
    await expect(confirmar(page)).toBeHidden();
    await salvar(page, 8);
    await expect(dialogo(page, 8)).toBeHidden();
  });

  test('invertidas e salvando sem trocar nem confirmar: a mensagem do campo explica', async ({ page }) => {
    await abrirPonto(page, PONTO_8, 8);
    await campo(page, 8, 'Latitude').fill('-58,3');
    await campo(page, 8, 'Longitude').fill('-11,5');
    await salvar(page, 8);
    await expect(dialogo(page, 8).locator('#pt-e-latitude')).toContainText('parecem invertidas');
    await expect(dialogo(page, 8)).toBeVisible();
  });
});
