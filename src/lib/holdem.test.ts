/**
 * Every number the course quotes, pinned.
 *
 * A lesson that claims a flush draw comes in 35% of the time is only as good
 * as this file. If a figure here moves, the lesson quoting it is wrong — that
 * is the whole point of the test.
 */
import {
  CATEGORY,
  atLeast,
  callNeeds,
  cards,
  categoryOf,
  commitEquity,
  combinations,
  countCombinations,
  bluffNeeds,
  bluffShare,
  bluffsPerValue,
  deckWithout,
  equity,
  evBluff,
  evCall,
  evSemiBluff,
  evaluate,
  flopChance,
  mdf,
  outsByRiver,
  outsByTurn,
  nutHand,
  outsTurnToRiver,
  priceFacing,
  rangeCombos,
  rangeReaches,
  rangeShare,
  rangeSize,
  rankOf,
  ruleOfFourAndTwo,
  spr,
  sprForPotBets,
  straightPossible,
  suitOf,
  type Card,
} from './holdem';

const pct = (x: number) => Number((x * 100).toFixed(2));
const has = (flop: readonly Card[], rank: number) => flop.some((c) => rankOf(c) === rank);
const suited = (flop: readonly Card[], suit: number) => flop.filter((c) => suitOf(c) === suit).length;

describe('reading a hand', () => {
  const best = (text: string) => evaluate(cards(text));

  it('ranks the ladder in order', () => {
    const ladder = [
      'Ah Kd Qc Js 9h', // high card
      'Ah Ad Qc Js 9h', // pair
      'Ah Ad Qc Qs 9h', // two pair
      'Ah Ad Ac Js 9h', // trips
      'Ah Kd Qc Js Th', // straight
      '2h 5h 9h Jh Kh', // flush
      'Ah Ad Ac Js Jh', // full house
      'Ah Ad Ac As Jh', // quads
      '9h Th Jh Qh Kh', // straight flush
    ].map(best);
    const ascending = [...ladder].sort((a, b) => a - b);
    expect(ladder).toEqual(ascending);
  });

  it('plays the wheel as a five-high straight', () => {
    expect(categoryOf(best('Ah 2d 3c 4s 5h'))).toBe(CATEGORY.straight);
    // and it loses to a six-high straight
    expect(best('Ah 2d 3c 4s 5h')).toBeLessThan(best('2d 3c 4s 5h 6c'));
  });

  it('settles a shared pair on the kicker', () => {
    // both hold an ace on A 9 4 — the king kicker wins
    expect(evaluate(cards('As Kd Ah 9c 4s'))).toBeGreaterThan(evaluate(cards('Ac Qd Ah 9c 4s')));
  });

  it('lets a board play itself', () => {
    const board = 'As Ks Qs Js Ts';
    expect(evaluate(cards(`3d 2c ${board}`))).toBe(evaluate(cards(`7h 6h ${board}`)));
  });

  it('builds a flush from two in the hand and three on the board', () => {
    expect(categoryOf(evaluate(cards('8s 5s Ks 9s 2s')))).toBe(CATEGORY.flush);
    // one spade in hand only makes four — not a flush
    expect(categoryOf(evaluate(cards('8s 5d Ks 9s 2s Ah Qc')))).toBeLessThan(CATEGORY.flush);
  });

  it('picks the best five of seven', () => {
    // aces and kings with a nine — not "three pair"
    const scored = evaluate(cards('As Kh Ad Ks 9c 4d 2h'));
    expect(categoryOf(scored)).toBe(CATEGORY.twoPair);
    expect(scored).toBe(evaluate(cards('As Ad Kh Ks 9c')));
  });
});

describe('why the ranking is in that order', () => {
  // The hand ladder is a rarity table and nothing else. These are the counts
  // out of all 2,598,960 five-card hands, which is what Unit 2 teaches.
  it('counts every five-card hand in the deck', () => {
    const counts = new Array<number>(9).fill(0);
    let royal = 0;
    combinations(deckWithout([]), 5, (hand) => {
      const scored = evaluate(hand);
      const category = categoryOf(scored);
      counts[category]++;
      if (category === CATEGORY.straightFlush) {
        const high = Math.floor((scored % 16 ** 5) / 16 ** 4);
        if (high === 14) royal++;
      }
    });

    expect(counts[CATEGORY.highCard]).toBe(1_302_540);
    expect(counts[CATEGORY.pair]).toBe(1_098_240);
    expect(counts[CATEGORY.twoPair]).toBe(123_552);
    expect(counts[CATEGORY.trips]).toBe(54_912);
    expect(counts[CATEGORY.straight]).toBe(10_200);
    expect(counts[CATEGORY.flush]).toBe(5_108);
    expect(counts[CATEGORY.fullHouse]).toBe(3_744);
    expect(counts[CATEGORY.quads]).toBe(624);
    expect(counts[CATEGORY.straightFlush]).toBe(40);
    expect(royal).toBe(4);

    const total = counts.reduce((a, b) => a + b, 0);
    expect(total).toBe(countCombinations(52, 5));
    expect(total).toBe(2_598_960);
  }, 60_000);

  it('ranks every category by how rare it is', () => {
    // scarcer beats commoner, all the way up the ladder
    const byRarity = [1_302_540, 1_098_240, 123_552, 54_912, 10_200, 5_108, 3_744, 624, 40];
    expect(byRarity).toEqual([...byRarity].sort((a, b) => b - a));
  });

  it('leaves high card and one pair as 92% of all hands', () => {
    expect(pct((1_302_540 + 1_098_240) / 2_598_960)).toBe(92.37);
    expect(pct(1_302_540 / 2_598_960)).toBe(50.12);
  });
});

describe('preflop combinatorics', () => {
  it('deals 1,326 two-card hands, 169 of them distinct', () => {
    expect(countCombinations(52, 2)).toBe(1326);
    expect(13 + 78 + 78).toBe(169);
  });

  it('counts 6 combos of a pair, 4 suited, 12 offsuit', () => {
    expect(countCombinations(4, 2)).toBe(6);
    let suitedAK = 0;
    let offsuitAK = 0;
    combinations(deckWithout([]), 2, ([a, b]) => {
      const ranks = [rankOf(a), rankOf(b)].sort((x, y) => x - y);
      if (ranks[0] !== 13 || ranks[1] !== 14) return;
      if (suitOf(a) === suitOf(b)) suitedAK++;
      else offsuitAK++;
    });
    expect(suitedAK).toBe(4);
    expect(offsuitAK).toBe(12);
    expect(suitedAK + offsuitAK).toBe(16);
  });

  it('deals aces once in 221 and a pair once in 17', () => {
    expect(pct(6 / 1326)).toBe(0.45);
    expect(Math.round(1326 / 6)).toBe(221);
    expect(pct((13 * 6) / 1326)).toBe(5.88);
    expect(Math.round(1326 / 78)).toBe(17);
  });
});

