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
import { getFinishedGames, getUnfinishedGames, deleteGame } from '../database';
import { isLocalSessionActive } from '../liveSession';

interface PastGamesScreenProps {
  onSelectGame: (gameId: number) => void;
  onBack: () => void;
  /** ホストとしてライブ共有中の（未終了の）ゲームを開く */
  onResumeLiveGame: (gameId: number) => void;
  /** 取り込んだゲームの受信元セッションがまだ有効な場合、ライブ閲覧に入る */
  onJoinLiveSession: (code: string) => void;
}

type ListGame = ReturnType<typeof getUnfinishedGames>[number] & { imported?: number };

const isActive = (game: ListGame, now: number) =>
  isLocalSessionActive(game.live_session_code, game.live_session_expires_at, now);

// ライブ共有中のゲーム（ホストとして共有中の進行中ゲーム）を先頭に、続けて終了済みゲームを並べる
const loadGames = () => {
  const now = Date.now();
  const liveHostGames: ListGame[] = getUnfinishedGames().filter(g => isActive(g, now));
  const finishedGames: ListGame[] = getFinishedGames();
  return { liveHostGames, finishedGames };
};

export default function PastGamesScreen({ onSelectGame, onBack, onResumeLiveGame, onJoinLiveSession }: PastGamesScreenProps) {
  const [{ liveHostGames, finishedGames }, setGames] = useState(loadGames);
  const games = [...liveHostGames, ...finishedGames];
  const liveHostIds = new Set(liveHostGames.map(g => g.id));

  const refreshGames = useCallback(() => {
    setGames(loadGames());
  }, []);

  const handlePressGame = (game: ListGame) => {
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
            games.map(game => {
              const isHostLive = liveHostIds.has(game.id);
              const live = isActive(game, Date.now());
              return (
                <TouchableOpacity
                  key={game.id}
                  style={[styles.gameCard, live && styles.gameCardLive]}
                  onPress={() => handlePressGame(game)}
                  // 進行中のゲームはここからは削除させない
                  onLongPress={isHostLive ? undefined : () => handleDeleteGame(game.id, game.start_date)}
                  delayLongPress={800}
                >
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
              );
            })
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
    borderWidth: 2,
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
