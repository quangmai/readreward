import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL  || 'https://iusahkqvdbdgzaatxjxn.supabase.co';
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1c2Foa3F2ZGJkZ3phYXR4anhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MzM3MTEsImV4cCI6MjA5MDAwOTcxMX0.cv6UqmIU0TmGC7HGtQY3LnYy8e2XUYDR_DpIETzpB-I';

export const supabase = createClient(supabaseUrl, supabaseAnon);

// ─────────────────────────────────────────────
// AUTH HELPERS
// ─────────────────────────────────────────────

/** Sign up a new parent with email + password */
export async function signUpParent({ email, password, username }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username },  // stored in raw_user_meta_data, used by trigger
    },
  });
  return { data, error };
}

/** Log in a parent */
export async function logInParent({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
}

/** Log out */
export async function logOut() {
  const { error } = await supabase.auth.signOut();
  return { error };
}

/** Get current session (persists across refreshes) */
export async function getSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  return { session, error };
}

/** Listen for auth state changes */
export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange(callback);
}

/** Send password reset email */
export async function resetPassword(email) {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email);
  return { data, error };
}


// ─────────────────────────────────────────────
// PARENT PROFILE
// ─────────────────────────────────────────────

export async function getParentProfile(userId) {
  if (!userId) return { data: null, error: { message: 'No userId provided' } };

  const { data, error } = await supabase
    .from('parents')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  return { data, error };
}

export async function updateParentProfile(updates) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('parents')
    .update(updates)
    .eq('id', user.id)
    .select()
    .single();
  return { data, error };
}


// ─────────────────────────────────────────────
// CHILDREN
// ─────────────────────────────────────────────

/** Hash a PIN via Edge Function (server-side bcrypt) */
export async function hashPin(pin) {
  const { data, error } = await supabase.functions.invoke('hash-pin', {
    body: { pin },
  });
  if (error) return { hash: null, error };
  return { hash: data.hash, error: null };
}

/** Verify a child's PIN via Edge Function (server-side bcrypt compare) */
export async function verifyChildPin(childId, pin) {
  const { data, error } = await supabase.functions.invoke('verify-child-pin', {
    body: { childId, pin },
  });
  if (error) return { valid: false, error };
  return { valid: data.valid, error: null };
}

export async function getChildren() {
  const { data, error } = await supabase
    .from('children')
    .select('*')
    .order('created_at');
  return { data: data || [], error };
}

export async function addChild({ name, username, pinHash, colorIdx, avatarUrl }) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('children')
    .insert({
      parent_id: user.id,
      name,
      username,
      pin_hash: pinHash,
      color_idx: colorIdx,
      avatar_url: avatarUrl,
    })
    .select()
    .single();
  return { data, error };
}

export async function updateChild(childId, updates) {
  const { data, error } = await supabase
    .from('children')
    .update(updates)
    .eq('id', childId)
    .select()
    .single();
  return { data, error };
}

export async function deleteChild(childId) {
  const { error } = await supabase
    .from('children')
    .delete()
    .eq('id', childId);
  return { error };
}


// ─────────────────────────────────────────────
// BOOKS
// ─────────────────────────────────────────────

export async function getBooks(childId) {
  let query = supabase.from('books').select('*').order('created_at');
  if (childId) query = query.eq('child_id', childId);
  const { data, error } = await query;
  return { data: data || [], error };
}

export async function getAllBooks() {
  const { data, error } = await supabase
    .from('books')
    .select('*')
    .order('created_at');
  return { data: data || [], error };
}

export async function addBook({ childId, title, authors, coverUrl, totalPages, difficulty }) {
  const { data, error } = await supabase
    .from('books')
    .insert({
      child_id: childId,
      title,
      authors,
      cover_url: coverUrl,
      total_pages: totalPages,
      pages_read: 0,
      difficulty,
      done: false,
    })
    .select()
    .single();
  return { data, error };
}

export async function updateBook(bookId, updates) {
  const { data, error } = await supabase
    .from('books')
    .update(updates)
    .eq('id', bookId)
    .select()
    .single();
  return { data, error };
}


// ─────────────────────────────────────────────
// READING LOGS
// ─────────────────────────────────────────────

export async function getReadingLogs(childId) {
  let query = supabase
    .from('reading_logs')
    .select('*')
    .order('created_at', { ascending: false });
  if (childId) query = query.eq('child_id', childId);
  const { data, error } = await query;
  return { data: data || [], error };
}

