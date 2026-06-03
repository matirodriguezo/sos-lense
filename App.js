import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider } from "./src/context/ThemeContext";
import { NotificationProvider } from "./src/context/NotificationContext";
import NotificationBanner from "./src/components/NotificationBanner";
import { Component, createRef } from "react";
import { View, Text, ScrollView } from "react-native";
import AppNavigator from "./src/navigation/AppNavigator";

export const navigationRef = createRef();

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
    <>
      <AppNavigator />
      <NotificationBanner />
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <ThemeProvider>
          <NotificationProvider>
            <NavigationContainer ref={navigationRef}>
              <AppInner />
            </NavigationContainer>
          </NotificationProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}