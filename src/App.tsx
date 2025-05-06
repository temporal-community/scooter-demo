import GameCanvas from './components/GameCanvas';
import Hud from './components/Hud';

export default function App() {
  return (
    <div className="flex flex-col h-screen bg-slate-100">
      <header className="text-center py-2 font-semibold">🛴 Scooter Demo</header>

      <main className="flex-1 flex overflow-hidden">
        {/* Game layer */}
        <div className="flex-1 bg-sky-200">
          <GameCanvas />
        </div>

        {/* HUD pane */}
        <aside className="w-72 bg-white border-l p-4">
          <Hud />
        </aside>
      </main>
    </div>
  );
}
