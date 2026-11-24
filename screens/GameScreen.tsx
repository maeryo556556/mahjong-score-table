import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Modal,
  Share,
  TextInput,
  Animated,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import {
  getPlayerNames,
  getScoreHistory,
  getChipHistory,
  getNextHanchan,
  recordScore,
  recordChip,
  deleteHanchan,
  deleteChip,
  getGameById,
  finishGame,
  deleteGame,
  exportGameData,
  buildShareData,
  importShareData,
  getLiveSession,
  setLiveSession,
} from '../database';
import { buildShareUrl, shareDataToRecords } from '../utils';
import type { ShareGameData } from '../utils';
import { buildSessionUrl } from '../liveSession';
import type { LiveSessionStatus } from '../liveSession';
import { getLiveSessionService } from '../firebase';
import DrumRollInput from '../components/DrumRollInput';
import HistoryTable from '../components/HistoryTable';
import SummaryCards from '../components/SummaryCards';
import FinishGameModal from '../components/FinishGameModal';

interface GameScreenProps {
  /** ローカルのゲームID。ライブ閲覧（liveSessionCode 指定）時は未使用 */
  gameId?: number;
  onFinish: () => void;
  onSuspend?: () => void;
  readOnly?: boolean;
  /** 指定するとリアルタイム共有セッションを購読して読み取り専用で表示する */
  liveSessionCode?: string;
  /** ライブ閲覧した対局を履歴に保存した後に呼ばれる */
  onSavedLiveGame?: (gameId: number) => void;
}

type LiveViewStatus = 'connecting' | LiveSessionStatus;

