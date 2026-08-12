import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react"
import {
  generateTheme,
  applyTheme,
  tokensToCssVars,
  resolveColorMode,
  sourceColorFromImage,
  hexFromArgb,
  Variant,
  type GeneratedTheme,
  type ColorMode,
} from "material-shadcn"

const MATERIAL_RADIUS = "1rem"

/** M3 shape tokens + shadcn sidebar var alias (material-shadcn emits sidebar-background). */
function withMaterialShapeTokens(
  tokens: Record<string, string>
): Record<string, string> {
  const vars = tokensToCssVars(tokens) as Record<string, string>
  vars["--radius"] = MATERIAL_RADIUS
  const sidebar = tokens["sidebar-background"]
  if (sidebar) {
    vars["--sidebar"] = sidebar
  }
  return vars
}

function applyMaterialShapeTokens(
  element: HTMLElement,
  tokens: Record<string, string>
) {
  element.style.setProperty("--radius", MATERIAL_RADIUS)
  const sidebar = tokens["sidebar-background"]
  if (sidebar) {
    element.style.setProperty("--sidebar", sidebar)
  }
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface ThemeContextValue {
  seed: string
  variant: Variant
  colorMode: ColorMode
  resolvedDark: boolean
  hydrated: boolean
  theme: GeneratedTheme
  setSeed: (seed: string | HTMLImageElement) => void
  setVariant: (variant: Variant) => void
  setColorMode: (mode: ColorMode) => void
  cycleColorMode: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function normalizeVariant(input?: Variant | keyof typeof Variant): Variant {
  if (input === undefined) return Variant.TONAL_SPOT
  if (typeof input === "string" && input in Variant) {
    return Variant[input as keyof typeof Variant]
  }
  return input as Variant
}

// ---------------------------------------------------------------------------
// useTheme
// ---------------------------------------------------------------------------

function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error("useTheme must be used within a <Theme> provider")
  }
  return ctx
}

// ---------------------------------------------------------------------------
// Persistence helpers
// ---------------------------------------------------------------------------

interface StoredSettings {
  seed: string
  variant: Variant
  colorMode: ColorMode
}

function loadSettings(key: string | null, defaults: StoredSettings): StoredSettings {
  if (!key || typeof window === "undefined") return defaults
  try {
    const raw = localStorage.getItem(key)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        seed: parsed.seed ?? defaults.seed,
        variant: parsed.variant ?? defaults.variant,
        colorMode: parsed.colorMode ?? defaults.colorMode,
      }
    }
  } catch {}
  return defaults
}

function saveSettings(key: string | null, settings: StoredSettings) {
  if (!key || typeof window === "undefined") return
  try {
    localStorage.setItem(key, JSON.stringify(settings))
  } catch {}
}

// ---------------------------------------------------------------------------
// Resolve seed (string | HTMLImageElement) → hex string
// ---------------------------------------------------------------------------

function useSeedResolver(
  input: string | HTMLImageElement,
  fallback: string
): string {
  const [resolved, setResolved] = useState(
    typeof input === "string" ? input : fallback
  )

  useEffect(() => {
    if (typeof input === "string") {
      setResolved(input)
      return
    }
    let cancelled = false
    sourceColorFromImage(input).then((argb) => {
      if (!cancelled) setResolved(hexFromArgb(argb))
    })
    return () => {
      cancelled = true
    }
  }, [input])

  return resolved
}

// ---------------------------------------------------------------------------
// <Theme> component
// ---------------------------------------------------------------------------

interface ThemeRootProps {
  seed?: string | HTMLImageElement
  variant?: Variant | keyof typeof Variant
  contrast?: number
  colorMode?: ColorMode
  storageKey?: string | null
  children: ReactNode
}

type ThemeScopedProps = ComponentPropsWithoutRef<"div"> & {
  seed: string | HTMLImageElement
  variant?: Variant | keyof typeof Variant
  contrast?: number
  dark?: boolean
  children: ReactNode
}

type ThemeProps = ThemeRootProps | ThemeScopedProps

function Theme(props: ThemeProps) {
  const parent = useContext(ThemeContext)
  if (parent) {
    return <ScopedTheme {...(props as ThemeScopedProps)} />
  }
  return <RootTheme {...(props as ThemeRootProps)} />
}

// ---------------------------------------------------------------------------
// Root theme (outermost <Theme>)
// ---------------------------------------------------------------------------

