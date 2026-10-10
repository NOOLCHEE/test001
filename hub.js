const games = [
	{ id: 'sudoku', label: '9️⃣ 스도쿠', file: 'sudoku.html' },
	{ id: 'smurfy', label: '🍞 스머프 베이커리', file: 'smurfy.html' },
	{ id: 'minesweeper', label: '💣 지뢰찾기', file: 'minesweeper.html' },
];

const tabs = document.querySelector('#gameTabs');
const frame = document.querySelector('#gameFrame');

function selectGame(id, { updateHistory = true } = {}) {
	const game = games.find((item) => item.id === id) ?? games[0];
	if (!game) return;

	for (const tab of tabs.querySelectorAll('[role="tab"]')) {
		const selected = tab.dataset.game === game.id;
		tab.setAttribute('aria-selected', String(selected));
		tab.tabIndex = selected ? 0 : -1;
	}
	frame.title = game.label;
	document.querySelector('#gamePanel').setAttribute('aria-labelledby', `tab-${game.id}`);
	if (!frame.src.endsWith(`/${game.file}`)) frame.src = game.file;
	if (updateHistory) history.pushState({ game: game.id }, '', `?game=${game.id}`);
}

for (const game of games) {
	const tab = document.createElement('button');
	tab.className = 'game-tab';
	tab.id = `tab-${game.id}`;
	tab.type = 'button';
	tab.setAttribute('role', 'tab');
	tab.setAttribute('aria-controls', 'gamePanel');
	tab.setAttribute('aria-selected', 'false');
	tab.tabIndex = -1;
	tab.dataset.game = game.id;
	tab.textContent = game.label;
	tab.addEventListener('click', () => selectGame(game.id));
	tab.addEventListener('keydown', (event) => {
		if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
		event.preventDefault();
		const currentIndex = games.findIndex((item) => item.id === game.id);
		const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? games.length - 1 : (currentIndex + (event.key === 'ArrowRight' ? 1 : games.length - 1)) % games.length;
		const nextGame = games[nextIndex];
		selectGame(nextGame.id);
		tabs.querySelector(`[data-game="${nextGame.id}"]`).focus();
	});
	tabs.append(tab);
}

window.addEventListener('popstate', () => {
	selectGame(new URLSearchParams(location.search).get('game'), { updateHistory: false });
});

window.addEventListener('message', (event) => {
	if (event.origin !== location.origin || !event.data) return;
	if (event.data.type === 'game-hub:navigate') selectGame(event.data.game);
	if (event.data.type === 'game-hub:height' && Number.isFinite(event.data.height)) {
		frame.style.height = `${Math.max(window.innerHeight - 152, event.data.height)}px`;
	}
});

selectGame(new URLSearchParams(location.search).get('game'), { updateHistory: false });