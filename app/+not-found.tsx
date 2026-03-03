import { Redirect } from 'expo-router';

export default function NotFound() {
  // ディープリンク等で unmatched route になった場合、ホーム画面にリダイレクト
  // （ディープリンクの取り込み処理は _layout.tsx の Linking ハンドラで行う）
  return <Redirect href="/" />;
}
