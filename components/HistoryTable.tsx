import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

interface HistoryTableProps {
  players: string[];
  scoreHistory: any[];
  chipHistory: any[];
  gameStartDate: string;
  onDeleteScore?: (hanchan: number) => void;
  onDeleteChip?: (chipIds: number[]) => void;
}

export default function HistoryTable({
  players,
  scoreHistory,
  chipHistory,
  gameStartDate,
  onDeleteScore,
  onDeleteChip,
}: HistoryTableProps) {
  // スコアとチップを統合してタイムスタンプでソート
  const allRecords: Array<{
    type: 'score' | 'chip';
    data: any;
    timestamp: number;
  }> = [];

  // 半荘ごとにグループ化
  const hanchanGroups: Record<number, any> = {};
  scoreHistory.forEach(score => {
    if (!hanchanGroups[score.hanchan]) {
      hanchanGroups[score.hanchan] = {
        scores: [],
        timestamp: score.timestamp,
        formattedTime: score.formatted_time,
      };
    }
    hanchanGroups[score.hanchan].scores.push(score);
  });

  Object.keys(hanchanGroups).forEach(hanchan => {
    allRecords.push({
      type: 'score',
      data: { hanchan: parseInt(hanchan), ...hanchanGroups[hanchan] },
      timestamp: hanchanGroups[hanchan].timestamp,
    });
  });

  // チップをtimestampでグループ化
  const chipGroups: Record<number, any[]> = {};
  chipHistory.forEach(chip => {
    if (!chipGroups[chip.timestamp]) {
      chipGroups[chip.timestamp] = [];
    }
    chipGroups[chip.timestamp].push(chip);
  });

  Object.keys(chipGroups).forEach(ts => {
    const chips = chipGroups[Number(ts)];
    allRecords.push({
      type: 'chip',
      data: {
        chips,
        hanchan: chips[0].hanchan,
        formatted_time: chips[0].formatted_time,
        timestamp: chips[0].timestamp,
      },
      timestamp: chips[0].timestamp,
    });
  });

  allRecords.sort((a, b) => b.timestamp - a.timestamp);

  const editable = !!(onDeleteScore || onDeleteChip);

  const getRankBadgeColor = (rank: number) => {
    switch (rank) {
      case 1: return '#FFD700';
      case 2: return '#C0C0C0';
      case 3: return '#CD7F32';
      default: return '#95a5a6';
    }
  };

  const ScoreRow = editable ? TouchableOpacity : View;
  const ChipRow = editable ? TouchableOpacity : View;

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>記録履歴（{gameStartDate}）</Text>
      {onDeleteScore && (
        <Text style={styles.hintText}>※ 長押しで記録を削除できます</Text>
      )}
      {allRecords.map((record, index) => {
        if (record.type === 'score') {
          const { hanchan, scores, formattedTime } = record.data;
          return (
            <ScoreRow
              key={`score-${index}`}
              style={styles.historyRow}
              {...(onDeleteScore && {
                onLongPress: () => onDeleteScore(hanchan),
                delayLongPress: 800,
              })}
            >
              <View style={styles.historyHeader}>
                <Text style={styles.hanchanText}>第{hanchan}半荘</Text>
                <Text style={styles.timeText}>{formattedTime}</Text>
              </View>
              <View style={styles.scoreGrid}>
                {players.map(player => {
                  const score = scores.find((s: any) => s.player_name === player);
                  if (!score) return null;
                  return (
                    <View key={player} style={styles.scoreCell}>
                      <Text style={styles.playerNameSmall}>{player}</Text>
                      <View
                        style={[
                          styles.rankBadge,
                          { backgroundColor: getRankBadgeColor(score.rank) },
                        ]}
                      >
                        <Text style={styles.rankBadgeText}>{score.rank}位</Text>
                      </View>
                      <Text style={styles.pointText}>
                        {score.point > 0 ? '+' : ''}{score.point}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </ScoreRow>
          );
        } else {
          const { chips, formatted_time } = record.data;
          return (
            <ChipRow
              key={`chip-${index}`}
              style={[styles.historyRow, styles.chipRow]}
              {...(onDeleteChip && {
                onLongPress: () => onDeleteChip(chips.map((c: any) => c.id)),
                delayLongPress: 800,
              })}
            >
              <View style={styles.historyHeader}>
                <Text style={[styles.hanchanText, styles.chipText]}>🎉 チップ</Text>
                <Text style={[styles.timeText, styles.chipText]}>{formatted_time}</Text>
              </View>
              <View style={styles.chipGrid}>
                {players.map(player => {
                  const playerChip = chips.find(
                    (c: any) => c.player_name === player
                  );
                  const value = playerChip?.chip_point || 0;
                  return (
                    <View key={player} style={styles.chipCell}>
                      <Text style={styles.playerNameSmall}>{player}</Text>
                      <Text
                        style={[
                          styles.chipValue,
                          value > 0 ? styles.positive : value < 0 ? styles.negative : styles.neutral,
                        ]}
                      >
                        {value > 0 ? '+' : ''}{value}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </ChipRow>
          );
        }
      })}
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
    marginBottom: 4,
    borderBottomWidth: 2,
    borderBottomColor: '#2a5298',
    paddingBottom: 6,
  },
  hintText: {
    fontSize: 11,
    color: '#999',
    marginBottom: 10,
  },
  historyRow: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  chipRow: {
    backgroundColor: '#fff3cd',
    borderColor: '#ffc107',
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  hanchanText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  chipText: {
    color: '#856404',
  },
  timeText: {
    fontSize: 11,
    color: '#6c757d',
  },
  scoreGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  scoreCell: {
    width: '23%',
    alignItems: 'center',
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chipCell: {
    width: '23%',
    alignItems: 'center',
  },
  playerNameSmall: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#555',
    marginBottom: 4,
  },
  rankBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginBottom: 4,
  },
  rankBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  pointText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#333',
  },
  chipValue: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  positive: {
    color: '#28a745',
  },
  negative: {
    color: '#dc3545',
  },
  neutral: {
    color: '#999',
  },
});
