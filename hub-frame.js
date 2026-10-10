const hubOrigin = location.origin === 'null' ? '*' : location.origin;

document.querySelectorAll('[data-hub-game]').forEach((link) => {
	link.addEventListener('click', (event) => {
		if (window.parent === window) return;
		event.preventDefault();
		window.parent.postMessage({ type: 'game-hub:navigate', game: link.dataset.hubGame }, hubOrigin);
	});
});

if (window.parent !== window) {
	const reportHeight = () => {
		const height = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
		window.parent.postMessage({ type: 'game-hub:height', height }, hubOrigin);
	};
	new ResizeObserver(reportHeight).observe(document.documentElement);
	new MutationObserver(reportHeight).observe(document.body, { childList: true, subtree: true, attributes: true });
	window.addEventListener('load', reportHeight);
	window.addEventListener('resize', reportHeight);
	requestAnimationFrame(reportHeight);
}