// App Store listing copy. Pushed by scripts/asc-metadata.mjs.
//
// Guideline 2.3.7 rejects price references outside the description, so the
// name, subtitle, promotional text and keywords say nothing about cost. Other
// apps are not named anywhere in the listing.
//
// v1.0.0 was rejected under 4.3(b) as indistinguishable from other workout
// logs. The listing now leads with what the app does that a log does not:
// it coaches, set by set, from the lifter's own history.

export const NAME = 'Overload — Strength Coach';
export const SUBTITLE = 'Knows what to lift next';

export const PROMOTIONAL_TEXT =
  'A coach in your training log: a target for every set, an off-day adjustment after your first hard set, and a plain-English reason when a lift stalls.';

export const KEYWORDS =
  'workout,weightlifting,gym,lifting,progressive overload,1rm,routine,plateau,powerlifting,tracker,log';

export const DESCRIPTION = `Overload is a strength coach built into a training log. It reads what you actually lifted and tells you what to do next — this set, this session, and when progress stops.

A TARGET FOR EVERY SET

Every exercise opens with today's target, worked out from your last session and your rep range. Hit the top of the range on every set and it adds the smallest sensible weight; fall short and it holds you there until you do. Tap the tick to accept a target, or type what you actually did.

IT READS THE DAY YOU ARE HAVING

After your first hard set, Overload compares it with your recent sessions. On an off day — bad sleep, a long week — it tells you exactly how much to take off the remaining sets so you still get good work in. On a strong day it tells you what to try next. One tap applies it.

IT EXPLAINS A PLATEAU

When a lift stops moving, Overload does more than say "deload". It looks at your log: how many hard sets that muscle gets each week against your target, how often you train the lift, how many working sets you do, and whether your rep range has run its course. Then it lists what to change, most useful first, and names a close variation to rotate to.

IT KNOWS WHERE TO START

First time on a new lift? Instead of guessing, Overload estimates a starting weight from a lift you already do — your incline press from your bench, your Romanian deadlift from your deadlift — with reps in reserve, so the first session is a calibration, not a test.

SET UP FOR YOUR GOAL

Choose strength, muscle or a bit of both, and every rep range follows. Set your own range or load step for any exercise.

EVERYTHING ELSE A LIFTER NEEDS

• Last session's numbers next to every set
• Rest timer that starts itself, with an alert on the lock screen
• Warm-up, drop and failure sets, supersets, RPE and notes
• Plate calculator that uses only the plates you own, and a warm-up ramp
• Charts of estimated one-rep max, heaviest weight, volume and reps
• Records announced the moment you set them, and rep maxes from 1 to 15
• Hard sets per muscle each week, and body measurements with charts
• Unlimited routines, plus Push / Pull / Legs, Upper / Lower, 5×5 and Full Body

TRY IT BEFORE YOU LOG A THING

On first launch you can explore six months of sample training, so you can watch the coach work straight away. Clear it with one tap when you are ready.

YOUR HISTORY COMES WITH YOU

Import the CSV export from other lifting apps, including set types, RPE and notes, and the coach works on your whole history at once. Export everything as CSV, or back up to a single file.

PRIVATE BY DESIGN

No account. No ads. No tracking. Your training stays on your phone.

Overload is free, with every feature included. No subscription.`;

export const SUPPORT_URL = 'https://github.com/keyfive5/StrongAlternative';
export const MARKETING_URL = 'https://github.com/keyfive5/StrongAlternative';
export const PRIVACY_URL = 'https://github.com/keyfive5/StrongAlternative/blob/main/PRIVACY.md';
export const COPYRIGHT = '2026 Muhammad Hasan Zafar';

export const PRIMARY_CATEGORY = 'HEALTH_AND_FITNESS';
export const SECONDARY_CATEGORY = 'SPORTS';

export const SHOT_CAPTIONS = [
  'A coach in your training log',
  'A target for every set',
  'Reads the day you are having',
  'Explains a plateau',
  'Knows where to start',
];
