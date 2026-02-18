export function useTheme() {
  const getVar = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return { getVar };
}
