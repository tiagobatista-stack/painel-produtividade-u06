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
  await expect(page.locator('#indicadores .indicador-valor')).toHaveCount(4);
}

// Os 4 indicadores em destaque, na ordem da tela: vencidas, próximos 7 dias, sobrestados, concluídas na semana.
export const indicadores = (page) => page.locator('#indicadores .indicador-valor').allTextContents();
// Os da aba Relatórios: abertas, relatórios pendentes, autos a lavrar.
export const complementares = (page) => page.locator('#indicadores-relatorio .indicador-valor').allTextContents();
export const resumo = (page) => page.locator('#resumo-semana .indicador-valor').allTextContents();
export const cartao = (page, trecho) => page.locator('#fila > li', { hasText: trecho });
export const painel = (page) => page.locator('#painel-demanda');

// Vai para uma aba pelo link (o endereço muda para #quadro, #agenda, #afastamentos ou #relatorios).
export async function irParaAba(page, nome) {
  await page.getByRole('navigation', { name: 'Seções do painel' }).getByRole('link', { name: nome, exact: true }).click();
  await expect(page.getByRole('navigation', { name: 'Seções do painel' }).getByRole('link', { name: nome, exact: true })).toHaveAttribute('aria-current', 'page');
}

// Abre o painel lateral da demanda cujo card contém o trecho e devolve o painel.
export async function abrirPainel(page, trecho) {
  await cartao(page, trecho).getByRole('button').click();
  await expect(painel(page)).toBeVisible();
  return painel(page);
}

// Fecha o painel lateral com Esc.
export async function fecharPainel(page) {
  await page.keyboard.press('Escape');
  await expect(painel(page)).toBeHidden();
}

// Abre o menu "Exportar" da aba Relatórios.
export async function abrirMenuExportar(page) {
  await irParaAba(page, 'Relatórios');
  await page.getByText('Exportar', { exact: true }).click();
  await expect(page.getByRole('button', { name: 'Exportar demandas (CSV)' })).toBeVisible();
}

export const filtros = (page) => page.getByRole('search', { name: 'Buscar e filtrar demandas' });

// Cadastra uma demanda do tipo processo pelo formulário.
export async function cadastrarProcesso(page, { titulo, origem = 'Ministério Público', processo = 'SEMA-PRO-FICT-0999', prazo = '2026-10-14' }) {
  await page.getByRole('button', { name: 'Nova demanda' }).click();
  const dialogo = page.getByRole('dialog', { name: 'Nova demanda' });
  await dialogo.getByLabel('Título').fill(titulo);
  await dialogo.getByLabel('Origem').selectOption({ label: origem });
  await dialogo.getByLabel('Nº do processo (fictício)').fill(processo);
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
