import { useState } from 'react';
import { View } from 'react-native';
import { Slot } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initDatabase } from '../database';

export default function RootLayout() {
  const [dbReady] = useState(() => {
    initDatabase();
    return true;
  });

  if (!dbReady) {
    return <View style={{ flex: 1 }} />;
  }

  return (
    <SafeAreaProvider>
      <Slot />
    </SafeAreaProvider>
  );
}
