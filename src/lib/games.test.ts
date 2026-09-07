import { gameDate, gameDetail } from './games';

/** Built locally, so the assertion holds whatever time zone the test runs in. */
const localIso = (y: number, m: number, d: number, h = 20) =>
  new Date(y, m, d, h, 0, 0).toISOString();

describe('the date on a game row', () => {
  it('reads the way the handoff writes it', () => {
    expect(gameDate(localIso(2026, 7, 21))).toBe('Fri 21 Aug');
  });

  it('does not pad the day, and turns the year over', () => {
    expect(gameDate(localIso(2027, 0, 1))).toBe('Fri 1 Jan');
  });

  it('says nothing rather than "Invalid Date"', () => {
    expect(gameDate('not a date')).toBe('');
  });
});

describe('the detail line', () => {
  const colors = (n: number) => new Array(n).fill({});

  it('is the sample line, assembled from stored values', () => {
    expect(gameDetail({ players: 6, buyIn: 2000, dealtStack: 1900, colors: colors(5) })).toBe(
      '6 players · 20 units in · 1,900 pts dealt · 5 colours',
    );
  });

  it('groups the thousands in the dealt stack', () => {
    expect(gameDetail({ players: 8, buyIn: 3000, dealtStack: 2940, colors: colors(3) })).toBe(
      '8 players · 30 units in · 2,940 pts dealt · 3 colours',
    );
  });

  it('claims no colours for a game that did not keep its case', () => {
    expect(gameDetail({ players: 6, buyIn: 2000, dealtStack: 1900, colors: null })).toBe(
      '6 players · 20 units in · 1,900 pts dealt',
    );
  });
});
