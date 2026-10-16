// Importação com coordenadas em graus, minutos e segundos. Todos os valores abaixo são inventados.
import { test, expect, abrir } from './apoio.mjs';

const CAB = 'N_PONTO\tEQUIPE\tCOORD_X\tCOORD_Y\tMUNICIPIO\tDAT_SAIDA\tDAT_RETOR\tNOT_PLANEJ';
const linha = (n, x, y) => [n, 'Equipe Fictícia Oeste', x, y, 'Município Fictício D', '16/11/2026', '20/11/2026', 'Teste'].join('\t');

async function colar(page, texto) {
  await page.getByRole('button', { name: 'Importar operação' }).click();
  const d = page.getByRole('dialog', { name: 'Importar operação' });
  await d.getByLabel('Linhas da planilha').fill(texto);
  return d;
}

test.describe('planilha com coordenadas em graus, minutos e segundos', () => {
  test('aceita o formato e guarda as coordenadas em decimal (sul e oeste negativos)', async ({ page }) => {
    await abrir(page);
    const d = await colar(page, [CAB, linha(1, `20° 30' 15,500" W`, `15° 10' 20,250" S`), linha(2, `20° 31' 00,000" O`, `15° 11' 00,000" S`)].join('\n'));
    await expect(d.locator('#imp-previa')).toContainText('Planilha válida');
    await expect(d.locator('#imp-previa')).toContainText('2 pontos');
    await d.getByRole('button', { name: 'Importar', exact: true }).click();
    await expect(d).toBeHidden();

    const op = await page.evaluate(() => JSON.parse(localStorage.getItem('painel-demandas:v1')).demandas.find((x) => x.equipe === 'Equipe Fictícia Oeste'));
    expect(op.pontos[0].coord_x).toBeCloseTo(-(20 + 30 / 60 + 15.5 / 3600), 6);
    expect(op.pontos[0].coord_y).toBeCloseTo(-(15 + 10 / 60 + 20.25 / 3600), 6);
    expect(op.pontos[1].coord_x).toBeCloseTo(-(20 + 31 / 60), 6); // O = oeste
  });

  test('a decimal continua valendo e pode vir misturada na mesma planilha', async ({ page }) => {
    await abrir(page);
    const d = await colar(page, [CAB, linha(1, '-20,5', '-15,25'), linha(2, `20° 30' 00" W`, `15° 15' 00" S`)].join('\n'));
    await expect(d.locator('#imp-previa')).toContainText('Planilha válida');
  });

  test('valor impossível é recusado, com a linha e o campo, sem repetir o valor digitado', async ({ page }) => {
    await abrir(page);
    const d = await colar(page, [CAB, linha(1, `20° 30' 15" W`, `15° 10' 20" S`), linha(2, `20° 61' 00" W`, `15° 10' 20" S`)].join('\n'));
    const previa = d.locator('#imp-previa');
    await expect(previa).toContainText('Linha 3, COORD_X: COORD_X não é um número nem graus, minutos e segundos');
    await expect(previa).not.toContainText('61');
    await expect(d.getByRole('button', { name: 'Importar', exact: true })).toBeDisabled();
  });

  test('colunas trocadas (N ou S na longitude) são apontadas', async ({ page }) => {
    await abrir(page);
    const d = await colar(page, [CAB, linha(1, `15° 10' 20" S`, `20° 30' 15" W`)].join('\n'));
    await expect(d.locator('#imp-previa')).toContainText('COORD_X');
    await expect(d.locator('#imp-previa')).toContainText('COORD_Y');
  });
});
