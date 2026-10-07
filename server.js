const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const publicFiles = new Map([
	['/', ['index.html', 'text/html; charset=utf-8']],
	['/index.html', ['index.html', 'text/html; charset=utf-8']],
	['/game.js', ['game.js', 'text/javascript; charset=utf-8']],
	['/reset.css', ['reset.css', 'text/css; charset=utf-8']],
	['/layout.css', ['layout.css', 'text/css; charset=utf-8']],
	['/main.css', ['main.css', 'text/css; charset=utf-8']]
]);
const difficultyNames = new Set(['easy', 'medium', 'hard']);
const maximumRequestBytes = 4096;

function sendJson(response, statusCode, data) {
	response.writeHead(statusCode, {
		'Content-Type': 'application/json; charset=utf-8',
		'Cache-Control': 'no-store',
		'X-Content-Type-Options': 'nosniff'
	});
	response.end(JSON.stringify(data));
}

async function readRecords(dataFile) {
	try {
		const contents = await fs.readFile(dataFile, 'utf8');
		const data = JSON.parse(contents);
		if (!data || !Array.isArray(data.records)) throw new Error('순위 저장 파일의 형식이 올바르지 않습니다.');
		return data.records.filter(record =>
			record &&
			typeof record.name === 'string' &&
			Number.isInteger(record.seconds) &&
			record.seconds >= 0 &&
			difficultyNames.has(record.difficulty) &&
			typeof record.date === 'string'
		);
	} catch (error) {
		if (error.code === 'ENOENT') return [];
		throw error;
	}
}

async function writeRecords(dataFile, records) {
	await fs.mkdir(path.dirname(dataFile), { recursive: true });
	const temporaryFile = `${dataFile}.${process.pid}.${randomUUID()}.tmp`;
	try {
		await fs.writeFile(temporaryFile, JSON.stringify({ records }, null, 2), { flag: 'wx' });
		await fs.rename(temporaryFile, dataFile);
	} catch (error) {
		await fs.rm(temporaryFile, { force: true });
		throw error;
	}
}

function readRequestBody(request) {
	return new Promise((resolve, reject) => {
		let body = '';
		let size = 0;
		let tooLarge = false;
		request.setEncoding('utf8');
		request.on('data', chunk => {
			if (tooLarge) return;
			size += Buffer.byteLength(chunk);
			if (size > maximumRequestBytes) {
				tooLarge = true;
				body = '';
				return;
			}
			body += chunk;
		});
		request.on('end', () => {
			if (tooLarge) reject(Object.assign(new Error('요청 본문이 너무 큽니다.'), { statusCode: 413 }));
			else resolve(body);
		});
		request.on('error', reject);
	});
}

function createServer({ dataFile = path.join(__dirname, 'data', 'leaderboard.json') } = {}) {
	let writeQueue = Promise.resolve();
	const server = http.createServer(async (request, response) => {
		try {
			const url = new URL(request.url, 'http://localhost');
			if (url.pathname === '/api/leaderboard') {
				if (request.method === 'GET') {
					await writeQueue;
					const records = await readRecords(dataFile);
					sendJson(response, 200, { records });
					return;
				}
				if (request.method === 'POST') {
					if (!request.headers['content-type']?.startsWith('application/json')) {
						sendJson(response, 415, { error: 'Content-Type은 application/json이어야 합니다.' });
						return;
					}
					const body = await readRequestBody(request);
					let submission;
					try {
						submission = JSON.parse(body);
					} catch {
						sendJson(response, 400, { error: 'JSON 요청 본문을 확인해주세요.' });
						return;
					}
					if (
						!submission ||
						typeof submission.name !== 'string' ||
						!submission.name.trim() ||
						submission.name.trim().length > 20 ||
						!Number.isInteger(submission.seconds) ||
						submission.seconds < 0 ||
						submission.seconds > 86400 ||
						!difficultyNames.has(submission.difficulty)
					) {
						sendJson(response, 400, { error: '이름, 완성 시간 또는 난이도가 올바르지 않습니다.' });
						return;
					}

					const save = writeQueue.then(async () => {
						const record = {
							name: submission.name.trim(),
							seconds: submission.seconds,
							difficulty: submission.difficulty,
							date: new Date().toISOString()
						};
						const existingRecords = await readRecords(dataFile);
						const levelRecords = [...existingRecords.filter(item => item.difficulty === record.difficulty), record]
							.sort((first, second) => first.seconds - second.seconds || first.date.localeCompare(second.date));
						const rank = levelRecords.indexOf(record) + 1;
						const otherRecords = existingRecords.filter(item => item.difficulty !== record.difficulty);
						const records = [...otherRecords, ...levelRecords.slice(0, 10)];
						await writeRecords(dataFile, records);
						return { records, rank };
					});
					writeQueue = save.then(() => {}, () => {});
					const result = await save;
					sendJson(response, 201, result);
					return;
				}
				response.setHeader('Allow', 'GET, POST');
				sendJson(response, 405, { error: '지원하지 않는 요청 방식입니다.' });
				return;
			}

			if (request.method !== 'GET' && request.method !== 'HEAD') {
				response.writeHead(405, { Allow: 'GET, HEAD' });
				response.end();
				return;
			}
			let pathname;
			try {
				pathname = decodeURIComponent(url.pathname);
			} catch {
				response.writeHead(400);
				response.end();
				return;
			}
			const publicFile = publicFiles.get(pathname);
			if (!publicFile) {
				response.writeHead(404);
				response.end('Not found');
				return;
			}
			const [filename, contentType] = publicFile;
			const contents = await fs.readFile(path.join(__dirname, filename));
			response.writeHead(200, {
				'Content-Type': contentType,
				'X-Content-Type-Options': 'nosniff'
			});
			response.end(request.method === 'HEAD' ? undefined : contents);
		} catch (error) {
			if (response.headersSent || response.destroyed) return;
			const statusCode = error.statusCode || 500;
			if (statusCode >= 500) console.error('요청을 처리하지 못했습니다.', error);
			sendJson(response, statusCode, { error: statusCode === 500 ? '서버에서 요청을 처리하지 못했습니다.' : error.message });
		}
	});
	return server;
}

if (require.main === module) {
	const port = Number(process.env.PORT || 3000);
	const server = createServer();
	server.listen(port, '0.0.0.0', () => {
		console.log(`스도쿠 서버가 http://localhost:${port} 에서 실행 중입니다.`);
	});
}

module.exports = { createServer };
