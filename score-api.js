async function postScore(record) {
	const response = await fetch('/api/scores', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(record)
	});
	const result = await response.json();
	if (!response.ok) throw new Error(result.error || '순위 기록 요청을 처리하지 못했습니다.');
	return result;
}

window.scoreApi = {
	async getRecords(game, difficulty) {
		const query = new URLSearchParams({ game, difficulty });
		const response = await fetch(`/api/scores?${query}`);
		const result = await response.json();
		if (!response.ok) throw new Error(result.error || '순위 기록을 불러오지 못했습니다.');
		return result.records;
	},

	async checkRecord(record) {
		return postScore(record);
	},

	async saveRecord(record) {
		const result = await postScore(record);
		return result.qualifies ? result.rank : null;
	}
};
