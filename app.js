import { createClient } from '@supabase/supabase-js';
import './app.css';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const apiBase = import.meta.env.VITE_NOOK_API_URL || 'https://nook-267305660945.us-west1.run.app';
const configured = Boolean(supabaseUrl && supabaseKey);
const supabase = configured
  ? createClient(supabaseUrl, supabaseKey, { auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true } })
  : null;

const $ = (selector) => document.querySelector(selector);
const loginView = $('#login-view');
const accountView = $('#account-view');
const authMessage = $('#auth-message');
let phoneForOtp = '';
let account = null;
let preferences = null;

function message(target, text) {
  const node = typeof target === 'string' ? $(`[data-message="${target}"]`) : target;
  if (node) node.textContent = text;
}

function csv(value) { return String(value || '').split(',').map((item) => item.trim()).filter(Boolean); }
function dollarsToCents(value) { const number = Number(value); return Number.isFinite(number) && number > 0 ? Math.round(number * 100) : null; }
function centsToDollars(value) { return value == null ? '' : String(Math.round(value / 100)); }

async function api(path, options = {}) {
  const { data } = await supabase.auth.getSession();
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers || {}), ...(data.session ? { authorization: `Bearer ${data.session.access_token}` } : {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Request failed');
  return body;
}

async function loadAccount() {
  if (!supabase) {
    authMessage.textContent = 'Account login is being configured. The public landing page remains available.';
    return;
  }
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    loginView.classList.remove('hidden');
    accountView.classList.add('hidden');
    return;
  }
  try {
    const result = await api('/api/v1/me');
    account = result.account;
    const prefResult = await api('/api/v1/preferences');
    preferences = prefResult.preferences;
    renderAccount();
  } catch (error) {
    authMessage.textContent = error.message;
  }
}

function renderAccount() {
  loginView.classList.add('hidden');
  accountView.classList.remove('hidden');
  $('#display-name').value = account.displayName || '';
  $('#timezone').value = account.timezone || 'America/Los_Angeles';
  $('#locale').value = account.locale || 'en-US';
  const status = $('#access-banner');
  status.className = `status-card ${account.accessStatus}`;
  status.textContent = account.accessStatus === 'approved'
    ? 'Your Nook access is approved. Connect Telegram to start your private apartment search.'
    : 'Your account is set up. Nook access is pending individual approval; you can finish your preferences while you wait.';
  $('#cities').value = (preferences.targetCities || []).join(', ');
  $('#rent').value = centsToDollars(preferences.maximumBaseRentCents);
  $('#bedrooms').value = preferences.bedroomsMin ?? '';
  $('#bathrooms').value = preferences.minimumBathrooms ?? '';
  $('#move-in').value = preferences.moveInDate || '';
  $('#must-haves').value = (preferences.mustHaveAmenities || []).join(', ');
  $('#nice-to-haves').value = (preferences.niceToHaveAmenities || []).join(', ');
  $('#deal-breakers').value = (preferences.dealBreakers || []).join(', ');
}

document.querySelectorAll('[data-provider]').forEach((button) => button.addEventListener('click', async () => {
  if (!supabase) return;
  const { error } = await supabase.auth.signInWithOAuth({ provider: button.dataset.provider, options: { redirectTo: `${location.origin}/app.html` } });
  if (error) authMessage.textContent = error.message;
}));

$('#phone-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!supabase) return;
  phoneForOtp = $('#phone').value.trim();
  const { error } = await supabase.auth.signInWithOtp({ phone: phoneForOtp });
  if (error) { authMessage.textContent = error.message; return; }
  $('#otp-form').classList.remove('hidden');
  authMessage.textContent = 'Verification code sent.';
});

$('#otp-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const { error } = await supabase.auth.verifyOtp({ phone: phoneForOtp, token: $('#otp').value.trim(), type: 'sms' });
  authMessage.textContent = error ? error.message : 'Signed in.';
  if (!error) await loadAccount();
});

$('#sign-out')?.addEventListener('click', async () => { await supabase.auth.signOut(); await loadAccount(); });

$('#profile-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    await api('/api/v1/me', { method: 'PATCH', body: JSON.stringify({ displayName: $('#display-name').value, timezone: $('#timezone').value, locale: $('#locale').value }) });
    message('profile', 'Account details saved.');
  } catch (error) { message('profile', error.message); }
});

$('#preferences-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const next = {
      ...preferences,
      targetCities: csv($('#cities').value),
      maximumBaseRentCents: dollarsToCents($('#rent').value),
      bedroomsMin: $('#bedrooms').value ? Number($('#bedrooms').value) : null,
      minimumBathrooms: $('#bathrooms').value ? Number($('#bathrooms').value) : null,
      moveInDate: $('#move-in').value || null,
      mustHaveAmenities: csv($('#must-haves').value),
      niceToHaveAmenities: csv($('#nice-to-haves').value),
      dealBreakers: csv($('#deal-breakers').value),
    };
    await api('/api/v1/preferences', { method: 'PUT', body: JSON.stringify(next) });
    preferences = next;
    message('preferences', 'Preferences saved.');
  } catch (error) { message('preferences', error.message); }
});

$('#telegram-link')?.addEventListener('click', async () => {
  try {
    const result = await api('/api/v1/telegram-links', { method: 'POST', body: '{}' });
    $('#telegram-copy').innerHTML = `<a href="${result.url}" target="_blank" rel="noreferrer">Open Telegram to connect Nook</a> · link expires in 10 minutes.`;
    message('telegram', 'Link created.');
  } catch (error) { message('telegram', error.message); }
});

if (supabase) supabase.auth.onAuthStateChange(() => { void loadAccount(); });
void loadAccount();
