const escapeHtml=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));

const getCurrentMenuItems=()=>{const catalogue=Array.isArray(window.menuCatalogue)?window.menuCatalogue:[];const selection=Array.isArray(window.weeklyMenuSelection)?window.weeklyMenuSelection:[];return catalogue.length?selection.map(id=>catalogue.find(item=>item.id===id)).filter(Boolean):(Array.isArray(window.weeklyMenuItems)?window.weeklyMenuItems:[]);};
const menuMount=document.querySelector('#weekly-menu-items');
if(menuMount){const menuItems=getCurrentMenuItems();menuMount.className='menu-grid';menuMount.innerHTML=menuItems.map(item=>{const image=item.image?`<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}">`:'<span>Menu photo</span>';const imageClass=item.image?' has-image':'';return `<article class="product-card"><div class="photo-placeholder product-photo${imageClass}">${image}<div class="dietary-badges"><span class="dietary-badge gluten-free" ${item.glutenFree?'':'hidden'} aria-label="Gluten free">GF</span><span class="dietary-badge vegan" ${item.vegan?'':'hidden'} aria-label="Vegan">V</span></div></div><div class="product-body"><h2>${escapeHtml(item.title)}</h2><p>${escapeHtml(item.description)}</p><div class="price">${escapeHtml(item.price)}</div></div></article>`;}).join('');}

const homeMenuPreview=document.querySelector('#home-menu-preview');
if(homeMenuPreview){const previewItems=getCurrentMenuItems().slice(0,2);homeMenuPreview.innerHTML=previewItems.length?previewItems.map(item=>{const image=item.image?`<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}">`:'<span>Menu photo</span>';const imageClass=item.image?' has-image':'';return `<article class="mini-card"><div class="photo-placeholder${imageClass}">${image}</div><div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description)}</p><div class="dietary-badges mini-dietary-badges"><span class="dietary-badge gluten-free" ${item.glutenFree?'':'hidden'} aria-label="Gluten free">GF</span><span class="dietary-badge vegan" ${item.vegan?'':'hidden'} aria-label="Vegan">V</span></div><strong>${escapeHtml(item.price)}</strong></div></article>`;}).join(''):'<p class="menu-preview-empty">This week\'s treats will be added soon.</p>';}

document.querySelectorAll('.menu-toggle').forEach(btn=>{btn.addEventListener('click',()=>{const nav=document.getElementById(btn.getAttribute('aria-controls'));const open=nav.classList.toggle('open');btn.setAttribute('aria-expanded',String(open));btn.textContent=open?'Close':'Menu';});});

const socialLinks={Instagram:'https://www.instagram.com/cookiescakes.uk/',Facebook:'https://www.facebook.com/profile.php?id=61591827583888'};
document.querySelectorAll('.socials a,.social-buttons a').forEach(link=>{const name=link.textContent.trim().replace('→','').trim();if(socialLinks[name]){link.href=socialLinks[name];link.target='_blank';link.rel='noopener noreferrer';}if(name==='TikTok')link.remove();});

document.querySelectorAll('.brand-logo').forEach(logo=>{logo.style.borderRadius='0';logo.style.boxShadow='none';});
document.querySelectorAll('.footer-logo').forEach(logo=>{logo.style.filter='invert(1)';});
document.querySelectorAll('.site-footer').forEach(footer=>{footer.style.background='#1f1d1e';});

const dietaryFilterButtons=document.querySelectorAll('[data-dietary-filter]');
if(dietaryFilterButtons.length){const menuCards=document.querySelectorAll('.menu-grid .product-card');const noMenuResults=document.querySelector('.no-menu-results');dietaryFilterButtons.forEach(button=>{button.addEventListener('click',()=>{const filter=button.dataset.dietaryFilter;let matches=0;dietaryFilterButtons.forEach(item=>item.classList.toggle('active',item===button));menuCards.forEach(card=>{const show=filter==='all'||Boolean(card.querySelector(`.${filter}:not([hidden])`));card.hidden=!show;if(show)matches+=1;});if(noMenuResults)noMenuResults.hidden=matches!==0;});});}
