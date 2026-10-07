const boardElement = document.getElementById('board');
const difficultyElement = document.getElementById('difficulty');
const timerElement = document.getElementById('timer');
const progressElement = document.getElementById('progress');
const messageElement = document.getElementById('message');
const rankingListElement = document.getElementById('rankingList');
const rankingLevelElement = document.getElementById('rankingLevel');
const rankingStatusElement = document.getElementById('rankingStatus');
const recordDialog = document.getElementById('recordDialog');
const recordForm = document.getElementById('recordForm');
const recordNameElement = document.getElementById('recordName');
const modes = [...document.querySelectorAll('[data-mode]')];
const playerNameStorageKey = 'nonogramPlayerName';
const difficultyNames = { easy: '느긋하게', medium: '알맞게', hard: '깊게' };

const puzzles = {
	easy: [
		['00100100', '01111110', '11111111', '11111111', '01111110', '00111100', '00011000', '00000000'],
		['00011000', '00111100', '01111110', '11111111', '11111111', '00111100', '00100100', '00000000']
	],
	medium: [
		['0011111100', '0100000010', '1010000101', '1000000001', '1001001001', '1000000001', '1010000101', '1001111001', '0100000010', '0011111100'],
		['0000110000', '0001111000', '0011111100', '0111111110', '1111111111', '1111111111', '0011111100', '0011111100', '0010010000', '0110011000']
	],
	hard: [
		[
			'000011110000',
			'000111111000',
			'001111111100',
			'011111111110',
			'111011110111',
			'111111111111',
			'111111111111',
			'011111111110',
			'001111111100',
			'000111111000',
			'000011110000',
			'000001100000'
		],
		[
			'000001100000',
			'000011110000',
			'000111111000',
			'001111111100',
			'011111111110',
			'011011110110',
			'111111111111',
			'110111111011',
			'110111111011',
			'000111111000',
			'001101101100',
			'011000000110'
		]
	]
};

let solution = [];
let cells = [];
let selectedMode = 'fill';
let seconds = 0;
let timerId = null;
let gameComplete = false;
let activePointer = false;
let visitedCells = new Set();
let dragValue = 0;
let rankingRecords = [];
let playerName = '';
let awaitingRecord = false;
let rankingRequestId = 0;

function setMessage(text, type = '') {
	messageElement.textContent = text;
	messageElement.className = `message ${type}`;
}

function lineClues(line) {
	const runs = [];
	let run = 0;
	for (const filled of line) {
		if (filled === true || filled === 1 || filled === '1') run++;
		else if (run) {
			runs.push(run);
			run = 0;
		}
	}
	if (run) runs.push(run);
	return runs.length ? runs : [0];
}

function cluesMatch(line, clue) {
	const actual = lineClues(line);
	return actual.length === clue.length && actual.every((count, index) => count === clue[index]);
}

function getColumn(column) {
	return cells.map(row => row[column]);
}

function startTimer() {
	if (timerId !== null || gameComplete) return;
	timerId = setInterval(() => {
		seconds++;
		renderTimer();
	}, 1000);
}

function renderTimer() {
	timerElement.textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
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
		emptyMessage.textContent = '아직 기록이 없어요. 첫 기록을 남겨보세요!';
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
		const duration = document.createElement('span');
		duration.className = 'ranking-score';
		duration.textContent = formatDuration(record.seconds);
		item.append(rank, name, duration);
		rankingListElement.append(item);
	});
}

async function loadRanking(level = difficultyElement.value) {
	const requestId = ++rankingRequestId;
	try {
		const records = await window.scoreApi.getRecords('nonogram', level);
		if (requestId !== rankingRequestId || level !== difficultyElement.value) return;
		rankingRecords = records;
		renderLeaderboard();
		rankingStatusElement.textContent = '';
	} catch (error) {
		console.error('서버에서 노노그램 순위 기록을 불러오지 못했습니다.', error);
		if (requestId === rankingRequestId && level === difficultyElement.value) {
			rankingStatusElement.textContent = '서버에서 순위를 불러오지 못했어요.';
		}
	}
}

async function saveRecord(name) {
	const level = difficultyElement.value;
	try {
		const rank = await window.scoreApi.saveRecord({
			game: 'nonogram',
			difficulty: level,
			name,
			seconds
		});
		try {
			localStorage.setItem(playerNameStorageKey, name);
			playerName = name;
		} catch (error) {
			console.error('이 브라우저에 이름을 기억하지 못했습니다.', error);
		}
		await loadRanking(level);
		return rank;
	} catch (error) {
		console.error('서버에 노노그램 순위 기록을 저장하지 못했습니다.', error);
		if (level === difficultyElement.value) rankingStatusElement.textContent = '서버에 순위를 저장하지 못했어요.';
		setMessage('완성했지만 서버에 순위를 저장하지 못했어요.', 'alert');
		return false;
	}
}

