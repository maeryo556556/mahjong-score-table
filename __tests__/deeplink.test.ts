/**
 * ディープリンク・取り込み入力のロジックテスト
 *
 * app/_layout.tsx の handleDeepLink と SetupScreen の handleImport のロジックを
 * 純粋関数として再現してテストする。
 *
 * 静的共有（deflate + Base64 の共有コード、mahjong-score://import?code=…）は
 * Issue #46 で廃止したため、セッション参加（mahjong-score://live?code=… / 6文字コード）のみ受け付ける。
 */
import { deflateSync } from 'zlib';
import { buildSessionUrl, extractSessionCode, parseSessionUrl } from '../liveSession';

// --- 旧静的共有コード（廃止済み形式）を再現するヘルパー ---
const makeLegacyStaticCode = () => {
  const data = {
    v: 2,
    pc: 4,
    d: '2025/06/01',
    p: ['太郎', '花子', '次郎', '美咲'],
    s: [[1, 0, 30], [1, 1, -10], [1, 2, -10], [1, 3, -10]],
  };
  return deflateSync(Buffer.from(JSON.stringify(data), 'utf8')).toString('base64');
};
const makeLegacyStaticUrl = (code: string) => `mahjong-score://import?code=${encodeURIComponent(code)}`;

// --- app/_layout.tsx の handleDeepLink のロジックを再現 ---
type DeepLinkDeps = {
  joinLiveSession: (code: string) => void;
};

function handleDeepLink(url: string, deps: DeepLinkDeps) {
  const sessionCode = parseSessionUrl(url);
  if (sessionCode) {
    deps.joinLiveSession(sessionCode);
  }
}

// --- SetupScreen の handleImport のロジックを再現 ---
type ImportResult =
  | { type: 'inputError' }
  | { type: 'join'; code: string }
  | { type: 'error' };

function handleImportInput(input: string): ImportResult {
  const rawInput = input.trim();
  if (!rawInput) return { type: 'inputError' };
  const sessionCode = extractSessionCode(rawInput);
  if (!sessionCode) return { type: 'error' };
  return { type: 'join', code: sessionCode };
}

// --- テスト ---

describe('ディープリンク', () => {
  it('セッションリンクはセッション参加に回る', () => {
    const deps = { joinLiveSession: jest.fn() };
    handleDeepLink(buildSessionUrl('ABC234'), deps);
    expect(deps.joinLiveSession).toHaveBeenCalledWith('ABC234');
  });

  it('小文字コードのセッションリンクも正規化して参加する', () => {
    const deps = { joinLiveSession: jest.fn() };
    handleDeepLink('mahjong-score://live?code=abc234', deps);
    expect(deps.joinLiveSession).toHaveBeenCalledWith('ABC234');
  });

  it('廃止した静的取り込みリンク（import?code=…）は何もしない', () => {
    const deps = { joinLiveSession: jest.fn() };
    handleDeepLink(makeLegacyStaticUrl(makeLegacyStaticCode()), deps);
    handleDeepLink('mahjong-score://import?code=ABC234', deps);
    expect(deps.joinLiveSession).not.toHaveBeenCalled();
  });

  it('無関係なURL・不正なコードは何もしない', () => {
    const deps = { joinLiveSession: jest.fn() };
    handleDeepLink('https://example.com', deps);
    handleDeepLink('mahjong-score://other?code=ABC234', deps);
    handleDeepLink('mahjong-score://live?code=XX', deps);
    handleDeepLink('mahjong-score://live', deps);
    handleDeepLink('', deps);
    expect(deps.joinLiveSession).not.toHaveBeenCalled();
  });
});

describe('取り込み画面の入力', () => {
  it('空入力は入力エラー', () => {
    expect(handleImportInput('')).toEqual({ type: 'inputError' });
    expect(handleImportInput('  \n ')).toEqual({ type: 'inputError' });
  });

  it('セッションコード・セッションリンクは参加', () => {
    expect(handleImportInput('abc-234')).toEqual({ type: 'join', code: 'ABC234' });
    expect(handleImportInput(buildSessionUrl('ABC234'))).toEqual({ type: 'join', code: 'ABC234' });
  });

  it('静的共有コード・静的共有リンクはエラー', () => {
    const legacy = makeLegacyStaticCode();
    expect(handleImportInput(legacy)).toEqual({ type: 'error' });
    expect(handleImportInput(makeLegacyStaticUrl(legacy))).toEqual({ type: 'error' });
  });

  it('その他の文字列はエラー', () => {
    expect(handleImportInput('hello world')).toEqual({ type: 'error' });
    expect(handleImportInput('ABC23')).toEqual({ type: 'error' });
  });
});