describe('how wide a seat opens', () => {
  // Unit 3 quotes these two ranges by name. They are ordinary published
  // six-max charts, not solver output, and the lessons say so — but the
  // percentages they are described by have to be the real ones.
  const UNDER_THE_GUN = '22+, A9s+, KTs+, QTs+, JTs, T9s, AJo+, KQo';
  const BUTTON =
    '22+, A2s+, K5s+, Q7s+, J7s+, T7s+, 96s+, 85s+, 75s+, 64s+, 53s+, A2o+, K9o+, Q9o+, J9o+, T9o';

  it('reads the notation the way a chart means it', () => {
    expect(rangeSize('AA')).toBe(6);
    expect(rangeSize('AKs')).toBe(4);
    expect(rangeSize('AKo')).toBe(12);
    expect(rangeSize('AK')).toBe(16);
    expect(rangeSize('22+')).toBe(78);
    expect(rangeSize('ATs+')).toBe(16);
    expect(rangeSize('AJo+')).toBe(36);
    expect(rangeSize('A2s+')).toBe(48);
    expect(rangeSize('K5s+')).toBe(32);
  });

  it('counts overlapping pieces once', () => {
    expect(rangeSize('AKs, AKs')).toBe(4);
    expect(rangeSize('AA, 22+')).toBe(78);
    expect(rangeSize('AKs, AKo')).toBe(rangeSize('AK'));
  });

  it('adds up to every pair and every suited hand', () => {
    const pairsAndSuited =
      '22+, A2s+, K2s+, Q2s+, J2s+, T2s+, 92s+, 82s+, 72s+, 62s+, 52s+, 42s+, 32s';
    expect(rangeSize(pairsAndSuited)).toBe(78 + 312);
    expect(pct(rangeShare(pairsAndSuited))).toBe(29.41);
  });

  it('opens 13% under the gun and 39% on the button', () => {
    expect(rangeSize(UNDER_THE_GUN)).toBe(174);
    expect(rangeSize(BUTTON)).toBe(518);
    expect(Math.round(rangeShare(UNDER_THE_GUN) * 100)).toBe(13);
    expect(Math.round(rangeShare(BUTTON) * 100)).toBe(39);
    // the button opens about three times as many hands
    expect(Math.round((518 / 174) * 10) / 10).toBe(3);
  });

  it('folds seven hands in eight under the gun', () => {
    expect(Math.round(1 / rangeShare(UNDER_THE_GUN))).toBe(8);
  });

  it('keeps king-jack offsuit out of the first seat and in the last', () => {
    const inRange = (notation: string, hand: string) => {
      const [a, b] = cards(hand);
      return rangeCombos(notation).some(([x, y]) => (x === a && y === b) || (x === b && y === a));
    };
    expect(inRange(UNDER_THE_GUN, 'Kh Jd')).toBe(false);
    expect(inRange(BUTTON, 'Kh Jd')).toBe(true);
    // and the suited ace that Unit 3 folds early and opens late
    expect(inRange(UNDER_THE_GUN, 'Ad 8d')).toBe(false);
    expect(inRange(BUTTON, 'Ad 8d')).toBe(true);
    expect(inRange(BUTTON, '7s 5s')).toBe(true);
  });
});

describe('the flop', () => {
  it('brings a pocket pair a set or better 11.76% of the time', () => {
    const hole = cards('7d 7c');
    expect(pct(flopChance(hole, (flop) => has(flop, 7)))).toBe(11.76);
  });

  it('brings a suited hand a flush draw 10.94% and a flush 0.84%', () => {
    const hole = cards('As Ks');
    const spades = suitOf(cards('As')[0]);
    expect(pct(flopChance(hole, (flop) => suited(flop, spades) === 2))).toBe(10.94);
    expect(pct(flopChance(hole, (flop) => suited(flop, spades) === 3))).toBe(0.84);
  });

  it('pairs two unpaired cards 32.43% of the time', () => {
    const hole = cards('As Kh');
    expect(pct(flopChance(hole, (flop) => has(flop, 14) || has(flop, 13)))).toBe(32.43);
  });

  it('comes paired 17.18% of the time and monotone 5.18%', () => {
    const paired = flopChance([], (flop) => new Set(flop.map(rankOf)).size < 3);
    const monotone = flopChance([], (flop) => new Set(flop.map(suitOf)).size === 1);
    expect(pct(paired)).toBe(17.18);
    expect(pct(monotone)).toBe(5.18);
  });

  it('fills a flopped set up 33.40% of the time by the river', () => {
    const hero = cards('7d 7c');
    const board = cards('7s Kd 2h');
    const deck = deckWithout([...hero, ...board]);
    let improved = 0;
    let total = 0;
    combinations(deck, 2, (runout) => {
      total++;
      if (categoryOf(evaluate([...hero, ...board, ...runout])) >= CATEGORY.fullHouse) improved++;
    });
    expect(pct(improved / total)).toBe(33.4);
  });
});

