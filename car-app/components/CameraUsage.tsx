import React, { useRef, useState, useEffect } from 'react';
import { StyleSheet, View, Text, Button } from 'react-native';
import {
  CameraView,
  useCameraPermissions,
} from 'expo-camera';
import io from 'socket.io-client';

const SOCKET_URL = 'http://100.66.7.153:8000';
const socket = io(SOCKET_URL);

const CameraUsage: React.FC = () => {
  const [permission, requestPermission] = useCameraPermissions();
  const [isStreaming, setIsStreaming] = useState(false);
  const [useYolo, setUseYolo] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const streamingInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    socket.connect();
    return () => {
      if (streamingInterval.current) {
        clearInterval(streamingInterval.current);
      }
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    const handleStreamingClient = ({ yolo }: { yolo: boolean }) => {
      setUseYolo(yolo);
      setIsStreaming(true);
    };

    socket.on('beginStreamingClient', handleStreamingClient);

    return () => {
      socket.off('beginStreamingClient', handleStreamingClient);
    };
  }, []);

  useEffect(() => {
    const startStreaming = async () => {
      if (!cameraRef.current || !isStreaming || !permission?.granted) return;

      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.5,
          base64: true,
          skipProcessing: true,
        });

        if (photo.base64) {
          const endpoint = useYolo ? 'getCarDetection' : 'noCarDetection';
          socket.emit(endpoint, { frame: photo.base64 });
        }
      } catch (error) {
        console.error('Camera error:', error);
      }
    };

    if (streamingInterval.current) {
      clearInterval(streamingInterval.current);
    }

    if (isStreaming && permission?.granted) {
      streamingInterval.current = setInterval(startStreaming, 125);
    }

    return () => {
      if (streamingInterval.current) {
        clearInterval(streamingInterval.current);
      }
    };
  }, [isStreaming, useYolo, permission?.granted]);

  if (!permission) {
    return null;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>We need your permission to use the camera</Text>
        <Button onPress={requestPermission} title="Grant permission" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
      >
        <View style={styles.statusBar}>
          <Text style={styles.statusText}>
            Status: {isStreaming ? 'Streaming' : 'Waiting'}
          </Text>
          <Text style={styles.statusText}>
            Mode: {useYolo ? 'Car Detection' : 'Basic Stream'}
          </Text>
        </View>
      </CameraView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  statusBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 10,
  },
  statusText: {
    color: '#fff',
    fontSize: 14,
  },
  text: {
    color: '#fff',
    textAlign: 'center',
    marginBottom: 20,
  },
});

export default CameraUsage;