import { useState } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { PhoneFrame } from '@/components/PhoneFrame';
import { DemoBanner } from '@/components/DemoBanner';
import { BottomNav } from '@/components/BottomNav';
import { Landing } from '@/screens/Landing';
import { SoulMap } from '@/screens/SoulMap';
import { SafetyLab } from '@/screens/SafetyLab';
import { Onboarding } from '@/screens/onboarding/Onboarding';
import { Recommendations } from '@/screens/Recommendations';
import { Routine } from '@/screens/Routine';
import { Dashboard } from '@/screens/Dashboard';
import { Signup } from '@/screens/Signup';
import { Account } from '@/screens/Account';
import { Chat } from '@/screens/Chat';
import { Meditation } from '@/screens/Meditation';
import { Library } from '@/screens/Library';
import { getAiMode, type AiMode } from '@/ai/mode';

/**
 * Where the navigation belongs. Onboarding, the landing and the signup are
 * linear — offering five destinations mid-flow invites someone to leave a form
 * half-answered — so the nav appears only once there is something to navigate
 * between.
 */
const NAV_ROUTES = new Set([
  '/inicio',
  '/mapa',
  '/recomendaciones',
  '/rutina',
  '/cuenta',
  '/chat',
  '/meditaciones',
  '/biblioteca',
]);

export function App() {
  // The banner has to tell the truth about where typed text goes, so it reads
  // the live mode rather than a constant.
  const [aiMode, setAiMode] = useState<AiMode>(() => getAiMode().mode);
  const { pathname } = useLocation();

  return (
    <PhoneFrame>
      <div className="absolute inset-x-0 top-0 z-50 p-2">
        <DemoBanner aiMode={aiMode} />
      </div>
      <Routes>
        <Route path="/" element={<Landing onAiModeChange={setAiMode} />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/mapa" element={<SoulMap />} />
        <Route path="/recomendaciones" element={<Recommendations />} />
        <Route path="/rutina" element={<Routine />} />
        <Route path="/inicio" element={<Dashboard />} />
        <Route path="/registro" element={<Signup />} />
        <Route path="/cuenta" element={<Account />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/meditaciones" element={<Meditation />} />
        <Route path="/biblioteca" element={<Library />} />
        <Route path="/lab/safety" element={<SafetyLab />} />
        <Route path="*" element={<Landing onAiModeChange={setAiMode} />} />
      </Routes>
      {NAV_ROUTES.has(pathname) && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40 p-3">
          <BottomNav />
        </div>
      )}
    </PhoneFrame>
  );
}
