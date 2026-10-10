let score = 0;
let timeLeft = 30.0;
let gameInterval = null;
let isGameOver = false;
let activeOvenCount = 6; 
const MAX_TIME = 30.0;

// 최종 정산 리포트용 영구 누적 데이터 저장소
let bakeryStats = { "식빵": 0, "바게트": 0, "크로와상": 0, "프레첼": 0, "도넛": 0, "burntTotal": 0 };

// 오직 스머피(SMURFY!) 판정으로 획득한 빵 수량만 카운트하는 보너스 인벤토리
let bonusInventory = { "식빵": 0, "바게트": 0, "크로와상": 0, "프레첼": 0, "도넛": 0 };

let isBonusReady = false;

const scoreDisplay = document.getElementById('score');
const timeLeftDisplay = document.getElementById('time-left');
const timerBox = document.getElementById('timer-box');
const progressBar = document.getElementById('progress-bar');
const gameOverScreen = document.getElementById('game-over');
const finalScoreDisplay = document.getElementById('final-score');
const rankingList = document.getElementById('ranking-list');
const rankingLevel = document.getElementById('ranking-level');
const bakeryGrid = document.getElementById('bakery-grid');
const guideModal = document.getElementById('guide-modal');
const timeBonusBtn = document.getElementById('time-bonus-btn');

let ovenStates = {};
let rankingRequestId = 0;

document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
        if (gameInterval && !isGameOver) {
            alert("Please Reset or complete current session to change grid count!");
            return;
        }
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        activeOvenCount = parseInt(e.target.getAttribute('data-ovens'));
        buildOvenSlots();
        loadRanking(getRankingDifficulty());
    });
});

document.getElementById('main-reset-btn').addEventListener('click', startGame);
document.getElementById('guide-open-btn').addEventListener('click', function() { guideModal.style.display = "flex"; });
document.getElementById('guide-close-btn').addEventListener('click', function() { guideModal.style.display = "none"; });

// 5초 보너스 타임 징수 및 인벤토리 소모 장치
timeBonusBtn.addEventListener('click', function() {
    if (!isBonusReady || isGameOver || !gameInterval) return;
    
    triggerFeedback(5.0);
    
    bonusInventory["식빵"] = Math.max(0, bonusInventory["식빵"] - 1);
    bonusInventory["바게트"] = Math.max(0, bonusInventory["바게트"] - 1);
    bonusInventory["크로와상"] = Math.max(0, bonusInventory["크로와상"] - 1);
    bonusInventory["프레첼"] = Math.max(0, bonusInventory["프레첼"] - 1);
    bonusInventory["도넛"] = Math.max(0, bonusInventory["도넛"] - 1);
    
    refreshLiveCounterUI();
});

function buildOvenSlots() {
    bakeryGrid.innerHTML = ""; 
    document.getElementById('game-container').dataset.ovenCount = activeOvenCount;
    ovenStates = {};
    for (let i = 1; i <= activeOvenCount; i++) {
        const slot = document.createElement('div');
        slot.className = "oven-slot empty";
        slot.setAttribute('data-id', i);
        slot.innerHTML = `
            <div class="oven-name">OVEN ${String(i).padStart(2, '0')}</div>
            <div class="oven-status">💤</div>
            <div class="oven-text">BAKE</div>
            <div class="oven-progress-container">
                <div class="oven-progress-bar" id="oven-bar-${i}"></div>
            </div>
            <div class="bread-type-tag"></div>
        `;
        slot.addEventListener('click', function() { 
            if (!isGameOver) {
                if (!gameInterval) startTimerLoop();
                handleOvenClick(i, slot); 
            }
        });
        bakeryGrid.appendChild(slot);
        ovenStates[i] = { state: 'empty', bakeTimer: null, burnTimer: null, progressInterval: null, alertInterval: null, smokeInterval: null, currentBread: null, readyTimeStamp: 0 };
    }
}

function startTimerLoop() {
    if (gameInterval) clearInterval(gameInterval);
    gameInterval = setInterval(function() {
        timeLeft -= 0.1;
        if (timeLeft <= 0) { timeLeft = 0; updateTimerUI(); endGame(); }
        else updateTimerUI();
    }, 100);
}

