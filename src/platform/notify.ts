// The rest timer's lock-screen alert.
//
// In the gym the phone is face down on a bench or locked in a pocket between
// sets, which is exactly when an in-app timer cannot buzz. So every rest also
// schedules a local notification for the moment it ends; skipping or changing
// the rest replaces it. Nothing here touches the network: these are local
// notifications, scheduled and delivered by iOS on the device.

import { Platform } from 'react-native';

type N = typeof import('expo-notifications');

let mod: N | null = null;
let ready: Promise<boolean> | null = null;
/** Bumped by every schedule and cancel, so a slow schedule cannot outlive a newer call. */
let seq = 0;

function notifications(): N | null {
  if (Platform.OS === 'web') return null;
  if (!mod) {
    try {
      mod = require('expo-notifications') as N;
      // In the foreground the app buzzes and shows its own timer, so the
      // system banner would only be noise.
      mod.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: false,
          shouldShowList: false,
          shouldPlaySound: false,
          shouldSetBadge: false,
        }),
      });
    } catch {
      return null;
    }
  }
  return mod;
}

/** Asks once, the first time a rest timer starts — the moment the reason is obvious. */
function permitted(n: N): Promise<boolean> {
  if (!ready) {
    ready = (async () => {
      try {
        const cur = await n.getPermissionsAsync();
        if (cur.granted) return true;
        if (!cur.canAskAgain) return false;
        const res = await n.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: false } });
        return res.granted;
      } catch {
        return false;
      }
    })();
  }
  return ready;
}

export async function scheduleRestEnd(seconds: number, exerciseName: string): Promise<void> {
  const n = notifications();
  if (!n || seconds < 3) return;
  await cancelRestEnd();
  const mine = ++seq;
  if (!(await permitted(n)) || mine !== seq) return;
  try {
    const id = await n.scheduleNotificationAsync({
      content: {
        title: 'Rest is over',
        body: exerciseName ? `Time for your next set of ${exerciseName}.` : 'Time for your next set.',
        sound: 'default',
      },
      trigger: { type: n.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: Math.round(seconds), repeats: false },
    });
    if (mine !== seq) await n.cancelScheduledNotificationAsync(id);
  } catch {}
}

export async function cancelRestEnd(): Promise<void> {
  const n = notifications();
  if (!n) return;
  seq++;
  // Rest alerts are the only notifications this app schedules, so clearing
  // all of them also catches one scheduled before the app was last closed.
  try {
    await n.cancelAllScheduledNotificationsAsync();
  } catch {}
}
