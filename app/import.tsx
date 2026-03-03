import { useEffect } from 'react';
import { View, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { getCurrentGame, finishGame, importGameData } from '../database';

export default function ImportRoute() {
  const { code } = useLocalSearchParams<{ code: string }>();

  useEffect(() => {
    if (!code) {
      router.replace('/');
      return;
    }

    const activeGame = getCurrentGame();
    if (activeGame) {
      Alert.alert(
        '確認',
        'ゲームが進行中です。\nゲームを中断して共有データを取り込みますか？',
        [
          { text: 'キャンセル', style: 'cancel', onPress: () => router.replace('/') },
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
  }, [code]);

  function doImport(shareCode: string) {
    try {
      const gameId = importGameData(shareCode);
      Alert.alert('取り込み完了', 'ゲームデータを取り込みました', [
        { text: 'OK', onPress: () => router.replace({ pathname: '/', params: { viewGameId: String(gameId) } }) },
      ]);
    } catch (e: any) {
      Alert.alert('取り込みエラー', e.message || '共有リンクの読み取りに失敗しました', [
        { text: 'OK', onPress: () => router.replace('/') },
      ]);
    }
  }

  return <View style={{ flex: 1, backgroundColor: '#1a1a2e' }} />;
}
