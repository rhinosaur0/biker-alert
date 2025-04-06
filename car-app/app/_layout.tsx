import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, StyleSheet } from 'react-native';
import StartButton from '../components/StartButton';
import MapScreen from '../components/MapScreen';
import CameraUsage from '../components/CameraUsage';
import CustomButton from '../components/CustomButton';
import * as Location from 'expo-location';

export default function App() {
  const [mode, setMode] = useState<'none' | 'camera' | 'biker'>('none');
  const [locationPermission, setLocationPermission] = useState(false);


  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status === 'granted');
      setMode('biker');
    })();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      {mode === 'camera' ? (
        <CameraUsage />
      ) : mode === 'biker' ? (
        locationPermission ? (
          <MapScreen />
        ) : (
          <StartButton onStart={() => {}} locationPermission={locationPermission} />
        )
      ) : null}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20
  }
});