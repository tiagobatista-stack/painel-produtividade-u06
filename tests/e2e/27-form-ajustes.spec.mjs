// Ajustes do formulário de demanda: anotação pendente, município com lista de MT, valor convertido da coordenada, ajuste manual igual
// à calculada e dicas legíveis. Dados fictícios; a contagem de municípios vem do próprio data/municipios-mt.json (nada de número fixo).
import { readFileSync } from 'node:fs';
import { test, expect, abrir, abrirPainel, cartao, painel, usarDataDoExemplo } from './apoio.mjs';

const lista = JSON.parse(readFileSync(new URL('../../data/municipios-mt.json', import.meta.url), 'utf8'));
const TITULO = 'Demanda dos ajustes do formulário';
const seedTotal = JSON.parse(readFileSync(new URL('../../data/seed.json', import.meta.url), 'utf8')).demandas.length;

const dialogo = (page, nome = 'Nova demanda') => page.getByRole('dialog', { name: nome });
const campo = (page, rotulo, nome = 'Nova demanda') => dialogo(page, nome).getByLabel(rotulo, { exact: true });
const anotacaoNova = (page) => campo(page, 'Anotações');
const guardada = (page, titulo = TITULO) => page.evaluate((t) => JSON.parse(localStorage.getItem('painel-demandas:v1')).demandas.find((d) => d.titulo === t), titulo);

async function abrirNova(page) {
  await abrir(page);
  await page.getByRole('button', { name: 'Nova demanda' }).click();
  await expect(dialogo(page)).toBeVisible();
}

async function basico(page, { tipo = 'Outra', titulo = TITULO, prazo = '2026-10-25' } = {}) {
  await campo(page, 'Tipo').selectOption({ label: tipo });
  await campo(page, 'Título').fill(titulo);
  await campo(page, 'Prazo').fill(prazo);
}

// Cola texto (com várias linhas) na caixa, como o usuário faria; `fill` não serve aqui: respeita o maxlength e não dispara o paste.
const colar = (campo, texto) =>
  campo.evaluate((el, t) => {
    const dt = new DataTransfer();
    dt.setData('text', t);
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  }, texto);

const salvar = (page, nome = 'Nova demanda') => dialogo(page, nome).getByRole('button', { name: 'Salvar' }).click();

