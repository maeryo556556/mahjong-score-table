/**
 * リアルタイム共有セッション（liveSession.ts）のテスト
 * Firestore 通信部分は SessionBackend のモックで置き換える。
 */
import {
  SESSION_CODE_ALPHABET,
  SESSION_CODE_LENGTH,
  SESSION_TTL_MS,
  generateSessionCode,
  normalizeSessionCode,
  isValidSessionCode,
  buildSessionUrl,
  parseSessionUrl,
  extractSessionCode,
  sanitizeSessionCodeInput,
  isLocalSessionActive,
  buildSessionDoc,
  buildSessionUpdate,
  parseSessionDoc,
  isSessionExpired,
  createLiveSessionService,
  buildJoinedSession,
  selectRejoinableSessions,
} from '../liveSession';
import type { SessionBackend, SessionDoc, JoinEvent, JoinedSession, LiveSessionSnapshot } from '../liveSession';
import { shareDataToRecords } from '../utils';
import type { ShareGameDataV1, ShareGameDataV2 } from '../utils';

const NOW = 1_750_000_000_000;

const game: ShareGameDataV2 = {
  v: 2,
  pc: 4,
  d: '2026/11/24',
  p: ['太郎', '花子', '次郎', '美咲'],
  s: [
    [1, 0, 30, NOW, '11月24日10:00'],
    [1, 1, 10, NOW, '11月24日10:00'],
    [1, 2, -10, NOW, '11月24日10:00'],
    [1, 3, -30, NOW, '11月24日10:00'],
  ],
};

// ---------- モックバックエンド ----------
const createMockBackend = (uid = 'host-uid') => {
  const docs = new Map<string, Record<string, unknown>>();
  const listeners = new Map<string, Array<(doc: Record<string, unknown> | null) => void>>();
  const notify = (code: string) => {
    (listeners.get(code) || []).forEach(l => l(docs.has(code) ? { ...docs.get(code)! } : null));
  };
  const backend = {
    getUid: jest.fn(async () => uid),
    exists: jest.fn(async (code: string) => docs.has(code)),
    create: jest.fn(async (code: string, doc: SessionDoc) => {
      docs.set(code, { ...doc });
      notify(code);
    }),
    update: jest.fn(async (code: string, patch: Partial<SessionDoc>) => {
      if (!docs.has(code)) throw new Error('not-found');
      docs.set(code, { ...docs.get(code)!, ...patch });
      notify(code);
    }),
    subscribe: jest.fn((code: string, onNext: (doc: Record<string, unknown> | null) => void) => {
      const list = listeners.get(code) || [];
      list.push(onNext);
      listeners.set(code, list);
      onNext(docs.has(code) ? { ...docs.get(code)! } : null);
      return () => {
        listeners.set(code, (listeners.get(code) || []).filter(l => l !== onNext));
      };
    }),
  };
  return { backend: backend as jest.Mocked<SessionBackend> & typeof backend, docs, listeners };
};

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

