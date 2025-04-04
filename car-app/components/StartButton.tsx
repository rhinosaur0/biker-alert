import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert } from 'react-native';

interface StartButtonProps {
  onStart: () => void;
  locationPermission: boolean;
}

const StartButton: React.FC<StartButtonProps> = ({ onStart, locationPermission }) => {
  const handlePress = () => {
    if (!locationPermission) {
      Alert.alert(
        "Permission Required",
        "Location permission is needed for this app to work properly.",
        [{ text: "OK" }]
      );
      return;
    }
    onStart();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Bike Safety App</Text>
      <TouchableOpacity 
        style={styles.button} 
        onPress={handlePress}
      >
        <Text style={styles.buttonText}>Start Biking</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 40,
  },
  button: {
    backgroundColor: '#4CAF50',
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 25,
    elevation: 3,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default StartButton;