import { test, expect, usarDataDoExemplo } from './apoio.mjs';

const T_ROTEIRO = 'Redigir o roteiro de entrevistas'; // K-0004, alta, atrasado, Em andamento
const T_CRITERIOS = 'Definir os critérios de aceite do protótipo'; // K-0003, alta, Backlog
const T_PESQUISA = 'Pesquisar exemplos de quadros de acompanhamento'; // K-0002, baixa, sem prazo, Backlog

// Clica em "Usar data do exemplo" (15/10/2026) depois que a página carregou o exemplo.
const usarData = async (page) => {
  const botao = page.getByRole('button', { name: /Usar data do exemplo/ });
  await expect(botao).toHaveText(/\(15\/10\/2026\)/);
  await botao.click();
  await expect(page.locator('#data-referencia')).toHaveValue('2026-10-15');
  await expect(page.locator('.kcard').first()).toBeVisible();
};
const abrirKanban = async (page, hash = '') => {
  await page.goto(`/kanban.html${hash}`);
  await usarData(page);
};
const coluna = (page, nome) => page.locator(`.kcol[data-coluna="${nome}"]`);
const contagem = (page, nome) => coluna(page, nome).locator('.kcol-contagem');
const card = (page, trecho) => page.locator('.kcard', { hasText: trecho });
const filtros = (page) => page.getByRole('search', { name: 'Buscar e filtrar cards' });
const guardados = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('kanban-dt:v1')).cards);
const toast = (page) => page.locator('#mensagem');
const titulos = (page, nome) => coluna(page, nome).locator('.kcard-titulo').allTextContents();