// 固定の乱数列を返す
const sequence = (values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

describe('generateSessionCode', () => {
  it('規定の長さ・文字種のコードを生成する', () => {
    for (let i = 0; i < 100; i++) {
      const code = generateSessionCode();
      expect(code).toHaveLength(SESSION_CODE_LENGTH);
      expect(isValidSessionCode(code)).toBe(true);
    }
  });

  it('文字種は数字のみ', () => {
    expect(SESSION_CODE_ALPHABET).toBe('0123456789');
    for (let i = 0; i < 100; i++) {
      expect(generateSessionCode()).toMatch(/^[0-9]{6}$/);
    }
  });

  it('乱数から決定的に生成される', () => {
    expect(generateSessionCode(() => 0)).toBe('000000');
    expect(generateSessionCode(() => 0.999999)).toBe('999999');
  });
});

describe('normalizeSessionCode / isValidSessionCode', () => {
  it('空白・ハイフンを除去する', () => {
    expect(normalizeSessionCode(' 123-45 6 ')).toBe('123456');
  });

  it('長さや文字種が違うコードは無効', () => {
    expect(isValidSessionCode('12345')).toBe(false);
    expect(isValidSessionCode('1234567')).toBe(false);
    expect(isValidSessionCode('12345A')).toBe(false);
    expect(isValidSessionCode('ABC234')).toBe(false);
    expect(isValidSessionCode('abcdef')).toBe(false);
    expect(isValidSessionCode('12 345')).toBe(false);
    expect(isValidSessionCode('123456')).toBe(true);
    expect(isValidSessionCode('000000')).toBe(true);
  });
});

describe('buildSessionUrl / parseSessionUrl', () => {
  it('ラウンドトリップできる', () => {
    const url = buildSessionUrl('123456');
    expect(url).toBe('mahjong-score://live?code=123456');
    expect(parseSessionUrl(url)).toBe('123456');
  });

  it('旧静的共有リンクや不正なコードは null', () => {
    expect(parseSessionUrl('mahjong-score://import?code=abc')).toBeNull();
    expect(parseSessionUrl('mahjong-score://import?code=123456')).toBeNull();
    expect(parseSessionUrl('mahjong-score://live?code=ABC234')).toBeNull();
    expect(parseSessionUrl('mahjong-score://live?code=XX')).toBeNull();
    expect(parseSessionUrl('mahjong-score://live')).toBeNull();
    expect(parseSessionUrl('https://example.com')).toBeNull();
  });
});

describe('extractSessionCode', () => {
  it('セッションコード・セッションリンクを判別する', () => {
    expect(extractSessionCode('123456')).toBe('123456');
    expect(extractSessionCode('  123-456\n')).toBe('123456');
    expect(extractSessionCode('mahjong-score://live?code=123456')).toBe('123456');
  });

  it('旧静的共有コード・リンクやその他の文字列は null', () => {
    const legacyCode = Buffer.from(JSON.stringify(game), 'utf8').toString('base64');
    expect(extractSessionCode(legacyCode)).toBeNull();
    expect(extractSessionCode(`mahjong-score://import?code=${encodeURIComponent(legacyCode)}`)).toBeNull();
    expect(extractSessionCode('hello')).toBeNull();
    expect(extractSessionCode('ABC234')).toBeNull();
  });
});

describe('sanitizeSessionCodeInput', () => {
  it('数字以外を取り除き、先頭6桁までにする', () => {
    expect(sanitizeSessionCodeInput('12a3-4 5')).toBe('12345');
    expect(sanitizeSessionCodeInput('12345678')).toBe('123456');
    expect(sanitizeSessionCodeInput('')).toBe('');
    expect(sanitizeSessionCodeInput('abc')).toBe('');
  });

  it('セッションリンクが貼り付けられた場合はそのコードを返す', () => {
    expect(sanitizeSessionCodeInput(' mahjong-score://live?code=654321 ')).toBe('654321');
  });
});

describe('isLocalSessionActive', () => {
  it('コードがあり有効期限内なら true', () => {
    expect(isLocalSessionActive('123456', NOW + 1, NOW)).toBe(true);
  });

  it('期限切れ・コードなし・期限なしは false', () => {
    expect(isLocalSessionActive('123456', NOW, NOW)).toBe(false);
    expect(isLocalSessionActive(null, NOW + 1, NOW)).toBe(false);
    expect(isLocalSessionActive('123456', null, NOW)).toBe(false);
    expect(isLocalSessionActive(undefined, undefined, NOW)).toBe(false);
  });
});

describe('buildSessionDoc / buildSessionUpdate', () => {
  it('共有データJSON・ホスト・作成日時・48時間後の有効期限を持つ', () => {
    const doc = buildSessionDoc(game, 'uid-1', NOW);
    expect(doc).toEqual({
      data: JSON.stringify(game),
      hostUid: 'uid-1',
      createdAt: NOW,
      updatedAt: NOW,
      expiresAt: NOW + SESSION_TTL_MS,
      ended: false,
    });
    expect(SESSION_TTL_MS).toBe(48 * 60 * 60 * 1000);
    expect(JSON.parse(doc.data)).toEqual(game);
  });

  it('ended を指定すると終了済みセッションのドキュメントになる（有効期限は同じく48時間）', () => {
    const doc = buildSessionDoc(game, 'uid-1', NOW, true);
    expect(doc.ended).toBe(true);
    expect(doc.expiresAt).toBe(NOW + SESSION_TTL_MS);
    expect(doc.createdAt).toBe(NOW);
    expect(doc.updatedAt).toBe(NOW);
  });

  it('更新はデータと更新日時のみ', () => {
    expect(buildSessionUpdate(game, NOW + 5)).toEqual({ data: JSON.stringify(game), updatedAt: NOW + 5 });
  });
});

describe('parseSessionDoc / isSessionExpired', () => {
  const doc = buildSessionDoc(game, 'uid-1', NOW);

  it('有効期限内は live', () => {
    const snap = parseSessionDoc(doc, NOW + 1000);
    expect(snap?.status).toBe('live');
    expect(snap?.game).toEqual(game);
    expect(snap?.expiresAt).toBe(NOW + SESSION_TTL_MS);
  });

  it('有効期限を過ぎると expired', () => {
    expect(isSessionExpired(doc, NOW + SESSION_TTL_MS)).toBe(true);
    expect(isSessionExpired(doc, NOW + SESSION_TTL_MS - 1)).toBe(false);
    expect(parseSessionDoc(doc, NOW + SESSION_TTL_MS)?.status).toBe('expired');
  });

  it('ended フラグがあれば ended', () => {
    expect(parseSessionDoc({ ...doc, ended: true }, NOW)?.status).toBe('ended');
  });

  it('ended でも有効期限を過ぎていれば expired', () => {
    expect(parseSessionDoc({ ...doc, ended: true }, NOW + SESSION_TTL_MS - 1)?.status).toBe('ended');
    expect(parseSessionDoc({ ...doc, ended: true }, NOW + SESSION_TTL_MS)?.status).toBe('expired');
  });

  it('不正なドキュメントは null', () => {
    expect(parseSessionDoc(null, NOW)).toBeNull();
    expect(parseSessionDoc({ ...doc, data: 'not json' }, NOW)).toBeNull();
    expect(parseSessionDoc({ ...doc, data: JSON.stringify({ v: 9 }) }, NOW)).toBeNull();
    expect(parseSessionDoc({ ...doc, expiresAt: 'x' }, NOW)).toBeNull();
  });
});

describe('shareDataToRecords', () => {
  it('v2: プレイヤー名を復元し順位を再計算する', () => {
    const records = shareDataToRecords(game, NOW);
    expect(records.players).toEqual(game.p);
    expect(records.playerCount).toBe(4);
    expect(records.startDate).toBe('2026/11/24');
    expect(records.scores.map(s => [s.player_name, s.point, s.rank])).toEqual([
      ['太郎', 30, 1],
      ['花子', 10, 2],
      ['次郎', -10, 3],
      ['美咲', -30, 4],
    ]);
    expect(records.chips).toEqual([]);
  });

  it('記録は新しい順に並ぶ', () => {
    const data: ShareGameDataV2 = {
      ...game,
      s: [
        [1, 0, 10, NOW, 'a'], [1, 1, -10, NOW, 'a'],
        [2, 0, -20, NOW + 100, 'b'], [2, 1, 20, NOW + 100, 'b'],
      ],
      p: ['A', 'B'],
      pc: 3,
      c: [[1, 0, 2, NOW + 50, 'c'], [1, 1, -2, NOW + 50, 'c']],
    };
    const records = shareDataToRecords(data, NOW);
    expect(records.scores.map(s => s.hanchan)).toEqual([2, 2, 1, 1]);
    expect(records.scores.find(s => s.hanchan === 2 && s.player_name === 'B')?.rank).toBe(1);
    expect(records.chips.map(c => [c.player_name, c.chip_point, c.timestamp])).toEqual([
      ['A', 2, NOW + 50],
      ['B', -2, NOW + 50],
    ]);
    expect(new Set(records.chips.map(c => c.id)).size).toBe(2);
  });

  it('タイムスタンプなしの旧データはフォールバック値を使う', () => {
    const data: ShareGameDataV2 = {
      v: 2, pc: 3, d: '2025/06/01', p: ['A', 'B', 'C'],
      s: [[1, 0, 10], [1, 1, 0], [1, 2, -10]],
      c: [[1, 0, 1], [1, 1, -1], [2, 0, 1], [2, 2, -1]],
    };
    const records = shareDataToRecords(data, NOW);
    expect(records.scores.every(s => s.timestamp === NOW && s.formatted_time === '6月1日')).toBe(true);
    // チップは半荘ごとに異なるタイムスタンプ（HistoryTable のグループ化用）
    expect(records.chips.filter(c => c.hanchan === 1).every(c => c.timestamp === NOW + 1)).toBe(true);
    expect(records.chips.filter(c => c.hanchan === 2).every(c => c.timestamp === NOW + 2)).toBe(true);
  });

  it('v1: 記録をそのまま使う', () => {
    const data: ShareGameDataV1 = {
      v: 1, pc: 3, d: '2025/06/01', p: ['A', 'B', 'C'],
      s: [[1, 'A', 10, 1, NOW, 't'], [1, 'B', -10, 3, NOW, 't'], [1, 'C', 0, 2, NOW, 't']],
      c: [[1, 'A', 1, NOW, 't'], [1, 'B', -1, NOW, 't']],
    };
    const records = shareDataToRecords(data, NOW);
    expect(records.scores.map(s => s.rank)).toEqual([1, 3, 2]);
    expect(records.chips).toHaveLength(2);
  });
});

describe('createLiveSessionService', () => {
  it('start: 匿名ユーザーをホストとしてセッションを作成する', async () => {
    const { backend, docs } = createMockBackend('host-1');
    const service = createLiveSessionService(backend, { now: () => NOW, random: () => 0 });

    const result = await service.start(game);

    expect(result).toEqual({ code: '000000', expiresAt: NOW + SESSION_TTL_MS });
    expect(backend.create).toHaveBeenCalledWith('000000', buildSessionDoc(game, 'host-1', NOW));
    expect(docs.get('000000')?.hostUid).toBe('host-1');
  });

  it('start: コードが既存なら別のコードで再試行する', async () => {
    const { backend, docs } = createMockBackend();
    docs.set('000000', { data: '{}' });
    const service = createLiveSessionService(backend, {
      now: () => NOW,
      // 1回目: 000000（衝突）、2回目: 111111
      random: sequence([0, 0, 0, 0, 0, 0, 1 / 10, 1 / 10, 1 / 10, 1 / 10, 1 / 10, 1 / 10]),
    });

    const result = await service.start(game);

    expect(result.code).toBe('111111');
    expect(backend.exists).toHaveBeenCalledTimes(2);
    expect(backend.create).toHaveBeenCalledTimes(1);
  });

  it('start: 試行回数を超えて衝突したらエラー', async () => {
    const { backend, docs } = createMockBackend();
    docs.set('000000', { data: '{}' });
    const service = createLiveSessionService(backend, { random: () => 0, maxAttempts: 3 });

    await expect(service.start(game)).rejects.toThrow('セッションコードの発行に失敗しました');
    expect(backend.exists).toHaveBeenCalledTimes(3);
    expect(backend.create).not.toHaveBeenCalled();
  });

  it('publishFinished: 最初から終了状態のセッションを48時間有効で作成する', async () => {
    const { backend, docs } = createMockBackend('host-1');
    const service = createLiveSessionService(backend, { now: () => NOW, random: () => 0 });

    const result = await service.publishFinished(game);

    expect(result).toEqual({ code: '000000', expiresAt: NOW + SESSION_TTL_MS });
    expect(backend.create).toHaveBeenCalledWith('000000', buildSessionDoc(game, 'host-1', NOW, true));
    const doc = docs.get('000000')!;
    expect(doc.ended).toBe(true);
    expect(doc.hostUid).toBe('host-1');
    expect(doc.expiresAt).toBe(NOW + SESSION_TTL_MS);
    expect(JSON.parse(doc.data as string)).toEqual(game);
    expect(backend.update).not.toHaveBeenCalled();
  });

  it('publishFinished: 呼ぶたびに新しいコードを発行する', async () => {
    const { backend, docs } = createMockBackend();
    let now = NOW;
    const service = createLiveSessionService(backend, {
      now: () => now,
      // 1回目: 000000、2回目: 000000（衝突）→ 111111
      random: sequence([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1 / 10, 1 / 10, 1 / 10, 1 / 10, 1 / 10, 1 / 10]),
    });

    const first = await service.publishFinished(game);
    now = NOW + 60_000;
    const second = await service.publishFinished(game);

    expect(first.code).toBe('000000');
    expect(second.code).toBe('111111');
    expect(second.expiresAt).toBe(NOW + 60_000 + SESSION_TTL_MS);
    expect(docs.size).toBe(2);
    expect(docs.get('111111')?.ended).toBe(true);
  });

  it('publishFinished: 試行回数を超えて衝突したらエラー', async () => {
    const { backend, docs } = createMockBackend();
    docs.set('000000', { data: '{}' });
    const service = createLiveSessionService(backend, { random: () => 0, maxAttempts: 2 });

    await expect(service.publishFinished(game)).rejects.toThrow('セッションコードの発行に失敗しました');
    expect(backend.create).not.toHaveBeenCalled();
  });

  it('publishFinished: 参加者には終了状態で表示され、発行から48時間後は期限切れになる', async () => {
    const { backend } = createMockBackend();
    let now = NOW;
    const service = createLiveSessionService(backend, { now: () => now, random: () => 0 });
    const { code } = await service.publishFinished(game);

    const events: JoinEvent[] = [];
    service.join(code, e => events.push(e));
    await flush();

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: 'snapshot', snapshot: { status: 'ended', game } });

    // 48時間経過後に参加した場合
    now = NOW + SESSION_TTL_MS;
    const lateEvents: JoinEvent[] = [];
    service.join(code, e => lateEvents.push(e));
    await flush();
    expect(lateEvents[0]).toMatchObject({ type: 'snapshot', snapshot: { status: 'expired', game } });
  });

  it('push / end: ドキュメントを更新する', async () => {
    const { backend, docs } = createMockBackend();
    let now = NOW;
    const service = createLiveSessionService(backend, { now: () => now, random: () => 0 });
    const { code } = await service.start(game);

    const updated: ShareGameDataV2 = { ...game, s: [...game.s, [2, 0, -5, NOW + 10, 't'], [2, 1, 5, NOW + 10, 't']] };
    now = NOW + 10;
    await service.push(code, updated);
    expect(backend.update).toHaveBeenLastCalledWith(code, { data: JSON.stringify(updated), updatedAt: NOW + 10 });
    expect(JSON.parse(docs.get(code)!.data as string)).toEqual(updated);

    now = NOW + 20;
    await service.end(code);
    expect(backend.update).toHaveBeenLastCalledWith(code, { ended: true, updatedAt: NOW + 20 });
    expect(docs.get(code)!.ended).toBe(true);
    // 作成時の情報は維持される
    expect(docs.get(code)!.hostUid).toBe('host-uid');
    expect(docs.get(code)!.expiresAt).toBe(NOW + SESSION_TTL_MS);
  });

  it('push: バックエンドのエラーを呼び出し元に伝える', async () => {
    const { backend } = createMockBackend();
    const service = createLiveSessionService(backend);
    await expect(service.push('ZZZZZZ', game)).rejects.toThrow('not-found');
  });

  it('join: ホストの変更が参加者に即時通知される', async () => {
    const { backend } = createMockBackend();
    const service = createLiveSessionService(backend, { now: () => NOW, random: () => 0 });
    const { code } = await service.start(game);

    const events: JoinEvent[] = [];
    const unsubscribe = service.join(code, e => events.push(e));
    await flush();

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: 'snapshot', snapshot: { status: 'live', game } });

    const updated: ShareGameDataV2 = { ...game, d: '2026/11/25' };
    await service.push(code, updated);
    expect(events).toHaveLength(2);
    expect(events[1]).toMatchObject({ type: 'snapshot', snapshot: { status: 'live', game: updated } });

    await service.end(code);
    expect(events[2]).toMatchObject({ type: 'snapshot', snapshot: { status: 'ended' } });

    // 購読解除後は通知されない
    unsubscribe();
    await service.push(code, game);
    expect(events).toHaveLength(3);
  });

  it('join: 存在しないコードは notFound', async () => {
    const { backend } = createMockBackend();
    const service = createLiveSessionService(backend);
    const events: JoinEvent[] = [];
    service.join('ZZZZZZ', e => events.push(e));
    await flush();
    expect(events).toEqual([{ type: 'notFound' }]);
  });

  it('join: 不正なデータはエラーとして通知する', async () => {
    const { backend, docs } = createMockBackend();
    docs.set('ZZZZZZ', { data: 'broken', expiresAt: NOW + 1 });
    const service = createLiveSessionService(backend, { now: () => NOW });
    const events: JoinEvent[] = [];
    service.join('ZZZZZZ', e => events.push(e));
    await flush();
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('error');
  });

  it('join: 認証失敗はエラーとして通知し、購読しない', async () => {
    const { backend } = createMockBackend();
    backend.getUid.mockRejectedValueOnce(new Error('auth failed'));
    const service = createLiveSessionService(backend);
    const events: JoinEvent[] = [];
    service.join('123456', e => events.push(e));
    await flush();
    expect(events).toEqual([{ type: 'error', error: new Error('auth failed') }]);
    expect(backend.subscribe).not.toHaveBeenCalled();
  });

  it('join: 認証完了前に解除した場合は購読しない', async () => {
    const { backend } = createMockBackend();
    const service = createLiveSessionService(backend);
    const unsubscribe = service.join('123456', () => {});
    unsubscribe();
    await flush();
    expect(backend.subscribe).not.toHaveBeenCalled();
  });
});

