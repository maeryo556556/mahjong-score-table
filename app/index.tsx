import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { getCurrentGame } from '../database';
import SetupScreen from '../screens/SetupScreen';
import GameScreen from '../screens/GameScreen';
import PastGamesScreen from '../screens/PastGamesScreen';

type Screen = 'setup' | 'game' | 'pastGames' | 'viewPastGame' | 'liveView';

export default function Index() {
  const { liveCode } = useLocalSearchParams<{ liveCode?: string }>();
  const [screen, setScreen] = useState<Screen>('setup');
  const [currentGameId, setCurrentGameId] = useState<number | null>(null);
  const [liveSessionCode, setLiveSessionCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const game = getCurrentGame();
    if (game) {
      setCurrentGameId(game.id);
      setScreen('game');
    }
    setIsLoading(false);
  }, []);

  // セッションリンク経由の参加: _layout.tsx から liveCode 付きでリダイレクトされる
  useEffect(() => {
    if (liveCode) {
      setLiveSessionCode(liveCode);
      setScreen('liveView');
    }
  }, [liveCode]);

  const handleJoinLiveSession = (code: string) => {
    setLiveSessionCode(code);
    setScreen('liveView');
  };

  const handleLeaveLiveSession = () => {
    setLiveSessionCode(null);
    setScreen('setup');
  };

  const handleSavedLiveGame = (gameId: number) => {
    setLiveSessionCode(null);
    setCurrentGameId(gameId);
    setScreen('viewPastGame');
  };

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
      {screen === 'liveView' && liveSessionCode && (
        <GameScreen
          key={liveSessionCode}
          liveSessionCode={liveSessionCode}
          onFinish={handleLeaveLiveSession}
          onSavedLiveGame={handleSavedLiveGame}
        />
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
          onJoinLiveSession={handleJoinLiveSession}
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
