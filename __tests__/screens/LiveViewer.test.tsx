/**
 * 閲覧モード（ゲストのライブ閲覧）の画面テスト
 * Issue #108: 期限切れのセッションは閲覧・保存できない
 *
 * Firestore の代わりにメモリ上のバックエンドを使い、本物の createLiveSessionService を通して表示する。
 */
import React from 'react';
import { Alert } from 'react-native';
import type { AlertButton } from 'react-native';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import GameScreen from '../../screens/GameScreen';
import Index from '../../app/index';
import { initDatabase, importShareData, getFinishedGames, getJoinedSessions } from '../../database';
import { createLiveSessionService, buildSessionDoc, SESSION_TTL_MS } from '../../liveSession';
import type { SessionBackend } from '../../liveSession';
import { getLiveSessionService } from '../../firebase';
import type { ShareGameDataV2 } from '../../utils';

// app/index.tsx はディープリンクのパラメータだけ expo-router から読む
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({}),
}));

const NOW = new Date('2026-11-27T12:00:00+09:00').getTime();
const CODE = '123456';
const PLAYERS = ['太郎', '花子', '次郎', '美咲'];

const game: ShareGameDataV2 = {
  v: 2,
  pc: 4,
  d: '2026/11/27',
  p: PLAYERS,
  s: [
    [1, 0, 30, NOW, '11月27日12:00'],
    [1, 1, 10, NOW, '11月27日12:00'],
    [1, 2, -10, NOW, '11月27日12:00'],
    [1, 3, -30, NOW, '11月27日12:00'],
  ],
};

/** メモリ上の sessions コレクション */
const createMemoryBackend = () => {
  const docs = new Map<string, Record<string, unknown>>();
  const backend: SessionBackend = {
    getUid: async () => 'guest-uid',
    exists: async (code) => docs.has(code),
    create: async (code, doc) => {
      docs.set(code, { ...doc });
    },
    update: async (code, patch) => {
      docs.set(code, { ...docs.get(code)!, ...patch });
    },
    subscribe: (code, onNext) => {
      onNext(docs.has(code) ? { ...docs.get(code)! } : null);
      return () => {};
    },
  };
  return { backend, docs };
};

/** 発行時刻 issuedAt のセッションを用意する */
const seedSession = (docs: Map<string, Record<string, unknown>>, issuedAt: number, ended = false) => {
  docs.set(CODE, { ...buildSessionDoc(game, 'host-uid', issuedAt, ended) });
};

const alertMock = () => Alert.alert as jest.MockedFunction<typeof Alert.alert>;
const lastAlert = () => {
  const calls = alertMock().mock.calls;
  const [title, message, buttons] = calls[calls.length - 1];
  return { title, message, buttons: (buttons ?? []) as AlertButton[] };
};
const pressAlertButton = (text: string) => {
  const button = lastAlert().buttons.find(b => b.text === text);
  if (!button) throw new Error(`ボタン「${text}」がありません`);
  act(() => button.onPress?.());
};

// 購読開始（匿名認証の Promise 解決）を待つ
const flushJoin = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

const renderViewer = () => {
  const props = { onFinish: jest.fn(), onSavedLiveGame: jest.fn() };
  render(<GameScreen liveSessionCode={CODE} {...props} />);
  return props;
};

