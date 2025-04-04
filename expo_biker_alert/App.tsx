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
  SafeAreaView,
  Animated
} from 'react-native';
import MapView, { Marker, Region} from 'react-native-maps';
import * as Location from 'expo-location';
import { io, Socket } from 'socket.io-client';
import { Audio } from 'expo-av';

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
const SOCKET_SERVER_URL = 'http://100.66.4.2:8080';
const audioSource = require('./assets/bikeralert.mp3');


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
  const positionHistoryRef = useRef(positionHistory);
  const [otherUserPosition, setOtherUserPosition] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [directionMessage, setDirectionMessage] = useState('');
  const socket = useRef<Socket | null>(null);
  const watchId = useRef<Location.LocationSubscription | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [isAlertVisible, setIsAlertVisible] = useState(false);
  const alertTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isMarkerVisible, setIsMarkerVisible] = useState(false);
  const markerTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Replace this with a unique identifier for your user.
  const userId = useRef('user-' + Math.floor(Math.random() * 10000)).current;

  const selectUserType = (type: UserType) => {
    setUserType(type);
  };

  const playAlert = async () => {
    try {
      if (sound) {
        await sound.replayAsync();
        
      }
    } catch (error) {
      console.error('Error playing sound', error);
    }
  };

  const showAlert = () => {
    // Clear any existing timeout
    if (alertTimeoutRef.current) {
      clearTimeout(alertTimeoutRef.current);
    }
  
    // Show the alert
    setIsAlertVisible(true);
  
    // Start the animation sequence
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0.3,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  
    // Set timeout to hide the alert after 8 seconds
    alertTimeoutRef.current = setTimeout(() => {
      setIsAlertVisible(false);
    }, 8000);
  };

  const showMarker = () => {
    // Clear any existing timeout
    if (markerTimeoutRef.current) {
      clearTimeout(markerTimeoutRef.current);
    }
  
    // Show the marker
    setIsMarkerVisible(true);
  
    // Set timeout to hide the marker after 8 seconds
    markerTimeoutRef.current = setTimeout(() => {
      setIsMarkerVisible(false);
    }, 8000);
  };

  const startTracking = async () => {
    if (!userType) return;
    
    try {
      // Request permissions
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      if (foregroundStatus !== 'granted') {
        console.error('Permission to access location was denied');
        return;
      }

      // Open Socket.IO connection
      socket.current = io(SOCKET_SERVER_URL, {
        transports: ['websocket'],
      });
      
      socket.current.on('connect', () => {
        console.log('Connected to Socket.IO server');
      });

      socket.current.on('alert', (message: AlertMessage) => {
        
        setOtherUserPosition({
          latitude: message.latitude,
          longitude: message.longitude,
        });
        showMarker(); // Add this line
      
        // Get latest position history state
        if (positionHistoryRef.current.length >= 2) {
          const direction = determineRelativePosition(positionHistoryRef.current, {
            latitude: message.latitude,
            longitude: message.longitude,
          });
      
          playAlert();
          
          // Set appropriate message based on user type
          const newMessage = userType === 'driver' 
            ? `Cyclist ${direction}! Distance: ${Math.round(message.distance)}m`
            : `Vehicle ${direction}! Distance: ${Math.round(message.distance)}m`;
          
          setDirectionMessage(newMessage);
          showAlert();
        } else {
          console.log('Insufficient position history:', positionHistoryRef.current.length);
        }
      });

      socket.current.on('disconnect', () => {
        console.log('Disconnected from Socket.IO server');
      });

      socket.current.on('connect_error', (error) => {
        console.error('Connection error:', error);
      });

      // Get initial position
      const initialPosition = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
      });

      const newPosition = {
        latitude: initialPosition.coords.latitude,
        longitude: initialPosition.coords.longitude,
        timestamp: initialPosition.timestamp
      };

      // Initialize position history
      await Promise.all([
        setCurrentPosition(newPosition),
        setPositionHistory([newPosition])
      ]);

      console.log('Initial state set:', { newPosition, positionHistory: [newPosition] });

      // Start location updates
      watchId.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 500,
        },
        async (position) => {
          const newPosition = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            timestamp: position.timestamp
          };
          
          // Update states using callback form to ensure we have latest state
          await Promise.all([
            setCurrentPosition(newPosition),
            setPositionHistory(prevHistory => {
              const updatedHistory = [...prevHistory, newPosition].slice(-10);
              return updatedHistory;
            })
          ]);

          // Send update via Socket.IO
          if (socket.current?.connected) {
            socket.current.emit('update', {
              id: userId,
              userType: userType,
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            });
          }
        }
      );

      setTracking(true);
    } catch (err) {
      console.error('Error starting tracking:', err);
    }
  };

  useEffect(() => {
    async function loadSound() {
      try {
        const { sound } = await Audio.Sound.createAsync(require('./assets/bikeralert.mp3'));
        setSound(sound);
      } catch (error) {
        console.error('Error loading sound', error);
      }
    }
    console.log('Loading sound');
    loadSound();

    // Cleanup
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, []);

  // Play sound function


  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (watchId.current) {
        watchId.current.remove();
      }
      if (socket.current) {
        socket.current.disconnect();
      }
      if (alertTimeoutRef.current) {
        clearTimeout(alertTimeoutRef.current);
      }
      if (markerTimeoutRef.current) {
        clearTimeout(markerTimeoutRef.current);
      }
    };
  }, []);

  // Add a debug useEffect to monitor position history changes

  useEffect(() => {
    positionHistoryRef.current = positionHistory;
  }, [positionHistory]);

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

  // If user type not selected, show selection screen
  if (!userType) {
    return (
      <SafeAreaView style={styles.selectionContainer}>
        <Text style={styles.title}>Select User Type</Text>
        <View style={styles.buttonContainer}>
          <Button 
            title="Join as Driver" 
            onPress={() => selectUserType('driver')} 
          />
          <View style={styles.buttonSpacer} />
          <Button 
            title="Join as Cyclist" 
            onPress={() => selectUserType('biker')} 
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      {!tracking && (
        <SafeAreaView style={styles.startContainer}>
          <Text style={styles.userTypeText}>
            {userType === 'driver' ? 'Driver Mode' : 'Cyclist Mode'}
          </Text>
          <Button title="Start Tracking" onPress={startTracking} />
        </SafeAreaView>
      )}
      {tracking && currentPosition && (
        <>
          <MapView 
            style={styles.map} 
            initialRegion={initialRegion}
            followsUserLocation={true}
            showsUserLocation={true}
          >
            {otherUserPosition && isMarkerVisible && (
              <Marker
                coordinate={otherUserPosition}
                title={userType === 'driver' ? "Cyclist" : "Driver"}
                pinColor="blue"
              >
                {/* <Callout tooltip={false}>
                  <View style={styles.calloutContainer}>
                    <Text style={styles.calloutText}>{directionMessage}</Text>
                  </View>
                </Callout> */}
              </Marker>
            )}
          </MapView>
          {directionMessage && isAlertVisible && (
            <Animated.View 
              style={[
                styles.warningOverlay,
                {
                  opacity: fadeAnim,
                }
              ]}
            >
              <Text style={styles.warningText}>{directionMessage}</Text>
            </Animated.View>
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
  calloutContainer: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 5,
  },
  calloutText: {
    color: 'black',
    fontSize: 14,
  },
  warningOverlay: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255, 0, 0, 0.9)',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  warningText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default App;