function refreshLiveCounterUI() {
    for (let key in bonusInventory) {
        let targetNode = document.getElementById(`live-count-${key}`);
        if (targetNode) targetNode.innerText = bonusInventory[key];
    }
    
    let burntNode = document.getElementById("live-count-burnt");
    if (burntNode) burntNode.innerText = bakeryStats["burntTotal"];
    
    const hasSet = bonusInventory["식빵"] >= 1 && bonusInventory["바게트"] >= 1 && bonusInventory["크로와상"] >= 1 && bonusInventory["프레첼"] >= 1 && bonusInventory["도넛"] >= 1;
    
    if (hasSet) {
        isBonusReady = true;
        timeBonusBtn.disabled = false;
    } else {
        isBonusReady = false;
        timeBonusBtn.disabled = true;
    }
    timeBonusBtn.classList.toggle('ready-to-boost', hasSet);
}

function startGame() {
    isGameOver = false; score = 0; timeLeft = 30.0;
    scoreDisplay.innerText = score;
    gameOverScreen.style.display = guideModal.style.display = "none";
    
    bakeryStats = { "식빵": 0, "바게트": 0, "크로와상": 0, "프레첼": 0, "도넛": 0, "burntTotal": 0 };
    bonusInventory = { "식빵": 0, "바게트": 0, "크로와상": 0, "프레첼": 0, "도넛": 0 };
    refreshLiveCounterUI(); 
    
    if (gameInterval) { clearInterval(gameInterval); gameInterval = null; }
    for (let id in ovenStates) { 
        clearTimeout(ovenStates[id].bakeTimer); clearTimeout(ovenStates[id].burnTimer); 
        clearInterval(ovenStates[id].progressInterval); clearInterval(ovenStates[id].alertInterval); clearInterval(ovenStates[id].smokeInterval);
    }
    buildOvenSlots(); updateTimerUI();
}

function updateTimerUI() {
    timeLeftDisplay.innerText = timeLeft.toFixed(1);
    progressBar.style.width = Math.min(100, Math.max(0, (timeLeft / MAX_TIME) * 100)) + "%";
    progressBar.className = timeLeft > 20 ? 'progress-blue' : timeLeft > 10 ? 'progress-yellow' : 'progress-red';
}

function triggerFeedback(timeChange) {
    timeLeft = Math.min(MAX_TIME, Math.max(0, timeLeft + timeChange)); updateTimerUI();
    timerBox.classList.remove('changed'); void timerBox.offsetWidth; timerBox.classList.add('changed');
}

