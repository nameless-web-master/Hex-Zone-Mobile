import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

type ComposeContextValue = {
  composeOpen: boolean;
  quickAlertsOpen: boolean;
  openCompose: () => void;
  closeCompose: () => void;
  openQuickAlerts: () => void;
  closeQuickAlerts: () => void;
};

const ComposeContext = createContext<ComposeContextValue>({
  composeOpen: false,
  quickAlertsOpen: false,
  openCompose: () => {},
  closeCompose: () => {},
  openQuickAlerts: () => {},
  closeQuickAlerts: () => {},
});

export function ComposeProvider({ children }: { children: ReactNode }) {
  const [composeOpen, setComposeOpen] = useState(false);
  const [quickAlertsOpen, setQuickAlertsOpen] = useState(false);

  const openCompose = useCallback(() => {
    setQuickAlertsOpen(false);
    setComposeOpen(true);
  }, []);

  const closeCompose = useCallback(() => setComposeOpen(false), []);

  const openQuickAlerts = useCallback(() => {
    setComposeOpen(false);
    setQuickAlertsOpen(true);
  }, []);

  const closeQuickAlerts = useCallback(() => setQuickAlertsOpen(false), []);

  return (
    <ComposeContext.Provider
      value={{
        composeOpen,
        quickAlertsOpen,
        openCompose,
        closeCompose,
        openQuickAlerts,
        closeQuickAlerts,
      }}
    >
      {children}
    </ComposeContext.Provider>
  );
}

export function useCompose() {
  return useContext(ComposeContext);
}
