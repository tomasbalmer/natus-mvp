import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { PHOTO, Screen } from '@/components/Screen';
import { Paywall } from '@/components/Paywall';
import { CrisisResourceList } from '@/components/CrisisResourceList';
import { modalityBySlug } from '@/lib/catalog';
import { detectCrisis, riskLevel } from '@/lib/safety';
import { askChat } from '@/ai/chat';
import { activeProfile } from '@/store/account';
import { currentSynthesis } from '@/store/soulMap';
import { currentMatchFor } from '@/store/matches';
import { activeHighSeverityEvent, markFalsePositive, recordCrisisEvent } from '@/store/crisis';
import { simulateSubscribe } from '@/store/subscription';
import {
  FREE_QUESTIONS,
  appendAssistantMessage,
  appendUserMessage,
  conversationFor,
  dropMessage,
  listMessages,
  remainingQuestions,
  type StoredMessage,
} from '@/store/chat';

/**
 * The conversation of PDR section 10.
 *
 * Layer 1 runs on every message before it reaches the model — not as a filter
 * on the way back, which would mean the crisis text had already been generated
 * by then. A high-severity signal puts the screen into containment: the thread
 * stays, the composer goes, and no interpretation of any kind is offered. PDR
 * 1.6 is explicit that this moment has no commercial fallback, which is why
 * the paywall check runs after the safety check and not before it.
 *
 * The remaining count is always on screen. A counter that only appears when it
 * runs out is a trap, and this product's whole claim is that it is not one.
 */

const CONTAINMENT_TEXT =
  'Voy a parar acá. Por lo que escribiste, esto no es algo para atravesar sola y no es algo que yo pueda acompañar. Hay personas disponibles ahora mismo para hablar con vos.';

const TYPE_LABEL: Record<NonNullable<StoredMessage['type']>, string> = {
  reflection: 'Espejo',
  recommendation: 'Un camino',
  clarifying_question: 'Una pregunta',
  crisis: 'Antes de seguir',
};

