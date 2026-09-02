# PayBreak Development Guidelines & Strict Constraints

## 1. Project Overview & Scope
- Project: PayBreak (Chrome Extension Manifest V3)
- Purpose: Block impulse checkout pages and enforce mindful friction (30-second countdown, typing verification, work-hour conversion).
- Rule-based MVP: No AI APIs (Gemini/OpenAI) in v1.0.

## 2. Strict Architectural Constraints
- Storage: ONLY use `chrome.storage.local`. Do NOT spin up external databases or backend APIs.
- Tab Management: On "Abandon Purchase" (Route A), send a runtime message to the background service worker to execute `chrome.tabs.remove()`. NEVER rely on `window.close()`.
- Price Parsing: Use regex and keyword text scanning ("총 결제금액", "결제금액" etc.) as primary. Fallback to manual input UI if parsing fails.
- Bundle & Libraries: Keep it lightweight. Use Vite + CRXJS + TypeScript. Do NOT add heavy external styling frameworks (Tailwind, MUI) unless strictly necessary.

## 3. Core Business Logic Rules
- 30-Second Lockdown: The "Proceed" button MUST stay disabled until the 30s timer hits 0.
- Strict Verification: After 30s, the proceed button only unlocks when the user types exact text: "나는 1억 모으기 목표보다 이 물건이 지금 당장 더 가치 있다고 확신합니다."
- Protection Counter: Accumulate protected purchase amount to `totalProtectedAmount` in `chrome.storage.local` upon purchase abandonment.