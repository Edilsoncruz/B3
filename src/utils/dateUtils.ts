/**
 * Utilitários para manipulação e cálculo de datas e projeções temporais.
 */

export interface TargetWindow {
  baseDate: Date;
  targetDate: Date;
  baseDateFormatted: string;       // Ex: "05/08/2026"
  targetDateFormatted: string;     // Ex: "05/10/2026"
  targetMonthYear: string;         // Ex: "Outubro/2026"
  targetPeriodDescription: string; // Ex: "2 meses (até Outubro/2026)"
}

const MONTHS_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const MONTHS_SHORT_PT = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
];

/**
 * Calcula a janela futura de projeção com base na data de execução da análise e no Tempo Alvo.
 * 
 * @param baseDate Data da execução da análise (padrão: hoje)
 * @param periodValue Quantidade de tempo (ex: 2)
 * @param periodUnit Unidade de tempo ('dias' | 'semanas' | 'meses' | 'anos')
 */
export function calculateTargetWindow(
  baseDate: Date = new Date(),
  periodValue: number = 2,
  periodUnit: string = 'meses'
): TargetWindow {
  const target = new Date(baseDate.getTime());
  const unit = (periodUnit || 'meses').toLowerCase().trim();

  if (unit.startsWith('dia')) {
    target.setDate(target.getDate() + periodValue);
  } else if (unit.startsWith('semana')) {
    target.setDate(target.getDate() + periodValue * 7);
  } else if (unit.startsWith('mes') || unit.startsWith('mês')) {
    target.setMonth(target.getMonth() + periodValue);
  } else if (unit.startsWith('ano')) {
    target.setFullYear(target.getFullYear() + periodValue);
  } else {
    // Fallback: meses
    target.setMonth(target.getMonth() + periodValue);
  }

  const pad = (n: number) => String(n).padStart(2, '0');
  
  const baseDateFormatted = `${pad(baseDate.getDate())}/${pad(baseDate.getMonth() + 1)}/${baseDate.getFullYear()}`;
  const targetDateFormatted = `${pad(target.getDate())}/${pad(target.getMonth() + 1)}/${target.getFullYear()}`;
  const targetMonthYear = `${MONTHS_SHORT_PT[target.getMonth()]}/${target.getFullYear()}`;
  
  const unitLabel = periodValue === 1 
    ? (unit.startsWith('dia') ? 'dia' : unit.startsWith('semana') ? 'semana' : 'mês')
    : (unit.startsWith('dia') ? 'dias' : unit.startsWith('semana') ? 'semanas' : 'meses');

  const targetPeriodDescription = `${periodValue} ${unitLabel} (até ${targetMonthYear})`;

  return {
    baseDate,
    targetDate: target,
    baseDateFormatted,
    targetDateFormatted,
    targetMonthYear,
    targetPeriodDescription
  };
}
