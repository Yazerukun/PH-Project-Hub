import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from './ui/Button';
import { ChatIcon, ExploreIcon, UpdatesIcon, CloseIcon } from './ui/icons';

const ONBOARDING_KEY = 'phhub_onboarded_v1';

export function hasPendingOnboarding(): boolean {
  return typeof window !== 'undefined' && window.localStorage.getItem(ONBOARDING_KEY) === 'show';
}

export function markOnboardingPending() {
  try {
    window.localStorage.setItem(ONBOARDING_KEY, 'show');
  } catch {
    // ignore storage errors
  }
}

export function dismissOnboarding() {
  try {
    window.localStorage.removeItem(ONBOARDING_KEY);
  } catch {
    // ignore storage errors
  }
}

const steps = [
  {
    icon: ChatIcon,
    title: 'Join #general',
    body: 'Say hello and meet the Filipino builders already chatting.',
    to: '/chat/general',
    cta: 'Open #general',
  },
  {
    icon: ExploreIcon,
    title: 'Explore projects',
    body: 'Browse the projects, check their status, and see their latest releases.',
    to: '/projects',
    cta: 'Explore projects',
  },
  {
    icon: UpdatesIcon,
    title: 'Follow updates',
    body: 'Stay on top of every release, feature, and project announcement here.',
    to: '/updates',
    cta: 'View updates',
  },
];

export function OnboardingSheet() {
  const [step, setStep] = useState(0);
  const current = steps[step];

  if (!hasPendingOnboarding()) return null;

  const close = () => {
    dismissOnboarding();
  };
  const finish = () => {
    dismissOnboarding();
    setStep(0);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label="Welcome to PH Project Hub">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-ink-500 bg-ink-800 shadow-2xl">
        <div className="flex items-start justify-between border-b border-ink-600 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-white">Welcome! 👋</h2>
            <p className="text-xs text-gray-500">Here&apos;s how to get started</p>
          </div>
          <button onClick={close} className="text-gray-400 hover:text-white" aria-label="Dismiss">
            <CloseIcon size={18} />
          </button>
        </div>

        <div className="p-5">
          <div className="flex items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-600/15 text-primary-300">
              <current.icon size={22} />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary-400">Step {step + 1} of {steps.length}</p>
              <h3 className="text-base font-semibold text-white">{current.title}</h3>
            </div>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-gray-400">{current.body}</p>

          <div className="mt-2 flex gap-1">
            {steps.map((_, i) => (
              <span key={i} className={`h-1.5 flex-1 rounded-full ${i === step ? 'bg-primary-500' : 'bg-ink-600'}`} />
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-ink-600 px-5 py-4">
          {step > 0 ? (
            <Button variant="ghost" onClick={() => setStep(step - 1)}>Back</Button>
          ) : (
            <span />
          )}
          {step < steps.length - 1 ? (
            <>
              <Button variant="ghost" onClick={close}>Skip</Button>
              <Link to={current.to}>
                <Button onClick={finish}>{current.cta}</Button>
              </Link>
            </>
          ) : (
            <Link to={current.to} className="w-full">
              <Button className="w-full" onClick={finish}>{current.cta} →</Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}