export type AuthThemeColors = {
  bg: string;
  surfaceContainer: string;
  surfaceContainerLow: string;
  surfaceContainerHigh: string;
  primary: string;
  primaryHover: string;
  primaryText: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  secondaryContainer: string;
  onSecondaryContainer: string;
  outlineVariant: string;
  textPrimary: string;
  textSecondary: string;
  shadowColor: string;
  labelBg: string;
  focusBorder: string;
  focusRing: string;
  inputBorder: string;
  inputBorderHover: string;
};

export const authThemes = {
  light: {
    bg: "bg-[#F8F9FF]",
    surfaceContainer: "bg-[#EEF0F8]",
    surfaceContainerLow: "bg-[#F3F3FA]",
    surfaceContainerHigh: "bg-[#E2E2E9]",
    primary: "bg-[#0061A4]",
    primaryHover: "hover:bg-[#004A80]",
    primaryText: "text-[#0061A4]",
    onPrimary: "text-white",
    primaryContainer: "bg-[#D1E4FF]",
    onPrimaryContainer: "text-[#001D36]",
    secondaryContainer: "bg-[#D7E3F8]",
    onSecondaryContainer: "text-[#101C2B]",
    outlineVariant: "border-[#C3C7D0]",
    textPrimary: "text-[#191C20]",
    textSecondary: "text-[#43474E]",
    shadowColor: "shadow-indigo-900/10",
    labelBg: "bg-[#F8F9FF]",
    focusBorder: "border-[#0061A4]",
    focusRing: "ring-[#0061A4]/20",
    inputBorder: "border-[#C3C7D0]",
    inputBorderHover: "hover:border-[#73777F]",
  },
  dark: {
    bg: "bg-[#111318]",
    surfaceContainer: "bg-[#1E2025]",
    surfaceContainerLow: "bg-[#191C20]",
    surfaceContainerHigh: "bg-[#282A2F]",
    primary: "bg-[#9ECAFF]",
    primaryHover: "hover:bg-[#B8D8FF]",
    primaryText: "text-[#9ECAFF]",
    onPrimary: "text-[#003258]",
    primaryContainer: "bg-[#00497D]",
    onPrimaryContainer: "text-[#D1E4FF]",
    secondaryContainer: "bg-[#3B4758]",
    onSecondaryContainer: "text-[#D7E3F8]",
    outlineVariant: "border-[#43474E]",
    textPrimary: "text-[#E2E2E9]",
    textSecondary: "text-[#C3C7D0]",
    shadowColor: "shadow-black/40",
    labelBg: "bg-[#191C20]",
    focusBorder: "border-[#9ECAFF]",
    focusRing: "ring-[#9ECAFF]/20",
    inputBorder: "border-[#43474E]",
    inputBorderHover: "hover:border-[#8C9199]",
  },
} satisfies Record<"light" | "dark", AuthThemeColors>;

export function getAuthTheme(isDark: boolean): AuthThemeColors {
  return isDark ? authThemes.dark : authThemes.light;
}
