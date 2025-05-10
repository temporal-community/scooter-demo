import { Routes, Route, useParams, useNavigate } from 'react-router-dom';
import GameCanvas from './components/GameCanvas';
import Hud from './components/Hud/Hud';

// New component to handle the layout and pass router props to Hud
function RidePageLayout() {
  const { workflowId: workflowIdFromUrl } = useParams<{ workflowId?: string }>();
  const navigate = useNavigate(); // To allow Hud/useRideOrchestrator to change URL

  return (
    <div className="flex-1 flex overflow-hidden">
      <aside className="w-96 bg-white border-r p-4">
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
    <div className="flex flex-col h-screen bg-slate-100">
      <header className="text-center py-2 font-semibold">🛴 Scooter Demo</header>
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