describe('what a starting hand is worth', () => {
  it('makes a suited hand a flush by the river once in sixteen', () => {
    const hole = cards('As Ks');
    const spades = suitOf(cards('As')[0]);
    let made = 0;
    let total = 0;
    combinations(deckWithout(hole), 5, (board) => {
      total++;
      if (board.filter((c) => suitOf(c) === spades).length >= 3) made++;
    });
    expect(total).toBe(countCombinations(50, 5));
    expect(pct(made / total)).toBe(6.4);
    expect(Math.round(total / made)).toBe(16);
  }, 60_000);

  it('prices suited at three or four points of equity, not ten', () => {
    expect(pct(equity(cards('8h 7h'), cards('Qs Qd')).equity)).toBe(22.31);
    expect(pct(equity(cards('8h 7c'), cards('Qs Qd')).equity)).toBe(18.58);
    expect(pct(equity(cards('Ah 8h'), cards('As Kd')).equity)).toBe(30.74);
    expect(pct(equity(cards('Ah 8c'), cards('As Kd')).equity)).toBe(26.44);
  }, 200_000);

  it('shows a big pair an overcard more often than players expect', () => {
    const overcards = (pair: string, ranks: number[]) =>
      pct(flopChance(cards(pair), (flop) => flop.some((c) => ranks.includes(rankOf(c)))));
    expect(overcards('Qs Qh', [14, 13])).toBe(41.43);
    expect(overcards('Js Jh', [14, 13, 12])).toBe(56.96);
    expect(overcards('Ts Th', [14, 13, 12, 11])).toBe(69.47);
  });

  it('asks a set-mine to win back seven and a half times the call', () => {
    const flopsASet = 2304 / 19600;
    expect(pct(flopsASet)).toBe(11.76);
    expect(Number(((1 - flopsASet) / flopsASet).toFixed(1))).toBe(7.5);
  });

  it('opens 19% from the cutoff', () => {
    const CUTOFF = '22+, A5s+, K9s+, Q9s+, J9s+, T8s+, 97s+, 87s, 76s, ATo+, KJo+, QJo';
    expect(rangeSize(CUTOFF)).toBe(258);
    expect(Math.round(rangeShare(CUTOFF) * 100)).toBe(19);
  });

  it('makes offsuit aces a bigger slice of a range than every pair combined', () => {
    expect(rangeSize('A2o+')).toBe(144);
    expect(rangeSize('22+')).toBe(78);
    // twelve hand types outweigh thirteen, because the combos differ
    expect(rangeSize('A2o+')).toBeGreaterThan(rangeSize('22+'));
    expect(rangeSize('A5s+')).toBe(36);
  });

  it('puts the hands Unit 4 names in the right seats', () => {
    const UNDER_THE_GUN = '22+, A9s+, KTs+, QTs+, JTs, T9s, AJo+, KQo';
    const CUTOFF = '22+, A5s+, K9s+, Q9s+, J9s+, T8s+, 97s+, 87s, 76s, ATo+, KJo+, QJo';
    const holds = (notation: string, hand: string) => {
      const [a, b] = cards(hand);
      return rangeCombos(notation).some(([x, y]) => (x === a && y === b) || (x === b && y === a));
    };
    // the odd-one-out question
    expect(holds(UNDER_THE_GUN, '6h 6d')).toBe(true);
    expect(holds(UNDER_THE_GUN, 'Ad 9d')).toBe(true);
    expect(holds(UNDER_THE_GUN, 'Ac 4c')).toBe(false);
    // the hand that crosses over between seats
    expect(holds(UNDER_THE_GUN, 'Kh 9h')).toBe(false);
    expect(holds(CUTOFF, 'Kh 9h')).toBe(true);
  });
});

describe('reading a flop', () => {
  it('deals a two-tone flop more often than any other texture', () => {
    let mono = 0;
    let twoTone = 0;
    let rainbow = 0;
    let total = 0;
    combinations(deckWithout([]), 3, (flop) => {
      total++;
      const suits = new Set(flop.map(suitOf)).size;
      if (suits === 1) mono++;
      else if (suits === 2) twoTone++;
      else rainbow++;
    });
    expect(total).toBe(22_100);
    expect(pct(mono / total)).toBe(5.18);
    expect(pct(twoTone / total)).toBe(55.06);
    expect(pct(rainbow / total)).toBe(39.76);
  });

  it('makes a backdoor flush draw worth about one out', () => {
    const backdoor = countCombinations(10, 2) / countCombinations(47, 2);
    expect(pct(backdoor)).toBe(4.16);
    expect(pct(outsByRiver(1))).toBe(4.26);
    expect(Math.abs(backdoor - outsByRiver(1)) * 100).toBeLessThan(0.2);
  });

  it('knows which flops already allow a straight', () => {
    // two connected cards are not enough — you would need three from your hand
    expect(straightPossible(cards('Js 10d 6c'))).toBe(false);
    expect(straightPossible(cards('Qs Js 4d'))).toBe(false);
    // three inside a five-rank window are
    expect(straightPossible(cards('Js 10d 9c'))).toBe(true);
    expect(straightPossible(cards('9h 7d 5s'))).toBe(true);
    expect(straightPossible(cards('8h 7h 6s'))).toBe(true);
  });

  it('names the nuts on the boards Unit 5 asks about', () => {
    expect(nutHand(cards('Qs Js 4d')).category).toBe(CATEGORY.trips);
    expect(nutHand(cards('8h 7h 6s')).category).toBe(CATEGORY.straight);
    // ten-nine really is that nut straight
    expect(evaluate(cards('10d 9d 8h 7h 6s'))).toBe(nutHand(cards('8h 7h 6s')).score);
  });

  it('keeps four to a flush worth nothing', () => {
    expect(categoryOf(evaluate(cards('As Jd Ks 9s 4s')))).toBe(CATEGORY.highCard);
    expect(categoryOf(evaluate(cards('Qs 7s Ks 9s 4s')))).toBe(CATEGORY.flush);
    // the fifteen-out monster is still not a made hand
    expect(categoryOf(evaluate(cards('Js 10s Qs 9s 4d')))).toBe(CATEGORY.highCard);
  });

  it('beats a paired-board full house only with quads', () => {
    const board = 'Qh Qd 5c';
    const boat = evaluate(cards(`5h 5d ${board}`));
    expect(categoryOf(boat)).toBe(CATEGORY.fullHouse);
    // a lone queen is three of a kind, which loses to the full house
    expect(categoryOf(evaluate(cards(`Qc 3d ${board}`)))).toBe(CATEGORY.trips);
    expect(evaluate(cards(`Qc 3d ${board}`))).toBeLessThan(boat);
    // only the two remaining queens together get there
    expect(evaluate(cards(`Qs Qc ${board}`))).toBeGreaterThan(boat);
    expect(nutHand(cards(board), cards('5h 5d')).category).toBe(CATEGORY.quads);
  });
});

