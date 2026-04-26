import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { PermissionsAndroid, Platform } from "react-native";
import Sound, {
  type AudioSet,
  type PlayBackType,
  type PlaybackEndType,
  type RecordBackType,
} from "react-native-nitro-sound";

export type RecorderState = {
  isRecording: boolean;
  isPaused: boolean;
  isBusy: boolean;
  currentPositionMs: number;
  currentMetering?: number;
  lastRecordingPath: string | null;
  error: string | null;
};

export type PlayerState = {
  isPlaying: boolean;
  isPaused: boolean;
  isBusy: boolean;
  currentPositionMs: number;
  durationMs: number;
  lastUri: string | null;
  error: string | null;
};

export type RecorderApi = {
  state: RecorderState;
  start: (
    uri?: string,
    audioSet?: AudioSet,
    meteringEnabled?: boolean,
  ) => Promise<void>;
  stop: () => Promise<string | undefined>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
};

export type PlayerApi = {
  state: PlayerState;
  start: (uri?: string, httpHeaders?: Record<string, string>) => Promise<void>;
  stop: () => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  seekTo: (timeMs: number) => Promise<void>;
  setVolume: (volume: number) => Promise<void>;
  setPlaybackSpeed: (speed: number) => Promise<void>;
};

export type AudioContextValue = {
  recorder: RecorderApi;
  player: PlayerApi;
};

const NitroSoundReactContext = createContext<AudioContextValue | null>(null);

