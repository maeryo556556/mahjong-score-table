import React from 'react';
import { Alert } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';
import SetupScreen from '../../screens/SetupScreen';
import { initDatabase, getCurrentGame, getPlayerNames, getGameById } from '../../database';

const renderSetup = () => {
  const props = {
    onStartGame: jest.fn(),
    onResumeGame: jest.fn(),
    onViewPastGames: jest.fn(),
    onJoinLiveSession: jest.fn(),
    onOpenImportedGame: jest.fn(),
  };
  render(<SetupScreen {...props} />);
  return props;
};

describe('SetupScreen: 新規ゲーム開始', () => {
  beforeEach(() => {
    initDatabase();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('4人分の名前を入力して「ゲーム開始」するとゲームが作成される', () => {
    const props = renderSetup();

    const inputs = screen.getAllByPlaceholderText('名前を入力');
    expect(inputs).toHaveLength(4);
    ['東家', '南家', '西家', '北家'].forEach((name, i) => fireEvent.changeText(inputs[i], name));

    fireEvent.press(screen.getByText('ゲーム開始'));

    expect(Alert.alert).not.toHaveBeenCalled();
    expect(props.onStartGame).toHaveBeenCalledTimes(1);
    const gameId = props.onStartGame.mock.calls[0][0];
    expect(getGameById(gameId)).toMatchObject({ player_count: 4, finished: 0 });
    expect(getPlayerNames(gameId)).toEqual(['東家', '南家', '西家', '北家']);
    expect(getCurrentGame()?.id).toBe(gameId);
  });

  it('3人麻雀を選ぶと入力欄が3つになり、3人のゲームが作成される', () => {
    const props = renderSetup();

    fireEvent.press(screen.getByText('3人麻雀'));
    const inputs = screen.getAllByPlaceholderText('名前を入力');
    expect(inputs).toHaveLength(3);
    ['Aさん', 'Bさん', 'Cさん'].forEach((name, i) => fireEvent.changeText(inputs[i], name));

    fireEvent.press(screen.getByText('ゲーム開始'));

    const gameId = props.onStartGame.mock.calls[0][0];
    expect(getGameById(gameId)?.player_count).toBe(3);
    expect(getPlayerNames(gameId)).toEqual(['Aさん', 'Bさん', 'Cさん']);
  });

  it('名前が空欄のままだと入力エラーになりゲームは作成されない', () => {
    const props = renderSetup();

    const inputs = screen.getAllByPlaceholderText('名前を入力');
    fireEvent.changeText(inputs[0], '東家');
    fireEvent.press(screen.getByText('ゲーム開始'));

    expect(Alert.alert).toHaveBeenCalledWith('入力エラー', 'すべてのプレイヤーの名前を入力してください');
    expect(props.onStartGame).not.toHaveBeenCalled();
    expect(getCurrentGame()).toBeNull();
  });

  it('過去のゲームがなければ「過去のゲームを見る」ボタンは表示されない', () => {
    renderSetup();
    expect(screen.queryByText('過去のゲームを見る')).toBeNull();
    expect(screen.getByText('過去のゲーム 0件（お気に入り 0件）')).toBeOnTheScreen();
  });
});