describe('draw odds', () => {
  it('brings a flush draw in 34.97% of the time', () => {
    expect(pct(outsByRiver(9))).toBe(34.97);
    expect(pct(outsByTurn(9))).toBe(19.15);
    expect(pct(outsTurnToRiver(9))).toBe(19.57);
  });

  it('brings an open-ender in 31.45% and a gutshot 16.47%', () => {
    expect(pct(outsByRiver(8))).toBe(31.45);
    expect(pct(outsByRiver(4))).toBe(16.47);
  });

  it('is close enough to the rule of 4 at nine outs', () => {
    expect(Math.abs(ruleOfFourAndTwo(9, 2) - outsByRiver(9)) * 100).toBeLessThan(1.1);
  });

  it('breaks the rule of 4 badly at fifteen outs', () => {
    expect(pct(outsByRiver(15))).toBe(54.12);
    expect(pct(ruleOfFourAndTwo(15, 2))).toBe(60);
    // the shortcut overstates a monster draw by nearly six points
    expect(pct(ruleOfFourAndTwo(15, 2) - outsByRiver(15))).toBe(5.88);
  });

  it('counts a combo draw at twelve outs as a coin flip short of half', () => {
    expect(pct(outsByRiver(12))).toBe(44.96);
  });
});

describe('the draws Unit 6 puts a price on', () => {
  /** Turn cards that make a straight or better. */
  const drawOuts = (hole: string, flop: string) => {
    const h = cards(hole);
    const f = cards(flop);
    return deckWithout([...h, ...f]).filter(
      (turn) => categoryOf(evaluate([...h, ...f, turn])) >= CATEGORY.straight,
    ).length;
  };

  it('counts every draw the lessons name', () => {
    expect(drawOuts('Qd Jd', 'Ad 7d 3c')).toBe(9); // flush draw
    expect(drawOuts('Jh 10c', '9s 8d 2c')).toBe(8); // open-ender
    expect(drawOuts('5d 4d', '7c 6s 2h')).toBe(8); // open-ender, bottom end
    expect(drawOuts('Kh Qd', 'Js 9c 3h')).toBe(4); // gutshot
    expect(drawOuts('9d 5d', 'Jc 8s 7h')).toBe(8); // double gutshot — a six or a ten
    expect(drawOuts('8h 7h', '9h 6s 2h')).toBe(15); // straight and flush together
  });

  it('does not count overcards as outs', () => {
    // nine clean flush outs; the ace and king are not straight-or-better
    expect(drawOuts('As Ks', 'Qs 8s 3h')).toBe(9);
  });

  it('prices the bets the lessons use', () => {
    expect(pct(callNeeds(10, 30))).toBe(20); // a third of the pot
    expect(pct(callNeeds(22.5, 30))).toBe(30); // three-quarters
    expect(pct(callNeeds(15, 20))).toBe(30);
    expect(pct(callNeeds(4, 20))).toBe(14.29);
    expect(pct(callNeeds(25, 50))).toBe(25); // the turn call that becomes a fold
  });

  it('makes each out worth about two points on the turn', () => {
    expect(pct(1 / 46)).toBe(2.17);
  });

  it('drifts on the flop with many outs and stays honest on the turn', () => {
    // x4 overstates, and worsens as outs pile up
    expect(pct(ruleOfFourAndTwo(9, 2) - outsByRiver(9))).toBe(1.03);
    expect(pct(ruleOfFourAndTwo(12, 2) - outsByRiver(12))).toBe(3.04);
    expect(pct(ruleOfFourAndTwo(15, 2) - outsByRiver(15))).toBe(5.88);
    // x2 understates by a little, at any number of outs
    expect(pct(outsTurnToRiver(9) - ruleOfFourAndTwo(9, 1))).toBe(1.57);
    expect(pct(outsTurnToRiver(15) - ruleOfFourAndTwo(15, 1))).toBe(2.61);
    expect(pct(outsTurnToRiver(15))).toBe(32.61);
    expect(pct(outsTurnToRiver(4))).toBe(8.7);
  });
});

describe('the sizing table', () => {
  // Three numbers per bet size, and they are three different questions:
  // what a call needs, how often a bluff must work, how much must be defended.
  const sizes: [number, number, string, number, number, number][] = [
    [10, 30, 'a third of the pot', 20, 25, 75],
    [15, 30, 'half pot', 25, 33.33, 66.67],
    [20, 30, 'two-thirds', 28.57, 40, 60],
    [22.5, 30, 'three-quarters', 30, 42.86, 57.14],
    [30, 30, 'pot', 33.33, 50, 50],
    [45, 30, 'a 1.5x overbet', 37.5, 60, 40],
    [60, 30, 'a 2x overbet', 40, 66.67, 33.33],
  ];

  it('prices every size the course uses', () => {
    for (const [bet, pot, label, call, bluff, defend] of sizes) {
      // labelled so a failure names the size rather than just the number
      expect(`${label}: ${pct(callNeeds(bet, pot))}`).toBe(`${label}: ${call}`);
      expect(`${label}: ${pct(bluffNeeds(bet, pot))}`).toBe(`${label}: ${bluff}`);
      expect(`${label}: ${pct(mdf(bet, pot))}`).toBe(`${label}: ${defend}`);
    }
  });

  it('keeps the bluff requirement and the defence frequency complementary', () => {
    for (const [bet, pot] of sizes) {
      expect(pct(bluffNeeds(bet, pot) + mdf(bet, pot))).toBe(100);
    }
  });

  it('raises the price on the caller more slowly than the size grows', () => {
    // doubling half pot to pot moves the caller's requirement only 25% -> 33%
    expect(pct(callNeeds(15, 30))).toBe(25);
    expect(pct(callNeeds(30, 30))).toBe(33.33);
    // but it moves what the bluff needs from 33% to 50%
    expect(pct(bluffNeeds(15, 30))).toBe(33.33);
    expect(pct(bluffNeeds(30, 30))).toBe(50);
  });
});

