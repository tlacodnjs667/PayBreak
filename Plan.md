# [PRD] PayBreak: 1억 달성을 위한 쇼핑 결제 브레이커

**문서 버전:** v1.0 (규칙 기반 MVP)

**역할:** 프로덕트 기획자

**개발 대상:** Antigravity (프론트엔드/익스텐션 엔지니어링)

---

## 1. 프로젝트 배경 및 핵심 목표

* **배경:** 1억 원 자산 형성을 목표로 하는 2030 청년층이 겪는 가장 큰 누수는 쇼핑몰의 '1초 간편결제'로 인한 충동구매임.
* **목표:** 결제 페이지(`/checkout`, `/order`, `/pay`) 진입 시점에 물리적 마찰(30초 잠금)과 인지적 충격(내 시급 환산 노동 시간, 목표 달성 게이지 증가율)을 제공하여 결제를 포기하도록 유도.
* **UX 정책 (v1.1):** 추상적인 '월 저축액 대비 지연일수' 개념을 폐기하고, 구매를 참을 때마다 방어 금액이 실시간으로 목표 게이지를 채우는 **방어 적립형 게이지 모델**로 전환. 유저는 목표 금액(`targetAmount`)과 시급(`hourlyWage`)만 설정하면 되고, 게이지는 실제 방어 성공 금액(`totalProtectedAmount`) 누적으로만 채워짐.
* **핵심 지표(North Star Metric):**
* 총 방어 성공 금액 (`totalProtectedAmount`)
* 결제창 이탈률 (방어 모달 진입 대비 [구매 포기] 클릭 비율, 목표치 70% 이상)



---

## 2. 사용자 플로우 (User Journey)

```text
[1. 쇼핑몰 결제 페이지 진입] (쿠팡, 네이버페이 등)
             ↓
[2. 화면 전체 잠금 (Full Overlay)]
  - 결제 진행 버튼 30초 카운트다운 잠금
  - 결제 금액 파싱 → 시급 기준 노동시간 & 목표 달성 게이지 증가율(%) 붉은색 노출
             ↓
[3. 유저 선택 분기]
  ├─ [루트 A: 구매 포기 (성공 경로)]
  │     → 방어 금액을 '세이브 통장'에 누적 기록 (백그라운드 서비스 워커에 기록 메시지 전송)
  │     → history.back()으로 이전 페이지(장바구니/상세페이지)로 복귀
  │       (history.length <= 1로 되돌아갈 페이지가 없는 새 탭인 경우에 한해 chrome.tabs.remove()로 탭 종료 — Fallback)
  │       (window.close()는 사용하지 않음 — 스크립트가 직접 열지 않은 탭은 닫을 수 없음)
  │
  └─ [루트 B: 결제 강행 (패널티 경로)]
        → 30초 타이머 종료 대기
        → 반성문 타이핑 ("나는 1억 모으기보다 이 물건이 더 가치 있다고 확신합니다")
        → 정확히 일치 시 1회 한정 결제창 잠금 해제

```

---

## 3. 기능 요구사항 명세 (Functional Specs)

### 3.1. 결제 페이지 트리거 감지 (Detection Engine)

* **감지 범위:** URL 패턴 기반 감지
* 네이버페이: `*://[order.pay.naver.com/](https://order.pay.naver.com/)*`, `*://[pay.naver.com/](https://pay.naver.com/)*`
* 쿠팡: `*://*[.coupang.com/vp/orders/](https://.coupang.com/vp/orders/)*`, `*://*[.coupang.com/checkout/](https://.coupang.com/checkout/)*`
* 스마트스토어: `*://[order.pay.naver.com/orderSheet/](https://order.pay.naver.com/orderSheet/)*`
* 기타 커머스: URL 내 `/order`, `/checkout`, `/pay` 포함 여부 스캔


* **방어 동작:**
* 조건 만족 시 즉시 쇼핑몰 DOM 상단에 `z-index: 2147483647` (최상단) 고정 오버레이 렌더링.
* 스크롤 및 배경 클릭 강제 차단.



### 3.2. 실시간 데이터 파싱 및 연산 규칙 (Friction Calculator)

