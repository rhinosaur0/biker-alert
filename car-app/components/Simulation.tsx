import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Dimensions, Text, Animated } from 'react-native';
// Keep Location type, but we won't use the tracking functions
import * as Location from 'expo-location'; 
import MapView, { Marker } from 'react-native-maps';
import { CameraView, useCameraPermissions } from 'expo-camera';
import LoadingComponent from './LoadingComponent';
import AlertComponent from './AlertComponent';
import { checkNearbyIntersections, loadIntersections } from '../services/IntersectionService';
import io from 'socket.io-client';

// --- Simulation Parameters ---
const SIMULATION_DURATION_MS = 50000; // 30 seconds
const SIMULATION_UPDATE_INTERVAL_MS = 500; // Update every 500ms
const START_COORDS = { latitude: 43.65635272378309, longitude: -79.38882786376033 }; // Example Start
const END_COORDS = { latitude: 43.65987968849702, longitude: -79.39036461333198 }; // Example End

// --- Constants (Copied from MapScreen) ---
const SOCKET_URL = 'http://100.66.13.84:8000'; // Use the same socket URL
const socket = io(SOCKET_URL, {
  transports: ['websocket'],
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});
const COOLDOWN_DURATION = 3000; // 5 seconds in milliseconds
const INTERSECTION_CHECK_RADIUS_KM = 0.03; // 30 meters (adjust as needed)


