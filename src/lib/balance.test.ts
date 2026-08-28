import { POINTS_PER_UNIT, pointScale, seatBalance, signedPoints, signedUnits, tally } from './balance';
import { shortName } from './names';
import { chipDash, chipInk, isLightChip, luminance } from './color';

describe('balance', () => {
  it('scales dealt points back to the entry', () => {
    expect(pointScale(2000, 1900)).toBeCloseTo(1.053, 3);
    expect(pointScale(2000, 0)).toBe(2000); // no deal yet: guard against ÷0
  });

  it('matches the worked example from the brief', () => {
    // 20-unit entry (2,000 points), 1,900 dealt per player, finish on 3,800
    const b = seatBalance(3800, 2000, 1900);
    expect(b.countsAs).toBe(4000);
    expect(b.net).toBe(2000);
    expect(b.units).toBe(20);
    expect(signedUnits(b.units)).toBe('+20.00 units');
  });

  it('is flat for a seat that finishes on its stack', () => {
    const b = seatBalance(1900, 2000, 1900);
    expect(b.net).toBe(0);
    expect(signedPoints(b.net)).toBe('0');
    expect(signedUnits(b.units)).toBe('0.00 units');
  });

  it('uses a real minus sign for losses', () => {
    const b = seatBalance(950, 2000, 1900);
    expect(b.net).toBe(-1000);
    expect(signedPoints(b.net)).toBe('−1,000');
    expect(signedUnits(b.units)).toBe('−10.00 units');
  });

  it('keeps 1 unit at 100 points', () => {
    expect(POINTS_PER_UNIT).toBe(100);
  });
});

describe('tally', () => {
  it('is happy when every chip is accounted for', () => {
    const t = tally([1900, 1900, 1900], 2000, 1900, 3);
    expect(t.balanced).toBe(true);
    expect(t.message).toBe('Every chip accounted for.');
    expect(t.unitsInPlay).toBe(60);
  });

  it('flags a surplus', () => {
    const t = tally([2000, 1900, 1900], 2000, 1900, 3);
    expect(t.off).toBe(100);
    expect(t.message).toBe('100 points over the 5,700 dealt — recount before paying out.');
  });

  it('flags a shortfall', () => {
    const t = tally([1800, 1900, 1900], 2000, 1900, 3);
    expect(t.off).toBe(-100);
    expect(t.message).toBe('Missing 100 points against the 5,700 dealt — recount before paying out.');
  });
});

describe('seat names', () => {
  it('shows short names in full', () => {
    expect(shortName('Ana')).toBe('Ana');
    expect(shortName('Marta R')).toBe('Marta R');
  });

  it('collapses long names to initials', () => {
    expect(shortName('Marta Rodriguez')).toBe('MR');
    expect(shortName('juan carlos de la cruz')).toBe('JCD');
  });

  it('takes the first two letters of a single long word', () => {
    expect(shortName('Bartholomew')).toBe('BA');
  });

  it('handles an empty seat', () => {
    expect(shortName('')).toBe('');
    expect(shortName('   ')).toBe('');
  });
});

describe('chip colour', () => {
  it('measures luminance', () => {
    expect(luminance('#ffffff')).toBeCloseTo(1, 5);
    expect(luminance('#000')).toBe(0);
  });

  it('flips the dash and ink on light swatches', () => {
    expect(isLightChip('#f4f1e6')).toBe(true);
    expect(chipDash('#f4f1e6')).toBe('#2b2b2b');
    expect(chipInk('#f4f1e6')).toBe('#17181a');

    expect(isLightChip('#1a1a1a')).toBe(false);
    expect(chipDash('#1a1a1a')).toBe('#ffffff');
    expect(chipInk('#1a1a1a')).toBe('#ffffff');
  });
});
