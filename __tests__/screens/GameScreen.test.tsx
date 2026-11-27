import React from 'react';
import { Alert } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';
import GameScreen from '../../screens/GameScreen';
import { initDatabase, createGame, getScoreHistory, getChipHistory, getNextHanchan } from '../../database';

const PLAYERS = ['東家', '南家', '西家', '北家'];

const renderGame = () => {
  const gameId = createGame(4, PLAYERS);
  const props = { onFinish: jest.fn(), onSuspend: jest.fn() };
  render(<GameScreen gameId={gameId} {...props} />);
  // DrumRollInput の増減ボタン。画面上はポイント入力（4人）→ チップ移動（4人）の順に並ぶので、
  // 先頭 4 つがポイント入力、続く 4 つがチップ移動のボタンになる。
  // 値の表示（例: +10）と同じ文字列になるため、操作前に取得しておく
  const plus10 = screen.getAllByText('+10');
  const minus10 = screen.getAllByText('-10');
  const plus1 = screen.getAllByText('+1');
  const minus1 = screen.getAllByText('-1');
  const score = (i: number) => ({ plus10: plus10[i], minus10: minus10[i], plus1: plus1[i], minus1: minus1[i] });
  const chip = (i: number) => score(PLAYERS.length + i);
  return { gameId, props, score, chip };
};

describe('GameScreen: スコア入力 → 記録', () => {
  beforeEach(() => {
    initDatabase();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('プレイヤー名と第1半荘の入力欄が表示される', () => {
    renderGame();
    expect(screen.getByText('ポイント入力')).toBeOnTheScreen();
    expect(screen.getByText('チップ移動')).toBeOnTheScreen();
    PLAYERS.forEach(name => expect(screen.getAllByText(name).length).toBeGreaterThan(0));
    expect(screen.getAllByText('+10')).toHaveLength(PLAYERS.length * 2);
  });

  it('合計が±0になるようにポイントを入力して記録すると、履歴に保存・表示される', () => {
    const { gameId, score } = renderGame();

    // 東家 +30 / 南家 +12 / 西家 -12 / 北家 -30
    for (let i = 0; i < 3; i++) fireEvent.press(score(0).plus10);
    fireEvent.press(score(1).plus10);
    fireEvent.press(score(1).plus1);
    fireEvent.press(score(1).plus1);
    fireEvent.press(score(2).minus10);
    fireEvent.press(score(2).minus1);
    fireEvent.press(score(2).minus1);
    for (let i = 0; i < 3; i++) fireEvent.press(score(3).minus10);

    expect(screen.getAllByText('合計: 0')).toHaveLength(2); // ポイント入力・チップ移動の合計表示
    fireEvent.press(screen.getByText('スコアを記録'));

    expect(Alert.alert).toHaveBeenCalledWith('完了', '第1半荘のスコアを記録しました');

    // DB に順位付きで保存されている
    const history = getScoreHistory(gameId);
    const byPlayer = Object.fromEntries(history.map(h => [h.player_name, { point: h.point, rank: h.rank, hanchan: h.hanchan }]));
    expect(byPlayer).toEqual({
      東家: { point: 30, rank: 1, hanchan: 1 },
      南家: { point: 12, rank: 2, hanchan: 1 },
      西家: { point: -12, rank: 3, hanchan: 1 },
      北家: { point: -30, rank: 4, hanchan: 1 },
    });
    expect(getNextHanchan(gameId)).toBe(2);

    // 画面の記録履歴に表示され、ヘッダーは次の半荘に進み、入力欄は 0 に戻る
    expect(screen.getByText('第1半荘')).toBeOnTheScreen();
    expect(screen.getByText('第2半荘')).toBeOnTheScreen();
    expect(screen.getAllByText('1位').length).toBeGreaterThan(0);
    expect(screen.getAllByText('合計: 0')).toHaveLength(2);
  });

  it('続けて記録すると半荘番号が進む', () => {
    const { gameId, score } = renderGame();

    fireEvent.press(score(0).plus10);
    fireEvent.press(score(1).minus10);
    fireEvent.press(screen.getByText('スコアを記録'));
    fireEvent.press(score(2).plus10);
    fireEvent.press(score(3).minus10);
    fireEvent.press(screen.getByText('スコアを記録'));

    expect(Alert.alert).toHaveBeenNthCalledWith(1, '完了', '第1半荘のスコアを記録しました');
    expect(Alert.alert).toHaveBeenNthCalledWith(2, '完了', '第2半荘のスコアを記録しました');
    expect(screen.getByText('第1半荘')).toBeOnTheScreen();
    expect(screen.getByText('第2半荘')).toBeOnTheScreen();
    expect(screen.getByText('第3半荘')).toBeOnTheScreen(); // ヘッダーの現在の半荘
    expect(getScoreHistory(gameId)).toHaveLength(8);
  });

  it('合計が±0でないと入力エラーになり記録されない', () => {
    const { gameId, score } = renderGame();

    fireEvent.press(score(0).plus10);
    expect(screen.getByText('合計: +10')).toBeOnTheScreen();
    fireEvent.press(screen.getByText('スコアを記録'));

    expect(Alert.alert).toHaveBeenCalledWith(
      '入力エラー',
      'ポイントの合計が+10になっています。\n合計が±0になるように調整してください'
    );
    expect(getScoreHistory(gameId)).toHaveLength(0);
    // 「第1半荘」はヘッダーの現在の半荘表示のみ（記録履歴には出ない）
    expect(screen.getAllByText('第1半荘')).toHaveLength(1);
  });

  it('全員0点のままでは記録できない', () => {
    const { gameId } = renderGame();
    fireEvent.press(screen.getByText('スコアを記録'));
    expect(Alert.alert).toHaveBeenCalledWith('入力エラー', '全員0点では記録できません。ポイントを設定してください');
    expect(getScoreHistory(gameId)).toHaveLength(0);
  });

  it('リセットするとポイント入力が0に戻る', () => {
    const { score } = renderGame();
    fireEvent.press(score(0).plus10);
    expect(screen.getByText('合計: +10')).toBeOnTheScreen();
    fireEvent.press(screen.getAllByText('リセット')[0]);
    expect(screen.queryByText('合計: +10')).toBeNull();
  });

  it('チップ移動を入力して記録すると保存される', () => {
    const { gameId, chip } = renderGame();

    fireEvent.press(chip(0).plus1);
    fireEvent.press(chip(0).plus1);
    fireEvent.press(chip(1).minus1);
    fireEvent.press(chip(1).minus1);
    fireEvent.press(screen.getByText('チップを記録'));

    expect(Alert.alert).toHaveBeenCalledWith('完了', 'チップ移動を記録しました');
    const chips = Object.fromEntries(getChipHistory(gameId).map(c => [c.player_name, c.chip_point]));
    expect(chips).toEqual({ 東家: 2, 南家: -2, 西家: 0, 北家: 0 });
  });
});
