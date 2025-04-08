import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native';
import StartButton from '../components/StartButton';
// import MapScreen from '../components/MapScreen';
// import MapScreen from '../components/OnlyGPS'
import SimulationScreen from '@/components/Simulation';
import * as Location from 'expo-location';

export default function App() {
  const [hasStarted, setHasStarted] = useState(false);
  const [locationPermission, setLocationPermission] = useState(false);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status === 'granted');
    })();
  }, []);

  const handleStart = () => {
    setHasStarted(true);
  };

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      {!hasStarted ? (
        <StartButton 
          onStart={handleStart} 
          locationPermission={locationPermission} 
        />
      ) : (
        <SimulationScreen />
      )}
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