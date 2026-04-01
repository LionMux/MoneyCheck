import { createContext, useContext, useState, type ReactNode } from "react";

interface DisplayPreferences {
  showBalance: boolean;
  setShowBalance: (v: boolean) => void;
}

const DisplayPreferencesContext = createContext<DisplayPreferences>({
  showBalance: false,
  setShowBalance: () => {},
});

export function DisplayPreferencesProvider({ children }: { children: ReactNode }) {
  // Seed from localStorage if available (best-effort), but updates propagate via context
  const [showBalance, setShowBalanceState] = useState(() => {
    try { return localStorage.getItem("txShowBalance") === "1"; } catch { return false; }
  });

  const setShowBalance = (v: boolean) => {
    setShowBalanceState(v);
    try { localStorage.setItem("txShowBalance", v ? "1" : "0"); } catch { /* sandboxed */ }
  };

  return (
    <DisplayPreferencesContext.Provider value={{ showBalance, setShowBalance }}>
      {children}
    </DisplayPreferencesContext.Provider>
  );
}

export function useDisplayPreferences() {
  return useContext(DisplayPreferencesContext);
}
