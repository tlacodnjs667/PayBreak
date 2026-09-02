export type SalaryType = 'hourly' | 'monthly'

export interface UserConfig {
  targetAmount: number
  targetMonths: number
  monthlySavingsTarget: number
  hourlyWage: number
  cooldownSeconds: number
  salaryType: SalaryType
  monthlySalary: number
}

export interface Stats {
  totalProtectedAmount: number
  totalOverriddenAmount: number
  protectedCount: number
  overrideCount: number
}

export interface ProtectedLog {
  id: string
  timestamp: string
  siteDomain: string
  amount: number
  workHoursSaved: number
  /** Snapshot of userConfig.hourlyWage at log time. Optional because logs recorded before this field existed lack it in storage. */
  hourlyWageAtLog?: number
  /** True when this log fell within the 10-minute same-domain dedupe window — logged for audit but excluded from stats accumulation. */
  isDuplicateAttempt?: boolean
  /** True when this log is a manually-recorded external/offline spend (Direct Override) rather than a defended checkout. */
  isOverridden?: boolean
}

export interface PayBreakStorage {
  userConfig: UserConfig
  stats: Stats
  protectedLogs: ProtectedLog[]
}

export const DEFAULT_STORAGE: PayBreakStorage = {
  userConfig: {
    targetAmount: 100_000_000,
    targetMonths: 60,
    monthlySavingsTarget: 1_666_667,
    hourlyWage: 15_000,
    cooldownSeconds: 30,
    salaryType: 'hourly',
    monthlySalary: 0,
  },
  stats: {
    totalProtectedAmount: 0,
    totalOverriddenAmount: 0,
    protectedCount: 0,
    overrideCount: 0,
  },
  protectedLogs: [],
}
