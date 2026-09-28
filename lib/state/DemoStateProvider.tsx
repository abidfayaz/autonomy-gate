"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  clearDemoState,
  EMPTY_DEMO_STATE,
  loadDemoState,
  saveDemoState,
  type DemoState,
  type RecordedDecision,
  type RecordedClassification,
  type RecordedPolicyVersion,
} from "./demoState";

interface DemoStateContextValue {
  state: DemoState;
  /** False until the browser's stored state has been read. */
  ready: boolean;
  recordDecision: (decision: RecordedDecision) => void;
  recordPolicy: (policy: RecordedPolicyVersion) => void;
  recordClassification: (classification: RecordedClassification) => void;
  reset: () => void;
}

const DemoStateContext = createContext<DemoStateContextValue | null>(null);

export function DemoStateProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DemoState>(EMPTY_DEMO_STATE);
  const [ready, setReady] = useState(false);

  // Read after mount rather than during render: the server has no storage, so
  // reading it earlier would make the first client render disagree with the
  // server's HTML. The lint rule below argues against setState in an effect, and
  // is right in general; here the effect *is* the subscription to an external
  // store that cannot be read during render, so the one-render cost is the point.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- see above
    setState(loadDemoState());
    setReady(true);
  }, []);

  const recordDecision = useCallback((decision: RecordedDecision) => {
    setState((previous) => {
      const next: DemoState = { ...previous, decisions: [...previous.decisions, decision] };
      saveDemoState(next);
      return next;
    });
  }, []);

  const recordPolicy = useCallback((policy: RecordedPolicyVersion) => {
    setState((previous) => {
      const next: DemoState = { ...previous, policies: [...previous.policies, policy] };
      saveDemoState(next);
      return next;
    });
  }, []);

  const recordClassification = useCallback((classification: RecordedClassification) => {
    setState((previous) => {
      const next: DemoState = {
        ...previous,
        classifications: [...previous.classifications, classification],
      };
      saveDemoState(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    clearDemoState();
    setState(EMPTY_DEMO_STATE);
  }, []);

  const value = useMemo(
    () => ({ state, ready, recordDecision, recordPolicy, recordClassification, reset }),
    [state, ready, recordDecision, recordPolicy, recordClassification, reset],
  );

  return <DemoStateContext.Provider value={value}>{children}</DemoStateContext.Provider>;
}

export function useDemoState(): DemoStateContextValue {
  const context = useContext(DemoStateContext);
  if (!context) {
    throw new Error("useDemoState must be used inside DemoStateProvider");
  }
  return context;
}