function RootTheme({
  seed: seedProp = "#6750A4",
  variant: variantProp = Variant.TONAL_SPOT,
  contrast = 0,
  colorMode: colorModeProp = "system",
  storageKey = "material-shadcn-theme",
  children,
}: ThemeRootProps) {
  const resolvedVariant = normalizeVariant(variantProp)
  const defaults = useMemo<StoredSettings>(
    () => ({
      seed: typeof seedProp === "string" ? seedProp : "#6750A4",
      variant: resolvedVariant,
      colorMode: colorModeProp,
    }),
    [seedProp, resolvedVariant, colorModeProp]
  )

  // Always start with defaults for SSR, then hydrate from localStorage in an effect
  const [settings, setSettings] = useState(defaults)
  const [hydrated, setHydrated] = useState(false)
  const resolvedSeed = useSeedResolver(settings.seed, defaults.seed)
  const [resolvedDark, setResolvedDark] = useState(false)

  // Hydrate from localStorage after mount to avoid SSR mismatch
  useEffect(() => {
    if (!storageKey) {
      setSettings(defaults)
      setResolvedDark(resolveColorMode(colorModeProp))
      setHydrated(true)
      return
    }
    const stored = loadSettings(storageKey, defaults)
    setSettings(stored)
    setResolvedDark(resolveColorMode(stored.colorMode))
    setHydrated(true)
  }, [storageKey, defaults, colorModeProp])

  useEffect(() => {
    setSettings((prev) => ({
      ...prev,
      seed: typeof seedProp === "string" ? seedProp : prev.seed,
      variant: resolvedVariant,
      colorMode: colorModeProp,
    }))
  }, [seedProp, resolvedVariant, colorModeProp])

  const theme = useMemo(
    () => generateTheme({ seed: resolvedSeed, variant: settings.variant, contrast }),
    [resolvedSeed, settings.variant, contrast]
  )

  // Apply to <html>
  useEffect(() => {
    applyTheme(document.documentElement, theme, resolvedDark)
    const tokens = resolvedDark ? theme.dark : theme.light
    applyMaterialShapeTokens(document.documentElement, tokens)
  }, [theme, resolvedDark])

  // System preference listener (skip before hydration)
  useEffect(() => {
    if (!hydrated) return
    setResolvedDark(resolveColorMode(settings.colorMode))

    if (settings.colorMode === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)")
      const handler = () => setResolvedDark(mq.matches)
      mq.addEventListener("change", handler)
      return () => mq.removeEventListener("change", handler)
    }
  }, [settings.colorMode, hydrated])

  // Persist
  useEffect(() => {
    saveSettings(storageKey, settings)
  }, [settings, storageKey])

  const setSeed = useCallback(
    (s: string | HTMLImageElement) => {
      if (typeof s === "string") {
        setSettings((prev) => ({ ...prev, seed: s }))
      } else {
        sourceColorFromImage(s).then((argb) => {
          setSettings((prev) => ({ ...prev, seed: hexFromArgb(argb) }))
        })
      }
    },
    []
  )

  const setVariant = useCallback(
    (v: Variant) => setSettings((prev) => ({ ...prev, variant: v })),
    []
  )

  const setColorMode = useCallback(
    (m: ColorMode) => setSettings((prev) => ({ ...prev, colorMode: m })),
    []
  )

  const cycleColorMode = useCallback(
    () =>
      setSettings((prev) => ({
        ...prev,
        colorMode:
          prev.colorMode === "system"
            ? "light"
            : prev.colorMode === "light"
              ? "dark"
              : "system",
      })),
    []
  )

  const value = useMemo<ThemeContextValue>(
    () => ({
      seed: resolvedSeed,
      variant: settings.variant,
      colorMode: settings.colorMode,
      resolvedDark,
      hydrated,
      theme,
      setSeed,
      setVariant,
      setColorMode,
      cycleColorMode,
    }),
    [resolvedSeed, settings.variant, settings.colorMode, resolvedDark, hydrated, theme, setSeed, setVariant, setColorMode, cycleColorMode]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

// ---------------------------------------------------------------------------
// Scoped theme (nested <Theme>)
// ---------------------------------------------------------------------------

function ScopedTheme({
  seed,
  variant,
  contrast,
  dark: darkOverride,
  style,
  children,
  ...divProps
}: ThemeScopedProps) {
  const parent = useTheme()
  const resolvedSeed = useSeedResolver(seed, parent.seed)
  const dark = darkOverride ?? parent.resolvedDark
  const resolvedVariant = variant === undefined ? parent.variant : normalizeVariant(variant)

  const theme = useMemo(
    () =>
      generateTheme({
        seed: resolvedSeed,
        variant: resolvedVariant,
        contrast,
      }),
    [resolvedSeed, resolvedVariant, contrast]
  )

  const tokens = dark ? theme.dark : theme.light
  const cssVars = useMemo(() => withMaterialShapeTokens(tokens), [tokens])

  return (
    <div {...divProps} style={{ ...cssVars, ...style }}>
      {children}
    </div>
  )
}

export { Theme, ThemeContext, useTheme }
export type { ThemeProps, ThemeRootProps, ThemeScopedProps, ThemeContextValue }
