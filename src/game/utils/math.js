import { k } from "../../lib/kaplay.js";
import { lerp } from "./scalar-math.js";
export { lerp } from "./scalar-math.js";

export function lerpvec2(vec0, vec1, t) {
	const x0 = lerp(vec0.x, vec1.x, t);
	const y0 = lerp(vec0.y, vec1.y, t);
	return k.vec2(x0, y0);
}
