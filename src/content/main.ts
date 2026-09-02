import { isCheckoutPage, currentSiteDomain } from './detect'
import { waitForCheckoutAmount } from './priceParser'
import { mountOverlay } from './overlay'
import { storage } from '../shared/storage'

async function run() {
  if (!isCheckoutPage()) return

  const [config, amount] = await Promise.all([storage.getUserConfig(), waitForCheckoutAmount()])

  mountOverlay(amount, config, currentSiteDomain())
}

run()
