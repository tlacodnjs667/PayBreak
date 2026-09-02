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

/** 결제 금액 -> 목표 게이지 증가율(%) (소수점 첫째 자리 반올림) */
export function calcGaugeGainPercent(amount: number, targetAmount: number): number {
  if (targetAmount <= 0) return 0
  return Math.round((amount / targetAmount) * 1000) / 10
}

/** 5년 복리 기회비용 (연 8% 가정) */
export function calcCompoundFutureValue(amount: number): number {
  return Math.round(amount * (1 + COMPOUND_ANNUAL_RATE) ** COMPOUND_YEARS)
}

/** 원 단위 금액을 "1억 5,000만 원" 같은 한국식 단위 표기로 변환 */
export function formatKoreanAmount(amount: number): string {
  if (amount <= 0) return '0원'

  const eok = Math.floor(amount / 100_000_000)
  const remainderAfterEok = amount % 100_000_000
  const man = Math.floor(remainderAfterEok / 10_000)
  const won = remainderAfterEok % 10_000

  const parts: string[] = []
  if (eok > 0) parts.push(`${eok}억`)
  if (man > 0) parts.push(`${man.toLocaleString('ko-KR')}만`)
  if (parts.length === 0 && won > 0) parts.push(won.toLocaleString('ko-KR'))
  if (parts.length === 0) parts.push('0')

  return `${parts.join(' ')} 원`
}

export interface FrictionFigures {
  workHours: number
  gaugeGainPercent: number
  futureValue: number
}

export function calcFrictionFigures(amount: number, config: UserConfig): FrictionFigures {
  return {
    workHours: calcWorkHours(amount, config.hourlyWage),
    gaugeGainPercent: calcGaugeGainPercent(amount, config.targetAmount),
    futureValue: calcCompoundFutureValue(amount),
  }
}
