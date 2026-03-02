import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import * as Linking from 'expo-linking';
import { initDatabase, getCurrentGame, importGameData } from '../database';
import { parseShareUrl } from '../utils';
import SetupScreen from '../screens/SetupScreen';
import GameScreen from '../screens/GameScreen';
import PastGamesScreen from '../screens/PastGamesScreen';

type Screen = 'setup' | 'game' | 'pastGames' | 'viewPastGame';

export default function Index() {
  const [screen, setScreen] = useState<Screen>('setup');
  const [currentGameId, setCurrentGameId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const handleDeepLink = useCallback((url: string) => {
    const code = parseShareUrl(url);
    if (!code) return;
    try {
      const gameId = importGameData(code);
      setCurrentGameId(gameId);
      setScreen('viewPastGame');
      Alert.alert('取り込み完了', 'ゲームデータを取り込みました');
    } catch (e: any) {
      Alert.alert('取り込みエラー', e.message || '共有リンクの読み取りに失敗しました');
    }
  }, []);

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
