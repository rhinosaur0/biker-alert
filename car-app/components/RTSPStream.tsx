import React from 'react';
import { StyleSheet, View } from 'react-native';
import { VLCPlayer } from 'react-native-vlc-media-player';
import { getCurrentStream, isStreamActive } from '../services/CameraService';

interface RTSPStreamProps {
  style?: object;
  onError?: (error: any) => void;
}

const RTSPStream: React.FC<RTSPStreamProps> = ({ style, onError }) => {
  const stream = getCurrentStream();
  
  if (!stream || !isStreamActive()) {
    onError?.('Stream not available');
    return null;
  }

  return (
    <View style={[styles.container, style]}>
      <VLCPlayer
        style={styles.player}
        source={stream.uri}
        paused={false}
        onError={(error) => {
          console.error('VLC Error:', error);
          onError?.(error);
        }}
        onProgress={(data) => console.log('Stream progress:', data)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  player: {
    flex: 1,
  },
});

export default RTSPStream;