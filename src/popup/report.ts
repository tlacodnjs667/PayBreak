import type { ProtectedLog } from '../shared/types'

export type ReportPeriod = 'daily' | 'monthly' | 'yearly'

export interface PeriodAggregate {
  key: string
  totalAmount: number
  totalWorkHours: number
  count: number
}

function periodKey(timestamp: string, period: ReportPeriod): string {
  const d = new Date(timestamp)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  if (period === 'yearly') return `${y}`
  if (period === 'monthly') return `${y}-${m}`
  return `${y}-${m}-${day}`
}

/** Groups protection logs by day/month/year and sums amount + labor hours, newest period first. */
export function aggregateByPeriod(logs: ProtectedLog[], period: ReportPeriod): PeriodAggregate[] {
  const map = new Map<string, PeriodAggregate>()
  for (const log of logs) {
    if (log.isDuplicateAttempt || log.isOverridden) continue
    const key = periodKey(log.timestamp, period)
    const existing = map.get(key)
    if (existing) {
      existing.totalAmount += log.amount
      existing.totalWorkHours += log.workHoursSaved
      existing.count += 1
    } else {
      map.set(key, { key, totalAmount: log.amount, totalWorkHours: log.workHoursSaved, count: 1 })
    }
  }
  return Array.from(map.values()).sort((a, b) => (a.key < b.key ? 1 : -1))
}

function escapeCsvField(field: string): string {
  return /[",\r\n]/.test(field) ? `"${field.replace(/"/g, '""')}"` : field
}

/** Legacy logs recorded before hourlyWageAtLog existed lack it in storage; derive it back from amount/workHoursSaved. */
function resolveHourlyWageAtLog(log: ProtectedLog): string {
  if (log.hourlyWageAtLog) return String(log.hourlyWageAtLog)
  if (log.workHoursSaved > 0) return String(Math.round(log.amount / log.workHoursSaved))
  return '-'
}

function toCsv(logs: ProtectedLog[]): string {
  const header = ['날짜', '사이트', '결제금액(원)', '노동시간(h)', '당시시급(원)', '비고']
  const rows = logs.map((log) => [
    new Date(log.timestamp).toLocaleString('ko-KR'),
    log.siteDomain,
    String(log.amount),
    String(log.workHoursSaved),
    resolveHourlyWageAtLog(log),
    log.isDuplicateAttempt ? '중복 시도' : log.isOverridden ? '외부 지출' : '',
  ])
  return [header, ...rows].map((row) => row.map(escapeCsvField).join(',')).join('\r\n')
}

/** Downloads protectedLogs as a CSV file. UTF-8 BOM prefix keeps Excel from mangling Korean text. */
export function downloadProtectedLogsCsv(logs: ProtectedLog[]): void {
  const csvContent = '﻿' + toCsv(logs)
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')

  const link = document.createElement('a')
  link.href = url
  link.download = `PayBreak_Savings_${y}${m}${d}.csv`
  link.click()
  URL.revokeObjectURL(url)
}
