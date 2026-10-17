// Lista de anotações do formulário: caixa de seleção, texto e "×" na mesma linha, em 1366 e 390 px. A caixa de anotação do ponto da
// operação continua em coluna (rótulo, depois a área de texto). Antes, uma regra `.anotacao` valia para os dois e empilhava a linha da lista.
import { test, expect, abrir, abrirPainel, painel } from './apoio.mjs';

const TELAS = [
  { nome: '1366 px', width: 1366, height: 900 },
  { nome: '390 px', width: 390, height: 844 },
];

const dialogo = (page) => page.getByRole('dialog', { name: /^(Nova|Editar) demanda$/ });
const centroY = (caixa) => caixa.y + caixa.height / 2;

// As três peças estão na mesma linha se os centros verticais estão a menos de meia altura de distância, e na ordem caixa, texto, ×.
async function conferirLinha(item) {
  const caixa = await item.locator('input[type="checkbox"]').boundingBox();
  const texto = await item.locator('.anotacao-texto').boundingBox();
  const remover = await item.locator('.remover').boundingBox();
  const alturaMinima = Math.min(caixa.height, texto.height, remover.height);
  for (const outra of [texto, remover]) expect(Math.abs(centroY(outra) - centroY(caixa)), 'centros verticais').toBeLessThan(alturaMinima / 2);
  expect(caixa.x + caixa.width).toBeLessThanOrEqual(texto.x + 1); // caixa, depois o texto
  expect(texto.x + texto.width).toBeLessThanOrEqual(remover.x + 1); // e o "×" por último
  const li = await item.boundingBox();
  for (const peca of [caixa, texto, remover]) expect(peca.y).toBeGreaterThanOrEqual(li.y - 1);
  // Em linha, a altura é a da maior peça (o texto longo pode quebrar em várias linhas); empilhadas, seria a soma das três.
  expect(li.height, 'altura da maior peça, não a soma').toBeLessThanOrEqual(Math.max(caixa.height, texto.height, remover.height) + 2);
}

for (const tela of TELAS) {
  test.describe(`linha da lista de anotações em ${tela.nome}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: tela.width, height: tela.height });
    });

    test('caixa, texto e "×" ficam na mesma linha, também com a anotação concluída e com texto longo', async ({ page }) => {
      await abrir(page);
      await page.getByRole('button', { name: 'Nova demanda' }).click();
      const nova = dialogo(page).getByLabel('Anotações', { exact: true });
      await nova.fill('Ligar para o interessado');
      await nova.press('Enter');
      await nova.fill('Conferir com a coordenação se o documento anexado ao processo cobre todos os pontos da vistoria e pedir a complementação, se faltar algum');
      await nova.press('Enter');
      const itens = dialogo(page).locator('.lista-anotacoes li');
      await expect(itens).toHaveCount(2);
      for (let i = 0; i < 2; i++) await conferirLinha(itens.nth(i));
      await dialogo(page).getByRole('checkbox', { name: 'Ligar para o interessado' }).check();
      await expect(dialogo(page).locator('.lista-anotacoes li.feita')).toHaveCount(1);
      for (let i = 0; i < 2; i++) await conferirLinha(itens.nth(i)); // concluída (riscada) vai para o fim, e continua em uma linha
    });

    test('na edição de uma demanda do exemplo as anotações também aparecem em linha', async ({ page }) => {
      await abrir(page);
      const p = await abrirPainel(page, 'Manifestação em procedimento do Ministério Público');
      await p.getByRole('button', { name: /^Editar / }).click();
      const itens = dialogo(page).locator('.lista-anotacoes li');
      await expect(itens).toHaveCount(3);
      for (let i = 0; i < 3; i++) await conferirLinha(itens.nth(i));
    });

    test('a caixa de anotação do ponto continua em coluna: rótulo em cima e a área de texto abaixo, na largura toda', async ({ page }) => {
      await abrir(page);
      const p = await abrirPainel(page, 'operação de outubro (Norte)');
      await p.locator('details.pontos > summary').click();
      await p.locator('details.ponto-obs > summary').first().click(); // "Anotação do ponto": a caixa fica dentro dele
      const caixa = p.locator('.anotacao-caixa').first();
      await expect(caixa).toBeVisible();
      const rotulo = await caixa.locator('.rotulo-anotacao').boundingBox();
      const area = await caixa.locator('textarea').boundingBox();
      const todo = await caixa.boundingBox();
      expect(area.y).toBeGreaterThanOrEqual(rotulo.y + rotulo.height - 1); // a área vem abaixo do rótulo
      expect(area.width).toBeGreaterThan(todo.width * 0.9); // e ocupa a largura da caixa
      await expect(painel(page)).toBeVisible();
    });
  });
}
