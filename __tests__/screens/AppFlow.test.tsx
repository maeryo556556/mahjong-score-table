import React from 'react';
import { Alert } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';
import Index from '../../app/index';
import { initDatabase, getFinishedGames } from '../../database';

// app/index.tsx はディープリンクのパラメータだけ expo-router から読む
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({}),
}));

describe('アプリ全体の主要フロー', () => {
  beforeEach(() => {
    initDatabase();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('新規ゲーム開始 → スコア記録 → ゲーム終了 → 過去のゲーム一覧に表示される', () => {
    render(<Index />);

    // セットアップ画面: 名前を入力してゲーム開始
    const inputs = screen.getAllByPlaceholderText('名前を入力');
    ['東家', '南家', '西家', '北家'].forEach((name, i) => fireEvent.changeText(inputs[i], name));
    fireEvent.press(screen.getByText('ゲーム開始'));

    // ゲーム画面: 東家 +20 / 南家 -20 を記録
    expect(screen.getByText('第1半荘')).toBeOnTheScreen();
    const plus10 = screen.getAllByText('+10');
    const minus10 = screen.getAllByText('-10');
    fireEvent.press(plus10[0]);
    fireEvent.press(plus10[0]);
    fireEvent.press(minus10[1]);
    fireEvent.press(minus10[1]);
    fireEvent.press(screen.getByText('スコアを記録'));
    expect(Alert.alert).toHaveBeenCalledWith('完了', '第1半荘のスコアを記録しました');
    expect(screen.getByText('第2半荘')).toBeOnTheScreen();

    // ゲーム終了: 確認モーダルで「終了する」
    fireEvent.press(screen.getByText('ゲーム終了'));
    fireEvent.press(screen.getByText('終了する'));

    // セットアップ画面に戻り、過去のゲームが 1 件になる
    expect(screen.getByText('新規ゲーム')).toBeOnTheScreen();
    expect(screen.getByText('過去のゲーム 1件（お気に入り 0件）')).toBeOnTheScreen();
    expect(getFinishedGames()).toHaveLength(1);

    // 過去のゲーム一覧に表示される
    fireEvent.press(screen.getByText('過去のゲームを見る'));
    expect(screen.getByText('1半荘')).toBeOnTheScreen();
    expect(screen.getByText('+20')).toBeOnTheScreen();
    expect(screen.getByText('-20')).toBeOnTheScreen();

    // 一覧のゲームを開くと閲覧（読み取り専用）で表示され、スコア入力欄は出ない
    fireEvent.press(screen.getByText('1半荘'));
    expect(screen.getByText('第1半荘')).toBeOnTheScreen();
    expect(screen.queryByText('スコアを記録')).toBeNull();
  });

  it('中断したゲームはセットアップ画面に表示され、タップで再開できる', () => {
    (Alert.alert as jest.Mock).mockImplementation((title, _message, buttons) => {
      // 中断の確認ダイアログでは「中断する」を押す
      if (title === '確認') buttons?.find((b: { text?: string }) => b.text === '中断する')?.onPress?.();
    });
    render(<Index />);

    const inputs = screen.getAllByPlaceholderText('名前を入力');
    ['A', 'B', 'C', 'D'].forEach((name, i) => fireEvent.changeText(inputs[i], name));
    fireEvent.press(screen.getByText('ゲーム開始'));
    fireEvent.press(screen.getByText('中断'));

    expect(screen.getByText('中断中のゲーム')).toBeOnTheScreen();
    expect(screen.getByText('A / B / C / D')).toBeOnTheScreen();
    // 前回のプレイヤー名が新規ゲームの入力欄に入っている
    expect(screen.getAllByPlaceholderText('名前を入力').map(el => el.props.value)).toEqual(['A', 'B', 'C', 'D']);

    fireEvent.press(screen.getByText('タップして再開 →'));
    expect(screen.getByText('スコアを記録')).toBeOnTheScreen();
    expect(screen.getByText('第1半荘')).toBeOnTheScreen();
  });
});
