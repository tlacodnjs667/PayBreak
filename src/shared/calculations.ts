import type { UserConfig } from './types'

const COMPOUND_ANNUAL_RATE = 0.08
const COMPOUND_YEARS = 5
const MONTHLY_STANDARD_HOURS = 209 // 주 40시간 기준 월 환산 근무시간

/** 월급(실수령액) -> 시급 환산 */
export function calcHourlyFromMonthlySalary(monthlySalary: number): number {
  if (monthlySalary <= 0) return 0
  return Math.round(monthlySalary / MONTHLY_STANDARD_HOURS)
}

/** 결제 금액 -> 시급 기준 노동 시간 (소수점 첫째 자리 반올림) */
export function calcWorkHours(amount: number, hourlyWage: number): number {
  if (hourlyWage <= 0) return 0
  return Math.round((amount / hourlyWage) * 10) / 10
}

/** 결제 금액 -> 1억 목표 지연 일수 */
export function calcDelayDays(amount: number, monthlyTarget: number): number {
  const dailyTarget = monthlyTarget / 30
  if (dailyTarget <= 0) return 0
  return Math.round(amount / dailyTarget)
}

/** 5년 복리 기회비용 (연 8% 가정) */
export function calcCompoundFutureValue(amount: number): number {
  return Math.round(amount * (1 + COMPOUND_ANNUAL_RATE) ** COMPOUND_YEARS)
}

export interface FrictionFigures {
  workHours: number
  delayDays: number
  futureValue: number
}

export function calcFrictionFigures(amount: number, config: UserConfig): FrictionFigures {
  return {
    workHours: calcWorkHours(amount, config.hourlyWage),
    delayDays: calcDelayDays(amount, config.monthlyTarget),
    futureValue: calcCompoundFutureValue(amount),
  }
}
