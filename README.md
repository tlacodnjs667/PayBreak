# PayBreak

> 결제 직전 30초의 브레이크, 1억 달성을 지킵니다.

PayBreak는 온라인 결제 페이지에서 결제 예정 금액을 감지하고, 목표 자산과 노동 시간 관점에서 한 번 더 생각할 시간을 제공하는 Manifest V3 Chrome 확장 프로그램입니다.

## 주요 기능

- 네이버페이·쿠팡 및 일반적인 결제 URL 패턴 감지
- 결제 금액 자동 인식과 수동 입력 대체 경로
- 30초 숙려 타이머와 목표 문장 입력
- 목표 자산, 월 저축 목표, 시급·월급 설정
- 결제 방어·강행 통계와 일별·월별·연별 리포트
- CSV 내보내기
- 외부 지출 수동 차감
- 모든 설정과 기록을 `chrome.storage.local`에만 저장

## 로컬 개발

```bash
npm ci
npm run dev
```

Chrome의 `chrome://extensions`에서 개발자 모드를 켠 뒤 화면에 안내된 `dist/` 폴더를 압축해제된 확장 프로그램으로 로드합니다.

## 검사와 빌드

```bash
npm run typecheck
npm run build
```

## Chrome 웹 스토어 패키지

```bash
npm run release
```

이 명령은 타입 검사와 프로덕션 빌드를 실행한 뒤, `manifest.json`이 루트에 있는 `release/paybreak-<version>.zip`을 만듭니다.

스토어 등록 문구와 권한·데이터 공개 초안은 [STORE_LISTING_KO.md](./STORE_LISTING_KO.md), 개인정보 처리 내용은 [PRIVACY.md](./PRIVACY.md), 등록용 이미지는 [store-assets](./store-assets/)에서 확인할 수 있습니다.
