// Poses of the homepage design deck. No React or DOM imports: the node tests load this file directly.
export const BACK = 2; // cards fanned out behind the front one

// Where a card sits, from its distance o to the front card (0 = front) in a deck of n.
export function cardPose(o: number, n: number, dx = 0): { transform: string; opacity: number; z: number } {
  if (o === 0) return { transform: `translate3d(${dx}px,0,0) rotate(${dx / 18}deg)`, opacity: 1, z: n + 1 };
  // The previous card waits off to the left, so going back slides it in and going forward sends the front card there
  if (n >= 3 && o === n - 1) return { transform: 'translate3d(-115%,0,0) rotate(-10deg)', opacity: 0, z: n + 2 };
  const d = Math.min(o, BACK + 1);
  return { transform: `translate3d(${d * 14}px,${d * 12}px,0) rotate(${d * 3}deg) scale(${1 - d * 0.05})`, opacity: o > BACK ? 0 : 1 - d * 0.18, z: n - o };
}
