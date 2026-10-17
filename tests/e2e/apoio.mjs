// Apoio aos testes e2e: fixture que falha o teste diante de erro de console ou violação da política de conteúdo.
import { test as base, expect } from '@playwright/test';

export const test = base.extend({
  page: async ({ page }, use) => {
    const problemas = [];
    page.on('console', (m) => { if (m.type() === 'error') problemas.push(`console: ${m.text()}`); });
    page.on('pageerror', (e) => problemas.push(`erro de página: ${e.message}`));
    await page.addInitScript(() => {
      window.__violacoes = [];
      document.addEventListener('securitypolicyviolation', (e) => window.__violacoes.push(`${e.violatedDirective} ${e.blockedURI}`));
    });
    await use(page);
    const violacoes = await page.evaluate(() => window.__violacoes ?? []).catch(() => []);
    expect(problemas, 'erros de console ou de página').toEqual([]);
    expect(violacoes, 'violações da política de conteúdo (CSP)').toEqual([]);
  },
});

export { expect };

// Abre o painel com o exemplo fictício e a data de referência do exemplo (2026-10-15).
export async function abrir(page) {
  await page.goto('/');
  await usarDataDoExemplo(page);
}

export async function usarDataDoExemplo(page) {
  const botao = page.getByRole('button', { name: /Usar data do exemplo/ });
  // O botão existe no HTML antes de o app carregar o seed. O texto ganha a data do exemplo no mesmo instante em que o clique
  // é ligado; clicar antes disso não faz nada e deixaria a tela com a data de hoje.
  await expect(botao).toHaveText(/\(15\/10\/2026\)/);
  await botao.click();
  await expect(page.locator('#indicadores .indicador-valor')).toHaveCount(7);
}

export const indicadores = (page) => page.locator('#indicadores .indicador-valor').allTextContents();
export const resumo = (page) => page.locator('#resumo-semana .indicador-valor').allTextContents();
export const cartao = (page, trecho) => page.locator('#fila > li', { hasText: trecho });
export const filtros = (page) => page.getByRole('search', { name: 'Buscar e filtrar demandas' });

// Cadastra uma demanda do tipo processo pelo formulário.
export async function cadastrarProcesso(page, { titulo, origem = 'Ministério Público', processo = 'SEMA-PRO-FICT-0999', prazo = '2026-10-14' }) {
  await page.getByRole('button', { name: 'Nova demanda' }).click();
  const dialogo = page.getByRole('dialog', { name: 'Nova demanda' });
  await dialogo.getByLabel('Título').fill(titulo);
  await dialogo.getByLabel('Origem').selectOption({ label: origem });
  await dialogo.getByLabel('Protocolo/referência').fill(processo);
  await dialogo.getByLabel('Prazo', { exact: true }).fill(prazo);
  await dialogo.getByRole('button', { name: 'Salvar' }).click();
  await expect(dialogo).toBeHidden();
}

// Importa a planilha de exemplo (13 pontos) e confirma.
export async function importarExemplo(page) {
  await page.getByRole('button', { name: 'Importar operação' }).click();
  const dialogo = page.getByRole('dialog', { name: 'Importar operação' });
  await dialogo.getByRole('button', { name: 'Usar planilha de exemplo' }).click();
  await expect(dialogo.locator('#imp-previa')).toContainText('Planilha válida');
  await dialogo.getByRole('button', { name: 'Importar', exact: true }).click();
  await expect(dialogo).toBeHidden();
}