export function Chat() {
  const synthesis = currentSynthesis();
  const profile = activeProfile();
  const conversation = synthesis ? conversationFor(synthesis.id) : null;

  const [messages, setMessages] = useState<StoredMessage[]>(() =>
    conversation ? listMessages(conversation.id) : [],
  );
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [containment, setContainment] = useState<string | null>(
    () => activeHighSeverityEvent()?.id ?? null,
  );
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length, thinking]);

  if (!synthesis || !profile || !conversation) {
    return (
      <Screen backdrop="surf" scrim="heavy" opacity={PHOTO.content45}>
        <div className="flex min-h-dvh flex-col justify-center gap-6 px-6 text-center sm:min-h-0">
          <p className="text-[length:var(--fs-body-14)] leading-relaxed text-crema/65">
            La conversación se apoya en tu mapa. Generalo primero y volvemos acá.
          </p>
          <Link to="/onboarding" className="cta no-underline">
            Empezar
          </Link>
        </div>
      </Screen>
    );
  }

  const remaining = remainingQuestions();
  const match = currentMatchFor(synthesis.id);
  const recommendedSlugs = match?.result.matched_modalities.map((m) => m.modality_slug) ?? [];

  const send = async () => {
    const question = draft.trim();
    if (question === '' || thinking) return;

    // Safety first, and before the quota. Someone in crisis must not be met by
    // a payment screen — PDR 1.6.
    const verdict = detectCrisis({ texts: [question] });
    if (verdict.crisis) {
      const event = recordCrisisEvent(verdict, 'chat');
      appendUserMessage(conversation.id, question);
      appendAssistantMessage(conversation.id, {
        type: 'crisis',
        message_text: CONTAINMENT_TEXT,
        linked_modality_slugs: [],
      });
      setMessages(listMessages(conversation.id));
      setDraft('');
      if (verdict.severity === 'high') setContainment(event.id);
      return;
    }

    // Read the quota now rather than trusting the value this render closed
    // over: simulating a subscription and sending straight away is exactly the
    // path where a stale zero would bounce the person back to the paywall.
    if (remainingQuestions() <= 0) {
      // The draft is deliberately left where it is.
      setShowPaywall(true);
      return;
    }

    const user = appendUserMessage(conversation.id, question);
    setMessages(listMessages(conversation.id));
    setDraft('');
    setThinking(true);
    setError(null);

    try {
      const result = await askChat({
        question,
        synthesis: synthesis.synthesis,
        numerology: synthesis.numerology,
        // PDR 10.2: a derived level, never the clinical answers themselves.
        risk: riskLevel({ clinicalBasics: profile.draft.clinical_basics }),
        recommendedSlugs,
        country: profile.draft.country,
        history: listMessages(conversation.id)
          .filter((m) => m.id !== user.id)
          .map((m) => ({ role: m.role, text: m.text })),
      });
      appendAssistantMessage(conversation.id, result.value);
      setMessages(listMessages(conversation.id));
    } catch {
      // A failed turn costs nothing: the half-exchange is removed and the text
      // comes back so retrying is one tap rather than retyping.
      dropMessage(user.id);
      setMessages(listMessages(conversation.id));
      setDraft(question);
      setError('No pudimos responder esta vez. Lo que escribiste sigue acá.');
    } finally {
      setThinking(false);
    }
  };

  return (
    <Screen backdrop="surf" scrim="heavy" opacity={PHOTO.content40}>
      <div className="flex min-h-dvh flex-col px-5 pt-[var(--top-inset)] pb-[var(--bottom-inset)] sm:min-h-0 sm:h-full">
        <div className="mb-3 flex shrink-0 items-baseline justify-between gap-3">
          <p className="eyebrow">Conversación</p>
          <span className="glass-chip shrink-0 rounded-full px-3 py-1 text-[length:var(--fs-label-10)] tracking-wide text-crema/70 uppercase">
            {Number.isFinite(remaining) ? `${remaining} de ${FREE_QUESTIONS}` : 'Sin límite'}
          </span>
        </div>

        <div className="-mx-1 flex-1 overflow-y-auto px-1">
          {messages.length === 0 && (
            <p className="mt-4 text-[length:var(--fs-body-12_5)] leading-relaxed text-crema/55">
              Preguntale algo a tu mapa. Funciona mejor con una situación concreta que con una
              pregunta grande.
            </p>
          )}

          <div className="flex flex-col gap-3 py-2">
            {messages.map((message) =>
              message.role === 'user' ? (
                <p
                  key={message.id}
                  className="self-end rounded-[var(--radius-option)] rounded-br-sm bg-verde/70 px-3.5 py-2.5 text-[length:var(--fs-body-12_5)] leading-relaxed text-crema"
                >
                  {message.text}
                </p>
              ) : (
                <article
                  key={message.id}
                  className={[
                    'rounded-[var(--radius-option)] px-3.5 py-3',
                    message.type === 'crisis'
                      ? 'border border-alerta/30'
                      : 'glass rounded-bl-sm',
                  ].join(' ')}
                >
                  <p className="eyebrow mb-1.5">{TYPE_LABEL[message.type ?? 'reflection']}</p>
                  <p className="text-[length:var(--fs-body-12_5)] leading-relaxed text-blanco/85">{message.text}</p>

                  {message.linked_modality_slugs.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {message.linked_modality_slugs.map((slug) => (
                        <Link
                          key={slug}
                          to="/recomendaciones"
                          className="glass-chip rounded-full px-3 py-1 text-[length:var(--fs-body-10_5)] text-crema/75 no-underline"
                        >
                          {modalityBySlug(slug)?.name_es ?? slug}
                        </Link>
                      ))}
                    </div>
                  )}

                  {message.type === 'crisis' && (
                    <div className="mt-3">
                      <CrisisResourceList country={profile.draft.country} compact />
                    </div>
                  )}
                </article>
              ),
            )}

            {thinking && (
              <p aria-live="polite" className="text-[length:var(--fs-body-12)] text-crema/55">
                Pensando…
              </p>
            )}
          </div>
          <div ref={endRef} />
        </div>

        {error && (
          <p role="alert" className="shrink-0 pt-2 text-[length:var(--fs-body-11_5)] leading-relaxed text-alerta">
            {error}
          </p>
        )}

        <div className="shrink-0 pt-3">
          {containment ? (
            <div className="rounded-[var(--radius-option)] border border-alerta/30 px-4 py-3.5">
              <p className="mb-2.5 text-[length:var(--fs-body-12)] leading-relaxed text-crema/75">
                Dejamos la conversación acá por ahora. No es un castigo ni se borró nada: es
                que esto se habla con alguien.
              </p>
              <button
                type="button"
                onClick={() => {
                  markFalsePositive(containment);
                  setContainment(null);
                }}
                className="text-[length:var(--fs-body-11)] text-crema/55 underline underline-offset-4 hover:text-crema/70"
              >
                Esto no aplica a mi caso
              </button>
            </div>
          ) : showPaywall ? (
            <Paywall
              used={FREE_QUESTIONS}
              onDismiss={() => setShowPaywall(false)}
              onSimulate={() => {
                simulateSubscribe();
                setShowPaywall(false);
                void send();
              }}
            />
          ) : null}

          {!containment && (
            <div className="mt-2.5 flex items-end gap-2">
              <textarea
                rows={2}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                placeholder="Escribí lo que se te venga…"
                aria-label="Tu mensaje"
                className="glass max-h-28 min-h-[52px] flex-1 resize-none rounded-[var(--radius-option)] px-3.5 py-3 text-[length:var(--fs-body-12_5)] text-blanco placeholder:text-crema/55"
              />
              <button
                type="button"
                onClick={() => void send()}
                disabled={draft.trim() === '' || thinking}
                aria-label="Enviar"
                className="glass-chip flex size-11 shrink-0 items-center justify-center rounded-full text-crema disabled:opacity-40"
              >
                <span aria-hidden="true">→</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </Screen>
  );
}
