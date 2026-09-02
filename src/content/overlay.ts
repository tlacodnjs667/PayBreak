import type { UserConfig } from '../shared/types'
import { calcFrictionFigures, formatKoreanAmount } from '../shared/calculations'
import type { PayBreakMessage, AckResponse } from '../shared/messages'

const STYLES = `
:host {
  all: initial;
}
.pb-overlay {
  position: fixed;
  inset: 0;
  z-index: 2147483647;
  background: rgba(10, 12, 20, 0.92);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Pretendard, "Malgun Gothic", sans-serif;
  color: #f5f5f7;
}
.pb-card {
  width: min(480px, 90vw);
  max-height: 90vh;
  overflow-y: auto;
  background: #16181f;
  border-radius: 16px;
  padding: 28px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}
.pb-title {
  font-size: 20px;
  font-weight: 700;
  margin: 0 0 4px;
}
.pb-delay-warning {
  font-size: 13px;
  color: #ff5c5c;
  font-weight: 600;
  margin: 0 0 20px;
}
.pb-amount-input-row {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}
.pb-amount-input-row input {
  flex: 1;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid #3a3d47;
  background: #0e0f14;
  color: #f5f5f7;
  font-size: 14px;
}
.pb-figures {
  background: #0e0f14;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 20px;
}
.pb-figure-row {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  font-size: 14px;
}
.pb-figure-row .label {
  color: #9aa0ab;
}
.pb-figure-row .value {
  color: #ff5c5c;
  font-weight: 700;
}
.pb-timer {
  text-align: center;
  font-size: 13px;
  color: #9aa0ab;
  margin-bottom: 16px;
}
.pb-save-btn {
  width: 100%;
  padding: 14px;
  border: none;
  border-radius: 10px;
  background: #22c55e;
  color: #05170b;
  font-weight: 800;
  font-size: 16px;
  cursor: pointer;
  margin-bottom: 12px;
}
.pb-save-btn:hover {
  background: #16a34a;
}
.pb-override-section {
  border-top: 1px solid #2a2d36;
  padding-top: 16px;
}
.pb-override-hint {
  font-size: 12px;
  color: #9aa0ab;
  margin-bottom: 8px;
}
.pb-confession-sentence {
  font-size: 13px;
  color: #d4d4d8;
  background: #0e0f14;
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 8px;
}
.pb-confession-input {
  width: 100%;
  box-sizing: border-box;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid #3a3d47;
  background: #0e0f14;
  color: #f5f5f7;
  font-size: 14px;
  margin-bottom: 10px;
}
.pb-proceed-btn {
  width: 100%;
  padding: 12px;
  border: none;
  border-radius: 10px;
  background: #3a3d47;
  color: #6b6f7a;
  font-weight: 700;
  font-size: 14px;
  cursor: not-allowed;
}
.pb-proceed-btn.pb-enabled {
  background: #ef4444;
  color: #fff;
  cursor: pointer;
}
`

interface OverlayHandle {
  destroy: () => void
}

function sendMessage(message: PayBreakMessage): Promise<AckResponse> {
  return chrome.runtime.sendMessage(message)
}

