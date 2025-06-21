import { StyleSheet } from 'react-native';

export const bubblyButton = {
  borderRadius: 25,
  shadowColor: '#000',
  shadowOffset: {
    width: 0,
    height: 2,
  },
  shadowOpacity: 0.25,
  shadowRadius: 3.84,
  elevation: 5,
};

export const bubblyInput = {
  borderRadius: 10,
  shadowColor: '#000',
  shadowOffset: {
    width: 0,
    height: 1,
  },
  shadowOpacity: 0.2,
  shadowRadius: 1.41,
  elevation: 2,
};

export const colors = {
  primary: '#6C63FF',
  secondary: '#FF6584',
  shoprite: '#E31937', // Shoprite red
  capitec: '#00AEEF', // Capitec blue
  standardBank: '#007E32', // Standard Bank green
  background: '#F5F5F5',
  text: '#333333',
  lightText: '#666666',
  border: '#DDDDDD',
  success: '#4CAF50',
  error: '#F44336',
  warning: '#FFC107',
  info: '#2196F3'
};

export const theme = {
  colors: {
    primary: colors.primary,
    accent: colors.secondary,
    background: colors.background,
    surface: '#FFFFFF',
    text: colors.text,
    disabled: '#AAAAAA',
    placeholder: colors.lightText,
    backdrop: '#00000080',
    notification: colors.secondary,
    ...colors
  },
  fonts: {
    regular: 'Roboto-Regular',
    medium: 'Roboto-Medium',
    light: 'Roboto-Light',
    thin: 'Roboto-Thin'
  },
  animation: {
    scale: 1.0
  }
};

export const globalStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 16
  },
  card: {
    borderRadius: 12,
    elevation: 3,
    marginBottom: 16,
    backgroundColor: '#FFFFFF'
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    color: colors.primary
  },
  subheader: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: colors.text
  },
  paragraph: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.text,
    marginBottom: 12
  },
  label: {
    fontSize: 14,
    color: colors.lightText,
    marginBottom: 4
  },
  input: {
    backgroundColor: '#FFFFFF',
    marginBottom: 12
  },
  button: {
    marginVertical: 8
  }
});
