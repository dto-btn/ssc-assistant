export type PlaygroundTheme = "light" | "dark";

export interface ThemeContextValue {
  theme: PlaygroundTheme;
  toggleTheme: () => void;
  setTheme: (next: PlaygroundTheme) => void;
}