test.describe('1. anotação pendente ao salvar', () => {
  test('o texto que ficou na caixa vira anotação, com aviso depois de salvar', async ({ page }) => {
    await abrirNova(page);
    await basico(page);
    await anotacaoNova(page).fill('Ligar para o interessado');
    await salvar(page);
    await expect(dialogo(page)).toBeHidden();
    await expect(page.locator('#mensagem')).toHaveText('1 anotação pendente foi adicionada.');
    await expect(cartao(page, TITULO).locator('.demanda-obs')).toHaveText('Anotações 0/1');
    const p = await abrirPainel(page, TITULO);
    await p.getByText('Anotações 0/1').click();
    await expect(p.getByRole('checkbox', { name: 'Ligar para o interessado' })).toBeVisible();
    expect((await guardada(page)).anotacoes.map((a) => a.texto)).toEqual(['Ligar para o interessado']);
  });

  test('só a que estava pendente conta no aviso; sem texto pendente não há aviso', async ({ page }) => {
    await abrirNova(page);
    await basico(page);
    await anotacaoNova(page).fill('Primeira');
    await anotacaoNova(page).press('Enter'); // adicionada pelo Enter: não é pendente
    await anotacaoNova(page).fill('Segunda, esquecida na caixa');
    await salvar(page);
    await expect(page.locator('#mensagem')).toHaveText('1 anotação pendente foi adicionada.');
    expect((await guardada(page)).anotacoes.map((a) => a.texto)).toEqual(['Primeira', 'Segunda, esquecida na caixa']);

    await abrirNova(page);
    await basico(page, { titulo: 'Sem pendente' });
    await anotacaoNova(page).fill('Só esta');
    await anotacaoNova(page).press('Enter');
    await salvar(page);
    await expect(dialogo(page)).toBeHidden();
    await expect(page.locator('#mensagem')).not.toContainText('pendente');
  });

  test('texto pendente que não pode ser adicionado (lista cheia) bloqueia o salvamento e não se perde', async ({ page }) => {
    await abrirNova(page);
    await basico(page);
    await colar(anotacaoNova(page), Array.from({ length: 100 }, (_, i) => `Anotação ${i + 1}`).join('\n')); // o limite é de 100 por demanda
    await expect(dialogo(page).locator('.lista-anotacoes li')).toHaveCount(100);
    await anotacaoNova(page).fill('A centésima primeira');
    await salvar(page);
    await expect(dialogo(page)).toBeVisible(); // não salvou
    await expect(page.locator('#e-anotacoes')).toContainText('no máximo 100 anotações');
    await expect(page.locator('#resumo-erros')).toBeVisible();
    await expect(anotacaoNova(page)).toHaveValue('A centésima primeira'); // o texto continua na caixa
    await expect(anotacaoNova(page)).toBeFocused();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('painel-demandas:v1')).demandas.length)).toBe(seedTotal); // nada gravado
    // Liberar espaço (remover uma) e salvar de novo: o texto entra.
    await dialogo(page).getByRole('button', { name: 'Remover anotação: Anotação 100' }).click();
    await salvar(page);
    await expect(dialogo(page)).toBeHidden();
    await expect(page.locator('#mensagem')).toHaveText('1 anotação pendente foi adicionada.');
    const g = await guardada(page);
    expect(g.anotacoes).toHaveLength(100);
    expect(g.anotacoes.at(-1).texto).toBe('A centésima primeira');
  });

  test('texto pendente com mais de 280 caracteres (só possível por script) também bloqueia, sem perder o texto', async ({ page }) => {
    await abrirNova(page);
    await basico(page);
    const longo = 'x'.repeat(281);
    await anotacaoNova(page).evaluate((el, v) => { el.value = v; }, longo); // o maxlength impede digitar mais de 280
    await salvar(page);
    await expect(dialogo(page)).toBeVisible();
    await expect(page.locator('#e-anotacoes')).toContainText('até 280 caracteres');
    await expect(anotacaoNova(page)).toHaveValue(longo);
    await anotacaoNova(page).fill('Agora cabe');
    await salvar(page);
    await expect(dialogo(page)).toBeHidden();
    await expect(page.locator('#mensagem')).toHaveText('1 anotação pendente foi adicionada.');
  });

  test('na edição também: o texto pendente entra e o aviso aparece', async ({ page }) => {
    await abrir(page);
    const p = await abrirPainel(page, 'Organizar arquivos digitais');
    await p.getByRole('button', { name: /^Editar / }).click();
    await campo(page, 'Anotações', 'Editar demanda').fill('Pendente na edição');
    await salvar(page, 'Editar demanda');
    await expect(dialogo(page, 'Editar demanda')).toBeHidden();
    await expect(page.locator('#mensagem')).toHaveText('1 anotação pendente foi adicionada.');
    expect((await guardada(page, 'Organizar arquivos digitais da equipe')).anotacoes.map((a) => a.texto)).toEqual(['Pendente na edição']);
  });
});