export default function GameScreen({
  gameId: gameIdProp,
  onFinish,
  onSuspend,
  readOnly: readOnlyProp = false,
  liveSessionCode,
  onSavedLiveGame,
}: GameScreenProps) {
  const gameId = gameIdProp ?? 0;
  const isLiveViewer = !!liveSessionCode;
  const readOnly = readOnlyProp || isLiveViewer;
  const [players, setPlayers] = useState<string[]>([]);
  const [playerCount, setPlayerCount] = useState(4);
  const [currentHanchan, setCurrentHanchan] = useState(1);
  const [gameStartDate, setGameStartDate] = useState('');
  const [scoreValues, setScoreValues] = useState<number[]>([0, 0, 0, 0]);
  const [chipValues, setChipValues] = useState<number[]>([0, 0, 0, 0]);
  const [scoreHistory, setScoreHistory] = useState<any[]>([]);
  const [chipHistory, setChipHistory] = useState<any[]>([]);
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareCode, setShareCode] = useState('');
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollTopButtonOpacity = useRef(new Animated.Value(0)).current;
  const [showScrollTop, setShowScrollTop] = useState(false);

  // ホスト側: リアルタイム共有
  const [hostSession, setHostSession] = useState<{ code: string; expiresAt: number } | null>(null);
  const [showLiveModal, setShowLiveModal] = useState(false);
  const [liveStarting, setLiveStarting] = useState(false);
  const [liveSyncError, setLiveSyncError] = useState(false);

  // 参加者側: ライブ閲覧
  const [liveStatus, setLiveStatus] = useState<LiveViewStatus>('connecting');
  const [liveGame, setLiveGame] = useState<ShareGameData | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [savedLiveGameId, setSavedLiveGameId] = useState<number | null>(null);

  useEffect(() => {
    if (isLiveViewer) return;
    loadGameData();
    if (!readOnly) {
      const session = getLiveSession(gameId);
      if (session && Date.now() < session.expiresAt) {
        setHostSession(session);
        // 再開時に最新状態を反映しておく
        pushLiveUpdate(session);
      } else if (session) {
        setLiveSession(gameId, null);
      }
    }
  }, [gameId]);

  // 参加者: セッションを購読して即時反映
  useEffect(() => {
    if (!liveSessionCode) return;
    let receivedData = false;
    const unsubscribe = getLiveSessionService().join(liveSessionCode, (event) => {
      if (event.type === 'snapshot') {
        receivedData = true;
        const { snapshot } = event;
        const records = shareDataToRecords(snapshot.game);
        setLiveGame(snapshot.game);
        setLiveStatus(snapshot.status);
        setLiveError(null);
        setPlayers(records.players);
        setPlayerCount(records.playerCount);
        setGameStartDate(records.startDate);
        setScoreHistory(records.scores);
        setChipHistory(records.chips);
      } else if (event.type === 'notFound') {
        if (receivedData) {
          setLiveStatus('ended');
        } else {
          Alert.alert('参加エラー', `セッション「${liveSessionCode}」が見つかりません。\nコードを確認してください`, [
            { text: 'OK', onPress: onFinish },
          ]);
        }
      } else if (!receivedData) {
        Alert.alert('参加エラー', 'セッションに接続できませんでした。通信環境を確認してください', [
          { text: 'OK', onPress: onFinish },
        ]);
      } else {
        setLiveError('接続が切れました。表示は最後に受信した内容です');
      }
    });
    return unsubscribe;
  }, [liveSessionCode]);

  const pushLiveUpdate = (session: { code: string; expiresAt: number } | null = hostSession) => {
    if (!session) return;
    if (Date.now() >= session.expiresAt) {
      // 有効期限切れ: 以降は同期しない
      setLiveSession(gameId, null);
      setHostSession(null);
      return;
    }
    let data: ShareGameData;
    try {
      data = buildShareData(gameId);
    } catch {
      return;
    }
    getLiveSessionService()
      .push(session.code, data)
      .then(() => setLiveSyncError(false))
      .catch(() => setLiveSyncError(true));
  };

  const endHostSession = () => {
    if (!hostSession) return;
    getLiveSessionService().end(hostSession.code).catch(() => {
      // 期限切れ・通信断などで終了通知できなくても、ローカルの共有状態は解除する
    });
    setLiveSession(gameId, null);
    setHostSession(null);
    setLiveSyncError(false);
  };

  const handleStartLiveShare = async () => {
    if (liveStarting) return;
    setLiveStarting(true);
    try {
      const session = await getLiveSessionService().start(buildShareData(gameId));
      setLiveSession(gameId, session);
      setHostSession(session);
      setLiveSyncError(false);
      setShowLiveModal(true);
    } catch {
      Alert.alert('エラー', 'リアルタイム共有を開始できませんでした。\n通信環境を確認してください');
    } finally {
      setLiveStarting(false);
    }
  };

  const handleEndLiveShare = () => {
    Alert.alert(
      'リアルタイム共有を終了',
      '参加者への共有を終了しますか？\n参加者はその時点の対局を履歴に保存できます。',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '終了する',
          style: 'destructive',
          onPress: () => {
            endHostSession();
            setShowLiveModal(false);
          },
        },
      ]
    );
  };

  const handleCopyLiveCode = async () => {
    if (!hostSession) return;
    await Clipboard.setStringAsync(hostSession.code);
    Alert.alert('コピー完了', 'セッションコードをクリップボードにコピーしました');
  };

  const handleShareLiveCode = async () => {
    if (!hostSession) return;
    try {
      await Share.share({
        message: `麻雀スコアシートモバイル リアルタイム共有\nセッションコード: ${hostSession.code}\n${buildSessionUrl(hostSession.code)}`,
        title: '麻雀スコアシートモバイル - リアルタイム共有',
      });
    } catch {
      // ユーザーがキャンセルした場合など
    }
  };

  const handleSaveLiveGame = () => {
    if (!liveGame || savedLiveGameId !== null) return;
    try {
      const newGameId = importShareData(liveGame);
      setSavedLiveGameId(newGameId);
      Alert.alert('完了', '対局を履歴に保存しました', [
        { text: '閲覧する', onPress: () => onSavedLiveGame?.(newGameId) },
        { text: 'OK' },
      ]);
    } catch (e: unknown) {
      Alert.alert('エラー', e instanceof Error ? e.message : '保存に失敗しました');
    }
  };

  const loadGameData = () => {
    const game = getGameById(gameId);
    if (game) {
      setGameStartDate(game.start_date);
      setPlayerCount(game.player_count);

      const playerNames = getPlayerNames(gameId);
      setPlayers(playerNames);
      setScoreValues(new Array(playerNames.length).fill(0));
      setChipValues(new Array(playerNames.length).fill(0));

      const nextHanchan = getNextHanchan(gameId);
      setCurrentHanchan(nextHanchan);

      refreshHistory();
    }
  };

  const refreshHistory = () => {
    const scores = getScoreHistory(gameId);
    const chips = getChipHistory(gameId);
    setScoreHistory(scores);
    setChipHistory(chips);
  };

  const handleScoreChange = (index: number, value: number) => {
    const newValues = [...scoreValues];
    newValues[index] = value;
    setScoreValues(newValues);
  };

  const handleChipChange = (index: number, value: number) => {
    const newValues = [...chipValues];
    newValues[index] = value;
    setChipValues(newValues);
  };

  const handleRecordScore = () => {
    // 全員0点チェック
    if (scoreValues.every(v => v === 0)) {
      Alert.alert('入力エラー', '全員0点では記録できません。ポイントを設定してください');
      return;
    }

    // 合計0チェック
    const total = scoreValues.reduce((sum, v) => sum + v, 0);
    if (total !== 0) {
      Alert.alert('入力エラー', `ポイントの合計が${total > 0 ? '+' : ''}${total}になっています。\n合計が±0になるように調整してください`);
      return;
    }

    // 順位判定
    const scores = players.map((player, index) => ({
      player,
      point: scoreValues[index],
      rank: 0,
    }));

    const sortedScores = [...scores].sort((a, b) => b.point - a.point);
    let currentRank = 1;
    for (let i = 0; i < sortedScores.length; i++) {
      if (i > 0 && sortedScores[i].point < sortedScores[i - 1].point) {
        currentRank = i + 1;
      }
      sortedScores[i].rank = currentRank;
    }

    scores.forEach(score => {
      const sorted = sortedScores.find(s => s.player === score.player);
      score.rank = sorted!.rank;
    });

    // 記録
    recordScore(gameId, currentHanchan, scores);
    setCurrentHanchan(currentHanchan + 1);
    setScoreValues(new Array(players.length).fill(0));
    refreshHistory();
    pushLiveUpdate();
    Alert.alert('完了', `第${currentHanchan}半荘のスコアを記録しました`);
  };

  const handleRecordChip = () => {
    // 全員0チェック
    if (chipValues.every(v => v === 0)) {
      Alert.alert('入力エラー', 'チップ移動がありません。少なくとも1人のチップポイントを設定してください');
      return;
    }

    // 合計0チェック
    const total = chipValues.reduce((sum, v) => sum + v, 0);
    if (total !== 0) {
      Alert.alert('入力エラー', `チップの合計が${total > 0 ? '+' : ''}${total}になっています。\nチップの合計は±0になるように調整してください`);
      return;
    }

    const chips = players.map((player, index) => ({
      player,
      chipPoint: chipValues[index],
    }));

    recordChip(gameId, currentHanchan - 1, chips);
    setChipValues(new Array(players.length).fill(0));
    refreshHistory();
    pushLiveUpdate();
    Alert.alert('完了', 'チップ移動を記録しました');
  };

  const handleDeleteScore = (hanchan: number) => {
    Alert.alert(
      '記録削除',
      `第${hanchan}半荘の記録を削除しますか？\nこの操作は取り消せません。`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除する',
          style: 'destructive',
          onPress: () => {
            deleteHanchan(gameId, hanchan);
            const nextHanchan = getNextHanchan(gameId);
            setCurrentHanchan(nextHanchan);
            refreshHistory();
            pushLiveUpdate();
          },
        },
      ]
    );
  };

  const handleDeleteChip = (chipIds: number[]) => {
    Alert.alert(
      'チップ記録削除',
      'このチップ移動の記録を削除しますか？\nこの操作は取り消せません。',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除する',
          style: 'destructive',
          onPress: () => {
            chipIds.forEach(id => deleteChip(id));
            refreshHistory();
            pushLiveUpdate();
          },
        },
      ]
    );
  };

  const handleSuspendGame = () => {
    Alert.alert(
      '確認',
      'ゲームを中断しますか？\nセットアップ画面から再開できます。',
      [
        { text: 'キャンセル', style: 'cancel' },
        { text: '中断する', onPress: () => onSuspend?.() },
      ]
    );
  };

  const handleShareGame = () => {
    try {
      const code = exportGameData(gameId);
      setShareCode(buildShareUrl(code));
      setShowShareModal(true);
    } catch {
      Alert.alert('エラー', '共有コードの生成に失敗しました');
    }
  };

  const handleCopyToClipboard = async () => {
    await Clipboard.setStringAsync(shareCode);
    Alert.alert('コピー完了', '共有リンクをクリップボードにコピーしました');
  };

  const handleShareViaOS = async () => {
    try {
      await Share.share({
        message: `麻雀スコアシートモバイル\n${shareCode}`,
        title: '麻雀スコアシートモバイル - ゲーム共有',
      });
    } catch {
      // ユーザーがキャンセルした場合など
    }
  };

  const handleFinishGame = () => {
    setShowFinishModal(true);
  };

  const showScrollTopRef = useRef(false);
  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    const shouldShow = offsetY > 200;
    if (shouldShow !== showScrollTopRef.current) {
      showScrollTopRef.current = shouldShow;
      setShowScrollTop(shouldShow);
      Animated.timing(scrollTopButtonOpacity, {
        toValue: shouldShow ? 1 : 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, []);

  const scrollToTop = useCallback(() => {
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
  }, []);

  const confirmFinishGame = () => {
    // 記録がない場合はゲームデータ自体を削除
    // リアルタイム共有中ならセッションを終了する（参加者は履歴に保存可能になる）
    endHostSession();
    if (scoreHistory.length === 0 && chipHistory.length === 0) {
      deleteGame(gameId);
    } else {
      finishGame(gameId);
    }
    setShowFinishModal(false);
    onFinish();
  };

  return (
    <LinearGradient colors={['#1e3c72', '#2a5298']} style={styles.gradient}>
      <SafeAreaView style={styles.container}>
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.scrollContent}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          {/* ヘッダー */}
          <View style={styles.header}>
            {isLiveViewer ? (
              <>
                <TouchableOpacity style={styles.backButton} onPress={onFinish}>
                  <Text style={styles.backButtonText}>← 戻る</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{gameStartDate}</Text>
                <View style={[styles.liveBadge, liveStatus !== 'live' && styles.liveBadgeInactive]}>
                  <Text style={styles.liveBadgeText}>
                    {liveStatus === 'live' ? '● LIVE' : liveStatus === 'connecting' ? '接続中' : '終了'}
                  </Text>
                </View>
              </>
            ) : readOnly ? (
              <>
                <TouchableOpacity style={styles.backButton} onPress={onFinish}>
                  <Text style={styles.backButtonText}>← 戻る</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{gameStartDate}</Text>
                <TouchableOpacity style={styles.shareButton} onPress={handleShareGame}>
                  <Text style={styles.shareButtonText}>共有</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.headerTitle}>第{currentHanchan}半荘</Text>
                <View style={styles.headerButtons}>
                  {onSuspend && (
                    <TouchableOpacity style={styles.suspendButton} onPress={handleSuspendGame}>
                      <Text style={styles.suspendButtonText}>中断</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={styles.finishButton} onPress={handleFinishGame}>
                    <Text style={styles.finishButtonText}>ゲーム終了</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>

          {isLiveViewer && (
            <View style={styles.liveBanner}>
              <Text style={styles.liveBannerTitle}>📡 リアルタイム共有 {liveSessionCode}</Text>
              <Text style={styles.liveBannerText}>
                {liveStatus === 'connecting'
                  ? 'セッションに接続しています…'
                  : liveStatus === 'live'
                    ? 'ホストの入力が自動で反映されます（閲覧のみ）'
                    : liveStatus === 'ended'
                      ? 'ホストが共有を終了しました'
                      : 'セッションの有効期限が切れました'}
              </Text>
              {liveError && <Text style={styles.liveBannerError}>{liveError}</Text>}
              {(liveStatus === 'ended' || liveStatus === 'expired' || liveError) && liveGame && (
                <TouchableOpacity
                  style={[styles.liveBannerButton, savedLiveGameId !== null && styles.liveBannerButtonDisabled]}
                  onPress={handleSaveLiveGame}
                  disabled={savedLiveGameId !== null}
                >
                  <Text style={styles.liveBannerButtonText}>
                    {savedLiveGameId !== null ? '保存済み' : '対局を履歴に保存'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {!readOnly && (
            <TouchableOpacity
              style={[styles.liveBanner, hostSession ? null : styles.liveBannerIdle]}
              onPress={hostSession ? () => setShowLiveModal(true) : handleStartLiveShare}
              disabled={liveStarting}
            >
              <Text style={styles.liveBannerTitle}>
                {hostSession
                  ? `📡 リアルタイム共有中  コード: ${hostSession.code}`
                  : liveStarting ? '📡 リアルタイム共有を開始しています…' : '📡 リアルタイム共有を開始'}
              </Text>
              <Text style={styles.liveBannerText}>
                {hostSession
                  ? 'タップでコードの共有・共有の終了'
                  : '同じ卓のメンバーがコードでスコアを閲覧できます'}
              </Text>
              {hostSession && liveSyncError && (
                <Text style={styles.liveBannerError}>同期に失敗しました。通信が戻ると次の記録時に再送されます</Text>
              )}
            </TouchableOpacity>
          )}

          {!readOnly && (
            <>
              {/* ポイント入力 */}
              <View style={styles.card}>
                <View style={styles.sectionTitleRow}>
                  <Text style={styles.sectionTitle}>🀄 ポイント入力</Text>
                  {(() => {
                    const total = scoreValues.reduce((sum, v) => sum + v, 0);
                    return (
                      <Text style={[styles.totalPreview, total !== 0 ? styles.totalPreviewError : null]}>
                        合計: {total > 0 ? '+' : ''}{total}
                      </Text>
                    );
                  })()}
                </View>
                <View style={styles.inputGrid}>
                  {players.map((player, index) => (
                    <DrumRollInput
                      key={index}
                      label={player}
                      value={scoreValues[index]}
                      onChange={(value) => handleScoreChange(index, value)}
                    />
                  ))}
                </View>
                <View style={styles.buttonRow}>
                  <TouchableOpacity
                    style={[styles.recordButton, styles.resetButton, { flex: 1 }]}
                    onPress={() => setScoreValues(new Array(players.length).fill(0))}
                  >
                    <Text style={styles.resetButtonText}>リセット</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.recordButton, styles.scoreButton, { flex: 2 }]} onPress={handleRecordScore}>
                    <Text style={styles.recordButtonText}>スコアを記録</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* チップ移動 */}
              <View style={styles.card}>
                <View style={styles.sectionTitleRow}>
                  <Text style={styles.sectionTitle}>🎉 チップ移動</Text>
                  {(() => {
                    const total = chipValues.reduce((sum, v) => sum + v, 0);
                    return (
                      <Text style={[styles.totalPreview, total !== 0 ? styles.totalPreviewError : null]}>
                        合計: {total > 0 ? '+' : ''}{total}
                      </Text>
                    );
                  })()}
                </View>
                <View style={styles.inputGrid}>
                  {players.map((player, index) => (
                    <DrumRollInput
                      key={index}
                      label={player}
                      value={chipValues[index]}
                      onChange={(value) => handleChipChange(index, value)}
                    />
                  ))}
                </View>
                <View style={styles.buttonRow}>
                  <TouchableOpacity
                    style={[styles.recordButton, styles.resetButton, { flex: 1 }]}
                    onPress={() => setChipValues(new Array(players.length).fill(0))}
                  >
                    <Text style={styles.resetButtonText}>リセット</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.recordButton, styles.chipButton, { flex: 2 }]}
                    onPress={handleRecordChip}
                  >
                    <Text style={styles.recordButtonText}>チップを記録</Text>
                  </TouchableOpacity>
              </View>
              </View>
            </>
          )}

          {/* 総合スコア */}
          <SummaryCards
            players={players}
            scoreHistory={scoreHistory}
            chipHistory={chipHistory}
            playerCount={playerCount}
          />

          {/* 記録履歴 */}
          <HistoryTable
            players={players}
            scoreHistory={scoreHistory}
            chipHistory={chipHistory}
            gameStartDate={gameStartDate}
            {...(!readOnly && {
              onDeleteScore: handleDeleteScore,
              onDeleteChip: handleDeleteChip,
            })}
          />
        </ScrollView>

        {!readOnly && (
          <FinishGameModal
            visible={showFinishModal}
            players={players}
            scoreHistory={scoreHistory}
            chipHistory={chipHistory}
            playerCount={playerCount}
            onConfirm={confirmFinishGame}
            onCancel={() => setShowFinishModal(false)}
          />
        )}
        {!readOnly && (
          <Modal visible={showLiveModal && !!hostSession} transparent animationType="fade">
            <View style={styles.modalOverlay}>
              <View style={styles.shareModalContent}>
                <Text style={styles.shareModalTitle}>リアルタイム共有</Text>
                <Text style={styles.shareModalDescription}>
                  参加者はセットアップ画面の「ゲームを取り込む」に{'\n'}
                  このコードを入力すると、スコアをリアルタイムで閲覧できます。
                </Text>
                <Text style={styles.liveCodeText} selectable>{hostSession?.code}</Text>
                {hostSession && (
                  <Text style={styles.liveExpiresText}>
                    有効期限: {new Date(hostSession.expiresAt).toLocaleString('ja-JP')}
                  </Text>
                )}
                <View style={styles.shareModalButtons}>
                  <TouchableOpacity
                    style={[styles.shareModalButton, styles.shareModalShareButton]}
                    onPress={handleShareLiveCode}
                  >
                    <Text style={styles.shareModalButtonText}>送信する</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.shareModalButton, styles.shareModalCopyButton]}
                    onPress={handleCopyLiveCode}
                  >
                    <Text style={styles.shareModalButtonText}>コードをコピー</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.shareModalButton, styles.liveEndButton]}
                    onPress={handleEndLiveShare}
                  >
                    <Text style={styles.shareModalButtonText}>共有を終了</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.shareModalButton, styles.shareModalCloseButton]}
                    onPress={() => setShowLiveModal(false)}
                  >
                    <Text style={styles.shareModalCloseText}>閉じる</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        )}
        {readOnly && !isLiveViewer && (
          <Modal visible={showShareModal} transparent animationType="fade">
            <View style={styles.modalOverlay}>
              <View style={styles.shareModalContent}>
                <Text style={styles.shareModalTitle}>ゲームを共有</Text>
                <Text style={styles.shareModalDescription}>
                  以下のリンクを相手に送ってください。{'\n'}
                  リンクをタップするとアプリが開いて自動で取り込めます。
                </Text>
                <View style={styles.shareCodeContainer}>
                  <TextInput
                    style={styles.shareCodeText}
                    value={shareCode}
                    editable={false}
                    multiline
                    selectTextOnFocus
                  />
                </View>
                <View style={styles.shareModalButtons}>
                  <TouchableOpacity
                    style={[styles.shareModalButton, styles.shareModalShareButton]}
                    onPress={handleShareViaOS}
                  >
                    <Text style={styles.shareModalButtonText}>送信する</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.shareModalButton, styles.shareModalCopyButton]}
                    onPress={handleCopyToClipboard}
                  >
                    <Text style={styles.shareModalButtonText}>コピーする</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.shareModalButton, styles.shareModalCloseButton]}
                    onPress={() => setShowShareModal(false)}
                  >
                    <Text style={styles.shareModalCloseText}>閉じる</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        )}
        <Animated.View style={[styles.scrollTopButton, { opacity: scrollTopButtonOpacity }]} pointerEvents={showScrollTop ? 'auto' : 'none'}>
          <TouchableOpacity onPress={scrollToTop} style={styles.scrollTopTouchable} activeOpacity={0.7}>
            <Text style={styles.scrollTopIcon}>↑</Text>
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
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
  headerSpacer: {
    width: 70,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  suspendButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  suspendButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  finishButton: {
    backgroundColor: '#dc3545',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  finishButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#2a5298',
    paddingBottom: 6,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e3c72',
  },
  inputGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  totalPreview: {
    fontSize: 12,
    color: '#28a745',
  },
  totalPreviewError: {
    color: '#dc3545',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  recordButton: {
    backgroundColor: '#2a5298',
    borderRadius: 6,
    padding: 12,
    alignItems: 'center',
  },
  resetButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#adb5bd',
  },
  resetButtonText: {
    color: '#6c757d',
    fontSize: 14,
    fontWeight: 'bold',
  },
  scoreButton: {
    backgroundColor: '#28a745',
  },
  chipButton: {
    backgroundColor: '#ffc107',
  },
  recordButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  shareButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#2a5298',
    borderRadius: 6,
  },
  shareButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  shareModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxHeight: '80%',
  },
  shareModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e3c72',
    textAlign: 'center',
    marginBottom: 12,
  },
  shareModalDescription: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  shareCodeContainer: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    maxHeight: 150,
    marginBottom: 16,
  },
  shareCodeText: {
    fontSize: 11,
    color: '#333',
    fontFamily: 'monospace',
  },
  shareModalButtons: {
    gap: 8,
  },
  shareModalButton: {
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  shareModalShareButton: {
    backgroundColor: '#2a5298',
  },
  shareModalCopyButton: {
    backgroundColor: '#28a745',
  },
  shareModalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  shareModalCloseButton: {
    backgroundColor: '#f0f0f0',
  },
  shareModalCloseText: {
    color: '#666',
    fontSize: 16,
    fontWeight: 'bold',
  },
  liveBadge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#dc3545',
    borderRadius: 6,
  },
  liveBadgeInactive: {
    backgroundColor: '#6c757d',
  },
  liveBadgeText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  liveBanner: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    padding: 12,
    marginBottom: 16,
  },
  liveBannerIdle: {
    borderStyle: 'dashed',
  },
  liveBannerTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  liveBannerText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    marginTop: 4,
  },
  liveBannerError: {
    color: '#ffc107',
    fontSize: 12,
    marginTop: 4,
  },
  liveBannerButton: {
    backgroundColor: '#28a745',
    borderRadius: 6,
    padding: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  liveBannerButtonDisabled: {
    backgroundColor: '#6c757d',
  },
  liveBannerButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  liveCodeText: {
    fontSize: 36,
    fontWeight: 'bold',
    letterSpacing: 6,
    color: '#1e3c72',
    textAlign: 'center',
    marginBottom: 8,
    fontFamily: 'monospace',
  },
  liveExpiresText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  liveEndButton: {
    backgroundColor: '#dc3545',
  },
  scrollTopButton: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    zIndex: 10,
  },
  scrollTopTouchable: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(30, 60, 114, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  scrollTopIcon: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: -2,
  },
});