* **결제 금액 파싱:** 쿠팡/네이버페이 등은 DOM 클래스명이 자주 바뀌어 셀렉터 기반 추출은 깨지기 쉬움. **정규식 + 키워드 텍스트 스캔("총 결제금액", "결제금액" 등 인접 금액 탐색)을 1차 방식으로 사용**하고, 파싱 실패 시 모달 내 "결제 예정 금액을 직접 입력하세요" 인풋을 폴백으로 제공.
* **연산 규칙:**
* **노동 시간 환산:** $\text{노동 시간(h)} = \frac{\text{결제 금액}}{\text{유저 설정 시급}}$ (소수점 첫째 자리 반올림)
* **목표 게이지 증가율 산출:** $Y\% = \frac{\text{결제 금액}}{\text{목표 금액(targetAmount)}} \times 100$ (소수점 첫째 자리 반올림)


* **5년 복리 기회비용 (연 8% S&P500 기준):** $\text{미래 가치} = \text{결제 금액} \times (1 + 0.08)^5 \approx \text{결제 금액} \times 1.47$



### 3.3. 방어 모달 UI/UX 규칙 (Modal Interactions)

* **30초 쿨다운 타이머:**
* 결제창 열림과 동시에 `30... 29... 1` 카운트다운 시작.
* 타이머 동작 중 [결제 진행하기] 버튼은 `disabled` 처리.


* **모달 상단 게이지 증가 안내 문구 (동적):**
* "이번 결제(₩X)를 참으면 목표 달성 게이지가 +Y% 채워집니다!" 형태. Y% = (결제 금액 / `targetAmount`) × 100 (소수점 첫째 자리), 결제 금액이 바뀔 때마다(수동 입력 등) 실시간 재계산.

* **강제 문장 검증 (Typing Lock):**
* 30초가 지나도 버튼이 바로 열리지 않음.
* 지정 문장 (동적): **"나는 [포맷팅된 목표 금액] 모으기 목표보다 이 물건이 지금 당장 더 가치 있다고 확신합니다."** (예: targetAmount=50,000,000 → "나는 5,000만 원 모으기 목표보다...", targetAmount=100,000,000 → "나는 1억 원 모으기 목표보다...")
* Input 값과 지정 문장이 100% 일치해야 [결제 진행하기] 버튼 활성화.


* **세이브 액션 [결제 포기하고 (목표 금액) 지키기] (Primary Button, 동적):**
* 가장 크고 눈에 띄는 색상(`Success Green`)으로 배치.
* 클릭 시 로컬 스토리지에 방어 내역 적재 후, `history.length > 1`이면 `history.back()`으로 이전 페이지(장바구니/상세페이지)로 이동.
* `history.length <= 1`(되돌아갈 페이지가 없는 새 탭)인 경우에만 Fallback으로 백그라운드 서비스 워커에 메시지를 보내 `chrome.tabs.remove()`로 탭 종료 (`window.close()` 사용 금지).



### 3.4. 도덕적 해이 방지 및 순(Net) 방어 게이지 (Anti-Abuse & Net Gauge)

* **순(Net) 방어 게이지 및 결제 강행 차감:**
  * `stats`에 `totalOverriddenAmount`(결제 강행 누적액) 필드 추가.
  * 30초 쿨다운과 문장 검증을 통과하고 [결제 진행하기]를 클릭한 경우(`RECORD_OVERRIDE`), 해당 결제 금액을 `totalOverriddenAmount`에 가산.
  * 대시보드 게이지 연산식: `netSavings = Math.max(0, totalProtectedAmount - totalOverriddenAmount)`. 강행 결제 발생 시 게이지가 차감되며 팝업 상단에 위험 경고 문구 노출.
* **방어 성공률(Defense Rate) 등급 시스템:**
  * 계산식: `defenseRate = Math.round((protectedCount / (protectedCount + overrideCount)) * 100)`.
  * 등급 기준: 95% 이상 S / 80% 이상 A / 65% 이상 B / 50% 이상 C / 50% 미만 F.
  * 팝업 대시보드 상단에 방어 등급(Tier Badge) 노출.
* **중복 방어 어뷰징 캡 (Short-term Abuse Prevention):**
  * 동일 도메인(`siteDomain`)에서 10분 이내에 연속으로 결제창을 닫아 발생하는 방어 로그는 `protectedLogs`에는 그대로 기록(`isDuplicateAttempt: true`)하되, `totalProtectedAmount`·`protectedCount` 등 통계 누적에서는 제외.
  * 방어 내역 리포트(일/월/연 집계) 및 CSV 내보내기는 `isDuplicateAttempt` 로그를 통계 합산에서 제외하고, CSV에는 "비고" 컬럼에 "중복 시도"로 표시.

