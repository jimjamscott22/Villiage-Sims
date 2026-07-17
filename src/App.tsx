import { Canvas } from './render/Canvas';
import { transport } from './state/transport';

export default function App() {
  return (
    <main className="flex h-full flex-col bg-[#17211b] text-[#f7f4e9]">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-white/10 px-4">
        <h1 className="text-base font-semibold">VillageSim</h1>
        <span className="text-xs text-white/60">{transport.mode === 'tauri' ? 'Simulation connected' : 'Browser demo'}</span>
      </header>
      <Canvas />
    </main>
  );
}
