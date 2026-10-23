// Vistoria de cada ponto de operação (RF68): quais situações combinam com cada etapa e o ajuste de dados antigos ou de mudança de etapa.
// Módulo puro (sem DOM nem armazenamento); fica separado para o `migrarDemanda` poder usá-lo sem importar as operações.
import { dataValida } from './indicadores.js';

// Situação da vistoria do ponto: sem o campo, "a programar".
export const vistoriaDoPonto = (ponto) => ponto.vistoria ?? 'pendente';

// Situações da vistoria que combinam com cada etapa do ponto: o que já foi vistoriado só pode estar "vistoriada"; o planejado ainda
// pode estar a programar, programada ou não realizada (reagendada); o encerrado por não acesso é "não realizada".
export function vistoriasPermitidas(etapa) {
  if (etapa === 'planejado') return ['pendente', 'programada', 'nao_acessada'];
  if (etapa === 'encerrado_nao_acessado') return ['nao_acessada'];
  return ['vistoriada'];
}

// O ponto com a vistoria ajustada à etapa dele (idempotente). Sem data própria, a vistoriada leva a do retorno da operação.
// Serve à mudança de etapa e à migração de dados antigos; no formulário, o par contraditório é recusado em vez de ajustado.
export function vistoriaCoerente(ponto, retorno) {
  const situacao = vistoriaDoPonto(ponto);
  if (vistoriasPermitidas(ponto.etapa).includes(situacao)) return ponto;
  const { vistoria, vistoria_em: data, ...base } = ponto;
  if (ponto.etapa === 'planejado') return data ? { ...base, vistoria: 'programada', vistoria_em: data } : base; // vistoriada sem etapa: volta a programada
  if (ponto.etapa === 'encerrado_nao_acessado') return { ...base, vistoria: 'nao_acessada' };
  return { ...base, vistoria: 'vistoriada', vistoria_em: dataValida(data) ? data : dataValida(retorno) ? retorno : undefined };
}
