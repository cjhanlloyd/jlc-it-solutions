// A small preview of a booth frame over a gradient stand-in photo, drawn by the same functions as the real photo.
import { useEffect, useRef } from 'react';
import type { BoothFrame } from '../../../shared/extras';
import { BOOTH_H, BOOTH_W, drawPlaceholder, FRAMES, photoRect, type FrameOpts } from './frames';

const SCALE = 0.2; // 216×270, sharp on high-density screens at thumbnail size

export default function FrameThumb({ frame, opts, className }: { frame: BoothFrame; opts: FrameOpts; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    ctx.clearRect(0, 0, BOOTH_W, BOOTH_H);
    drawPlaceholder(ctx, photoRect(frame, BOOTH_W, BOOTH_H), opts);
    FRAMES[frame].draw(ctx, BOOTH_W, BOOTH_H, opts);
  }, [frame, opts]);
  return <canvas ref={ref} width={BOOTH_W * SCALE} height={BOOTH_H * SCALE} className={className} aria-hidden="true" />;
}
