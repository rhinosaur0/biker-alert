import React, { useEffect } from 'react';
import { StyleSheet, View, Text, Vibration } from 'react-native';

interface AlertComponentProps {
  visible: boolean;
  onTimeout: () => void;
}

const AlertComponent: React.FC<AlertComponentProps> = ({ visible, onTimeout }) => {
  useEffect(() => {
    if (visible) {
      // Vibrate pattern: wait 500ms, vibrate for 500ms, wait 500ms, vibrate for 500ms
      Vibration.vibrate([500, 500, 500, 500]);
      
      const timer = setTimeout(() => {
        onTimeout();
      }, 5000);
      
      return () => {
        clearTimeout(timer);
        Vibration.cancel();
      };
    }
  }, [visible, onTimeout]);
  
  if (!visible) return null;
  
  return (
    <View style={styles.container}>
      <Text style={styles.alertText}>DANGER!</Text>
      <Text style={styles.subText}>Car detected</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 0, 0, 0.85)',
    zIndex: 100,
  },
  alertText: {
    color: 'white',
    fontSize: 48,
    fontWeight: 'bold',
  },
  subText: {
    color: 'white',
    fontSize: 24,
    marginTop: 20,
  },
});

export default AlertComponent;