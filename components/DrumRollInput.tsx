import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface DrumRollInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}

export default function DrumRollInput({
  label,
  value,
  onChange,
  min = -200,
  max = 200,
}: DrumRollInputProps) {
  const handleChange = (delta: number) => {
    const newValue = Math.max(min, Math.min(max, value + delta));
    onChange(newValue);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.drumRoll}>
        <View style={styles.row}>
          <TouchableOpacity
            style={styles.button}
            onPress={() => handleChange(10)}
          >
            <Text style={styles.buttonText}>+10</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.button}
            onPress={() => handleChange(1)}
          >
            <Text style={styles.buttonText}>+1</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.display}>
          <Text style={styles.displayText}>
            {value > 0 ? '+' : ''}{value}
          </Text>
        </View>
        <View style={styles.row}>
          <TouchableOpacity
            style={styles.button}
            onPress={() => handleChange(-10)}
          >
            <Text style={styles.buttonText}>-10</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.button}
            onPress={() => handleChange(-1)}
          >
            <Text style={styles.buttonText}>-1</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '48%',
    marginBottom: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 6,
  },
  drumRoll: {
    gap: 4,
  },
  row: {
    flexDirection: 'row',
    gap: 4,
  },
  button: {
    flex: 1,
    backgroundColor: '#e9ecef',
    borderWidth: 1,
    borderColor: '#adb5bd',
    borderRadius: 4,
    paddingVertical: 6,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#495057',
  },
  display: {
    borderWidth: 2,
    borderColor: '#2a5298',
    borderRadius: 6,
    backgroundColor: '#fff',
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  displayText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e3c72',
  },
});
