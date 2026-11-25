import {
  toggleSelection,
  isGameSelectable,
  selectableGameIds,
  isAllSelected,
  toggleSelectAll,
  pruneSelection,
  buildBulkDeleteMessage,
  calcFinalScores,
  formatSignedScore,
} from '../utils';

// 過去のゲームの複数選択・まとめて削除（Issue #74）

describe('toggleSelection', () => {
  it('未選択なら加え、選択済みなら外す', () => {
    expect(toggleSelection([], 1)).toEqual([1]);
    expect(toggleSelection([1, 2], 3)).toEqual([1, 2, 3]);
    expect(toggleSelection([1, 2, 3], 2)).toEqual([1, 3]);
  });

  it('元の配列を変更しない', () => {
    const selected = [1, 2];
    toggleSelection(selected, 3);
    toggleSelection(selected, 1);
    expect(selected).toEqual([1, 2]);
  });
});

describe('isGameSelectable', () => {
  it('お気に入りでも共有中でもないゲームは選択できる', () => {
    expect(isGameSelectable({ id: 1 })).toBe(true);
    expect(isGameSelectable({ id: 1, favorite: 0 })).toBe(true);
  });

  it('お気に入りのゲームは選択できない（Issue #78）', () => {
    expect(isGameSelectable({ id: 1, favorite: 1 })).toBe(false);
  });

  it('ホストとして共有中（進行中）のゲームは選択できない', () => {
    expect(isGameSelectable({ id: 1 }, new Set([1]))).toBe(false);
  });
});

describe('selectableGameIds', () => {
  const games = [{ id: 1 }, { id: 2, favorite: 1 }, { id: 3, favorite: 0 }, { id: 4 }];

  it('お気に入りのゲームは選択できない（Issue #78）', () => {
    expect(selectableGameIds(games)).toEqual([1, 3, 4]);
  });

  it('ホストとして共有中（進行中）のゲームも選択できない', () => {
    expect(selectableGameIds(games, new Set([1]))).toEqual([3, 4]);
  });
});

describe('isAllSelected / toggleSelectAll', () => {
  const selectable = [1, 2, 3];

  it('すべて選択済みかを判定する（順序は問わない）', () => {
    expect(isAllSelected([3, 1, 2], selectable)).toBe(true);
    expect(isAllSelected([1, 2], selectable)).toBe(false);
    expect(isAllSelected([], selectable)).toBe(false);
  });

  it('選択できるゲームが無いときは「すべて選択済み」とはみなさない', () => {
    expect(isAllSelected([], [])).toBe(false);
  });

  it('一部だけ選択中なら、すべて選択にする', () => {
    expect(toggleSelectAll([2], selectable)).toEqual([1, 2, 3]);
    expect(toggleSelectAll([], selectable)).toEqual([1, 2, 3]);
  });

  it('すべて選択中なら、選択解除する', () => {
    expect(toggleSelectAll([1, 2, 3], selectable)).toEqual([]);
  });

  it('選択できないゲームは「すべて選択」に含めない', () => {
    const ids = selectableGameIds([{ id: 1 }, { id: 2 }, { id: 3 }], new Set([2]));
    expect(toggleSelectAll([], ids)).toEqual([1, 3]);
  });

  it('お気に入りのゲームは「すべて選択」に含めない（Issue #78）', () => {
    const ids = selectableGameIds([{ id: 1, favorite: 1 }, { id: 2 }, { id: 3 }, { id: 4, favorite: 1 }], new Set([3]));
    expect(toggleSelectAll([], ids)).toEqual([2]);
  });
});

describe('pruneSelection', () => {
  it('一覧から無くなったゲームを選択から外す', () => {
    expect(pruneSelection([1, 2, 3], [1, 3, 4])).toEqual([1, 3]);
  });

  it('一覧が空になったら選択も空になる', () => {
    expect(pruneSelection([1, 2], [])).toEqual([]);
  });
});

describe('buildBulkDeleteMessage', () => {
  it('削除する件数を表示し、お気に入りの警告は含めない', () => {
    const msg = buildBulkDeleteMessage(3);
    expect(msg).toContain('3件');
    expect(msg).toContain('取り消せません');
    expect(msg).not.toContain('お気に入り');
  });
});

// 過去のゲーム一覧の最終スコア（Issue #78）
describe('calcFinalScores', () => {
  const players = ['A', 'B', 'C', 'D'];

  it('スコア合計とチップ合計を足した値をプレイヤー順に返す', () => {
    const scores = [
      { player_name: 'A', point: 30 },
      { player_name: 'B', point: 10 },
      { player_name: 'C', point: -15 },
      { player_name: 'D', point: -25 },
      { player_name: 'A', point: -20 },
      { player_name: 'B', point: 40 },
      { player_name: 'C', point: 5 },
      { player_name: 'D', point: -25 },
    ];
    const chips = [
      { player_name: 'A', chip_point: 5 },
      { player_name: 'D', chip_point: -5 },
    ];
    expect(calcFinalScores(players, scores, chips)).toEqual([
      { playerName: 'A', total: 15 },
      { playerName: 'B', total: 50 },
      { playerName: 'C', total: -10 },
      { playerName: 'D', total: -55 },
    ]);
  });

  it('記録の無いプレイヤーは 0 になる', () => {
    expect(calcFinalScores(['A', 'B', 'C'], [{ player_name: 'A', point: 10 }], [])).toEqual([
      { playerName: 'A', total: 10 },
      { playerName: 'B', total: 0 },
      { playerName: 'C', total: 0 },
    ]);
  });

  it('プレイヤー別に集計済みの行（SUM の結果）でも同じ結果になる', () => {
    const aggregated = calcFinalScores(
      ['A', 'B'],
      [{ player_name: 'A', point: 10 }, { player_name: 'B', point: -10 }],
      [{ player_name: 'B', chip_point: 3 }],
    );
    expect(aggregated).toEqual([
      { playerName: 'A', total: 10 },
      { playerName: 'B', total: -7 },
    ]);
  });
});

describe('formatSignedScore', () => {
  it('プラスには「+」を付け、0 とマイナスはそのまま表示する', () => {
    expect(formatSignedScore(120)).toBe('+120');
    expect(formatSignedScore(0)).toBe('0');
    expect(formatSignedScore(-35)).toBe('-35');
  });
});
