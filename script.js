const apiBase = import.meta.env.VITE_NOOK_API_URL || 'https://nook-267305660945.us-west1.run.app';
const coverageEndpoint = `${apiBase}/public/coverage`;
const form = document.querySelector('#waitlist-form');
const message = document.querySelector('#form-message');
const hero = document.querySelector('.hero');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const cityFallbackCenters = new Map(Object.entries({
  'san francisco': [-122.4194, 37.7749],
  oakland: [-122.2711, 37.8044],
  berkeley: [-122.2727, 37.8715],
  alameda: [-122.2416, 37.7652],
  'daly city': [-122.4702, 37.6879],
  'south san francisco': [-122.4077, 37.6547],
  'san mateo': [-122.3255, 37.563],
  'redwood city': [-122.2364, 37.4852],
  'palo alto': [-122.143, 37.4419],
  'mountain view': [-122.0839, 37.3861],
  sunnyvale: [-122.0363, 37.3688],
  cupertino: [-122.0322, 37.323],
  'santa clara': [-121.9552, 37.3541],
  'san jose': [-121.8863, 37.3382],
  milpitas: [-121.8996, 37.4323],
  fremont: [-121.9886, 37.5485],
  hayward: [-122.0808, 37.6688],
  campbell: [-121.95, 37.2872],
  'los gatos': [-121.9747, 37.2358],
}));

const svgNamespace = 'http://www.w3.org/2000/svg';
const mapBounds = { west: -122.58, east: -121.78, south: 37.15, north: 38.05 };

function cityCenter(city) {
  const center = city?.center;
  if (center && validBayCoordinate(center.latitude, center.longitude)) {
    return [center.longitude, center.latitude];
  }
  return cityFallbackCenters.get(String(city?.name || '').trim().toLowerCase()) || null;
}

function neighborhoodCenter(neighborhood) {
  const center = neighborhood?.center;
  if (!center || !validBayCoordinate(center.latitude, center.longitude)) return null;
  return [center.longitude, center.latitude];
}

function validBayCoordinate(latitude, longitude) {
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    && latitude >= 36.8 && latitude <= 38.7
    && longitude >= -123.3 && longitude <= -120.8;
}

function projectCoordinate([longitude, latitude]) {
  const x = ((longitude - mapBounds.west) / (mapBounds.east - mapBounds.west)) * 900;
  const y = ((mapBounds.north - latitude) / (mapBounds.north - mapBounds.south)) * 650;
  return [Math.min(880, Math.max(20, x)), Math.min(630, Math.max(20, y))];
}

function svgElement(name, attributes = {}) {
  const element = document.createElementNS(svgNamespace, name);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, String(value)));
  return element;
}

function markerLabelLayout(cityName) {
  const name = cityName.trim().toLowerCase();
  if (name === 'mountain view') return { x: -15, y: -5, countY: 8, anchor: 'end' };
  if (name === 'sunnyvale') return { x: 15, y: -7, countY: 6, anchor: 'start' };
  if (name === 'cupertino') return { x: -15, y: 17, countY: 30, anchor: 'end' };
  return { x: 15, y: -2, countY: 11, anchor: 'start' };
}

function addCoverageMarkers(cities) {
  const markerLayer = document.querySelector('#coverage-markers');
  if (!markerLayer) return;
  markerLayer.replaceChildren();

  cities.forEach((city) => {
    const center = cityCenter(city);
    if (center) {
      const [x, y] = projectCoordinate(center);
      const group = svgElement('g', { class: 'svg-city-marker', transform: `translate(${x} ${y})` });
      const title = svgElement('title');
      title.textContent = `${city.name}: ${city.propertyCount} ${plural(city.propertyCount, 'property', 'properties')} tracked`;
      const pulse = svgElement('circle', { class: 'marker-pulse-ring', r: 15 });
      const outer = svgElement('circle', { class: 'marker-outer', r: 9 });
      const core = svgElement('circle', { class: 'marker-core', r: 4 });
      const labelLayout = markerLabelLayout(city.name);
      const label = svgElement('text', {
        class: 'marker-city-label',
        x: labelLayout.x,
        y: labelLayout.y,
        'text-anchor': labelLayout.anchor,
      });
      label.textContent = city.name;
      const count = svgElement('text', {
        class: 'marker-city-count',
        x: labelLayout.x,
        y: labelLayout.countY,
        'text-anchor': labelLayout.anchor,
      });
      count.textContent = `${city.propertyCount} tracked`;
      group.append(title, pulse, outer, core, label, count);
      markerLayer.append(group);
    }

    city.neighborhoods.forEach((neighborhood) => {
      const neighborhoodPosition = neighborhoodCenter(neighborhood);
      if (!neighborhoodPosition) return;
      const [x, y] = projectCoordinate(neighborhoodPosition);
      const group = svgElement('g', { class: 'svg-neighborhood-marker', transform: `translate(${x} ${y})` });
      const title = svgElement('title');
      title.textContent = `${neighborhood.name}, ${city.name}: ${neighborhood.propertyCount} tracked`;
      const dot = svgElement('circle', { r: 3.5 });
      group.append(title, dot);
      markerLayer.append(group);
    });
  });
}

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

  cities.forEach((city, index) => {
    const details = document.createElement('details');
    details.className = 'city-coverage';
    if (index < 2) details.open = true;
    const summary = document.createElement('summary');
    const text = document.createElement('span');
    const name = document.createElement('span');
    name.className = 'city-name';
    name.textContent = city.name;
    const meta = document.createElement('span');
    meta.className = 'city-meta';
    meta.textContent = `${city.propertyCount} ${plural(city.propertyCount, 'property', 'properties')} · ${city.neighborhoods.length} ${plural(city.neighborhoods.length, 'neighborhood', 'neighborhoods')}`;
    text.append(name, meta);
    summary.append(text);
    const neighborhoods = document.createElement('div');
    neighborhoods.className = 'neighborhood-list';
    if (city.neighborhoods.length) {
      city.neighborhoods.forEach((neighborhood) => {
        const chip = document.createElement('span');
        chip.textContent = `${neighborhood.name} · ${neighborhood.propertyCount}`;
        neighborhoods.append(chip);
      });
    } else {
      const pending = document.createElement('span');
      pending.className = 'no-neighborhoods';
      pending.textContent = 'Neighborhood detail is still being verified.';
      neighborhoods.append(pending);
    }
    details.append(summary, neighborhoods);
    list.append(details);
  });
}

function plural(count, singular, pluralForm) {
  return count === 1 ? singular : pluralForm;
}

function updateCoverageSummary(coverage) {
  document.querySelector('#coverage-property-count').textContent = coverage.summary.properties.toLocaleString();
  document.querySelector('#coverage-city-count').textContent = coverage.summary.cities.toLocaleString();
  document.querySelector('#coverage-neighborhood-count').textContent = coverage.summary.neighborhoods.toLocaleString();
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
    addCoverageMarkers(coverage.cities);
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
void loadCoverage();
window.setInterval(() => void loadCoverage({ announce: false }), 5 * 60 * 1000);
