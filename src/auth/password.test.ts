/**
 * These cases mirror the project's policy: `minimum_password_length = 10`, no character
 * requirements, and leaked-password protection doing the rest on the server. If that
 * setting changes, these fail — which is the point, since the form promises whatever
 * this file says.
 */

import { MIN_PASSWORD, PASSWORD_RULE, passwordProblem, strength } from './password';

describe('passwordProblem', () => {
  it('accepts anything long enough', () => {
    expect(passwordProblem('dealmeinplease')).toBeNull();
    expect(passwordProblem('Dealmein42!')).toBeNull();
    expect(passwordProblem('           ')).toBeNull();
  });

  it('rejects anything shorter', () => {
    expect(passwordProblem('Ab1!')).toBe('Ten characters or more, please.');
    expect(passwordProblem('')).toBe('Ten characters or more, please.');
  });

  it('agrees with MIN_PASSWORD at the boundary', () => {
    const nine = 'a'.repeat(MIN_PASSWORD - 1);
    expect(passwordProblem(nine)).toBe('Ten characters or more, please.');
    expect(passwordProblem(`${nine}a`)).toBeNull();
  });

  /**
   * The rule the project dropped. A long all-lowercase passphrase is exactly what the
   * policy is meant to encourage, so the form must not stand in its way — and a breach
   * check, which only the server can run, is what catches the bad ones instead.
   */
  it('does not invent a character rule the server no longer enforces', () => {
    expect(passwordProblem('correcthorsebatterystaple')).toBeNull();
    expect(passwordProblem('DEALMEINPLEASE')).toBeNull();
    expect(passwordProblem('1234567890')).toBeNull();
  });
});

describe('strength', () => {
  it('says nothing until the rule is met — it is a reward, not a warning', () => {
    expect(strength('short')).toBeNull();
  });

  it('rewards length as readily as variety', () => {
    // a long passphrase and a short thicket of symbols read the same, on purpose
    expect(strength('correcthorsebattery')).toBe('Strong.');
    expect(strength('Dealmein4!')).toBe('Strong.');
  });

  it('grades the middle', () => {
    expect(strength('dealmeinplea')).toBe('It will do.');
    expect(strength('dealmeinplease')).toBe('Decent.');
  });
});

describe('PASSWORD_RULE', () => {
  it('states the length and promises nothing else', () => {
    expect(PASSWORD_RULE).toMatch(/[Tt]en characters/);
    // naming a rule the form does not enforce is how the last bug started
    expect(PASSWORD_RULE).not.toMatch(/capital|symbol|number|uppercase/i);
  });
});
