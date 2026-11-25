import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Modal,
  Keyboard,
  TouchableWithoutFeedback,
  FlatList,
  Image,
  useWindowDimensions,
} from 'react-native';
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  createGame,
  getFinishedGames,
  getUnfinishedGames,
  finishGame,
  deleteGame,
  getLastPlayerNames,
  getJoinedSessions,
  getSavedLiveSessionCodes,
  findImportedGameBySessionCode,
  getSavedGameCounts,
} from '../database';
import { buildDefaultPlayerNames, MAX_PLAYER_NAME_LENGTH } from '../utils';
import { TileFanIcon, TileIcon } from '../components/icons/HandDrawnIcons';
import { TitleLogo } from '../components/icons/TitleLogo';
import {
  extractSessionCode,
  resolveImportCode,
  sanitizeSessionCodeInput,
  selectRejoinableSessions,
  SESSION_CODE_LENGTH,
} from '../liveSession';
import type { ImportedGameRef } from '../liveSession';

// 使い方のモーダル（Issue #72）
const GUIDE_PADDING = 18;
const GUIDE_IMAGE_ASPECT = 3 / 4; // assets/guide/ の画像（高さ / 幅）
// 使い方モーダルの外枠の太さ。FlatList の実表示幅はモーダル幅からこの左右ぶんを引いた幅になる（Issue #92）
const GUIDE_BORDER_WIDTH = 3;
// ページごとのアクセント色と淡い背景色（generate_assets.py の GUIDE_THEMES と揃える。Issue #74）
const GUIDE_THEMES = [
  { accent: '#ff7043', soft: '#fff3e0' },
  { accent: '#2979ff', soft: '#e3f2fd' },
  { accent: '#ffa000', soft: '#fff8e1' },
  { accent: '#ec407a', soft: '#fce4ec' },
  { accent: '#43a047', soft: '#e8f5e9' },
  { accent: '#f57f17', soft: '#fffde7' },
  { accent: '#7c4dff', soft: '#ede7f6' },
];

interface SetupScreenProps {
  onStartGame: (gameId: number) => void;
  onResumeGame: (gameId: number) => void;
  onViewPastGames: () => void;
  onJoinLiveSession: (code: string) => void;
  /** 取り込み済みの対局（履歴に保存済み）を開く（Issue #72） */
  onOpenImportedGame: (gameId: number) => void;
}

