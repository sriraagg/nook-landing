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
let llmKey = null;

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
  if (!response.ok) {
    const detail = body.error || body.message;
    throw new Error((Array.isArray(detail) ? detail[0] : detail) || 'Request failed');
  }
  return body;
}

function readLlmKey(result) {
  const key = result?.llmKey;
  if (!key || typeof key !== 'object') return { connected: false, lastFour: null, status: 'missing' };
  return {
    connected: Boolean(key.connected),
    lastFour: key.lastFour || null,
    status: key.status || (key.connected ? 'valid' : 'missing'),
  };
}

function llmKeyReady(key = llmKey) {
  return Boolean(key?.connected) && key.status !== 'invalid' && key.status !== 'missing';
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
    llmKey = readLlmKey(result);
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
  const approved = account.accessStatus === 'approved';
  if (approved && llmKeyReady()) {
    status.textContent = 'Your Nook access is approved. Connect Telegram to start your private apartment search.';
  } else if (approved) {
    status.textContent = 'Your Nook access is approved. Connect a valid LLM key, then Telegram, to start searching.';
  } else {
    status.textContent = 'Your account is set up. Nook access is pending individual approval; you can finish preferences and add your LLM key while you wait.';
  }
  $('#cities').value = (preferences.targetCities || []).join(', ');
  $('#rent').value = centsToDollars(preferences.maximumBaseRentCents);
  $('#bedrooms').value = preferences.bedroomsMin ?? '';
  $('#bathrooms').value = preferences.minimumBathrooms ?? '';
  $('#move-in').value = preferences.moveInDate || '';
  $('#must-haves').value = (preferences.mustHaveAmenities || []).join(', ');
  $('#nice-to-haves').value = (preferences.niceToHaveAmenities || []).join(', ');
  $('#deal-breakers').value = (preferences.dealBreakers || []).join(', ');
  renderLlmKey();
  renderTelegram();
}

function renderLlmKey() {
  const state = $('#llm-key-state');
  if (!state) return;
  state.className = 'key-state';
  if (!llmKey?.connected || llmKey.status === 'missing') {
    state.classList.add('missing');
    state.textContent = 'No key connected yet.';
    return;
  }
  const suffix = llmKey.lastFour ? ` ending in ${String(llmKey.lastFour).slice(-4)}` : '';
  if (llmKey.status === 'invalid') {
    state.classList.add('invalid');
    state.textContent = `The saved key${suffix} is invalid. Paste a working key to replace it.`;
    return;
  }
  state.classList.add('connected');
  state.textContent = `Connected${suffix}.`;
}

function renderTelegram() {
  const copy = $('#telegram-copy');
  const button = $('#telegram-link');
  const approved = account?.accessStatus === 'approved';
  const ready = llmKeyReady();
  if (!approved) {
    copy.textContent = 'Telegram linking opens after approval. You can still save preferences and your LLM key.';
  } else if (!ready) {
    copy.textContent = 'Connect a valid LLM key before creating a Telegram link.';
  } else {
    copy.textContent = 'Link a private Telegram conversation. The link expires in 10 minutes.';
  }
  button.disabled = !(approved && ready);
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

$('#llm-key-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const input = $('#llm-key');
  const apiKey = input.value.trim();
  if (!apiKey) {
    message('llm-key', 'Paste an API key to save.');
    return;
  }
  try {
    await api('/api/v1/llm-key', { method: 'PUT', body: JSON.stringify({ apiKey }) });
    input.value = '';
    try {
      const me = await api('/api/v1/me');
      account = me.account;
      llmKey = readLlmKey(me);
    } catch {
      llmKey = { connected: true, lastFour: null, status: 'valid' };
    }
    if (!llmKey.connected) llmKey = { ...llmKey, connected: true, lastFour: llmKey.lastFour, status: llmKey.status === 'invalid' ? 'invalid' : 'valid' };
    renderAccount();
    message('llm-key', llmKey.status === 'invalid'
      ? 'Key saved, but it isn’t valid. Paste a working key to replace it.'
      : 'API key saved.');
  } catch (error) {
    message('llm-key', error.message);
  }
});

$('#telegram-link')?.addEventListener('click', async () => {
  if (account?.accessStatus !== 'approved') {
    message('telegram', 'Telegram linking opens after your access is approved.');
    return;
  }
  if (!llmKeyReady()) {
    message('telegram', 'Connect a valid LLM key first.');
    return;
  }
  try {
    const result = await api('/api/v1/telegram-links', { method: 'POST', body: '{}' });
    $('#telegram-copy').innerHTML = `<a href="${result.url}" target="_blank" rel="noreferrer">Open Telegram to connect Nook</a> · link expires in 10 minutes.`;
    message('telegram', 'Link created.');
  } catch (error) { message('telegram', error.message); }
});

if (supabase) supabase.auth.onAuthStateChange(() => { void loadAccount(); });
void loadAccount();