### 3.5. 팝업 리포트 CSV 당시시급 Fallback (Hotfix)

* `hourlyWageAtLog` 필드 도입 이전에 기록된 구버전 `protectedLogs`는 해당 키가 storage에 존재하지 않아 CSV의 "당시시급" 컬럼이 `undefined`로 출력되는 문제가 있었음.
* `ProtectedLog.hourlyWageAtLog`를 optional로 전환하고, CSV 생성 시 값이 없으면 `Math.round(amount / workHoursSaved)`로 역산하여 채우는 Fallback 적용.

### 3.6. 익스텐션 팝업 대시보드 (Popup UI)

* **목표 현황:** 프로그레스 바 (총 방어 성공 금액 `totalProtectedAmount` / 유저 설정 목표 금액 `targetAmount`, 기본값 100,000,000원). [구매 포기]를 누를 때마다 `totalProtectedAmount`가 누적되어 게이지가 차오름.
* **목표 금액 커스텀 설정:**
* 목표 금액(`targetAmount`) 직접 입력 필드 제공.
* 빠른 입력용 프리셋 버튼: [3천만], [5천만], [1억], [2억].
* 입력/프리셋 클릭 즉시 `chrome.storage.local`의 `userConfig.targetAmount`에 동기화 (다른 설정 필드와 달리 [설정 저장] 버튼 클릭을 기다리지 않음).
* **방어 통계:**
* 총 방어 성공 금액 (예: 1,450,000원 방어 완료).
* 방어 횟수 vs 결제 강행 횟수.


* **유저 기본 설정 폼:** 유저 시급(기본값 15,000원)만 입력받음. (월 저축 목표액/현재 보유 자산 입력 필드는 v1.1에서 폐지 — 목표 게이지는 방어 성공 금액 누적으로만 채워짐.)
* **시급 입력 방식 토글 (라디오 버튼):**
* [시급 직접 입력] / [월급으로 계산] 두 옵션 중 선택.
* [월급으로 계산] 선택 시 실수령액(월급) 입력 필드 노출, 다음 공식으로 시급 자동 산출 및 저장: `hourlyWage = Math.round(monthlySalary / 209)` (주 40시간 기준 월 209시간 환산).
* 산출 근거 오해를 방지하기 위해 월급 입력/환산 시급 표시 영역 하단에 안내 캡션 문구 노출: "※ 주 40시간 근무 기준 (법정 유급휴일·주휴수당 포함, 월 209시간 적용)"

* **방어 내역 리포트 (기간별 집계):**
* `protectedLogs`의 `timestamp` 기준 [일별 / 월별 / 연별] 필터 탭 제공.
* 선택된 기간 단위로 그룹화하여 각 그룹의 "총 방어 금액"과 "누적 환산 노동 시간"(그룹 내 각 로그의 `workHoursSaved` 합산) 표시.
* **CSV(엑셀) 내보내기:**
* 외부 API/라이브러리 없이 브라우저 내장 `Blob` + `URL.createObjectURL`로 다운로드 구현.
* 엑셀 한글 깨짐 방지를 위해 UTF-8 BOM(`﻿`) 필수 포함.
* 파일명 포맷: `PayBreak_Savings_YYYYMMDD.csv`.
* 컬럼: 날짜, 사이트, 결제금액, 노동시간, 당시시급(`hourlyWageAtLog` — 로그 기록 시점의 `hourlyWage` 스냅샷, 이후 시급이 바뀌어도 과거 기록은 왜곡되지 않도록 보존).

### 3.7. 목표 달성 기간 설정 및 월 저축액 가이드 산출 (Target Timeline & Monthly Savings Guide)

