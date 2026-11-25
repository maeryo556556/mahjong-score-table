import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  getFinishedGames,
  getUnfinishedGames,
  deleteGames,
  getJoinedSessions,
  deleteJoinedSession,
  purgeExpiredJoinedSessions,
  getSavedLiveSessionCodes,
  setGameFavorite,
} from '../database';
import {
  MAX_SAVED_GAMES,
  MAX_FAVORITE_GAMES,
  toggleSelection,
  isGameSelectable,
  selectableGameIds,
  isAllSelected,
  toggleSelectAll,
  pruneSelection,
  buildBulkDeleteMessage,
  formatSignedScore,
} from '../utils';
import type { PlayerFinalScore } from '../utils';
import { StarIcon, TileFanIcon, TileIcon } from '../components/icons/HandDrawnIcons';
import { isLocalSessionActive, selectRejoinableSessions } from '../liveSession';
import type { JoinedSession } from '../liveSession';

interface PastGamesScreenProps {
  onSelectGame: (gameId: number) => void;
  onBack: () => void;
  /** ホストとしてライブ共有中の（未終了の）ゲームを開く */
  onResumeLiveGame: (gameId: number) => void;
  /** 取り込んだゲームの受信元セッション、またはゲストとして参加したセッションがまだ有効な場合、ライブ閲覧に入る */
  onJoinLiveSession: (code: string) => void;
}

type ListGame = ReturnType<typeof getUnfinishedGames>[number] & {
  imported?: number;
  favorite?: number;
  /** 終了済みゲームのみ: プレイヤーごとの最終スコア（Issue #78） */
  finalScores?: PlayerFinalScore[];
};

const isActive = (game: ListGame, now: number) =>
  isLocalSessionActive(game.live_session_code, game.live_session_expires_at, now);

// ライブ共有中のゲーム（ホストとして共有中の進行中ゲーム）と、ゲストとして参加した閲覧中の対局を先頭に、
// 続けて終了済みゲームを並べる
const loadGames = () => {
  const now = Date.now();
  const liveHostGames: ListGame[] = getUnfinishedGames().filter(g => isActive(g, now));
  const finishedGames: ListGame[] = getFinishedGames();
  let joinedSessions: JoinedSession[] = [];
  try {
    purgeExpiredJoinedSessions(now);
    joinedSessions = selectRejoinableSessions(getJoinedSessions(), getSavedLiveSessionCodes(), now);
  } catch {
    // 参加記録が読めなくても一覧は表示する
  }
  return { liveHostGames, finishedGames, joinedSessions };
};

