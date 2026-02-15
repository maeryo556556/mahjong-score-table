import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { initDatabase, getCurrentGame } from '../database';
import SetupScreen from '../screens/SetupScreen';
import GameScreen from '../screens/GameScreen';

export default function Index() {
  const [currentGameId, setCurrentGameId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    initDatabase();
    const game = getCurrentGame();
    if (game) {
      setCurrentGameId(game.id);
    }
    setIsLoading(false);
  }, []);

  const handleStartGame = (gameId: number) => {
    setCurrentGameId(gameId);
  };

  const handleFinishGame = () => {
    setCurrentGameId(null);
  };

  if (isLoading) {
    return <View style={styles.container} />;
  }

  return (
    <View style={styles.container}>
      {currentGameId ? (
        <GameScreen
          gameId={currentGameId}
          onFinish={handleFinishGame}
        />
      ) : (
        <SetupScreen onStartGame={handleStartGame} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
