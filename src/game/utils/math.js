import { k } from "../../lib/kaplay.js";

export function lerp(v0, v1, t) {
	return v0 + (v1 - v0) * t;
}

export function lerpvec2(vec0, vec1, t) {
	const x0 = lerp(vec0.x, vec1.x, t);
	const y0 = lerp(vec0.y, vec1.y, t);
	return k.vec2(x0, y0);
}
