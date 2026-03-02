import {
  calcRanks,
  isAllZero,
  calcTotal,
  clampValue,
  encodeShareCode,
  decodeShareCode,
  validateShareData,
  formatDate,
  formatTime,
} from '../utils';
import type { ShareGameDataV1, ShareGameDataV2 } from '../utils';

describe('calcRanks', () => {
  it('異なるポイントで正しく順位をつける', () => {
    const players = ['A', 'B', 'C', 'D'];
    const scores = new Map([['A', 30], ['B', 10], ['C', -20], ['D', -20]]);
    const ranks = calcRanks(players, scores);
    expect(ranks.get('A')).toBe(1);
    expect(ranks.get('B')).toBe(2);
    expect(ranks.get('C')).toBe(3);
    expect(ranks.get('D')).toBe(3);
  });

  it('全員同点の場合は全員1位', () => {
    const players = ['A', 'B', 'C'];
    const scores = new Map([['A', 0], ['B', 0], ['C', 0]]);
    const ranks = calcRanks(players, scores);
    expect(ranks.get('A')).toBe(1);
    expect(ranks.get('B')).toBe(1);
    expect(ranks.get('C')).toBe(1);
  });

  it('1位タイ→3位のケース', () => {
    const players = ['A', 'B', 'C'];
    const scores = new Map([['A', 10], ['B', 10], ['C', -20]]);
    const ranks = calcRanks(players, scores);
    expect(ranks.get('A')).toBe(1);
    expect(ranks.get('B')).toBe(1);
    expect(ranks.get('C')).toBe(3);
  });

  it('scoresMapに値がないプレイヤーは0点として扱う', () => {
    const players = ['A', 'B', 'C'];
    const scores = new Map([['A', 10]]);
    const ranks = calcRanks(players, scores);
    expect(ranks.get('A')).toBe(1);
    expect(ranks.get('B')).toBe(2);
    expect(ranks.get('C')).toBe(2);
  });

  it('3人麻雀の順位', () => {
    const players = ['太郎', '花子', '次郎'];
    const scores = new Map([['太郎', 50], ['花子', -20], ['次郎', -30]]);
    const ranks = calcRanks(players, scores);
    expect(ranks.get('太郎')).toBe(1);
    expect(ranks.get('花子')).toBe(2);
    expect(ranks.get('次郎')).toBe(3);
  });
});

describe('isAllZero', () => {
  it('全て0ならtrue', () => {
    expect(isAllZero([0, 0, 0, 0])).toBe(true);
  });

  it('1つでも0でなければfalse', () => {
    expect(isAllZero([0, 0, 1, 0])).toBe(false);
  });

  it('負の値があればfalse', () => {
    expect(isAllZero([0, -1, 0, 0])).toBe(false);
  });

  it('空配列はtrue', () => {
    expect(isAllZero([])).toBe(true);
  });
});

describe('calcTotal', () => {
  it('合計が0', () => {
    expect(calcTotal([10, -5, -5, 0])).toBe(0);
  });

  it('合計がプラス', () => {
    expect(calcTotal([10, 5, -5, 0])).toBe(10);
  });

  it('合計がマイナス', () => {
    expect(calcTotal([-10, -5, 5, 0])).toBe(-10);
  });

  it('空配列は0', () => {
    expect(calcTotal([])).toBe(0);
  });
});

describe('clampValue', () => {
  it('範囲内の値はそのまま', () => {
    expect(clampValue(50, -200, 200)).toBe(50);
  });

  it('最大値を超えたらmax', () => {
    expect(clampValue(250, -200, 200)).toBe(200);
  });

  it('最小値未満ならmin', () => {
    expect(clampValue(-250, -200, 200)).toBe(-200);
  });

  it('境界値はそのまま', () => {
    expect(clampValue(200, -200, 200)).toBe(200);
    expect(clampValue(-200, -200, 200)).toBe(-200);
  });
});

