const boardElement = document.getElementById('board');
const padElement = document.getElementById('numberPad');
const messageElement = document.getElementById('message');
const timerElement = document.getElementById('timer');
const mistakesElement = document.getElementById('mistakes');
const difficultyElement = document.getElementById('difficulty');
const rankingListElement = document.getElementById('rankingList');
const rankingLevelElement = document.getElementById('rankingLevel');
const rankingStatusElement = document.getElementById('rankingStatus');
const recordDialog = document.getElementById('recordDialog');
const recordForm = document.getElementById('recordForm');
const recordNameElement = document.getElementById('recordName');
const difficultyNames = { easy: '느긋하게', medium: '알맞게', hard: '깊게' };
const size = 9;
let solution = [];
let puzzle = [];
let entries = [];
let notes = [];
let rankingRecords = [];
let rankingLoading = false;
let selected = null;
let mistakes = 0;
let hints = 3;
let seconds = 0;
let timerId = null;
let noteMode = false;
let gameComplete = false;
let gameOver = false;
let awaitingRecord = false;
let rankingRequestId = 0;

function shuffled(values) {
	const result = [...values];
	for (let index = result.length - 1; index > 0; index--) {
		const swapIndex = Math.floor(Math.random() * (index + 1));
		[result[index], result[swapIndex]] = [result[swapIndex], result[index]];
	}
	return result;
}

function pattern(row, column) {
	return (row * 3 + Math.floor(row / 3) + column) % size;
}

function makeSolution() {
	const rows = shuffled([0, 1, 2]).flatMap(group => shuffled([0, 1, 2]).map(row => group * 3 + row));
	const columns = shuffled([0, 1, 2]).flatMap(group => shuffled([0, 1, 2]).map(column => group * 3 + column));
	const numbers = shuffled([1, 2, 3, 4, 5, 6, 7, 8, 9]);
	return rows.map(row => columns.map(column => numbers[pattern(row, column)]));
}

function makePuzzle(level) {
	const blanks = { easy: 39, medium: 48, hard: 55 }[level];
	const result = solution.map(row => [...row]);
	const clues = size * size - blanks;
	const cluesPerBox = Math.floor(clues / 9);
	const extraClueBoxes = new Set(shuffled(Array.from({ length: 9 }, (_, box) => box)).slice(0, clues % 9));
	for (let box = 0; box < 9; box++) {
		const boxRow = Math.floor(box / 3) * 3;
		const boxColumn = (box % 3) * 3;
		const boxClues = cluesPerBox + Number(extraClueBoxes.has(box));
		const cells = shuffled(Array.from({ length: 9 }, (_, index) => index)).slice(boxClues);
		cells.forEach(index => {
			result[boxRow + Math.floor(index / 3)][boxColumn + index % 3] = 0;
		});
	}
	return result;
}

function startGame() {
	document.documentElement.dataset.difficulty = difficultyElement.value;
	solution = makeSolution();
	puzzle = makePuzzle(difficultyElement.value);
	entries = puzzle.map(row => [...row]);
	notes = Array.from({ length: 81 }, () => new Set());
	selected = null;
	mistakes = 0;
	hints = 3;
	seconds = 0;
	noteMode = false;
	gameComplete = false;
	gameOver = false;
	document.getElementById('noteMode').classList.remove('active');
	clearInterval(timerId);
	timerId = null;
	setMessage('칸을 선택하고 숫자를 눌러보세요.');
	render();
	renderLeaderboard();
}

function startTimer() {
	if (timerId !== null) return;
	timerId = setInterval(() => {
		seconds++;
		renderTimer();
	}, 1000);
}

