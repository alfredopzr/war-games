import { useRef, useEffect, type ReactElement } from 'react';

export function App(): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = (): void => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      // Redraw on resize
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#e0e0e0';
      ctx.font = '24px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('HexWar — Canvas Ready', canvas.width / 2, canvas.height / 2);
    };

    resize();
    window.addEventListener('resize', resize);

    return () => window.removeEventListener('resize', resize);
  }, []);

  return <canvas ref={canvasRef} style={{ display: 'block' }} />;
}
