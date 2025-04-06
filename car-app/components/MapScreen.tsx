import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Dimensions, Text } from 'react-native';
import * as Location from 'expo-location';
import MapView from 'react-native-maps';
import { CameraView, useCameraPermissions } from 'expo-camera';
import LoadingComponent from './LoadingComponent';
import AlertComponent from './AlertComponent';
import { checkNearbyIntersections, loadIntersections } from '../services/IntersectionService';
import io from 'socket.io-client';

const SOCKET_URL = 'http://100.66.7.153:8000';
const COOLDOWN_DURATION = 5000; // 5 seconds in milliseconds
const socket = io(SOCKET_URL);

const MapScreen: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [showAlert, setShowAlert] = useState(false);
  const [intersectionNearby, setIntersectionNearby] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const mapRef = useRef<MapView>(null);
  const cameraRef = useRef<CameraView>(null);
  const streamingInterval = useRef<NodeJS.Timeout | null>(null);

  // Handle socket connection and camera streaming
  useEffect(() => {
    socket.connect();
    
    socket.on('receiveStreaming', ({ carDetected }) => {
      if (carDetected) {
        setShowAlert(true);
      }
    });

    return () => {
      if (streamingInterval.current) {
        clearInterval(streamingInterval.current);
      }
      socket.disconnect();
    };
  }, []);

  // Handle camera streaming
  const startStreaming = async () => {
    if (!cameraRef.current || !cameraPermission?.granted) return;

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.5,
        base64: true,
        skipProcessing: true,
      });

      if (photo.base64 && intersectionNearby) {
        socket.emit('getCarDetection', { frame: photo.base64 });
      }
    } catch (error) {
      console.error('Camera error:', error);
    }
  };

  // Initialize camera and location tracking
  useEffect(() => {
    let locationSubscription: Location.LocationSubscription;
    
    const initialize = async () => {
      // Request camera permission if not granted
      if (!cameraPermission?.granted) {
        await requestCameraPermission();
      }

      const loaded = await loadIntersections();
      if (!loaded) {
        console.error('Failed to load intersections');
        return;
      }
      
      // Start location tracking
      locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 125,
          distanceInterval: 0,
        },
        (newLocation) => {
          setLocation(newLocation);
          
          const { isNear, nearbyIntersections: nearby } = checkNearbyIntersections(
            newLocation.coords.latitude,
            newLocation.coords.longitude,
            20
          );
          
          setIntersectionNearby(isNear);
        }
      );

      // Start camera streaming
      if (cameraPermission?.granted) {
        streamingInterval.current = setInterval(startStreaming, 125);
      }
      
      setLoading(false);
    };

    initialize();
    
    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
      if (streamingInterval.current) {
        clearInterval(streamingInterval.current);
      }
    };
  }, [cameraPermission?.granted]);

  if (!cameraPermission?.granted) {
    return (
      <View style={styles.container}>
        <Text>Camera permission is required</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LoadingComponent visible={loading} />
      
      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="front"
        >
          <View style={styles.statusBar}>
            <Text style={styles.statusText}>
              {intersectionNearby ? 'Detecting Cars' : 'Monitoring'}
            </Text>
          </View>
        </CameraView>
      </View>
      
      <MapView
        ref={mapRef}
        style={styles.map}
        showsUserLocation={true}
        followsUserLocation={true}
        initialRegion={{
          latitude: location?.coords.latitude || 37.78825,
          longitude: location?.coords.longitude || -122.4324,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
      />
      <AlertComponent 
        visible={showAlert} 
        onTimeout={() => setShowAlert(false)} 
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  cameraContainer: {
    height: Dimensions.get('window').height * 0.5,
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
  map: {
    height: Dimensions.get('window').height * 0.5,
  },
});

export default MapScreen;