describe('encodeShareCode / decodeShareCode', () => {
  it('ASCII文字列のラウンドトリップ', () => {
    const original = '{"v":2,"pc":4,"d":"2025/01/15","p":["A","B","C","D"],"s":[[1,0,10],[1,1,-10],[1,2,5],[1,3,-5]]}';
    const encoded = encodeShareCode(original);
    const decoded = decodeShareCode(encoded);
    expect(decoded).toBe(original);
  });

  it('日本語を含むデータのラウンドトリップ', () => {
    const original = JSON.stringify({
      v: 2,
      pc: 3,
      d: '2025/03/01',
      p: ['太郎', '花子', '次郎'],
      s: [[1, 0, 10], [1, 1, -5], [1, 2, -5]],
    });
    const encoded = encodeShareCode(original);
    const decoded = decodeShareCode(encoded);
    expect(decoded).toBe(original);
    expect(JSON.parse(decoded).p).toEqual(['太郎', '花子', '次郎']);
  });

  it('空のスコア・チップデータ', () => {
    const original = JSON.stringify({ v: 2, pc: 4, d: '2025/01/01', p: ['A', 'B', 'C', 'D'], s: [] });
    const encoded = encodeShareCode(original);
    const decoded = decodeShareCode(encoded);
    expect(JSON.parse(decoded)).toEqual(JSON.parse(original));
  });
});

describe('validateShareData', () => {
  it('v1形式のデータを有効と判定', () => {
    const data: ShareGameDataV1 = {
      v: 1,
      pc: 4,
      d: '2025/01/15',
      p: ['A', 'B', 'C', 'D'],
      s: [[1, 'A', 10, 1, 1700000000, '1月15日12:00']],
      c: [[1, 'A', 5, 1700000000, '1月15日12:00']],
    };
    expect(validateShareData(data)).toBe(true);
  });

  it('v2形式のデータを有効と判定', () => {
    const data: ShareGameDataV2 = {
      v: 2,
      pc: 3,
      d: '2025/03/01',
      p: ['太郎', '花子', '次郎'],
      s: [[1, 0, 10], [1, 1, -5], [1, 2, -5]],
    };
    expect(validateShareData(data)).toBe(true);
  });

  it('バージョンが不正なら無効', () => {
    expect(validateShareData({ v: 3, pc: 4, d: '2025/01/01', p: ['A'] })).toBe(false);
  });

  it('pcが欠けていれば無効', () => {
    expect(validateShareData({ v: 2, d: '2025/01/01', p: ['A'] })).toBe(false);
  });

  it('pが配列でなければ無効', () => {
    expect(validateShareData({ v: 2, pc: 4, d: '2025/01/01', p: 'A' })).toBe(false);
  });

  it('nullは無効', () => {
    expect(validateShareData(null)).toBe(false);
  });

  it('undefinedは無効', () => {
    expect(validateShareData(undefined)).toBe(false);
  });

  it('pに文字列以外が含まれれば無効', () => {
    expect(validateShareData({ v: 2, pc: 4, d: '2025/01/01', p: ['A', 123] })).toBe(false);
  });
});

describe('formatDate', () => {
  it('年月日をYYYY/MM/DD形式にフォーマット', () => {
    expect(formatDate(new Date(2025, 0, 5))).toBe('2025/01/05');
    expect(formatDate(new Date(2025, 11, 25))).toBe('2025/12/25');
  });

  it('1桁月日をゼロパディング', () => {
    expect(formatDate(new Date(2025, 2, 1))).toBe('2025/03/01');
  });
});

describe('formatTime', () => {
  it('M月D日HH:mm形式にフォーマット', () => {
    const date = new Date(2025, 0, 15, 14, 30);
    expect(formatTime(date)).toBe('1月15日14:30');
  });

  it('0時台のゼロパディング', () => {
    const date = new Date(2025, 2, 1, 0, 5);
    expect(formatTime(date)).toBe('3月1日00:05');
  });
});
