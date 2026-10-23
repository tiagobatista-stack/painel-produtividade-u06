// Vistoria programada e programação da operação no calendário (RF50 e RF40). A vistoria realizada fica só no formulário e no painel.
import { test, expect, abrir, abrirPainel, irParaAba, painel } from './apoio.mjs';

const secao = (page) => page.locator('section[aria-labelledby="titulo-calendario"]');
const dia = (page, texto) => secao(page).getByRole('button', { name: new RegExp(texto) });
const detalhe = (page) => page.locator('#calendario-detalhe');
const dialogo = (page, nome) => page.getByRole('dialog', { name: nome });
const campo = (page, rotulo, nome) => dialogo(page, nome).getByLabel(rotulo, { exact: true });
const TITULO = 'Vistoria fictícia no calendário';

test.describe('vistoria programada no calendário', () => {
  test('a vistoria programada do exemplo (20/10) aparece na agenda dos 7 dias e no calendário, e o link leva à demanda', async ({ page }) => {
    await abrir(page);
    await expect(page.locator('#agenda-7-dias')).toContainText('Vistoria: Análise de denúncia sobre supressão vegetal');
    await irParaAba(page, 'Agenda');
    await expect(dia(page, '^terça-feira, 20 de outubro de 2026: 3 compromissos$')).toBeVisible(); // reunião, prazo do processo e a vistoria
    await dia(page, '^terça-feira, 20 de outubro de 2026').click();
    await expect(detalhe(page)).toContainText('Vistoria programada');
    await detalhe(page).getByRole('button', { name: /Vistoria: Análise de denúncia/ }).click();
    await expect(page.locator('#fila .demanda', { hasText: 'Análise de denúncia sobre supressão vegetal' })).toBeFocused();
  });

  test('a vistoria já realizada (vistoriada em 10/10) não polui o calendário', async ({ page }) => {
    await abrir(page);
    await irParaAba(page, 'Agenda');
    await expect(dia(page, '^sábado, 10 de outubro de 2026: nenhum compromisso$')).toBeVisible();
    await irParaAba(page, 'Demandas');
    const p = await abrirPainel(page, 'Manifestação em procedimento do Ministério Público');
    await expect(p).toContainText('Vistoria: Vistoriada em 10/10/2026');
  });

  test('cadastrar com "Vistoria programada" exige a data e coloca a vistoria no calendário; reprogramar move o evento', async ({ page }) => {
    await abrir(page);
    await page.getByRole('button', { name: 'Nova demanda' }).click();
    await campo(page, 'Tipo', 'Nova demanda').selectOption({ label: 'Outra' });
    await campo(page, 'Título', 'Nova demanda').fill(TITULO);
    await campo(page, 'Prazo', 'Nova demanda').fill('2026-10-30');
    await campo(page, 'Situação da vistoria', 'Nova demanda').selectOption({ label: 'Vistoria programada' });
    await dialogo(page, 'Nova demanda').getByRole('button', { name: 'Salvar' }).click();
    await expect(dialogo(page, 'Nova demanda').locator('#e-data_vistoria')).toHaveText('Informe a data da vistoria programada.');
    await campo(page, 'Data da vistoria', 'Nova demanda').fill('2026-10-21');
    await dialogo(page, 'Nova demanda').getByRole('button', { name: 'Salvar' }).click();
    await expect(dialogo(page, 'Nova demanda')).toBeHidden();

    await irParaAba(page, 'Agenda');
    await expect(dia(page, '^quarta-feira, 21 de outubro de 2026: 1 compromisso$')).toBeVisible();
    await irParaAba(page, 'Demandas');
    const p = await abrirPainel(page, TITULO);
    await expect(p).toContainText('Vistoria: Vistoria programada para 21/10/2026');
    await p.getByRole('button', { name: /^Editar / }).click();
    await campo(page, 'Data da vistoria', 'Editar demanda').fill('2026-10-23');
    await dialogo(page, 'Editar demanda').getByRole('button', { name: 'Salvar' }).click();
    await expect(dialogo(page, 'Editar demanda')).toBeHidden();
    await p.getByText(/^Histórico \(/).click();
    await expect(p.getByText('Vistoria reprogramada: 21/10/2026 → 23/10/2026')).toBeVisible();
    await page.keyboard.press('Escape');
    await irParaAba(page, 'Agenda');
    await expect(dia(page, '^quarta-feira, 21 de outubro de 2026: nenhum compromisso$')).toBeVisible();
    await expect(dia(page, '^sexta-feira, 23 de outubro de 2026: 1 compromisso$')).toBeVisible();
  });
});

test.describe('saída e retorno da operação editáveis', () => {
  test('o formulário da operação traz saída e retorno; mudar as datas muda o calendário e registra no histórico', async ({ page }) => {
    await abrir(page);
    const p = await abrirPainel(page, 'operação de outubro (Norte)');
    await p.getByRole('button', { name: /^Editar / }).click();
    await expect(campo(page, 'Saída', 'Editar demanda')).toHaveValue('2026-10-03');
    await expect(campo(page, 'Retorno', 'Editar demanda')).toHaveValue('2026-10-07');
    await campo(page, 'Saída', 'Editar demanda').fill('2026-10-05');
    await campo(page, 'Retorno', 'Editar demanda').fill('2026-10-09');
    await dialogo(page, 'Editar demanda').getByRole('button', { name: 'Salvar' }).click();
    await expect(dialogo(page, 'Editar demanda')).toBeHidden();
    await p.getByText(/^Histórico \(/).click();
    await expect(p.getByText('Programação alterada: saída 03/10/2026 → 05/10/2026, retorno 07/10/2026 → 09/10/2026')).toBeVisible();
    await page.keyboard.press('Escape');

    await irParaAba(page, 'Agenda');
    await expect(dia(page, '^sábado, 3 de outubro de 2026: nenhum compromisso$')).toBeVisible(); // saiu da programação
    await expect(dia(page, '^segunda-feira, 5 de outubro de 2026: 1 compromisso, operação Equipe Fictícia Norte$')).toBeVisible(); // nova saída
    await expect(dia(page, '^sexta-feira, 9 de outubro de 2026: 1 compromisso, operação Equipe Fictícia Norte$')).toBeVisible(); // novo retorno
    await expect(dia(page, '^segunda-feira, 19 de outubro de 2026: 1 compromisso$')).toBeVisible(); // prazo dos relatórios: retorno + 10
    await expect(dia(page, '^sábado, 17 de outubro de 2026: nenhum compromisso$')).toBeVisible(); // o prazo antigo
  });

  test('retorno antes da saída é recusado, com a mensagem ao lado do campo', async ({ page }) => {
    await abrir(page);
    const p = await abrirPainel(page, 'operação de outubro (Norte)');
    await p.getByRole('button', { name: /^Editar / }).click();
    await campo(page, 'Retorno', 'Editar demanda').fill('2026-10-02');
    await dialogo(page, 'Editar demanda').getByRole('button', { name: 'Salvar' }).click();
    await expect(dialogo(page, 'Editar demanda').locator('#e-retorno')).toHaveText('O retorno não pode ser antes da saída.');
    await expect(dialogo(page, 'Editar demanda')).toBeVisible();
  });

  test('as outras demandas não mostram os campos de saída e retorno', async ({ page }) => {
    await abrir(page);
    await page.getByRole('button', { name: 'Nova demanda' }).click();
    await expect(campo(page, 'Saída', 'Nova demanda')).toBeHidden();
    await expect(campo(page, 'Retorno', 'Nova demanda')).toBeHidden();
  });
});
