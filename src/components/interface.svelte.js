import { onDestroy } from "svelte";
import { backOut, cubicIn } from "svelte/easing";

export function createResizable(initial_width = 400) {
	const MIN_WIDTH = 300;
	const MAX_RATIO = 0.8;

	let width = $state(initial_width);
	let is_resizing = $state(false);
	let startX = 0, startWidth = initial_width;
	let pointer = false;

	function handleMouseMove(e) {
		if (!is_resizing) return;
		const new_width = startWidth + startX - e.clientX;
		width = Math.max(MIN_WIDTH, Math.min(window.innerWidth * MAX_RATIO, new_width));
	}

	function stopResize() {
		is_resizing = false;
		window.removeEventListener("mousemove", handleMouseMove);
		window.removeEventListener("mouseup", stopResize);
		window.removeEventListener("pointermove", handleMouseMove);
		window.removeEventListener("pointerup", stopResize);
		window.removeEventListener("pointercancel", stopResize);
		window.removeEventListener("blur", stopResize);
	}

	function startResize(e) {
		if (e.button !== 0) return;
		e.preventDefault();
		startX = e.clientX;
		startWidth = e.currentTarget.parentElement.getBoundingClientRect().width;
		is_resizing = true;
		pointer = e.pointerId !== undefined;
		if(pointer)e.currentTarget.setPointerCapture(e.pointerId);
		window.addEventListener(pointer ? "pointermove" : "mousemove", handleMouseMove);
		window.addEventListener(pointer ? "pointerup" : "mouseup", stopResize);
		if(pointer)window.addEventListener("pointercancel", stopResize);
		window.addEventListener("blur", stopResize);
	}

	function resizeKey(e){
		if(e.key!=="ArrowLeft"&&e.key!=="ArrowRight")return;
		e.preventDefault();
		const current=e.currentTarget.parentElement.getBoundingClientRect().width;
		width=Math.max(MIN_WIDTH,Math.min(window.innerWidth*MAX_RATIO,current+(e.key==="ArrowLeft"?20:-20)));
	}
	onDestroy(stopResize);
	return {
		get width() { return width; },
		get is_resizing() { return is_resizing; },
		startResize, resizeKey
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