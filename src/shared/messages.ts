export interface RecordProtectedMessage {
  type: 'RECORD_PROTECTED'
  amount: number
  siteDomain: string
  workHoursSaved: number
}

/** Fallback only: sent when the tab has no history to go back to (e.g. opened as a new tab). */
export interface CloseTabMessage {
  type: 'CLOSE_TAB'
}

export interface RecordOverrideMessage {
  type: 'RECORD_OVERRIDE'
}

export type PayBreakMessage = RecordProtectedMessage | CloseTabMessage | RecordOverrideMessage

export interface AckResponse {
  ok: true
}