function renderTimer() {
	timerElement.textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function setMessage(text, type = '') {
	messageElement.textContent = text;
	messageElement.className = `message ${type}`;
}

function formatDuration(duration) {
	return `${String(Math.floor(duration / 60)).padStart(2, '0')}:${String(duration % 60).padStart(2, '0')}`;
}

function renderLeaderboard() {
	const level = difficultyElement.value;
	rankingLevelElement.textContent = difficultyNames[level];
	rankingListElement.replaceChildren();
	const records = rankingRecords;
	if (records.length === 0) {
		const emptyMessage = document.createElement('li');
		emptyMessage.className = 'ranking-empty';
		emptyMessage.textContent = rankingLoading ? '순위를 불러오는 중...' : '아직 기록이 없어요. 첫 기록을 남겨보세요!';
		rankingListElement.append(emptyMessage);
		return;
	}
	records.forEach((record, index) => {
		const item = document.createElement('li');
		item.className = 'ranking-item';
		const rank = document.createElement('span');
		rank.className = 'ranking-rank';
		rank.textContent = `${index + 1}.`;
		const name = document.createElement('span');
		name.className = 'ranking-name';
		name.textContent = record.name;
		const score = document.createElement('span');
		score.className = 'ranking-score';
		score.textContent = formatDuration(record.seconds);
		item.append(rank, name, score);
		rankingListElement.append(item);
	});
}

async function loadRanking(level = difficultyElement.value) {
	const requestId = ++rankingRequestId;
	rankingLoading = true;
	rankingRecords = [];
	rankingStatusElement.textContent = '';
	renderLeaderboard();
	try {
		const records = await window.scoreApi.getRecords('sudoku', level);
		if (requestId !== rankingRequestId || level !== difficultyElement.value) return;
		rankingRecords = records;
		rankingLoading = false;
		renderLeaderboard();
		rankingStatusElement.textContent = '';
	} catch (error) {
		console.error('서버에서 스도쿠 순위 기록을 불러오지 못했습니다.', error);
		if (requestId === rankingRequestId && level === difficultyElement.value) {
			rankingLoading = false;
			renderLeaderboard();
			rankingStatusElement.textContent = '서버에서 순위를 불러오지 못했어요.';
		}
	}
}

async function saveRecord(name) {
	const level = difficultyElement.value;
	try {
		const rank = await window.scoreApi.saveRecord({
			game: 'sudoku',
			difficulty: level,
			name,
			seconds
		});
		await loadRanking(level);
		return rank;
	} catch (error) {
		console.error('서버에 스도쿠 순위 기록을 저장하지 못했습니다.', error);
		if (level === difficultyElement.value) rankingStatusElement.textContent = '서버에 순위를 저장하지 못했어요.';
		setMessage('완성했지만 서버에 순위를 저장하지 못했어요.', 'alert');
		return false;
	}
}

async function requestRecordName() {
	const level = difficultyElement.value;
	try {
		const result = await window.scoreApi.checkRecord({
			game: 'sudoku',
			difficulty: level,
			seconds
		});
		if (!result.qualifies) {
			setMessage('완성했어요! 상위 5위 기록에는 들지 못했어요.', 'success');
			return;
		}
		awaitingRecord = true;
		recordNameElement.value = '';
		recordDialog.showModal();
		recordNameElement.focus();
	} catch (error) {
		console.error('상위 5위 기록 여부를 확인하지 못했습니다.', error);
		if (level === difficultyElement.value) rankingStatusElement.textContent = '서버에서 순위를 확인하지 못했어요.';
		setMessage('완성했지만 상위 5위 여부를 확인하지 못했어요.', 'alert');
	}
}

function recordCompletion() {
	if (gameComplete || gameOver) return;
	gameComplete = true;
	clearInterval(timerId);
	setMessage(`완성했어요! ${timerElement.textContent} 만에 정원을 채웠습니다.`, 'success');
	requestRecordName();
}

function render() {
	boardElement.innerHTML = '';
	const selectedValue = selected === null ? 0 : entries[Math.floor(selected / 9)][selected % 9];
	for (let index = 0; index < 81; index++) {
		const row = Math.floor(index / 9);
		const column = index % 9;
		const cell = document.createElement('button');
		const value = entries[row][column];
		cell.className = 'cell';
		cell.type = 'button';
		cell.setAttribute('role', 'gridcell');
		cell.dataset.index = index;
		cell.setAttribute('aria-label', `${row + 1}행 ${column + 1}열 ${value || '빈 칸'}`);
		if (puzzle[row][column]) cell.classList.add('given');
		if (selected === index) cell.classList.add('selected');
		if (selected !== null && (row === Math.floor(selected / 9) || column === selected % 9 || (Math.floor(row / 3) === Math.floor(Math.floor(selected / 9) / 3) && Math.floor(column / 3) === Math.floor((selected % 9) / 3)))) cell.classList.add('related');
		if (selectedValue && value === selectedValue) cell.classList.add('same-number');
		if (value && puzzle[row][column] === 0 && value !== solution[row][column]) cell.classList.add('error');
		if (value) {
			cell.append(value);
		} else if (notes[index].size) {
			const noteBox = document.createElement('span');
			noteBox.className = 'notes';
			for (let number = 1; number <= 9; number++) {
				const note = document.createElement('span');
				note.textContent = notes[index].has(number) ? number : '';
				if (notes[index].has(number)) note.className = 'active';
				noteBox.append(note);
			}
			cell.append(noteBox);
		}
		cell.addEventListener('click', () => {
			selected = index;
			render();
		});
		boardElement.append(cell);
	}
	mistakesElement.textContent = `${mistakes} / 3`;
	document.getElementById('hint').textContent = `힌트 하나 받기 · ${hints}회`;
	renderTimer();
}

function inputNumber(number) {
	if (gameComplete || gameOver) return;
	if (selected === null) {
		setMessage('먼저 빈 칸을 선택해주세요.', 'alert');
		return;
	}
	const row = Math.floor(selected / 9);
	const column = selected % 9;
	if (puzzle[row][column]) {
		setMessage('처음부터 있던 숫자는 바꿀 수 없어요.', 'alert');
		return;
	}
	if (noteMode) {
		notes[selected].has(number) ? notes[selected].delete(number) : notes[selected].add(number);
		render();
		return;
	}
	startTimer();
	entries[row][column] = number;
	notes[selected].clear();
	if (number !== solution[row][column]) {
		mistakes++;
		setMessage('조금 다르게 놓였어요. 다시 생각해볼까요?', 'alert');
	} else {
		setMessage('좋아요. 다음 빈 칸을 찾아보세요.');
	}
	render();
	if (mistakes >= 3) {
		gameOver = true;
		setMessage('실수가 세 번 쌓였어요. 새 퍼즐로 다시 시작해보세요.', 'alert');
		clearInterval(timerId);
	}
	if (!gameOver && entries.every((line, rowIndex) => line.every((value, columnIndex) => value === solution[rowIndex][columnIndex]))) {
		recordCompletion();
	}
}

function erase() {
	if (gameComplete || gameOver) return;
	if (selected === null) return;
	const row = Math.floor(selected / 9);
	const column = selected % 9;
	if (!puzzle[row][column]) {
		entries[row][column] = 0;
		notes[selected].clear();
		render();
		setMessage('빈 칸으로 되돌렸어요.');
	}
}

document.getElementById('newGame').addEventListener('click', startGame);
document.getElementById('checkGame').addEventListener('click', () => {
	const wrong = entries.flat().filter((value, index) => value && value !== solution[Math.floor(index / 9)][index % 9]).length;
	setMessage(wrong ? `아직 ${wrong}개의 숫자를 다시 살펴보세요.` : '지금까지의 숫자는 모두 맞아요.', wrong ? 'alert' : 'success');
});
document.getElementById('erase').addEventListener('click', erase);
document.getElementById('noteMode').addEventListener('click', event => {
	if (gameComplete || gameOver) return;
	noteMode = !noteMode;
	event.currentTarget.classList.toggle('active', noteMode);
	setMessage(noteMode ? '메모 모드예요. 후보 숫자를 표시하세요.' : '입력 모드로 돌아왔어요.');
});
document.getElementById('hint').addEventListener('click', () => {
	if (gameComplete || gameOver) return;
	if (hints <= 0 || selected === null) {
		setMessage(hints <= 0 ? '힌트를 모두 사용했어요.' : '힌트를 받을 빈 칸을 먼저 선택해주세요.', 'alert');
		return;
	}
	const row = Math.floor(selected / 9);
	const column = selected % 9;
	if (puzzle[row][column]) {
		setMessage('빈 칸을 선택하면 힌트를 드릴게요.', 'alert');
		return;
	}
	startTimer();
	entries[row][column] = solution[row][column];
	notes[selected].clear();
	hints--;
	render();
	if (entries.every((line, rowIndex) => line.every((value, columnIndex) => value === solution[rowIndex][columnIndex]))) {
		recordCompletion();
	} else {
		setMessage('정답 하나를 살짝 밝혀두었어요.', 'success');
	}
});
difficultyElement.addEventListener('change', () => {
	startGame();
	loadRanking();
});
recordForm.addEventListener('submit', async event => {
	event.preventDefault();
	const name = recordNameElement.value.trim();
	if (!name) {
		recordNameElement.focus();
		return;
	}
	const submitButton = recordForm.querySelector('[type="submit"]');
	submitButton.disabled = true;
	try {
		const rank = await saveRecord(name);
		if (rank === false) return;
		awaitingRecord = false;
		recordDialog.close();
		if (rank === null) setMessage('순위가 바뀌어 상위 5위에 들지 못했어요. 기록하지 않았습니다.', 'alert');
		else setMessage(`완성 기록을 ${rank}위에 저장했어요! ${timerElement.textContent}`, 'success');
	} finally {
		submitButton.disabled = false;
	}
});
document.getElementById('skipRecord').addEventListener('click', () => recordDialog.close());
recordDialog.addEventListener('close', () => {
	if (!awaitingRecord) return;
	awaitingRecord = false;
	setMessage('이번 완성은 순위표에 기록하지 않았어요.', 'alert');
});
document.addEventListener('keydown', event => {
	if (/^[1-9]$/.test(event.key)) inputNumber(Number(event.key));
	if (event.key === 'Backspace' || event.key === 'Delete') erase();
});

for (let number = 1; number <= 9; number++) {
	const button = document.createElement('button');
	button.className = 'number';
	button.type = 'button';
	button.textContent = number;
	button.setAttribute('aria-label', `${number} 입력`);
	button.addEventListener('click', () => inputNumber(number));
	padElement.append(button);
}

loadRanking();
startGame();
