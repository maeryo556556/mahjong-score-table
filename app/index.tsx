import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import * as Linking from 'expo-linking';
import { initDatabase, getCurrentGame, finishGame, importGameData } from '../database';
import { parseShareUrl } from '../utils';
import SetupScreen from '../screens/SetupScreen';
import GameScreen from '../screens/GameScreen';
import PastGamesScreen from '../screens/PastGamesScreen';

type Screen = 'setup' | 'game' | 'pastGames' | 'viewPastGame';

export default function Index() {
  const [screen, setScreen] = useState<Screen>('setup');
  const [currentGameId, setCurrentGameId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const doImportFromDeepLink = useCallback((code: string) => {
    try {
      const gameId = importGameData(code);
      setCurrentGameId(gameId);
      setScreen('viewPastGame');
      Alert.alert('取り込み完了', 'ゲームデータを取り込みました');
    } catch (e: any) {
      Alert.alert('取り込みエラー', e.message || '共有リンクの読み取りに失敗しました');
    }
  }, []);

  const handleDeepLink = useCallback((url: string) => {
    const code = parseShareUrl(url);
    if (!code) return;

    // ゲーム記録中の場合は確認ダイアログを表示
    const activeGame = getCurrentGame();
    if (activeGame) {
      Alert.alert(
        '確認',
        'ゲームが進行中です。\nゲームを中断して共有データを取り込みますか？',
        [
          { text: 'キャンセル', style: 'cancel' },
          {
            text: '中断して取り込む',
            onPress: () => {
              finishGame(activeGame.id);
              doImportFromDeepLink(code);
            },
          },
        ]
      );
      return;
    }

    doImportFromDeepLink(code);
  }, [doImportFromDeepLink]);

  useEffect(() => {
    initDatabase();
    const game = getCurrentGame();
    if (game) {
      setCurrentGameId(game.id);
      setScreen('game');
    }
    setIsLoading(false);

    // アプリ起動時のディープリンク（コールドスタート）
    Linking.getInitialURL().then(url => {
      if (url) handleDeepLink(url);
    });

    // アプリがバックグラウンドから復帰した時のディープリンク
    const subscription = Linking.addEventListener('url', (event) => {
      handleDeepLink(event.url);
    });
    return () => subscription.remove();
  }, [handleDeepLink]);

  const handleStartGame = (gameId: number) => {
    setCurrentGameId(gameId);
    setScreen('game');
  };

  const handleResumeGame = (gameId: number) => {
    setCurrentGameId(gameId);
    setScreen('game');
  };

  const handleFinishGame = () => {
    setCurrentGameId(null);
    setScreen('setup');
  };

  const handleSuspendGame = () => {
    setCurrentGameId(null);
    setScreen('setup');
  };

  const handleViewPastGames = () => {
    setScreen('pastGames');
  };

  const handleSelectPastGame = (gameId: number) => {
    setCurrentGameId(gameId);
    setScreen('viewPastGame');
  };

  const handleBackFromPastGame = () => {
    setCurrentGameId(null);
    setScreen('pastGames');
  };

  const handleBackFromPastGames = () => {
    setScreen('setup');
  };

  const handleImportGame = (gameId: number) => {
    setCurrentGameId(gameId);
    setScreen('viewPastGame');
  };

  if (isLoading) {
    return <View style={styles.container} />;
  }

  return (
    <View style={styles.container}>
      {screen === 'game' && currentGameId && (
        <GameScreen
          gameId={currentGameId}
          onFinish={handleFinishGame}
          onSuspend={handleSuspendGame}
        />
      )}
      {screen === 'viewPastGame' && currentGameId && (
        <GameScreen gameId={currentGameId} onFinish={handleBackFromPastGame} readOnly />
      )}
      {screen === 'pastGames' && (
        <PastGamesScreen
          onSelectGame={handleSelectPastGame}
          onBack={handleBackFromPastGames}
        />
      )}
      {screen === 'setup' && (
        <SetupScreen
          onStartGame={handleStartGame}
          onResumeGame={handleResumeGame}
          onViewPastGames={handleViewPastGames}
          onImportGame={handleImportGame}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