function spawnBurstParticles(targetEl, emojis) {
    const count = 4; 
    for (let i = 0; i < count; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle-fx'; particle.innerText = emojis[Math.floor(Math.random() * emojis.length)];
        const angle = (i * (360 / count)) + Math.random() * 45; const radius = 40 + Math.random() * 30;
        const dx = Math.cos(angle * Math.PI / 180) * radius; const dy = Math.sin(angle * Math.PI / 180) * radius;
        particle.style.setProperty('--dx', `${dx}px`); particle.style.setProperty('--dy', `${dy}px`);
        particle.style.left = `50%`; particle.style.top = `40%`;
        targetEl.appendChild(particle); setTimeout(() => particle.remove(), 600);
    }
}
// 게임 오버 처리 및 [정산 보고서 독립 주입]
function endGame() {
    isGameOver = true; 
    if (gameInterval) { clearInterval(gameInterval); gameInterval = null; }
    
    bakeryGrid.querySelectorAll('.oven-slot').forEach(slot => {
        const id = slot.getAttribute('data-id');
        if (ovenStates[id]) {
            clearInterval(ovenStates[id].progressInterval);
            clearInterval(ovenStates[id].alertInterval);
            clearInterval(ovenStates[id].smokeInterval);
        }
        updateOvenUI(slot, 'empty', '💤', 'CLOSED', '');
    });
    
    finalScoreDisplay.innerText = score; 

    // 기존 정산서 강제 리셋 (중복 노출 버그 차단)
    let oldReport = document.getElementById('bakery-stats-report');
    if (oldReport) oldReport.remove();
    
    // 가로/세로 유연한 래퍼 박스 생성
    let flexRowWrapper = document.getElementById('gameOverFlexRow');
    if (!flexRowWrapper) {
        flexRowWrapper = document.createElement('div');
        flexRowWrapper.id = 'gameOverFlexRow';
        flexRowWrapper.className = 'results-flex-row';
        finalScoreDisplay.closest('p').insertAdjacentElement('afterend', flexRowWrapper);
    }

    // 최종 결산서 카드 주입
    let statsCard = document.createElement('div');
    statsCard.id = 'bakery-stats-report';
    statsCard.className = 'report-card-box success-theme';
    statsCard.innerHTML = `
        <h3>🍓 스머프 베이커리 정산서</h3>
        <div style="text-align:center; font-size:1.1rem; margin-bottom:8px; animation: bounce 0.6s infinite alternate;">🧑‍🍳🛒🏃💨</div>
        <ul style="list-style-type: '🥯 '; padding-left: 20px;">
            <li>식빵 총 생산: <span style="color:#0284c7;">${bakeryStats["식빵"]} 개</span></li>
            <li>바게트 총 생산: <span style="color:#0284c7;">${bakeryStats["바게트"]} 개</span></li>
            <li>크로와상 총 생산: <span style="color:#0284c7;">${bakeryStats["크로와상"]} 개</span></li>
            <li>프레첼 총 생산: <span style="color:#0284c7;">${bakeryStats["프레첼"]} 개</span></li>
            <li>도넛 총 생산: <span style="color:#0284c7;">${bakeryStats["도넛"]} 개</span></li>
        </ul>
        <div style="color:#ef4444; margin-top:8px; border-top:1px solid #fecaca; padding-top:6px; font-weight:800; text-align:center;">
            💥 타버린 빵 총합: ${bakeryStats["burntTotal"]} 개
        </div>
    `;

    flexRowWrapper.insertBefore(statsCard, flexRowWrapper.firstChild);

    checkAndSaveRanking(score);
    gameOverScreen.style.display = "flex";
}

