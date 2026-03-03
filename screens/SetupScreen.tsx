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
  Dimensions,
  FlatList,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { createGame, getFinishedGames, getUnfinishedGames, clearAllData, finishGame, deleteGame, importGameData } from '../database';
import { parseShareUrl } from '../utils';

interface SetupScreenProps {
  onStartGame: (gameId: number) => void;
  onResumeGame: (gameId: number) => void;
  onViewPastGames: () => void;
  onImportGame: (gameId: number) => void;
}

export default function SetupScreen({ onStartGame, onResumeGame, onViewPastGames, onImportGame }: SetupScreenProps) {
  const [playerCount, setPlayerCount] = useState(4);
  const [playerNames, setPlayerNames] = useState(['', '', '', '']);
  const [hasPastGames, setHasPastGames] = useState(false);
  const [suspendedGames, setSuspendedGames] = useState<ReturnType<typeof getUnfinishedGames>>([]);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importCode, setImportCode] = useState('');
  const [showGuide, setShowGuide] = useState(false);
  const [guideIndex, setGuideIndex] = useState(0);
  const guideListRef = useRef<FlatList>(null);

  const guideSlides = [
    {
      title: 'ゲームの始め方',
      steps: [
        '3人麻雀 or 4人麻雀を選択',
        'プレイヤー名を入力（4文字以内）',
        '「ゲーム開始」をタップ',
      ],
    },
    {
      title: 'スコアの記録',
      steps: [
        'ドラムロールで各プレイヤーのポイントを入力',
        '合計が ±0 になるよう調整',
        '「スコアを記録」で保存',
      ],
    },
    {
      title: 'チップの記録',
      steps: [
        'チップ移動がある場合に入力',
        'こちらも合計 ±0 が必要',
        '「チップを記録」で保存',
      ],
    },
    {
      title: 'ゲームの中断・終了',
      steps: [
        '「中断」でゲームを一時保存（後で再開可能）',
        '「ゲーム終了」で最終結果を確定',
        '記録の長押しで個別削除も可能',
      ],
    },
    {
      title: 'ゲームの共有',
      steps: [
        '過去のゲーム画面で「共有」をタップ',
        '共有コードを相手に送信',
        '相手は「ゲームを取り込む」からコードを入力',
      ],
    },
  ];

  const mockupImages = [
    require('../assets/iphone/promo_1_setup.png'),
    require('../assets/iphone/promo_2_score.png'),
    require('../assets/iphone/promo_3_chip.png'),
    require('../assets/iphone/promo_4_summary.png'),
    require('../assets/iphone/promo_5_past_games.png'),
    require('../assets/iphone/promo_6_share.png'),
  ];

  const guideMockups: React.ReactNode[] = mockupImages.map((src, i) => (
    <Image
      key={i}
      source={src}
      style={g.mockupImage}
      resizeMode="contain"
    />
  ));

  useEffect(() => {
    const finished = getFinishedGames();
    setHasPastGames(finished.length > 0);
    setSuspendedGames(getUnfinishedGames());
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

    if (names.some(name => name.length > 4)) {
      Alert.alert('入力エラー', 'プレイヤー名は4文字以内で入力してください');
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
      Alert.alert('入力エラー', '共有リンクまたはコードを入力してください');
      return;
    }
    // URLからコード部分を抽出、URLでなければそのまま使用
    const code = parseShareUrl(rawInput) || rawInput;
    try {
      const gameId = importGameData(code);
      setShowImportModal(false);
      setImportCode('');
      setHasPastGames(true);
      Alert.alert('完了', 'ゲームデータを取り込みました', [
        { text: '閲覧する', onPress: () => onImportGame(gameId) },
        { text: 'OK' },
      ]);
    } catch (e: any) {
      Alert.alert('エラー', e.message || '共有コードの読み取りに失敗しました');
    }
  };

  const handleClearData = () => {
    Alert.alert(
      'データ削除',
      '保存されているゲームデータを削除しますか？\nこの操作は取り消せません。',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除',
          style: 'destructive',
          onPress: () => {
            clearAllData();
            setHasPastGames(false);
            setSuspendedGames([]);
            Alert.alert('完了', 'データをクリアしました');
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
            <Text style={styles.title}>🀄 麻雀</Text>
            <Text style={styles.subtitle}>スコアシートモバイル</Text>
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
            <Text style={styles.sectionTitle}>ゲーム設定</Text>

            {/* 麻雀タイプ選択 */}
            <View style={styles.typeSelection}>
              <Text style={styles.label}>麻雀タイプ</Text>
              <View style={styles.typeButtons}>
                <TouchableOpacity
                  style={[styles.typeButton, playerCount === 4 && styles.typeButtonActive]}
                  onPress={() => handlePlayerCountChange(4)}
                >
                  <Text style={styles.typeButtonIcon}>🀄</Text>
                  <Text style={[styles.typeButtonText, playerCount === 4 && styles.typeButtonTextActive]}>
                    4人麻雀
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.typeButton, playerCount === 3 && styles.typeButtonActive]}
                  onPress={() => handlePlayerCountChange(3)}
                >
                  <Text style={styles.typeButtonIcon}>🎴</Text>
                  <Text style={[styles.typeButtonText, playerCount === 3 && styles.typeButtonTextActive]}>
                    3人麻雀
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* プレイヤー名入力 */}
            <Text style={styles.label}>プレイヤー設定</Text>
            <Text style={styles.hintText}>※ 4文字以内で入力してください</Text>
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

          <View style={[styles.card, styles.cardWithMarginTop]}>
            <Text style={styles.sectionTitle}>過去のゲーム履歴管理</Text>

            {hasPastGames && (
              <TouchableOpacity
                style={[styles.startButton, styles.secondaryButton]}
                onPress={onViewPastGames}
              >
                <Text style={styles.startButtonText}>過去のゲームを見る</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.startButton, styles.importButton, hasPastGames && styles.buttonMarginTop]}
              onPress={() => setShowImportModal(true)}
            >
              <Text style={styles.startButtonText}>ゲームを取り込む</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.startButton, styles.dangerButton, styles.buttonMarginTop]}
              onPress={handleClearData}
            >
              <Text style={styles.startButtonText}>保存データをクリア</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        <Modal visible={showImportModal} transparent animationType="fade">
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <View style={styles.importModalContent}>
              <Text style={styles.importModalTitle}>ゲームを取り込む</Text>
              <Text style={styles.importModalDescription}>
                共有されたリンクまたはコードを貼り付けてください
              </Text>
              <TextInput
                style={styles.importCodeInput}
                value={importCode}
                onChangeText={setImportCode}
                placeholder="共有リンクまたはコードを貼り付け"
                multiline
                autoFocus
              />
              <View style={styles.importModalButtons}>
                <TouchableOpacity
                  style={[styles.importModalButton, styles.importModalSubmitButton]}
                  onPress={handleImport}
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

        <Modal visible={showGuide} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.guideModalContent}>
              <FlatList
                ref={guideListRef}
                data={guideSlides}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                scrollEnabled={false}
                keyExtractor={(_, i) => String(i)}
                renderItem={({ item, index }) => (
                  <View style={styles.guideSlide}>
                    <Text style={styles.guideTitle}>{item.title}</Text>
                    {guideMockups[index]}
                    <View style={styles.guideSteps}>
                      {item.steps.map((step, i) => (
                        <View key={i} style={styles.guideStepRow}>
                          <View style={styles.guideStepBadge}>
                            <Text style={styles.guideStepBadgeText}>{i + 1}</Text>
                          </View>
                          <Text style={styles.guideStepText}>{step}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              />
              <View style={styles.guideDots}>
                {guideSlides.map((_, i) => (
                  <View
                    key={i}
                    style={[styles.guideDot, i === guideIndex && styles.guideDotActive]}
                  />
                ))}
              </View>
              <View style={styles.guideNav}>
                {guideIndex > 0 ? (
                  <TouchableOpacity
                    style={styles.guideNavButton}
                    onPress={() => {
                      const next = guideIndex - 1;
                      setGuideIndex(next);
                      guideListRef.current?.scrollToIndex({ index: next, animated: true });
                    }}
                  >
                    <Text style={styles.guideNavText}>← 前へ</Text>
                  </TouchableOpacity>
                ) : <View style={styles.guideNavButton} />}
                {guideIndex < guideSlides.length - 1 ? (
                  <TouchableOpacity
                    style={[styles.guideNavButton, styles.guideNavNext]}
                    onPress={() => {
                      const next = guideIndex + 1;
                      setGuideIndex(next);
                      guideListRef.current?.scrollToIndex({ index: next, animated: true });
                    }}
                  >
                    <Text style={[styles.guideNavText, styles.guideNavNextText]}>次へ →</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.guideNavButton, styles.guideNavClose]}
                    onPress={() => setShowGuide(false)}
                  >
                    <Text style={[styles.guideNavText, styles.guideNavNextText]}>閉じる</Text>
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
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#fff',
    marginTop: 8,
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
    fontSize: 24,
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
  dangerButton: {
    backgroundColor: '#dc3545',
  },
  startButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  importButton: {
    backgroundColor: '#17a2b8',
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
  importCodeInput: {
    borderWidth: 2,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 12,
    fontFamily: 'monospace',
    minHeight: 100,
    maxHeight: 200,
    textAlignVertical: 'top',
    marginBottom: 16,
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
    borderRadius: 16,
    padding: 24,
    width: '100%',
    overflow: 'hidden',
  },
  guideSlide: {
    width: Dimensions.get('window').width - 96,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  guideTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e3c72',
    marginBottom: 12,
  },
  guideSteps: {
    width: '100%',
    gap: 10,
  },
  guideStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  guideStepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2a5298',
    justifyContent: 'center',
    alignItems: 'center',
  },
  guideStepBadgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  guideStepText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  guideDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
    marginBottom: 16,
  },
  guideDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ddd',
  },
  guideDotActive: {
    backgroundColor: '#2a5298',
    width: 20,
  },
  guideNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  guideNavButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 90,
    alignItems: 'center',
  },
  guideNavNext: {
    backgroundColor: '#2a5298',
  },
  guideNavClose: {
    backgroundColor: '#2a5298',
  },
  guideNavText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#2a5298',
  },
  guideNavNextText: {
    color: '#fff',
  },
});

// ガイド内モックアップ用スタイル
const g = StyleSheet.create({
  mockupImage: {
    width: '85%',
    height: undefined,
    aspectRatio: 1242 / 2688,
    borderRadius: 12,
    marginBottom: 14,
  },
});