function createClue(values, className, row, column) {
	const clue = document.createElement('div');
	clue.className = `clue ${className}`;
	clue.style.gridRow = row;
	clue.style.gridColumn = column;
	clue.setAttribute('aria-label', `힌트 ${values.join(', ')}`);
	values.forEach((value, index) => {
		if (className === 'row-clue' && index > 0) {
			const separator = document.createElement('span');
			separator.className = 'clue-separator';
			separator.setAttribute('aria-hidden', 'true');
			separator.textContent = '·';
			clue.append(separator);
		}
		const number = document.createElement('span');
		number.textContent = value;
		clue.append(number);
	});
	return clue;
}

function render() {
	const size = solution.length;
	const rowClues = solution.map(lineClues);
	const columnClues = Array.from({ length: size }, (_, column) => lineClues(solution.map(row => row[column])));
	const flatSolution = solution.flat();
	const maxRowClueCount = Math.max(...rowClues.map(clue => clue.length));
	const maxColumnClueCount = Math.max(...columnClues.map(clue => clue.length));
	boardElement.replaceChildren();
	boardElement.style.setProperty('--size', size);
	boardElement.style.setProperty('--row-clue-width', `${Math.max(44, maxRowClueCount * 8 + (maxRowClueCount - 1) * 7 + 16)}px`);
	boardElement.style.setProperty('--row-clue-font-size', `${maxRowClueCount >= 5 ? 9 : 11}px`);
	boardElement.style.setProperty('--column-clue-height', `${Math.max(58, maxColumnClueCount * 15 + 10)}px`);
	const corner = document.createElement('div');
	corner.className = 'clue-corner';
	corner.setAttribute('aria-hidden', 'true');
	boardElement.append(corner);

	columnClues.forEach((clue, column) => {
		const element = createClue(clue, 'column-clue', '1', String(column + 2));
		if (cluesMatch(getColumn(column).map(value => value === 1), clue)) element.classList.add('solved');
		boardElement.append(element);
	});

	cells.forEach((line, row) => {
		const rowClue = createClue(rowClues[row], 'row-clue', String(row + 2), '1');
		if (cluesMatch(line.map(value => value === 1), rowClues[row])) rowClue.classList.add('solved');
		boardElement.append(rowClue);
		line.forEach((value, column) => {
			const cell = document.createElement('button');
			cell.className = 'nonogram-cell';
			cell.type = 'button';
			cell.setAttribute('role', 'gridcell');
			cell.dataset.row = row;
			cell.dataset.column = column;
			cell.setAttribute('aria-label', `${row + 1}행 ${column + 1}열 ${value === 1 ? '채움' : value === 2 ? 'X 표시' : '빈칸'}`);
			cell.setAttribute('aria-pressed', String(value === 1));
			if (value === 1) cell.classList.add('filled');
			if (value === 2) {
				cell.classList.add('crossed');
				cell.textContent = '×';
			}
			if (solution[row][column] === '0' && value === 1) cell.classList.add('wrong');
			cell.addEventListener('click', () => applyMode(row, column));
			cell.addEventListener('contextmenu', event => {
				event.preventDefault();
				applyMode(row, column, 'cross');
			});
			boardElement.append(cell);
		});
	});
	const flatCells = cells.flat();
	const targetCount = flatSolution.filter(value => value === '1').length;
	const filledCount = flatCells.filter((value, index) => value === 1 && flatSolution[index] === '1').length;
	progressElement.textContent = `${filledCount} / ${targetCount}`;
}

function applyMode(row, column, mode = selectedMode) {
	if (gameComplete) return;
	const value = mode === 'fill'
		? (cells[row][column] === 1 ? 0 : 1)
		: mode === 'cross'
			? (cells[row][column] === 2 ? 0 : 2)
			: 0;
	applyValue(row, column, value);
}

function applyValue(row, column, value) {
	if (gameComplete) return;
	startTimer();
	cells[row][column] = value;
	render();
	if (isSolved()) completeGame();
}

function isSolved() {
	return cells.every((line, row) => line.every((value, column) => (value === 1) === (solution[row][column] === '1')));
}