test.describe('2. município com a lista de MT', () => {
  test('a caixa sugere os municípios da lista (a contagem vem do arquivo) e busca enquanto se digita', async ({ page }) => {
    await abrirNova(page);
    const opcoes = page.locator('#lista-municipios option');
    await expect(opcoes).toHaveCount(lista.total);
    await expect(opcoes.first()).toHaveAttribute('value', lista.municipios[0].nome);
    await expect(opcoes.last()).toHaveAttribute('value', lista.municipios.at(-1).nome);
    await expect(page.locator('#lista-municipios option[value="Juína"]')).toHaveCount(1);
    await expect(campo(page, 'Município')).toHaveAttribute('list', 'lista-municipios'); // a busca enquanto digita é a da própria caixa de sugestões
    await expect(campo(page, 'Município')).toHaveAttribute('placeholder', 'Ex.: Cuiabá');
  });

  test('"juína", "JUINA" e "cuiaba" viram o nome oficial (ao confirmar o campo e ao salvar)', async ({ page }) => {
    await abrirNova(page);
    await basico(page);
    await campo(page, 'Município').fill('juína');
    await campo(page, 'Município').press('Tab');
    await expect(campo(page, 'Município')).toHaveValue('Juína');
    await expect(page.locator('#a-municipio')).toHaveText('');
    await campo(page, 'Município').fill('cuiaba');
    await campo(page, 'Município').press('Tab');
    await expect(campo(page, 'Município')).toHaveValue('Cuiabá');
    await campo(page, 'Município').fill('JUINA'); // sem sair do campo: o salvamento também normaliza
    await salvar(page);
    await expect(dialogo(page)).toBeHidden();
    const p = await abrirPainel(page, TITULO);
    await expect(p.getByText('Município: Juína', { exact: true })).toBeVisible();
    expect((await guardada(page)).municipio).toBe('Juína');
  });

  test('fora da lista o texto é aceito e o formulário marca discretamente; o painel não marca', async ({ page }) => {
    await abrirNova(page);
    await basico(page);
    await expect(page.locator('#a-municipio')).toHaveText('');
    await campo(page, 'Município').fill('Cidade Fictícia Gama');
    await expect(page.locator('#a-municipio')).toHaveText('fora da lista de MT');
    await campo(page, 'Município').fill('Juína');
    await expect(page.locator('#a-municipio')).toHaveText('');
    await campo(page, 'Município').fill('  Cidade   Fictícia   Gama ');
    await salvar(page);
    await expect(dialogo(page)).toBeHidden();
    const p = await abrirPainel(page, TITULO);
    await expect(p.getByText('Município: Cidade Fictícia Gama', { exact: true })).toBeVisible(); // espaços aparados, texto como digitado
    await expect(p).not.toContainText('fora da lista');
  });

  test('os municípios fictícios do exemplo continuam válidos e aparecem marcados ao editar', async ({ page }) => {
    await abrir(page);
    const p = await abrirPainel(page, 'Manifestação em procedimento do Ministério Público');
    await expect(p.getByText('Município: Cidade Fictícia Alfa', { exact: true })).toBeVisible();
    await p.getByRole('button', { name: /^Editar / }).click();
    await expect(campo(page, 'Município', 'Editar demanda')).toHaveValue('Cidade Fictícia Alfa');
    await expect(page.locator('#a-municipio')).toHaveText('fora da lista de MT');
    await salvar(page, 'Editar demanda');
    await expect(dialogo(page, 'Editar demanda')).toBeHidden();
    expect((await guardada(page, 'Manifestação em procedimento do Ministério Público (fictício)')).municipio).toBe('Cidade Fictícia Alfa');
  });

  test('dados já salvos com "juína" são padronizados ao abrir o painel', async ({ page }) => {
    await abrir(page);
    await page.evaluate(() => {
      const dados = JSON.parse(localStorage.getItem('painel-demandas:v1'));
      dados.demandas.find((d) => d.id === 'DEM-0003').municipio = 'juína';
      localStorage.setItem('painel-demandas:v1', JSON.stringify(dados));
    });
    await page.reload();
    await usarDataDoExemplo(page);
    const p = await abrirPainel(page, 'Manifestação em procedimento do Ministério Público');
    await expect(p.getByText('Município: Juína', { exact: true })).toBeVisible();
  });

  test('se a lista não carregar (ou vier inválida), o campo continua aceitando texto livre, sem marcação', async ({ page }) => {
    await page.route('**/data/municipios-mt.json', (rota) => rota.fulfill({ status: 200, contentType: 'application/json', body: '{"municipios": []}' }));
    await abrirNova(page);
    await basico(page);
    await expect(page.locator('#lista-municipios option')).toHaveCount(0);
    await campo(page, 'Município').fill('juína');
    await campo(page, 'Município').press('Tab');
    await expect(campo(page, 'Município')).toHaveValue('juína'); // sem lista, nada é trocado
    await expect(page.locator('#a-municipio')).toHaveText('');
    await salvar(page);
    await expect(dialogo(page)).toBeHidden();
    expect((await guardada(page)).municipio).toBe('juína');
  });
});

