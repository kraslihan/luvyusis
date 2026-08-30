/* =========================================================================
   Shared domain logic — used by both API routes (api/state.js, api/action.js).
   Pure functions, no I/O. Mirrors the logic that used to live entirely in
   the client (see index.html's original prototype) so behaviour stays
   identical now that the source of truth moved server-side.
   ========================================================================= */

export const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Other'];
export const EXERCISE_TYPES = ['Walking', 'Pilates', 'Gym', 'Running', 'Cycling', 'Yoga', 'Other'];

/* ---------- dates ---------- */
export function pad(n) { return n < 10 ? '0' + n : '' + n; }
export function dateKey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
export function todayKey() { return dateKey(new Date()); }
export function keyToDate(k) { const p = k.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); }
export function keyMinusDays(key, n) { const d = keyToDate(key); d.setDate(d.getDate() - n); return dateKey(d); }
export function daysBetween(keyA, keyB) { return Math.round((keyToDate(keyB) - keyToDate(keyA)) / 86400000); }

export function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }

/* ---------- state shape ---------- */
export function blankDay() { return { checkin: false, weight: null, water: 0, meals: [], exercises: [], note: '' }; }

export function blankUser(name) {
  return {
    name,
    setup: { startWeight: null, goalWeight: null, targetDate: null, waterGoal: 8, exerciseGoal: 3, startDate: null },
    days: {}
  };
}

export function blankState() {
  return {
    onboarded: { A: false, B: false },
    users: { A: blankUser('Ezgi'), B: blankUser('Aslı') },
    shared: { notes: [], songs: [], wishlist: [], activity: [] }
  };
}

export function otherOf(role) { return role === 'A' ? 'B' : 'A'; }

export function ensureDay(user, key) {
  if (!user.days[key]) user.days[key] = blankDay();
  return user.days[key];
}
export function sortedDayKeys(user) { return Object.keys(user.days).sort(); }

/* ---------- streaks / weight math (identical to the original client logic) ---------- */
export function computeStreak(user) {
  let streak = 0;
  let key = todayKey();
  if (!user.days[key] || !user.days[key].checkin) {
    key = keyMinusDays(key, 1);
  } else {
    streak++;
    key = keyMinusDays(key, 1);
  }
  let guard = 0;
  while (user.days[key] && user.days[key].checkin && guard < 3650) {
    streak++;
    key = keyMinusDays(key, 1);
    guard++;
  }
  return streak;
}

export function computeTogetherStreak(state) {
  let streak = 0;
  let key = todayKey();
  const bothToday = state.users.A.days[key] && state.users.A.days[key].checkin && state.users.B.days[key] && state.users.B.days[key].checkin;
  key = keyMinusDays(key, 1);
  if (bothToday) streak++;
  let guard = 0;
  while (guard < 3650) {
    const a = state.users.A.days[key], b = state.users.B.days[key];
    if (a && a.checkin && b && b.checkin) { streak++; key = keyMinusDays(key, 1); guard++; } else break;
  }
  return streak;
}

export function latestWeightEntry(user, uptoKey) {
  const keys = sortedDayKeys(user).filter(k => (!uptoKey || k <= uptoKey) && typeof user.days[k].weight === 'number');
  if (!keys.length) return null;
  const k = keys[keys.length - 1];
  return { key: k, weight: user.days[k].weight };
}
export function currentWeight(user) {
  const e = latestWeightEntry(user);
  return e ? e.weight : user.setup.startWeight;
}
export function totalChange(user) {
  const cw = currentWeight(user);
  if (cw == null || user.setup.startWeight == null) return null;
  return +(cw - user.setup.startWeight).toFixed(1);
}
export function goalProgressPct(user) {
  const total = user.setup.startWeight - user.setup.goalWeight;
  if (!total || total <= 0) return 0;
  const done = user.setup.startWeight - currentWeight(user);
  return Math.max(0, Math.min(100, (done / total) * 100));
}

/** [{key, value, isCarried, lastKnownKey}] — value is always a DIFF from start, never a raw weight. */
export function changeFromStartSeries(user, days) {
  const out = [];
  let lastKnown = user.setup.startWeight;
  let lastKnownKey = user.setup.startDate;
  for (let i = days - 1; i >= 0; i--) {
    const key = keyMinusDays(todayKey(), i);
    const day = user.days[key];
    let carried = false;
    if (day && typeof day.weight === 'number') {
      lastKnown = day.weight;
      lastKnownKey = key;
    } else {
      carried = key !== user.setup.startDate;
    }
    out.push({
      key,
      value: user.setup.startWeight == null || lastKnown == null ? 0 : +(lastKnown - user.setup.startWeight).toFixed(2),
      isCarried: carried,
      lastKnownKey
    });
  }
  return out;
}

export function weightTrendSeries(user) {
  return sortedDayKeys(user)
    .filter(k => typeof user.days[k].weight === 'number')
    .map(k => ({ key: k, weight: user.days[k].weight }));
}

export function todayMealCount(user) { const d = user.days[todayKey()]; return d ? d.meals.length : 0; }
export function todayExerciseDone(user) { const d = user.days[todayKey()]; return !!(d && d.exercises.length); }
export function todayWater(user) { const d = user.days[todayKey()]; return d ? d.water : 0; }
export function todayCheckin(user) { const d = user.days[todayKey()]; return !!(d && d.checkin); }

export function logActivity(state, icon, text) {
  state.shared.activity.unshift({ id: uid(), icon, text, ts: Date.now() });
  state.shared.activity = state.shared.activity.slice(0, 40);
}

