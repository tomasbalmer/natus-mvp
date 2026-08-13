import { beforeEach, describe, expect, it } from 'vitest';
import {
  FREE_QUESTIONS,
  appendAssistantMessage,
  appendUserMessage,
  conversationFor,
  dropMessage,
  hasQuestionsLeft,
  listMessages,
  remainingQuestions,
  usedQuestions,
} from './chat';
import { cancelSubscription, isSubscribed, simulateSubscribe } from './subscription';
import { clearAll } from './db';
import type { ChatResponse } from '@/lib/schemas';
import { installMemoryStorage } from './memory-storage.testing.ts';

beforeEach(() => {
  installMemoryStorage();
  clearAll();
});

const T0 = 1_000_000;

const reply = (type: ChatResponse['type']): ChatResponse => ({
  type,
  message_text: 'Una respuesta cualquiera.',
  linked_modality_slugs: [],
});

function ask(conversationId: string, type: ChatResponse['type'], at: number) {
  appendUserMessage(conversationId, 'una pregunta', at);
  appendAssistantMessage(conversationId, reply(type), at + 1);
}

describe('the conversation', () => {
  it('is one thread per Soul Map, so a regenerated map starts fresh', () => {
    const first = conversationFor('synthesis-1', T0);
    expect(conversationFor('synthesis-1', T0 + 5).id).toBe(first.id);
    expect(conversationFor('synthesis-2', T0 + 10).id).not.toBe(first.id);
  });

  it('keeps the two halves of an exchange in order', () => {
    const conversation = conversationFor('synthesis-1', T0);
    ask(conversation.id, 'reflection', T0);

    const messages = listMessages(conversation.id);
    expect(messages.map((m) => m.role)).toEqual(['user', 'assistant']);
    expect(messages[1]?.type).toBe('reflection');
  });

  it('does not mix threads', () => {
    const a = conversationFor('synthesis-1', T0);
    const b = conversationFor('synthesis-2', T0);
    ask(a.id, 'reflection', T0);

    expect(listMessages(b.id)).toHaveLength(0);
  });
});

describe('the free quota', () => {
  it('starts whole', () => {
    expect(remainingQuestions()).toBe(FREE_QUESTIONS);
    expect(hasQuestionsLeft()).toBe(true);
  });

  it('spends one per answered question', () => {
    const conversation = conversationFor('synthesis-1', T0);
    ask(conversation.id, 'reflection', T0);
    ask(conversation.id, 'clarifying_question', T0 + 10);

    expect(usedQuestions()).toBe(2);
    expect(remainingQuestions()).toBe(FREE_QUESTIONS - 2);
  });

  it('never charges for a crisis turn', () => {
    const conversation = conversationFor('synthesis-1', T0);
    ask(conversation.id, 'crisis', T0);

    // Being met with a hotline is not a product feature being consumed.
    expect(usedQuestions()).toBe(0);
    expect(remainingQuestions()).toBe(FREE_QUESTIONS);
  });

  it('does not charge for a turn that never produced an answer', () => {
    const conversation = conversationFor('synthesis-1', T0);
    const user = appendUserMessage(conversation.id, 'una pregunta', T0);
    dropMessage(user.id);

    expect(usedQuestions()).toBe(0);
    expect(listMessages(conversation.id)).toHaveLength(0);
  });

  it('runs out, and stays out', () => {
    const conversation = conversationFor('synthesis-1', T0);
    for (let i = 0; i < FREE_QUESTIONS; i++) ask(conversation.id, 'reflection', T0 + i * 10);

    expect(remainingQuestions()).toBe(0);
    expect(hasQuestionsLeft()).toBe(false);
  });

  it('belongs to the person, not to a thread they could restart', () => {
    const first = conversationFor('synthesis-1', T0);
    for (let i = 0; i < FREE_QUESTIONS; i++) ask(first.id, 'reflection', T0 + i * 10);

    const second = conversationFor('synthesis-2', T0 + 500);
    expect(listMessages(second.id)).toHaveLength(0);
    expect(hasQuestionsLeft()).toBe(false);
  });
});

describe('the simulated subscription', () => {
  it('lifts the quota', () => {
    const conversation = conversationFor('synthesis-1', T0);
    for (let i = 0; i < FREE_QUESTIONS; i++) ask(conversation.id, 'reflection', T0 + i * 10);
    expect(hasQuestionsLeft()).toBe(false);

    simulateSubscribe(T0 + 1000);
    expect(isSubscribed()).toBe(true);
    expect(hasQuestionsLeft()).toBe(true);
    expect(remainingQuestions()).toBe(Number.POSITIVE_INFINITY);
  });

  it('puts the quota back when cancelled, counting what was already spent', () => {
    const conversation = conversationFor('synthesis-1', T0);
    ask(conversation.id, 'reflection', T0);
    simulateSubscribe(T0 + 100);
    cancelSubscription();

    expect(remainingQuestions()).toBe(FREE_QUESTIONS - 1);
  });

  it('is off by default', () => {
    expect(isSubscribed()).toBe(false);
  });
});