export async function getAllReadingLogs() {
  const { data, error } = await supabase
    .from('reading_logs')
    .select('*')
    .order('created_at', { ascending: false });
  return { data: data || [], error };
}

export async function addReadingLog({ childId, bookId, bookTitle, pages, difficulty, rewardTypeId }) {
  const { data, error } = await supabase
    .from('reading_logs')
    .insert({
      child_id: childId,
      book_id: bookId,
      book_title: bookTitle,
      pages,
      difficulty,
      reward_type_id: rewardTypeId,
      status: 'pending',
    })
    .select()
    .single();
  return { data, error };
}

export async function approveLog(logId, adjustedPages) {
  const updates = {
    status: 'approved',
    reviewed_at: new Date().toISOString(),
  };
  if (adjustedPages != null) {
    // First get the original log to save original_pages
    const { data: original } = await supabase
      .from('reading_logs')
      .select('pages')
      .eq('id', logId)
      .single();
    
    updates.pages = adjustedPages;
    updates.adjusted = true;
    updates.original_pages = original?.pages;
  }
  const { data, error } = await supabase
    .from('reading_logs')
    .update(updates)
    .eq('id', logId)
    .select()
    .single();
  return { data, error };
}

export async function rejectLog(logId) {
  const { data, error } = await supabase
    .from('reading_logs')
    .update({
      status: 'rejected',
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', logId)
    .select()
    .single();
  return { data, error };
}


// ─────────────────────────────────────────────
// REWARD CONFIGS
// ─────────────────────────────────────────────

export async function getRewardConfigs() {
  const { data, error } = await supabase
    .from('reward_configs')
    .select('*')
    .order('sort_order');
  return { data: data || [], error };
}

export async function upsertRewardConfig(config) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('reward_configs')
    .upsert({
      parent_id: user.id,
      reward_key: config.reward_key,
      label: config.label,
      icon: config.icon,
      unit: config.unit,
      rate: config.rate,
      color: config.color,
      sort_order: config.sort_order || 0,
      tiers: config.tiers || [],
      auto_approve: config.auto_approve || false,
    }, { onConflict: 'parent_id,reward_key' })
    .select()
    .single();
  return { data, error };
}

export async function deleteRewardConfig(rewardKey) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('reward_configs')
    .delete()
    .eq('parent_id', user.id)
    .eq('reward_key', rewardKey);
  return { error };
}


// ─────────────────────────────────────────────
// DIFFICULTY BONUSES
// ─────────────────────────────────────────────

export async function getDifficultyBonuses() {
  const { data, error } = await supabase
    .from('difficulty_bonuses')
    .select('*');
  return { data: data || [], error };
}

export async function upsertDifficultyBonus({ difficulty, bonusType, bonusValue }) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('difficulty_bonuses')
    .upsert({
      parent_id: user.id,
      difficulty,
      bonus_type: bonusType,
      bonus_value: bonusValue,
    }, { onConflict: 'parent_id,difficulty' })
    .select()
    .single();
  return { data, error };
}


// ─────────────────────────────────────────────
// REWARD BALANCES
// ─────────────────────────────────────────────

export async function getRewardBalances(childId) {
  const { data, error } = await supabase
    .from('reward_balances')
    .select('*')
    .eq('child_id', childId);
  return { data: data || [], error };
}

export async function upsertRewardBalance({ childId, rewardTypeId, earned, redeemed }) {
  const { data, error } = await supabase
    .from('reward_balances')
    .upsert({
      child_id: childId,
      reward_type_id: rewardTypeId,
      earned,
      redeemed,
    }, { onConflict: 'child_id,reward_type_id' })
    .select()
    .single();
  return { data, error };
}


// ─────────────────────────────────────────────
// READING STREAKS
// ─────────────────────────────────────────────

export async function getStreak(childId) {
  const { data, error } = await supabase
    .from('reading_streaks')
    .select('*')
    .eq('child_id', childId)
    .single();
  return { data, error };
}

export async function upsertStreak({ childId, currentStreak, longestStreak, lastReadDate }) {
  const { data, error } = await supabase
    .from('reading_streaks')
    .upsert({
      child_id: childId,
      current_streak: currentStreak,
      longest_streak: longestStreak,
      last_read_date: lastReadDate,
    }, { onConflict: 'child_id' })
    .select()
    .single();
  return { data, error };
}


// ─────────────────────────────────────────────
// ACHIEVEMENTS
// ─────────────────────────────────────────────