test.describe('3. valor convertido sob latitude e longitude', () => {
  test('mostra "= -11,053889" com hífen, na mesma linha do aviso, em tempo real', async ({ page }) => {
    await abrirNova(page);
    await campo(page, 'Latitude').fill(`11° 03' 14" S`);
    await expect(page.locator('#a-latitude')).toHaveText('= -11,053889');
    expect((await page.locator('#a-latitude').textContent()).charCodeAt(2)).toBe(45); // hífen-minus, copiável para QGIS, GPS e planilha
    await campo(page, 'Latitude').fill('11,053889');
    await expect(page.locator('#a-latitude')).toHaveText('= -11,053889 · hemisfério assumido: S');
    await campo(page, 'Longitude').fill('-30');
    await expect(page.locator('#a-longitude')).toHaveText('= -30,000000 · fora de MT');
    await campo(page, 'Longitude').fill('');
    await expect(page.locator('#a-longitude')).toHaveText('');
    await expect(page.locator('#avisos-coordenada')).toHaveCount(0); // a caixa antiga de avisos deixou de existir
  });

  test('a linha é um aviso lido pelo leitor de tela (aria-live) e não repete o valor digitado em erro', async ({ page }) => {
    await abrirNova(page);
    for (const eixo of ['latitude', 'longitude']) await expect(page.locator(`#a-${eixo}`)).toHaveAttribute('aria-live', 'polite');
    await campo(page, 'Latitude').fill('lixo123');
    await expect(page.locator('#a-latitude')).not.toContainText('lixo123');
  });
});

test.describe('4. ajuste manual igual à calculada', () => {
  test('mostra "igual à calculada; use Automática", não pede motivo e grava como Automática, informando na tela', async ({ page }) => {
    await abrirNova(page);
    await basico(page);
    await expect(page.locator('#previa-prioridade')).toContainText('Prioridade calculada: Baixa');
    await campo(page, 'Prioridade').selectOption({ label: 'Baixa' });
    await expect(page.locator('#previa-prioridade')).toContainText('Baixa é igual à calculada; use Automática');
    await expect(page.locator('#campo-motivo')).toBeHidden();
    await salvar(page);
    await expect(dialogo(page)).toBeHidden();
    await expect(page.locator('#mensagem')).toHaveText('A prioridade escolhida era igual à calculada: a demanda foi gravada como Automática.');
    const p = await abrirPainel(page, TITULO);
    await expect(p.locator('.prioridade')).toHaveText(/^Prioridade Baixa · \d+ pontos$/); // sem "(manual)"
    const g = await guardada(page);
    expect('prioridade_manual' in g || 'motivo_ajuste' in g).toBe(false);
  });

  test('ajuste diferente da calculada continua pedindo o motivo, e o pedido acompanha o prazo', async ({ page }) => {
    await abrirNova(page);
    await basico(page);
    await campo(page, 'Prioridade').selectOption({ label: 'Alta' });
    await expect(page.locator('#campo-motivo')).toBeVisible();
    await expect(page.locator('#previa-prioridade')).not.toContainText('igual à calculada');
    await salvar(page);
    await expect(dialogo(page)).toBeVisible();
    await expect(page.locator('#e-motivo_ajuste')).toHaveText('Informe o motivo do ajuste.');
    // Voltar para a faixa calculada dispensa o motivo.
    await campo(page, 'Prioridade').selectOption({ label: 'Baixa' });
    await expect(page.locator('#campo-motivo')).toBeHidden();
    // Mudar o prazo muda a faixa calculada: "Baixa" deixa de ser igual e o motivo volta a ser pedido.
    await campo(page, 'Prazo').fill('2026-10-10');
    await expect(page.locator('#previa-prioridade')).not.toContainText('Prioridade calculada: Baixa');
    await expect(page.locator('#campo-motivo')).toBeVisible();
  });

  test('na edição, escolher a faixa calculada tira o ajuste manual', async ({ page }) => {
    await abrirNova(page);
    await basico(page);
    await campo(page, 'Prioridade').selectOption({ label: 'Alta' });
    await campo(page, 'Motivo do ajuste').fill('Pedido da chefia');
    await salvar(page);
    const p = await abrirPainel(page, TITULO);
    await expect(p.locator('.prioridade')).toContainText('Alta (manual)');
    await p.getByRole('button', { name: `Editar ${TITULO}` }).click();
    await campo(page, 'Prioridade', 'Editar demanda').selectOption({ label: 'Baixa' });
    await expect(page.locator('#campo-motivo')).toBeHidden();
    await salvar(page, 'Editar demanda');
    await expect(dialogo(page, 'Editar demanda')).toBeHidden();
    await expect(painel(page).locator('.prioridade')).not.toContainText('(manual)');
    expect('prioridade_manual' in (await guardada(page))).toBe(false);
  });
});

