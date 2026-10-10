// 난이도별 프리셋 데이터 스펙 정의
const CONFIG = {
    easy:   { rows: 9,  cols: 9,  mines: 10,  name: '초급' },
    normal: { rows: 16, cols: 16, mines: 40,  name: '중급' },
    hard:   { rows: 16, cols: 30, mines: 99,  name: '고급' }
};

let currentLevel = 'easy';
let board = [];
let gameOver = false;
let firstClick = true;
let timeElapsed = 0;
let timerInterval = null;
let remainingMines = CONFIG.easy.mines;

// 🛠️ 모바일 전용 제어 상태 변수 추가
let mobileToolMode = 'reveal'; // 'reveal'(열기) 또는 'flag'(깃발)
let selectedCellForClear = null; // 원터치 주변 열기 타겟 저장용
let lastNumberTap = null;
let lastTouchEndAt = 0;
const DOUBLE_TAP_DELAY = 350;
let rankingRequestId = 0;

function scoreDifficulty(level = currentLevel) {
    return level === 'normal' ? 'medium' : level;
}

function changeDifficulty(level) {
    if (currentLevel === level && board.length > 0) return;
    currentLevel = level;

    document.querySelectorAll('.diff-btn').forEach(btn => btn.classList.remove('active'));
    if (event && event.currentTarget) {
        event.currentTarget.classList.add('active');
    }

    initGame();
}

function initGame() {
    gameOver = false;
    firstClick = true;
    timeElapsed = 0;

    // 모바일 보조 상태 초기화
    mobileToolMode = 'reveal';
    selectedCellForClear = null;
    lastNumberTap = null;
    lastTouchEndAt = 0;
    const toggleBtn = document.getElementById('tool-toggle-btn');
    if(toggleBtn) {
        toggleBtn.classList.add('active-mode');
        toggleBtn.innerText = '🔍 열기 모드';
    }
    const quickBtn = document.getElementById('quick-clear-btn');
    if(quickBtn) {
        quickBtn.disabled = true;
        quickBtn.style.background = 'var(--line)';
    }

    const cfg = CONFIG[currentLevel];
    remainingMines = cfg.mines;

    clearInterval(timerInterval);
    timerInterval = null;

    document.getElementById('status-text').innerText = "지뢰를 모두 찾아내세요!";
    document.getElementById('face-btn').innerText = "🙂";
    document.getElementById('timer').innerText = "000";
    updateMineCounter();
    renderLeaderboard();

    const boardEl = document.getElementById('board');
    boardEl.innerHTML = '';

    boardEl.style.gridTemplateRows = `repeat(${cfg.rows}, 32px)`;
    boardEl.style.gridTemplateColumns = `repeat(${cfg.cols}, 32px)`;

    board = Array.from({ length: cfg.rows }, () =>
        Array(cfg.cols).fill(0).map(() => ({ isMine: false, revealed: false, flag: false, count: 0 }))
    );

    for (let r = 0; r < cfg.rows; r++) {
        for (let c = 0; c < cfg.cols; c++) {
            const cellEl = document.createElement('div');
            cellEl.classList.add('cell');
            cellEl.dataset.r = r;
            cellEl.dataset.c = c;

            // Mobile double-taps on revealed numbers chord the surrounding cells.
            cellEl.addEventListener('touchend', (e) => {
                if (gameOver) return;
                const tappedAt = Date.now();
                lastTouchEndAt = tappedAt;

                if (board[r][c].revealed && board[r][c].count > 0) {
                    selectCellForQuickClear(r, c);
                    const isDoubleTap = lastNumberTap
                        && lastNumberTap.r === r
                        && lastNumberTap.c === c
                        && tappedAt - lastNumberTap.time <= DOUBLE_TAP_DELAY;
                    lastNumberTap = isDoubleTap ? null : { r, c, time: tappedAt };
                    if (isDoubleTap) triggerMobileQuickClear();
                    return;
                }

                lastNumberTap = null;
                if (!board[r][c].revealed) {
                    if (mobileToolMode === 'flag') {
                        toggleFlag(r, c);
                    } else {
                        revealCell(r, c);
                    }
                }
            });

            // PC 마우스 처리 (양클릭/휠클릭 기본 유지)
            cellEl.addEventListener('mousedown', (e) => {
                if (gameOver || e.pointerType === 'touch') return;
                if (e.buttons === 3 || e.button === 1) {
                    e.preventDefault();
                    if (board[r][c].revealed && board[r][c].count > 0) {
                        revealNeighbors(r, c);
                    }
                    return;
                }
            });

            cellEl.addEventListener('click', (e) => {
                if (e.pointerType === 'touch' || Date.now() - lastTouchEndAt < 700) return;
                if (!board[r][c].revealed) {
                    revealCell(r, c);
                }
            });

            cellEl.addEventListener('dblclick', (e) => {
                e.preventDefault();
                if (gameOver || Date.now() - lastTouchEndAt < 700) return;
                if (board[r][c].revealed && board[r][c].count > 0) {
                    revealNeighbors(r, c);
                }
            });

            cellEl.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                if (e.buttons === 3) return;
                toggleFlag(r, c);
            });

            boardEl.appendChild(cellEl);
        }
    }
}

