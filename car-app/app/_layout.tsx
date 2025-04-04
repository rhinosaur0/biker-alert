import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import StartButton from '../components/StartButton';
import MapScreen from '../components/MapScreen';
import * as Location from 'expo-location';

export default function App() {
  const [bikeMode, setBikeMode] = useState(false);
  const [locationPermission, setLocationPermission] = useState(false);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status === 'granted');
    })();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      {!bikeMode ? (
        <StartButton onStart={() => setBikeMode(true)} locationPermission={locationPermission} />
      ) : (
        <MapScreen />
      )}
    </SafeAreaProvider>
  );
}