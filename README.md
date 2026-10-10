# 한 판의 여유

스도쿠, 스머프 화덕 베이커리, 지뢰찾기를 즐길 수 있는 브라우저 게임 모음입니다. 게임과 난이도별 상위 5개 기록은 Cloudflare D1 데이터베이스에 저장되어 모든 플레이어에게 표시됩니다. 상위 5위에 들었을 때만 이름을 입력해 기록할 수 있습니다.

스머프 화덕 베이커리는 4·6·8개 화덕 모드에 따라 난이도가 나뉘며, 점수가 높을수록 순위가 높습니다. 스도쿠와 지뢰찾기는 완성 시간이 짧을수록 순위가 높습니다.

## 실행

`index.html`을 열면 게임 허브가 표시됩니다. 상단 탭에서 스도쿠, 스머프 화덕 베이커리, 지뢰찾기를 전환할 수 있고, 각 게임은 `sudoku.html`, `smurfy.html`, `minesweeper.html`에서도 직접 열 수 있습니다. 새 게임을 허브에 추가할 때는 `hub.js`의 `games` 배열에 게임 ID, 탭 이름, HTML 파일 경로를 등록하세요. D1 순위 기록을 사용하려면 Cloudflare Pages에 배포해야 합니다. 로컬 파일이나 API가 없는 정적 호스팅에서는 순위 API를 사용할 수 없습니다.

## Cloudflare Pages 및 D1 설정

1. Pages 프로젝트의 **Settings → Functions → D1 database bindings**에서 바인딩을 추가합니다. 변수 이름은 `DB`, 데이터베이스는 `d1_nool_score`를 선택합니다. 바인딩 변경 사항이 적용되도록 Pages를 다시 배포합니다.
2. 기존 데이터베이스에는 `migrations/0002_allow_minesweeper.sql`과 `migrations/0003_allow_smurfy.sql`을 차례로 실행해 지뢰찾기와 스머프 기록을 허용하세요. 새 데이터베이스는 세 마이그레이션을 순서대로 실행합니다. 기존 노노그램 기록은 DB에 보존되지만 새 API에서는 더 이상 조회되지 않습니다. Wrangler를 사용하는 경우 저장소 루트에서 각 파일을 차례로 실행하세요:

   ```sh
   npx wrangler d1 execute 2918674c-8e80-4331-83c1-6ab445aea87b --remote --file=migrations/0001_create_scores.sql
   npx wrangler d1 execute 2918674c-8e80-4331-83c1-6ab445aea87b --remote --file=migrations/0002_allow_minesweeper.sql
   npx wrangler d1 execute 2918674c-8e80-4331-83c1-6ab445aea87b --remote --file=migrations/0003_allow_smurfy.sql
   ```

3. Pages Functions의 `functions/api/scores.js`가 `/api/scores` 조회·저장 API를 제공합니다. 스머프 점수는 높은 순, 시간 기록은 짧은 순으로 정렬되며 게임과 난이도별 상위 5개만 저장됩니다. 동점은 먼저 저장된 순서로 정렬됩니다.
