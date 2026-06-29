import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider } from "./src/context/ThemeContext";
import { NotificationProvider } from "./src/context/NotificationContext";
import { AuthProvider } from "./src/context/AuthContext";
import NotificationBanner from "./src/components/NotificationBanner";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Component } from "react";
import { View, Text, ScrollView } from "react-native";
import AppNavigator from "./src/navigation/AppNavigator";
import FakeAppScreen from "./src/screens/FakeAppScreen";
import { navigationRef } from "./src/navigation/navigationRef";

const RootStack = createNativeStackNavigator();

class ErrorBoundary extends Component {
  state = { hasError: false, error: null, stack: "" };

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error: error,
      stack: errorInfo.componentStack || errorInfo.stack || String(error),
    });
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: "#1a1a1a", padding: 20, paddingTop: 60 }}>
          <Text style={{ color: "#ff4444", fontSize: 20, fontWeight: "bold", marginBottom: 12 }}>
            Error
          </Text>
          <Text style={{ color: "#ffffff", fontSize: 14, marginBottom: 8 }}>
            {this.state.error?.message || String(this.state.error)}
          </Text>
          <ScrollView style={{ flex: 1 }}>
            <Text style={{ color: "#aaaaaa", fontSize: 12, fontFamily: "monospace" }}>
              {this.state.stack}
            </Text>
          </ScrollView>
        </View>
      );
    }
    return this.props.children;
  }
}

function AppInner() {
  return (
    <AuthProvider>
      <>
        <AppNavigator />
        <NotificationBanner />
      </>
    </AuthProvider>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <ThemeProvider>
          <NotificationProvider>
            <NavigationContainer ref={navigationRef}>
              <RootStack.Navigator screenOptions={{ headerShown: false, animation: "slide_from_bottom" }}>
                <RootStack.Screen name="Main" component={AppInner} />
                <RootStack.Screen
                  name="FakeApp"
                  component={FakeAppScreen}
                  options={{ animation: "fade", presentation: "fullScreenModal" }}
                />
              </RootStack.Navigator>
            </NavigationContainer>
          </NotificationProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
