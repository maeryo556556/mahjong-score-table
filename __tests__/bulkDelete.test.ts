import {
  toggleSelection,
  selectableGameIds,
  isAllSelected,
  toggleSelectAll,
  pruneSelection,
  countSelectedFavorites,
  buildBulkDeleteMessage,
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

describe('selectableGameIds', () => {
  const games = [{ id: 1 }, { id: 2, favorite: 1 }, { id: 3 }];

  it('除外指定がなければすべてのゲームを選択できる', () => {
    expect(selectableGameIds(games)).toEqual([1, 2, 3]);
  });

  it('ホストとして共有中（進行中）のゲームは選択できない', () => {
    expect(selectableGameIds(games, new Set([1]))).toEqual([2, 3]);
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
});

describe('pruneSelection', () => {
  it('一覧から無くなったゲームを選択から外す', () => {
    expect(pruneSelection([1, 2, 3], [1, 3, 4])).toEqual([1, 3]);
  });

  it('一覧が空になったら選択も空になる', () => {
    expect(pruneSelection([1, 2], [])).toEqual([]);
  });
});

describe('countSelectedFavorites', () => {
  const games = [
    { id: 1, favorite: 1 },
    { id: 2, favorite: 0 },
    { id: 3, favorite: 1 },
    { id: 4 },
  ];

  it('選択中のゲームのうちお気に入りの件数を数える', () => {
    expect(countSelectedFavorites([1, 2, 3, 4], games)).toBe(2);
    expect(countSelectedFavorites([2, 4], games)).toBe(0);
    expect(countSelectedFavorites([3], games)).toBe(1);
    expect(countSelectedFavorites([], games)).toBe(0);
  });
});

describe('buildBulkDeleteMessage', () => {
  it('削除する件数を表示する', () => {
    const msg = buildBulkDeleteMessage(3, 0);
    expect(msg).toContain('3件');
    expect(msg).toContain('取り消せません');
    expect(msg).not.toContain('お気に入り');
  });

  it('お気に入りが含まれる場合はその件数を知らせる', () => {
    const msg = buildBulkDeleteMessage(5, 2);
    expect(msg).toContain('5件');
    expect(msg).toContain('お気に入り登録済みのゲームが2件含まれています');
  });
});
