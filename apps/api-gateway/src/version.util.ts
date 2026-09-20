/**
 * Compare deux versions "x.y.z". Retourne <0 si a < b, 0 si égales, >0 si a > b.
 * Les segments manquants valent 0 ; un segment non numérique invalide la comparaison (NaN).
 */
export function compareVersions(a: string, b: string): number {
  const pa = a.trim().split('.').map(Number);
  const pb = b.trim().split('.').map(Number);
  const len = Math.max(pa.length, pb.length);

  for (let i = 0; i < len; i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (Number.isNaN(x) || Number.isNaN(y)) return NaN;
    if (x !== y) return x - y;
  }
  return 0;
}
