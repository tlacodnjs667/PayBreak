import { storage } from '../shared/storage'
import type { SalaryType, UserConfig } from '../shared/types'
import { calcHourlyFromMonthlySalary } from '../shared/calculations'
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

async function render() {
  const { userConfig, stats, protectedLogs } = await storage.getAll()
  const app = document.getElementById('app')!

  const progressPct = Math.min(100, Math.round((stats.totalProtectedAmount / userConfig.targetAmount) * 100))

  app.innerHTML = `
    <p class="title">PayBreak</p>
    <p class="tagline">결제 직전 30초의 브레이크, 1억 달성을 지킵니다.</p>

    <div class="progress-track"><div class="progress-fill" style="width: ${progressPct}%"></div></div>
    <p class="progress-label">${formatWon(stats.totalProtectedAmount)} / ${formatWon(userConfig.targetAmount)} (${progressPct}%)</p>

    <div class="stat-grid">
      <div class="stat-card">
        <div class="value protected">${formatWon(stats.totalProtectedAmount)}</div>
        <div class="label">총 방어 성공 금액</div>
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
        <div class="value">${stats.protectedCount + stats.overrideCount === 0 ? '-' : `${Math.round((stats.protectedCount / (stats.protectedCount + stats.overrideCount)) * 100)}%`}</div>
        <div class="label">이탈률</div>
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
  `

  const periodTabs = app.querySelectorAll<HTMLButtonElement>('.period-tab')
  periodTabs.forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedPeriod = btn.dataset.period as ReportPeriod
      render()
    })
  })

  const csvExportBtn = app.querySelector<HTMLButtonElement>('#pb-csv-export')!
  csvExportBtn.addEventListener('click', () => downloadProtectedLogsCsv(protectedLogs))

  const targetInput = app.querySelector<HTMLInputElement>('#pb-target')!
  const presetBtns = app.querySelectorAll<HTMLButtonElement>('.preset-btn')

  async function syncTargetAmount(amount: number) {
    if (!Number.isFinite(amount) || amount <= 0) return
    await storage.setUserConfig({ targetAmount: amount })
    render()
  }

  presetBtns.forEach((btn) => {
    btn.addEventListener('click', () => syncTargetAmount(Number(btn.dataset.amount)))
  })

  targetInput.addEventListener('change', () => syncTargetAmount(Number(targetInput.value)))

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