describe('the hands Unit 7 bets and checks', () => {
  const read = (hole: string, board: string) => categoryOf(evaluate([...cards(hole), ...cards(board)]));
  const better = (board: string, a: string, b: string) =>
    evaluate([...cards(a), ...cards(board)]) > evaluate([...cards(b), ...cards(board)]);

  it('makes top pair top kicker a value bet on a dry flop', () => {
    expect(read('As Qh', 'Qd 8c 3h')).toBe(CATEGORY.pair);
    // ace-king is only ace-high here, so it is behind, not ahead
    expect(read('Ad Kd', 'Qd 8c 3h')).toBe(CATEGORY.highCard);
    expect(better('Qd 8c 3h', 'As Qh', 'Ad Kd')).toBe(true);
  });

  it('demotes that same hand once the river pairs the board', () => {
    const river = 'Qd 8c 3h Jh 8s';
    expect(read('As Qh', river)).toBe(CATEGORY.twoPair); // queens and eights
    expect(read('Qc Jc', river)).toBe(CATEGORY.twoPair); // queens and jacks
    expect(better(river, 'Qc Jc', 'As Qh')).toBe(true);
    expect(read('8d 7d', river)).toBe(CATEGORY.trips);
    expect(better(river, '8d 7d', 'As Qh')).toBe(true);
  });

  it('leaves the thin-value and pot-control hands where the lessons put them', () => {
    expect(read('9h 9d', 'Ks 7d 2c 5h 3s')).toBe(CATEGORY.pair);
    expect(read('7h 6h', 'Ks 7d 2c')).toBe(CATEGORY.pair); // second pair
    expect(read('8h 7h', 'Kh 9h 2s')).toBe(CATEGORY.highCard); // a draw, not a hand
  });
});

describe('defending against a bet', () => {
  it('leaves under a third of your range alive after three half-pot bets', () => {
    // defending perfectly on every street still folds most of what you started with
    expect(pct(mdf(15, 30) ** 3)).toBe(29.63);
    expect(pct(mdf(20, 30) ** 3)).toBe(21.6);
    expect(pct(mdf(30, 30) ** 3)).toBe(12.5);
  });

  it('prices a raise from both sides', () => {
    // pot 30, they bet 30, you raise to 90
    const pot = 30;
    const theirBet = 30;
    const raiseTo = 90;
    // your bluff-raise risks 90 to win the 60 already out there
    expect(pct(bluffNeeds(raiseTo, pot + theirBet))).toBe(60);
    // they add 60 more into a pot of 150
    const toCall = raiseTo - theirBet;
    const potFacingThem = pot + theirBet + raiseTo;
    expect(pct(toCall / (potFacingThem + toCall))).toBe(28.57);
  });

  it('makes a bluff-catcher exactly indifferent against a balanced river bet', () => {
    // two value combos to one bluff is the pot-sized ratio
    const bluffShare = 1 / 3;
    expect(pct(bluffShare)).toBe(33.33);
    expect(pct(callNeeds(30, 30))).toBe(33.33);
    expect(pct(bluffsPerValue(30, 30))).toBe(50); // one bluff per two value hands
  });
});

describe('the hands Unit 8 calls and folds', () => {
  const read = (hole: string, board: string) => categoryOf(evaluate([...cards(hole), ...cards(board)]));
  const drawOuts = (hole: string, flop: string) => {
    const h = cards(hole);
    const f = cards(flop);
    return deckWithout([...h, ...f]).filter(
      (turn) => categoryOf(evaluate([...h, ...f, turn])) >= CATEGORY.straight,
    ).length;
  };

  it('makes pocket eights a pure bluff-catcher on an ace-king board', () => {
    expect(read('8h 8d', 'As Kd 7c 4h 2s')).toBe(CATEGORY.pair);
  });

  it('gives the check-raise bluff twelve outs', () => {
    // flush draw plus a gutshot to the ten
    expect(drawOuts('8s 7s', 'Js 9s 4d')).toBe(12);
  });

  it('keeps the float hand as air with a backdoor', () => {
    expect(read('Ah 10h', 'Ks 8d 3h')).toBe(CATEGORY.highCard);
  });

  it('separates the two runouts Unit 8 asks about', () => {
    // the dry runout leaves top pair as top pair
    expect(read('As Qh', 'Qd 8c 3h 4d 2c')).toBe(CATEGORY.pair);
    // the wet one demotes it to a beatable two pair
    expect(read('As Qh', 'Qd 8c 3h Jh 8s')).toBe(CATEGORY.twoPair);
  });
});

describe('the preflop war, in euros', () => {
  // €1/€2, €200 stacks. Every figure Unit 9 quotes, counted out.
  it('agrees with callNeeds when the pot is counted the other way', () => {
    expect(priceFacing(30, 30 + 30)).toBeCloseTo(callNeeds(30, 30), 12);
    expect(priceFacing(15, 30 + 15)).toBeCloseTo(callNeeds(15, 30), 12);
  });

  it('prices a 3-bet in position', () => {
    // under the gun opens to 6, the button makes it 18, blinds fold
    expect(pct(priceFacing(12, 1 + 2 + 6 + 18))).toBe(30.77);
    expect(pct(bluffNeeds(18, 9))).toBe(66.67);
    // a smaller 3-bet needs fewer folds
    expect(pct(bluffNeeds(15, 9))).toBe(62.5);
  });

  it('prices a 3-bet out of position, which is worse on both counts', () => {
    // the big blind makes it 24 over the same 6 open
    expect(pct(priceFacing(18, 1 + 6 + 24))).toBe(36.73);
    expect(pct(bluffNeeds(24, 9))).toBe(72.73);
    // bigger size charges them more, and asks more of the bluff
    expect(bluffNeeds(24, 9)).toBeGreaterThan(bluffNeeds(18, 9));
    expect(priceFacing(18, 31)).toBeGreaterThan(priceFacing(12, 27));
  });

  it('prices a big-blind defence', () => {
    expect(pct(priceFacing(4, 1 + 2 + 6))).toBe(30.77);
    expect(pct(priceFacing(3, 1 + 2 + 5))).toBe(27.27);
  });

  it('prices a squeeze', () => {
    // cutoff opens 6, button calls, big blind makes it 30
    expect(pct(bluffNeeds(28, 15))).toBe(65.12);
    expect(pct(priceFacing(24, 1 + 6 + 6 + 30))).toBe(35.82);
  });

  it('prices a 4-bet', () => {
    // 6 open, 18 three-bet, 42 four-bet
    expect(pct(priceFacing(24, 1 + 2 + 18 + 42))).toBe(27.59);
    expect(pct(bluffNeeds(42, 21))).toBe(66.67);
  });

  it('sets the stack-off threshold at 37.5% — which ace-king clears against queens', () => {
    const potAfterShove = 1 + 2 + 18 + 42 + 200;
    expect(pct(priceFacing(200 - 42, potAfterShove))).toBe(37.53);
    // AKo vs QQ is 42.84%, pinned above — so the call is correct against that hand
    expect(42.84).toBeGreaterThan(37.53);
    // but against aces it is nowhere near
    expect(7.43).toBeLessThan(37.53);
  });
});