test.describe('Kanban de projetos: quadro, cards e filtros', () => {
  test('quatro colunas com contagem do exemplo (3, 2, 2 e 1)', async ({ page }) => {
    await abrirKanban(page);
    await expect(page.getByRole('heading', { level: 1, name: 'Kanban de projetos' })).toBeVisible();
    await expect(page.locator('#kanban-grade .kcol-titulo')).toHaveText([/^Backlog/, /^Em andamento/, /^Em revisão/, /^Concluído/]);
    await expect(page.locator('#kanban-grade .kcol-contagem')).toHaveText(['3', '2', '2', '1']);
    await expect(page.locator('#contagem')).toHaveText('8 cards');
    await expect(page.getByText('Exemplo didático com dados fictícios.')).toBeVisible();
  });

  test('o card mostra título, descrição, prioridade e prazo; atrasado e concluído se distinguem', async ({ page }) => {
    await abrirKanban(page);
    const c = card(page, T_ROTEIRO);
    await expect(c.locator('.kcard-id')).toHaveText('K-0004');
    await expect(c.locator('.selo')).toHaveText('Alta');
    await expect(c.locator('.kcard-titulo')).toHaveText(T_ROTEIRO);
    await expect(c.locator('.kcard-desc')).toHaveText('Cinco perguntas abertas para a rodada de escuta.');
    await expect(c.locator('.kcard-prazo')).toHaveText('13/10/2026 · atrasado há 2 dias');
    await expect(c).toHaveClass(/atrasado/);
    await expect(card(page, T_PESQUISA).locator('.kcard-prazo')).toHaveText('Sem prazo');
    const concluido = card(page, 'Reunir a equipe');
    await expect(concluido.locator('.kcard-prazo')).toHaveText('Prazo: 10/10/2026'); // concluído não conta como atrasado
    await expect(concluido).not.toHaveClass(/atrasado/);
    await expect(page.locator('.kcard.atrasado')).toHaveCount(1);
  });

  test('dentro da coluna, a ordem é prioridade, prazo e criação', async ({ page }) => {
    await abrirKanban(page);
    expect(await titulos(page, 'backlog')).toEqual([T_CRITERIOS, 'Mapear a rotina de atendimento da equipe', T_PESQUISA]);
    expect(await titulos(page, 'revisao')).toEqual(['Revisar os textos da interface', 'Conferir a acessibilidade das cores']);
  });

  test('novo card: valida os campos, salva no Backlog, destaca o foco e persiste ao recarregar', async ({ page }) => {
    await abrirKanban(page);
    await page.getByRole('button', { name: 'Novo card' }).click();
    const d = page.getByRole('dialog', { name: 'Novo card' });
    await expect(d.getByLabel('Status')).toHaveValue('backlog');
    await d.getByRole('button', { name: 'Salvar' }).click();
    await expect(d.getByRole('alert')).toContainText('Informe o título.');
    await expect(d.getByLabel('Título')).toHaveAttribute('aria-invalid', 'true');
    await expect(d.getByLabel('Título')).toBeFocused();

    await d.getByLabel('Título').fill('Preparar a demonstração final');
    await d.getByLabel('Descrição').fill('Roteiro de cinco minutos com dados fictícios.');
    await d.getByLabel('Prioridade').selectOption({ label: 'Alta' });
    await d.getByLabel('Prazo (opcional)').fill('2026-10-21');
    await d.getByRole('button', { name: 'Salvar' }).click();
    await expect(d).toBeHidden();

    const novo = coluna(page, 'backlog').locator('.kcard', { hasText: 'Preparar a demonstração final' });
    await expect(novo.locator('.kcard-id')).toHaveText('K-0009');
    await expect(novo.locator('.selo')).toHaveText('Alta');
    await expect(novo.locator('.kcard-prazo')).toHaveText('21/10/2026 · em 6 dias');
    await expect(novo.locator('.kcard-abrir')).toBeFocused();
    await expect(contagem(page, 'backlog')).toHaveText('4');

    await page.reload();
    await usarData(page);
    await expect(card(page, 'Preparar a demonstração final')).toHaveCount(1);
    expect((await guardados(page)).map((c) => c.id)).toContain('K-0009');
  });

  test('validação: título longo, descrição longa e prazo inválido', async ({ page }) => {
    await abrirKanban(page);
    await page.getByRole('button', { name: 'Novo card' }).click();
    const d = page.getByRole('dialog', { name: 'Novo card' });
    await d.getByLabel('Título').evaluate((el) => { el.removeAttribute('maxlength'); });
    await d.getByLabel('Título').fill('x'.repeat(121));
    await d.getByRole('button', { name: 'Salvar' }).click();
    await expect(d.getByRole('alert')).toContainText('Use no máximo 120 caracteres.');
    await d.getByLabel('Título').fill('Título curto');
    await d.getByRole('button', { name: 'Salvar' }).click();
    await expect(d).toBeHidden();
    await expect(card(page, 'Título curto').locator('.kcard-prazo')).toHaveText('Sem prazo');
  });

  test('editar: título, prioridade, prazo e status; o histórico registra a troca de status', async ({ page }) => {
    await abrirKanban(page);
    await card(page, T_CRITERIOS).locator('.kcard-abrir').click();
    const d = page.getByRole('dialog', { name: 'Editar K-0003' });
    await expect(d.getByLabel('Título')).toHaveValue(T_CRITERIOS);
    await expect(d.getByLabel('Prioridade')).toHaveValue('alta');
    await expect(d.getByLabel('Prazo (opcional)')).toHaveValue('2026-10-20');
    await d.getByLabel('Título').fill('Definir os critérios de aceite final');
    await d.getByLabel('Prioridade').selectOption({ label: 'Baixa' });
    await d.getByLabel('Prazo (opcional)').fill('');
    await d.getByLabel('Status').selectOption({ label: 'Em revisão' });
    await d.getByRole('button', { name: 'Salvar' }).click();
    await expect(d).toBeHidden();

    const editado = coluna(page, 'revisao').locator('.kcard', { hasText: 'critérios de aceite final' });
    await expect(editado.locator('.selo')).toHaveText('Baixa');
    await expect(editado.locator('.kcard-prazo')).toHaveText('Sem prazo');
    await expect(contagem(page, 'backlog')).toHaveText('2');
    await expect(contagem(page, 'revisao')).toHaveText('3');
    await editado.locator('.kcard-abrir').click();
    await page.getByText(/^Histórico \(\d+\)/).click();
    await expect(page.getByRole('dialog', { name: 'Editar K-0003' })).toContainText('Status: Backlog → Em revisão');
    await page.keyboard.press('Escape');
    await expect(editado.locator('.kcard-abrir')).toBeFocused();
  });

  test('mover pelos botões, também com o teclado, grava o histórico e persiste', async ({ page }) => {
    await abrirKanban(page);
    const avancar = card(page, T_CRITERIOS).getByRole('button', { name: `Mover "${T_CRITERIOS}" para Em andamento` });
    await avancar.focus();
    await page.keyboard.press('Enter');
    await expect(contagem(page, 'backlog')).toHaveText('2');
    await expect(contagem(page, 'andamento')).toHaveText('3');
    await expect(page.locator('#quadro-anuncio')).toHaveText('K-0003 movido para Em andamento.');
    await expect(card(page, T_CRITERIOS).locator('.kcard-abrir')).toBeFocused();

    const movido = card(page, T_CRITERIOS);
    await expect(movido.getByRole('button', { name: /para Backlog$/ })).toBeVisible();
    await movido.getByRole('button', { name: /para Em revisão$/ }).click();
    await expect(coluna(page, 'revisao').locator('.kcard', { hasText: T_CRITERIOS })).toHaveCount(1);
    await expect(card(page, 'Reunir a equipe').getByRole('button')).toHaveCount(2); // abrir + voltar; o último status não tem "avançar"
    await page.reload();
    await usarData(page);
    await expect(coluna(page, 'revisao').locator('.kcard', { hasText: T_CRITERIOS })).toHaveCount(1);
    const guardado = (await guardados(page)).find((c) => c.id === 'K-0003');
    expect(guardado.status).toBe('revisao');
    expect(guardado.historico.map((h) => h.evento)).toEqual(['Criado', 'Status: Backlog → Em andamento', 'Status: Em andamento → Em revisão']);
  });

  test('arrastar um card para outra coluna', async ({ page, isMobile }) => {
    test.skip(isMobile, 'o arrastar nativo é do desktop; no celular valem os botões');
    await abrirKanban(page);
    await card(page, T_PESQUISA).dragTo(coluna(page, 'andamento').locator('.kcol-lista'));
    await expect(coluna(page, 'andamento').locator('.kcard', { hasText: T_PESQUISA })).toHaveCount(1);
    await expect(contagem(page, 'backlog')).toHaveText('2');
    await expect(page.locator('#quadro-anuncio')).toHaveText('K-0002 movido para Em andamento.');
    expect((await guardados(page)).find((c) => c.id === 'K-0002').status).toBe('andamento');
  });

  test('filtros: prioridade, prazo, status e busca, com contagem e "Limpar filtros"', async ({ page }) => {
    await abrirKanban(page);
    const f = filtros(page);
    const visiveis = () => page.locator('.kcard').count();
    await expect(f.getByRole('button', { name: 'Limpar filtros' })).toBeDisabled();

    await f.getByLabel('Prioridade').selectOption({ label: 'Alta' });
    await expect(page.locator('#contagem')).toHaveText('2 de 8 cards');
    expect(await visiveis()).toBe(2);
    await expect(f.getByRole('button', { name: 'Limpar filtros' })).toBeEnabled();

    await f.getByLabel('Prioridade').selectOption({ label: 'Todas' });
    await f.getByLabel('Prazo').selectOption({ label: 'Atrasados' });
    await expect(page.locator('.kcard')).toHaveCount(1);
    await expect(card(page, T_ROTEIRO)).toHaveCount(1);
    await f.getByLabel('Prazo').selectOption({ label: 'Próximos 7 dias' });
    await expect(page.locator('.kcard')).toHaveCount(3);
    await f.getByLabel('Prazo').selectOption({ label: 'Sem prazo' });
    await expect(card(page, T_PESQUISA)).toHaveCount(1);
    await expect(page.locator('.kcard')).toHaveCount(1);

    await f.getByLabel('Prazo').selectOption({ label: 'Todos' });
    await f.getByLabel('Status').selectOption({ label: 'Em revisão' });
    await expect(page.locator('.kcard')).toHaveCount(2);
    await expect(contagem(page, 'backlog')).toHaveText('0');
    await expect(coluna(page, 'backlog')).toContainText('Nenhum card');

    await f.getByLabel('Status').selectOption({ label: 'Todos' });
    await f.getByLabel('Buscar').fill('PROTOTIPO'); // sem acento nem caixa; olha título e descrição
    await expect(page.locator('.kcard')).toHaveCount(2);
    await f.getByLabel('Buscar').fill('k-0007');
    await expect(page.locator('.kcard')).toHaveCount(1);
    await f.getByLabel('Buscar').fill('nada disso existe');
    await expect(page.locator('#quadro-vazio')).toBeVisible();

    await f.getByRole('button', { name: 'Limpar filtros' }).click();
    await expect(page.locator('.kcard')).toHaveCount(8);
    await expect(page.locator('#quadro-vazio')).toBeHidden();
    await expect(f.getByLabel('Buscar')).toBeFocused();
    await expect(f.getByRole('button', { name: 'Limpar filtros' })).toBeDisabled();
  });

  test('filtros combinados e card novo escondido por filtro: os filtros são limpos para mostrá-lo', async ({ page }) => {
    await abrirKanban(page);
    const f = filtros(page);
    await f.getByLabel('Prioridade').selectOption({ label: 'Alta' });
    await f.getByLabel('Status').selectOption({ label: 'Em andamento' });
    await expect(page.locator('.kcard')).toHaveCount(1);

    await page.getByRole('button', { name: 'Novo card' }).click();
    const d = page.getByRole('dialog', { name: 'Novo card' });
    await d.getByLabel('Título').fill('Card escondido pelo filtro');
    await d.getByLabel('Prioridade').selectOption({ label: 'Baixa' });
    await d.getByRole('button', { name: 'Salvar' }).click();
    await expect(toast(page)).toContainText('Os filtros foram limpos para mostrar o novo card.');
    await expect(card(page, 'Card escondido pelo filtro')).toHaveCount(1);
    await expect(page.locator('.kcard')).toHaveCount(9);
  });

  test('excluir sem confirmação, com Desfazer; a exclusão persiste', async ({ page }) => {
    await abrirKanban(page);
    await card(page, T_PESQUISA).locator('.kcard-abrir').click();
    page.on('dialog', () => { throw new Error('não deveria abrir caixa de confirmação'); });
    await page.getByRole('button', { name: 'Excluir', exact: true }).click();
    await expect(card(page, T_PESQUISA)).toHaveCount(0);
    await expect(toast(page)).toContainText('Card excluído.');
    await expect(contagem(page, 'backlog')).toHaveText('2');
    expect((await guardados(page)).length).toBe(7);

    await toast(page).getByRole('button', { name: 'Desfazer' }).click();
    await expect(toast(page)).toContainText('Card restaurado.');
    await expect(card(page, T_PESQUISA)).toHaveCount(1);
    expect(await titulos(page, 'backlog')).toContain(T_PESQUISA);
    expect((await guardados(page)).map((c) => c.id)).toContain('K-0002');

    await card(page, T_PESQUISA).locator('.kcard-abrir').click();
    await page.getByRole('button', { name: 'Excluir', exact: true }).click();
    await page.reload();
    await usarData(page);
    await expect(card(page, T_PESQUISA)).toHaveCount(0); // sem Desfazer, a exclusão fica valendo
  });

  test('restaurar exemplo volta aos 8 cards, com Desfazer', async ({ page }) => {
    await abrirKanban(page);
    await card(page, T_PESQUISA).locator('.kcard-abrir').click();
    await page.getByRole('button', { name: 'Excluir', exact: true }).click();
    await expect(page.locator('.kcard')).toHaveCount(7);
    await page.getByRole('button', { name: 'Restaurar exemplo' }).click();
    await expect(page.locator('.kcard')).toHaveCount(8);
    await expect(toast(page)).toContainText('Exemplo restaurado.');
    await toast(page).getByRole('button', { name: 'Desfazer' }).click();
    await expect(page.locator('.kcard')).toHaveCount(7);
  });

  test('os dados ficam em chave própria e não mexem nos dados do painel de demandas', async ({ page }) => {
    await abrirKanban(page);
    const chaves = await page.evaluate(() => Object.keys(localStorage));
    expect(chaves).toContain('kanban-dt:v1');
    expect(chaves).not.toContain('painel-demandas:v1');
    await page.goto('/');
    await usarDataDoExemplo(page);
    await expect(page.locator('#fila > li')).toHaveCount(10); // o painel segue igual
    await page.getByRole('link', { name: 'Kanban de projetos' }).click();
    await expect(page).toHaveURL(/kanban\.html$/);
    await page.getByRole('link', { name: 'Painel de demandas' }).click();
    await expect(page).toHaveURL(/\/(index\.html)?$/);
  });

  test('dados salvos inválidos voltam ao exemplo sem quebrar a página', async ({ page }) => {
    await page.goto('/kanban.html');
    await page.evaluate(() => localStorage.setItem('kanban-dt:v1', '{nao e json'));
    await page.reload();
    await usarData(page);
    await expect(page.locator('.kcard')).toHaveCount(8);
  });

  test('a página cabe em 360 px, com o quadro rolando dentro da própria área', async ({ page }) => {
    await abrirKanban(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(await page.locator('#kanban-grade').evaluate((e) => e.scrollWidth >= e.clientWidth)).toBe(true);
    await page.getByRole('button', { name: 'Novo card' }).click();
    const caixa = await page.getByRole('dialog', { name: 'Novo card' }).boundingBox();
    expect(caixa.x).toBeGreaterThanOrEqual(0);
    expect(caixa.x + caixa.width).toBeLessThanOrEqual(page.viewportSize().width);
  });
});