// Rename component to SimulationScreen
const SimulationScreen: React.FC = () => {
  const [loading, setLoading] = useState(true);
  // Location state will be updated by simulation
  const [location, setLocation] = useState<Location.LocationObject | null>(null); 
  const [showAlert, setShowAlert] = useState(false);
  const [isNearIntersection, setIsNearIntersection] = useState(false);
  const [isNearCooldown, setIsNearCooldown] = useState<boolean>(false);
  // Keep camera permission logic for the CameraView component
  const [cameraPermission, requestCameraPermission] = useCameraPermissions(); 
  const [currentIntersection, setCurrentIntersection] = useState<string | null>(null);
  const notificationAnim = useRef(new Animated.Value(100)).current;
  const mapRef = useRef<MapView>(null);
  const cameraRef = useRef<CameraView>(null);
  const streamingInterval = useRef<NodeJS.Timeout | null>(null);
  const isNearCooldownTimer = useRef<NodeJS.Timeout | null>(null);
  const isMounted = useRef(true);
  // const [isCapturing, setIsCapturing] = useState(false); // Removed as it wasn't used in MapScreen either

  // --- Socket Connection Handling (Keep as is) ---
  useEffect(() => {
    const handleConnect = () => console.log('Socket connected');
    const handleDisconnect = () => console.log('Socket disconnected');
    const handleCarDetection = () => setShowAlert(true);

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('receiveStreaming', handleCarDetection);

    if (!socket.connected) socket.connect();

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('receiveStreaming', handleCarDetection);
      // Optional: Disconnect socket on unmount if this is the only component using it
      // if (socket.connected) socket.disconnect(); 
    };
  }, []);

  // --- Notification Animation (Keep as is) ---
  const showNotification = (intersectionName: string) => {
    setCurrentIntersection(intersectionName);
    Animated.sequence([
      Animated.timing(notificationAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
      Animated.delay(3000),
      Animated.timing(notificationAnim, { toValue: 100, duration: 500, useNativeDriver: true }),
    ]).start(() => setCurrentIntersection(null));
  };

  // --- Initialization: Camera Permissions & Intersection Loading ---
  useEffect(() => {
    let isSubscribed = true;
    const initialize = async () => {
      // Request camera permission (still needed for CameraView)
      if (!cameraPermission?.granted) {
        console.log("Requesting camera permission...");
        await requestCameraPermission();
      }

      // Load intersections (needed for checking)
      console.log("Loading intersections...");
      const loaded = await loadIntersections();
      if (!loaded && isSubscribed) {
        console.error('Failed to load intersections');
        // Handle error appropriately, maybe show a message
      } else if (loaded && isSubscribed) {
        console.log(`Intersections loaded.`);
      }
      
      // Set initial location to start coords *after* intersections load
      if (isSubscribed) {
         const initialLocation: Location.LocationObject = {
             coords: {
                 latitude: START_COORDS.latitude,
                 longitude: START_COORDS.longitude,
                 accuracy: 5, // Mock accuracy
                 altitude: null,
                 altitudeAccuracy: null,
                 heading: null,
                 speed: null,
             },
             timestamp: Date.now(),
         };
         setLocation(initialLocation); 
         setLoading(false); // Stop loading only after setup is complete
      }
    };

    initialize();

    return () => { isSubscribed = false; };
  }, [cameraPermission]); // Rerun if camera permission status changes

  // --- Location Simulation Logic ---
  useEffect(() => {
    if (loading) return; // Don't start simulation until initialized

    const startTime = Date.now();
    let simulationTimer: NodeJS.Timeout | null = null;

    const updateSimulatedLocation = () => {
      const elapsedTime = Date.now() - startTime;
      const progress = Math.min(elapsedTime / SIMULATION_DURATION_MS, 1); // Clamp progress to max 1

      // Linear interpolation (lerp)
      const lat = START_COORDS.latitude + (END_COORDS.latitude - START_COORDS.latitude) * progress;
      const lon = START_COORDS.longitude + (END_COORDS.longitude - START_COORDS.longitude) * progress;

      // Create a LocationObject structure
      const simulatedLocation: Location.LocationObject = {
        coords: {
          latitude: lat,
          longitude: lon,
          accuracy: 5, // Mock accuracy
          altitude: null,
          altitudeAccuracy: null,
          heading: null, // Could calculate heading if needed
          speed: null, // Could calculate speed if needed
        },
        timestamp: Date.now(),
      };

      setLocation(simulatedLocation); // Update state

      // Stop the interval if simulation duration is reached
      if (progress >= 1) {
        console.log("Simulation finished.");
        if (simulationTimer) clearInterval(simulationTimer);
      }
    };

    console.log("Starting location simulation...");
    // Set initial location immediately before starting interval
    updateSimulatedLocation(); 
    simulationTimer = setInterval(updateSimulatedLocation, SIMULATION_UPDATE_INTERVAL_MS);

    // Cleanup function
    return () => {
      console.log("Stopping location simulation.");
      if (simulationTimer) clearInterval(simulationTimer);
       // Clear cooldown timer on unmount
       if (isNearCooldownTimer.current) {
         clearTimeout(isNearCooldownTimer.current);
       }
    };
  }, [loading]); // Start simulation once loading is false


  // --- Check Nearby Intersections (Keep as is, uses `location` state) ---
  useEffect(() => {
    // This effect now uses the simulated location state
    if (!location) return; 

    const { latitude, longitude } = location.coords;
    const checkResult = checkNearbyIntersections(
        latitude,
        longitude,
        INTERSECTION_CHECK_RADIUS_KM
    );

    const currentlyNear = checkResult.isNear;
    const nearby = checkResult.nearbyIntersections;

    if (currentlyNear !== isNearIntersection && !isNearCooldown) {
        console.log(`Intersection proximity changed to: ${currentlyNear}. Starting cooldown.`);
        setIsNearIntersection(currentlyNear);
        setIsNearCooldown(true);

        if (currentlyNear && nearby && nearby.length > 0) {
            showNotification(nearby[0].description || `Intersection ${nearby[0].id}`);
        }

        if (isNearCooldownTimer.current) clearTimeout(isNearCooldownTimer.current);

        isNearCooldownTimer.current = setTimeout(() => {
            console.log("Cooldown finished.");
            setIsNearCooldown(false);
            isNearCooldownTimer.current = null;
        }, COOLDOWN_DURATION);
    }
  }, [location, isNearIntersection, isNearCooldown]);

  // --- Camera Streaming Logic (Keep as is, depends on `isNearIntersection`) ---
  useEffect(() => {
    const startFrameSendingInterval = () => {
      if (streamingInterval.current) return;
      console.log("Starting frame sending interval (Simulation)...");
      streamingInterval.current = setInterval(async () => {
        if (cameraRef.current && cameraPermission?.granted && socket.connected) {
          try {
            const picture = await cameraRef.current.takePictureAsync({
              quality: 0.5,
              base64: true,
            });
            if (picture?.base64) {
              socket.emit('getCarDetection', { frame: picture.base64 });
            }
          } catch (error) {
            console.error("Error taking picture:", error);
          }
        } else if (!socket.connected) {
          console.warn("Socket disconnected, stopping frame sending.");
          stopFrameSendingInterval();
        }
      }, 1000); // Frame interval
    };

    const stopFrameSendingInterval = () => {
      if (streamingInterval.current) {
        console.log("Stopping frame sending interval (Simulation).");
        clearInterval(streamingInterval.current);
        streamingInterval.current = null;
      }
    };

    // Start/Stop based on simulated proximity, camera permission, socket connection
    if (isNearIntersection && cameraPermission?.granted && socket.connected) {
      startFrameSendingInterval();
    } else {
      stopFrameSendingInterval();
    }

    return stopFrameSendingInterval; // Cleanup
  }, [isNearIntersection, cameraPermission?.granted, socket.connected]);

  // --- Alert Timeout Logic (Keep as is) ---
  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;
    if (showAlert) {
      clearTimeout(timeoutId!); // Clear previous if any
      timeoutId = setTimeout(() => {
        if (isMounted.current) setShowAlert(false);
      }, 5000); // Alert duration
    }
    return () => { if (timeoutId) clearTimeout(timeoutId); };
  }, [showAlert]);

  // --- Mount Tracking (Keep as is) ---
  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // --- Render Logic ---

  // Initial loading state (intersections, permissions)
  if (loading) {
     return <LoadingComponent visible={true} />;
  }

  // Camera permission check (still needed for CameraView)
  if (!cameraPermission?.granted) {
    return (
      <View style={styles.container}>
        <Text>Camera permission is required for simulation display.</Text>
        {/* Maybe add a button to re-request */}
      </View>
    );
  }

   // Location check (should be set by simulation shortly after loading)
   if (!location) {
     return (
       <View style={styles.container}>
         {/* This state might be brief */}
         <Text>Initializing simulation...</Text> 
       </View>
     );
   }

  // Main Render (Similar to MapScreen, uses simulated location)
  return (
    <View style={styles.container}>
      {/* Camera View (Top Half) */}
      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="front" // Or "back" if preferred
          animateShutter={false}
        >
          <View style={styles.statusBar}>
            <Text style={styles.statusText}>
              {isNearIntersection ? 'Detecting (Simulated)' : 'Monitoring (Simulated)'}
            </Text>
            {/* Optional: Add simulation status text */}
            {/* <Text style={styles.statusText}>Simulating...</Text> */}
          </View>
        </CameraView>
      </View>
      
      {/* Map View (Bottom Half) */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          // Disable the default blue dot and map following
          showsUserLocation={false} 
          followsUserLocation={false} 
          // Set initialRegion directly to START_COORDS
          initialRegion={{ 
            latitude: START_COORDS.latitude,
            longitude: START_COORDS.longitude,
            latitudeDelta: 0.015, // Adjust zoom as needed
            longitudeDelta: 0.015,
          }}
        >
          {/* Add a Marker for the simulated location */}
          {location && (
            <Marker
              key="simulated-user"
              coordinate={{
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
              }}
              title="Simulated Position"
              // Optional: Customize marker appearance
              // pinColor="blue" 
              // image={require('../assets/custom_marker.png')} 
            />
          )}
        </MapView>
        
        {/* Intersection Approach Notification */}
        <Animated.View 
          style={[ styles.notification, { transform: [{ translateY: notificationAnim }] } ]}
        >
          <Text style={styles.notificationText}>
            {currentIntersection ? `Approaching ${currentIntersection}` : ''}
          </Text>
        </Animated.View>
      </View>
      
      {/* Alert Overlay */}
      <AlertComponent 
        visible={showAlert} 
        onTimeout={() => setShowAlert(false)} 
      />
    </View>
  );
};

// --- Styles (Keep as is) ---
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
    flexDirection: 'row', 
    justifyContent: 'space-between',
  },
  statusText: {
    color: '#fff',
    fontSize: 14,
  },
  mapContainer: {
    height: Dimensions.get('window').height * 0.5,
    position: 'relative',
  },
  map: {
    height: '100%',
  },
  notification: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  notificationText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

// Export the new component name
export default SimulationScreen;
