import { useEffect, useState } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { PhoneFrame } from '@/components/PhoneFrame';
import { DemoBanner } from '@/components/DemoBanner';
import { SaveFailureNotice } from '@/components/SaveFailureNotice';
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
import { hydrate } from '@/store/hydrate.ts';
import { isBackendConfigured } from '@/supabase/client.ts';
import { Gate } from '@/screens/Gate';

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

  // Load the dataset before anything reads it.
  //
  // The screens below call the store from their render bodies —
  // `activeProfile()`, `currentSynthesis()` — so rendering before the mirror
  // is filled would paint an empty account and then flip. Gating here is what
  // buys those twenty-eight call sites the right to stay synchronous, which is
  // the trade DECISIONS.md section 12 records.
  //
  // It resolves either way: a paused project or a missing configuration lands
  // on localStorage rather than on an error.
  const [ready, setReady] = useState(false);
  const [admitted, setAdmitted] = useState(false);
  useEffect(() => {
    let live = true;
    void hydrate().then((result) => {
      if (!live) return;
      setAdmitted(result.kind === 'remote');
      setReady(true);
    });
    return () => {
      live = false;
    };
  }, []);

  if (!ready) {
    return (
      <PhoneFrame>
        <div
          role="status"
          aria-live="polite"
          className="flex min-h-dvh items-center justify-center px-6 text-center"
        >
          <p className="text-[12.5px] leading-relaxed text-crema/55">Abriendo tu espacio…</p>
        </div>
      </PhoneFrame>
    );
  }

  // The door. DECISIONS.md section 13.
  //
  // Only when a backend is configured: without one there is nothing to protect
  // and nothing to sign in to, so the fixture demo runs untouched and offline.
  // `admitted` comes from hydration having found a session, which it now never
  // creates — an identity arrives only by walking through Google, and Google
  // refuses anyone off the consent screen's list before the redirect returns.
  if (isBackendConfigured && !admitted) {
    return (
      <PhoneFrame>
        <Gate />
      </PhoneFrame>
    );
  }

  return (
    <PhoneFrame>
      <div className="absolute inset-x-0 top-0 z-50 flex flex-col gap-1.5 p-2">
        <DemoBanner aiMode={aiMode} />
        <SaveFailureNotice />
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
