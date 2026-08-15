const form = document.querySelector('#waitlist-form');
const message = document.querySelector('#form-message');
const apiEndpoint = 'https://nook-267305660945.us-west1.run.app/public/waitlist';

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const email = String(data.get('email') ?? '').trim();
  const website = String(data.get('website') ?? '');
  if (!email || !email.includes('@')) {
    message.textContent = 'Enter a valid email address.';
    return;
  }
  const button = form.querySelector('button');
  if (button) button.disabled = true;
  message.textContent = 'Joining the list…';
  try {
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, website }),
    });
    if (!response.ok) throw new Error('request failed');
    form.reset();
    message.textContent = 'You’re on the list. We’ll be in touch when Nook opens up.';
  } catch {
    message.textContent = 'Something went wrong. Please try again in a moment.';
  } finally {
    if (button) button.disabled = false;
  }
});
