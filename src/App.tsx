import { Route, Routes } from 'react-router-dom';
import { PhoneFrame } from '@/components/PhoneFrame';
import { DemoBanner } from '@/components/DemoBanner';
import { Landing } from '@/screens/Landing';
import { SoulMap } from '@/screens/SoulMap';
import { SafetyLab } from '@/screens/SafetyLab';
import { Onboarding } from '@/screens/onboarding/Onboarding';

export function App() {
  return (
    <PhoneFrame>
      <div className="absolute inset-x-0 top-0 z-50 p-2">
        <DemoBanner aiMode="fixture" />
      </div>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/mapa" element={<SoulMap />} />
        <Route path="/lab/safety" element={<SafetyLab />} />
        <Route path="*" element={<Landing />} />
      </Routes>
    </PhoneFrame>
  );
}
