import { useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import { PhoneFrame } from '@/components/PhoneFrame';
import { DemoBanner } from '@/components/DemoBanner';
import { Landing } from '@/screens/Landing';
import { SoulMap } from '@/screens/SoulMap';
import { SafetyLab } from '@/screens/SafetyLab';
import { Onboarding } from '@/screens/onboarding/Onboarding';
import { Recommendations } from '@/screens/Recommendations';
import { Routine } from '@/screens/Routine';
import { getAiMode, type AiMode } from '@/ai/mode';

export function App() {
  // The banner has to tell the truth about where typed text goes, so it reads
  // the live mode rather than a constant.
  const [aiMode, setAiMode] = useState<AiMode>(() => getAiMode().mode);

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
        <Route path="/lab/safety" element={<SafetyLab />} />
        <Route path="*" element={<Landing onAiModeChange={setAiMode} />} />
      </Routes>
    </PhoneFrame>
  );
}
