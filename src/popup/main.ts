import { storage } from '../shared/storage'
import type { SalaryType, UserConfig } from '../shared/types'
import {
  calcDefenseRate,
  calcDefenseTier,
  calcHourlyFromMonthlySalary,
  calcMonthlySavingsTarget,
  calcNetSavings,
  type DefenseTier,
} from '../shared/calculations'
import { aggregateByPeriod, downloadProtectedLogsCsv, type ReportPeriod } from './report'

function formatWon(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`
}

const PERIOD_LABELS: Record<ReportPeriod, string> = {
  daily: '일별',
  monthly: '월별',
  yearly: '연별',
}

let selectedPeriod: ReportPeriod = 'monthly'

type Tab = 'dashboard' | 'settings'
let selectedTab: Tab = 'dashboard'

function renderReportRows(protectedLogs: Awaited<ReturnType<typeof storage.getAll>>['protectedLogs'], period: ReportPeriod): string {
  const aggregates = aggregateByPeriod(protectedLogs, period)
  if (aggregates.length === 0) {
    return '<p class="report-empty">아직 방어 내역이 없어요.</p>'
  }
  return aggregates
    .map(
      (a) => `
        <div class="report-row">
          <span class="report-key">${a.key}</span>
          <span class="report-amount">${formatWon(a.totalAmount)}</span>
          <span class="report-hours">${Math.round(a.totalWorkHours * 10) / 10}시간</span>
        </div>
      `
    )
    .join('')
}

const TIER_LABELS: Record<DefenseTier, string> = {
  S: 'S등급',
  A: 'A등급',
  B: 'B등급',
  C: 'C등급',
  F: 'F등급',
}

async function render() {
  const { userConfig, stats, protectedLogs } = await storage.getAll()
  const app = document.getElementById('app')!

  const netSavings = calcNetSavings(stats.totalProtectedAmount, stats.totalOverriddenAmount)
  const defenseRate = calcDefenseRate(stats.protectedCount, stats.overrideCount)
  const tier = calcDefenseTier(defenseRate)
  const progressPct = Math.min(100, Math.round((netSavings / userConfig.targetAmount) * 100))

  app.innerHTML = `
    <div class="header-row">
      <p class="title">PayBreak</p>
      ${tier ? `<span class="tier-badge tier-${tier}">${TIER_LABELS[tier]}</span>` : ''}
    </div>
    <p class="tagline">결제 직전 30초의 브레이크, 1억 달성을 지킵니다.</p>

    <div class="tab-bar">
      <button type="button" class="tab-btn ${selectedTab === 'dashboard' ? 'active' : ''}" data-tab="dashboard">📊 대시보드</button>
      <button type="button" class="tab-btn ${selectedTab === 'settings' ? 'active' : ''}" data-tab="settings">⚙️ 설정</button>
    </div>

    <div class="tab-panel" ${selectedTab === 'dashboard' ? '' : 'hidden'}>
    <div class="progress-track"><div class="progress-fill" style="width: ${progressPct}%"></div></div>
    <p class="progress-label">순 방어 ${formatWon(netSavings)} / ${formatWon(userConfig.targetAmount)} (${progressPct}%)</p>
    ${stats.totalOverriddenAmount > 0 ? `<p class="override-warning">⚠ 결제 강행으로 ${formatWon(stats.totalOverriddenAmount)}이 게이지에서 차감되었습니다</p>` : ''}

    <div class="manual-override-section">
      <button type="button" class="manual-override-toggle-btn" id="pb-manual-override-toggle">+ 외부 지출 기록</button>
      <div class="manual-override-form" id="pb-manual-override-form" hidden>
        <p class="manual-override-hint">PayBreak이 감지하지 못한 오프라인/외부 결제도 여기에 기록하면 게이지에 정확히 반영됩니다.</p>
        <input type="number" class="manual-override-amount" id="pb-manual-amount" placeholder="지출 금액(원)" />
        <input type="text" class="manual-override-note" id="pb-manual-note" placeholder="지출처 / 메모 (예: 스타벅스)" />
        <button type="button" class="manual-override-submit-btn" id="pb-manual-override-submit">기록하기</button>
        <p class="manual-override-feedback" id="pb-manual-override-feedback"></p>
      </div>
    </div>

    <div class="stat-grid">
      <div class="stat-card">
        <div class="value protected">${formatWon(stats.totalProtectedAmount)}</div>
        <div class="label">총 방어 성공 금액</div>
      </div>
      <div class="stat-card">
        <div class="value override">${formatWon(stats.totalOverriddenAmount)}</div>
        <div class="label">결제 강행 누적액</div>
      </div>
      <div class="stat-card">
        <div class="value protected">${stats.protectedCount}</div>
        <div class="label">방어 횟수</div>
      </div>
      <div class="stat-card">
        <div class="value override">${stats.overrideCount}</div>
        <div class="label">결제 강행 횟수</div>
      </div>
      <div class="stat-card">
        <div class="value">${defenseRate === null ? '-' : `${defenseRate}%`}</div>
        <div class="label">방어 성공률</div>
      </div>
      <div class="stat-card">
        <div class="value protected">${formatWon(netSavings)}</div>
        <div class="label">순 방어 금액</div>
      </div>
    </div>

    <div class="report-section">
      <h2>방어 내역 리포트</h2>
      <div class="period-tabs">
        ${(['daily', 'monthly', 'yearly'] as ReportPeriod[])
          .map(
            (period) =>
              `<button type="button" class="period-tab ${selectedPeriod === period ? 'active' : ''}" data-period="${period}">${PERIOD_LABELS[period]}</button>`
          )
          .join('')}
      </div>
      <div class="report-list" id="pb-report-list">
        ${renderReportRows(protectedLogs, selectedPeriod)}
      </div>
      <button class="csv-export-btn" id="pb-csv-export">CSV로 내보내기</button>
    </div>
    </div>

    <div class="tab-panel" ${selectedTab === 'settings' ? '' : 'hidden'}>
    <div class="settings">
      <h2>목표 자산 설정</h2>

      <div class="field">
        <label for="pb-target">목표 금액 (원)</label>
        <input type="number" id="pb-target" value="${userConfig.targetAmount}" />
        <div class="preset-group">
          <button type="button" class="preset-btn ${userConfig.targetAmount === 30_000_000 ? 'active' : ''}" data-amount="30000000">3천만</button>
          <button type="button" class="preset-btn ${userConfig.targetAmount === 50_000_000 ? 'active' : ''}" data-amount="50000000">5천만</button>
          <button type="button" class="preset-btn ${userConfig.targetAmount === 100_000_000 ? 'active' : ''}" data-amount="100000000">1억</button>
          <button type="button" class="preset-btn ${userConfig.targetAmount === 200_000_000 ? 'active' : ''}" data-amount="200000000">2억</button>
        </div>
      </div>

      <div class="field">
        <label for="pb-target-months">목표 달성 기간 (개월)</label>
        <input type="number" id="pb-target-months" value="${userConfig.targetMonths}" />
        <div class="preset-group">
          <button type="button" class="preset-btn ${userConfig.targetMonths === 12 ? 'active' : ''}" data-months="12">1년</button>
          <button type="button" class="preset-btn ${userConfig.targetMonths === 24 ? 'active' : ''}" data-months="24">2년</button>
          <button type="button" class="preset-btn ${userConfig.targetMonths === 36 ? 'active' : ''}" data-months="36">3년</button>
          <button type="button" class="preset-btn ${userConfig.targetMonths === 60 ? 'active' : ''}" data-months="60">5년</button>
        </div>
        <p class="hint" id="pb-monthly-savings-hint">매달 약 ${calcMonthlySavingsTarget(userConfig.targetAmount, userConfig.targetMonths).toLocaleString('ko-KR')}원씩 모아야 목표를 달성할 수 있습니다.</p>
      </div>

      <h2 class="section-gap">내 설정</h2>

      <div class="field">
        <label>시급 입력 방식</label>
        <div class="radio-group">
          <label><input type="radio" name="pb-salary-type" value="hourly" ${userConfig.salaryType === 'hourly' ? 'checked' : ''} /> 시급 직접 입력</label>
          <label><input type="radio" name="pb-salary-type" value="monthly" ${userConfig.salaryType === 'monthly' ? 'checked' : ''} /> 월급으로 계산</label>
        </div>
      </div>

      <div class="field" id="pb-hourly-field" style="display: ${userConfig.salaryType === 'hourly' ? 'block' : 'none'}">
        <label for="pb-wage">시급 (원)</label>
        <input type="number" id="pb-wage" value="${userConfig.hourlyWage}" />
      </div>

      <div class="field" id="pb-monthly-field" style="display: ${userConfig.salaryType === 'monthly' ? 'block' : 'none'}">
        <label for="pb-monthly-salary">월급 (실수령액, 원)</label>
        <input type="number" id="pb-monthly-salary" value="${userConfig.monthlySalary || ''}" />
        <p class="hint" id="pb-hourly-hint">환산 시급: ${calcHourlyFromMonthlySalary(userConfig.monthlySalary).toLocaleString('ko-KR')}원 (월급 ÷ 209시간)</p>
        <p class="caption">※ 주 40시간 근무 기준 (법정 유급휴일·주휴수당 포함, 월 209시간 적용)</p>
      </div>

      <button class="save-settings-btn" id="pb-save">설정 저장</button>
    </div>
    </div>
  `

  const tabBtns = app.querySelectorAll<HTMLButtonElement>('.tab-btn')
  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedTab = btn.dataset.tab as Tab
      render()
    })
  })

  const periodTabs = app.querySelectorAll<HTMLButtonElement>('.period-tab')
  periodTabs.forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedPeriod = btn.dataset.period as ReportPeriod
      render()
    })
  })

  const csvExportBtn = app.querySelector<HTMLButtonElement>('#pb-csv-export')!
  csvExportBtn.addEventListener('click', () => downloadProtectedLogsCsv(protectedLogs))

  const manualOverrideToggleBtn = app.querySelector<HTMLButtonElement>('#pb-manual-override-toggle')!
  const manualOverrideForm = app.querySelector<HTMLDivElement>('#pb-manual-override-form')!
  const manualOverrideAmountInput = app.querySelector<HTMLInputElement>('#pb-manual-amount')!
  const manualOverrideNoteInput = app.querySelector<HTMLInputElement>('#pb-manual-note')!
  const manualOverrideSubmitBtn = app.querySelector<HTMLButtonElement>('#pb-manual-override-submit')!
  const manualOverrideFeedback = app.querySelector<HTMLParagraphElement>('#pb-manual-override-feedback')!

  manualOverrideToggleBtn.addEventListener('click', () => {
    manualOverrideForm.hidden = !manualOverrideForm.hidden
  })

  manualOverrideSubmitBtn.addEventListener('click', async () => {
    const amount = Number(manualOverrideAmountInput.value)
    if (!Number.isFinite(amount) || amount <= 0) return
    const note = manualOverrideNoteInput.value.trim() || '기타 외부 지출'

    manualOverrideSubmitBtn.disabled = true
    const { workHoursConsumed } = await storage.recordManualOverride(note, amount)
    manualOverrideFeedback.textContent = `기록 완료: 노동 시간 ${workHoursConsumed}시간이 소모되었습니다.`
    setTimeout(() => render(), 900)
  })

  const targetInput = app.querySelector<HTMLInputElement>('#pb-target')!
  const targetMonthsInput = app.querySelector<HTMLInputElement>('#pb-target-months')!
  const monthlySavingsHint = app.querySelector<HTMLParagraphElement>('#pb-monthly-savings-hint')!
  const amountPresetBtns = app.querySelectorAll<HTMLButtonElement>('.preset-btn[data-amount]')
  const monthPresetBtns = app.querySelectorAll<HTMLButtonElement>('.preset-btn[data-months]')

  function updateMonthlySavingsHint() {
    const amount = Number(targetInput.value) || userConfig.targetAmount
    const months = Number(targetMonthsInput.value) || userConfig.targetMonths
    const target = calcMonthlySavingsTarget(amount, months)
    monthlySavingsHint.textContent = `매달 약 ${target.toLocaleString('ko-KR')}원씩 모아야 목표를 달성할 수 있습니다.`
  }

  async function syncTargetAmount(amount: number) {
    if (!Number.isFinite(amount) || amount <= 0) return
    const months = Number(targetMonthsInput.value) || userConfig.targetMonths
    await storage.setUserConfig({ targetAmount: amount, monthlySavingsTarget: calcMonthlySavingsTarget(amount, months) })
    render()
  }

  async function syncTargetMonths(months: number) {
    if (!Number.isFinite(months) || months <= 0) return
    const amount = Number(targetInput.value) || userConfig.targetAmount
    await storage.setUserConfig({ targetMonths: months, monthlySavingsTarget: calcMonthlySavingsTarget(amount, months) })
    render()
  }

  amountPresetBtns.forEach((btn) => {
    btn.addEventListener('click', () => syncTargetAmount(Number(btn.dataset.amount)))
  })

  monthPresetBtns.forEach((btn) => {
    btn.addEventListener('click', () => syncTargetMonths(Number(btn.dataset.months)))
  })

  targetInput.addEventListener('input', updateMonthlySavingsHint)
  targetInput.addEventListener('change', () => syncTargetAmount(Number(targetInput.value)))

  targetMonthsInput.addEventListener('input', updateMonthlySavingsHint)
  targetMonthsInput.addEventListener('change', () => syncTargetMonths(Number(targetMonthsInput.value)))

  const hourlyField = app.querySelector<HTMLDivElement>('#pb-hourly-field')!
  const monthlyField = app.querySelector<HTMLDivElement>('#pb-monthly-field')!
  const monthlySalaryInput = app.querySelector<HTMLInputElement>('#pb-monthly-salary')!
  const hourlyHint = app.querySelector<HTMLParagraphElement>('#pb-hourly-hint')!
  const salaryTypeInputs = app.querySelectorAll<HTMLInputElement>('input[name="pb-salary-type"]')

  salaryTypeInputs.forEach((input) => {
    input.addEventListener('change', () => {
      const isMonthly = input.value === 'monthly' && input.checked
      hourlyField.style.display = isMonthly ? 'none' : 'block'
      monthlyField.style.display = isMonthly ? 'block' : 'none'
    })
  })

  monthlySalaryInput.addEventListener('input', () => {
    const hourly = calcHourlyFromMonthlySalary(Number(monthlySalaryInput.value))
    hourlyHint.textContent = `환산 시급: ${hourly.toLocaleString('ko-KR')}원 (월급 ÷ 209시간)`
  })

  const saveBtn = app.querySelector<HTMLButtonElement>('#pb-save')!
  saveBtn.addEventListener('click', async () => {
    const salaryType = (app.querySelector<HTMLInputElement>('input[name="pb-salary-type"]:checked')!.value) as SalaryType
    const monthlySalary = Number(monthlySalaryInput.value) || 0
    const hourlyWage =
      salaryType === 'monthly'
        ? calcHourlyFromMonthlySalary(monthlySalary)
        : Number(app.querySelector<HTMLInputElement>('#pb-wage')!.value) || userConfig.hourlyWage

    const patch: Partial<UserConfig> = {
      salaryType,
      monthlySalary,
      hourlyWage,
    }
    await storage.setUserConfig(patch)
    saveBtn.textContent = '저장됨'
    saveBtn.classList.add('saved')
    setTimeout(() => render(), 600)
  })
}

render()
