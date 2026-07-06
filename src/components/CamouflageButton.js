import { useRef, useMemo, useEffect, useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  Animated,
  Easing,
  PanResponder,
  Dimensions,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";

const BUBBLE_SIZE = 50;
const STORAGE_KEY = "@camouflage_bubble_position";
const LONG_PRESS_MS = 300;
const DRAG_THRESHOLD = 10;

const defaultPos = () => {
  const { width, height } = Dimensions.get("window");
  return {
    x: width - BUBBLE_SIZE - 16,
    y: height - BUBBLE_SIZE - 100,
  };
};

const clampPos = (pos) => {
  const { width, height } = Dimensions.get("window");
  return {
    x: Math.max(0, Math.min(pos.x, width - BUBBLE_SIZE)),
    y: Math.max(0, Math.min(pos.y, height - BUBBLE_SIZE)),
  };
};

export default function CamouflageButton() {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const basePos = useRef(defaultPos());
  const pan = useRef(new Animated.ValueXY(basePos.current)).current;
  const lastOffset = useRef({ x: 0, y: 0 });

  const isLongPressed = useRef(false);
  const didDrag = useRef(false);
  const longPressTimer = useRef(null);
  const [dragging, setDragging] = useState(false);

  const bounce = useRef(new Animated.Value(0)).current;
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const pos = clampPos(JSON.parse(raw));
          basePos.current = pos;
          pan.setValue(pos);
        }
      } catch {}
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, {
          toValue: 1,
          duration: 2500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(bounce, {
          toValue: 0,
          duration: 2500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const bounceY = bounce.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, -8, 0],
  });

  const save = useCallback(async (pos) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
    } catch {}
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => isLongPressed.current,

      onPanResponderGrant: () => {
        isLongPressed.current = false;
        didDrag.current = false;
        lastOffset.current = { x: 0, y: 0 };
        setDragging(false);

        longPressTimer.current = setTimeout(() => {
          isLongPressed.current = true;
          bounce.setValue(0);
          setDragging(true);
        }, LONG_PRESS_MS);
      },

      onPanResponderMove: (_, gs) => {
        lastOffset.current = { x: gs.dx, y: gs.dy };

        if (isLongPressed.current) {
          didDrag.current = true;
          pan.setValue({
            x: basePos.current.x + gs.dx,
            y: basePos.current.y + gs.dy,
          });
        } else if (
          Math.abs(gs.dx) > DRAG_THRESHOLD ||
          Math.abs(gs.dy) > DRAG_THRESHOLD
        ) {
          clearTimeout(longPressTimer.current);
        }
      },

      onPanResponderRelease: () => {
        clearTimeout(longPressTimer.current);

        if (isLongPressed.current && didDrag.current) {
          const final = clampPos({
            x: basePos.current.x + lastOffset.current.x,
            y: basePos.current.y + lastOffset.current.y,
          });
          basePos.current = final;
          pan.setValue(final);
          save(final);
        } else if (!isLongPressed.current) {
          navigation.navigate("FakeApp");
        }

        isLongPressed.current = false;
        didDrag.current = false;
        setDragging(false);
      },

      onPanResponderTerminate: () => {
        clearTimeout(longPressTimer.current);
        pan.setValue(basePos.current);
        isLongPressed.current = false;
        didDrag.current = false;
        setDragging(false);
      },
    })
  ).current;

  useEffect(() => {
    return () => clearTimeout(longPressTimer.current);
  }, []);

  return (
    <Animated.View
      style={[
        s.container,
        { left: pan.x, top: pan.y, opacity: loaded ? 1 : 0 },
      ]}
      {...panResponder.panHandlers}
    >
      <Animated.View
        style={{ transform: [{ translateY: dragging ? 0 : bounceY }] }}
      >
        <View
          style={[
            s.bubble,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              transform: [{ scale: dragging ? 1.15 : 1 }],
            },
          ]}
        >
          <Ionicons
            name="apps-outline"
            size={22}
            color={colors.textSecondary}
          />
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    container: {
      position: "absolute",
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
