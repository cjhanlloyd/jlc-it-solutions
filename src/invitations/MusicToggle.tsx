// Premium background music: one looping track and a small round play/mute button. Playback first starts from a guest tap.
import { useEffect, useState, type RefObject } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { schemeVars, type Scheme } from './parts';

export type Music = { url: string; title: string; credit: string };
type Props = { music: Music; scheme: Scheme; ref: RefObject<HTMLAudioElement | null> };

export default function MusicToggle({ music, scheme, ref }: Props) {
  const [playing, setPlaying] = useState(false);

  // Pause while the page is hidden; resume only if it was playing (a guest who muted stays muted).
  useEffect(() => {
    let resume = false;
    const onVisibility = () => {
      const audio = ref.current;
      if (!audio) return;
      if (document.hidden) { resume = !audio.paused; audio.pause(); }
      else if (resume) { resume = false; audio.play().catch(() => {}); }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [ref]);

  const toggle = () => {
    const audio = ref.current;
    if (!audio) return;
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  };

  return (
    <>
      <audio ref={ref} src={music.url} loop preload="none" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} />
      <button type="button" className="music-toggle" style={schemeVars(scheme)} onClick={toggle}
        aria-pressed={playing} aria-label={playing ? 'Mute music' : 'Play music'} title={`♪ ${music.title}`}>
        {playing ? <Volume2 aria-hidden="true" size={20} /> : <VolumeX aria-hidden="true" size={20} />}
      </button>
    </>
  );
}
