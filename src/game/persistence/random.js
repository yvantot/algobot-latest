export function createRandom(state = (Date.now() >>> 0) || 1) {
  let current = state >>> 0;
  return {
    next() {
      current = (current + 0x6D2B79F5) >>> 0;
      let n = current;
      n = Math.imul(n ^ n >>> 15, n | 1);
      n ^= n + Math.imul(n ^ n >>> 7, n | 61);
      return ((n ^ n >>> 14) >>> 0) / 4294967296;
    },
    snapshot: () => ({ algorithm: "mulberry32-v1", state: current }),
    restore(value) {
      if (value?.algorithm !== "mulberry32-v1" || !Number.isInteger(value.state) || value.state < 0 || value.state > 0xffffffff) throw Error("Invalid gameplay random state.");
      current = value.state;
    },
  };
}
