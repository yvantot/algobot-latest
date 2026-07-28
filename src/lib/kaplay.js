import kaplay from "kaplay";

export let k;

export function initKaplay() {
	const savedDensity = Number(localStorage.getItem("algobot_pixel_density") || 1);
	const savedSound = localStorage.getItem("algobot_sound") ?? "on";

	k = kaplay({
		canvas: document.getElementById("game"),
		tagsAsComponents: true,
		background: "#000000",
		touchToMouse: true,
		global: false,
		debug: false,

		height: Math.round(innerHeight / 8) * 8,
		width: Math.round(innerWidth / 8) * 8,
		pixelDensity: savedDensity,
		crisp: false,
	});

	const initialVol = savedSound === "on" ? 1 : 0;
	if (typeof k.setVolume === "function") {
		k.setVolume(initialVol);
	} else if (typeof k.volume === "function") {
		k.volume(initialVol);
	}

	return k;
}
