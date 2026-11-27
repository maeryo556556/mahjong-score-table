import React from 'react';
import { Alert } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';
import PastGamesScreen from '../../screens/PastGamesScreen';
import getDb, { initDatabase, createGame, recordScore, recordChip, finishGame, getFinishedGames } from '../../database';

/** 終了済みゲームを作る。開始日・作成日時は表示順を固定するため明示的に設定する */
const seedFinishedGame = (opts: {
  players: string[];
  startDate: string;
  createdAt: number;
  hanchans: number[][];
  chips?: number[];
}) => {
  const gameId = createGame(opts.players.length, opts.players);
  getDb().runSync('UPDATE games SET start_date = ?, created_at = ? WHERE id = ?', [opts.startDate, opts.createdAt, gameId]);
  opts.hanchans.forEach((points, i) => {
    recordScore(gameId, i + 1, opts.players.map((player, j) => ({ player, point: points[j], rank: 0 })));
  });
  if (opts.chips) {
    recordChip(gameId, opts.hanchans.length, opts.players.map((player, j) => ({ player, chipPoint: opts.chips![j] })));
  }
  finishGame(gameId);
  return gameId;
};

const renderPastGames = () => {
  const props = {
    onSelectGame: jest.fn(),
    onBack: jest.fn(),
    onResumeLiveGame: jest.fn(),
    onJoinLiveSession: jest.fn(),
  };
  render(<PastGamesScreen {...props} />);
  return props;
};

describe('PastGamesScreen: 過去のゲーム一覧', () => {
  beforeEach(() => {
    initDatabase();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('保存されたゲームがなければその旨を表示する', () => {
    renderPastGames();
    expect(screen.getByText('過去のゲーム')).toBeOnTheScreen();
    expect(screen.getByText('保存されたゲームはありません')).toBeOnTheScreen();
    // 選択できるゲームがないので「選択」ボタンも出さない
    expect(screen.queryByText('選択')).toBeNull();
  });

  it('終了済みゲームを新しい順に、開始日・麻雀タイプ・最終スコア・半荘数つきで表示する', () => {
    seedFinishedGame({
      players: ['東家', '南家', '西家', '北家'],
      startDate: '2026/11/01',
      createdAt: 1000,
      hanchans: [[30, 10, -10, -30], [-20, 40, 0, -20]],
      chips: [2, -2, 0, 0],
    });
    seedFinishedGame({
      players: ['Aさん', 'Bさん', 'Cさん'],
      startDate: '2026/11/20',
      createdAt: 2000,
      hanchans: [[15, 5, -20]],
    });

    renderPastGames();

    const dates = screen.getAllByText(/^2026\/11\/\d{2}$/).map(el => el.props.children);
    expect(dates).toEqual(['2026/11/20', '2026/11/01']);
    expect(screen.getByText('4人麻雀')).toBeOnTheScreen();
    expect(screen.getByText('3人麻雀')).toBeOnTheScreen();
    expect(screen.getByText('2半荘')).toBeOnTheScreen();
    expect(screen.getByText('1半荘')).toBeOnTheScreen();

    // 最終スコア（スコア合計 + チップ合計）: 東家 30-20+2 = +12、南家 10+40-2 = +48、西家 -10、北家 -50
    expect(screen.getByText('東家')).toBeOnTheScreen();
    expect(screen.getByText('+12')).toBeOnTheScreen();
    expect(screen.getByText('+48')).toBeOnTheScreen();
    expect(screen.getByText('-50')).toBeOnTheScreen();
    expect(screen.getByText('-20')).toBeOnTheScreen(); // Cさん
  });

  it('ゲームをタップするとそのゲームを開く', () => {
    const gameId = seedFinishedGame({
      players: ['東家', '南家', '西家', '北家'],
      startDate: '2026/11/01',
      createdAt: 1000,
      hanchans: [[30, 10, -10, -30]],
    });
    const props = renderPastGames();

    fireEvent.press(screen.getByText('2026/11/01'));
    expect(props.onSelectGame).toHaveBeenCalledWith(gameId);
  });

  it('星ボタンでお気に入りに登録・解除できる', () => {
    seedFinishedGame({
      players: ['東家', '南家', '西家', '北家'],
      startDate: '2026/11/01',
      createdAt: 1000,
      hanchans: [[30, 10, -10, -30]],
    });
    renderPastGames();

    fireEvent.press(screen.getByLabelText('お気に入りに登録'));
    expect(getFinishedGames()[0].favorite).toBe(1);
    expect(screen.getByLabelText('お気に入りを解除')).toBeOnTheScreen();

    fireEvent.press(screen.getByLabelText('お気に入りを解除'));
    expect(getFinishedGames()[0].favorite).toBe(0);
    expect(screen.getByLabelText('お気に入りに登録')).toBeOnTheScreen();
  });

  it('「← 戻る」でセットアップ画面へ戻る', () => {
    const props = renderPastGames();
    fireEvent.press(screen.getByText('← 戻る'));
    expect(props.onBack).toHaveBeenCalledTimes(1);
  });
});
