const CHECKOUT_PATH_KEYWORDS = ['/order', '/checkout', '/pay', '/ordersheet', '/orders']

const KNOWN_CHECKOUT_HOSTS = [
  'order.pay.naver.com',
  'pay.naver.com',
]

function hostMatchesCoupangCheckout(hostname: string, pathname: string): boolean {
  if (!hostname.endsWith('.coupang.com') && hostname !== 'coupang.com') return false
  return pathname.includes('/vp/orders/') || pathname.includes('/checkout/')
}

/** Cheap, synchronous check so the content script can bail out immediately on non-checkout pages. */
export function isCheckoutPage(url: URL = new URL(location.href)): boolean {
  const hostname = url.hostname
  const pathname = url.pathname.toLowerCase()

  if (KNOWN_CHECKOUT_HOSTS.includes(hostname)) return true
  if (hostMatchesCoupangCheckout(hostname, pathname)) return true

  return CHECKOUT_PATH_KEYWORDS.some((kw) => pathname.includes(kw))
}

export function currentSiteDomain(): string {
  return location.hostname.replace(/^www\./, '')
}
