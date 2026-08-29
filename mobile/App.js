import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/AuthContext';
import AuthScreen from './src/screens/AuthScreen';
import LobbyScreen from './src/screens/LobbyScreen';
import LiveGameScreen from './src/screens/LiveGameScreen';
import ScoreGameScreen from './src/screens/ScoreGameScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import { colors } from './src/theme';

const Stack = createNativeStackNavigator();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.ivory,
    primary: colors.felt,
  },
};

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.feltDark }}>
        <ActivityIndicator size="large" color={colors.gold} />
      </View>
    );
  }

  if (!user) return <AuthScreen />;

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Lobby" component={LobbyScreen} />
        <Stack.Screen name="LiveGame" component={LiveGameScreen} />
        <Stack.Screen name="ScoreGame" component={ScoreGameScreen} />
        <Stack.Screen name="History" component={HistoryScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="light" />
        <AppContent />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
