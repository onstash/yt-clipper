import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

interface DryRunContextType {
  isDryRun: boolean;
  toggleDryRun: () => void;
  setDryRun: (value: boolean) => void;
}

const DryRunContext = createContext<DryRunContextType | undefined>(undefined);

const STORAGE_KEY = "yt-clipper-dry-run";

export function DryRunProvider({ children }: { children: ReactNode }) {
  const [isDryRun, setIsDryRun] = useState<boolean>(() => {
    // Load initial state from localStorage
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored === "true";
    }
    return false;
  });

  useEffect(() => {
    // Persist to localStorage whenever state changes
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, String(isDryRun));
      console.log(`[DRY RUN] Mode ${isDryRun ? "enabled" : "disabled"}`);
    }
  }, [isDryRun]);

  const toggleDryRun = () => {
    setIsDryRun((prev) => !prev);
  };

  const setDryRun = (value: boolean) => {
    setIsDryRun(value);
  };

  return (
    <DryRunContext.Provider value={{ isDryRun, toggleDryRun, setDryRun }}>
      {children}
    </DryRunContext.Provider>
  );
}

export function useDryRun() {
  const context = useContext(DryRunContext);
  if (context === undefined) {
    throw new Error("useDryRun must be used within a DryRunProvider");
  }
  return context;
}
