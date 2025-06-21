import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, TextInput, Button, RadioButton, useTheme } from 'react-native-paper';
import { redeemVoucher } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { bubblyButton } from '../../assets/styles/global';

const RedeemVoucherScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const [voucherCode, setVoucherCode] = useState('');
  const [voucherType, setVoucherType] = useState('shoprite');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { updateBalance } = useAuth();

  const handleRedeem = async () => {
    if (!voucherCode) {
      setError('Please enter voucher code');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const result = await redeemVoucher(voucherCode, voucherType);
      updateBalance(result.newBalance);
      setSuccess(`Success! R${result.amountAdded.toFixed(2)} added to your account`);
      setVoucherCode('');
    } catch (err) {
      setError(err.message || 'Failed to redeem voucher');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Redeem Voucher</Text>
      
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {success ? <Text style={styles.success}>{success}</Text> : null}
      
      <TextInput
        label="Voucher Code"
        value={voucherCode}
        onChangeText={setVoucherCode}
        mode="outlined"
        style={styles.input}
        autoCapitalize="none"
      />
      
      <Text style={styles.label}>Voucher Type:</Text>
      
      <RadioButton.Group onValueChange={setVoucherType} value={voucherType}>
        <View style={styles.radioGroup}>
          <View style={styles.radioItem}>
            <RadioButton 
              value="shoprite" 
              color={colors.shoprite} 
              uncheckedColor={colors.shoprite}
            />
            <Text style={styles.radioLabel}>Shoprite Money</Text>
          </View>
          
          <View style={styles.radioItem}>
            <RadioButton 
              value="capitec" 
              color={colors.capitec} 
              uncheckedColor={colors.capitec}
            />
            <Text style={styles.radioLabel}>Capitec Cash Send</Text>
          </View>
          
          <View style={styles.radioItem}>
            <RadioButton 
              value="standardbank" 
              color={colors.standardBank} 
              uncheckedColor={colors.standardBank}
            />
            <Text style={styles.radioLabel}>Standard Bank Instant Money</Text>
          </View>
        </View>
      </RadioButton.Group>
      
      <Button
        mode="contained"
        onPress={handleRedeem}
        loading={loading}
        disabled={loading}
        style={[styles.button, bubblyButton]}
        labelStyle={styles.buttonLabel}
      >
        Redeem Voucher
      </Button>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5'
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center'
  },
  input: {
    marginBottom: 20,
    backgroundColor: '#fff'
  },
  label: {
    marginBottom: 10,
    fontSize: 16,
    fontWeight: 'bold'
  },
  radioGroup: {
    marginBottom: 25
  },
  radioItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10
  },
  radioLabel: {
    marginLeft: 8,
    fontSize: 16
  },
  button: {
    marginTop: 10,
    paddingVertical: 8
  },
  buttonLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold'
  },
  error: {
    color: 'red',
    textAlign: 'center',
    marginBottom: 15
  },
  success: {
    color: 'green',
    textAlign: 'center',
    marginBottom: 15,
    fontWeight: 'bold'
  }
});

export default RedeemVoucherScreen;
