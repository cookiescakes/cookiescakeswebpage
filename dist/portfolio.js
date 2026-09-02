(() => {
  const mount = document.querySelector('#portfolio-items');
  if (!mount) return;
  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  const imageUrl = value => String(value || '').replace(/[^a-zA-Z0-9_./-]/g, '');
  const portfolioTypeFor = item => item.portfolioType === 'cake' || item.portfolioType === 'treat' ? item.portfolioType : /cookie|brownie|blondie|cupcake|pie|treat|muffin|slice/i.test(item.title || '') ? 'treat' : 'cake';
  const filterButtons = [...document.querySelectorAll('[data-portfolio-filter]')];
  let activeFilter = 'all';
  let portfolioItems = [];
  const render = items => {
    const visible = items.filter(item => item && item.visible !== false && item.image && (activeFilter === 'all' || portfolioTypeFor(item) === activeFilter));
    mount.innerHTML = visible.length ? visible.map(item => {
      const title = escapeHtml(item.title || 'Cookies Cakes creation');
      const caption = item.caption ? `<p>${escapeHtml(item.caption)}</p>` : '';
      const instagram = /^https:\/\/(www\.)?instagram\.com\//i.test(item.instagram || '') ? `<a href="${escapeHtml(item.instagram)}" target="_blank" rel="noopener noreferrer">View on Instagram →</a>` : '';
      return `<article class="portfolio-card"><img src="${escapeHtml(imageUrl(item.image))}" alt="${title}"><div class="portfolio-card-body"><h2>${title}</h2>${caption}${instagram}</div></article>`;
    }).join('') : '<p class="portfolio-empty">Our latest creations will be added here soon. Follow us on Instagram in the meantime.</p>';
  };
  filterButtons.forEach(button => button.addEventListener('click', () => {
    activeFilter = button.dataset.portfolioFilter;
    filterButtons.forEach(item => item.classList.toggle('active', item === button));
    render(portfolioItems);
  }));
  fetch(`portfolio-data.js?updated=${Date.now()}`).then(response => {
    if (!response.ok) throw new Error('Could not load portfolio');
    return response.text();
  }).then(source => {
    const match = source.match(/window\.portfolioItems\s*=\s*(\[[\s\S]*\])\s*;?\s*$/);
    portfolioItems = match ? JSON.parse(match[1]) : [];
    render(portfolioItems);
  }).catch(() => render([]));
})();
