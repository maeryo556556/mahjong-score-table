import { createRandom, wobblyCircle, wobblyCurve, wobblyLine } from '../components/icons/sketch';

// SVG パスとして解釈できる文字（コマンドと数値）だけで構成されているか
const isValidPath = (d: string) => /^M[-\d. MLQ]+$/.test(d) && !d.includes('NaN');

describe('createRandom', () => {
  it('同じシードなら同じ乱数列を返す', () => {
    const a = createRandom(42);
    const b = createRandom(42);
    const seqA = Array.from({ length: 5 }, () => a());
    const seqB = Array.from({ length: 5 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it('0 以上 1 未満の値を返す', () => {
    const r = createRandom(7);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('シードが違えば異なる乱数列になる', () => {
    expect(createRandom(1)()).not.toBe(createRandom(2)());
  });
});

describe('wobblyLine', () => {
  it('同じシードなら同じパスになる（再描画で線が震えない）', () => {
    const pts: [number, number][] = [[2, 2], [20, 3], [18, 20]];
    expect(wobblyLine(pts, 5)).toBe(wobblyLine(pts, 5));
    expect(wobblyLine(pts, 5)).not.toBe(wobblyLine(pts, 6));
  });

  it('有効なパス文字列を返し、辺ごとにサブパスを作る', () => {
    const d = wobblyLine([[0, 0], [10, 0], [10, 10]], 1);
    expect(isValidPath(d)).toBe(true);
    expect(d.match(/M/g)).toHaveLength(2);
  });

  it('closed なら最後の点から最初の点へ戻る辺も描く', () => {
    const d = wobblyLine([[0, 0], [10, 0], [10, 10]], 1, { closed: true });
    expect(d.match(/M/g)).toHaveLength(3);
  });

  it('揺らぎは指定した大きさ程度に収まる', () => {
    const d = wobblyLine([[0, 12], [24, 12]], 3, { amplitude: 0.5 });
    const ys = d
      .split(/[MLQ]/)
      .filter(Boolean)
      .flatMap(seg => seg.trim().split(' ').map(Number).filter((_, i) => i % 2 === 1));
    ys.forEach(y => expect(Math.abs(y - 12)).toBeLessThanOrEqual(0.5));
  });
});

describe('wobblyCurve / wobblyCircle', () => {
  it('有効なパス文字列を返す', () => {
    expect(isValidPath(wobblyCurve([[0, 0], [5, 5], [10, 0], [15, 5]], 2))).toBe(true);
    expect(isValidPath(wobblyCurve([[0, 0], [5, 5], [10, 0]], 2, { closed: true }))).toBe(true);
    expect(isValidPath(wobblyCircle(12, 12, 6, 9))).toBe(true);
  });

  it('手描きの円はおおむね指定した半径に沿う', () => {
    const d = wobblyCircle(12, 12, 6, 4);
    const nums = d.split(/[MQ]/).filter(Boolean).flatMap(seg => seg.trim().split(' ').map(Number));
    for (let i = 0; i < nums.length; i += 2) {
      const dist = Math.hypot(nums[i] - 12, nums[i + 1] - 12);
      expect(dist).toBeGreaterThan(5);
      expect(dist).toBeLessThan(7);
    }
  });
});