* **Popup 설정 UI 확장:** "목표 자산 설정" 섹션에 `targetMonths`(목표 달성 기간, 개월 수) 입력 필드와 프리셋 칩 [1년(12)] / [2년(24)] / [3년(36)] / [5년(60)] 추가. 목표 금액 프리셋과 동일하게 입력/클릭 즉시 `userConfig`에 동기화(설정 저장 버튼 대기 없음).
* **실시간 연산 결과 카드:** `monthlySavingsTarget = Math.round(targetAmount / targetMonths)`를 목표 금액·목표 기간 입력 시 실시간 재계산하여 "매달 약 {monthlySavingsTarget}원씩 모아야 목표를 달성할 수 있습니다." 안내 문구로 노출.
* **영속화:** `userConfig`에 `targetMonths`, `monthlySavingsTarget` 필드 추가 후 `chrome.storage.local`에 저장. `targetAmount` 또는 `targetMonths`가 바뀔 때마다 `monthlySavingsTarget`도 함께 재계산하여 저장(둘 중 하나만 갱신되어 값이 어긋나는 상태 방지).
* **결제창 모달 카피 연계:** 모달 내 `pb-monthly-warning` 문구로 "이번 결제(₩X)를 참으면 이번 달 저축 목표(₩{monthlySavingsTarget})의 +Y%를 즉시 채웁니다!" 노출. `Y% = Math.round((결제금액 / monthlySavingsTarget) * 100)`, 결제 금액이 바뀔 때마다(수동 입력 등) 실시간 재계산. `monthlySavingsTarget`이 0 이하이면(미설정) 문구를 표시하지 않음.

### 3.8. 외부/오프라인 낭비 지출 수동 차감 (Direct Override)

* **배경:** PayBreak은 등록된 커머스 결제 페이지 진입만 감지하므로, 오프라인 결제나 감지 범위 밖 사이트에서의 낭비 지출은 게이지에 반영되지 않아 순 방어 게이지(`netSavings`)가 실제보다 부풀려질 수 있음. 이를 수동으로 보정하는 차감 기능을 제공.
* **정책 (v1.2, 롤백 확정):** 가계부성 확장(날짜 선택, 카테고리 분기, 필수/충동 지출 유형 토글, 필수 고정비 별도 통계)은 코어 '결제 브레이커' 스코프를 벗어난다고 판단해 전면 롤백. 외부 지출 기록은 오직 "낭비 지출 차감" 하나의 단순 동작으로만 존재하며, 필수 고정비(월세·공과금 등)를 구분해 관리하는 로직은 포함하지 않는다.
* **Popup UI:** 대시보드(진행률 게이지 하단, 통계 카드 위)에 `[+ 낭비 지출 차감]` 토글 버튼 배치. 클릭 시 금액(`amount`)과 한 줄 메모(`memo`) 입력 폼만 펼쳐짐.
* **데이터 연산 및 차감 반영 (`storage.recordManualOverride`):**
  * 입력 금액을 결제 강행과 동일하게 `stats.totalOverriddenAmount`에 가산(`+= amount`)하고 `stats.overrideCount`도 함께 `+= 1`하여 방어 성공률·Tier 산정에도 반영.
  * `netSavings = Math.max(0, totalProtectedAmount - totalOverriddenAmount)`가 팝업 재렌더링 시 자동 재계산되어 게이지·목표 달성률이 즉시 차감 갱신됨.
  * 당시 설정된 `userConfig.hourlyWage` 기준으로 소모된 노동 시간을 `calcWorkHours(amount, hourlyWage)`로 계산해 "차감 완료: 노동 시간 N시간이 소모되어 게이지에서 차감되었습니다" 피드백 문구로 즉시 표시.
* **로그 적재 및 CSV 호환:** `protectedLogs`에 `{ siteDomain: "[낭비차감] " + memo, amount, workHoursSaved: -(amount / hourlyWage), hourlyWageAtLog: userConfig.hourlyWage, isOverridden: true }` 형태로 동일 스키마에 적재하여 CSV 내보내기(비고 컬럼에 "낭비 지출 차감" 표시)와 완전 호환. `siteDomain`에 "[낭비차감] " 접두어를 붙여 실제 감지된 결제 도메인과 시각적으로 구분. 방어 내역 리포트(일/월/연 집계)에서는 `isDuplicateAttempt` 로그와 동일하게 통계 합산에서 제외(방어 총액이 아닌 차감 기록이므로).

### 3.9. Popup UI 2-Tab 구조 확정 (Tab Navigation)