function formatWon(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`
}

export function mountOverlay(initialAmount: number | null, config: UserConfig, siteDomain: string): OverlayHandle {
  const formattedTarget = formatKoreanAmount(config.targetAmount)
  const CONFESSION_SENTENCE = `나는 ${formattedTarget} 모으기 목표보다 이 물건이 지금 당장 더 가치 있다고 확신합니다.`

  const previousOverflow = document.documentElement.style.overflow
  document.documentElement.style.overflow = 'hidden'

  const host = document.createElement('div')
  host.id = 'paybreak-overlay-host'
  const shadow = host.attachShadow({ mode: 'closed' })

  const style = document.createElement('style')
  style.textContent = STYLES
  shadow.appendChild(style)

  const overlay = document.createElement('div')
  overlay.className = 'pb-overlay'
  shadow.appendChild(overlay)

  const card = document.createElement('div')
  card.className = 'pb-card'
  overlay.appendChild(card)

  card.innerHTML = `
    <p class="pb-title">잠깐, ${formattedTarget} 목표를 다시 생각해보세요</p>
    <p class="pb-delay-warning" id="pb-delay-warning"></p>
    ${initialAmount === null ? `
      <div class="pb-amount-input-row">
        <input type="number" placeholder="결제 예정 금액을 직접 입력하세요" id="pb-manual-amount" />
      </div>
    ` : ''}
    <div class="pb-figures" id="pb-figures"></div>
    <div class="pb-timer" id="pb-timer"></div>
    <button class="pb-save-btn" id="pb-save-btn">결제 포기하고 ${formattedTarget} 지키기</button>
    <div class="pb-override-section">
      <p class="pb-override-hint">그래도 결제를 진행하려면 아래 문장을 정확히 똑같이 입력하세요.</p>
      <p class="pb-confession-sentence">${CONFESSION_SENTENCE}</p>
      <input type="text" class="pb-confession-input" id="pb-confession-input" placeholder="여기에 문장을 그대로 입력하세요" />
      <button class="pb-proceed-btn" id="pb-proceed-btn" disabled>결제 진행하기</button>
    </div>
  `

  document.documentElement.appendChild(host)

  const figuresEl = card.querySelector<HTMLDivElement>('#pb-figures')!
  const delayWarningEl = card.querySelector<HTMLParagraphElement>('#pb-delay-warning')!
  const timerEl = card.querySelector<HTMLDivElement>('#pb-timer')!
  const saveBtn = card.querySelector<HTMLButtonElement>('#pb-save-btn')!
  const proceedBtn = card.querySelector<HTMLButtonElement>('#pb-proceed-btn')!
  const confessionInput = card.querySelector<HTMLInputElement>('#pb-confession-input')!
  const manualAmountInput = card.querySelector<HTMLInputElement>('#pb-manual-amount')

  let amount = initialAmount ?? 0

  function renderFigures() {
    const figures = calcFrictionFigures(amount, config)
    delayWarningEl.textContent = `이번 결제(${formatWon(amount)})를 참으면 목표 달성 게이지가 +${figures.gaugeGainPercent}% 채워집니다!`
    figuresEl.innerHTML = `
      <div class="pb-figure-row"><span class="label">결제 금액</span><span class="value">${formatWon(amount)}</span></div>
      <div class="pb-figure-row"><span class="label">내 시급 기준 노동 시간</span><span class="value">${figures.workHours}시간</span></div>
      <div class="pb-figure-row"><span class="label">게이지 증가량</span><span class="value">+${figures.gaugeGainPercent}%</span></div>
      <div class="pb-figure-row"><span class="label">5년 후 기회비용 (연 8%)</span><span class="value">${formatWon(figures.futureValue)}</span></div>
    `
  }
  renderFigures()

  manualAmountInput?.addEventListener('input', () => {
    const value = Number(manualAmountInput.value)
    amount = Number.isFinite(value) && value > 0 ? value : 0
    renderFigures()
  })

  let remaining = config.cooldownSeconds
  let cooldownDone = false
  timerEl.textContent = `${remaining}초 후 [결제 진행하기] 입력창이 활성화됩니다`
  const intervalId = setInterval(() => {
    remaining -= 1
    if (remaining <= 0) {
      cooldownDone = true
      timerEl.textContent = '이제 아래 문장을 정확히 입력하면 결제를 진행할 수 있습니다'
      clearInterval(intervalId)
      updateProceedState()
    } else {
      timerEl.textContent = `${remaining}초 후 [결제 진행하기] 입력창이 활성화됩니다`
    }
  }, 1000)

  function updateProceedState() {
    const matches = cooldownDone && confessionInput.value === CONFESSION_SENTENCE
    proceedBtn.disabled = !matches
    proceedBtn.classList.toggle('pb-enabled', matches)
  }
  confessionInput.addEventListener('input', updateProceedState)

  function destroy() {
    clearInterval(intervalId)
    host.remove()
    document.documentElement.style.overflow = previousOverflow
  }

  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true
    saveBtn.textContent = '저장 중...'
    const figures = calcFrictionFigures(amount, config)
    await sendMessage({
      type: 'RECORD_PROTECTED',
      amount,
      siteDomain,
      workHoursSaved: figures.workHours,
      hourlyWageAtLog: config.hourlyWage,
    })
    destroy()
    if (history.length > 1) {
      history.back()
    } else {
      // No previous page to return to (e.g. tab opened fresh) — close the tab instead.
      await sendMessage({ type: 'CLOSE_TAB' })
    }
  })

  proceedBtn.addEventListener('click', async () => {
    if (proceedBtn.disabled) return
    await sendMessage({ type: 'RECORD_OVERRIDE' })
    destroy()
  })

  return { destroy }
}