// 🛠️ [모바일 전용] 하단 모드 전환 토글러 함수
function toggleMobileTool() {
    const btn = document.getElementById('tool-toggle-btn');
    if (mobileToolMode === 'reveal') {
        mobileToolMode = 'flag';
        btn.innerText = '🚩 깃발 모드';
        btn.style.color = 'var(--coral)';
    } else {
        mobileToolMode = 'reveal';
        btn.innerText = '🔍 열기 모드';
        btn.style.color = 'var(--ink)';
    }
}
// 🛠️ [모바일 전용] 원터치 주변 열기를 위해 타겟 숫자를 노랗게 활성화하는 보조 함수
function selectCellForQuickClear(r, c) {
    // 기존에 선택되었던 하이라이트 노란선 제거
    document.querySelectorAll('.cell').forEach(el => el.classList.remove('selected-cell'));

    selectedCellForClear = { r, c };
    const targetEl = document.querySelector(`[data-r='${r}'][data-c='${c}']`);
    if (targetEl) targetEl.classList.add('selected-cell');

    // ⚡ 주변 열기 버튼 활성화 상태로 전환
    const quickBtn = document.getElementById('quick-clear-btn');
    quickBtn.disabled = false;
    quickBtn.style.background = 'var(--mint)';
    quickBtn.style.color = 'var(--ink)';
}

// 🛠️ [모바일 전용] ⚡ 주변 열기 버튼을 실제로 눌렀을 때 발동하는 링크 함수
function triggerMobileQuickClear() {
    if (!selectedCellForClear || gameOver) return;

    // 원본 양클릭 매크로 함수 호출
    revealNeighbors(selectedCellForClear.r, selectedCellForClear.c);

    // 실행 후 하이라이트 및 단축 버튼 비활성화 초기화
    document.querySelectorAll('.cell').forEach(el => el.classList.remove('selected-cell'));
    selectedCellForClear = null;
    lastNumberTap = null;

    const quickBtn = document.getElementById('quick-clear-btn');
    quickBtn.disabled = true;
    quickBtn.style.background = 'var(--line)';
    quickBtn.style.color = 'var(--ink)';
}

function generateMines(startR, startC) {
    const cfg = CONFIG[currentLevel];
    let planted = 0;

    while (planted < cfg.mines) {
        let r = Math.floor(Math.random() * cfg.rows);
        let c = Math.floor(Math.random() * cfg.cols);

        if (Math.abs(r - startR) <= 1 && Math.abs(c - startC) <= 1) continue;

        if (!board[r][c].isMine) {
            board[r][c].isMine = true;
            planted++;
        }
    }

    for (let r = 0; r < cfg.rows; r++) {
        for (let c = 0; c < cfg.cols; c++) {
            if (board[r][c].isMine) continue;
            let count = 0;
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    if (r+dr >= 0 && r+dr < cfg.rows && c+dc >= 0 && c+dc < cfg.cols && board[r+dr][c+dc].isMine) count++;
                }
            }
            board[r][c].count = count;
        }
    }
    startTimer();
}

function startTimer() {
    timerInterval = setInterval(() => {
        timeElapsed++;
        if (timeElapsed > 999) timeElapsed = 999;
        document.getElementById('timer').innerText = String(timeElapsed).padStart(3, '0');
    }, 1000);
}

function updateMineCounter() {
    let displayCount = remainingMines;
    if(displayCount < -99) displayCount = -99;
    const sign = displayCount < 0 ? '-' : '';
    const num = Math.abs(displayCount);
    document.getElementById('mine-counter').innerText = sign + String(num).padStart(sign ? 2 : 3, '0');
}

function revealCell(r, c) {
    const cfg = CONFIG[currentLevel];
    if (gameOver || board[r][c].revealed || board[r][c].flag) return;

    if (firstClick) {
        firstClick = false;
        generateMines(r, c);
    }

    const cellEl = document.querySelector(`[data-r='${r}'][data-c='${c}']`);
    board[r][c].revealed = true;
    cellEl.classList.add('revealed');
    cellEl.style.border = '1px solid var(--line-strong)';

    if (board[r][c].isMine) {
        cellEl.classList.add('mine');
        cellEl.style.backgroundColor = 'var(--coral)';
        cellEl.innerText = '💣';
        endGame(false);
        return;
    }

    if (board[r][c].count > 0) {
        cellEl.innerText = board[r][c].count;
        cellEl.classList.add(`c-${board[r][c].count}`);
    } else {
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (r+dr >= 0 && r+dr < cfg.rows && c+dc >= 0 && c+dc < cfg.cols) revealCell(r+dr, c+dc);
            }
        }
    }
    checkWin();
}

