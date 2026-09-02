import { DEFAULT_STORAGE, type PayBreakStorage, type ProtectedLog, type Stats, type UserConfig } from './types'

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

/** Records a successful defense: bumps stats and appends a log entry. */
async function recordProtected(entry: Omit<ProtectedLog, 'id' | 'timestamp'>): Promise<void> {
  const { stats, protectedLogs } = await getAll()
  const log: ProtectedLog = {
    ...entry,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  }
  const nextStats: Stats = {
    ...stats,
    totalProtectedAmount: stats.totalProtectedAmount + entry.amount,
    protectedCount: stats.protectedCount + 1,
  }
  await chrome.storage.local.set({
    stats: nextStats,
    protectedLogs: [log, ...protectedLogs].slice(0, 500),
  })
}

/** Records that the user typed the confession sentence and overrode the lock. */
async function recordOverride(): Promise<void> {
  const { stats } = await getAll()
  await chrome.storage.local.set({
    stats: { ...stats, overrideCount: stats.overrideCount + 1 },
  })
}

export const storage = {
  getAll,
  getUserConfig,
  setUserConfig,
  getStats,
  recordProtected,
  recordOverride,
}
