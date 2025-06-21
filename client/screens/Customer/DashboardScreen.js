import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Card, Button, useTheme } from 'react-native-paper';
import { useAuth } from '../../context/AuthContext';
import { getCustomerProfile } from '../../services/api';
import { colors } from '../../assets/styles/colors';
import { bubblyButton } from '../../assets/styles/global';

const DashboardScreen = ({ navigation }) => {
  const { user } = useAuth();
  const { colors: themeColors } = useTheme();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadProfile = async () => {
    try {
      const data = await getCustomerProfile();
      setProfile(data);
    } catch (err) {
      console.error('Failed to load profile:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadProfile();
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.greeting}>Hello, {user?.firstName || 'Customer'}!</Text>
          
          <View style={styles.balanceContainer}>
            <Text style={styles.balanceLabel}>Your Balance:</Text>
            <Text style={styles.balanceAmount}>R {profile?.balance?.toFixed(2) || '0.00'}</Text>
          </View>
        </Card.Content>
      </Card>

      <View style={styles.buttonGroup}>
        <Button
          mode="contained"
          onPress={() => navigation.navigate('RedeemVoucher')}
          style={[styles.actionButton, bubblyButton, { backgroundColor: colors.shoprite }]}
          labelStyle={styles.actionButtonLabel}
          icon="barcode-scan"
        >
          Redeem Voucher
        </Button>

        <Button
          mode="contained"
          onPress={() => navigation.navigate('Withdraw')}
          style={[styles.actionButton, bubblyButton, { backgroundColor: colors.standardBank }]}
          labelStyle={styles.actionButtonLabel}
          icon="bank-transfer-out"
        >
          Withdraw Money
        </Button>

        <Button
          mode="contained"
          onPress={() => navigation.navigate('Transfer')}
          style={[styles.actionButton, bubblyButton, { backgroundColor: colors.capitec }]}
          labelStyle={styles.actionButtonLabel}
          icon="account-arrow-right"
        >
          Send Money
        </Button>

        <Button
          mode="contained"
          onPress={() => navigation.navigate('Profile')}
          style={[styles.actionButton, bubblyButton]}
          labelStyle={styles.actionButtonLabel}
          icon="account-cog"
        >
          My Profile
        </Button>
      </View>

      <Card style={styles.card}>
        <Card.Title title="Recent Transactions" />
        <Card.Content>
          {profile?.transactions?.length > 0 ? (
            profile.transactions.slice(0, 3).map((txn) => (
              <View key={txn._id} style={styles.transactionItem}>
                <Text style={styles.transactionType}>{txn.type}</Text>
                <Text style={[
                  styles.transactionAmount,
                  { color: txn.amount > 0 ? themeColors.success : themeColors.error }
                ]}>
                  {txn.amount > 0 ? '+' : ''}{txn.amount.toFixed(2)}
                </Text>
              </View>
            ))
          ) : (
            <Text>No transactions yet</Text>
          )}
          {profile?.transactions?.length > 3 && (
            <Button onPress={() => navigation.navigate('Transactions')}>
              View All Transactions
            </Button>
          )}
        </Card.Content>
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 15,
    paddingBottom: 30
  },
  card: {
    marginBottom: 20,
    borderRadius: 15,
    elevation: 3
  },
  greeting: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15
  },
  balanceContainer: {
    alignItems: 'center',
    marginVertical: 10
  },
  balanceLabel: {
    fontSize: 16,
    color: '#666'
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.primary,
    marginTop: 5
  },
  buttonGroup: {
    marginBottom: 20
  },
  actionButton: {
    marginBottom: 15,
    borderRadius: 25,
    paddingVertical: 10
  },
  actionButtonLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold'
  },
  transactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee'
  },
  transactionType: {
    textTransform: 'capitalize',
    fontSize: 16
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: 'bold'
  }
});

export default DashboardScreen;