describe('ranges meeting boards', () => {
  // Under the gun opens 13%. The big blind 3-bets its very best hands, so what
  // is left CALLING is capped below them — which is the whole of Unit 10.
  const UTG = '22+, A9s+, KTs+, QTs+, JTs, T9s, AJo+, KQo';
  const BB_CALL =
    '22-JJ, A2s-AJs, K5s+, Q7s+, J8s+, T8s+, 97s+, 86s+, 75s+, 65s, 54s, A8o-AJo, KTo+, QTo+, JTo';

  it('reads a span the way a chart writes one', () => {
    expect(rangeSize('22-JJ')).toBe(60);
    expect(rangeSize('A2s-AJs')).toBe(40);
    expect(rangeSize('A8o-AJo')).toBe(48);
    // a span and a plus agree where they should
    expect(rangeSize('22-AA')).toBe(rangeSize('22+'));
    expect(rangeSize('QQ-AA')).toBe(rangeSize('QQ+'));
  });

  it('sizes the two ranges', () => {
    expect(rangeSize(UTG)).toBe(174);
    expect(rangeSize(BB_CALL)).toBe(324);
    // the 34 combinations a caller cannot have
    expect(rangeSize('QQ+, AK')).toBe(34);
  });

  it('gives the raiser a sevenfold nut advantage on ace-king-high', () => {
    const board = cards('As Kd 4c');
    const topPair = evaluate([...cards('Ah 2h'), ...board]);

    const raiser = rangeReaches(UTG, board, topPair);
    const caller = rangeReaches(BB_CALL, board, topPair);
    expect(pct(raiser.share)).toBe(33.8); // 48 of 142
    expect(pct(caller.share)).toBe(24.29); // 68 of 280

    // the real gap is at the top, not in how often each makes a pair
    const raiserTwoPair = rangeReaches(UTG, board, atLeast(CATEGORY.twoPair));
    const callerTwoPair = rangeReaches(BB_CALL, board, atLeast(CATEGORY.twoPair));
    expect(raiserTwoPair.hits).toBe(18);
    expect(callerTwoPair.hits).toBe(5);
    expect(pct(raiserTwoPair.share)).toBe(12.68);
    expect(pct(callerTwoPair.share)).toBe(1.79);
  });

  it('hands every straight to the caller on seven-six-five', () => {
    const board = cards('7h 6h 5s');
    const topPair = evaluate([...cards('7d 2d'), ...board]);

    // the raiser still shows more top-pair-or-better, purely from overpairs
    expect(pct(rangeReaches(UTG, board, topPair).share)).toBe(30.91);
    expect(pct(rangeReaches(BB_CALL, board, topPair).share)).toBe(19.73);

    // and yet the caller holds more strong hands, and all of the straights
    expect(rangeReaches(UTG, board, atLeast(CATEGORY.twoPair)).hits).toBe(9);
    expect(rangeReaches(BB_CALL, board, atLeast(CATEGORY.twoPair)).hits).toBe(20);
    expect(rangeReaches(UTG, board, atLeast(CATEGORY.straight)).hits).toBe(0);
    expect(rangeReaches(BB_CALL, board, atLeast(CATEGORY.straight)).hits).toBe(4);
  });

  it('removes the board cards from both ranges before counting', () => {
    const board = cards('As Kd 4c');
    // the ace and king on board kill combos of AA, KK and AK
    expect(rangeReaches('AA', board, 0).combos).toBe(3);
    expect(rangeReaches('AK', board, 0).combos).toBe(9);
    expect(rangeReaches('22', board, 0).combos).toBe(6);
  });
});

describe('counting combinations', () => {
  const BB_CALL =
    '22-JJ, A2s-AJs, K5s+, Q7s+, J8s+, T8s+, 97s+, 86s+, 75s+, 65s, 54s, A8o-AJo, KTo+, QTo+, JTo';
  /** Every hand in a range, sorted into what it makes on this board. */
  const census = (notation: string, boardText: string) => {
    const board = cards(boardText);
    const dead = new Set(board);
    const counts = new Array<number>(9).fill(0);
    let total = 0;
    for (const hole of rangeCombos(notation)) {
      if (dead.has(hole[0]) || dead.has(hole[1])) continue;
      total++;
      counts[categoryOf(evaluate([...hole, ...board]))]++;
    }
    return { counts, total };
  };
  /** Unrestricted: all 1,326 starting hands. */
  const ANY =
    '22+, A2s+, K2s+, Q2s+, J2s+, T2s+, 92s+, 82s+, 72s+, 62s+, 52s+, 42s+, 32s,' +
    'A2o+, K2o+, Q2o+, J2o+, T2o+, 92o+, 82o+, 72o+, 62o+, 52o+, 42o+, 32o';

  it('covers the whole deck with an unrestricted range', () => {
    expect(rangeSize(ANY)).toBe(1326);
  });

  it('takes combinations off a hand as the board eats its cards', () => {
    expect(census('AK', 'Ks 9d 4c 7h 2s').total).toBe(12); // one king gone
    expect(census('AK', 'As Kd 4c').total).toBe(9); // an ace and a king gone
    expect(census('KK', 'Ks 9d 4c').total).toBe(3);
    expect(census('KK', 'Ks Kd 4c').total).toBe(1);
    expect(census('AA', 'Ks 9d 4c').total).toBe(6); // untouched
  });

  it('makes two pair three times a set, for random cards', () => {
    const { counts, total } = census(ANY, 'Ks 9d 4c');
    expect(total).toBe(1176);
    expect(counts[CATEGORY.twoPair]).toBe(27);
    expect(counts[CATEGORY.trips]).toBe(9);
    expect(counts[CATEGORY.twoPair] / counts[CATEGORY.trips]).toBe(3);
  });

  it('and six times a set by the river', () => {
    const { counts, total } = census(ANY, 'Ks 9d 4c 7h 2s');
    expect(total).toBe(1081);
    expect(counts[CATEGORY.twoPair]).toBe(90);
    expect(counts[CATEGORY.trips]).toBe(15);
  });

  it('reverses that entirely once a real range is applied', () => {
    // a calling range holds every small pair and almost none of the
    // offsuit junk that makes two pair — so sets become the commoner hand
    const { counts, total } = census(BB_CALL, 'Ks 9d 4c 7h 2s');
    expect(total).toBe(275);
    expect(counts[CATEGORY.twoPair]).toBe(6);
    expect(counts[CATEGORY.trips]).toBe(12);
    expect(counts[CATEGORY.trips]).toBeGreaterThan(counts[CATEGORY.twoPair]);
    expect(counts[CATEGORY.pair]).toBe(129);
    expect(counts[CATEGORY.highCard]).toBe(128);
  });

  it('counts every straight and every flush a board allows', () => {
    // 9-8-7 makes exactly three straights: JT, T6 and 65
    expect(census(ANY, '9s 8d 7c').counts[CATEGORY.straight]).toBe(48);
    expect(48 / 16).toBe(3);
    // three spades leaves ten, and any two of them is a flush
    expect(census(ANY, 'Ks 9s 4s').counts[CATEGORY.flush]).toBe(45);
    expect(countCombinations(10, 2)).toBe(45);
  });
});

