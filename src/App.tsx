import GameCanvas from './components/GameCanvas';
import Hud from './components/Hud';

export default function App() {
  return (
    <div className="flex flex-col h-screen bg-slate-100">
      <header className="text-center py-2 font-semibold">🛴 Scooter Demo</header>

      <main className="flex-1 flex overflow-hidden">
        {/* HUD pane */}
        <aside className="w-96 bg-white border-r p-4">
          <Hud />
        </aside>

        {/* Game layer */}
        <div className="flex-1 h-full bg-sky-200">
          <GameCanvas />
        </div>
      </main>
    </div>
  );
}
