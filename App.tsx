import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { AudioProvider } from './src/audio/AudioContext';
import { RecordAndPlay } from './recordandplay';

export default function App() {
  return (
    <AudioProvider>
      <View style={styles.container}>
        <RecordAndPlay />
        <StatusBar style="auto" />
      </View>
    </AudioProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F4',
  },
});
