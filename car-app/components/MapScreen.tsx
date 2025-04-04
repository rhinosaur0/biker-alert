import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import * as Location from 'expo-location';
import MapView, { Marker } from 'react-native-maps';  // Changed import
import LoadingComponent from './LoadingComponent';
import AlertComponent from './AlertComponent';
import { checkNearbyIntersections, loadIntersections } from '../services/IntersectionService';
import { startCameraStream, stopCameraStream } from '../services/CameraService';
import { detectObjects } from '../services/DetectionService';

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
  const mapRef = useRef<MapView>(null);  // Changed ref type
  
  // Set up location tracking and intersection data
  useEffect(() => {
    let locationSubscription: Location.LocationSubscription;
    let detectionInterval: NodeJS.Timeout;
    
    const initialize = async () => {
      // Load intersections from GeoJSON file
      const loaded = await loadIntersections('/assets/intersections.geojson');
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
      await startCameraStream();
      
      // Object detection loop
      detectionInterval = setInterval(async () => {
        if (intersectionNearby) {
          try {
            const frame = await getCameraFrame();
            if (frame) {
              const detections = await detectObjects(frame);
              const hasCar = detections.some(detection => 
                detection.class === 'car' || 
                detection.class === 'truck' || 
                detection.class === 'bus'
              );
              
              if (hasCar) {
                setShowAlert(true);
              }
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
  
  // Function to get camera frame (will be implemented in CameraService)
  const getCameraFrame = async () => {
    // This will be implemented in CameraService
    // For now, return a placeholder
    return "base64encodedimage";
  };

  return (
    <View style={styles.container}>
      <LoadingComponent visible={loading} />
      
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
        {/* Add markers if needed */}
        {sampleIntersections.map((intersection, index) => (
          <Marker
            key={index}
            coordinate={{
              latitude: intersection.coordinates[0][0],
              longitude: intersection.coordinates[0][1],
            }}
          />
        ))}
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
  map: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  },
});

export default MapScreen;