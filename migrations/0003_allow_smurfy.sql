CREATE TABLE scores_new (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	game TEXT NOT NULL CHECK (game IN ('sudoku', 'nonogram', 'minesweeper', 'smurfy')),
	difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
	name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 20),
	seconds INTEGER NOT NULL CHECK (seconds >= 0),
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO scores_new (id, game, difficulty, name, seconds, created_at)
SELECT id, game, difficulty, name, seconds, created_at FROM scores;

DROP TABLE scores;
ALTER TABLE scores_new RENAME TO scores;

CREATE INDEX scores_leaderboard
	ON scores (game, difficulty, seconds, id);