// ---------- 参加したセッションの記録（Issue #58） ----------

describe('buildJoinedSession', () => {
  it('スナップショットから一覧表示用の参加記録を作る', () => {
    const snapshot: LiveSessionSnapshot = {
      status: 'live',
      game: {
        ...game,
        s: [
          ...game.s,
          [2, 0, -5, NOW + 1, '11月24日10:30'],
          [2, 1, 5, NOW + 1, '11月24日10:30'],
          [2, 2, 0, NOW + 1, '11月24日10:30'],
          [2, 3, 0, NOW + 1, '11月24日10:30'],
        ],
      },
      updatedAt: NOW,
      expiresAt: NOW + SESSION_TTL_MS,
    };
    expect(buildJoinedSession('123456', snapshot, NOW + 10)).toEqual({
      code: '123456',
      expiresAt: NOW + SESSION_TTL_MS,
      status: 'live',
      startDate: '2026/11/24',
      playerCount: 4,
      playerNames: ['太郎', '花子', '次郎', '美咲'],
      hanchanCount: 2,
      lastSeenAt: NOW + 10,
    });
  });

  it('記録がない対局は0半荘', () => {
    const snapshot: LiveSessionSnapshot = {
      status: 'ended',
      game: { ...game, s: [] },
      updatedAt: NOW,
      expiresAt: NOW + 1000,
    };
    const joined = buildJoinedSession('654321', snapshot, NOW);
    expect(joined.hanchanCount).toBe(0);
    expect(joined.status).toBe('ended');
  });

  it('プレイヤー名の配列は複製する（スナップショットの変更に影響されない）', () => {
    const snapshot: LiveSessionSnapshot = { status: 'live', game: { ...game, p: [...game.p] }, updatedAt: NOW, expiresAt: NOW + 1000 };
    const joined = buildJoinedSession('111111', snapshot, NOW);
    snapshot.game.p[0] = '変更';
    expect(joined.playerNames[0]).toBe('太郎');
  });
});

