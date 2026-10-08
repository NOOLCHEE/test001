const games = new Set(['sudoku', 'nonogram']);
const difficulties = new Set(['easy', 'medium', 'hard']);

function json(data, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: {
			'Content-Type': 'application/json; charset=utf-8',
			'Cache-Control': 'no-store'
		}
	});
}

export async function onRequestGet({ request, env }) {
	const url = new URL(request.url);
	const game = url.searchParams.get('game');
	const difficulty = url.searchParams.get('difficulty');

	if (!games.has(game) || !difficulties.has(difficulty)) {
		return json({ error: '게임 또는 난이도 값이 올바르지 않습니다.' }, 400);
	}

	const { results } = await env.DB.prepare(
		'SELECT name, seconds, created_at AS date FROM scores WHERE game = ? AND difficulty = ? ORDER BY seconds ASC, id ASC LIMIT 5'
	).bind(game, difficulty).all();

	return json({ records: results });
}

export async function onRequestPost({ request, env }) {
	let body;
	try {
		body = await request.json();
	} catch {
		return json({ error: '요청 본문은 올바른 JSON이어야 합니다.' }, 400);
	}

	const game = body?.game;
	const difficulty = body?.difficulty;
	const name = body?.name === undefined
		? null
		: typeof body.name === 'string'
			? body.name.trim()
			: '';
	const seconds = body?.seconds;

	if (!games.has(game) || !difficulties.has(difficulty)) {
		return json({ error: '게임 또는 난이도 값이 올바르지 않습니다.' }, 400);
	}
	if (name !== null && (!name || [...name].length > 20)) {
		return json({ error: '이름은 1자 이상 20자 이하여야 합니다.' }, 400);
	}
	if (!Number.isSafeInteger(seconds) || seconds < 0) {
		return json({ error: '기록 시간 값이 올바르지 않습니다.' }, 400);
	}

	if (name === null) {
		const { rank } = await env.DB.prepare(
			'SELECT COUNT(*) + 1 AS rank FROM scores WHERE game = ? AND difficulty = ? AND seconds <= ?'
		).bind(game, difficulty, seconds).first();
		return json({ rank, qualifies: rank <= 5 });
	}

	const result = await env.DB.prepare(
		'INSERT INTO scores (game, difficulty, name, seconds) SELECT ?, ?, ?, ? WHERE (SELECT COUNT(*) FROM scores WHERE game = ? AND difficulty = ? AND seconds <= ?) < 5'
	).bind(game, difficulty, name, seconds, game, difficulty, seconds).run();
	if (result.meta.changes === 0) {
		const { rank } = await env.DB.prepare(
			'SELECT COUNT(*) + 1 AS rank FROM scores WHERE game = ? AND difficulty = ? AND seconds <= ?'
		).bind(game, difficulty, seconds).first();
		return json({ rank, qualifies: false });
	}

	const scoreId = result.meta.last_row_id;
	const { rank } = await env.DB.prepare(
		'SELECT COUNT(*) AS rank FROM scores WHERE game = ? AND difficulty = ? AND (seconds < ? OR (seconds = ? AND id <= ?))'
	).bind(game, difficulty, seconds, seconds, scoreId).first();

	return json({ rank, qualifies: true }, 201);
}
