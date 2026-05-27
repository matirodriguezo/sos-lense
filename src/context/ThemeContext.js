import { createContext, useContext, useState, useEffect, useMemo } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LIGHT_COLORS, DARK_COLORS } from "../constants/theme";

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme();
  const [mode, setMode] = useState("light");

  useEffect(() => {
    AsyncStorage.getItem("@theme_mode").then((stored) => {
      if (stored === "dark" || stored === "light") setMode(stored);
      else if (systemScheme === "dark") setMode("dark");
    });
  }, []);

  const toggleTheme = () => {
    const next = mode === "light" ? "dark" : "light";
    setMode(next);
    AsyncStorage.setItem("@theme_mode", next);
  };

  const value = useMemo(
    () => ({
      colors: mode === "dark" ? DARK_COLORS : LIGHT_COLORS,
      isDark: mode === "dark",
      toggleTheme,
    }),
    [mode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) return { colors: LIGHT_COLORS, isDark: false, toggleTheme: () => {} };
  return ctx;
}
