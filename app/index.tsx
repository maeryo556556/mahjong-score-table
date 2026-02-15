import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { initDatabase, getCurrentGame } from '../database';
import SetupScreen from '../screens/SetupScreen';
import GameScreen from '../screens/GameScreen';
import PastGamesScreen from '../screens/PastGamesScreen';

type Screen = 'setup' | 'game' | 'pastGames' | 'viewPastGame';

export default function Index() {
  const [screen, setScreen] = useState<Screen>('setup');
  const [currentGameId, setCurrentGameId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    initDatabase();
    const game = getCurrentGame();
    if (game) {
      setCurrentGameId(game.id);
      setScreen('game');
    }
    setIsLoading(false);
  }, []);

  const handleStartGame = (gameId: number) => {
    setCurrentGameId(gameId);
    setScreen('game');
  };

  const handleFinishGame = () => {
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
        <GameScreen gameId={currentGameId} onFinish={handleFinishGame} />
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
          onViewPastGames={handleViewPastGames}
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
