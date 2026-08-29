const workerUrl = String(window.COOKIES_CAKES_PORTFOLIO_WORKER_URL || '').replace(/\/$/, '');
const dataUrl = String(window.COOKIES_CAKES_PORTFOLIO_DATA_URL || '').trim();
const itemsMount = document.querySelector('#items');
const itemTemplate = document.querySelector('#item-template');
const emptyState = document.querySelector('#empty');
const status = document.querySelector('#status');
const pendingImages = new Map();
let portfolioItems = [];

const makeId = () => `portfolio-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const setStatus = (message, error = false) => { status.textContent = message; status.classList.toggle('error', error); };
const cleanText = value => String(value || '').trim();
const normaliseItem = item => ({
  id: cleanText(item.id) || makeId(),
  title: cleanText(item.title),
  caption: cleanText(item.caption),
  instagram: cleanText(item.instagram),
  image: cleanText(item.image),
  visible: item.visible !== false
});

function parsePortfolio(source) {
  const match = String(source).match(/window\.portfolioItems\s*=\s*(\[[\s\S]*\])\s*;?\s*$/);
  if (!match) throw new Error('The published portfolio data could not be read.');
  const parsed = JSON.parse(match[1]);
  return Array.isArray(parsed) ? parsed.map(normaliseItem) : [];
}

function imagePathFor(item, file) {
  const extension = (file.name.match(/\.[a-zA-Z0-9]+$/) || ['.jpg'])[0].toLowerCase();
  const safeTitle = (item.title || 'portfolio-photo').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'portfolio-photo';
  return `portfolio-images/${Date.now()}-${item.id.replace(/[^a-z0-9-]/gi, '')}-${safeTitle}${extension}`;
}

function updateItem(card) {
  const item = portfolioItems.find(entry => entry.id === card.dataset.id);
  if (!item) return;
  item.title = cleanText(card.querySelector('[name="title"]').value);
  item.caption = cleanText(card.querySelector('[name="caption"]').value);
  item.instagram = cleanText(card.querySelector('[name="instagram"]').value);
  item.visible = card.querySelector('[name="visible"]').checked;
}

function syncItems() {
  itemsMount.querySelectorAll('.item').forEach(updateItem);
}

function previewFor(item, file) {
  if (file) return URL.createObjectURL(file);
  if (!item.image) return '';
  return new URL(item.image.replace(/^\/+/, ''), `${workerUrl}/`).href;
}

async function sourceFileFor(item) {
  const pending = pendingImages.get(item.id);
  if (pending) return pending.file;
  if (!workerUrl || !item.image) throw new Error('There is no saved photo to re-crop.');
  const response = await fetch(`${workerUrl}/api/image?path=${encodeURIComponent(item.image)}`);
  if (!response.ok) throw new Error('The saved photo could not be loaded for re-cropping.');
  const blob = await response.blob();
  return new File([blob], item.image.split('/').pop() || 'portfolio-photo.jpg', { type: blob.type || 'image/jpeg' });
}

async function cropAndSetPhoto(item, card, sourceFile) {
  const file = await window.CookiesCakesImageCropper.cropImage(sourceFile);
  const path = imagePathFor(item, file);
  item.image = path;
  pendingImages.set(item.id, { file, path });
  card.querySelector('.photo-name').textContent = `Cropped photo ready: ${file.name}`;
  card.querySelector('.preview').innerHTML = `<img src="${previewFor(item, file)}" alt="${item.title || 'Portfolio photo'}">`;
}

function renderItems() {
  itemsMount.innerHTML = '';
  emptyState.hidden = portfolioItems.length !== 0;
  portfolioItems.forEach(item => {
    const card = itemTemplate.content.cloneNode(true).querySelector('.item');
    card.dataset.id = item.id;
    const titleInput = card.querySelector('[name="title"]');
    const cardTitle = card.querySelector('.item-head h3');
    const updateCardTitle = () => { cardTitle.textContent = titleInput.value.trim() || 'Untitled photo'; };
    titleInput.value = item.title;
    updateCardTitle();
    card.querySelector('[name="caption"]').value = item.caption;
    card.querySelector('[name="instagram"]').value = item.instagram;
    card.querySelector('[name="visible"]').checked = item.visible;
    const photoName = card.querySelector('.photo-name');
    const image = pendingImages.get(item.id);
    photoName.textContent = image ? `New photo: ${image.file.name}` : (item.image ? 'Current photo selected' : 'No photo selected');
    const preview = card.querySelector('.preview');
    const previewUrl = previewFor(item, image?.file);
    if (previewUrl) preview.innerHTML = `<img src="${previewUrl}" alt="${item.title || 'Portfolio photo'}">`;
    const recropButton = document.createElement('button');
    recropButton.className = 'recrop-photo';
    recropButton.type = 'button';
    recropButton.textContent = 'Re-crop current photo';
    recropButton.disabled = !item.image;
    photoName.closest('label').after(recropButton);
    recropButton.addEventListener('click', async () => {
      if (!item.image) return;
      recropButton.disabled = true;
      try {
        await cropAndSetPhoto(item, card, await sourceFileFor(item));
      } catch (error) {
        if (error?.name !== 'ImageCropCancelled') setStatus(error.message || 'Could not re-crop that photo.', true);
      } finally {
        recropButton.disabled = !item.image;
      }
    });
    card.querySelectorAll('input:not([type="file"]),textarea').forEach(input => input.addEventListener('input', () => updateItem(card)));
    titleInput.addEventListener('input', updateCardTitle);
    card.querySelector('[name="visible"]').addEventListener('change', () => updateItem(card));
    card.querySelector('[name="image"]').addEventListener('change', async event => {
      const sourceFile = event.target.files[0];
      event.target.value = '';
      if (!sourceFile) return;
      try {
        updateItem(card);
        await cropAndSetPhoto(item, card, sourceFile);
        recropButton.disabled = false;
      } catch (error) {
        if (error?.name !== 'ImageCropCancelled') setStatus(error.message || 'Could not crop that photo.', true);
      }
    });
    card.querySelector('.remove').addEventListener('click', () => {
      if (!window.confirm(`Remove “${item.title || 'this portfolio photo'}” permanently?`)) return;
      portfolioItems = portfolioItems.filter(entry => entry.id !== item.id);
      pendingImages.delete(item.id);
      renderItems();
    });
    itemsMount.append(card);
  });
}

async function loadPortfolio() {
  if (!dataUrl) { setStatus('Portfolio loading is not configured yet.', true); return; }
  try {
    setStatus('Loading your portfolio…');
    const response = await fetch(`${dataUrl}${dataUrl.includes('?') ? '&' : '?'}updated=${Date.now()}`);
    if (!response.ok) throw new Error('Could not load portfolio');
    portfolioItems = parsePortfolio(await response.text());
    pendingImages.clear();
    renderItems();
    setStatus(`Loaded ${portfolioItems.length} portfolio item${portfolioItems.length === 1 ? '' : 's'}.`);
  } catch (error) {
    console.error(error);
    setStatus('Could not load the published portfolio. Try refreshing.', true);
  }
}

function addItem() {
  syncItems();
  portfolioItems.unshift(normaliseItem({ id: makeId(), title: '', caption: '', instagram: '', image: '', visible: true }));
  renderItems();
}

function validate() {
  syncItems();
  for (const item of portfolioItems) {
    if (!item.visible) continue;
    if (!item.title || !item.image) throw new Error('Every visible portfolio item needs a title and photo.');
    if (item.instagram && !/^https:\/\/(www\.)?instagram\.com\//i.test(item.instagram)) throw new Error('Instagram links must start with https://www.instagram.com/.');
  }
}

function serialise() {
  return `window.portfolioItems = ${JSON.stringify(portfolioItems, null, 2)};\n`;
}

function imageToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result).split(',')[1]));
    reader.addEventListener('error', reject);
    reader.readAsDataURL(file);
  });
}

async function publish() {
  try {
    validate();
    if (!workerUrl) throw new Error('Publishing is not configured yet.');
    const password = document.querySelector('#password').value;
    if (!password) throw new Error('Enter your publish password first.');
    setStatus('Preparing your portfolio…');
    const images = await Promise.all([...pendingImages.values()].map(async image => ({ path: image.path, content: await imageToBase64(image.file) })));
    setStatus('Publishing your portfolio…');
    const response = await fetch(`${workerUrl}/api/publish-portfolio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Menu-Publish-Password': password },
      body: JSON.stringify({ portfolioData: serialise(), images })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Publishing failed.');
    document.querySelector('#password').value = '';
    pendingImages.clear();
    setStatus('Published! Your portfolio will update shortly.');
    renderItems();
  } catch (error) {
    console.error(error);
    setStatus(error.message || 'Publishing failed. Please try again.', true);
  }
}

document.querySelector('#add').addEventListener('click', addItem);
document.querySelector('#refresh').addEventListener('click', () => {
  if (pendingImages.size || portfolioItems.length) {
    if (!window.confirm('Refresh from the website and discard unpublished changes?')) return;
  }
  loadPortfolio();
});
document.querySelector('#publish').addEventListener('click', publish);
document.querySelector('#password').addEventListener('keydown', event => {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  publish();
});
loadPortfolio();
