/**
 * Login screen for lama.app
 */

import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useOneContext } from '@src/providers/OneProvider';

export default function LoginScreen() {
  const router = useRouter();
  const { login, authState } = useOneContext();

  const [email, setEmail] = useState('demo@example.com');
  const [secret, setSecret] = useState('demo123');
  const [instanceName, setInstanceName] = useState('lama-mobile');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !secret || !instanceName) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);

    try {
      await login(email, secret, instanceName);
      // Navigation will happen automatically when authState changes
      console.log('[LoginScreen] Login successful, waiting for redirect...');
    } catch (error: any) {
      console.error('[LoginScreen] Login error:', error);
      Alert.alert('Login Failed', error.message || 'An error occurred during login');
      setLoading(false);
    }
  };

  const isLoggingIn = loading || authState === 'logging_in';

  return (
    <View style={styles.container}>
      <View style={styles.form}>
        <Text style={styles.title}>Welcome to LAMA</Text>
        <Text style={styles.subtitle}>Local AI Messaging Assistant</Text>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="email@example.com"
            autoCapitalize="none"
            keyboardType="email-address"
            editable={!isLoggingIn}
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={secret}
            onChangeText={setSecret}
            placeholder="Enter password"
            secureTextEntry
            editable={!isLoggingIn}
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Instance Name</Text>
          <TextInput
            style={styles.input}
            value={instanceName}
            onChangeText={setInstanceName}
            placeholder="lama-mobile"
            autoCapitalize="none"
            editable={!isLoggingIn}
          />
        </View>

        <TouchableOpacity
          style={[styles.button, isLoggingIn && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={isLoggingIn}
        >
          {isLoggingIn ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Login / Register</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.helpText}>
          Enter any email and password. If the account doesn't exist, it will be created automatically.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    padding: 20,
  },
  form: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  button: {
    backgroundColor: '#16a34a',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    backgroundColor: '#86efac',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  helpText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 18,
  },
});