* **배경:** 팝업에 순 방어 게이지·낭비 지출 차감·6종 통계 카드·리포트·목표 설정·급여 설정이 한 화면에 모두 쌓이며 세로 스크롤이 길어짐. 정보 계층을 "확인/기록(대시보드)"과 "구성(환경설정)"으로 분리.
* **상단 탭 바:** 헤더(`title`/Tier Badge)·태그라인 아래에 `[📊 대시보드]` / `[⚙️ 환경설정]` 2단 탭 신설. 기본 활성 탭은 `대시보드`. 탭 상태는 팝업 세션 내 메모리 변수(`selectedTab`)로 유지, 클릭 시 즉시 재렌더링.
* **탭 1 [📊 대시보드]:** 순 방어 게이지(프로그레스 바 + 강행 차감 경고문), `[+ 낭비 지출 차감]` 토글 폼, 6그리드 통계 카드(총 방어/강행 누적/방어 횟수/강행 횟수/방어 성공률/순 방어 금액), 방어 로그 리포트(일/월/연 탭 + 리스트), `[CSV 내보내기]` 버튼.
* **탭 2 [⚙️ 환경설정]:** 목표 금액(`targetAmount`) 입력 + 프리셋, 목표 기간(`targetMonths`) 입력 + 프리셋 + 월 필요 저축액 역산 안내 카드, 급여 설정(시급 직접 입력 / 월급 209시간 역산 토글 + 안내 캡션), `[설정 저장]` 버튼.
* **레이아웃 최적화:** 크롬 익스텐션 팝업 표시 한계(최대 높이 약 600px)를 고려해 `#app` 패딩과 각 섹션 간 여백(`margin-bottom`/`padding-top`)을 축소하고 리포트 리스트의 `max-height`를 줄여, 탭 분리와 함께 양쪽 탭 모두 불필요한 스크롤 없이 들어가도록 조정. `body`에 `max-height: 600px; overflow-y: auto`를 명시해 안전장치로 유지.

---

## 4. 로컬 데이터 스키마 명세 (Chrome Local Storage)

별도 백엔드 없이 `chrome.storage.local`에서 관리하는 데이터 구조입니다.

```json
{
  "userConfig": {
    "targetAmount": 100000000,
    "targetMonths": 60,
    "monthlySavingsTarget": 1666667,
    "hourlyWage": 15000,
    "cooldownSeconds": 30,
    "salaryType": "hourly",
    "monthlySalary": 0
  },
  "stats": {
    "totalProtectedAmount": 0,
    "totalOverriddenAmount": 0,
    "protectedCount": 0,
    "overrideCount": 0
  },
  "protectedLogs": [
    {
      "id": "uuid",
      "timestamp": "2026-09-02T10:30:00Z",
      "siteDomain": "coupang.com",
      "amount": 89000,
      "workHoursSaved": 5.9,
      "hourlyWageAtLog": 15000,
      "isDuplicateAttempt": false
    }
  ]
}

```

---

## 5. Antigravity 개발 인계 체크리스트

