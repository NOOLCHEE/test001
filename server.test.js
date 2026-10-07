const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { after, before, test } = require('node:test');
const { createServer } = require('./server');

let directory;
let server;
let baseUrl;

before(async () => {
	directory = await fs.mkdtemp(path.join(os.tmpdir(), 'sudoku-leaderboard-'));
	server = createServer({ dataFile: path.join(directory, 'data', 'leaderboard.json') });
	await new Promise((resolve, reject) => {
		server.once('error', reject);
		server.listen(0, '127.0.0.1', resolve);
	});
	baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
	if (server) await new Promise(resolve => server.close(resolve));
	if (directory) await fs.rm(directory, { recursive: true, force: true });
});

test('serves the game and persists validated top-ten records across API requests', async () => {
	const page = await fetch(baseUrl);
	assert.equal(page.status, 200);
	assert.match(page.headers.get('content-type'), /text\/html/);

	const emptyRanking = await fetch(`${baseUrl}/api/leaderboard`);
	assert.deepEqual(await emptyRanking.json(), { records: [] });

	const firstSubmission = await fetch(`${baseUrl}/api/leaderboard`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ name: '  Ada  ', seconds: 120, difficulty: 'medium' })
	});
	assert.equal(firstSubmission.status, 201);
	const firstResult = await firstSubmission.json();
	assert.equal(firstResult.rank, 1);
	assert.equal(firstResult.records[0].name, 'Ada');

	const invalidSubmission = await fetch(`${baseUrl}/api/leaderboard`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ name: '   ', seconds: -1, difficulty: 'unknown' })
	});
	assert.equal(invalidSubmission.status, 400);

	const oversizedSubmission = await fetch(`${baseUrl}/api/leaderboard`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ name: 'A'.repeat(5000), seconds: 1, difficulty: 'easy' })
	});
	assert.equal(oversizedSubmission.status, 413);

	const submissions = Array.from({ length: 12 }, (_, index) => fetch(`${baseUrl}/api/leaderboard`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ name: `Player ${index}`, seconds: 110 - index, difficulty: 'medium' })
	}));
	const responses = await Promise.all(submissions);
	assert.ok(responses.every(response => response.status === 201));

	const savedRankingResponse = await fetch(`${baseUrl}/api/leaderboard`);
	const savedRanking = await savedRankingResponse.json();
	assert.equal(savedRanking.records.length, 10);
	assert.deepEqual(
		savedRanking.records.map(record => record.seconds),
		[99, 100, 101, 102, 103, 104, 105, 106, 107, 108]
	);
	assert.ok(savedRanking.records.every(record => record.difficulty === 'medium'));

	const otherDifficultyResponse = await fetch(`${baseUrl}/api/leaderboard`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ name: 'Grace', seconds: 75, difficulty: 'hard' })
	});
	assert.equal(otherDifficultyResponse.status, 201);
	const finalRanking = await (await fetch(`${baseUrl}/api/leaderboard`)).json();
	assert.equal(finalRanking.records.filter(record => record.difficulty === 'medium').length, 10);
	assert.equal(finalRanking.records.filter(record => record.difficulty === 'hard').length, 1);

	const dataFile = path.join(directory, 'data', 'leaderboard.json');
	const diskData = JSON.parse(await fs.readFile(dataFile, 'utf8'));
	assert.equal(diskData.records.length, 11);
});