// 개별 화덕 조작 핸들러
function handleOvenClick(id, el) {
    const d = ovenStates[id];
    const statusEl = el.querySelector('.oven-status');
    const ovenBar = document.getElementById(`oven-bar-${id}`);
    const BREAD_TYPES = window.BREAD_CONFIG;
    
    // 글로벌 환경에서 새롭게 선언된 가변 시간 패널티 변수 동적 스캔
    const burntTimePenalty = window.TIME_PENALTY_BURNT !== undefined ? window.TIME_PENALTY_BURNT : 4.0;
    const rawTimePenalty = window.TIME_PENALTY_RAW !== undefined ? window.TIME_PENALTY_RAW : 0.0;

    // 1. 대기 상태 -> 베이킹 작동 시작
    if (d.state === 'empty') {
        d.state = 'baking'; 
        statusEl.classList.remove('text-heavy');
        el.classList.remove('danger-alert');
        const b = BREAD_TYPES[Math.floor(Math.random() * BREAD_TYPES.length)]; 
        d.currentBread = b;
        
        updateOvenUI(el, 'baking', '🥣', 'BAKING...', b.name);
        
        let currentProgress = 0;
        if (ovenBar) ovenBar.style.width = "0%";
        
        d.progressInterval = setInterval(function() {
            currentProgress += 100;
            let ratio = (currentProgress / b.bakeTime) * 100;
            if (ovenBar) ovenBar.style.width = Math.min(100, ratio) + "%";
            if (currentProgress >= b.bakeTime) clearInterval(d.progressInterval);
        }, 100);
        
        d.bakeTimer = setTimeout(function() {
            clearInterval(d.progressInterval);
            d.state = 'ready'; 
            d.readyTimeStamp = Date.now(); 
            
            // 1단계: 초기 상태
            updateOvenUI(el, 'ready', b.readyEmoji, 'PULL OUT!', b.name);
            
            // 2단계: 황금기 (SMURFY!) - 별빛(✨) 효과 부여
            d.smokeInterval = setTimeout(function() {
                if (d.state === 'ready') {
                    updateOvenUI(el, 'ready', b.readyEmoji + '✨', 'PULL OUT!', b.name);
                }
            }, b.good1);
            
            // 3단계: 지각 상태 - 삼각형 경고판(⚠️) 효과 작동
            d.alertInterval = setTimeout(function() {
                if (d.state === 'ready') {
                    el.classList.add('danger-alert');
                    updateOvenUI(el, 'ready', b.readyEmoji + '⚠️', 'HURRY UP!', b.name);
                }
            }, b.smurfy);
            
            d.burnTimer = setTimeout(function() {
                if (d.state === 'ready') { 
                    clearInterval(d.smokeInterval);
                    clearInterval(d.alertInterval);
                    el.classList.remove('danger-alert');
                    d.state = 'burnt'; 
                    bakeryStats["burntTotal"]++; 
                    
                    // [버그 패치 완료] 하드코딩 수치 대신 config.js의 TIME_PENALTY_BURNT 변수를 연동하여 음수 차감 계산
                    triggerFeedback(-burntTimePenalty); 
                    updateOvenUI(el, 'burnt', '💥', `BURNT! (-${b.penaltyBurnt})`, b.name); 
                    refreshLiveCounterUI();
                }
            }, b.burnt);
        }, b.bakeTime);
    } 
    // 2. 구워지는 도중 클릭 -> 덜 익음 실패 (RAW!)
    else if (d.state === 'baking') {
        clearTimeout(d.bakeTimer); 
        clearInterval(d.progressInterval);
        const b = d.currentBread;
        score = Math.max(0, score - b.penaltyRaw); 
        scoreDisplay.innerText = score; 
        
        // [버그 패치 완료] config.js의 TIME_PENALTY_RAW 변수를 매칭하여 감점 처리 반영 (현재 사양은 0초 차감)
        triggerFeedback(-rawTimePenalty); 
        
        statusEl.classList.add('text-heavy'); 
        d.state = 'failed';
        updateOvenUI(el, 'failed', '🥣', `RAW! (-${b.penaltyRaw})`, b.name); 
        resetOven(d, statusEl, el);
    } 
    // 3. 완성 완료 시점 클릭 -> 판정 연산 및 2배 점수제 집행
    else if (d.state === 'ready') {
        clearTimeout(d.burnTimer); 
        clearInterval(d.smokeInterval);
        clearInterval(d.alertInterval);
        el.classList.remove('danger-alert');
        
        const b = d.currentBread;
        const diff = Date.now() - d.readyTimeStamp; 
        
        statusEl.classList.add('text-heavy'); 
        bakeryStats[b.name]++;     
        
        if (diff >= b.good1 && diff < b.smurfy) {
            bonusInventory[b.name]++;  
            score += (b.score * 2); 
            scoreDisplay.innerText = score; 
            triggerFeedback(2.0); 
            d.state = 'smurfy'; 
            updateOvenUI(el, 'smurfy', b.readyEmoji + '<br>SMURFY!', 'SMURFY! (+2s)', '');
            spawnBurstParticles(el, ["✨", "🍓", "⭐", "🎉"]);
        } else if (diff < b.good1 || (diff >= b.smurfy && diff < b.burnt)) {
            score += b.score; 
            scoreDisplay.innerText = score; 
            triggerFeedback(0.5); 
            d.state = 'ready'; 
            updateOvenUI(el, 'ready', b.readyEmoji + '<br>GOOD!', 'GOOD! (+0.5s)', '');
            spawnBurstParticles(el, ["✨", "👍"]);
        } else { 
            bakeryStats[b.name]--; 
            bakeryStats["burntTotal"]++; 
            triggerFeedback(-burntTimePenalty); 
            d.state = 'burnt'; 
            updateOvenUI(el, 'burnt', '💥', `BURNT! (-${b.penaltyBurnt})`, b.name); 
            refreshLiveCounterUI();
            return; 
        }
        refreshLiveCounterUI(); 
        resetOven(d, statusEl, el);
    } 
    // 4. 새까맣게 타버린 화덕 클릭 -> 잿더미 청소
    else if (d.state === 'burnt') {
        score = Math.max(0, score - d.currentBread.penaltyBurnt); 
        scoreDisplay.innerText = score;
        d.state = 'empty'; 
        statusEl.classList.remove('text-heavy'); 
        updateOvenUI(el, 'empty', '💤', 'BAKE', '');
    }
}

