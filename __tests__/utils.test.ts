import {
  calcRanks,
  isAllZero,
  calcTotal,
  clampValue,
  validateShareData,
  formatDate,
  formatTime,
  buildDefaultPlayerNames,
  validatePlayerNamesChange,
  hasPlayerNamesChanged,
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

describe('buildDefaultPlayerNames', () => {
  it('直近のゲームがない場合は空欄4枠を返す', () => {
    expect(buildDefaultPlayerNames(null)).toEqual(['', '', '', '']);
    expect(buildDefaultPlayerNames(undefined)).toEqual(['', '', '', '']);
    expect(buildDefaultPlayerNames([])).toEqual(['', '', '', '']);
  });

  it('4人麻雀のプレイヤー名をそのまま入れる', () => {
    expect(buildDefaultPlayerNames(['A', 'B', 'C', 'D'])).toEqual(['A', 'B', 'C', 'D']);
  });

  it('3人麻雀のプレイヤー名は4枠目を空欄にする', () => {
    expect(buildDefaultPlayerNames(['A', 'B', 'C'])).toEqual(['A', 'B', 'C', '']);
  });

  it('5人以上の名前が渡されても4枠に収める', () => {
    expect(buildDefaultPlayerNames(['A', 'B', 'C', 'D', 'E'])).toEqual(['A', 'B', 'C', 'D']);
  });

  it('元の配列を変更しない', () => {
    const last = ['A', 'B', 'C'];
    const result = buildDefaultPlayerNames(last);
    result[0] = 'X';
    expect(last).toEqual(['A', 'B', 'C']);
  });
});

describe('validatePlayerNamesChange（Issue #58: ゲーム途中の名前変更）', () => {
  const current = ['太郎', '花子', '次郎', '美咲'];

  it('正しい入力なら null', () => {
    expect(validatePlayerNamesChange(current, ['たろう', '花子', '次郎', '美咲'])).toBeNull();
  });

  it('前後の空白は無視して検証する', () => {
    expect(validatePlayerNamesChange(current, [' たろう ', '花子', '次郎', '美咲'])).toBeNull();
  });

  it('名前の入れ替えは許可する', () => {
    expect(validatePlayerNamesChange(current, ['花子', '太郎', '次郎', '美咲'])).toBeNull();
  });

  it('空欄はエラー', () => {
    expect(validatePlayerNamesChange(current, ['太郎', '  ', '次郎', '美咲'])).toBe('すべてのプレイヤーの名前を入力してください');
  });

  it('5文字以上はエラー', () => {
    expect(validatePlayerNamesChange(current, ['たろうくん', '花子', '次郎', '美咲'])).toBe('プレイヤー名は4文字以内で入力してください');
  });

  it('重複はエラー（記録は名前で紐づくため）', () => {
    expect(validatePlayerNamesChange(current, ['太郎', '太郎', '次郎', '美咲'])).toBe('同じ名前のプレイヤーがいます。別の名前にしてください');
    expect(validatePlayerNamesChange(current, ['太郎', '太郎 ', '次郎', '美咲'])).not.toBeNull();
  });

  it('人数が変わる入力はエラー', () => {
    expect(validatePlayerNamesChange(current, ['太郎', '花子', '次郎'])).toBe('プレイヤー数が一致しません');
  });

  it('3人麻雀でも検証できる', () => {
    expect(validatePlayerNamesChange(['A', 'B', 'C'], ['A', 'B', 'D'])).toBeNull();
  });
});

describe('hasPlayerNamesChanged', () => {
  it('同じ名前（空白付き含む）なら false', () => {
    expect(hasPlayerNamesChanged(['A', 'B', 'C'], ['A', ' B ', 'C'])).toBe(false);
  });

  it('1人でも変わっていれば true', () => {
    expect(hasPlayerNamesChanged(['A', 'B', 'C'], ['A', 'B', 'D'])).toBe(true);
  });

  it('入れ替えも変更とみなす', () => {
    expect(hasPlayerNamesChanged(['A', 'B', 'C'], ['B', 'A', 'C'])).toBe(true);
  });
});
