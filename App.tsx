import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initDatabase, getCurrentGame } from './database';
import SetupScreen from './screens/SetupScreen';
import GameScreen from './screens/GameScreen';

export default function App() {
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
    <SafeAreaProvider>
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
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
