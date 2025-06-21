import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { TextInput, Button } from 'react-native-paper';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../assets/styles/colors';
import { bubblyButton, bubblyInput } from '../../assets/styles/global';

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Image 
        source={require('../../assets/images/logo.png')} 
        style={styles.logo} 
      />
      
      <Text style={styles.title}>Welcome Back!</Text>
      
      {error ? <Text style={styles.error}>{error}</Text> : null}
      
      <TextInput
        label="Email"
        value={email}
        onChangeText={setEmail}
        mode="outlined"
        style={[styles.input, bubblyInput]}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      
      <TextInput
        label="Password"
        value={password}
        onChangeText={setPassword}
        mode="outlined"
        secureTextEntry
        style={[styles.input, bubblyInput]}
      />
      
      <Button 
        mode="contained" 
        onPress={handleLogin}
        loading={loading}
        style={[styles.button, bubblyButton]}
        labelStyle={styles.buttonLabel}
      >
        Login
      </Button>
      
      <TouchableOpacity onPress={() => navigation.navigate('Register')}>
        <Text style={styles.link}>Don't have an account? Register</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5'
  },
  logo: {
    width: 150,
    height: 150,
    alignSelf: 'center',
    marginBottom: 30
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: colors.primary
  },
  input: {
    marginBottom: 15,
    backgroundColor: '#fff'
  },
  button: {
    marginTop: 10,
    backgroundColor: colors.primary,
    borderRadius: 25,
    paddingVertical: 8
  },
  buttonLabel: {
    color: '#fff',
    fontSize: 16
  },
  link: {
    marginTop: 20,
    textAlign: 'center',
    color: colors.secondary,
    textDecorationLine: 'underline'
  },
  error: {
    color: 'red',
    textAlign: 'center',
    marginBottom: 15
  }
});

export default LoginScreen;
