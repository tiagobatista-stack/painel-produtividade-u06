import { test, expect } from './apoio.mjs';

const IDEIA = 'Quadro com quatro colunas e selo de prioridade em cada card.'; // N-0004, etapa Idear

const abrirKanban = async (page, hash = '') => {
  await page.goto(`/kanban.html${hash}`);
  const botao = page.getByRole('button', { name: /Usar data do exemplo/ });
  await expect(botao).toHaveText(/\(15\/10\/2026\)/);
  await botao.click();
  await expect(page.locator('#data-referencia')).toHaveValue('2026-10-15');
};
const abas = (page) => page.getByRole('navigation', { name: 'Seções do Kanban' });
const irParaDT = async (page) => {
  await abas(page).getByRole('link', { name: 'Design Thinking', exact: true }).click();
  await expect(abas(page).getByRole('link', { name: 'Design Thinking', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('#dt-grade')).toBeVisible();
};
const etapa = (page, nome) => page.locator(`.dtcol[data-etapa="${nome}"]`);
const nota = (page, trecho) => page.locator('.nota-dt', { hasText: trecho });
const formNota = (page) => page.locator('#form-nota');
const guardado = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('kanban-dt:v1')));
const toast = (page) => page.locator('#mensagem');

test.describe('Design Thinking no Kanban', () => {
  test('a aba abre pelo endereço e mostra as 5 etapas com as notas do exemplo', async ({ page }) => {
    await abrirKanban(page, '#design-thinking');
    await expect(abas(page).getByRole('link', { name: 'Design Thinking', exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('#aba-quadro')).toBeHidden();
    await expect(page.locator('.dtcol .kcol-titulo')).toHaveText([/^Empatizar/, /^Definir/, /^Idear/, /^Prototipar/, /^Testar/]);
    await expect(page.locator('.dtcol .kcol-contagem')).toHaveText(['2', '1', '2', '1', '0']);
    await expect(etapa(page, 'testar')).toContainText('Nenhuma nota');
  });

  test('o endereço desconhecido cai no Quadro; as duas abas se alternam', async ({ page }) => {
    await abrirKanban(page, '#nao-existe');
    await expect(page.locator('#aba-quadro')).toBeVisible();
    await irParaDT(page);
    await expect(page).toHaveURL(/#design-thinking$/);
    await abas(page).getByRole('link', { name: 'Quadro', exact: true }).click();
    await expect(page.locator('#aba-quadro')).toBeVisible();
    await expect(page.locator('#aba-design-thinking')).toBeHidden();
  });

  test('adicionar nota: valida, salva na etapa escolhida e persiste', async ({ page }) => {
    await abrirKanban(page);
    await irParaDT(page);
    const f = formNota(page);
    await f.getByRole('button', { name: 'Adicionar nota' }).click();
    await expect(f.getByRole('alert')).toContainText('Escreva a nota.');
    await expect(f.getByLabel('Nota')).toBeFocused();

    await f.getByLabel('Etapa').selectOption({ label: 'Testar' });
    await f.getByLabel('Nota').fill('Testar o protótipo com duas pessoas da equipe.');
    await f.getByRole('button', { name: 'Adicionar nota' }).click();
    await expect(etapa(page, 'testar').locator('.nota-dt')).toHaveCount(1);
    await expect(etapa(page, 'testar').locator('.kcol-contagem')).toHaveText('1');
    await expect(toast(page)).toContainText('Nota adicionada.');
    await expect(f.getByLabel('Etapa')).toHaveValue('testar'); // fica na mesma etapa para anotar em sequência
    await expect(f.getByLabel('Nota')).toHaveValue('');

    await page.reload();
    await expect(page.locator('#dt-grade')).toBeVisible();
    await abas(page).getByRole('link', { name: 'Design Thinking', exact: true }).click();
    await expect(nota(page, 'Testar o protótipo com duas pessoas')).toHaveCount(1);
    expect((await guardado(page)).notas.map((n) => n.id)).toContain('N-0007');
  });

  test('editar uma nota troca a etapa e o texto', async ({ page }) => {
    await abrirKanban(page);
    await irParaDT(page);
    await nota(page, 'Aviso visual para prazos atrasados.').getByRole('button', { name: /^Editar/ }).click();
    const f = formNota(page);
    await expect(f.getByLabel('Nota')).toHaveValue('Aviso visual para prazos atrasados.');
    await expect(f.getByRole('button', { name: 'Cancelar edição' })).toBeVisible();
    await f.getByLabel('Etapa').selectOption({ label: 'Prototipar' });
    await f.getByLabel('Nota').fill('Aviso visual para prazos atrasados, em vermelho e com texto.');
    await f.getByRole('button', { name: 'Salvar nota' }).click();
    await expect(etapa(page, 'prototipar').locator('.nota-dt', { hasText: 'em vermelho e com texto' })).toHaveCount(1);
    await expect(etapa(page, 'idear').locator('.nota-dt')).toHaveCount(1);
    await expect(f.getByRole('button', { name: 'Adicionar nota' })).toBeVisible();

    await nota(page, 'Protótipo de papel').getByRole('button', { name: /^Editar/ }).click();
    await f.getByRole('button', { name: 'Cancelar edição' }).click();
    await expect(f.getByLabel('Nota')).toHaveValue('');
  });

  test('excluir nota com Desfazer, sem caixa de confirmação', async ({ page }) => {
    await abrirKanban(page);
    await irParaDT(page);
    page.on('dialog', () => { throw new Error('não deveria abrir caixa de confirmação'); });
    await nota(page, 'Como deixar visível o estado').getByRole('button', { name: /^Excluir/ }).click();
    await expect(etapa(page, 'definir').locator('.nota-dt')).toHaveCount(0);
    await expect(toast(page)).toContainText('Nota excluída.');
    await toast(page).getByRole('button', { name: 'Desfazer' }).click();
    await expect(etapa(page, 'definir').locator('.nota-dt')).toHaveCount(1);
    await expect(toast(page)).toContainText('Nota restaurada.');
  });

  test('promover uma ideia cria o card no Backlog, abre o Quadro nele e a ideia passa a "Ver card"', async ({ page }) => {
    await abrirKanban(page);
    await irParaDT(page);
    await expect(etapa(page, 'definir').getByRole('button', { name: /Promover/ })).toHaveCount(0); // só a etapa Idear promove
    await expect(etapa(page, 'idear').getByRole('button', { name: /^Promover/ })).toHaveCount(2);

    await nota(page, IDEIA).getByRole('button', { name: /^Promover/ }).click();
    await expect(page.locator('#aba-quadro')).toBeVisible();
    await expect(page).toHaveURL(/#quadro$/);
    const novo = page.locator('.kcol[data-coluna="backlog"] .kcard', { hasText: IDEIA });
    await expect(novo).toHaveCount(1);
    await expect(novo.locator('.kcard-id')).toHaveText('K-0009');
    await expect(novo.locator('.selo')).toHaveText('Média');
    await expect(novo.locator('.kcard-desc')).toHaveText(IDEIA);
    await expect(novo).toBeFocused();
    await expect(toast(page)).toContainText('card K-0009 criado no Backlog');
    const dados = await guardado(page);
    expect(dados.cards.at(-1)).toMatchObject({ id: 'K-0009', status: 'backlog', prioridade: 'media', descricao: IDEIA });
    expect(dados.notas.find((n) => n.id === 'N-0004').card_id).toBe('K-0009');

    await irParaDT(page);
    await expect(nota(page, IDEIA).getByRole('button', { name: /^Promover/ })).toHaveCount(0); // não promove duas vezes
    await nota(page, IDEIA).getByRole('button', { name: /^Ver card K-0009/ }).click();
    await expect(page.locator('#aba-quadro')).toBeVisible();
    await expect(page.locator('.kcard.destaque')).toHaveCount(1);
  });

  test('promover limpa os filtros do Quadro se eles escondem o card novo', async ({ page }) => {
    await abrirKanban(page);
    await page.getByRole('search', { name: 'Buscar e filtrar cards' }).getByLabel('Status').selectOption({ label: 'Concluído' });
    await irParaDT(page);
    await nota(page, 'Aviso visual para prazos atrasados.').getByRole('button', { name: /^Promover/ }).click();
    await expect(page.locator('.kcard', { hasText: 'Aviso visual para prazos atrasados.' })).toHaveCount(1);
    await expect(page.getByRole('search', { name: 'Buscar e filtrar cards' }).getByLabel('Status')).toHaveValue('');
  });

  test('se o card promovido for excluído, a ideia pode ser promovida de novo', async ({ page }) => {
    await abrirKanban(page);
    await irParaDT(page);
    await nota(page, IDEIA).getByRole('button', { name: /^Promover/ }).click();
    await page.locator('.kcard', { hasText: IDEIA }).locator('.kcard-abrir').click();
    await page.getByRole('button', { name: 'Excluir', exact: true }).click();
    await expect(page.locator('.kcard', { hasText: IDEIA })).toHaveCount(0);
    await irParaDT(page);
    await expect(nota(page, IDEIA).getByRole('button', { name: /^Promover/ })).toHaveCount(1);
  });

  test('a aba cabe em 360 px', async ({ page }) => {
    await abrirKanban(page, '#design-thinking');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.locator('#dt-grade')).toBeVisible();
  });
});