function completeGame() {
	if (gameComplete) return;
	gameComplete = true;
	clearInterval(timerId);
	timerId = null;
	setMessage(`그림을 완성했어요! ${timerElement.textContent}`, 'success');
	render();
	if (playerName) {
		saveRecord(playerName).then(rank => {
			if (rank === false) return;
			if (rank > 10) setMessage('완성했어요! 상위 10위 기록에는 들지 못했어요.', 'success');
			else setMessage(`완성 기록을 ${rank}위에 저장했어요! ${timerElement.textContent}`, 'success');
		});
		return;
	}
	awaitingRecord = true;
	recordNameElement.value = '';
	recordDialog.showModal();
	recordNameElement.focus();
}

function startGame() {
	document.documentElement.dataset.difficulty = difficultyElement.value;
	const levelPuzzles = puzzles[difficultyElement.value];
	const previous = solution.map(row => row.join('')).join('|');
	const choices = levelPuzzles.filter(puzzle => puzzle.join('|') !== previous);
	const puzzle = choices[Math.floor(Math.random() * choices.length)] || levelPuzzles[0];
	solution = puzzle.map(row => [...row]);
	cells = solution.map(row => row.map(() => 0));
	seconds = 0;
	gameComplete = false;
	activePointer = false;
	visitedCells.clear();
	dragValue = 0;
	clearInterval(timerId);
	timerId = null;
	renderTimer();
	setMessage('숫자 힌트만큼 이어진 칸을 찾아보세요.');
	render();
	renderLeaderboard();
}

function checkGame() {
	const wrongCount = cells.reduce((total, row, rowIndex) =>
		total + row.filter((value, columnIndex) => value === 1 && solution[rowIndex][columnIndex] === '0').length, 0);
	if (wrongCount) {
		setMessage(`아직 ${wrongCount}개의 칸을 다시 살펴보세요.`, 'alert');
		return;
	}
	const remaining = solution.flat().filter(value => value === '1').length - cells.flat().filter((value, index) => value === 1 && solution.flat()[index] === '1').length;
	setMessage(remaining ? `그림에 채울 칸이 ${remaining}개 남았어요.` : '그림을 완성했어요!', remaining ? '' : 'success');
	if (!remaining) completeGame();
}

modes.forEach(button => button.addEventListener('click', () => {
	selectedMode = button.dataset.mode;
	modes.forEach(modeButton => {
		const active = modeButton === button;
		modeButton.classList.toggle('active', active);
		modeButton.setAttribute('aria-pressed', String(active));
	});
}));

boardElement.addEventListener('pointerdown', event => {
	if (event.pointerType === 'mouse' && event.button !== 0) return;
	const cell = event.target.closest('.nonogram-cell');
	if (!cell) return;
	activePointer = true;
	visitedCells = new Set();
	const key = `${cell.dataset.row},${cell.dataset.column}`;
	visitedCells.add(key);
	dragValue = selectedMode === 'fill'
		? (cells[cell.dataset.row][cell.dataset.column] === 1 ? 0 : 1)
		: selectedMode === 'cross'
			? (cells[cell.dataset.row][cell.dataset.column] === 2 ? 0 : 2)
			: 0;
});
boardElement.addEventListener('pointermove', event => {
	if (!activePointer) return;
	const cell = document.elementFromPoint(event.clientX, event.clientY)?.closest('.nonogram-cell');
	if (!cell || !boardElement.contains(cell)) return;
	const key = `${cell.dataset.row},${cell.dataset.column}`;
	if (visitedCells.has(key)) return;
	visitedCells.add(key);
	applyValue(Number(cell.dataset.row), Number(cell.dataset.column), dragValue);
});
document.addEventListener('pointerup', () => {
	activePointer = false;
});

document.getElementById('newGame').addEventListener('click', startGame);
document.getElementById('checkGame').addEventListener('click', checkGame);
difficultyElement.addEventListener('change', startGame);
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
		setMessage(rank > 10 ? '완성했어요! 상위 10위 기록에는 들지 못했어요.' : `완성 기록을 ${rank}위에 저장했어요! ${timerElement.textContent}`, 'success');
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
	if (event.key.toLowerCase() === 'x' && !event.target.matches('button, select')) {
		selectedMode = 'cross';
		modes.forEach(button => {
			const active = button.dataset.mode === selectedMode;
			button.classList.toggle('active', active);
			button.setAttribute('aria-pressed', String(active));
		});
	}
});

try {
	playerName = localStorage.getItem(playerNameStorageKey)?.slice(0, 20) || '';
} catch (error) {
	console.error('저장된 이름을 불러오지 못했습니다.', error);
	rankingStatusElement.textContent = '이 브라우저에서 저장된 이름을 불러오지 못했어요.';
}
loadRanking();
startGame();
