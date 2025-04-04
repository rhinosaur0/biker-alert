/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Button,
  SafeAreaView
} from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import Geolocation from '@react-native-community/geolocation';


// Types for alert message received from the server.
interface AlertMessage {
  type: 'alert';
  from: string;
  fromType: 'driver' | 'biker';
  latitude: number;
  longitude: number;
  distance: number;
}

type UserType = 'driver' | 'biker';

interface Position {
  latitude: number;
  longitude: number;
  timestamp: number;
}

// Replace with your actual Socket.IO server URL.


// Calculate bearing between two points
function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (degree: number) => degree * Math.PI / 180;
  
  const startLat = toRad(lat1);
  const startLng = toRad(lon1);
  const destLat = toRad(lat2);
  const destLng = toRad(lon2);
  
  const y = Math.sin(destLng - startLng) * Math.cos(destLat);
  const x = Math.cos(startLat) * Math.sin(destLat) -
            Math.sin(startLat) * Math.cos(destLat) * Math.cos(destLng - startLng);
  
  let bearing = Math.atan2(y, x) * 180 / Math.PI;
  if (bearing < 0) {
    bearing += 360;
  }
  
  return bearing;
}

// Enhanced function to determine relative position
function determineRelativePosition(
  userPositions: Position[],
  otherPosition: { latitude: number; longitude: number }
): string {
  if (userPositions.length < 2) {
    return "Someone is nearby";
  }
  
  // Calculate user's heading based on recent positions
  const currentPosition = userPositions[userPositions.length - 1];
  const previousPosition = userPositions[userPositions.length - 2];
  
  // Get user's heading (which way they're facing)
  const userHeading = calculateBearing(
    previousPosition.latitude,
    previousPosition.longitude,
    currentPosition.latitude,
    currentPosition.longitude
  );
  
  // Calculate bearing to the other user
  const bearingToOther = calculateBearing(
    currentPosition.latitude,
    currentPosition.longitude,
    otherPosition.latitude,
    otherPosition.longitude
  );
  
  // Calculate relative angle
  let relativeAngle = bearingToOther - userHeading;
  if (relativeAngle < 0) {
    relativeAngle += 360;
  }
  
  // Determine the relative direction
  if (relativeAngle >= 315 || relativeAngle < 45) {
    return "directly ahead";
  } else if (relativeAngle >= 45 && relativeAngle < 135) {
    return "to your right";
  } else if (relativeAngle >= 135 && relativeAngle < 225) {
    return "behind you";
  } else {
    return "to your left";
  }
}

const App = () => {
  const [userType, setUserType] = useState<UserType | null>(null);
  const [tracking, setTracking] = useState(false);
  const [currentPosition, setCurrentPosition] = useState<Position | null>(null);
  const [positionHistory, setPositionHistory] = useState<Position[]>([]);
  const [otherUserPosition, setOtherUserPosition] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [directionMessage, setDirectionMessage] = useState('');

  const watchId = useRef<number | null>(null);
  const locationInterval = useRef<NodeJS.Timeout | null>(null);

  // Replace this with a unique identifier for your user.
  const userId = useRef('user-' + Math.floor(Math.random() * 10000)).current;
  
  const selectUserType = (type: UserType) => {
    setUserType(type);
  };

  const startTracking = () => {
    if (!userType) return;
    
    // Configure geolocation settings
    Geolocation.setRNConfiguration({
      skipPermissionRequests: false,
      authorizationLevel: 'always',
      enableBackgroundLocationUpdates: true,
      locationProvider: 'auto'
    });
  

    // Get initial position
    Geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const newPosition = { 
          latitude, 
          longitude, 
          timestamp: Date.now() 
        };
        setCurrentPosition(newPosition);
        setPositionHistory([newPosition]);
      },
      (error) => console.error(error),
      { enableHighAccuracy: true }
    );

    // Set up interval for regular position updates (every 500ms)
    locationInterval.current = setInterval(() => {
      Geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const newPosition = { 
            latitude, 
            longitude, 
            timestamp: Date.now() 
          };
          console.log('New position:', newPosition);
          
          setCurrentPosition(newPosition);
          
          // Update position history (keep last 10 positions)
          setPositionHistory(prevHistory => {
            const newHistory = [...prevHistory, newPosition];
            if (newHistory.length > 10) {
              return newHistory.slice(newHistory.length - 10);
            }
            return newHistory;
          });
          
        },
        (error) => console.error(error),
        { enableHighAccuracy: true }
      );
    }, 500);

    setTracking(true);
  };

  useEffect(() => {
    // Cleanup on unmount.
    return () => {
      if (watchId.current !== null) {
        Geolocation.clearWatch(watchId.current);
      }
      if (locationInterval.current !== null) {
        clearInterval(locationInterval.current);
      }
    };
  }, []);

  // Define an initial region for the map.
  const initialRegion: Region = currentPosition ? {
    latitude: currentPosition.latitude,
    longitude: currentPosition.longitude,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  } : {
    latitude: 37.78825,
    longitude: -122.4324,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  };


  return (
    <View style={styles.container}>
      {tracking && currentPosition && (
        <>
          <MapView style={styles.map} initialRegion={initialRegion}>
            <Marker
              coordinate={{
                latitude: currentPosition.latitude,
                longitude: currentPosition.longitude,
              }}
              title={userType === 'driver' ? "You (Driver)" : "You (Cyclist)"}
            />
            {otherUserPosition && (
              <Marker
                coordinate={otherUserPosition}
                title={userType === 'driver' ? "Cyclist" : "Driver"}
                pinColor={userType === 'driver' ? "blue" : "red"}
              />
            )}
          </MapView>
          {directionMessage !== '' && (
            <View style={styles.alertContainer}>
              <Text style={styles.alertText}>{directionMessage}</Text>
            </View>
          )}
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  selectionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 40,
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 300,
  },
  buttonSpacer: {
    height: 20,
  },
  startContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userTypeText: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  map: {
    flex: 1,
  },
  alertContainer: {
    position: 'absolute',
    bottom: 50,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255, 0, 0, 0.8)',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  alertText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default App;
