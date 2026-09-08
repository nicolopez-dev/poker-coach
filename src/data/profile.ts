/**
 * What is left of the handoff's sample data.
 *
 * Everything else has gone: the name, the avatar, the streak, the XP, the accuracy, the
 * week chart and the daily goal come from `get_state()` through the store, and the games
 * that used to be sampled here are read back from `games` and `game_seats` as they are
 * played. One thing is still not data, and is marked as such rather than quietly passing
 * for it:
 *
 *   · `COACH_NOTE` — **authored copy with nothing behind it.** There is no model that
 *     reads a player's answers and notices they fold too much from the button, and
 *     assembling one out of the numbers we do have would be inventing an insight. It
 *     stays as writing until something can actually say it.
 */

/**
 * **Authored copy, not a finding.** Shown as the coach's note on Home; nothing computes
 * it, and nothing should pretend to until the app can genuinely read a habit out of a
 * player's answers.
 */
export const COACH_NOTE = {
  title: 'You fold too much from the button.',
  body: "Last seat to act, best seat at the table. Tomorrow's drill is all yours.",
};