describe('expected value, in euros', () => {
  it('turns the same draw at the same price into opposite answers', () => {
    // pot 20, they bet 10 — €30 in the middle and €10 to call
    expect(pct(priceFacing(10, 30))).toBe(25);
    expect(Number(evCall(outsByRiver(9), 10, 30).toFixed(2))).toBe(3.99);
    expect(Number(evCall(outsTurnToRiver(9), 10, 30).toFixed(2))).toBe(-2.17);
  });

  it('puts the break-even exactly where the price is', () => {
    expect(evCall(priceFacing(10, 30), 10, 30)).toBeCloseTo(0, 10);
    expect(evCall(priceFacing(25, 75), 25, 75)).toBeCloseTo(0, 10);
  });

  it('prices a bluff at every fold frequency', () => {
    expect(pct(bluffNeeds(20, 30))).toBe(40);
    expect(evBluff(0.3, 20, 30)).toBeCloseTo(-5, 10);
    expect(evBluff(0.4, 20, 30)).toBeCloseTo(0, 10); // the break-even point
    expect(evBluff(0.5, 20, 30)).toBeCloseTo(5, 10);
    expect(evBluff(0.6, 20, 30)).toBeCloseTo(10, 10);
  });

  it('shows what the equity adds to a semi-bluff', () => {
    // the same €20 bet into €30, with 35% equity on the times it is called
    expect(evSemiBluff(0.4, 0.35, 20, 30)).toBeCloseTo(14.7, 10);
    expect(evBluff(0.4, 20, 30)).toBeCloseTo(0, 10);
    // and even when they never fold, the draw keeps it profitable
    expect(evSemiBluff(0, 0.35, 20, 30)).toBeCloseTo(4.5, 10);
    expect(evBluff(0, 20, 30)).toBeCloseTo(-20, 10);
  });

  it('agrees with the pure bluff when the hand has no equity', () => {
    for (const f of [0, 0.25, 0.5, 1]) {
      expect(evSemiBluff(f, 0, 20, 30)).toBeCloseTo(evBluff(f, 20, 30), 10);
    }
  });

  it('counts what beats top pair, one opponent at a time', () => {
    const board = cards('Ks 9d 4c');
    const hero = cards('Kh Qd');
    const dead = new Set([...board, ...hero]);
    const mine = evaluate([...hero, ...board]);
    const ANY =
      '22+, A2s+, K2s+, Q2s+, J2s+, T2s+, 92s+, 82s+, 72s+, 62s+, 52s+, 42s+, 32s,' +
      'A2o+, K2o+, Q2o+, J2o+, T2o+, 92o+, 82o+, 72o+, 62o+, 52o+, 42o+, 32o';

    let behind = 0;
    let total = 0;
    for (const hole of rangeCombos(ANY)) {
      if (dead.has(hole[0]) || dead.has(hole[1])) continue;
      total++;
      if (evaluate([...hole, ...board]) > mine) behind++;
    }
    expect(total).toBe(1081);
    expect(behind).toBe(42);
    expect(pct(behind / total)).toBe(3.89);
  });
});

describe('stack depth', () => {
  const STACK = 200; // €1/€2, 100 big blinds

  it('lets the preflop sizing choose the SPR', () => {
    // open to 6 and get called: the small blind's €1 is dead money
    expect(Number(spr(STACK - 6, 1 + 6 + 6).toFixed(2))).toBe(14.92);
    // 6 open, 18 three-bet, called
    expect(Number(spr(STACK - 18, 1 + 2 + 18 + 18).toFixed(2))).toBe(4.67);
    // ... and a 42 four-bet, called
    expect(Number(spr(STACK - 42, 1 + 2 + 42 + 42).toFixed(2))).toBe(1.82);
  });

  it('makes a short stack in a raised pot play like a deep one in a 3-bet pot', () => {
    const shortStack = Number(spr(60 - 6, 1 + 6 + 6).toFixed(2));
    expect(shortStack).toBe(4.15);
    const threeBetPot = Number(spr(STACK - 18, 1 + 2 + 18 + 18).toFixed(2));
    expect(Math.abs(shortStack - threeBetPot)).toBeLessThan(0.6);
  });

  it('raises the commitment threshold with depth, and never past half', () => {
    expect(pct(commitEquity(1))).toBe(33.33);
    expect(pct(commitEquity(2))).toBe(40);
    expect(pct(commitEquity(3))).toBe(42.86);
    expect(pct(commitEquity(4))).toBe(44.44);
    expect(pct(commitEquity(6))).toBe(46.15);
    expect(pct(commitEquity(13))).toBe(48.15);
    expect(commitEquity(1000)).toBeLessThan(0.5);
  });

  it('counts the pot-sized bets it takes to get all-in', () => {
    expect(sprForPotBets(1)).toBe(1);
    expect(sprForPotBets(2)).toBe(4);
    expect(sprForPotBets(3)).toBe(13);
    expect(sprForPotBets(4)).toBe(40);
    // a 100bb single-raised pot is about three pot-sized bets deep
    expect(spr(STACK - 6, 1 + 6 + 6)).toBeGreaterThan(sprForPotBets(3));
    expect(spr(STACK - 6, 1 + 6 + 6)).toBeLessThan(sprForPotBets(4));
  });

  it('makes set-mining a stack-depth question', () => {
    // a €12 call needs roughly 7.5x behind to break even on the misses
    const flopsASet = 2304 / 19600;
    const needed = 12 * ((1 - flopsASet) / flopsASet);
    expect(Number(needed.toFixed(0))).toBe(90);
    expect(STACK - 18).toBeGreaterThan(needed); // deep enough after a 3-bet call
    expect(60 - 18).toBeLessThan(needed); // a short stack is not
  });
});

