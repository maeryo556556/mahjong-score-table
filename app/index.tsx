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
  // ライブ閲覧から戻る先（過去のゲーム一覧から入った場合は一覧へ戻す）
  const [liveReturnScreen, setLiveReturnScreen] = useState<'setup' | 'pastGames'>('setup');
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
      setLiveReturnScreen('setup');
      setScreen('liveView');
    }
  }, [liveCode]);

  const handleJoinLiveSession = (code: string) => {
    setLiveSessionCode(code);
    setLiveReturnScreen('setup');
    setScreen('liveView');
  };

  // 過去のゲーム一覧から、受信元セッションが有効な取り込み済みゲームを選んだ場合
  const handleJoinLiveSessionFromHistory = (code: string) => {
    setLiveSessionCode(code);
    setLiveReturnScreen('pastGames');
    setScreen('liveView');
  };

  const handleLeaveLiveSession = () => {
    setLiveSessionCode(null);
    setScreen(liveReturnScreen);
  };

  // 「ゲームを取り込む」で取り込み済みのコードが入力された場合、保存済みの対局を開く（Issue #72）
  const handleOpenImportedGame = (gameId: number) => {
    setLiveSessionCode(null);
    setCurrentGameId(gameId);
    setScreen('viewPastGame');
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
          onResumeLiveGame={handleResumeGame}
          onJoinLiveSession={handleJoinLiveSessionFromHistory}
        />
      )}
      {screen === 'setup' && (
        <SetupScreen
          onStartGame={handleStartGame}
          onResumeGame={handleResumeGame}
          onViewPastGames={handleViewPastGames}
          onJoinLiveSession={handleJoinLiveSession}
          onOpenImportedGame={handleOpenImportedGame}
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
