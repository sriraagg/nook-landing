const apiBase = import.meta.env.VITE_NOOK_API_URL || 'https://nook-267305660945.us-west1.run.app';
const coverageEndpoint = `${apiBase}/public/coverage`;
const form = document.querySelector('#waitlist-form');
const message = document.querySelector('#form-message');
const hero = document.querySelector('.hero');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function renderCoverageDirectory(cities) {
  const list = document.querySelector('#coverage-list');
  if (!list) return;
  list.replaceChildren();
  if (!cities.length) {
    const empty = document.createElement('p');
    empty.className = 'coverage-error';
    empty.textContent = 'Nook is preparing its first Bay Area coverage. Check back soon.';
    list.append(empty);
    return;
  }

  cities.forEach((city) => {
    const card = document.createElement('article');
    card.className = 'city-coverage';
    const name = document.createElement('span');
    name.className = 'city-name';
    name.textContent = city.name;
    const meta = document.createElement('span');
    meta.className = 'city-meta';
    meta.textContent = `${city.propertyCount} ${plural(city.propertyCount, 'property', 'properties')} tracked`;
    const live = document.createElement('span');
    live.className = 'city-live';
    live.textContent = 'Available';
    card.append(name, meta, live);
    list.append(card);
  });
}

function plural(count, singular, pluralForm) {
  return count === 1 ? singular : pluralForm;
}

function updateCoverageSummary(coverage) {
  document.querySelector('#coverage-property-count').textContent = coverage.summary.properties.toLocaleString();
  document.querySelector('#coverage-city-count').textContent = coverage.summary.cities.toLocaleString();
  const updated = document.querySelector('#coverage-updated');
  if (coverage.lastUpdatedAt) {
    const date = new Date(coverage.lastUpdatedAt);
    updated.textContent = `Updated ${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date)}`;
  } else {
    updated.textContent = 'Live data';
  }
}

async function loadCoverage({ announce = true } = {}) {
  const status = document.querySelector('#coverage-status');
  if (announce) status.textContent = 'Refreshing live coverage…';
  try {
    const response = await fetch(coverageEndpoint, { headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error('coverage unavailable');
    const coverage = await response.json();
    if (!coverage.ok || !Array.isArray(coverage.cities)) throw new Error('invalid coverage');
    updateCoverageSummary(coverage);
    renderCoverageDirectory(coverage.cities);
    status.textContent = coverage.summary.properties
      ? `Tracking ${coverage.summary.properties.toLocaleString()} active property sources across the Bay Area.`
      : 'Bay Area coverage is being prepared now.';
  } catch {
    status.textContent = 'Live coverage is temporarily unavailable. Nook is still accepting Bay Area waitlist requests.';
    const list = document.querySelector('#coverage-list');
    list.replaceChildren();
    const error = document.createElement('p');
    error.className = 'coverage-error';
    error.textContent = 'We couldn’t refresh the coverage directory just now. It will retry automatically.';
    list.append(error);
  }
}

function attachScrollScene() {
  if (!hero || reduceMotion) return;
  let ticking = false;
  const update = () => {
    const rect = hero.getBoundingClientRect();
    const progress = Math.min(1, Math.max(0, -rect.top / Math.max(rect.height, 1)));
    hero.style.setProperty('--scene-scroll', `${progress * 58}px`);
    ticking = false;
  };
  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(update);
      ticking = true;
    }
  }, { passive: true });
  update();
}

function attachScrollReveals() {
  const elements = document.querySelectorAll('.reveal-on-scroll');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    elements.forEach((element) => element.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver((entries, revealObserver) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      revealObserver.unobserve(entry.target);
    });
  }, {
    root: null,
    rootMargin: '0px 0px -10% 0px',
    threshold: .1,
  });

  elements.forEach((element) => observer.observe(element));
}

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
    const response = await fetch(`${apiBase}/public/waitlist`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, website }),
    });
    if (!response.ok) throw new Error('request failed');
    form.reset();
    message.textContent = 'You’re on the Bay Area list. We’ll be in touch when Nook opens up.';
  } catch {
    message.textContent = 'Something went wrong. Please try again in a moment.';
  } finally {
    if (button) button.disabled = false;
  }
});

attachScrollScene();
attachScrollReveals();
void loadCoverage();
window.setInterval(() => void loadCoverage({ announce: false }), 5 * 60 * 1000);
