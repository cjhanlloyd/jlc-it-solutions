// Premium opening: a closed invitation over the guest page. The tap that opens it also starts the music (mobile autoplay rules).
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { Card } from '../../shared/occasions/card';
import { schemeVars, type Scheme } from './parts';

// "Maria & Juan" -> "M&J", "Mia" -> "M"; '' when there are no names (the seal then shows an ornament).
export const monogram = (headline: string) =>
  headline.split('&').map((s) => Array.from(s.trim())[0] ?? '').filter(Boolean).join('&').toUpperCase();

type Props = { card: Card; scheme: Scheme; onOpen: () => void; onDone: () => void };

export default function IntroCover({ card, scheme, onOpen, onDone }: Props) {
  const [opening, setOpening] = useState(false);
  const [gone, setGone] = useState(false);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (gone) return;
    button.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = overflow; };
  }, [gone]);

  useEffect(() => {
    if (!opening) return;
    const ms = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 200 : 900;
    const t = setTimeout(() => {
      setGone(true);
      onDone();
    }, ms);
    return () => clearTimeout(t);
  }, [opening, onDone]);

  if (gone) return null;
  const open = () => { if (!opening) { onOpen(); setOpening(true); } };
  // The button is the only control, so Tab stays on it (the page behind is not reachable while the cover is up).
  const keepFocus = (e: KeyboardEvent) => { if (e.key === 'Tab') e.preventDefault(); };
  const seal = monogram(card.headline);

  return (
    <div className={`inv intro-cover${opening ? ' is-opening' : ''}`} style={schemeVars(scheme)}
      role="dialog" aria-modal="true" aria-labelledby="intro-title" onKeyDown={keepFocus}>
      <div className="intro-panel intro-top">
        {card.kicker && <p className="intro-kicker">{card.kicker}</p>}
        <h2 id="intro-title" className="intro-names">{card.headline || 'You are invited'}</h2>
        {card.dateLine && <p className="intro-date">{card.dateLine}</p>}
      </div>
      <div className="intro-panel intro-bottom">
        <button ref={button} type="button" className="btn btn-solid" onClick={open}>Open invitation</button>
      </div>
      <span className="intro-seal" aria-hidden="true">{seal || '❦'}</span>
    </div>
  );
}