export default function SetupScreen({
  onStartGame,
  onResumeGame,
  onViewPastGames,
  onJoinLiveSession,
  onOpenImportedGame,
}: SetupScreenProps) {
  const [playerCount, setPlayerCount] = useState(4);
  const [playerNames, setPlayerNames] = useState(['', '', '', '']);
  const [hasPastGames, setHasPastGames] = useState(false);
  const [gameCounts, setGameCounts] = useState<{ total: number; favorite: number } | null>(null);
  const [suspendedGames, setSuspendedGames] = useState<ReturnType<typeof getUnfinishedGames>>([]);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importCode, setImportCode] = useState('');
  const [showGuide, setShowGuide] = useState(false);
  const [guideIndex, setGuideIndex] = useState(0);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  // 右上の「使い方」ボタンと重ならないよう、左右にボタン幅ぶんの余白を残して中央に置く
  const logoWidth = Math.min(340, Math.max(200, windowWidth - 32 - 2 * 46));
  const guideListRef = useRef<FlatList>(null);
  // 使い方のモーダル（Issue #72）: 小さめの正方形に近い比率。1ページの幅＝モーダルの幅でスワイプでめくる
  const guideWidth = Math.min(windowWidth - 48, 360, Math.max(280, windowHeight * 0.6));
  // 画像は少し内側に収めて、モーダル全体を正方形に近づける
  const guideImageWidth = Math.round((guideWidth - 2 * GUIDE_PADDING) * 0.9);
  // 1ページの幅は FlatList の実際の表示幅に合わせる（Issue #92）。
  // モーダルの外枠（borderWidth）のぶんだけ guideWidth より狭くなるため、ページ幅を guideWidth にすると
  // pagingEnabled のスクロール量（＝表示幅）とページ幅が食い違い、めくるたびに中身がズレていく。
  // 実測値（onLayout）があればそれを使い、測定前は外枠を差し引いた計算値を使う。
  const [measuredGuidePageWidth, setMeasuredGuidePageWidth] = useState<number | null>(null);
  const guidePageWidth = measuredGuidePageWidth ?? guideWidth - 2 * GUIDE_BORDER_WIDTH;
  const importCodeInputRef = useRef<TextInput>(null);

  // 使い方ガイド（Issue #58: リアルタイム共有・閲覧モード・6桁のセッションコードに合わせて更新）
  // 各スライドの画像は generate_assets.py で生成した画面イメージ（assets/guide/、4:3。Issue #72）
  // Issue #74: 明るく楽しいトーンに。説明はページごとに一言だけ
  const guideSlides = [
    { title: 'ゲームの始め方', image: require('../assets/guide/guide_1_setup.png'), caption: '名前を入れてゲーム開始！' },
    { title: 'スコアの記録', image: require('../assets/guide/guide_2_score.png'), caption: 'ポイントを入れて記録！' },
    { title: 'チップの記録', image: require('../assets/guide/guide_3_chip.png'), caption: 'チップもポチッと記録！' },
    { title: '中断・終了', image: require('../assets/guide/guide_4_finish.png'), caption: '中断も終了もボタンひとつ！' },
    { title: 'リアルタイム共有', image: require('../assets/guide/guide_5_live_share.png'), caption: 'コードを伝えてみんなで見よう！' },
    { title: '閲覧モード', image: require('../assets/guide/guide_6_live_viewer.png'), caption: 'コードを入れて観戦しよう！' },
    { title: '過去のゲーム', image: require('../assets/guide/guide_7_share.png'), caption: '思い出の対局も共有できる！' },
  ];
  const guideTheme = (i: number) => GUIDE_THEMES[i % GUIDE_THEMES.length];

  const guideMockups: React.ReactNode[] = guideSlides.map((slide, i) => (
    <Image
      key={i}
      source={slide.image}
      style={[g.mockupImage, { width: guideImageWidth, height: guideImageWidth * GUIDE_IMAGE_ASPECT }]}
      resizeMode="cover"
    />
  ));

  // ページ移動（ボタン・インジケーターのタップ）
  const goToGuidePage = (index: number) => {
    const next = Math.max(0, Math.min(guideSlides.length - 1, index));
    setGuideIndex(next);
    guideListRef.current?.scrollToIndex({ index: next, animated: true });
  };

  // スワイプでページが変わったらインジケーターを合わせる（半分以上めくった時点で切り替える）
  const handleGuideScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const page = Math.max(0, Math.min(guideSlides.length - 1, Math.round(e.nativeEvent.contentOffset.x / guidePageWidth)));
    if (page !== guideIndex) setGuideIndex(page);
  };

  // FlatList の実表示幅を測ってページ幅に使う（Issue #92）
  const handleGuideListLayout = (e: LayoutChangeEvent) => {
    const width = e.nativeEvent.layout.width;
    if (width > 0 && width !== measuredGuidePageWidth) setMeasuredGuidePageWidth(width);
  };

  // ページ幅が変わったとき（画面回転など）は表示中のページの先頭に位置を合わせ直す
  useEffect(() => {
    if (!showGuide) return;
    guideListRef.current?.scrollToOffset({ offset: guidePageWidth * guideIndex, animated: false });
    // guideIndex の変化ではスクロールし直さない（スワイプ中の位置を乱さないため）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guidePageWidth, showGuide]);

  useEffect(() => {
    const finished = getFinishedGames();
    // 閲覧中の対局（ゲストとして参加したセッション）があれば一覧から再入室できるようにボタンを出す
    let hasJoinedSessions = false;
    try {
      hasJoinedSessions = selectRejoinableSessions(getJoinedSessions(), getSavedLiveSessionCodes(), Date.now()).length > 0;
    } catch {
      // 読めなくても続行する
    }
    setHasPastGames(finished.length > 0 || hasJoinedSessions);
    setSuspendedGames(getUnfinishedGames());
    // 過去のゲーム件数・お気に入り件数（Issue #81）
    try {
      setGameCounts(getSavedGameCounts());
    } catch {
      // 読めなくても続行する（件数は表示しない）
    }
    // 直近のゲームのプレイヤー名を初期値として入れておく（編集可能）
    try {
      const lastNames = getLastPlayerNames();
      if (lastNames && lastNames.length > 0) {
        setPlayerNames(buildDefaultPlayerNames(lastNames));
      }
    } catch {
      // 取得に失敗しても空欄のまま続行する
    }
  }, []);

  const handlePlayerCountChange = (count: number) => {
    setPlayerCount(count);
    if (count === 3) {
      setPlayerNames(prev => [prev[0], prev[1], prev[2]]);
    } else {
      setPlayerNames(prev => [...prev.slice(0, 3), prev[3] || '']);
    }
  };

  const startNewGame = () => {
    // 中断中のゲームを全て終了扱いにする
    suspendedGames.forEach(game => {
      if (game.hanchanCount === 0) {
        deleteGame(game.id);
      } else {
        finishGame(game.id);
      }
    });
    setSuspendedGames([]);

    const names = playerNames.slice(0, playerCount);
    const gameId = createGame(playerCount, names);
    onStartGame(gameId);
  };

  const handleStartGame = () => {
    // バリデーション
    const names = playerNames.slice(0, playerCount);

    if (names.some(name => !name.trim())) {
      Alert.alert('入力エラー', 'すべてのプレイヤーの名前を入力してください');
      return;
    }

    if (names.some(name => name.length > MAX_PLAYER_NAME_LENGTH)) {
      Alert.alert('入力エラー', `プレイヤー名は${MAX_PLAYER_NAME_LENGTH}文字以内で入力してください`);
      return;
    }

    if (suspendedGames.length > 0) {
      Alert.alert(
        '確認',
        '中断中のゲームがあります。\n新しいゲームを開始すると、中断中のゲームは終了扱いになります。\nよろしいですか？',
        [
          { text: 'キャンセル', style: 'cancel' },
          { text: '開始する', onPress: startNewGame },
        ]
      );
      return;
    }

    startNewGame();
  };

  const handleImport = () => {
    const rawInput = importCode.trim();
    if (!rawInput) {
      Alert.alert('入力エラー', '6桁のセッションコードを入力してください');
      return;
    }
    // セッションコード（またはセッションリンク）ならセッションに参加する。
    // 進行中なら閲覧、終了済みなら閲覧のうえ履歴に保存できる。
    const sessionCode = extractSessionCode(rawInput);
    if (!sessionCode) {
      // 静的共有コード（廃止）やその他の文字列はエラー
      Alert.alert('エラー', 'コードが正しくありません。\n6桁の数字のセッションコードを入力してください');
      return;
    }
    // すでに取り込み済みのコードはエラーにせず、取り込み済みの対局を開く（Issue #72）
    let imported: ImportedGameRef | null = null;
    try {
      imported = findImportedGameBySessionCode(sessionCode);
    } catch {
      // 判定できなくても通常どおり参加する
    }
    const action = resolveImportCode(sessionCode, imported, Date.now());
    if (action.type === 'join') {
      setShowImportModal(false);
      setImportCode('');
      onJoinLiveSession(action.code);
      return;
    }
    Alert.alert(
      '取り込み済み',
      action.type === 'openLive'
        ? 'この対局はすでに取り込み済みです。\n閲覧モードで開きます'
        : 'この対局はすでに取り込み済みです。\n保存済みの対局を開きます',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '開く',
          onPress: () => {
            setShowImportModal(false);
            setImportCode('');
            if (action.type === 'openLive') {
              onJoinLiveSession(action.code);
            } else {
              onOpenImportedGame(action.gameId);
            }
          },
        },
      ]
    );
  };

  return (
    <LinearGradient colors={['#1e3c72', '#2a5298']} style={styles.gradient}>
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.helpButton}
              onPress={() => { setGuideIndex(0); setShowGuide(true); }}
            >
              <Text style={styles.helpButtonText}>?</Text>
              <Text style={styles.helpButtonLabel}>使い方</Text>
            </TouchableOpacity>
            <TitleLogo width={logoWidth} />
          </View>

          {suspendedGames.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>中断中のゲーム</Text>
              {suspendedGames.map(game => (
                <TouchableOpacity
                  key={game.id}
                  style={styles.suspendedGameCard}
                  onPress={() => onResumeGame(game.id)}
                >
                  <View style={styles.suspendedGameHeader}>
                    <Text style={styles.suspendedGameDate}>{game.start_date}</Text>
                    <Text style={styles.suspendedGameType}>
                      {game.player_count === 3 ? '3人麻雀' : '4人麻雀'}
                    </Text>
                  </View>
                  <Text style={styles.suspendedGamePlayers}>
                    {game.playerNames.join(' / ')}
                  </Text>
                  <View style={styles.suspendedGameFooter}>
                    <Text style={styles.suspendedGameHanchan}>
                      {game.hanchanCount}半荘
                    </Text>
                    <Text style={styles.resumeText}>タップして再開 →</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={[styles.card, suspendedGames.length > 0 && styles.cardWithMarginTop]}>
            <Text style={styles.sectionTitle}>新規ゲーム</Text>

            {/* 麻雀タイプ選択 */}
            <View style={styles.typeSelection}>
              <Text style={styles.label}>麻雀タイプ</Text>
              <View style={styles.typeButtons}>
                <TouchableOpacity
                  style={[styles.typeButton, playerCount === 4 && styles.typeButtonActive]}
                  onPress={() => handlePlayerCountChange(4)}
                >
                  <TileIcon size={30} style={styles.typeButtonIcon} />
                  <Text style={[styles.typeButtonText, playerCount === 4 && styles.typeButtonTextActive]}>
                    4人麻雀
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.typeButton, playerCount === 3 && styles.typeButtonActive]}
                  onPress={() => handlePlayerCountChange(3)}
                >
                  <TileFanIcon size={30} style={styles.typeButtonIcon} />
                  <Text style={[styles.typeButtonText, playerCount === 3 && styles.typeButtonTextActive]}>
                    3人麻雀
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* プレイヤー名入力 */}
            <Text style={styles.label}>プレイヤー設定</Text>
            <Text style={styles.hintText}>※ {MAX_PLAYER_NAME_LENGTH}文字以内で入力してください</Text>
            <View style={styles.playerInputs}>
              {playerNames.slice(0, playerCount).map((name, index) => (
                <View key={index} style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>プレイヤー{index + 1}</Text>
                  <TextInput
                    style={styles.input}
                    value={name}
                    onChangeText={(text) => {
                      const newNames = [...playerNames];
                      newNames[index] = text;
                      setPlayerNames(newNames);
                    }}
                    placeholder="名前を入力"
                  />
                </View>
              ))}
            </View>

            <TouchableOpacity style={[styles.startButton, { marginTop: 4 }]} onPress={handleStartGame}>
              <Text style={styles.startButtonText}>ゲーム開始</Text>
            </TouchableOpacity>
          </View>

          {/* 履歴まわりのボタン（Issue #81: カードを廃止し、取り込む→見るの順にボタンだけを並べる） */}
          <View style={styles.historyButtons}>
            <TouchableOpacity
              style={[styles.startButton, styles.importButton]}
              onPress={() => setShowImportModal(true)}
            >
              <Text style={styles.startButtonText}>ゲームを取り込む</Text>
            </TouchableOpacity>

            {hasPastGames && (
              <TouchableOpacity
                style={[styles.startButton, styles.secondaryButton, styles.buttonMarginTop]}
                onPress={onViewPastGames}
              >
                <Text style={styles.startButtonText}>過去のゲームを見る</Text>
              </TouchableOpacity>
            )}

            {gameCounts && (
              <Text style={styles.gameCountText}>
                過去のゲーム {gameCounts.total}件（お気に入り {gameCounts.favorite}件）
              </Text>
            )}
          </View>
        </ScrollView>

        <Modal visible={showImportModal} transparent animationType="fade">
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <View style={styles.importModalContent}>
              <Text style={styles.importModalTitle}>ゲームを取り込む</Text>
              <Text style={styles.importModalDescription}>
                共有された6桁の数字のセッションコードを入力してください。{'\n'}
                進行中の対局はリアルタイムで閲覧でき、終了した対局は履歴に保存できます
              </Text>
              {/* 6桁の数字専用入力欄（Issue #53）: 見えない TextInput で入力を受け、6つの枠に1桁ずつ表示する */}
              <TouchableWithoutFeedback onPress={() => importCodeInputRef.current?.focus()}>
                <View style={styles.codeBoxRow}>
                  {Array.from({ length: SESSION_CODE_LENGTH }, (_, i) => {
                    const isCurrent = i === Math.min(importCode.length, SESSION_CODE_LENGTH - 1);
                    return (
                      <View key={i} style={[styles.codeBox, isCurrent && styles.codeBoxActive]}>
                        <Text style={styles.codeBoxText}>{importCode[i] ?? ''}</Text>
                      </View>
                    );
                  })}
                  <TextInput
                    ref={importCodeInputRef}
                    style={styles.codeHiddenInput}
                    value={importCode}
                    // 数字以外は受け付けない。共有リンクが貼り付けられた場合はコードを取り出す
                    onChangeText={(text) => setImportCode(sanitizeSessionCodeInput(text))}
                    keyboardType="number-pad"
                    textContentType="oneTimeCode"
                    autoComplete="off"
                    autoCorrect={false}
                    caretHidden
                    autoFocus
                    accessibilityLabel="6桁のセッションコード"
                  />
                </View>
              </TouchableWithoutFeedback>
              <View style={styles.importModalButtons}>
                <TouchableOpacity
                  style={[
                    styles.importModalButton,
                    styles.importModalSubmitButton,
                    importCode.length < SESSION_CODE_LENGTH && styles.importModalSubmitButtonDisabled,
                  ]}
                  onPress={handleImport}
                  disabled={importCode.length < SESSION_CODE_LENGTH}
                >
                  <Text style={styles.importModalButtonText}>取り込む</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.importModalButton, styles.importModalCancelButton]}
                  onPress={() => { setShowImportModal(false); setImportCode(''); }}
                >
                  <Text style={styles.importModalCancelText}>キャンセル</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
          </TouchableWithoutFeedback>
        </Modal>

        <Modal visible={showGuide} transparent animationType="fade" onRequestClose={() => setShowGuide(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.guideModalContent, { width: guideWidth, backgroundColor: guideTheme(guideIndex).soft }]}>
              <TouchableOpacity
                style={styles.guideCloseButton}
                onPress={() => setShowGuide(false)}
                accessibilityRole="button"
                accessibilityLabel="使い方を閉じる"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.guideCloseText}>×</Text>
              </TouchableOpacity>
              {/* 左右のスワイプでページをめくる（Issue #72） */}
              <FlatList
                ref={guideListRef}
                data={guideSlides}
                horizontal
                pagingEnabled
                bounces={false}
                showsHorizontalScrollIndicator={false}
                keyExtractor={(_, i) => String(i)}
                getItemLayout={(_, index) => ({ length: guidePageWidth, offset: guidePageWidth * index, index })}
                onLayout={handleGuideListLayout}
                onScroll={handleGuideScroll}
                scrollEventThrottle={16}
                onMomentumScrollEnd={handleGuideScroll}
                renderItem={({ item, index }) => (
                  <View style={[styles.guideSlide, { width: guidePageWidth }]}>
                    <View style={[styles.guideTitleBadge, { backgroundColor: guideTheme(index).accent }]}>
                      <Text style={styles.guideTitle}>{item.title}</Text>
                    </View>
                    {guideMockups[index]}
                    <Text style={[styles.guideCaption, { color: guideTheme(index).accent }]}>{item.caption}</Text>
                  </View>
                )}
              />
              {/* 前へ ／ ページ位置のインジケーター ／ 次へ */}
              <View style={styles.guideNav}>
                <TouchableOpacity
                  style={styles.guideNavButton}
                  onPress={() => goToGuidePage(guideIndex - 1)}
                  disabled={guideIndex === 0}
                  accessibilityRole="button"
                  accessibilityLabel="前のページ"
                >
                  <Text style={[styles.guideNavText, { color: guideTheme(guideIndex).accent }, guideIndex === 0 && styles.guideNavTextDisabled]}>←</Text>
                </TouchableOpacity>
                <View style={styles.guideIndicator}>
                  <View style={styles.guideDots}>
                    {guideSlides.map((_, i) => (
                      <TouchableOpacity
                        key={i}
                        onPress={() => goToGuidePage(i)}
                        hitSlop={{ top: 8, bottom: 8, left: 3, right: 3 }}
                        accessibilityRole="button"
                        accessibilityLabel={`${i + 1}ページ目`}
                      >
                        <View style={[styles.guideDot, i === guideIndex && [styles.guideDotActive, { backgroundColor: guideTheme(i).accent }]]} />
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={styles.guidePageText}>{guideIndex + 1} / {guideSlides.length}</Text>
                </View>
                {guideIndex < guideSlides.length - 1 ? (
                  <TouchableOpacity
                    style={[styles.guideNavButton, styles.guideNavNext, { backgroundColor: guideTheme(guideIndex).accent }]}
                    onPress={() => goToGuidePage(guideIndex + 1)}
                    accessibilityRole="button"
                    accessibilityLabel="次のページ"
                  >
                    <Text style={[styles.guideNavText, styles.guideNavNextText]}>→</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.guideNavButton, styles.guideNavNext, { backgroundColor: guideTheme(guideIndex).accent }]}
                    onPress={() => setShowGuide(false)}
                    accessibilityRole="button"
                  >
                    <Text style={[styles.guideNavText, styles.guideNavNextText, styles.guideNavCloseText]}>閉じる</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </Modal>
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
    alignItems: 'center',
    marginBottom: 24,
    position: 'relative',
  },
  helpButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 40,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  helpButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    lineHeight: 20,
  },
  helpButtonLabel: {
    color: '#fff',
    fontSize: 9,
    fontWeight: 'bold',
    marginTop: 1,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
  },
  cardWithMarginTop: {
    marginTop: 16,
    shadowRadius: 8,
    elevation: 5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e3c72',
    marginBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: '#2a5298',
    paddingBottom: 8,
  },
  typeSelection: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1e3c72',
    marginBottom: 8,
  },
  hintText: {
    fontSize: 11,
    color: '#999',
    marginBottom: 6,
  },
  typeButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  typeButton: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#dee2e6',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  typeButtonActive: {
    backgroundColor: '#2a5298',
    borderColor: '#2a5298',
  },
  typeButtonIcon: {
    marginBottom: 8,
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#6c757d',
  },
  typeButtonTextActive: {
    color: '#fff',
  },
  playerInputs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  inputGroup: {
    width: '48%',
  },
  inputLabel: {
    fontSize: 12,
    color: '#555',
    marginBottom: 4,
    fontWeight: 'bold',
  },
  input: {
    borderWidth: 2,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 10,
    fontSize: 16,
  },
  suspendedGameCard: {
    backgroundColor: '#e8f4fd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#b3d9f2',
  },
  suspendedGameHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  suspendedGameDate: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1e3c72',
  },
  suspendedGameType: {
    fontSize: 12,
    color: '#6c757d',
  },
  suspendedGamePlayers: {
    fontSize: 13,
    color: '#333',
    marginBottom: 6,
  },
  suspendedGameFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  suspendedGameHanchan: {
    fontSize: 12,
    color: '#6c757d',
  },
  resumeText: {
    fontSize: 12,
    color: '#2a5298',
    fontWeight: 'bold',
  },
  startButton: {
    backgroundColor: '#2a5298',
    borderRadius: 6,
    padding: 14,
    alignItems: 'center',
  },
  buttonMarginTop: {
    marginTop: 8,
  },
  secondaryButton: {
    backgroundColor: '#6c757d',
  },
  startButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  importButton: {
    backgroundColor: '#17a2b8',
  },
  historyButtons: {
    marginTop: 16,
  },
  gameCountText: {
    marginTop: 10,
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  importModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
  },
  importModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e3c72',
    textAlign: 'center',
    marginBottom: 8,
  },
  importModalDescription: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  codeBoxRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  codeBox: {
    width: 42,
    height: 54,
    borderWidth: 2,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeBoxActive: {
    borderColor: '#17a2b8',
    backgroundColor: '#fff',
  },
  codeBoxText: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#1e3c72',
    fontFamily: 'monospace',
  },
  // 枠の上に重ねた透明な入力欄（タップでキーボードを開く）
  codeHiddenInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0,
  },
  importModalButtons: {
    gap: 8,
  },
  importModalButton: {
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  importModalSubmitButton: {
    backgroundColor: '#17a2b8',
  },
  importModalSubmitButtonDisabled: {
    opacity: 0.5,
  },
  importModalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  importModalCancelButton: {
    backgroundColor: '#f0f0f0',
  },
  importModalCancelText: {
    color: '#666',
    fontSize: 16,
    fontWeight: 'bold',
  },
  guideModalContent: {
    backgroundColor: '#fff',
    borderRadius: 22,
    borderWidth: GUIDE_BORDER_WIDTH,
    borderColor: '#fff',
    paddingTop: 16,
    paddingBottom: 14,
    overflow: 'hidden',
  },
  guideCloseButton: {
    position: 'absolute',
    top: 8,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  guideCloseText: {
    fontSize: 18,
    lineHeight: 20,
    color: '#888',
    fontWeight: 'bold',
  },
  guideSlide: {
    alignItems: 'center',
    paddingHorizontal: GUIDE_PADDING,
  },
  guideTitleBadge: {
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 14,
    marginBottom: 10,
    transform: [{ rotate: '-2deg' }],
  },
  guideTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  guideCaption: {
    fontSize: 17,
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 24,
  },
  guideNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingHorizontal: GUIDE_PADDING,
  },
  guideNavButton: {
    paddingVertical: 8,
    borderRadius: 18,
    minWidth: 64,
    alignItems: 'center',
  },
  guideNavNext: {
    backgroundColor: '#2a5298',
  },
  guideNavText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2a5298',
  },
  guideNavTextDisabled: {
    color: '#ccc',
  },
  guideNavNextText: {
    color: '#fff',
  },
  guideNavCloseText: {
    fontSize: 14,
  },
  guideIndicator: {
    alignItems: 'center',
    gap: 4,
  },
  guideDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  guideDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#ddd',
  },
  guideDotActive: {
    backgroundColor: '#2a5298',
    width: 18,
  },
  guidePageText: {
    fontSize: 11,
    color: '#999',
  },
});

// ガイド内モックアップ用スタイル
const g = StyleSheet.create({
  mockupImage: {
    borderRadius: 14,
    marginBottom: 10,
  },
});
