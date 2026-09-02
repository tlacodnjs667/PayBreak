/**
 * Regex/text-scan price extraction. Coupang/NaverPay markup (class names, DOM structure)
 * changes often and can't be relied on, so instead of hardcoded selectors this scans
 * rendered text for won-amounts sitting near a "total payment" keyword. Manual input
 * (see overlay.ts) is the fallback when nothing scores well enough.
 */

const STRONG_KEYWORDS = [/총\s*결제\s*금액/, /최종\s*결제\s*금액/, /결제\s*예정\s*금액/]
const WEAK_KEYWORDS = [/결제\s*금액/, /총\s*주문\s*금액/, /주문\s*금액/, /total\s*(payment|amount)/i]

const WON_AMOUNT = /(?:₩\s*)?([\d]{1,3}(?:,\d{3})+|\d{4,})\s*원?/

interface Candidate {
  amount: number
  score: number
}

function parseWonAmount(text: string): number | null {
  const match = text.match(WON_AMOUNT)
  if (!match) return null
  const digits = match[1].replace(/,/g, '')
  const value = Number(digits)
  if (!Number.isFinite(value) || value <= 0) return null
  return value
}

function keywordScore(text: string): number {
  if (STRONG_KEYWORDS.some((re) => re.test(text))) return 2
  if (WEAK_KEYWORDS.some((re) => re.test(text))) return 1
  return 0
}

/** Walks visible elements, and for each one that mentions a payment-amount keyword,
 *  looks for a won-amount in that element or its immediate neighbors. */
function scanDocument(): Candidate[] {
  const candidates: Candidate[] = []
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, {
    acceptNode(node) {
      const el = node as Element
      if (el.childElementCount > 0) return NodeFilter.FILTER_SKIP
      return NodeFilter.FILTER_ACCEPT
    },
  })

  let node = walker.nextNode()
  while (node) {
    const el = node as Element
    const text = el.textContent?.trim() ?? ''
    if (text.length > 0 && text.length < 200) {
      const score = keywordScore(text)
      if (score > 0) {
        const ownAmount = parseWonAmount(text)
        const nearbyText = [
          el.parentElement?.textContent,
          el.nextElementSibling?.textContent,
          el.parentElement?.nextElementSibling?.textContent,
        ]
          .filter(Boolean)
          .join(' ')
        const amount = ownAmount ?? parseWonAmount(nearbyText)
        if (amount !== null) {
          candidates.push({ amount, score })
        }
      }
    }
    node = walker.nextNode()
  }

  return candidates
}

function pickBest(candidates: Candidate[]): number | null {
  if (candidates.length === 0) return null
  const best = candidates.reduce((a, b) => (b.score > a.score ? b : a))
  return best.amount
}

export function scanForCheckoutAmount(): number | null {
  return pickBest(scanDocument())
}

/** Checkout pages are often SPAs that render the total asynchronously, so poll briefly
 *  (backed by a MutationObserver) before giving up and asking the user to type it in. */
export function waitForCheckoutAmount(timeoutMs = 4000, intervalMs = 250): Promise<number | null> {
  return new Promise((resolve) => {
    const immediate = scanForCheckoutAmount()
    if (immediate !== null) {
      resolve(immediate)
      return
    }

    let settled = false
    const finish = (value: number | null) => {
      if (settled) return
      settled = true
      observer.disconnect()
      clearInterval(poll)
      clearTimeout(timeout)
      resolve(value)
    }

    const observer = new MutationObserver(() => {
      const amount = scanForCheckoutAmount()
      if (amount !== null) finish(amount)
    })
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })

    const poll = setInterval(() => {
      const amount = scanForCheckoutAmount()
      if (amount !== null) finish(amount)
    }, intervalMs)

    const timeout = setTimeout(() => finish(null), timeoutMs)
  })
}
