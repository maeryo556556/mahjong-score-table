import { useState, useEffect, useCallback } from 'react';
import { View, Alert } from 'react-native';
import { Slot, router } from 'expo-router';
import * as Linking from 'expo-linking';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initDatabase, getCurrentGame, finishGame, importGameData } from '../database';
import { parseShareUrl } from '../utils';

export default function RootLayout() {
  const [dbReady] = useState(() => {
    initDatabase();
    return true;
  });

  const doImport = useCallback((shareCode: string) => {
    try {
      const gameId = importGameData(shareCode);
      Alert.alert('取り込み完了', 'ゲームデータを取り込みました', [
        { text: 'OK', onPress: () => router.replace({ pathname: '/', params: { viewGameId: String(gameId) } }) },
      ]);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '共有リンクの読み取りに失敗しました';
      Alert.alert('取り込みエラー', message, [
        { text: 'OK', onPress: () => router.replace('/') },
      ]);
    }
  }, []);

  const handleDeepLink = useCallback((url: string) => {
    const code = parseShareUrl(url);
    if (!code) return;

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
              doImport(code);
            },
          },
        ]
      );
    } else {
      doImport(code);
    }
  }, [doImport]);

  useEffect(() => {
    // コールドスタート時のディープリンク
    Linking.getInitialURL().then(url => {
      if (url) handleDeepLink(url);
    });

    // バックグラウンド復帰時のディープリンク
    const subscription = Linking.addEventListener('url', (event) => {
      handleDeepLink(event.url);
    });
    return () => subscription.remove();
  }, [handleDeepLink]);

  if (!dbReady) {
    return <View style={{ flex: 1 }} />;
  }

  return (
    <SafeAreaProvider>
      <Slot />
    </SafeAreaProvider>
  );
}
