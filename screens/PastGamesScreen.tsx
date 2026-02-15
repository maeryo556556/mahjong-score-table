import React, { useState, useCallback } from 'react';
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
import { getFinishedGames, deleteGame } from '../database';

interface PastGamesScreenProps {
  onSelectGame: (gameId: number) => void;
  onBack: () => void;
}

export default function PastGamesScreen({ onSelectGame, onBack }: PastGamesScreenProps) {
  const [games, setGames] = useState(() => getFinishedGames());

  const refreshGames = useCallback(() => {
    setGames(getFinishedGames());
  }, []);

  const handleDeleteGame = (gameId: number, startDate: string) => {
    Alert.alert(
      'ゲーム削除',
      `${startDate} のゲームを削除しますか？\nこの操作は取り消せません。`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除',
          style: 'destructive',
          onPress: () => {
            deleteGame(gameId);
            refreshGames();
          },
        },
      ]
    );
  };

  return (
    <LinearGradient colors={['#1e3c72', '#2a5298']} style={styles.gradient}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>← 戻る</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>過去のゲーム</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {games.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>保存されたゲームはありません</Text>
            </View>
          ) : (
            games.map(game => (
              <TouchableOpacity
                key={game.id}
                style={styles.gameCard}
                onPress={() => onSelectGame(game.id)}
                onLongPress={() => handleDeleteGame(game.id, game.start_date)}
                delayLongPress={800}
              >
                <View style={styles.gameCardHeader}>
                  <Text style={styles.gameDate}>{game.start_date}</Text>
                  <Text style={styles.gameType}>
                    {game.player_count === 3 ? '🎴 3人麻雀' : '🀄 4人麻雀'}
                  </Text>
                </View>
                <View style={styles.gameCardBody}>
                  <Text style={styles.playerList}>
                    {game.playerNames.join(' / ')}
                  </Text>
                  <Text style={styles.hanchanInfo}>
                    {game.hanchanCount}半荘
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
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
  scrollContent: {
    padding: 16,
    paddingTop: 0,
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
  gameCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
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
  gameDate: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e3c72',
  },
  gameType: {
    fontSize: 13,
    color: '#6c757d',
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
  hanchanInfo: {
    fontSize: 13,
    color: '#6c757d',
    fontWeight: 'bold',
    marginLeft: 8,
  },
});
