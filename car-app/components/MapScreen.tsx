import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Dimensions, Text } from 'react-native';
import * as Location from 'expo-location';
import MapView, { Marker } from 'react-native-maps';
import LoadingComponent from './LoadingComponent';
import AlertComponent from './AlertComponent';
import RTSPStream from './RTSPStream';
import { checkNearbyIntersections, loadIntersections } from '../services/IntersectionService';
import { startCameraStream, stopCameraStream, getCameraFrame } from '../services/CameraService';
import io from 'socket.io-client';

const SOCKET_URL = 'YOUR_SOCKET_SERVER_URL';
const socket = io(SOCKET_URL);

// Sample intersection data format, replace with your actual data source
const sampleIntersections = [
  { coordinates: [[40.7128, -74.0060]] }, // New York
  { coordinates: [[34.0522, -118.2437]] }, // Los Angeles
  // Add more intersections as needed
];

const MapScreen: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [showAlert, setShowAlert] = useState(false);
  const [intersectionNearby, setIntersectionNearby] = useState(false);
  const [nearbyIntersections, setNearbyIntersections] = useState<Array<{ id: number; description: string }>>([]);
  const mapRef = useRef<MapView>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);

  useEffect(() => {
    // Connect to socket
    socket.connect();
    
    // Listen for car detections
    socket.on('receiveCarDetection', (hasDetectedCar: boolean) => {
      if (hasDetectedCar) {
        setShowAlert(true);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Set up location tracking and intersection data
  useEffect(() => {
    let locationSubscription: Location.LocationSubscription;
    let detectionInterval: NodeJS.Timeout;
    
    const initialize = async () => {
      // Load intersections from GeoJSON file
      const loaded = await loadIntersections();
      if (!loaded) {
        console.error('Failed to load intersections');
        return;
      }
      
      // Start location updates
      locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 500,
          distanceInterval: 0,
        },
        (newLocation) => {
          setLocation(newLocation);
          
          // Check if we're near an intersection
          const { isNear, nearbyIntersections: nearby } = checkNearbyIntersections(
            newLocation.coords.latitude,
            newLocation.coords.longitude,
            20 // 20 meters radius
          );
          
          setIntersectionNearby(isNear);
          if (nearby) {
            setNearbyIntersections(nearby);
          }
        }
      );
      
      // Start camera stream
      const streamStarted = await startCameraStream();
      setIsCameraReady(streamStarted);
      
      // Object detection loop
      detectionInterval = setInterval(async () => {
        if (intersectionNearby) {
          console.log('begin detecting for cars');
          try {
            const frame = await getCameraFrame();
            if (frame) {
              socket.emit('getCarDetection', { frame });
            }
          } catch (error) {
            console.error('Detection error:', error);
          }
        }
      }, 500);
      
      setLoading(false);
    };

    initialize();
    
    // Cleanup function
    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
      if (detectionInterval) {
        clearInterval(detectionInterval);
      }
      stopCameraStream();
    };
  }, [intersectionNearby]);

  return (
    <View style={styles.container}>
      <LoadingComponent visible={loading} />
      
      <View style={styles.cameraContainer}>
        {isCameraReady ? (
          <RTSPStream
            style={styles.camera}
            onError={(error) => console.error('Stream error:', error)}
          />
        ) : (
          <View style={styles.noCameraView}>
            <Text>No camera detected</Text>
          </View>
        )}
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
      >
      </MapView>
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
  noCameraView: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  map: {
    height: Dimensions.get('window').height * 0.5,
  },
});

export default MapScreen;