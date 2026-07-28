import { backOut, cubicIn } from "svelte/easing";

export function createResizable(initial_width = 400) {
	const MIN_WIDTH = 300;
	const MAX_RATIO = 0.8;

	let width = $state(initial_width);
	let is_resizing = $state(false);

	function handleMouseMove(e) {
		if (!is_resizing) return;
		const new_width = window.innerWidth - e.clientX;
		if (new_width > MIN_WIDTH && new_width < window.innerWidth * MAX_RATIO) {
			width = new_width;
		}
	}

	function stopResize() {
		is_resizing = false;
		window.removeEventListener("mousemove", handleMouseMove);
		window.removeEventListener("mouseup", stopResize);
	}

	function startResize(e) {
		is_resizing = true;
		window.addEventListener("mousemove", handleMouseMove);
		window.addEventListener("mouseup", stopResize);
	}

	return {
		get width() { return width; },
		get is_resizing() { return is_resizing; },
		startResize
	};
}

export function panelIn(node, { duration = 320 } = {}) {
	return {
		duration: 320,
		easing: backOut,
		css: (t) => {
			const s = 0.86 + 0.14 * t;
			const y = 18 * (1 - t);
			return `transform: scale(${s}) translateY(${y}px); opacity: ${t};`;
		}
	};
}

export function panelOut(node, { duration = 200 } = {}) {
	return {
		duration: 200,
		easing: cubicIn,
		css: (t) => {
			const s = 0.88 + 0.12 * t;
			const y = 14 * (1 - t);
			return `transform: scale(${s}) translateY(${y}px); opacity: ${t};`;
		}
	};
}