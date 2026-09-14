import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { RoomProvider, useRoom } from './src/context/RoomContext';
import { HomeScreen } from './src/screens/HomeScreen';
import { RoomScreen } from './src/screens/RoomScreen';

const MainNavigator: React.FC = () => {
  const { isInRoom } = useRoom();

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      {isInRoom ? <RoomScreen /> : <HomeScreen />}
    </View>
  );
};

export default function App() {
  return (
    <RoomProvider>
      <MainNavigator />
    </RoomProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0e14',
  },
});
