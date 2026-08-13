import { useEffect, useState } from 'react';
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
import { ExternalProfile } from '@/screens/comparison/ExternalProfile';
import { Consent } from '@/screens/comparison/Consent';
import { Result } from '@/screens/comparison/Result';
import { getAiMode, type AiMode } from '@/ai/mode';
import { activeHighSeverityEvent } from '@/store/crisis';
import { ensureSession } from '@/supabase/session';

/**
 * Where the navigation belongs. Onboarding, the landing and the signup are
 * linear — offering five destinations mid-flow invites someone to leave a form
 * half-answered — so the nav appears only once there is something to navigate
 * between.
 */
const NAV_ROUTES = [
  '/inicio',
  '/mapa',
  '/recomendaciones',
  '/rutina',
  '/cuenta',
  '/chat',
  '/meditaciones',
  '/biblioteca',
  '/comparacion',
];

/** Prefixes, not exact paths: the comparison flow has nested routes and losing
 *  the nav halfway through it strands the person on a sub-screen. */
function showsNav(pathname: string): boolean {
  return NAV_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export function App() {
  // The banner has to tell the truth about where typed text goes, so it reads
  // the live mode rather than a constant.
  const [aiMode, setAiMode] = useState<AiMode>(() => getAiMode().mode);
  const { pathname } = useLocation();

  // Acquire the anonymous identity, once, in the background.
  //
  // Nothing rendered below waits on it and nothing yet reads from it: the
  // store is still local until Phase 4. What this buys now is that auth.uid()
  // has a value, which is what every RLS policy keys on — and that a visitor
  // who arrives before the backend exists is indistinguishable from one who
  // arrives after, because ensureSession resolves to null instead of throwing.
  useEffect(() => {
    void ensureSession();
  }, []);

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
        <Route path="/comparacion" element={<ExternalProfile />} />
        <Route path="/comparacion/consentimiento/:id" element={<Consent />} />
        <Route path="/comparacion/resultado/:id" element={<Result />} />
        <Route path="/lab/safety" element={<SafetyLab />} />
        <Route path="*" element={<Landing onAiModeChange={setAiMode} />} />
      </Routes>
      {/*
        A crisis takeover has to actually take the screen over. Leaving a glass
        bar offering "Caminos" and "Chat" across the bottom of it turns the
        takeover into a page with a way around it, which is the opposite of
        what PDR 1.6 asks for.
      */}
      {showsNav(pathname) && !activeHighSeverityEvent() && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40 p-3">
          <BottomNav />
        </div>
      )}
    </PhoneFrame>
  );
}