test.describe('5. dicas legíveis e "Mostrar concluídas"', () => {
  test('as dicas e os avisos dos campos nunca ficam abaixo de 12 px, mesmo com a fonte-base reduzida', async ({ page }) => {
    await abrirNova(page);
    await campo(page, 'Latitude').fill('11,05'); // acende uma linha de aviso
    await campo(page, 'Município').fill('Cidade Fictícia Gama');
    await page.evaluate(() => { document.documentElement.style.fontSize = '10px'; }); // fonte-base pequena (o rem encolhe)
    const tamanhos = await page.evaluate(() => [...document.querySelectorAll('#formulario .dica, #formulario .aviso-campo')]
      .filter((e) => e.textContent.trim() !== '' && e.offsetParent !== null)
      .map((e) => ({ id: e.id, px: parseFloat(getComputedStyle(e).fontSize) })));
    expect(tamanhos.length).toBeGreaterThanOrEqual(4);
    for (const t of tamanhos) expect(t.px, `${t.id || 'dica'} a ${t.px}px`).toBeGreaterThanOrEqual(12);
  });

  test('"Mostrar concluídas" só aparece quando existe anotação concluída', async ({ page }) => {
    await abrirNova(page);
    const opcao = dialogo(page).locator('.mostrar-concluidas');
    await expect(opcao).toBeHidden(); // lista vazia
    await anotacaoNova(page).fill('Primeira');
    await anotacaoNova(page).press('Enter');
    await anotacaoNova(page).fill('Segunda');
    await anotacaoNova(page).press('Enter');
    await expect(dialogo(page).locator('.lista-anotacoes li')).toHaveCount(2);
    await expect(opcao).toBeHidden(); // há anotações, mas nenhuma concluída
    await dialogo(page).getByRole('checkbox', { name: 'Primeira' }).check();
    await expect(opcao).toBeVisible();
    await expect(opcao).toContainText('Mostrar concluídas (1)');
    await opcao.getByRole('checkbox').uncheck(); // esconde as concluídas
    await expect(dialogo(page).locator('.lista-anotacoes li')).toHaveCount(1);
    await opcao.getByRole('checkbox').check();
    await dialogo(page).getByRole('checkbox', { name: 'Primeira' }).uncheck();
    await expect(opcao).toBeHidden(); // sem concluídas, some de novo
    await expect(dialogo(page).locator('.lista-anotacoes li')).toHaveCount(2);
  });

  test('ao abrir uma demanda que já tem anotação concluída, a opção está visível', async ({ page }) => {
    await abrir(page);
    const p = await abrirPainel(page, 'Manifestação em procedimento do Ministério Público');
    await p.getByRole('button', { name: /^Editar / }).click();
    await expect(dialogo(page, 'Editar demanda').locator('.mostrar-concluidas')).toBeVisible();
    await expect(dialogo(page, 'Editar demanda').locator('.mostrar-concluidas')).toContainText('Mostrar concluídas (1)');
  });
});

test('o formulário continua cabendo na tela, sem rolagem horizontal', async ({ page }) => {
  await abrirNova(page);
  await campo(page, 'Município').fill('Cidade Fictícia Gama');
  await campo(page, 'Latitude').fill('11,05');
  await campo(page, 'Longitude').fill('-30');
  expect(await dialogo(page).evaluate((d) => d.scrollWidth <= d.clientWidth + 1)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
