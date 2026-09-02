import { storage } from './shared/storage'
import type { AckResponse, PayBreakMessage } from './shared/messages'

chrome.runtime.onMessage.addListener((message: PayBreakMessage, sender, sendResponse: (r: AckResponse) => void) => {
  handleMessage(message, sender).then(() => sendResponse({ ok: true }))
  return true // keep the message channel open for the async response
})

async function handleMessage(message: PayBreakMessage, sender: chrome.runtime.MessageSender): Promise<void> {
  switch (message.type) {
    case 'RECORD_PROTECTED': {
      await storage.recordProtected({
        siteDomain: message.siteDomain,
        amount: message.amount,
        workHoursSaved: message.workHoursSaved,
        hourlyWageAtLog: message.hourlyWageAtLog,
      })
      break
    }
    case 'CLOSE_TAB': {
      if (sender.tab?.id !== undefined) {
        await chrome.tabs.remove(sender.tab.id)
      }
      break
    }
    case 'RECORD_OVERRIDE': {
      await storage.recordOverride()
      break
    }
  }
}