export async function getAchievements(childId) {
  const { data, error } = await supabase
    .from('achievements')
    .select('*')
    .eq('child_id', childId)
    .order('earned_at', { ascending: false });
  return { data: data || [], error };
}

export async function getAllAchievements() {
  const { data, error } = await supabase
    .from('achievements')
    .select('*')
    .order('earned_at', { ascending: false });
  return { data: data || [], error };
}

export async function addAchievement({ childId, badgeKey }) {
  const { data, error } = await supabase
    .from('achievements')
    .insert({ child_id: childId, badge_key: badgeKey })
    .select()
    .single();
  return { data, error };
}


// ─────────────────────────────────────────────
// FILE UPLOADS (covers & avatars)
// ─────────────────────────────────────────────

export async function uploadCover(file, childId) {
  const ext = file.name.split('.').pop();
  const path = `${childId}/${Date.now()}.${ext}`;
  const { data, error } = await supabase.storage
    .from('covers')
    .upload(path, file, { upsert: true });
  if (error) return { url: null, error };
  const { data: { publicUrl } } = supabase.storage
    .from('covers')
    .getPublicUrl(path);
  return { url: publicUrl, error: null };
}

export async function uploadAvatar(file, childId) {
  const ext = file.name.split('.').pop();
  const path = `${childId}/${Date.now()}.${ext}`;
  const { data, error } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true });
  if (error) return { url: null, error };
  const { data: { publicUrl } } = supabase.storage
    .from('avatars')
    .getPublicUrl(path);
  return { url: publicUrl, error: null };
}


// ─────────────────────────────────────────────
// REDEMPTIONS
// ─────────────────────────────────────────────

export async function getRedemptions(childId) {
  let query = supabase
    .from('redemptions')
    .select('*')
    .order('created_at', { ascending: false });
  if (childId) query = query.eq('child_id', childId);
  const { data, error } = await query;
  return { data: data || [], error };
}

export async function getAllRedemptions() {
  const { data, error } = await supabase
    .from('redemptions')
    .select('*')
    .order('created_at', { ascending: false });
  return { data: data || [], error };
}

export async function addRedemption({ childId, rewardTypeId, amount, tierLabel, status }) {
  const { data, error } = await supabase
    .from('redemptions')
    .insert({
      child_id: childId,
      reward_type_id: rewardTypeId,
      amount,
      tier_label: tierLabel,
      status: status || 'pending',
    })
    .select()
    .single();
  return { data, error };
}

export async function approveRedemption(id) {
  const { data, error } = await supabase
    .from('redemptions')
    .update({
      status: 'approved',
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();
  return { data, error };
}

export async function rejectRedemption(id) {
  const { data, error } = await supabase
    .from('redemptions')
    .update({
      status: 'rejected',
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();
  return { data, error };
}


// ─────────────────────────────────────────────
// PUSH NOTIFICATIONS
// ─────────────────────────────────────────────

const VAPID_PUBLIC_KEY = 'BOk6L-xl3LZzdhfG5NyP8AUP9Nmo1DsjEi2RQ558BHmMcaPFQRwLMwcR7FG-0l5v-I-4zn_YAxFcmuN7dAkkEbE';

/** Register service worker and subscribe to push */
export async function subscribeToPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.log('Push notifications not supported');
    return { subscription: null, error: 'Push not supported' };
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', { type: 'module' });
    await navigator.serviceWorker.ready;

    // Check if already subscribed
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    return { subscription, error: null };
  } catch (err) {
    console.error('Push subscription failed:', err);
    return { subscription: null, error: err.message };
  }
}

/** Save push subscription to Supabase */
export async function savePushSubscription(subscription) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const sub = subscription.toJSON();
  const { data, error } = await supabase
    .from('push_subscriptions')
    .upsert({
      parent_id: user.id,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth_key: sub.keys.auth,
      device_label: navigator.userAgent.slice(0, 100),
    }, { onConflict: 'endpoint' })
    .select()
    .single();
  return { data, error };
}

/** Check current push permission status */
export function getPushPermission() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission; // 'default', 'granted', 'denied'
}

/** Send a push notification via Edge Function */
export async function sendPushNotification({ parentId, title, body, type, url }) {
  const { data, error } = await supabase.functions.invoke('send-push', {
    body: { parentId, title, body, type, url },
  });
  return { data, error };
}

/** Helper: convert VAPID key to Uint8Array */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}