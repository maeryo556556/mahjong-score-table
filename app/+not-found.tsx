import { useLocalSearchParams, Redirect } from 'expo-router';

export default function NotFound() {
  const { code } = useLocalSearchParams<{ code?: string }>();

  // ディープリンク mahjong-score://import?code=... が unmatched route になった場合、
  // code パラメータがあれば /import ルートにリダイレクトして取り込み処理を行う
  if (code) {
    return <Redirect href={`/import?code=${encodeURIComponent(code)}`} />;
  }

  return <Redirect href="/" />;
}