function revealNeighbors(r, c) {
    const cfg = CONFIG[currentLevel];
    let flagCount = 0;

    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            let nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < cfg.rows && nc >= 0 && nc < cfg.cols) {
                if (board[nr][nc].flag) flagCount++;
            }
        }
    }

    if (flagCount === board[r][c].count) {
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                let nr = r + dr, nc = c + dc;
                if (nr >= 0 && nr < cfg.rows && nc >= 0 && nc < cfg.cols) {
                    if (!board[nr][nc].flag && !board[nr][nc].revealed) {
                        revealCell(nr, nc);
                        if (gameOver) return;
                    }
                }
            }
        }
    }
}

function toggleFlag(r, c) {
    if (gameOver || board[r][c].revealed) return;
    const cellEl = document.querySelector(`[data-r='${r}'][data-c='${c}']`);

    board[r][c].flag = !board[r][c].flag;
    if (board[r][c].flag) {
        cellEl.innerText = '🚩';
        cellEl.style.color = 'var(--coral)';
        remainingMines--;
    } else {
        cellEl.innerText = '';
        cellEl.style.color = '';
        remainingMines++;
    }
    updateMineCounter();
}

function checkWin() {
    const cfg = CONFIG[currentLevel];
    for (let r = 0; r < cfg.rows; r++) {
        for (let c = 0; c < cfg.cols; c++) {
            if (!board[r][c].isMine && !board[r][c].revealed) return;
        }
    }
    endGame(true);
}

function endGame(isWin) {
    gameOver = true;
    clearInterval(timerInterval);
    const cfg = CONFIG[currentLevel];

    document.getElementById('face-btn').innerText = isWin ? "😎" : "😵";
    document.getElementById('status-text').innerText = isWin ? "🎉 완벽한 승리입니다! 🎉" : "💥 지뢰를 밟았습니다! 게임 오버";

    for (let r = 0; r < cfg.rows; r++) {
        for (let c = 0; c < cfg.cols; c++) {
            if (board[r][c].isMine) {
                const cellEl = document.querySelector(`[data-r='${r}'][data-c='${c}']`);
                if (isWin) {
                    cellEl.innerText = '🚩';
                } else {
                    if (!board[r][c].flag) cellEl.innerText = '💣';
                }
            }
        }
    }

    if (isWin) {
        setTimeout(() => { checkAndSaveRecord(timeElapsed); }, 100);
    }
}

async function checkAndSaveRecord(score) {
    const level = currentLevel;
    const difficulty = scoreDifficulty(level);
    const status = document.getElementById('ranking-status');
    try {
        const result = await window.scoreApi.checkRecord({ game: 'minesweeper', difficulty, seconds: score });
        if (!result.qualifies) {
            document.getElementById('status-text').innerText = '승리했습니다! 상위 5위 기록에는 들지 못했어요.';
            return;
        }

        const inputName = prompt(`🏆 축하합니다! ${score}초 기록이 상위 5위에 들었습니다. 이름을 입력하세요:`, '플레이어');
        if (inputName === null || !inputName.trim()) return;

        await window.scoreApi.saveRecord({
            game: 'minesweeper',
            difficulty,
            name: inputName.trim().slice(0, 20),
            seconds: score
        });
        if (level === currentLevel) await renderLeaderboard();
    } catch (error) {
        console.error('지뢰찾기 순위 기록을 처리하지 못했습니다.', error);
        status.innerText = '서버 순위를 확인하거나 저장하지 못했어요.';
    }
}

async function renderLeaderboard() {
    const level = currentLevel;
    const requestId = ++rankingRequestId;
    const listEl = document.getElementById('score-list');
    const status = document.getElementById('ranking-status');
    document.getElementById('rank-title-text').innerText = `🏆 ${CONFIG[currentLevel].name} 최고 기록 (Top 5)`;
    listEl.innerHTML = '';
    status.innerText = '서버 순위를 불러오는 중...';
    try {
        const records = await window.scoreApi.getRecords('minesweeper', scoreDifficulty(level));
        if (requestId !== rankingRequestId || level !== currentLevel) return;
        for (let i = 0; i < 5; i++) {
            const row = document.createElement('div');
            row.classList.add('score-row');
            const record = records[i];
            const values = record
                ? [`${i + 1}위`, record.name, `${record.seconds}초`, `(${record.date.slice(2, 10).replaceAll('-', '.')})`]
                : [`${i + 1}위`, '---', '---초', '(--.--.--)'];
            const classes = ['rank-col', 'name-col', 'score-col', 'date-col'];
            values.forEach((value, index) => {
                const item = document.createElement('span');
                item.className = classes[index];
                item.textContent = value;
                if (!record) item.style.color = 'var(--muted)';
                row.appendChild(item);
            });
            listEl.appendChild(row);
        }
        status.innerText = '';
    } catch (error) {
        console.error('서버에서 지뢰찾기 순위 기록을 불러오지 못했습니다.', error);
        if (requestId === rankingRequestId && level === currentLevel) {
            status.innerText = '서버에서 순위를 불러오지 못했어요.';
        }
    }
}

initGame();
