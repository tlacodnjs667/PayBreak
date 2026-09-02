import { DEFAULT_STORAGE, type PayBreakStorage, type ProtectedLog, type Stats, type UserConfig } from './types'
import { calcWorkHours } from './calculations'

/** Same-domain abandonment logs within this window are logged but excluded from stats accumulation (anti-abuse cap). */
const ABUSE_DEDUPE_WINDOW_MS = 10 * 60 * 1000

async function getAll(): Promise<PayBreakStorage> {
  const stored = (await chrome.storage.local.get(DEFAULT_STORAGE)) as PayBreakStorage
  return {
    userConfig: { ...DEFAULT_STORAGE.userConfig, ...stored.userConfig },
    stats: { ...DEFAULT_STORAGE.stats, ...stored.stats },
    protectedLogs: stored.protectedLogs ?? [],
  }
}

async function getUserConfig(): Promise<UserConfig> {
  const { userConfig } = await getAll()
  return userConfig
}

async function setUserConfig(patch: Partial<UserConfig>): Promise<UserConfig> {
  const current = await getUserConfig()
  const next = { ...current, ...patch }
  await chrome.storage.local.set({ userConfig: next })
  return next
}

async function getStats(): Promise<Stats> {
  const { stats } = await getAll()
  return stats
}

/**
 * Records a successful defense: appends a log entry, and bumps stats unless this is a
 * repeat abandonment on the same domain within ABUSE_DEDUPE_WINDOW_MS (fake-savings spam cap).
 */
async function recordProtected(entry: Omit<ProtectedLog, 'id' | 'timestamp' | 'isDuplicateAttempt'>): Promise<void> {
  const { stats, protectedLogs } = await getAll()
  const now = Date.now()
  const lastLogForDomain = protectedLogs.find((log) => log.siteDomain === entry.siteDomain)
  const isDuplicateAttempt =
    !!lastLogForDomain && now - new Date(lastLogForDomain.timestamp).getTime() < ABUSE_DEDUPE_WINDOW_MS

  const log: ProtectedLog = {
    ...entry,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    isDuplicateAttempt,
  }
  const nextStats: Stats = isDuplicateAttempt
    ? stats
    : {
        ...stats,
        totalProtectedAmount: stats.totalProtectedAmount + entry.amount,
        protectedCount: stats.protectedCount + 1,
      }
  await chrome.storage.local.set({
    stats: nextStats,
    protectedLogs: [log, ...protectedLogs].slice(0, 500),
  })
}

/** Records that the user typed the confession sentence and overrode the lock; the overridden amount is subtracted from the net gauge. */
async function recordOverride(amount: number): Promise<void> {
  const { stats } = await getAll()
  await chrome.storage.local.set({
    stats: {
      ...stats,
      overrideCount: stats.overrideCount + 1,
      totalOverriddenAmount: stats.totalOverriddenAmount + amount,
    },
  })
}

/**
 * Records a manually-logged external/offline spend (Direct Override) so the net gauge stays
 * accurate for spending PayBreak's checkout detection never saw. Subtracts from the net gauge
 * the same way a checkout override does, and appends a protectedLogs entry (negative
 * workHoursSaved, isOverridden: true) so it flows through the existing report/CSV pipeline.
 */
async function recordManualOverride(note: string, amount: number): Promise<{ workHoursConsumed: number }> {
  const { stats, protectedLogs, userConfig } = await getAll()
  const workHoursConsumed = calcWorkHours(amount, userConfig.hourlyWage)

  const log: ProtectedLog = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    siteDomain: `[수동입력] ${note}`,
    amount,
    workHoursSaved: -workHoursConsumed,
    hourlyWageAtLog: userConfig.hourlyWage,
    isOverridden: true,
  }
  const nextStats: Stats = {
    ...stats,
    overrideCount: stats.overrideCount + 1,
    totalOverriddenAmount: stats.totalOverriddenAmount + amount,
  }
  await chrome.storage.local.set({
    stats: nextStats,
    protectedLogs: [log, ...protectedLogs].slice(0, 500),
  })
  return { workHoursConsumed }
}

export const storage = {
  getAll,
  getUserConfig,
  setUserConfig,
  getStats,
  recordProtected,
  recordOverride,
  recordManualOverride,
}