async function ensureAndroidRecordPermission(): Promise<boolean> {
  if (Platform.OS !== "android") {
    return true;
  }
  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      {
        title: "Microphone permission",
        message: "This app needs the microphone to record audio.",
        buttonPositive: "OK",
        buttonNegative: "Cancel",
        buttonNeutral: "Ask later",
      },
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

export type AudioProviderProps = {
  children: React.ReactNode;
  subscriptionDurationSec?: number;
};

export function AudioProvider({
  children,
  subscriptionDurationSec = 0.05,
}: AudioProviderProps) {
  const mounted = useRef(true);

  const [recState, setRecState] = useState<RecorderState>({
    isRecording: false,
    isPaused: false,
    isBusy: false,
    currentPositionMs: 0,
    currentMetering: undefined,
    lastRecordingPath: null,
    error: null,
  });

  const [playState, setPlayState] = useState<PlayerState>({
    isPlaying: false,
    isPaused: false,
    isBusy: false,
    currentPositionMs: 0,
    durationMs: 0,
    lastUri: null,
    error: null,
  });

  useEffect(() => {
    mounted.current = true;
    Sound.setSubscriptionDuration(subscriptionDurationSec);

    const onRecord = (e: RecordBackType) => {
      if (!mounted.current) {
        return;
      }
      setRecState((prev) => ({
        ...prev,
        currentPositionMs: e.currentPosition,
        currentMetering: e.currentMetering,
      }));
    };

    const onPlay = (e: PlayBackType) => {
      if (!mounted.current) {
        return;
      }
      setPlayState((prev) => ({
        ...prev,
        currentPositionMs: e.currentPosition,
        durationMs: e.duration,
      }));
    };

    const onPlayEnd = (_e: PlaybackEndType) => {
      if (!mounted.current) {
        return;
      }
      setPlayState((prev) => ({
        ...prev,
        isPlaying: false,
        isPaused: false,
        currentPositionMs: 0,
      }));
    };

    Sound.addRecordBackListener(onRecord);
    Sound.addPlayBackListener(onPlay);
    Sound.addPlaybackEndListener(onPlayEnd);

    return () => {
      mounted.current = false;
      Sound.removeRecordBackListener();
      Sound.removePlayBackListener();
      Sound.removePlaybackEndListener();
      Sound.stopRecorder().catch(() => {});
      Sound.stopPlayer().catch(() => {});
    };
  }, [subscriptionDurationSec]);

  const startRecorder = useCallback(
    async (uri?: string, audioSet?: AudioSet, meteringEnabled?: boolean) => {
      setRecState((s) => ({ ...s, error: null, isBusy: true }));
      const ok = await ensureAndroidRecordPermission();
      if (!ok) {
        setRecState((s) => ({
          ...s,
          isBusy: false,
          error: "Microphone permission denied",
        }));
        return;
      }
      try {
        await Sound.startRecorder(uri, audioSet, meteringEnabled);
        if (!mounted.current) {
          return;
        }
        setRecState((s) => ({
          ...s,
          isRecording: true,
          isPaused: false,
          isBusy: false,
          currentPositionMs: 0,
          error: null,
        }));
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        setRecState((s) => ({
          ...s,
          isBusy: false,
          isRecording: false,
          error: message,
        }));
      }
    },
    [],
  );

  const stopRecorder = useCallback(async () => {
    setRecState((s) => ({ ...s, isBusy: true, error: null }));
    try {
      const path = await Sound.stopRecorder();
      if (!mounted.current) {
        return path;
      }
      setRecState((s) => ({
        ...s,
        isRecording: false,
        isPaused: false,
        isBusy: false,
        lastRecordingPath: path,
        currentPositionMs: 0,
      }));
      return path;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setRecState((s) => ({
        ...s,
        isBusy: false,
        error: message,
      }));
      return undefined;
    }
  }, []);

  const pauseRecorder = useCallback(async () => {
    setRecState((s) => ({ ...s, isBusy: true, error: null }));
    try {
      await Sound.pauseRecorder();
      if (!mounted.current) {
        return;
      }
      setRecState((s) => ({
        ...s,
        isPaused: true,
        isBusy: false,
      }));
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setRecState((s) => ({ ...s, isBusy: false, error: message }));
    }
  }, []);

  const resumeRecorder = useCallback(async () => {
    setRecState((s) => ({ ...s, isBusy: true, error: null }));
    try {
      await Sound.resumeRecorder();
      if (!mounted.current) {
        return;
      }
      setRecState((s) => ({
        ...s,
        isPaused: false,
        isBusy: false,
      }));
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setRecState((s) => ({ ...s, isBusy: false, error: message }));
    }
  }, []);

  const startPlayer = useCallback(
    async (uri?: string, httpHeaders?: Record<string, string>) => {
      setPlayState((s) => ({ ...s, isBusy: true, error: null }));
      try {
        await Sound.startPlayer(uri, httpHeaders);
        if (!mounted.current) {
          return;
        }
        setPlayState((s) => ({
          ...s,
          isPlaying: true,
          isPaused: false,
          isBusy: false,
          lastUri: uri ?? s.lastUri,
          error: null,
        }));
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        setPlayState((s) => ({
          ...s,
          isBusy: false,
          isPlaying: false,
          error: message,
        }));
      }
    },
    [],
  );

  const stopPlayer = useCallback(async () => {
    setPlayState((s) => ({ ...s, isBusy: true, error: null }));
    try {
      await Sound.stopPlayer();
      if (!mounted.current) {
        return;
      }
      setPlayState((s) => ({
        ...s,
        isPlaying: false,
        isPaused: false,
        isBusy: false,
        currentPositionMs: 0,
      }));
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setPlayState((s) => ({ ...s, isBusy: false, error: message }));
    }
  }, []);

  const pausePlayer = useCallback(async () => {
    setPlayState((s) => ({ ...s, isBusy: true, error: null }));
    try {
      await Sound.pausePlayer();
      if (!mounted.current) {
        return;
      }
      setPlayState((s) => ({
        ...s,
        isPaused: true,
        isBusy: false,
      }));
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setPlayState((s) => ({ ...s, isBusy: false, error: message }));
    }
  }, []);

  const resumePlayer = useCallback(async () => {
    setPlayState((s) => ({ ...s, isBusy: true, error: null }));
    try {
      await Sound.resumePlayer();
      if (!mounted.current) {
        return;
      }
      setPlayState((s) => ({
        ...s,
        isPaused: false,
        isPlaying: true,
        isBusy: false,
      }));
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setPlayState((s) => ({ ...s, isBusy: false, error: message }));
    }
  }, []);

  const seekToPlayer = useCallback(async (timeMs: number) => {
    setPlayState((s) => ({ ...s, error: null }));
    try {
      await Sound.seekToPlayer(timeMs);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setPlayState((s) => ({ ...s, error: message }));
    }
  }, []);

  const setVolume = useCallback(async (volume: number) => {
    try {
      await Sound.setVolume(volume);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setPlayState((s) => ({ ...s, error: message }));
    }
  }, []);

  const setPlaybackSpeed = useCallback(async (speed: number) => {
    try {
      await Sound.setPlaybackSpeed(speed);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setPlayState((s) => ({ ...s, error: message }));
    }
  }, []);

  const value = useMemo<AudioContextValue>(
    () => ({
      recorder: {
        state: recState,
        start: startRecorder,
        stop: stopRecorder,
        pause: pauseRecorder,
        resume: resumeRecorder,
      },
      player: {
        state: playState,
        start: startPlayer,
        stop: stopPlayer,
        pause: pausePlayer,
        resume: resumePlayer,
        seekTo: seekToPlayer,
        setVolume,
        setPlaybackSpeed,
      },
    }),
    [
      recState,
      playState,
      startRecorder,
      stopRecorder,
      pauseRecorder,
      resumeRecorder,
      startPlayer,
      stopPlayer,
      pausePlayer,
      resumePlayer,
      seekToPlayer,
      setVolume,
      setPlaybackSpeed,
    ],
  );

  return (
    <NitroSoundReactContext.Provider value={value}>
      {children}
    </NitroSoundReactContext.Provider>
  );
}

export function useAudio(): AudioContextValue {
  const ctx = useContext(NitroSoundReactContext);
  if (!ctx) {
    throw new Error("useAudio must be used within an AudioProvider");
  }
  return ctx;
}
