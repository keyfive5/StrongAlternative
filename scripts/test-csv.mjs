// Import from Strong / Hevy exports and round-trip our own export.
import { describe, eq, ok, report } from './harness.mjs';
import { parseCsv, parseDate, parseDuration, importCsv, exportCsv, detectDelimiter } from '../src/core/csv.ts';
import { LIBRARY } from '../src/core/library.ts';
import { fmtWeight } from '../src/core/units.ts';

describe('tokenising', () => {
  eq(parseCsv('a,b\n1,2\n'), [['a', 'b'], ['1', '2']], 'simple');
  eq(parseCsv('a,b\r\n"x, y","say ""hi"""\r\n'), [['a', 'b'], ['x, y', 'say "hi"']], 'quotes, doubled quotes, CRLF');
  eq(parseCsv('a,b\n"line\nbreak",2'), [['a', 'b'], ['line\nbreak', '2']], 'newline inside quotes');
  eq(parseCsv('﻿a;b\n1;2', ';'), [['a', 'b'], ['1', '2']], 'BOM stripped, semicolons');
  eq(parseCsv('a,b\n\n1,2\n\n'), [['a', 'b'], ['1', '2']], 'blank lines skipped');
  eq(detectDelimiter('"Workout #";"Date";"Workout Name"\n'), ';', 'detects semicolons');
  eq(detectDelimiter('Date,Workout Name,Duration\n'), ',', 'detects commas');
});

describe('dates and durations', () => {
  eq(new Date(parseDate('2024-03-15 18:05:31')).getHours(), 18, 'ISO-ish, local time');
  eq(new Date(parseDate('15 Mar 2024, 18:05')).getMonth(), 2, 'Hevy style');
  eq(new Date(parseDate('3 Sept 2024, 07:30')).getMonth(), 8, 'Sept spelling');
  eq(parseDuration('1h 5m'), 3900, '1h 5m');
  eq(parseDuration('45m'), 2700, '45m');
  eq(parseDuration('3725'), 3725, 'plain seconds');
  eq(parseDuration('1:02:05'), 3725, 'clock');
  eq(parseDuration(''), undefined, 'empty');
});

const STRONG_OLD = `Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE
2024-03-15 18:05:31,"Push Day",1h 5m,"Bench Press (Barbell)",1,60,10,0,0,"","Felt good",
2024-03-15 18:05:31,"Push Day",1h 5m,"Bench Press (Barbell)",2,80,8,0,0,"","Felt good",8
2024-03-15 18:05:31,"Push Day",1h 5m,"Bench Press (Barbell)",3,80,7,0,0,"","Felt good",9
2024-03-15 18:05:31,"Push Day",1h 5m,"Triceps Pushdown (Cable - Straight Bar)",1,30,12,0,0,"","Felt good",
2024-03-15 18:05:31,"Push Day",1h 5m,"Pull Up",1,0,8,0,0,"","Felt good",
2024-03-15 18:05:31,"Push Day",1h 5m,"Plank",1,0,0,0,60,"","Felt good",
2024-03-18 07:00:00,"Run",30m,"Running",1,0,0,5.2,1800,"","",
`;

describe('Strong, original comma format', () => {
  const r = importCsv(STRONG_OLD, [], [], 'kg');
  eq(r.source, 'strong', 'recognised as Strong');
  eq(r.workouts.length, 2, 'two workouts');
  const push = r.workouts[0];
  eq(push.name, 'Push Day', 'workout name');
  eq((push.end - push.start) / 60000, 65, 'duration 1h 5m');
  eq(push.notes, 'Felt good', 'workout notes');
  eq(push.exercises.map((e) => e.exerciseId).slice(0, 1), ['bench-press-barbell'], 'bench matched to the library');
  eq(push.exercises[0].sets.map((s) => s.weight), [60, 80, 80], 'weights');
  eq(push.exercises[0].sets[1].rpe, 8, 'rpe');
  eq(r.newExercises.length, 1, 'only the unknown pushdown variant becomes a custom exercise');
  eq(r.newExercises[0].name, 'Triceps Pushdown (Cable - Straight Bar)', 'custom keeps its original name');
  eq(r.newExercises[0].equipment, 'cable', 'equipment guessed from the name');
  eq(push.exercises[2].exerciseId, 'pull-up', 'pull up matched');
  eq(push.exercises[2].sets[0].weight, undefined, 'bodyweight sets carry no load');
  eq(push.exercises[3].sets[0].seconds, 60, 'plank seconds');
  eq(r.workouts[1].exercises[0].sets[0].distance, 5200, 'km converted to metres');
  eq(r.sets, 7, 'seven sets');
  const again = importCsv(STRONG_OLD, r.newExercises, r.workouts, 'kg');
  eq(again.workouts.length, 0, 'importing the same file twice adds nothing');
  eq(again.skippedDuplicates, 2, 'and says so');
  eq(again.newExercises.length, 0, 'and reuses custom exercises it created before');
  const lb = importCsv(STRONG_OLD, [], [], 'lb');
  eq(fmtWeight(lb.workouts[0].exercises[0].sets[1].weight, 'lb'), '80', 'an unlabelled file can be read as pounds');
});