function resetOven(d, statusEl, el) {
    setTimeout(function() { 
        if (!isGameOver) { 
            d.state = 'empty'; 
            statusEl.classList.remove('text-heavy'); 
            updateOvenUI(el, 'empty', '💤', 'BAKE', ''); 
        } 
    }, 700);
}

function getRankingDifficulty() {
    return ({ 4: 'easy', 6: 'medium', 8: 'hard' })[activeOvenCount] || 'medium';
}

async function checkAndSaveRanking(curScore) {
    const difficulty = getRankingDifficulty();
    if (curScore <= 0) {
        await loadRanking(difficulty);
        return;
    }

    try {
        const result = await window.scoreApi.checkRecord({
            game: 'smurfy',
            difficulty,
            score: curScore
        });

        if (result.qualifies) {
            const enteredName = prompt('✨ TOP 5 진입 성공! 이름을 입력하세요:', 'Smurf') || 'Smurf';
            const name = enteredName.trim().slice(0, 20) || 'Smurf';
            const rank = await window.scoreApi.saveRecord({
                game: 'smurfy',
                difficulty,
                name,
                score: curScore
            });
            if (rank !== null) {
                await loadRanking(difficulty, curScore, name);
                return;
            }
        }
        await loadRanking(difficulty);
    } catch (error) {
        console.error('스머프 순위 기록을 처리하지 못했습니다.', error);
        renderRank([], -1, '', '순위를 불러오지 못했어요.');
    }
}

async function loadRanking(difficulty, curScore = -1, curName = '') {
    const requestId = ++rankingRequestId;
    const labels = { easy: '4개 · 여유롭게', medium: '6개 · 기본', hard: '8개 · 도전' };
    rankingLevel.textContent = labels[difficulty] || labels.medium;
    renderRank([], -1, '', '순위를 불러오는 중...');
    try {
        const board = await window.scoreApi.getRecords('smurfy', difficulty);
        if (requestId !== rankingRequestId) return;
        renderRank(board, curScore, curName);
    } catch (error) {
        console.error('스머프 순위를 불러오지 못했습니다.', error);
        if (requestId === rankingRequestId) renderRank([], -1, '', '순위를 불러오지 못했어요.');
    }
}

function renderRank(board, curScore, curName, emptyMessage = '아직 기록이 없어요.') {
    rankingList.replaceChildren();
    if (board.length === 0) {
        const item = document.createElement('li');
        item.className = 'ranking-empty';
        item.textContent = emptyMessage;
        rankingList.appendChild(item);
        return;
    }
    board.forEach(record => {
        const li = document.createElement('li');
        const name = document.createElement('span');
        name.className = 'ranking-name';
        name.textContent = record.name;
        const points = document.createElement('span');
        points.className = 'ranking-points';
        points.textContent = `${record.score}점`;
        if (record.score === curScore && record.name === curName) {
            const marker = document.createElement('span');
            marker.className = 'you-label';
            marker.textContent = 'YOU';
            name.append(' ', marker);
        }
        li.append(name, points);
        rankingList.appendChild(li);
    });
}

function updateOvenUI(el, cls, emoji, txt, tag) {
    el.className = 'oven-slot ' + cls;
    el.querySelector('.oven-status').innerHTML = emoji;
    el.querySelector('.oven-text').innerText = txt;
    el.querySelector('.bread-type-tag').innerText = tag ? '[' + tag + ']' : "";
}

// 최초 화면 로드 시 오븐 기본 슬롯 빌드 실행 트리거
buildOvenSlots();
loadRanking(getRankingDifficulty());
