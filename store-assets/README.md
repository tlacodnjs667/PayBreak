# Chrome 웹 스토어 이미지 자산

이 폴더에는 Chrome 웹 스토어 등록용 이미지와 이를 재현하기 위한 원본이 들어갑니다.

- `screenshot-dashboard-1280x800.png`: 실제 PayBreak 대시보드 UI를 사용한 스토어 스크린샷
- `screenshot-checkout-1280x800.png`: 실제 결제 숙려 오버레이 UI를 사용한 스토어 스크린샷
- `small-promo-440x280.png`: 소형 홍보 이미지
- `source/`: 이미지 생성에 사용한 HTML 원본

스토어 ZIP에는 이 폴더를 포함하지 않습니다. 업로드 ZIP은 `npm run release`가 `dist/` 내용만 묶어 생성합니다.
