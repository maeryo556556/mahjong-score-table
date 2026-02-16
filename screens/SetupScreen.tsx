import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { createGame, getFinishedGames, getUnfinishedGames, clearAllData, finishGame, deleteGame, importGameData } from '../database';

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
    const code = importCode.trim();
    if (!code) {
      Alert.alert('入力エラー', '共有コードを入力してください');
      return;
    }
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
            <Text style={styles.title}>🀄 麻雀</Text>
            <Text style={styles.subtitle}>得点記録システム</Text>
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

            <TouchableOpacity style={styles.startButton} onPress={handleStartGame}>
              <Text style={styles.startButtonText}>ゲーム開始</Text>
            </TouchableOpacity>

            {hasPastGames && (
              <TouchableOpacity
                style={[styles.startButton, styles.secondaryButton]}
                onPress={onViewPastGames}
              >
                <Text style={styles.startButtonText}>過去のゲームを見る</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.startButton, styles.importButton]}
              onPress={() => setShowImportModal(true)}
            >
              <Text style={styles.startButtonText}>ゲームを取り込む</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.startButton, styles.dangerButton]}
              onPress={handleClearData}
            >
              <Text style={styles.startButtonText}>保存データをクリア</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        <Modal visible={showImportModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.importModalContent}>
              <Text style={styles.importModalTitle}>ゲームを取り込む</Text>
              <Text style={styles.importModalDescription}>
                共有されたコードを貼り付けてください
              </Text>
              <TextInput
                style={styles.importCodeInput}
                value={importCode}
                onChangeText={setImportCode}
                placeholder="共有コードを貼り付け"
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
});