export default function PastGamesScreen({ onSelectGame, onBack, onResumeLiveGame, onJoinLiveSession }: PastGamesScreenProps) {
  const [{ liveHostGames, finishedGames, joinedSessions }, setGames] = useState(loadGames);
  const games = [...liveHostGames, ...finishedGames];
  const liveHostIds = new Set(liveHostGames.map(g => g.id));

  const refreshGames = useCallback(() => {
    setGames(loadGames());
  }, []);

  // 複数選択モード（Issue #74）: 「選択」ボタンで開始し、チェックしたゲームをまとめて削除する。
  // ゲームカードの長押しでは開始しない（Issue #88: 誤操作防止のため長押しでの開始を廃止）。
  // ホストとして共有中（進行中）のゲーム・お気に入りのゲーム（Issue #78）・閲覧中の対局は選択できない。
  // お気に入りのゲームには選択モード中「お気に入りのため削除不可」のワッペンを重ねて表示する（Issue #88）
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const selectableIds = selectableGameIds(games, liveHostIds);
  const allSelected = isAllSelected(selectedIds, selectableIds);
  const selectableKey = selectableIds.join(',');

  // 一覧が更新されたら、無くなったゲームを選択から外す。選択できるゲームが無くなったらモードを終える
  useEffect(() => {
    const ids = selectableKey ? selectableKey.split(',').map(Number) : [];
    setSelectedIds(prev => {
      const next = pruneSelection(prev, ids);
      return next.length === prev.length ? prev : next;
    });
    if (ids.length === 0) setSelectionMode(false);
  }, [selectableKey]);

  const startSelection = () => {
    setSelectionMode(true);
    setSelectedIds([]);
  };

  const exitSelection = () => {
    setSelectionMode(false);
    setSelectedIds([]);
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    const ids = [...selectedIds];
    Alert.alert(
      'まとめて削除',
      buildBulkDeleteMessage(ids.length),
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: `${ids.length}件を削除`,
          style: 'destructive',
          onPress: () => {
            deleteGames(ids);
            exitSelection();
            refreshGames();
          },
        },
      ]
    );
  };

  const handlePressGame = (game: ListGame) => {
    if (selectionMode) {
      if (isGameSelectable(game, liveHostIds)) setSelectedIds(prev => toggleSelection(prev, game.id));
      return;
    }
    // ホストとして共有中のゲーム → ゲーム画面（共有中）へ
    if (liveHostIds.has(game.id)) {
      onResumeLiveGame(game.id);
      return;
    }
    // 受信元セッションが有効な取り込み済みゲーム → ライブ閲覧へ
    if (isActive(game, Date.now()) && game.live_session_code) {
      onJoinLiveSession(game.live_session_code);
      return;
    }
    onSelectGame(game.id);
  };

  // 閲覧した対局を一覧から外す（セッション自体には影響しない）
  const handleRemoveJoinedSession = (session: JoinedSession) => {
    Alert.alert(
      '一覧から削除',
      `${session.startDate} の閲覧中の対局を一覧から削除しますか？\n再度見るにはセッションコードの入力が必要です。`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除',
          style: 'destructive',
          onPress: () => {
            deleteJoinedSession(session.code);
            refreshGames();
          },
        },
      ]
    );
  };

  // お気に入りの登録・解除（Issue #60）
  // 上限（20件）に達している場合は登録せず、上限であることを伝える（自動解除はしない）
  const handleToggleFavorite = (game: ListGame) => {
    const result = setGameFavorite(game.id, game.favorite !== 1);
    if (result === 'limit') {
      Alert.alert(
        'お気に入り',
        `お気に入りは最大${MAX_FAVORITE_GAMES}件です。\n登録するには、ほかのお気に入りを解除してください。`
      );
      return;
    }
    refreshGames();
  };

  return (
    <LinearGradient colors={['#1e3c72', '#2a5298']} style={styles.gradient}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>← 戻る</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>過去のゲーム</Text>
          {selectionMode ? (
            <TouchableOpacity style={styles.selectButton} onPress={exitSelection} accessibilityRole="button">
              <Text style={styles.selectButtonText}>キャンセル</Text>
            </TouchableOpacity>
          ) : selectableIds.length > 0 ? (
            <TouchableOpacity
              style={styles.selectButton}
              onPress={() => startSelection()}
              accessibilityRole="button"
              accessibilityLabel="ゲームを選択して削除"
            >
              <Text style={styles.selectButtonText}>選択</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.headerSpacer} />
          )}
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* 説明文は簡潔な1行だけにする（Issue #88） */}
          <Text style={styles.limitNote}>
            {selectionMode
              ? '削除するゲームをタップして選んでください'
              : `保存は最大${MAX_SAVED_GAMES}件まで（お気に入りは最大${MAX_FAVORITE_GAMES}件）`}
          </Text>
          {/* ゲストとして参加した対局（コード入力なしで閲覧モードに再入室できる: Issue #58）。選択モード中は隠す */}
          {!selectionMode && joinedSessions.map(session => (
            <TouchableOpacity
              key={`joined-${session.code}`}
              style={[styles.gameCard, styles.gameCardLive, styles.joinedCard]}
              onPress={() => onJoinLiveSession(session.code)}
              onLongPress={() => handleRemoveJoinedSession(session)}
              delayLongPress={800}
              accessibilityRole="button"
              accessibilityLabel={`${session.startDate} の対局を閲覧モードで開く`}
            >
              <View style={styles.gameCardHeader}>
                <View style={styles.gameDateRow}>
                  <Text style={styles.gameDate}>{session.startDate}</Text>
                  <View style={styles.liveBadge}>
                    <Text style={styles.liveBadgeText}>
                      {session.status === 'live' ? '● 閲覧モード' : '閲覧モード（共有終了）'}
                    </Text>
                  </View>
                </View>
                <GameTypeLabel playerCount={session.playerCount} />
              </View>
              <View style={styles.gameCardBody}>
                <Text style={styles.playerList}>
                  {session.playerNames.join(' / ')}
                </Text>
                <Text style={styles.hanchanInfo}>
                  {session.hanchanCount}半荘
                </Text>
              </View>
            </TouchableOpacity>
          ))}

          {games.length === 0 && joinedSessions.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>保存されたゲームはありません</Text>
            </View>
          ) : (
            games.map(game => {
              const isHostLive = liveHostIds.has(game.id);
              const live = isActive(game, Date.now());
              const selected = selectedIds.includes(game.id);
              // 進行中のゲームとお気に入りのゲーム（Issue #78）はここからは削除させない
              const selectable = isGameSelectable(game, liveHostIds);
              const disabled = selectionMode && !selectable;
              // 選択モード中のお気に入りには「削除不可」の帯をカードの縦中央に重ねる（Issue #88, #90）
              const showUndeletableBadge = selectionMode && !isHostLive && game.favorite === 1;
              return (
                // ワッペン（帯）はカードの半透明（disabled）の影響を受けないよう、カードの外側に重ねる
                <View key={game.id} style={styles.gameCardWrapper}>
                  <TouchableOpacity
                    style={[
                      styles.gameCard,
                      live && styles.gameCardLive,
                      selected && styles.gameCardSelected,
                      disabled && styles.gameCardDisabled,
                    ]}
                    onPress={() => handlePressGame(game)}
                    disabled={disabled}
                    accessibilityRole={selectionMode ? 'checkbox' : 'button'}
                    accessibilityState={selectionMode ? { checked: selected, disabled } : undefined}
                  >
                    {/* チェックボックスはカード左側に常に確保した余白へ絶対配置で重ね、中身の位置を動かさない（Issue #90） */}
                    {selectionMode && (
                      <View style={[styles.checkbox, selected && styles.checkboxChecked, disabled && styles.checkboxDisabled]}>
                        {selected && <Text style={styles.checkboxMark}>✓</Text>}
                      </View>
                    )}
                    <View style={styles.gameCardHeader}>
                      <View style={styles.gameDateRow}>
                        <Text style={styles.gameDate}>{game.start_date}</Text>
                        {live && (
                          <View style={styles.liveBadge}>
                            <Text style={styles.liveBadgeText}>{isHostLive ? '● 共有中（進行中）' : '● 共有中'}</Text>
                          </View>
                        )}
                        {game.imported === 1 && (
                          <View style={styles.importedBadge}>
                            <Text style={styles.importedBadgeText}>共有</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.gameTypeRow}>
                        <GameTypeLabel playerCount={game.player_count} />
                        {/* お気に入り（終了済みゲームのみ: Issue #60） */}
                        {!isHostLive && selectionMode && game.favorite === 1 && <StarIcon size={22} filled />}
                        {!isHostLive && !selectionMode && (
                          <TouchableOpacity
                            style={styles.favoriteButton}
                            onPress={() => handleToggleFavorite(game)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            accessibilityRole="button"
                            accessibilityLabel={game.favorite === 1 ? 'お気に入りを解除' : 'お気に入りに登録'}
                          >
                            <StarIcon size={22} filled={game.favorite === 1} />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                    <View style={styles.gameCardBody}>
                      {/* 終了済みゲームは最終スコア付きで表示（Issue #78）。未終了のゲームは名前のみ */}
                      {game.finalScores ? (
                        <View style={styles.finalScoreList}>
                          {game.finalScores.map((fs, i) => (
                            <Text key={i} style={styles.finalScoreItem}>
                              <Text style={styles.finalScoreName}>{fs.playerName} </Text>
                              <Text
                                style={[
                                  styles.finalScoreValue,
                                  fs.total > 0 ? styles.scorePositive : fs.total < 0 ? styles.scoreNegative : styles.scoreNeutral,
                                ]}
                              >
                                {formatSignedScore(fs.total)}
                              </Text>
                            </Text>
                          ))}
                        </View>
                      ) : (
                        <Text style={styles.playerList}>
                          {game.playerNames.join(' / ')}
                        </Text>
                      )}
                      <Text style={styles.hanchanInfo}>
                        {game.hanchanCount}半荘
                      </Text>
                    </View>
                  </TouchableOpacity>
                  {showUndeletableBadge && (
                    <View style={styles.undeletableBadgeOverlay} pointerEvents="none">
                      <View style={styles.undeletableBadge} accessibilityLabel="お気に入りのため削除不可">
                        <Text style={styles.undeletableBadgeText}>お気に入りのため削除不可</Text>
                      </View>
                    </View>
                  )}
                </View>
              );
            })
          )}

        </ScrollView>

        {/* 複数選択モードの操作バー（Issue #74） */}
        {selectionMode && (
          <View style={styles.selectionBar}>
            <TouchableOpacity
              style={styles.selectAllButton}
              onPress={() => setSelectedIds(prev => toggleSelectAll(prev, selectableIds))}
              accessibilityRole="button"
            >
              <Text style={styles.selectAllButtonText}>{allSelected ? '選択解除' : 'すべて選択'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.bulkDeleteButton, selectedIds.length === 0 && styles.bulkDeleteButtonDisabled]}
              onPress={handleBulkDelete}
              disabled={selectedIds.length === 0}
              accessibilityRole="button"
              accessibilityState={{ disabled: selectedIds.length === 0 }}
            >
              <Text style={styles.bulkDeleteButtonText}>
                {selectedIds.length > 0 ? `削除（${selectedIds.length}件）` : '削除'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

// 麻雀タイプの表示（手書き風アイコン＋人数: Issue #62）
function GameTypeLabel({ playerCount }: { playerCount: number }) {
  return (
    <View style={styles.gameTypeLabel}>
      {playerCount === 3 ? <TileFanIcon size={16} /> : <TileIcon size={16} />}
      <Text style={styles.gameType}>{playerCount === 3 ? '3人麻雀' : '4人麻雀'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 6,
  },
  backButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSpacer: {
    width: 70,
  },
  selectButton: {
    minWidth: 70,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 6,
    alignItems: 'center',
  },
  selectButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  // 枠線の太さは gameCard で常に確保しているので、選択時は色だけを変える（Issue #90）
  gameCardSelected: {
    borderColor: '#dc3545',
    backgroundColor: '#fff5f5',
  },
  gameCardDisabled: {
    opacity: 0.5,
  },
  // カード左側の余白（gameCard の paddingLeft）に重ねる。レイアウトには影響しない（Issue #90）
  checkbox: {
    position: 'absolute',
    top: 16,
    left: 12,
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#adb5bd',
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    borderColor: '#dc3545',
    backgroundColor: '#dc3545',
  },
  checkboxDisabled: {
    backgroundColor: '#e9ecef',
  },
  checkboxMark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    lineHeight: 16,
  },
  selectionBar: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  selectAllButton: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  selectAllButtonText: {
    color: '#1e3c72',
    fontSize: 16,
    fontWeight: 'bold',
  },
  bulkDeleteButton: {
    flex: 1,
    backgroundColor: '#dc3545',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  bulkDeleteButtonDisabled: {
    backgroundColor: 'rgba(220,53,69,0.45)',
  },
  bulkDeleteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  scrollContent: {
    padding: 16,
    paddingTop: 0,
    paddingBottom: 24,
  },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#6c757d',
  },
  // 参加中の対局カードはラッパーを持たないので、カード自身に間隔を付ける
  joinedCard: {
    marginBottom: 12,
  },
  gameCardWrapper: {
    position: 'relative',
    marginBottom: 12,
  },
  // お気に入りのため削除不可のワッペン（Issue #88, #90）: カードの縦中央にカード幅いっぱいの紺色の帯を重ねる
  undeletableBadgeOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: 'center',
    zIndex: 2,
    elevation: 6,
  },
  undeletableBadge: {
    backgroundColor: '#1e3c72',
    paddingVertical: 8,
    alignItems: 'center',
  },
  undeletableBadgeText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  // 枠線は常に2px（透明）確保し、左側にはチェックボックス用の余白を常に確保する。
  // 選択モードの出入りや選択・解除でカードの大きさと中身の位置が変わらないようにするため（Issue #90）
  gameCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    padding: 16,
    paddingLeft: 44,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  gameCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 8,
  },
  gameDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  gameDate: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e3c72',
  },
  gameCardLive: {
    backgroundColor: '#fff8e1',
    borderColor: '#f9a825',
  },
  liveBadge: {
    backgroundColor: '#f9a825',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  liveBadgeText: {
    fontSize: 11,
    color: '#3e2723',
    fontWeight: 'bold',
  },
  importedBadge: {
    backgroundColor: '#e8f4fd',
    borderWidth: 1,
    borderColor: '#90caf9',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  importedBadgeText: {
    fontSize: 11,
    color: '#1565c0',
    fontWeight: 'bold',
  },
  gameType: {
    fontSize: 13,
    color: '#6c757d',
  },
  gameTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  favoriteButton: {
    paddingHorizontal: 2,
  },
  gameTypeLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  limitNote: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 12,
    lineHeight: 18,
  },
  gameCardBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  playerList: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  finalScoreList: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 12,
    rowGap: 2,
  },
  finalScoreItem: {
    fontSize: 14,
  },
  finalScoreName: {
    color: '#333',
  },
  finalScoreValue: {
    fontWeight: 'bold',
  },
  // 色はゲーム画面の総合スコア（SummaryCards）に合わせる
  scorePositive: {
    color: '#28a745',
  },
  scoreNegative: {
    color: '#dc3545',
  },
  scoreNeutral: {
    color: '#6c757d',
  },
  hanchanInfo: {
    fontSize: 13,
    color: '#6c757d',
    fontWeight: 'bold',
    marginLeft: 8,
  },
});
