CREATE TABLE IF NOT EXISTS scores (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	game TEXT NOT NULL CHECK (game IN ('sudoku', 'nonogram')),
	difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
	name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 20),
	seconds INTEGER NOT NULL CHECK (seconds >= 0),
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS scores_leaderboard
	ON scores (game, difficulty, seconds, id);
