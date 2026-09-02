export type SalaryType = 'hourly' | 'monthly'

export interface UserConfig {
  targetAmount: number
  currentSavings: number
  monthlyTarget: number
  hourlyWage: number
  cooldownSeconds: number
  salaryType: SalaryType
  monthlySalary: number
}

export interface Stats {
  totalProtectedAmount: number
  protectedCount: number
  overrideCount: number
}

export interface ProtectedLog {
  id: string
  timestamp: string
  siteDomain: string
  amount: number
  workHoursSaved: number
}

export interface PayBreakStorage {
  userConfig: UserConfig
  stats: Stats
  protectedLogs: ProtectedLog[]
}

export const DEFAULT_STORAGE: PayBreakStorage = {
  userConfig: {
    targetAmount: 100_000_000,
    currentSavings: 0,
    monthlyTarget: 1_500_000,
    hourlyWage: 15_000,
    cooldownSeconds: 30,
    salaryType: 'hourly',
    monthlySalary: 0,
  },
  stats: {
    totalProtectedAmount: 0,
    protectedCount: 0,
    overrideCount: 0,
  },
  protectedLogs: [],
}