describe('balance', () => {
  it('makes the bluff share of a betting range equal the caller’s price', () => {
    // the identity Unit 14 is built on
    for (const [bet, pot] of [
      [10, 30],
      [15, 30],
      [20, 30],
      [30, 30],
      [45, 30],
      [60, 30],
    ] as const) {
      expect(bluffShare(bet, pot)).toBeCloseTo(callNeeds(bet, pot), 12);
    }
  });

  it('sets the ratio by size', () => {
    expect(pct(bluffShare(15, 30))).toBe(25); // half pot: one bluff in four bets
    expect(pct(bluffShare(30, 30))).toBe(33.33); // pot: one in three
    expect(pct(bluffShare(60, 30))).toBe(40); // twice pot: two in five
    // written the other way round, as value hands per bluff
    expect(1 / bluffsPerValue(15, 30)).toBeCloseTo(3, 10);
    expect(1 / bluffsPerValue(30, 30)).toBeCloseTo(2, 10);
    expect(1 / bluffsPerValue(60, 30)).toBeCloseTo(1.5, 10);
  });

  it('leaves both players at zero when both play the equilibrium', () => {
    // pot 30, a pot-sized bet, two value hands per bluff, defence at MDF
    expect(pct(mdf(30, 30))).toBe(50);
    expect(evBluff(1 - mdf(30, 30), 30, 30)).toBeCloseTo(0, 10);
    expect(evCall(bluffShare(30, 30), 30, 60)).toBeCloseTo(0, 10);
  });

  it('pays the bettor the whole pot when the caller folds too much', () => {
    expect(evBluff(1, 30, 30)).toBeCloseTo(30, 10); // folds everything
    expect(evBluff(0.7, 20, 30)).toBeCloseTo(15, 10); // folds 70% to a 2/3 bet
    // defending at MDF against that same bet is folding only 40%
    expect(pct(mdf(20, 30))).toBe(60);
    expect(evBluff(0.4, 20, 30)).toBeCloseTo(0, 10);
  });

  it('costs the bettor the whole bet when the caller never folds', () => {
    expect(evBluff(0, 30, 30)).toBeCloseTo(-30, 10);
    expect(evBluff(0.1, 20, 30)).toBeCloseTo(-15, 10);
  });

  it('keeps the defence frequency and the bluff requirement complementary', () => {
    for (const [bet, pot] of [
      [15, 30],
      [30, 30],
      [60, 30],
    ] as const) {
      expect(pct(mdf(bet, pot) + bluffNeeds(bet, pot))).toBe(100);
    }
  });
});

describe('the price of a bet', () => {
  it('asks 25% of a call facing half pot, 33% facing pot', () => {
    expect(pct(callNeeds(50, 100))).toBe(25);
    expect(pct(callNeeds(100, 100))).toBe(33.33);
    expect(pct(callNeeds(150, 100))).toBe(37.5);
  });

  it('defends 67% of the pot against half pot, 50% against pot', () => {
    expect(pct(mdf(50, 100))).toBe(66.67);
    expect(pct(mdf(100, 100))).toBe(50);
    expect(pct(mdf(150, 100))).toBe(40);
    // what the defender folds is exactly what a bluff needs to work
    expect(pct(mdf(50, 100) + bluffNeeds(50, 100))).toBe(100);
  });

  it("never confuses the caller's price with the defence frequency", () => {
    // facing half pot: a call needs 25% equity, but the pot needs defending 67%
    expect(pct(callNeeds(50, 100))).toBe(25);
    expect(pct(mdf(50, 100))).toBe(66.67);
    expect(pct(1 - callNeeds(50, 100))).not.toBe(pct(mdf(50, 100)));
  });

  it('bluffs one in three at half pot and one in two at pot', () => {
    expect(bluffsPerValue(50, 100)).toBeCloseTo(1 / 3, 10);
    expect(bluffsPerValue(100, 100)).toBeCloseTo(1 / 2, 10);
    expect(bluffsPerValue(200, 100)).toBeCloseTo(2 / 3, 10);
    // the bluffer's ratio and the caller's price are the same number
    expect(bluffsPerValue(50, 100)).toBeCloseTo(bluffNeeds(50, 100), 10);
  });
});

describe('preflop all-in equity', () => {
  const heads = (a: string, b: string) => pct(equity(cards(a), cards(b)).equity);

  it('runs every one of the 1,712,304 boards', () => {
    expect(equity(cards('As Ah'), cards('Ks Kh')).boards).toBe(countCombinations(48, 5));
  }, 120_000);

  it('makes aces a 82.6% favourite over kings', () => {
    expect(heads('As Ah', 'Ks Kh')).toBe(82.64);
  }, 120_000);

  it('crushes big cards with aces', () => {
    expect(heads('As Ah', 'Ks Qs')).toBe(83.56); // suited runs better
    expect(heads('As Ah', 'Kd Qc')).toBe(86.35);
    expect(heads('As Ah', 'Kd Ac')).toBe(92.57); // sharing an ace is the worst of it
  }, 120_000);

  it('makes a pair against two overcards a near coin flip', () => {
    expect(heads('9s 9h', 'Ad Kc')).toBe(55.68);
    expect(heads('2s 2h', 'Ad Kc')).toBe(53.04);
  }, 120_000);

  it('leaves ace-king behind queens', () => {
    expect(heads('As Ks', 'Qd Qc')).toBe(46.21);
    expect(heads('As Kh', 'Qd Qc')).toBe(42.84);
  }, 120_000);

  it('makes a pair with one overcard a 71.5% favourite', () => {
    expect(heads('Qs Qh', 'Ad Jc')).toBe(71.47);
    expect(heads('Qs Qh', '8d 7d')).toBe(77.69);
  }, 120_000);

  it('costs a dominated hand three quarters of the pot', () => {
    expect(heads('As Kh', 'Ad Qc')).toBe(74.02);
    expect(heads('As Kh', 'Kd Qc')).toBe(74.17);
  }, 120_000);
});