describe('閲覧モード: 有効期限切れ（Issue #108）', () => {
  let docs: Map<string, Record<string, unknown>>;

  beforeEach(() => {
    jest.useFakeTimers({ now: NOW });
    initDatabase();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const memory = createMemoryBackend();
    docs = memory.docs;
    (getLiveSessionService as jest.Mock).mockReturnValue(createLiveSessionService(memory.backend));
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('期限切れのセッションに参加すると内容を表示せず、エラーを出して戻る（保存もできない）', async () => {
    seedSession(docs, NOW - SESSION_TTL_MS - 1);
    const props = renderViewer();
    await flushJoin();

    expect(lastAlert().title).toBe('有効期限切れ');
    expect(lastAlert().message).toContain(`セッション「${CODE}」の有効期限が切れました`);
    // 内容（プレイヤー名・スコア）も保存ボタンも表示しない
    PLAYERS.forEach(name => expect(screen.queryByText(name)).toBeNull());
    expect(screen.queryByText('対局を履歴に保存')).toBeNull();
    expect(screen.getByText('有効期限切れ')).toBeOnTheScreen();

    pressAlertButton('OK');
    expect(props.onFinish).toHaveBeenCalledTimes(1);
    expect(getFinishedGames()).toHaveLength(0);
    expect(getJoinedSessions()).toHaveLength(0);
  });

  it('ホストが終了したセッションでも、発行から48時間を過ぎていれば期限切れ', async () => {
    seedSession(docs, NOW - SESSION_TTL_MS, true);
    const props = renderViewer();
    await flushJoin();

    expect(lastAlert().title).toBe('有効期限切れ');
    expect(screen.queryByText('対局を履歴に保存')).toBeNull();
    pressAlertButton('OK');
    expect(props.onFinish).toHaveBeenCalledTimes(1);
  });

  it('ホストが終了したセッションは、有効期限内なら閲覧して履歴に保存できる', async () => {
    seedSession(docs, NOW - SESSION_TTL_MS + 60_000, true);
    renderViewer();
    await flushJoin();

    expect(alertMock()).not.toHaveBeenCalled();
    expect(screen.getByText('閲覧中（共有終了）')).toBeOnTheScreen();
    expect(screen.getAllByText('太郎').length).toBeGreaterThan(0);

    fireEvent.press(screen.getByText('対局を履歴に保存'));
    expect(lastAlert().title).toBe('完了');
    expect(getFinishedGames()).toHaveLength(1);
    expect(screen.getByText('保存済み')).toBeOnTheScreen();
  });

  it('閲覧中に有効期限を迎えたら、表示を消して期限切れを知らせ、閲覧を終了する', async () => {
    // 期限の1分前
    seedSession(docs, NOW - SESSION_TTL_MS + 60_000);
    const props = renderViewer();
    await flushJoin();

    expect(screen.getByText('閲覧中')).toBeOnTheScreen();
    expect(screen.getAllByText('太郎').length).toBeGreaterThan(0);
    expect(alertMock()).not.toHaveBeenCalled();
    expect(getJoinedSessions().map(s => s.code)).toEqual([CODE]);

    act(() => {
      jest.advanceTimersByTime(60_000);
    });

    expect(lastAlert().title).toBe('有効期限切れ');
    expect(lastAlert().message).toContain('閲覧を終了します');
    // 最後に受信した内容を表示し続けない。保存もできない
    PLAYERS.forEach(name => expect(screen.queryByText(name)).toBeNull());
    expect(screen.queryByText('対局を履歴に保存')).toBeNull();
    expect(getJoinedSessions()).toHaveLength(0);

    pressAlertButton('OK');
    expect(props.onFinish).toHaveBeenCalledTimes(1);
    expect(getFinishedGames()).toHaveLength(0);
  });

  it('共有終了の表示中に有効期限を迎えた場合も閲覧を終了し、保存できなくなる', async () => {
    seedSession(docs, NOW - SESSION_TTL_MS + 60_000, true);
    renderViewer();
    await flushJoin();
    expect(screen.getByText('対局を履歴に保存')).toBeOnTheScreen();

    act(() => {
      jest.advanceTimersByTime(60_000);
    });

    expect(lastAlert().title).toBe('有効期限切れ');
    expect(screen.queryByText('対局を履歴に保存')).toBeNull();
    expect(getFinishedGames()).toHaveLength(0);
  });

  it('期限の通知より先に保存ボタンを押しても、期限を過ぎていれば保存しない', async () => {
    seedSession(docs, NOW - SESSION_TTL_MS + 60_000, true);
    renderViewer();
    await flushJoin();

    // タイマーを進めずに時計だけ期限を過ぎた状態（バックグラウンドからの復帰直後など）
    jest.setSystemTime(NOW + 60_000);
    fireEvent.press(screen.getByText('対局を履歴に保存'));

    expect(lastAlert().title).toBe('有効期限切れ');
    expect(getFinishedGames()).toHaveLength(0);
  });

  it('閲覧中に保存済みの対局は、期限切れ後も保存済みの対局を開ける', async () => {
    seedSession(docs, NOW - SESSION_TTL_MS + 60_000);
    const props = renderViewer();
    await flushJoin();
    // 別の画面などで保存済み
    const savedId = importShareData(game, null, CODE);

    act(() => {
      jest.advanceTimersByTime(60_000);
    });

    expect(lastAlert().title).toBe('有効期限切れ');
    pressAlertButton('保存済みの対局を開く');
    expect(props.onSavedLiveGame).toHaveBeenCalledWith(savedId);
  });

  it('期限切れでも取り込み済みの対局があれば、エラーにせず保存済みの対局を開く（Issue #72 を維持）', async () => {
    seedSession(docs, NOW - SESSION_TTL_MS - 1);
    const savedId = importShareData(game, null, CODE);
    const props = renderViewer();
    await flushJoin();

    expect(lastAlert().title).toBe('取り込み済み');
    pressAlertButton('OK');
    expect(props.onSavedLiveGame).toHaveBeenCalledWith(savedId);
    expect(props.onFinish).not.toHaveBeenCalled();
  });

  it('セッションが存在しなくても取り込み済みの対局があれば保存済みの対局を開く（Issue #72 を維持）', async () => {
    const savedId = importShareData(game, null, CODE);
    const props = renderViewer();
    await flushJoin();

    expect(lastAlert().title).toBe('取り込み済み');
    pressAlertButton('OK');
    expect(props.onSavedLiveGame).toHaveBeenCalledWith(savedId);
  });

  it('「ゲームを取り込む」に期限切れのコードを入力すると、エラーを出してセットアップ画面に戻る', async () => {
    seedSession(docs, NOW - SESSION_TTL_MS - 1);
    render(<Index />);

    fireEvent.press(screen.getByText('ゲームを取り込む'));
    fireEvent.changeText(screen.getByLabelText('6桁のセッションコード'), CODE);
    fireEvent.press(screen.getByText('取り込む'));
    await flushJoin();

    expect(lastAlert().title).toBe('有効期限切れ');
    PLAYERS.forEach(name => expect(screen.queryByText(name)).toBeNull());
    pressAlertButton('OK');

    // セットアップ画面に戻る
    expect(screen.getAllByPlaceholderText('名前を入力')).toHaveLength(4);
    expect(getFinishedGames()).toHaveLength(0);
  });
});
