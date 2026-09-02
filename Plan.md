# [PRD] PayBreak: 1억 달성을 위한 쇼핑 결제 브레이커

**문서 버전:** v1.0 (규칙 기반 MVP)

**역할:** 프로덕트 기획자

**개발 대상:** Antigravity (프론트엔드/익스텐션 엔지니어링)

---

## 1. 프로젝트 배경 및 핵심 목표

* **배경:** 1억 원 자산 형성을 목표로 하는 2030 청년층이 겪는 가장 큰 누수는 쇼핑몰의 '1초 간편결제'로 인한 충동구매임.
* **목표:** 결제 페이지(`/checkout`, `/order`, `/pay`) 진입 시점에 물리적 마찰(30초 잠금)과 인지적 충격(내 시급 환산 노동 시간, 1억 지연일수)을 제공하여 결제를 포기하도록 유도.
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
  - 결제 금액 파싱 → 시급 기준 노동시간 & 1억 지연일수 붉은색 노출
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
* **1억 지연일수 산출:** $\text{지연 일수} = \frac{\text{결제 금액}}{\text{일일 저축 목표액}}$
* 일일 저축 목표액 = $\frac{\text{월 저축 목표액}}{30}$


* **5년 복리 기회비용 (연 8% S&P500 기준):** $\text{미래 가치} = \text{결제 금액} \times (1 + 0.08)^5 \approx \text{결제 금액} \times 1.47$



### 3.3. 방어 모달 UI/UX 규칙 (Modal Interactions)

* **30초 쿨다운 타이머:**
* 결제창 열림과 동시에 `30... 29... 1` 카운트다운 시작.
* 타이머 동작 중 [결제 진행하기] 버튼은 `disabled` 처리.


* **강제 문장 검증 (Typing Lock):**
* 30초가 지나도 버튼이 바로 열리지 않음.
* 지정 문장: **"나는 1억 모으기 목표보다 이 물건이 지금 당장 더 가치 있다고 확신합니다."**
* Input 값과 지정 문장이 100% 일치해야 [결제 진행하기] 버튼 활성화.


* **세이브 액션 [결제 포기하고 1억 지키기] (Primary Button):**
* 가장 크고 눈에 띄는 색상(`Success Green`)으로 배치.
* 클릭 시 로컬 스토리지에 방어 내역 적재 후, `history.length > 1`이면 `history.back()`으로 이전 페이지(장바구니/상세페이지)로 이동.
* `history.length <= 1`(되돌아갈 페이지가 없는 새 탭)인 경우에만 Fallback으로 백그라운드 서비스 워커에 메시지를 보내 `chrome.tabs.remove()`로 탭 종료 (`window.close()` 사용 금지).



### 3.4. 익스텐션 팝업 대시보드 (Popup UI)

* **목표 현황:** 1억 원 프로그레스 바 (현재 모은 돈 / 100,000,000원).
* **방어 통계:**
* 총 방어 성공 금액 (예: 1,450,000원 방어 완료).
* 방어 횟수 vs 결제 강행 횟수.


* **유저 기본 설정 폼:** 유저 시급(기본값 15,000원), 월 저축 목표액, 1억 달성 목표 연도.
* **시급 입력 방식 토글 (라디오 버튼):**
* [시급 직접 입력] / [월급으로 계산] 두 옵션 중 선택.
* [월급으로 계산] 선택 시 실수령액(월급) 입력 필드 노출, 다음 공식으로 시급 자동 산출 및 저장: `hourlyWage = Math.round(monthlySalary / 209)` (주 40시간 기준 월 209시간 환산).

---

## 4. 로컬 데이터 스키마 명세 (Chrome Local Storage)

별도 백엔드 없이 `chrome.storage.local`에서 관리하는 데이터 구조입니다.

```json
{
  "userConfig": {
    "targetAmount": 100000000,
    "currentSavings": 25000000,
    "monthlyTarget": 1500000,
    "hourlyWage": 15000,
    "cooldownSeconds": 30,
    "salaryType": "hourly",
    "monthlySalary": 0
  },
  "stats": {
    "totalProtectedAmount": 0,
    "protectedCount": 0,
    "overrideCount": 0
  },
  "protectedLogs": [
    {
      "id": "uuid",
      "timestamp": "2026-09-02T10:30:00Z",
      "siteDomain": "coupang.com",
      "amount": 89000,
      "workHoursSaved": 5.9
    }
  ]
}

```

---

## 5. Antigravity 개발 인계 체크리스트

* [ ] **Manifest V3:** `storage`, `tabs`, `activeTab` 권한 등록 및 커머스 호스트 URL 등록
* [ ] **Content Script Injection:** 페이지 로드 완료 전 최상단 오버레이 주입 및 배경 스크롤 차단 (`overflow: hidden`)
* [ ] **Price Extractor:** 정규식/키워드 텍스트 스캔을 1차 방식으로 구현 (셀렉터 클래스 의존 금지), 실패 시 Fallback 수동 인풋 UI 제공
* [ ] **Verification Logic:** 30초 타이머 인터벌 및 텍스트 `onChange` 일치 검증 로직 구현
* [ ] **Tab Closer:** [구매 포기] 트리거 시 `history.length > 1`이면 `history.back()`으로 이전 페이지 복귀, `history.length <= 1`일 때만 content script → background service worker 런타임 메시지 → `chrome.tabs.remove()`로 Fallback 처리 (`window.close()` 사용 금지)
* [ ] **Wage Input Toggle:** Popup에 시급 직접 입력 / 월급 입력 라디오 토글 구현, 월급 선택 시 `hourlyWage = Math.round(monthlySalary / 209)` 자동 산출 및 `salaryType`, `monthlySalary`, `hourlyWage` 모두 `chrome.storage.local`에 저장