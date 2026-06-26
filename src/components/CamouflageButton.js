import { useRef, useMemo, useEffect } from "react";
import { TouchableOpacity, StyleSheet, Animated, Easing } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";

const BUBBLE_SIZE = 50;

export default function CamouflageButton() {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const animBounce = useRef(new Animated.Value(0)).current;

  const s = useMemo(() => makeStyles(colors), [colors]);

  useEffect(() => {
    const bounce = Animated.loop(
      Animated.sequence([
        Animated.timing(animBounce, { toValue: 1, duration: 2500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(animBounce, { toValue: 0, duration: 2500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    bounce.start();
    return () => bounce.stop();
  }, []);

  const bounceY = animBounce.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, -8, 0],
  });

  const handlePress = () => {
    navigation.navigate("FakeApp");
  };

  return (
    <Animated.View style={[s.container, { transform: [{ translateY: bounceY }] }]}>
      <TouchableOpacity
        style={[s.bubble, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        <Ionicons name="apps-outline" size={22} color={colors.textSecondary} />
      </TouchableOpacity>
    </Animated.View>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    container: {
      position: "absolute",
      bottom: 160,
      right: 16,
      zIndex: 999,
    },
    bubble: {
      width: BUBBLE_SIZE,
      height: BUBBLE_SIZE,
      borderRadius: BUBBLE_SIZE / 2,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 6,
    },
  });
