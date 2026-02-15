import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
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
} from '../database';
import DrumRollInput from '../components/DrumRollInput';
import HistoryTable from '../components/HistoryTable';
import SummaryCards from '../components/SummaryCards';
import FinishGameModal from '../components/FinishGameModal';

interface GameScreenProps {
  gameId: number;
  onFinish: () => void;
  readOnly?: boolean;
}

export default function GameScreen({ gameId, onFinish, readOnly = false }: GameScreenProps) {
  const [players, setPlayers] = useState<string[]>([]);
  const [playerCount, setPlayerCount] = useState(4);
  const [currentHanchan, setCurrentHanchan] = useState(1);
  const [gameStartDate, setGameStartDate] = useState('');
  const [scoreValues, setScoreValues] = useState<number[]>([0, 0, 0, 0]);
  const [chipValues, setChipValues] = useState<number[]>([0, 0, 0, 0]);
  const [scoreHistory, setScoreHistory] = useState<any[]>([]);
  const [chipHistory, setChipHistory] = useState<any[]>([]);
  const [showFinishModal, setShowFinishModal] = useState(false);

  useEffect(() => {
    loadGameData();
  }, [gameId]);

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
          },
        },
      ]
    );
  };

  const handleFinishGame = () => {
    setShowFinishModal(true);
  };

  const confirmFinishGame = () => {
    // 記録がない場合はゲームデータ自体を削除
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
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* ヘッダー */}
          <View style={styles.header}>
            {readOnly ? (
              <>
                <TouchableOpacity style={styles.backButton} onPress={onFinish}>
                  <Text style={styles.backButtonText}>← 戻る</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{gameStartDate}</Text>
                <View style={styles.headerSpacer} />
              </>
            ) : (
              <>
                <Text style={styles.headerTitle}>第{currentHanchan}半荘</Text>
                <TouchableOpacity style={styles.finishButton} onPress={handleFinishGame}>
                  <Text style={styles.finishButtonText}>ゲーム終了</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {!readOnly && (
            <>
              {/* ポイント入力 */}
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>🀄 ポイント入力</Text>
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
                <TouchableOpacity style={[styles.recordButton, styles.scoreButton]} onPress={handleRecordScore}>
                  <Text style={styles.recordButtonText}>スコアを記録</Text>
                </TouchableOpacity>
              </View>

              {/* チップ移動 */}
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>💰 チップ移動</Text>
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
                <TouchableOpacity
                  style={[styles.recordButton, styles.chipButton]}
                  onPress={handleRecordChip}
                >
                  <Text style={styles.recordButtonText}>チップを記録</Text>
                </TouchableOpacity>
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e3c72',
    marginBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#2a5298',
    paddingBottom: 6,
  },
  inputGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  recordButton: {
    backgroundColor: '#2a5298',
    borderRadius: 6,
    padding: 12,
    alignItems: 'center',
    marginTop: 12,
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
});
