import { useState, useEffect, useRef, useCallback } from "react";
import { trackEvent } from "@core/api.js";

export function usePlayer(tracks) {
  const audioRef = useRef(new Audio());
  const [currentIdx, setCurrentIdx] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState(false);

  const audio = audioRef.current;

  useEffect(() => {
    audio.volume = volume;
  }, []);

  useEffect(() => {
    const onTime = () => setProgress(audio.currentTime);
    const onMeta = () => setDuration(audio.duration || 0);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => {
      if (repeat) {
        audio.play();
        return;
      }
      next();
    };

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
    };
  }, [repeat, shuffle, currentIdx, tracks]);

  const loadTrack = useCallback(
    (idx, autoplay = true) => {
      if (idx < 0 || idx >= tracks.length) return;
      const t = tracks[idx];
      audio.src = `/api/mixmusic/stream/${encodeURIComponent(t.file).replace(/%2F/g, "/")}`;
      setCurrentIdx(idx);
      setProgress(0);
      setDuration(0);
      trackEvent("mixmusic", "track.play", { name: t.name, file: t.file });
      if (autoplay) audio.play();
    },
    [tracks],
  );

  const togglePlay = useCallback(() => {
    if (!audio.src) return;
    if (audio.paused) audio.play();
    else audio.pause();
  }, []);

  const next = useCallback(() => {
    if (!tracks.length) return;
    const idx = shuffle
      ? Math.floor(Math.random() * tracks.length)
      : (currentIdx + 1) % tracks.length;
    loadTrack(idx, true);
  }, [tracks, shuffle, currentIdx, loadTrack]);

  const prev = useCallback(() => {
    if (!tracks.length) return;
    if (audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    loadTrack(currentIdx > 0 ? currentIdx - 1 : tracks.length - 1, true);
  }, [tracks, currentIdx, loadTrack]);

  const seek = useCallback(
    (ratio) => {
      if (!duration) return;
      audio.currentTime = ratio * duration;
    },
    [duration],
  );

  const changeVolume = useCallback((v) => {
    setVolume(v);
    audio.volume = v;
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      audio.muted = !m;
      return !m;
    });
  }, []);

  return {
    currentIdx,
    playing,
    progress,
    duration,
    volume,
    muted,
    shuffle,
    repeat,
    loadTrack,
    togglePlay,
    next,
    prev,
    seek,
    changeVolume,
    toggleMute,
    toggleShuffle: () => setShuffle((s) => !s),
    toggleRepeat: () => setRepeat((r) => !r),
  };
}
