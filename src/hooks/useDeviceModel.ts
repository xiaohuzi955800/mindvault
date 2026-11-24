/**
 * On-device model lifecycle state for the UI.
 *
 * Owns the availability check, the user-gesture-gated model initialization
 * (with download progress), and — in mock mode — the "simulate unavailable"
 * demo toggle that lets anyone see the graceful-degradation path.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getSimulateUnavailable,
  setSimulateUnavailable,
} from '../lib/ai/mockProvider';
import type { AIProvider, DeviceAvailability } from '../lib/ai/types';

export function useDeviceModel(provider: AIProvider) {
  const [availability, setAvailability] =
    useState<DeviceAvailability>('unknown');
  const [progress, setProgress] = useState(0);
  const [initializing, setInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [simulated, setSimulatedState] = useState<boolean>(() =>
    getSimulateUnavailable(),
  );
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    try {
      const state = await provider.getDeviceAvailability();
      if (mounted.current) setAvailability(state);
    } catch {
      if (mounted.current) setAvailability('unknown');
    }
  }, [provider]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** Must be called from a button click — the model may need to download. */
  const enable = useCallback(async () => {
    setInitializing(true);
    setError(null);
    setProgress(0);
    try {
      await provider.initializeDeviceModel((value) => {
        if (mounted.current) setProgress(value);
      });
      if (mounted.current) {
        setAvailability('available');
        setProgress(100);
      }
    } catch (err) {
      if (mounted.current) {
        setError(err instanceof Error ? err.message : String(err));
        setAvailability('unavailable');
      }
    } finally {
      if (mounted.current) setInitializing(false);
    }
  }, [provider]);

  /** Mock-mode demo toggle: pretend the device model cannot run here. */
  const setSimulated = useCallback(
    (value: boolean) => {
      setSimulateUnavailable(value);
      setSimulatedState(value);
      setError(null);
      void refresh();
    },
    [refresh],
  );

  return {
    availability,
    progress,
    initializing,
    error,
    enable,
    refresh,
    simulated,
    setSimulated,
  };
}
