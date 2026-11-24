import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { GoalFlagIcon, MedalIcon } from './icons/HandDrawnIcons';

interface FinishGameModalProps {
  visible: boolean;
  players: string[];
  scoreHistory: any[];
  chipHistory: any[];
  playerCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function FinishGameModal({
  visible,
  players,
  scoreHistory,
  chipHistory,
  playerCount,
  onConfirm,
  onCancel,
}: FinishGameModalProps) {
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
      player,
      total: scoreTotal + chipTotal,
      rankCounts,
    };
  };

  const summaries = players.map(getSummary).sort((a, b) => b.total - a.total);

  // 上位3人には手書き風のメダルを表示（Issue #62）
  const renderMedal = (index: number) =>
    index < 3 ? <MedalIcon rank={(index + 1) as 1 | 2 | 3} size={18} /> : null;

  const getBorderColor = (index: number) => {
    switch (index) {
      case 0: return '#ffc107';
      case 1: return '#c0c0c0';
      case 2: return '#cd7f32';
      default: return '#dee2e6';
    }
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
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <GoalFlagIcon size={40} style={styles.icon} />
            <Text style={styles.title}>ゲーム終了</Text>
          </View>

          <View style={styles.body}>
            <Text style={styles.message}>
              ゲームを終了して最初の画面に戻りますか？{'\n'}
              記録は保存されます。
            </Text>

            <ScrollView style={styles.summaryContainer}>
              {summaries.map((summary, index) => (
                <View
                  key={summary.player}
                  style={[
                    styles.summaryRow,
                    { borderLeftColor: getBorderColor(index) },
                    index === 0 && styles.firstPlace,
                  ]}
                >
                  <View style={styles.summaryLeft}>
                    <View style={styles.playerNameRow}>
                      {renderMedal(index)}
                      <Text style={styles.playerName}>{summary.player}</Text>
                    </View>
                    <View style={styles.rankBadges}>
                      {Object.keys(summary.rankCounts).map(rank => {
                        const r = parseInt(rank);
                        const count = summary.rankCounts[r];
                        if (count === 0) return null;
                        return (
                          <View
                            key={r}
                            style={[
                              styles.rankBadge,
                              { backgroundColor: getRankBadgeColor(r) },
                            ]}
                          >
                            <Text style={styles.rankBadgeText}>
                              {r}位×{count}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                  <Text
                    style={[
                      styles.totalScore,
                      summary.total > 0
                        ? styles.positive
                        : summary.total < 0
                        ? styles.negative
                        : styles.neutral,
                    ]}
                  >
                    {summary.total > 0 ? '+' : ''}{summary.total}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onCancel}
            >
              <Text style={styles.buttonText}>キャンセル</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.confirmButton]}
              onPress={onConfirm}
            >
              <Text style={styles.buttonText}>終了する</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '100%',
    maxWidth: 450,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  header: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: '#dee2e6',
  },
  icon: {
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  body: {
    padding: 20,
  },
  message: {
    fontSize: 14,
    color: '#555',
    textAlign: 'center',
    marginBottom: 16,
  },
  summaryContainer: {
    maxHeight: 300,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 6,
    borderLeftWidth: 3,
    padding: 10,
    marginBottom: 8,
  },
  firstPlace: {
    backgroundColor: '#fffbea',
  },
  summaryLeft: {
    flex: 1,
  },
  playerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  playerName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    flexShrink: 1,
  },
  rankBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  rankBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  rankBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: 'bold',
  },
  totalScore: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
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
  footer: {
    flexDirection: 'row',
    gap: 10,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#dee2e6',
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#6c757d',
  },
  confirmButton: {
    backgroundColor: '#dc3545',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
