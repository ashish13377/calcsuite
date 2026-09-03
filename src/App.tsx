import { useEffect } from 'react';
import { SettingsProvider, useSettings } from './settings/SettingsContext';
import { Shell } from './ui/Shell';
import { Launcher } from './ui/Launcher';
import { fontStack } from './ui/themePresets';

// Applies the design-token root + resolved theme to <html> so portaled dialogs inherit it.
function ThemeRoot({ children }: { children: React.ReactNode }) {
  const { resolvedTheme, settings } = useSettings();
  useEffect(() => {
    const el = document.documentElement;
    el.setAttribute('data-fincalc-root', '');
    el.setAttribute('data-theme', resolvedTheme === 'highContrast' ? 'dark' : resolvedTheme);
    el.setAttribute('data-density', settings.ui.density);
    el.style.setProperty('--fc-accent', settings.ui.accent);
    el.style.setProperty('--fc-font-ui', fontStack(settings.ui.fontFamily));
  }, [resolvedTheme, settings.ui.density, settings.ui.accent, settings.ui.fontFamily]);
  return <>{children}</>;
}

export function App() {
  return (
    <SettingsProvider>
      <ThemeRoot>
        {/* The full experience inline. A FAB launcher (§11.1) opens the same shell in a dialog. */}
        <div className="page-inline">
          <Shell />
        </div>
        <Launcher variant="fab" position="bottom-right" />
      </ThemeRoot>
    </SettingsProvider>
  );
}
