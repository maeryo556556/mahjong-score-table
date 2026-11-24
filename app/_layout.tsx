import { useState, useEffect, useCallback } from 'react';
import { View } from 'react-native';
import { Slot, router } from 'expo-router';
import * as Linking from 'expo-linking';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initDatabase } from '../database';
import { parseSessionUrl } from '../liveSession';

export default function RootLayout() {
  const [dbReady] = useState(() => {
    initDatabase();
    return true;
  });

  const handleDeepLink = useCallback((url: string) => {
    // リアルタイム共有のセッションリンク: 閲覧のみでローカルデータは変更しないため確認不要
    // それ以外（廃止した静的共有の mahjong-score://import?code=… を含む）は無視する
    const sessionCode = parseSessionUrl(url);
    if (sessionCode) {
      router.replace({ pathname: '/', params: { liveCode: sessionCode } });
    }
  }, []);

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
