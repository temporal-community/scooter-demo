import { Routes, Route, useParams, useNavigate, Link } from 'react-router-dom';
import GameCanvas from './components/GameCanvas';
import Hud from './components/Hud/Hud';

// New component to handle the layout and pass router props to Hud
function RidePageLayout() {
  const { workflowId: workflowIdFromUrl } = useParams<{ workflowId?: string }>();
  const navigate = useNavigate(); // To allow Hud/useRideOrchestrator to change URL

  return (
    <div className="flex-1 flex overflow-hidden">
      <aside className="w-72 bg-white border-r">
        {/* Pass workflowIdFromUrl and navigate to Hud */}
        {/* We will adapt Hud later to accept these props */}
        <Hud workflowIdFromUrl={workflowIdFromUrl} navigate={navigate} />
      </aside>
      <div className="flex-1 h-full bg-sky-200">
        <GameCanvas />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <div className="flex flex-col h-screen bg-slate-100 ">
      <header className="flex flex-col items-center py-4 bg-white">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🛴</span>
          <Link to="/" className="text-xl font-bold text-gray-800 tracking-tight" tabIndex={-1}>
            Scooter Demo
          </Link>
        </div>
        <div className="w-full mt-1 border-t border-gray-100" />
      </header>
      <main className="flex-1 flex"> {/* Ensure main can fill space for routed content */}
        <Routes>
          {/* Route for when a workflowId is in the URL */}
          <Route path="/ride/:workflowId" element={<RidePageLayout />} />
          {/* Default route (e.g., home page, no specific workflowId) */}
          <Route path="/" element={<RidePageLayout />} />
        </Routes>
      </main>
    </div>
  );
}