describe('selectRejoinableSessions', () => {
  const make = (code: string, expiresAt: number, lastSeenAt: number): JoinedSession => ({
    code,
    expiresAt,
    status: 'live',
    startDate: '2026/11/24',
    playerCount: 4,
    playerNames: ['A', 'B', 'C', 'D'],
    hanchanCount: 1,
    lastSeenAt,
  });

  it('有効期限内のものを新しい順に返す', () => {
    const sessions = [make('111111', NOW + 1000, NOW - 300), make('222222', NOW + 1000, NOW - 100)];
    expect(selectRejoinableSessions(sessions, new Set(), NOW).map(s => s.code)).toEqual(['222222', '111111']);
  });

  it('期限切れ（ちょうど期限の時刻を含む）は除く', () => {
    const sessions = [make('111111', NOW, NOW - 300), make('222222', NOW - 1, NOW - 100), make('333333', NOW + 1, NOW)];
    expect(selectRejoinableSessions(sessions, new Set(), NOW).map(s => s.code)).toEqual(['333333']);
  });

  it('履歴に保存済みのセッションは除く', () => {
    const sessions = [make('111111', NOW + 1000, NOW), make('222222', NOW + 1000, NOW)];
    expect(selectRejoinableSessions(sessions, new Set(['111111']), NOW).map(s => s.code)).toEqual(['222222']);
  });

  it('元の配列は変更しない', () => {
    const sessions = [make('111111', NOW + 1000, NOW - 300), make('222222', NOW + 1000, NOW - 100)];
    selectRejoinableSessions(sessions, new Set(), NOW);
    expect(sessions.map(s => s.code)).toEqual(['111111', '222222']);
  });
});