export function markCheckin(state, role) {
  const user = state.users[role];
  const day = ensureDay(user, todayKey());
  const wasCheckedIn = day.checkin;
  day.checkin = true;
  if (!wasCheckedIn) {
    logActivity(state, '🌱', `${user.name} logged today`);
    const other = state.users[otherOf(role)];
    if (other.days[todayKey()] && other.days[todayKey()].checkin) {
      const t = computeTogetherStreak(state);
      if (t > 0) logActivity(state, '🔥', `Together streak reached ${t} day${t === 1 ? '' : 's'}`);
    }
  }
}

/* ---------- demo-only AI calorie estimate (deterministic, no external call) ---------- */
export function estimateCalories(desc) {
  const str = (desc || '').trim();
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  const mid = 220 + (hash % 480);
  const spread = 45 + (hash % 45);
  return { mid: Math.round(mid / 10) * 10, low: Math.round((mid - spread) / 10) * 10, high: Math.round((mid + spread) / 10) * 10 };
}

/* ---------------------------------------------------------------------
   PRIVACY BOUNDARY — the only function allowed to build the view of a
   user that gets sent to their *partner*. Never include raw weight
   numbers (setup.startWeight, setup.goalWeight, days[*].weight) here.
   --------------------------------------------------------------------- */
export function buildPartnerView(state, partnerRole) {
  const user = state.users[partnerRole];
  const key = todayKey();
  const day = user.days[key];
  return {
    name: user.name,
    onboarded: state.onboarded[partnerRole],
    waterGoal: user.setup.waterGoal,
    exerciseGoal: user.setup.exerciseGoal,
    today: {
      checkin: !!(day && day.checkin),
      water: day ? day.water : 0,
      mealsCount: day ? day.meals.length : 0,
      exerciseDone: !!(day && day.exercises.length),
    },
    totalChange: totalChange(user),
    changeSeries: changeFromStartSeries(user, 10),
    lastUpdateKey: sortedDayKeys(user).pop() || null,
  };
}

/* ---------- action reducer: applies one client action to the server state ---------- */
export function applyAction(state, role, type, payload) {
  const user = state.users[role];
  const key = todayKey();

  switch (type) {
    case 'ONBOARD': {
      user.setup = {
        startWeight: payload.startWeight,
        goalWeight: payload.goalWeight,
        targetDate: payload.targetDate || null,
        waterGoal: payload.waterGoal || 8,
        exerciseGoal: payload.exerciseGoal || 3,
        startDate: todayKey(),
      };
      state.onboarded[role] = true;
      break;
    }
    case 'SAVE_WEIGHT': {
      ensureDay(user, key).weight = payload.weight;
      markCheckin(state, role);
      break;
    }
    case 'ADD_MEAL': {
      ensureDay(user, key).meals.push({ id: uid(), type: payload.type, time: payload.time, desc: payload.desc, photo: payload.photo || null, estimate: payload.estimate || null });
      markCheckin(state, role);
      break;
    }
    case 'DELETE_MEAL': {
      const d = ensureDay(user, key);
      d.meals = d.meals.filter(m => m.id !== payload.id);
      break;
    }
    case 'SET_WATER_DELTA': {
      const d = ensureDay(user, key);
      d.water = Math.max(0, Math.min(20, d.water + payload.delta));
      if (payload.delta > 0) markCheckin(state, role);
      break;
    }
    case 'ADD_EXERCISE': {
      ensureDay(user, key).exercises.push({ id: uid(), type: payload.type, duration: payload.duration, note: payload.note || '' });
      markCheckin(state, role);
      logActivity(state, '🏃', `${user.name} added a ${payload.duration} min ${String(payload.type).toLowerCase()}`);
      break;
    }
    case 'DELETE_EXERCISE': {
      const d = ensureDay(user, key);
      d.exercises = d.exercises.filter(ex => ex.id !== payload.id);
      break;
    }
    case 'SAVE_DAILY_NOTE': {
      ensureDay(user, key).note = payload.text || '';
      break;
    }
    case 'ADD_SHARED_NOTE': {
      state.shared.notes.push({ id: uid(), author: role, text: payload.text, ts: Date.now(), reactions: { '❤️': 0, '😂': 0, '🔥': 0, '🌱': 0 } });
      break;
    }
    case 'REACT_NOTE': {
      const note = state.shared.notes.find(n => n.id === payload.id);
      if (note) note.reactions[payload.emoji] = (note.reactions[payload.emoji] || 0) + 1;
      break;
    }
    case 'ADD_SONG': {
      state.shared.songs.push({ id: uid(), author: role, song: payload.song, artist: payload.artist, note: payload.note || '', ts: Date.now() });
      logActivity(state, '🎵', `${user.name} recommended a song`);
      break;
    }
    case 'ADD_WISH': {
      state.shared.wishlist.push({ id: uid(), text: payload.text, done: false, addedBy: role });
      break;
    }
    case 'TOGGLE_WISH': {
      const it = state.shared.wishlist.find(w => w.id === payload.id);
      if (it) it.done = !it.done;
      break;
    }
    case 'DELETE_WISH': {
      state.shared.wishlist = state.shared.wishlist.filter(w => w.id !== payload.id);
      break;
    }
    case 'UPDATE_GOALS': {
      if (payload.goalWeight) user.setup.goalWeight = payload.goalWeight;
      if (payload.waterGoal) user.setup.waterGoal = payload.waterGoal;
      if (payload.exerciseGoal) user.setup.exerciseGoal = payload.exerciseGoal;
      break;
    }
    default:
      throw Object.assign(new Error('Unknown action type: ' + type), { statusCode: 400 });
  }
  return state;
}