* [x] **Manifest V3:** `permissions: ["storage"]`만 등록(최소 권한 원칙 — `chrome.tabs.remove()`는 `tabs`/`activeTab` 권한 없이도 호출 가능하므로 미사용 권한 제거, Chrome Web Store 심사 정책 대응), `content_scripts.matches`로 `http://*/*`/`https://*/*` 커머스 호스트 대응
* [ ] **Content Script Injection:** 페이지 로드 완료 전 최상단 오버레이 주입 및 배경 스크롤 차단 (`overflow: hidden`)
* [ ] **Price Extractor:** 정규식/키워드 텍스트 스캔을 1차 방식으로 구현 (셀렉터 클래스 의존 금지), 실패 시 Fallback 수동 인풋 UI 제공
* [ ] **Verification Logic:** 30초 타이머 인터벌 및 텍스트 `onChange` 일치 검증 로직 구현
* [ ] **Tab Closer:** [구매 포기] 트리거 시 `history.length > 1`이면 `history.back()`으로 이전 페이지 복귀, `history.length <= 1`일 때만 content script → background service worker 런타임 메시지 → `chrome.tabs.remove()`로 Fallback 처리 (`window.close()` 사용 금지)
* [ ] **Wage Input Toggle:** Popup에 시급 직접 입력 / 월급 입력 라디오 토글 구현, 월급 선택 시 `hourlyWage = Math.round(monthlySalary / 209)` 자동 산출 및 `salaryType`, `monthlySalary`, `hourlyWage` 모두 `chrome.storage.local`에 저장
* [ ] **Custom Target Amount:** Popup에 목표 금액 입력 필드 + 프리셋 버튼(3천만/5천만/1억/2억) 구현, 클릭/입력 즉시 `userConfig.targetAmount`에 동기화; 결제창 모달의 지연일 경고 문구·타이핑 검증 문장·세이브 버튼 텍스트를 `targetAmount` 기준으로 동적 생성(한국식 단위 포맷팅)
* [ ] **Gauge Model Migration (v1.1):** `userConfig`에서 `monthlyTarget`/`currentSavings` 제거, `calcDelayDays` → `calcGaugeGainPercent`로 대체, 모달 상단 문구를 게이지 증가율(%) 기반으로 전환, Popup 프로그레스 바를 `totalProtectedAmount / targetAmount` 기준으로 전환
* [ ] **Protection Log Report & CSV Export:** Popup에 `protectedLogs` 일별/월별/연별 집계 탭(기간별 총 방어 금액·누적 노동 시간 합산) 추가, Blob + `URL.createObjectURL` 기반 CSV 다운로드 구현 (UTF-8 BOM 포함, 파일명 `PayBreak_Savings_YYYYMMDD.csv`, 컬럼: 날짜/사이트/결제금액/노동시간/당시시급). `ProtectedLog`에 `hourlyWageAtLog` 필드 추가하여 로그 시점의 시급을 보존
* [x] **Net Gauge & Override Deduction:** `stats.totalOverriddenAmount` 추가, `RECORD_OVERRIDE` 메시지에 결제 금액을 실어 강행 시 누적, Popup 게이지를 `netSavings = Math.max(0, totalProtectedAmount - totalOverriddenAmount)` 기준으로 전환, 강행 발생 시 위험 경고 문구 노출
* [x] **Defense Tier Badge:** `defenseRate = Math.round(protectedCount / (protectedCount + overrideCount) * 100)` 계산 후 95%↑ S / 80%↑ A / 65%↑ B / 50%↑ C / 미만 F 등급 산정, Popup 상단에 Tier Badge 노출
* [x] **Duplicate Defense Abuse Cap:** 동일 도메인 10분 이내 연속 방어 로그는 `protectedLogs`에 `isDuplicateAttempt: true`로 기록하되 `totalProtectedAmount`/`protectedCount` 통계 누적 및 리포트 집계·CSV 합산에서 제외 (CSV "비고" 컬럼에 "중복 시도" 표시)
* [x] **Hotfix — CSV 당시시급 undefined:** `ProtectedLog.hourlyWageAtLog`를 optional로 전환(구버전 로그 호환), CSV 생성 시 값 누락 시 `Math.round(amount / workHoursSaved)`로 역산하는 Fallback 적용
* [x] **Target Timeline & Monthly Savings Guide:** `userConfig`에 `targetMonths`/`monthlySavingsTarget` 추가, Popup에 목표 기간 입력 + 프리셋 칩(1/2/3/5년) 및 실시간 월 저축액 가이드 카드 구현, 결제창 모달에 이번 달 저축 목표 대비 소진율(%) 카피 연계
* [x] **Direct Override (외부/오프라인 낭비 지출 수동 차감):** Popup에 `+ 낭비 지출 차감` 토글 폼 추가(금액+한 줄 메모만 입력), `storage.recordManualOverride`로 `totalOverriddenAmount`/`overrideCount` 갱신 및 소모 노동 시간 피드백 표시, `protectedLogs`에 `{ siteDomain: "[낭비차감] " + memo, isOverridden: true }` 로그로 적재하여 CSV/리포트 파이프라인과 호환(리포트 집계에서는 제외). 날짜 선택/카테고리 분기/필수·충동 유형 토글 등 가계부성 확장은 코어 스코프 이탈로 판단해 도입하지 않음(v1.2 결정)
* [x] **Popup 탭 분리 (대시보드/설정):** 상단 `[📊 대시보드]`/`[⚙️ 설정]` 탭 바 추가, 게이지·외부 지출 기록·통계 카드·리포트·CSV 버튼은 대시보드 탭으로, 목표/기간/급여 설정과 설정 저장 버튼은 설정 탭으로 재배치, 600px 팝업 높이 제약에 맞춰 패딩/여백 축소