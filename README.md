# 숫자의 정원

스도쿠와 노노그램을 즐길 수 있는 브라우저 퍼즐 게임입니다. 게임과 난이도별 상위 5개 완성 기록은 Cloudflare D1 데이터베이스에 저장되어 모든 플레이어에게 표시됩니다. 상위 5위에 들었을 때만 이름을 입력해 기록할 수 있습니다.

노노그램은 난이도에 따라 8×8, 10×10, 12×12 보드로 플레이합니다. 행과 열의 숫자 힌트에 맞춰 연속된 칸을 채우고, 칸을 눌러 채우거나 `X 표시` 모드 또는 마우스 오른쪽 버튼으로 빈칸을 표시하세요. `지우개` 모드로 표시를 지울 수 있습니다. 완성 기록은 스도쿠와 별도로 게임·난이도별 상위 5개까지 D1에 저장됩니다.

## 실행

`index.html`을 브라우저에서 열거나 정적 웹 호스팅으로 배포할 수 있습니다. 노노그램은 `nonogram.html`에서 열 수 있으며, 두 게임은 화면 상단 링크로 이동할 수 있습니다. D1 순위 기록을 사용하려면 Cloudflare Pages에 배포해야 합니다. 로컬 파일이나 API가 없는 정적 호스팅에서는 순위 API를 사용할 수 없습니다.

## Cloudflare Pages 및 D1 설정

1. Pages 프로젝트의 **Settings → Functions → D1 database bindings**에서 바인딩을 추가합니다. 변수 이름은 `DB`, 데이터베이스는 `d1_nool_score`를 선택합니다. 바인딩 변경 사항이 적용되도록 Pages를 다시 배포합니다.
2. `migrations/0001_create_scores.sql`을 D1의 `d1_nool_score` 데이터베이스에서 실행합니다. Wrangler를 사용하는 경우 저장소 루트에서 실행하세요:

   ```sh
   npx wrangler d1 execute 2918674c-8e80-4331-83c1-6ab445aea87b --remote --file=migrations/0001_create_scores.sql
   ```

3. Pages Functions의 `functions/api/scores.js`가 `/api/scores` 조회·저장 API를 제공합니다. 기록은 게임과 난이도별로 구분되며, 상위 5위 기록만 저장됩니다. 동점은 먼저 저장된 순서로 정렬됩니다.
