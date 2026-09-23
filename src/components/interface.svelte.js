import { onDestroy } from "svelte";
import { backOut, cubicIn } from "svelte/easing";

export function createResizable(initial_width = 400) {
	const MIN_WIDTH = 300;
	const MAX_RATIO = 0.8;

	let width = $state(initial_width);
	let is_resizing = $state(false);
	let startX = 0, startWidth = initial_width;

	function handleMouseMove(e) {
		if (!is_resizing) return;
		const new_width = startWidth + startX - e.clientX;
		width = Math.max(MIN_WIDTH, Math.min(window.innerWidth * MAX_RATIO, new_width));
	}

	function stopResize() {
		is_resizing = false;
		window.removeEventListener("mousemove", handleMouseMove);
		window.removeEventListener("mouseup", stopResize);
		window.removeEventListener("blur", stopResize);
	}

	function startResize(e) {
		if (e.button !== 0) return;
		e.preventDefault();
		startX = e.clientX;
		startWidth = e.currentTarget.parentElement.getBoundingClientRect().width;
		is_resizing = true;
		window.addEventListener("mousemove", handleMouseMove);
		window.addEventListener("mouseup", stopResize);
		window.addEventListener("blur", stopResize);
	}

	onDestroy(stopResize);
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