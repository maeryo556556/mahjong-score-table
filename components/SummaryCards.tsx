import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface SummaryCardsProps {
  players: string[];
  scoreHistory: any[];
  chipHistory: any[];
  playerCount: number;
}

export default function SummaryCards({
  players,
  scoreHistory,
  chipHistory,
  playerCount,
}: SummaryCardsProps) {
  const getSummary = (player: string) => {
    const scores = scoreHistory.filter(s => s.player_name === player);
    const scoreTotal = scores.reduce((sum, s) => sum + s.point, 0);

    const chips = chipHistory.filter(c => c.player_name === player);
    const chipTotal = chips.reduce((sum, c) => sum + c.chip_point, 0);

    const rankCounts: Record<number, number> = {};
    for (let i = 1; i <= playerCount; i++) {
      rankCounts[i] = 0;
    }
    scores.forEach(s => {
      rankCounts[s.rank] = (rankCounts[s.rank] || 0) + 1;
    });

    return {
      total: scoreTotal + chipTotal,
      chipTotal,
      rankCounts,
    };
  };

  const getRankBadgeColor = (rank: number) => {
    switch (rank) {
      case 1: return '#FFD700';
      case 2: return '#C0C0C0';
      case 3: return '#CD7F32';
      default: return '#95a5a6';
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>総合スコア</Text>
      <View style={styles.grid}>
        {players.map((player, index) => {
          const summary = getSummary(player);
          return (
            <View key={index} style={styles.summaryCard}>
              <Text style={styles.playerName}>{player}</Text>
              <Text
                style={[
                  styles.total,
                  summary.total > 0 ? styles.positive : summary.total < 0 ? styles.negative : styles.neutral,
                ]}
              >
                {summary.total > 0 ? '+' : ''}{summary.total}
              </Text>
              <View style={styles.rankBadges}>
                {Object.keys(summary.rankCounts).map(rank => {
                  const r = parseInt(rank);
                  const count = summary.rankCounts[r];
                  return (
                    <View
                      key={r}
                      style={[
                        styles.rankBadge,
                        { backgroundColor: getRankBadgeColor(r) },
                      ]}
                    >
                      <Text style={styles.rankBadgeText}>
                        {r}位 × {count}
                      </Text>
                    </View>
                  );
                })}
              </View>
              {summary.chipTotal !== 0 && (
                <Text style={styles.chipInfo}>
                  チップ: {summary.chipTotal > 0 ? '+' : ''}{summary.chipTotal}
                </Text>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  summaryCard: {
    width: '48%',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    borderWidth: 2,
    borderColor: '#dee2e6',
  },
  playerName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 6,
  },
  total: {
    fontSize: 20,
    fontWeight: 'bold',
    marginVertical: 6,
  },
  positive: {
    color: '#28a745',
  },
  negative: {
    color: '#dc3545',
  },
  neutral: {
    color: '#6c757d',
  },
  rankBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 6,
  },
  rankBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
  },
  rankBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  chipInfo: {
    fontSize: 11,
    color: '#6c757d',
    marginTop: 6,
  },
});