const STRONG_6 = `"Workout #";"Date";"Workout Name";"Duration (sec)";"Exercise Name";"Set Order";"Weight (lbs)";"Reps";"RPE";"Distance (meters)";"Seconds";"Notes";"Workout Notes"
"1";"2025-01-06 17:30:00";"Legs";"4200";"Squat (Barbell)";"W";"135";"5";"";"";"";"";""
"1";"2025-01-06 17:30:00";"Legs";"4200";"Squat (Barbell)";"1";"225";"5";"";"";"";"";""
"1";"2025-01-06 17:30:00";"Legs";"4200";"Squat (Barbell)";"Rest Timer";"";"";"";"";"180";"";""
"1";"2025-01-06 17:30:00";"Legs";"4200";"Squat (Barbell)";"2";"225";"5";"";"";"";"";""
"1";"2025-01-06 17:30:00";"Legs";"4200";"Squat (Barbell)";"D";"185";"8";"";"";"";"";""
"1";"2025-01-06 17:30:00";"Legs";"4200";"Leg Press";"1";"360";"12";"";"";"";"knees in";""
"2";"2025-01-09 17:30:00";"Legs";"3600";"Romanian Deadlift (Barbell)";"F";"185";"10";"";"";"";"";""
`;

describe('Strong 6.x semicolon format', () => {
  const r = importCsv(STRONG_6, [], [], 'kg');
  eq(r.unit, 'lb', 'unit read from the header, overriding the guess');
  eq(r.workouts.length, 2, 'two workouts');
  const sq = r.workouts[0].exercises[0];
  eq(sq.exerciseId, 'squat-barbell', 'squat matched');
  eq(sq.sets.map((s) => s.type), ['warmup', 'normal', 'normal', 'drop'], 'W/D codes and rest-timer rows skipped');
  eq(sq.sets.map((s) => fmtWeight(s.weight, 'lb')), ['135', '225', '225', '185'], 'pounds stored exactly');
  eq(r.workouts[0].exercises[1].exerciseId, 'leg-press-machine', '"Leg Press" finds Leg Press (Machine)');
  eq(r.workouts[0].exercises[1].notes, 'knees in', 'exercise notes');
  eq((r.workouts[0].end - r.workouts[0].start) / 1000, 4200, 'duration in seconds');
  eq(r.workouts[1].exercises[0].sets[0].type, 'failure', 'F is a failure set');
});

const HEVY = `"title","start_time","end_time","description","exercise_title","superset_id","exercise_notes","set_index","set_type","weight_kg","reps","distance_km","duration_seconds","rpe"
"Upper A","6 Jan 2025, 18:00","6 Jan 2025, 19:10","","Bench Press (Barbell)","","","0","warmup","40","10","","",""
"Upper A","6 Jan 2025, 18:00","6 Jan 2025, 19:10","","Bench Press (Barbell)","","","1","normal","82.5","6","","","8.5"
"Upper A","6 Jan 2025, 18:00","6 Jan 2025, 19:10","","Lat Pulldown (Cable)","0","","0","normal","60","10","","",""
"Upper A","6 Jan 2025, 18:00","6 Jan 2025, 19:10","","Lateral Raise (Dumbbell)","0","","0","normal","10","15","","",""
`;

describe('Hevy format', () => {
  const r = importCsv(HEVY, [], [], 'kg');
  eq(r.source, 'hevy', 'recognised as Hevy');
  eq(r.workouts.length, 1, 'one workout');
  const w = r.workouts[0];
  eq((w.end - w.start) / 60000, 70, 'start and end times');
  eq(w.exercises.map((e) => e.exerciseId), ['bench-press-barbell', 'lat-pulldown-cable', 'lateral-raise-dumbbell'], 'all matched');
  eq(w.exercises[0].sets[0].type, 'warmup', 'warm-up type');
  eq(w.exercises[0].sets[1].rpe, 8.5, 'rpe');
  eq(w.exercises[1].superset, '0', 'superset ids kept');
  eq(r.newExercises.length, 0, 'no custom exercises needed');
});

describe('rejects other files', () => {
  const r = importCsv('name,email\nA,b@c.d\n', [], []);
  eq(r.workouts.length, 0, 'nothing imported');
  ok(r.warnings.length === 1, 'explains why');
});

describe('export round trip', () => {
  const first = importCsv(STRONG_6, [], [], 'kg');
  const exMap = new Map([...LIBRARY, ...first.newExercises].map((e) => [e.id, e]));
  for (const unit of ['kg', 'lb']) {
    const csv = exportCsv(first.workouts, exMap, unit);
    ok(csv.startsWith('"Workout #";"Date"'), `${unit}: Strong 6.x header`);
    const back = importCsv(csv, [], [], 'kg');
    eq(back.workouts.length, first.workouts.length, `${unit}: same workout count`);
    eq(back.sets, first.sets, `${unit}: same set count`);
    const a = first.workouts[0].exercises[0].sets;
    const b = back.workouts[0].exercises[0].sets;
    eq(b.map((s) => s.type), a.map((s) => s.type), `${unit}: set types survive`);
    ok(b.every((s, i) => Math.abs(s.weight - a[i].weight) < 0.01), `${unit}: weights survive within 0.01 kg`);
    eq(back.workouts[0].exercises[1].notes, 'knees in', `${unit}: notes survive`);
  }
  const tricky = [{ id: 'w', name: 'Day; "one"', start: Date.now(), end: Date.now() + 60000, notes: 'a\nb', exercises: [{ id: 'e', exerciseId: 'bench-press-barbell', sets: [{ id: 's', type: 'normal', weight: 50, reps: 5, done: true }, { id: 't', type: 'normal', weight: 99, reps: 5, done: false }] }] }];
  const back = importCsv(exportCsv(tricky, exMap, 'kg'), [], [], 'kg');
  eq(back.workouts[0].name, 'Day; "one"', 'delimiters and quotes in names survive');
  eq(back.workouts[0].notes, 'a\nb', 'newlines in notes survive');
  eq(back.sets, 1, 'unticked sets are not exported');
});

report('csv');
