import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Dimensions, Text, Animated } from 'react-native';
import * as Location from 'expo-location';
import MapView from 'react-native-maps';
import { CameraView, useCameraPermissions } from 'expo-camera';
import LoadingComponent from './LoadingComponent';
import AlertComponent from './AlertComponent';
import { checkNearbyIntersections, loadIntersections } from '../services/IntersectionService';
import io from 'socket.io-client';

const SOCKET_URL = 'http://100.66.13.84:8000';
const socket = io(SOCKET_URL, {
  transports: ['websocket'],
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

const COOLDOWN_DURATION = 5000; // 5 seconds in milliseconds
const INTERSECTION_CHECK_RADIUS_KM = 0.3; // 20 meters

const MapScreen: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [showAlert, setShowAlert] = useState(false);
  const [isNearIntersection, setIsNearIntersection] = useState(false);
  const [isNearCooldown, setIsNearCooldown] = useState<boolean>(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [currentIntersection, setCurrentIntersection] = useState<string | null>(null);
  const notificationAnim = useRef(new Animated.Value(100)).current;
  const mapRef = useRef<MapView>(null);
  const cameraRef = useRef<CameraView>(null);
  const streamingInterval = useRef<NodeJS.Timeout | null>(null);
  const isNearCooldownTimer = useRef<NodeJS.Timeout | null>(null);
  const isMounted = useRef(true);
  const [isCapturing, setIsCapturing] = useState(false);

  useEffect(() => {
    const handleConnect = () => {
      console.log('Socket connected');
    };

    const handleDisconnect = () => {
      console.log('Socket disconnected');
    };

    const handleCarDetection = () => {
      setShowAlert(true);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('receiveStreaming', handleCarDetection);

    if (!socket.connected) {
      socket.connect();
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('receiveStreaming', handleCarDetection);
    };
  }, []);

  const showNotification = (intersectionName: string) => {
    setCurrentIntersection(intersectionName);
    Animated.sequence([
      Animated.timing(notificationAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.delay(3000),
      Animated.timing(notificationAnim, {
        toValue: 100,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start(() => setCurrentIntersection(null));
  };

  useEffect(() => {
    let isSubscribed = true;
    const initialize = async () => {
      if (!cameraPermission?.granted) {
        console.log("Requesting camera permission...");
        await requestCameraPermission();
      }

      console.log("Loading intersections...");
      const loaded = await loadIntersections();
      if (!loaded && isSubscribed) {
        console.error('Failed to load intersections');
        setLoading(false);
      } else if (loaded && isSubscribed) {
         console.log(`Intersections loaded.`);
      }
      if (isSubscribed) {
        setLoading(false);
      }
    };

    initialize();

    return () => {
      isSubscribed = false;
    };
  }, [cameraPermission]);

  useEffect(() => {
    let locationSubscription: Location.LocationSubscription | null = null;

    const startLocationTracking = async () => {
        console.log("Starting location tracking...");
        try {
            locationSubscription = await Location.watchPositionAsync(
                {
                    accuracy: Location.Accuracy.BestForNavigation,
                    timeInterval: 1000,
                    distanceInterval: 0,
                },
                (newLocation) => {
                    setLocation(newLocation);
                }
            );
            console.log("Location tracking started.");
        } catch (error) {
            console.error("Error starting location tracking:", error);
        }
    };

    const stopLocationTracking = () => {
        if (locationSubscription) {
            console.log("Stopping location tracking...");
            locationSubscription.remove();
            locationSubscription = null;
            console.log("Location tracking stopped.");
        }
    };

    (async () => {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
            startLocationTracking();
        } else {
            console.error('Location permission denied');
            setLoading(false);
        }
    })();

    return () => {
        stopLocationTracking();
        if (isNearCooldownTimer.current) {
             clearTimeout(isNearCooldownTimer.current);
        }
    };
  }, []);

  useEffect(() => {
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

          if (isNearCooldownTimer.current) {
              clearTimeout(isNearCooldownTimer.current);
          }

          isNearCooldownTimer.current = setTimeout(() => {
              console.log("Cooldown finished.");
              setIsNearCooldown(false);
              isNearCooldownTimer.current = null;
          }, COOLDOWN_DURATION);
      }
  }, [location, isNearIntersection, isNearCooldown]);

  useEffect(() => {
    const startFrameSendingInterval = () => {
        if (streamingInterval.current) return;
        console.log("Starting frame sending interval...");
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
        }, 1000);
    };

    const stopFrameSendingInterval = () => {
        if (streamingInterval.current) {
            console.log("Stopping frame sending interval.");
            clearInterval(streamingInterval.current);
            streamingInterval.current = null;
        }
    };

    if (isNearIntersection && cameraPermission?.granted && socket.connected) {
        startFrameSendingInterval();
    } else {
        stopFrameSendingInterval();
    }

    return () => {
        stopFrameSendingInterval();
    };
  }, [isNearIntersection, cameraPermission?.granted, socket.connected]);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;

    if (showAlert) {
      clearTimeout(timeoutId!);

      timeoutId = setTimeout(() => {
        if (isMounted.current) {
          setShowAlert(false);
        }
      }, 5000);
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [showAlert]);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  if (loading) {
     return <LoadingComponent visible={true} />;
  }

  if (!cameraPermission?.granted) {
    return (
      <View style={styles.container}>
        <Text>Camera permission is required to function fully.</Text>
      </View>
    );
  }

  if (!location) {
    return (
      <View style={styles.container}>
        <Text>Waiting for location data... Ensure location services are enabled.</Text>
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
          animateShutter={false}
        >
          <View style={styles.statusBar}>
            <Text style={styles.statusText}>
              {isNearIntersection ? 'Detecting Cars' : 'Monitoring'}
            </Text>
          </View>
        </CameraView>
      </View>
      
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          showsUserLocation={true}
          followsUserLocation={true}
          initialRegion={{
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
        />
        
        <Animated.View 
          style={[
            styles.notification,
            {
              transform: [{ translateY: notificationAnim }]
            }
          ]}
        >
          <Text style={styles.notificationText}>
            {currentIntersection ? `Approaching ${currentIntersection}` : ''}
          </Text>
        </Animated.View>
      </View>
      
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

export default MapScreen;