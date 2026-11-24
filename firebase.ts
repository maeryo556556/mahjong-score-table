/**
 * Firebase 初期化とリアルタイム共有セッションの Firestore 実装
 *
 * 設定値はクライアント向けの公開識別子（秘密情報ではない）。
 * アクセス制御は firestore.rules（匿名認証 + ホストのみ書き込み可）で行う。
 */
import { Platform } from 'react-native';
import { initializeApp, getApps, getApp } from 'firebase/app';
import type { FirebaseApp } from 'firebase/app';
import { getAuth, initializeAuth, signInAnonymously } from 'firebase/auth';
import type { Auth, Persistence } from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import type { Firestore, DocumentData } from 'firebase/firestore';
import { createLiveSessionService, SESSIONS_COLLECTION } from './liveSession';
import type { SessionBackend, SessionDoc, LiveSessionService } from './liveSession';

export const firebaseConfig = {
  apiKey: 'AIzaSyAPBSSlaMQQEnjYTMCPfz2dGLVd9RNnDw4',
  authDomain: 'mahjong-score-tracker-a5a1a.firebaseapp.com',
  projectId: 'mahjong-score-tracker-a5a1a',
  storageBucket: 'mahjong-score-tracker-a5a1a.firebasestorage.app',
  messagingSenderId: '961746286221',
  appId: '1:961746286221:web:03d4ac6d3cff2360a194c4',
};

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;

const getFirebaseApp = (): FirebaseApp => {
  if (!_app) {
    _app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  }
  return _app;
};

const getFirebaseAuth = (): Auth => {
  if (!_auth) {
    const app = getFirebaseApp();
    if (Platform.OS === 'web') {
      _auth = getAuth(app);
    } else {
      // 匿名ユーザー（= ホストの uid）をアプリ再起動後も維持するため、
      // expo-sqlite の AsyncStorage 互換 KV ストアで永続化する（ネイティブモジュール追加なし）。
      // getReactNativePersistence は React Native 向けビルドにのみ存在し、型定義に含まれないため require で取得する。
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getReactNativePersistence } = require('firebase/auth') as {
        getReactNativePersistence: (storage: unknown) => Persistence;
      };
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const kvStore = require('expo-sqlite/kv-store').default;
      _auth = initializeAuth(app, { persistence: getReactNativePersistence(kvStore) });
    }
  }
  return _auth;
};

const getDb = (): Firestore => {
  if (!_db) {
    _db = getFirestore(getFirebaseApp());
  }
  return _db;
};

const sessionRef = (code: string) => doc(getDb(), SESSIONS_COLLECTION, code);

// Firestore の Timestamp ⇔ Unix ミリ秒（expiresAt は TTL ポリシー・ルール用に Timestamp で保存）
const TIME_FIELDS = ['createdAt', 'updatedAt', 'expiresAt'] as const;

const toFirestore = (data: Partial<SessionDoc>): DocumentData => {
  const out: DocumentData = { ...data };
  TIME_FIELDS.forEach(key => {
    if (typeof data[key] === 'number') out[key] = Timestamp.fromMillis(data[key] as number);
  });
  return out;
};

const fromFirestore = (data: DocumentData): Record<string, unknown> => {
  const out: Record<string, unknown> = { ...data };
  TIME_FIELDS.forEach(key => {
    const value = data[key];
    if (value instanceof Timestamp) out[key] = value.toMillis();
  });
  return out;
};

export const firestoreSessionBackend: SessionBackend = {
  async getUid() {
    const auth = getFirebaseAuth();
    // 永続化済みのユーザーの復元を待つ
    await auth.authStateReady();
    if (auth.currentUser) return auth.currentUser.uid;
    const credential = await signInAnonymously(auth);
    return credential.user.uid;
  },
  async exists(code) {
    const snap = await getDoc(sessionRef(code));
    return snap.exists();
  },
  async create(code, sessionDoc) {
    await setDoc(sessionRef(code), toFirestore(sessionDoc));
  },
  async update(code, patch) {
    await updateDoc(sessionRef(code), toFirestore(patch));
  },
  subscribe(code, onNext, onError) {
    return onSnapshot(
      sessionRef(code),
      snap => onNext(snap.exists() ? fromFirestore(snap.data()) : null),
      error => onError(error)
    );
  },
};

let _service: LiveSessionService | null = null;

export const getLiveSessionService = (): LiveSessionService => {
  if (!_service) {
    _service = createLiveSessionService(firestoreSessionBackend);
  }
  return _service;
};
