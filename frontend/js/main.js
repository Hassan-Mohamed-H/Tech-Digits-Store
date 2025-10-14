// TechDigits Store frontend core
(function initTheme() {
  try {
    const saved = localStorage.getItem('theme');
    const isDark = saved === 'dark';
    document.documentElement.style.setProperty('color-scheme', isDark ? 'dark' : 'light');
    document.body && document.body.classList.toggle('dark-mode', isDark);
  } catch (_) {}
})();

// ---------------- Theme toggle injection ----------------
function ensureThemeToggle() {
  if (document.getElementById('themeToggle')) return;
  const btn = document.createElement('button');
  btn.id = 'themeToggle';
  btn.className = 'theme-toggle';
  const isDark = document.body.classList.contains('dark-mode');
  btn.textContent = isDark ? '☀️' : '🌙';
  btn.title = isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode';
  btn.setAttribute('aria-label', btn.title);
  btn.addEventListener('click', () => {
    const nowDark = !document.body.classList.contains('dark-mode');
    document.body.classList.toggle('dark-mode', nowDark);
    try { localStorage.setItem('theme', nowDark ? 'dark' : 'light'); } catch (_) {}
    document.documentElement.style.setProperty('color-scheme', nowDark ? 'dark' : 'light');
    btn.textContent = nowDark ? '☀️' : '🌙';
    btn.title = nowDark ? 'Switch to Light Mode' : 'Switch to Dark Mode';
    btn.setAttribute('aria-label', btn.title);
  });

  const headerRow = ui.qs('.site-header .hdr');
  const userNav = ui.qs('#header-user');
  if (headerRow) {
    if (userNav && userNav.parentElement === headerRow) {
      headerRow.insertBefore(btn, userNav);
    } else {
      headerRow.appendChild(btn);
    }

  // Email OTP verification page (verify-otp.html) for Visa payments ONLY when method=visa
  const verifyOtpForm = ui.qs('#verifyOtpForm');
  if (verifyOtpForm) {
    const p = new URLSearchParams(location.search);
    const method = (p.get('method')||'').toLowerCase();
    if (method === 'visa') {
      if (!auth.requireLogin(`verify-otp.html${location.search}`)) return;
      const orderId = p.get('orderId');
      const msgEl = ui.qs('#otpMsg');
      const resendBtn = ui.qs('#resendOtpBtn');
      const codeInput = verifyOtpForm.querySelector('input[name=code]');
      if (!orderId) {
        ui.toast('Payment info missing. Returning to checkout…', 'error');
        setTimeout(()=> location.href = 'checkout.html', 600);
        return;
      }
      verifyOtpForm.addEventListener('submit', async (e)=>{
        e.preventDefault();
        msgEl && (msgEl.textContent = '');
        const code = String(codeInput && codeInput.value || '').trim();
        if (!/^\d{6}$/.test(code)) { codeInput && codeInput.focus(); return; }
        try {
          let card = {};
          try { card = JSON.parse(sessionStorage.getItem(`visa_card_${orderId}`) || '{}'); } catch(_) {}
          const payload = { orderId, method: 'visa', otp: code, cardNumber: card.cardNumber, expiryMonth: card.expiryMonth, expiryYear: card.expiryYear, cvv: card.cvv };
          await api.post('/payments/verify-otp', payload);
          cart.clear();
          document.body.classList.add('page-leave');
          setTimeout(()=> { location.href = 'payment-success.html'; }, 200);
        } catch (err) {
          msgEl && (msgEl.textContent = err.message || 'Invalid or expired code');
        }
      });
      if (resendBtn) resendBtn.addEventListener('click', async ()=>{
        try {
          resendBtn.disabled = true;
          await api.post('/payments/send-otp', { orderId, method: 'visa' });
          msgEl && (msgEl.textContent = 'A new code has been sent to your email.');
        } catch (err) {
          msgEl && (msgEl.textContent = err.message || 'Failed to resend code');
        } finally {
          setTimeout(()=> { try { resendBtn.disabled = false; } catch(_) {} }, 20000);
        }
      });
    }
  }
  } else {
    btn.style.position = 'fixed';
    btn.style.top = '12px';
    btn.style.insetInlineEnd = '12px';
    btn.style.zIndex = '100';
    document.body.appendChild(btn);
  }
}
// Modular plain JS for api, auth, ui, products, categories, cart, checkout
// Robust API base: same-origin /api if served by the backend; fallback to localhost:5000/api
const API_BASE =
  window.__API_BASE__ ||
  (location.hostname.includes('azurestaticapps.net')
    ? 'https://tech-digits-store-backend-ddexche4cnc0drcd.westeurope-01.azurewebsites.net/api'
    : 'http://localhost:5000/api'); 

const API = API_BASE.replace(/\/$/, '');


// ---------------- API ----------------
const api = {
  async json(path, opts = {}) {
    const token = localStorage.getItem('token');
    const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API}${path.startsWith('/') ? '' : '/'}${path}`, { ...opts, headers });
    let body = null;
    try { body = await res.json(); } catch(_) {}

    if (!res.ok) throw new Error((body && (body.message || body.error)) || 'An error occurred. Please try again.');
    return body;
  },
  async get(path) { return this.json(path); },
  async post(path, data) { return this.json(path, { method: 'POST', body: JSON.stringify(data || {}) }); },
  async put(path, data) { return this.json(path, { method: 'PUT', body: JSON.stringify(data || {}) }); },
  async delete(path) { return this.json(path, { method: 'DELETE' }); },
};

// ---------------- UI helpers ----------------
const ui = {
  qs: (s, r=document) => r.querySelector(s),
  qsa: (s, r=document) => Array.from(r.querySelectorAll(s)),
  toast(msg, type='info') {
    let box = document.getElementById('toast');
    if (!box) {
      box = document.createElement('div');
      box.id = 'toast';
      document.body.appendChild(box);
    }
    box.textContent = msg;
    box.className = `show ${type}`;
    setTimeout(()=> box.className = box.className.replace('show',''), 2500);
  },
  currency(v) {
    const n = Number(v || 0);
    return new Intl.NumberFormat('en-EG', { style: 'currency', currency: 'EGP', currencyDisplay: 'code' }).format(n);
  },
  setLoading(el, state) {
    if (!el) return; el.disabled = !!state; el.dataset.loading = state ? '1' : '';
  },
  // Lightweight modal/dialog utilities for forms and confirmations
  modal({ title = 'Dialog', body = '', submitText = 'Save', cancelText = 'Cancel', onSubmit = null, destructive = false, size = 'md' } = {}) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    // Accessibility defaults (hidden until opened)
    overlay.setAttribute('aria-hidden', 'true');
    overlay.setAttribute('inert', 'true');
    overlay.innerHTML = `
      <div class="modal-dialog ${size}">
        <div class="modal-header">
          <h3>${title}</h3>
          <button class="modal-close" aria-label="Close">×</button>
        </div>
        <div class="modal-body"></div>
        <div class="modal-footer">
          <button class="btn ghost modal-cancel">${cancelText}</button>
          ${onSubmit ? `<button class="btn ${destructive ? 'danger' : ''} modal-submit">${submitText}</button>` : ''}
        </div>
      </div>`;
    const bodyBox = overlay.querySelector('.modal-body');
    if (typeof body === 'string') bodyBox.innerHTML = body; else bodyBox.appendChild(body);
    // Save the element that had focus before opening
    const previouslyFocused = document.activeElement;
    // Helper: find first focusable element in the dialog
    function focusFirst() {
      try {
        const dlg = overlay.querySelector('.modal-dialog');
        const focusables = dlg && dlg.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (focusables && focusables.length) {
          (focusables[0]).focus();
        } else {
          // Fallback to close button
          const x = overlay.querySelector('.modal-close');
          if (x) x.focus();
        }
      } catch(_) {}
    }
    function close() {
      // Set aria-hidden/inert and hide display, then remove after animation for dynamic modals
      overlay.classList.remove('open');
      overlay.setAttribute('aria-hidden', 'true');
      overlay.setAttribute('inert', 'true');
      // Return focus to the previously focused control if still in document
      try { if (previouslyFocused && typeof previouslyFocused.focus === 'function') previouslyFocused.focus(); } catch(_) {}
      setTimeout(()=> overlay.remove(), 120);
    }
    overlay.addEventListener('click', (e)=> { if (e.target === overlay) close(); });
    overlay.querySelector('.modal-close').onclick = close;
    overlay.querySelector('.modal-cancel').onclick = close;
    const submitBtn = overlay.querySelector('.modal-submit');
    if (onSubmit && submitBtn) submitBtn.onclick = async ()=> { try { ui.setLoading(submitBtn, true); await onSubmit(); close(); } finally { ui.setLoading(submitBtn, false); } };
    document.body.appendChild(overlay);
    // Trigger "open" after attach so CSS animations (and opacity -> 1) reliably run
    requestAnimationFrame(()=> {
      // Show and enable interaction
      overlay.style.display = 'flex';
      overlay.classList.add('open');
      overlay.removeAttribute('aria-hidden');
      overlay.removeAttribute('inert');
      focusFirst();
    });
    document.addEventListener('keydown', function esc(e){ if(e.key==='Escape'){ close(); document.removeEventListener('keydown', esc);} });
    return { close, root: overlay };
  },
  confirm({ title = 'Confirm', message = 'Are you sure?', confirmText = 'Confirm', cancelText = 'Cancel', destructive = true } = {}) {
    return new Promise(resolve => {
      const dlg = ui.modal({
        title,
        body: `<p class="muted">${message}</p>`,
        submitText: confirmText,
        cancelText,
        destructive,
        onSubmit: async ()=> { resolve(true); }
      });
      // If closed without submit, resolve false
      const obs = new MutationObserver(()=>{});
      dlg.root.addEventListener('transitionend', ()=>{}, { once: true });
      dlg.root.querySelector('.modal-cancel').addEventListener('click', ()=> resolve(false), { once: true });
      dlg.root.querySelector('.modal-close').addEventListener('click', ()=> resolve(false), { once: true });
      dlg.root.addEventListener('click', (e)=>{ if (e.target === dlg.root) resolve(false); }, { once: true });
    });
  },
  formDialog({ title = 'Form', fields = [], values = {}, submitText = 'Save', cancelText = 'Cancel', onSubmit }) {
    // fields: [{name,label,type,placeholder,required,options,min,step}]
    const form = document.createElement('form');
    form.className = 'form grid cols-1';
    for (const f of fields) {
      const wrap = document.createElement('label');
      wrap.innerHTML = `${f.label || f.name}
        ${f.type === 'textarea' ?
          `<textarea name="${f.name}" placeholder="${f.placeholder||''}" ${f.required?'required':''}>${(values[f.name] ?? '')}</textarea>` :
          f.type === 'select' ?
          `<select name="${f.name}" ${f.required?'required':''}>${(f.options||[]).map(o=>`<option value="${typeof o==='object'? (o.value ?? o.id ?? o.slug ?? o.name) : o}" ${((values[f.name] ?? '')===(typeof o==='object'?(o.value ?? o.id ?? o.slug ?? o.name):o))?'selected':''}>${typeof o==='object'? (o.label ?? o.name ?? o.slug ?? o.id) : o}</option>`).join('')}</select>` :
          `<input type="${f.type||'text'}" name="${f.name}" placeholder="${f.placeholder||''}" value="${(values[f.name] ?? '')}" ${f.required?'required':''} ${f.min!=null?`min="${f.min}"`:''} ${f.step!=null?`step="${f.step}"`:''}/>`}
      `;
      form.appendChild(wrap);
    }
    let submitBtnRef;
    const dlg = ui.modal({ title, body: form, submitText, cancelText, onSubmit: async ()=> {
      const data = Object.fromEntries(new FormData(form).entries());
      // Convert numeric fields
      fields.forEach(f=> { if (f.type==='number') data[f.name] = +data[f.name]; });
      await onSubmit(data);
    }});
    submitBtnRef = dlg.root.querySelector('.modal-submit');
    form.addEventListener('submit', (e)=> { e.preventDefault(); submitBtnRef && submitBtnRef.click(); });
    return dlg;
  }
};

// Footer modals for About, Contact, and Privacy
function bindFooterModals() {
  try {
    const linksWrap = ui.qs('.site-footer .links');
    if (!linksWrap) return;
    linksWrap.addEventListener('click', (e) => {
      const a = e.target && e.target.closest('a');
      if (!a) return;
      const href = (a.getAttribute('href') || '').toLowerCase();
      if (!href.startsWith('#')) return;
      e.preventDefault();
      function styleModal(dlg) {
        try {
          const dialog = dlg && dlg.root && dlg.root.querySelector('.modal-dialog');
          const headerTitle = dlg && dlg.root && dlg.root.querySelector('.modal-header h3');
          const bodyEl = dlg && dlg.root && dlg.root.querySelector('.modal-body');
          if (headerTitle) headerTitle.style.textAlign = 'center';
          if (bodyEl) {
            bodyEl.style.display = 'flex';
            bodyEl.style.justifyContent = 'center';
            bodyEl.style.alignItems = 'center';
            bodyEl.style.textAlign = 'center';
            bodyEl.style.minHeight = '100px';
          }
          if (dialog) {
            dialog.style.maxHeight = '50vh';
            dialog.style.overflowY = 'auto';
            dialog.style.display = 'flex';
            dialog.style.flexDirection = 'column';
            dialog.style.justifyContent = 'center';
            // Ensure fixed centering explicitly
            dialog.style.position = 'fixed';
            dialog.style.top = '50%';
            dialog.style.left = '50%';
            dialog.style.transform = 'translate(-50%, -50%)';
            dialog.style.width = 'min(92vw, 520px)';
          }
        } catch(_) {}
      }
      if (href === '#privacy') {
        const dlg = ui.modal({ title: 'Privacy', body: '<div>You have full privacy on our website Tech Digits Store.</div>', cancelText: 'Close', size: 'sm' });
        styleModal(dlg);
      } else if (href === '#about') {
        const dlg = ui.modal({ title: 'About', body: '<div>We are a full team working for your comfort.</div>', cancelText: 'Close', size: 'sm' });
        styleModal(dlg);
      } else if (href === '#contact') {
        const dlg = ui.modal({ title: 'Contact', body: '<div><a href="https://www.youtube.com" target="_blank" rel="noopener noreferrer">https://www.youtube.com</a></div>', cancelText: 'Close', size: 'sm' });
        styleModal(dlg);
      }
    });
  } catch (_) {}
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bindFooterModals);
} else {
  bindFooterModals();
}

// ---------------- Auth ----------------
const auth = {
  get token() { return localStorage.getItem('token'); },
  set token(v) { v ? localStorage.setItem('token', v) : localStorage.removeItem('token'); },
  get user() {
    try { return JSON.parse(localStorage.getItem('user')); } catch(_) { return null; }
  },
  set user(u) { u ? localStorage.setItem('user', JSON.stringify(u)) : localStorage.removeItem('user'); },
  async me() {
    try {
      const res = await api.get('/users/me');
      return res;
    } catch (_) {
      try { return await api.get('/auth/me'); } catch (e) { return null; }
    }
  },
  requireLogin(redirectTo) {
    if (!this.token) {
      const url = `login.html?redirect=${encodeURIComponent(redirectTo || location.pathname + location.search)}`;
      location.href = url; return false;
    }
    return true;
  },
  logout() { this.token = null; this.user = null; location.href = 'index.html'; }
};

// ---------------- Header state ----------------
function renderHeader() {
  const headerUser = ui.qs('#header-user');
  if (!headerUser) return;
  const u = auth.user;
  if (auth.token && u) {
    headerUser.innerHTML = `
      <span class="hi">Welcome ${u.name || ''}</span>
      ${u.role === 'admin' ? '<a href="admin.html" class="btn ghost">Admin Dashboard</a>' : ''}
      <a href="profile.html" class="btn ghost">My Account</a>
      <a href="cart.html" class="btn ghost">Cart</a>
      <button id="logoutBtn" class="btn danger">Sign out</button>
    `;
    const out = ui.qs('#logoutBtn');
    if (out) out.onclick = () => auth.logout();
  } else {
    headerUser.innerHTML = `
      <a href="register.html" class="btn ghost">Register</a>
      <a href="login.html" class="btn">Login</a>
    `;
  }
}

// ---------------- Categories ----------------
const categories = {
  async loadAndRender(container) {
    try {
      let cats = [];
      try { cats = await api.get('/categories'); }
      catch (_) {
        const products = await api.get('/products');
        const set = new Map();
        products.forEach(p => { const c = p.category || p.categoryName || 'General'; set.set(c, { name: c, slug: encodeURIComponent(c) }); });
        cats = Array.from(set.values());
      }
      container.innerHTML = cats.map(c => {
        const key = (c._id || c.id || c.slug || c.name || '').toString();
        const name = c.name || c.title || key;
        const href = `products.html?category=${encodeURIComponent(key)}`;
        return `
          <a class="card category" data-category="${key}" href="${href}">
            <div class="icon" aria-hidden="true">🛍️</div>
            <div class="name">${name}</div>
          </a>`;
      }).join('');
    // fade in
    requestAnimationFrame(()=>{ container.style.transition = 'opacity .3s ease'; container.style.opacity = '1'; });

      // Click listeners to navigate using data-category
      container.querySelectorAll('.category').forEach(cat => {
        cat.addEventListener('click', (e) => {
          // allow anchor default, but ensure dataset is used
          const category = cat.dataset.category;
          if (category) {
            e.preventDefault();
            window.location.href = `products.html?category=${encodeURIComponent(category)}`;
          }
        });
      });
    } catch (e) {
      container.innerHTML = `<p class="error">Failed\ to\ load\ categories: ${e.message}</p>`;
    }
  }
};

// ---------------- Products ----------------
const products = {
  async list(params = {}) {
    const qs = new URLSearchParams(params).toString();
    try { return await api.get(`/products${qs ? `?${qs}` : ''}`); }
    catch(_) { return await api.get('/products'); }
  },
  renderList(container, items) {
    // Ensure container is visible (avoid hidden state)
    container.style.opacity = '1';
    container.innerHTML = items.map(p => {
      const imgSrc = p.image || (p.images && p.images.length && p.images[0]) || '';
      const img = imgSrc
        ? `<img src="${imgSrc}" alt="${p.name}" class="product-image" loading="lazy">`
        : `<img src="https://via.placeholder.com/400x300?text=${encodeURIComponent(p.name||'Product')}" alt="${p.name||'Product'}" class="product-image" loading="lazy">`;
      const desc = (p.description || '').slice(0, 120) + ((p.description || '').length > 120 ? '…' : '');
      return `
        <div class="card product" data-id="${p._id || p.id}">
          <a class="media" href="products.html?id=${encodeURIComponent(p._id || p.id)}">${img}</a>
          <a class="title" href="products.html?id=${encodeURIComponent(p._id || p.id)}">${p.name}</a>
          <p class="desc">${desc}</p>
          <div class="price">${ui.currency(p.price)}</div>
          <div class="actions">
            <button class="btn buy" data-id="${p._id || p.id}">Buy Now</button>
            ${auth.token ? `<button class=\"btn add\" data-id=\"${p._id || p.id}\">Add to Cart</button>` : ''}
          </div>
        </div>`;
    }).join('');

    // Staggered appearance for product cards (sequential fade/slide in)
    try {
      const cards = Array.from(container.querySelectorAll('.card.product'));
      cards.forEach((card, i) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(8px)';
        card.style.transition = 'opacity .28s ease, transform .28s ease';
        setTimeout(() => {
          card.style.opacity = '1';
          card.style.transform = 'none';
        }, 70 * i);
      });
    } catch (e) { /* no-op */ }

    // Force visibility in case reveal/in observer hasn't fired yet
    try {
      container.classList.add('in');
      container.style.visibility = 'visible';
      if (getComputedStyle(container).display === 'none') {
        container.style.display = 'grid';
      }
    } catch (e) {}

    // Bind actions
    container.querySelectorAll('.actions .buy').forEach(btn => btn.addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.id;
      const url = `checkout.html?mode=single&product=${encodeURIComponent(id)}&qty=1`;
      if (!auth.requireLogin(url)) return;
      location.href = url;
    }));
    container.querySelectorAll('.actions .add').forEach(btn => btn.addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.id;
      if (!auth.requireLogin(`products.html?id=${encodeURIComponent(id)}`)) return;
      cart.add(id, 1);
      ui.toast('Added to cart');
    }));
  },
  async renderDetail(container, id) {
    try {
      const p = await api.get(`/products/${id}`);
      const imgSrc = p.image || (p.images && p.images.length && p.images[0]) || '';
      const img = imgSrc
        ? `<img src="${imgSrc}" alt="${p.name}" class="product-image">`
        : `<img src="https://via.placeholder.com/600x400?text=${encodeURIComponent(p.name||'Product')}" alt="${p.name||'Product'}" class="product-image">`;
      container.innerHTML = `
        <div class="product-detail">
          <div class="media">${img}</div>
          <div class="info">
            <h2>${p.name}</h2>
            <div class="price">${ui.currency(p.price)}</div>
            <p>${p.description || ''}</p>
            <div class="qty">
              <button class="minus" aria-label="Decrease">-</button>
              <input type="number" min="1" value="1">
              <button class="plus" aria-label="Increase">+</button>
            </div>
            <div class="actions">
              ${auth.token ? `<button class="btn add">Add to Cart</button>` : ''}
              <button class="btn buy">Buy Now</button>
            </div>
          </div>
        </div>`;
      // Reviews section placeholder
      const reviewsSection = document.createElement('section');
      reviewsSection.className = 'card';
      reviewsSection.innerHTML = `
        <h3 class="section-title">Reviews</h3>
        <div id="reviewsList" class="grid" style="grid-template-columns:1fr;gap:10px"></div>
        ${auth.token ? `
        <form id="reviewForm" class="form" style="margin-top:12px">
          <label>Rating
            <select name="rating" required>
              <option value="5">5</option>
              <option value="4">4</option>
              <option value="3">3</option>
              <option value="2">2</option>
              <option value="1">1</option>
            </select>
          </label>
          <label>Comment
            <textarea name="comment" placeholder="Share your thoughts" required></textarea>
          </label>
          <button type="submit" class="btn">Submit Review</button>
        </form>` : `<div class="muted" style="margin-top:8px">Login to write a review</div>`}
      `;
      container.appendChild(reviewsSection);
      const qtyInput = container.querySelector('.qty input');
      container.querySelector('.qty .minus').onclick = ()=> qtyInput.value = Math.max(1, (+qtyInput.value||1)-1);
      container.querySelector('.qty .plus').onclick = ()=> qtyInput.value = (+qtyInput.value||1)+1;
      const addBtn = container.querySelector('.actions .add');
      if (addBtn) {
        addBtn.onclick = ()=> {
          if (!auth.requireLogin(`products.html?id=${encodeURIComponent(id)}`)) return;
          cart.add(id, +qtyInput.value||1); ui.toast('Added to cart');
        };
      }
      container.querySelector('.actions .buy').onclick = ()=> {
        const qty = +qtyInput.value||1;
        const url = `checkout.html?mode=single&product=${encodeURIComponent(id)}&qty=${qty}`;
        if (!auth.requireLogin(url)) return;
        location.href = url;
      };
      // Load and render reviews
      const reviewsList = container.querySelector('#reviewsList');
      async function loadReviews() {
        try {
          const list = await api.get(`/reviews/${id}`);
          if (!list || !list.length) {
            reviewsList.innerHTML = '<div class="muted">No reviews yet</div>';
            return;
          }
          reviewsList.innerHTML = list.map(r => `
            <div class="card">
              <div><strong>${r.user?.name || 'User'}</strong> · <span class="muted">${new Date(r.createdAt||Date.now()).toLocaleDateString('en-EG')}</span></div>
              <div>Rating: ${'★'.repeat(r.rating||0)}${'☆'.repeat(Math.max(0,5-(r.rating||0)))}</div>
              <p>${(r.comment||'').replace(/</g,'&lt;')}</p>
            </div>
          `).join('');
        } catch(e) {
          reviewsList.innerHTML = `<div class="error">Failed to load reviews: ${e.message}</div>`;
        }
      }
      await loadReviews();
      // Check review permission and handle review submission
      const reviewForm = container.querySelector('#reviewForm');
      if (reviewForm) {
        // Determine if the user can review (paid customer check)
        try {
          const perm = await api.get(`/products/${id}/review-permission`);
          const can = !!(perm && (perm.canReview === true));
          if (!can) {
            // Replace form with an eligibility message
            const msg = document.createElement('div');
            msg.className = 'muted';
            msg.style.marginTop = '8px';
            msg.textContent = 'You must purchase and pay for this product before leaving a review.';
            reviewForm.replaceWith(msg);
          }
        } catch (_) {
          // If the permission check fails, keep the form hidden by default for safety
          try { reviewForm.style.display = 'none'; } catch(e) {}
        }
        reviewForm.addEventListener('submit', async (ev)=>{
          ev.preventDefault();
          const data = Object.fromEntries(new FormData(reviewForm).entries());
          const payload = { productId: id, rating: +data.rating || 0, comment: data.comment || '' };
          try {
            await api.post('/reviews', payload);
            ui.toast('Review submitted');
            reviewForm.reset();
            await loadReviews();
          } catch(err) {
            ui.toast(err.message, 'error');
          }
        });
      }
    } catch(e) { container.innerHTML = `<p class="error">Failed to load product: ${e.message}</p>`; }
  }
};

// ---------------- Cart (localStorage, sync on checkout) ----------------
const cart = {
  key: 'cart_items',
  read() { try { return JSON.parse(localStorage.getItem(this.key)) || []; } catch(_) { return []; } },
  write(items) { localStorage.setItem(this.key, JSON.stringify(items)); },
  add(id, qty=1) {
    const items = this.read();
    const i = items.find(x => x.id === id);
    if (i) i.qty += qty; else items.push({ id, qty });
    this.write(items);
  },
  remove(id) { this.write(this.read().filter(x => x.id !== id)); },
  setQty(id, qty) { const items = this.read(); const i = items.find(x=>x.id===id); if (i) i.qty = Math.max(1, qty); this.write(items); },
  clear() { this.write([]); }
};

// ---------------- Swipe helper for mobile ----------------
function enableSwipe(el, onSwipeLeft, onSwipeRight) {
  let x0=null; el.addEventListener('touchstart', e=> x0 = e.changedTouches[0].clientX, {passive:true});
  el.addEventListener('touchend', e=> { if (x0==null) return; const dx = e.changedTouches[0].clientX - x0; if (dx>40) onSwipeRight&&onSwipeRight(); if (dx<-40) onSwipeLeft&&onSwipeLeft(); x0=null; }, {passive:true});
}

// ---------------- Admin dashboard ----------------
const adminApp = ui.qs('#adminApp');
if (adminApp) {
  // Require login and admin
  (async () => {
    let me = await auth.me(); if (!me && auth.user) me = { user: auth.user };
    const u = me?.user;
    if (!u || u.role !== 'admin') { location.href = 'index.html'; return; }

    const content = ui.qs('#adminContent');
    const setActive = (id)=> {
      ui.qsa('#adminSidebar a').forEach(a=> a.classList.toggle('active', a.dataset.section===id));
    };

    const renderTable = (headers, rows) => {
      return `<div class="card table"><table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
    };

    const loadUsers = async () => {
      setActive('users');
      const users = await api.get('/users');
      const rows = (users||[]).map(u=>`<tr>
        <td>${u._id||u.id||''}</td>
        <td>${u.name || [u.firstName,u.lastName].filter(Boolean).join(' ') || ''}</td>
        <td>${u.email||''}</td>
        <td>${u.role||''}</td>
        <td><button class="btn ghost" data-act="role" data-id="${u._id||u.id}">Change Role</button></td>
        <td><button class="btn ghost" data-act="edit" data-id="${u._id||u.id}">Edit</button></td>
        <td><button class="btn danger" data-act="del" data-id="${u._id||u.id}">Delete</button></td>
      </tr>`);
      content.innerHTML = `<h2 class="section-title">Users Management</h2>` + renderTable(['ID','Name','Email','Role','Change Role','Edit','Delete'], rows);
      content.querySelectorAll('button[data-act=del]').forEach(b=> b.onclick = async ()=>{
        const ok = await ui.confirm({ title: 'Delete User', message: 'Delete this user permanently?' });
        if (!ok) return;
        const row = b.closest('tr');
        try {
          await api.delete(`/users/${b.dataset.id}`);
          // Optimistically remove the row without full reload
          if (row) {
            row.style.transition = 'opacity .2s ease';
            row.style.opacity = '0';
            setTimeout(()=> row.remove(), 220);
          }
          ui.toast('Deleted');
        } catch(err) {
          ui.toast(err.message || 'Failed to delete user', 'error');
        }
      });
      content.querySelectorAll('button[data-act=role]').forEach(b=> b.onclick = async ()=>{
        const rowUser = (users||[]).find(x=> (x._id||x.id) == b.dataset.id) || {};
        ui.formDialog({
          title: 'Change Role',
          fields: [{ name: 'role', label: 'Role', type: 'select', required: true, options: ['user','admin'] }],
          values: { role: rowUser.role || 'user' },
          submitText: 'Update',
          onSubmit: async ({ role })=> {
            await api.put(`/users/${b.dataset.id}/role`, { role });
            // Reflect role update immediately in the table
            const row = b.closest('tr');
            if (row) {
              const roleCell = row.children[3];
              if (roleCell) roleCell.textContent = role;
            }
            ui.toast('Updated');
          }
        });
      });
      content.querySelectorAll('button[data-act=edit]').forEach(b=> b.onclick = async ()=>{
        const u = (users||[]).find(x=> (x._id||x.id) == b.dataset.id) || {};
        const name = (u.name||'').trim();
        const [fnGuess, ...restName] = name.split(' ');
        const values = {
          firstName: u.firstName || fnGuess || '',
          lastName: u.lastName || restName.join(' ') || '',
          username: u.username || u.userName || '',
          email: u.email || '',
          phoneNumber: u.phoneNumber || u.phone || '',
          address: u.address || ''
        };
        let dlg;
        dlg = ui.formDialog({
          title: 'Edit User',
          fields: [
            { name: 'firstName', label: 'First Name', type: 'text', required: true },
            { name: 'lastName', label: 'Last Name', type: 'text' },
            { name: 'username', label: 'Username', type: 'text' },
            { name: 'email', label: 'Email', type: 'email', required: true },
            { name: 'phoneNumber', label: 'Phone Number', type: 'text' },
            { name: 'address', label: 'Address', type: 'text' }
          ],
          values,
          submitText: 'Save',
          onSubmit: async (data)=> {
            try {
              // Basic validation beyond required attributes
              const emailVal = (data.email||'').trim();
              if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
                ui.toast('Please enter a valid email address', 'error');
                return;
              }
              const payload = {
                name: `${(data.firstName||'').trim()} ${(data.lastName||'').trim()}`.trim(),
                firstName: (data.firstName||'').trim(),
                lastName: (data.lastName||'').trim(),
                username: (data.username||'').trim(),
                email: emailVal,
                phoneNumber: (data.phoneNumber||'').trim(),
                address: (data.address||'').trim()
              };
              // Persist to backend (backend should upsert missing fields)
              await api.put(`/users/${b.dataset.id}`, payload);
              // Update table row dynamically (Name, Email)
              const row = b.closest('tr');
              if (row) {
                const nameCell = row.children[1];
                const emailCell = row.children[2];
                if (nameCell) nameCell.textContent = payload.name || [payload.firstName, payload.lastName].filter(Boolean).join(' ');
                if (emailCell) emailCell.textContent = payload.email;
              }
              ui.toast('Updated');
              // Close dialog after success
              if (dlg && typeof dlg.close === 'function') dlg.close();
            } catch (err) {
              ui.toast(err.message || 'Failed to update user', 'error');
            }
          }
        });
      });
    };

    const loadProducts = async () => {
      setActive('products');
      const list = await api.get('/products');
      const rows = (list||[]).map(p=>`<tr><td>${p.name}</td><td>${ui.currency(p.price)}</td><td>${p.category?.name||p.category||p.categoryName||''}</td><td>
        <button class="btn ghost" data-act="edit" data-id="${p._id||p.id}">Edit</button>
        <button class="btn danger" data-act="del" data-id="${p._id||p.id}">Delete</button>
      </td></tr>`);
      content.innerHTML = `<div class="toolbar"><button id="addProduct" class="btn">+ Add Product</button></div>` + renderTable(['Name','Price','Category','Actions'], rows);
      ui.qs('#addProduct', content).onclick = async ()=>{
        let cats = [];
        try { cats = await api.get('/categories'); } catch(_) {}
        const catOptions = (cats||[]).map(c=> ({ value: c._id||c.id||c.slug||c.name, label: c.name||c.title||c.slug||c.id }));
        ui.formDialog({
          title: 'Add Product',
          fields: [
            { name: 'name', label: 'Name', type: 'text', placeholder: 'Product name', required: true },
            { name: 'price', label: 'Price', type: 'number', placeholder: '0', required: true, min: 0, step: 0.01 },
            { name: 'category', label: 'Category', type: catOptions.length? 'select':'text', options: catOptions, placeholder: 'Category', required: false },
            { name: 'description', label: 'Description', type: 'textarea', placeholder: 'Short description' },
            { name: 'image', label: 'Image URL', type: 'text', placeholder: 'https://...' }
          ],
          values: {},
          submitText: 'Create',
          onSubmit: async (data)=> {
            const payload = { name: data.name, price: +data.price||0, description: data.description||'', category: data.category||'', images: data.image? [data.image]: [] };
            await api.post('/products', payload); ui.toast('Added'); loadProducts();
          }
        });
      };
      content.querySelectorAll('button[data-act=edit]').forEach(b=> b.onclick = async ()=>{
        const p = (list||[]).find(x=> (x._id||x.id)==b.dataset.id);
        if(!p) return;
        let cats = [];
        try { cats = await api.get('/categories'); } catch(_) {}
        const catOptions = (cats||[]).map(c=> ({ value: c._id||c.id||c.slug||c.name, label: c.name||c.title||c.slug||c.id }));
        ui.formDialog({
          title: 'Edit Product',
          fields: [
            { name: 'name', label: 'Name', type: 'text', required: true },
            { name: 'price', label: 'Price', type: 'number', required: true, min: 0, step: 0.01 },
            { name: 'category', label: 'Category', type: catOptions.length? 'select':'text', options: catOptions },
            { name: 'description', label: 'Description', type: 'textarea' },
            { name: 'image', label: 'Image URL', type: 'text' }
          ],
          values: { name: p.name, price: p.price, category: p.category||p.categoryName||'', description: p.description||'', image: (p.images&&p.images[0])||'' },
          submitText: 'Save Changes',
          onSubmit: async (data)=> {
            await api.put(`/products/${b.dataset.id}`, { name: data.name, price: +data.price||0, description: data.description||'', category: data.category||'', images: data.image? [data.image]: [] });
            ui.toast('Updated'); loadProducts();
          }
        });
      });
      content.querySelectorAll('button[data-act=del]').forEach(b=> b.onclick = async ()=>{
        const ok = await ui.confirm({ title: 'Delete Product', message: 'Delete this product? This action cannot be undone.' });
        if (ok) { await api.delete(`/products/${b.dataset.id}`); ui.toast('Deleted'); loadProducts(); }
      });
    };

    const loadCategories = async () => {
      setActive('categories');
      const list = await api.get('/categories');
      const rows = (list||[]).map(c=>`<tr><td>${c._id||c.id}</td><td>${c.name||c.title}</td><td>
        <button class="btn ghost" data-act="edit" data-id="${c._id||c.id}">Edit</button>
        <button class="btn danger" data-act="del" data-id="${c._id||c.id}">Delete</button>
      </td></tr>`);
      content.innerHTML = `<div class="toolbar"><button id="addCat" class="btn">+ Add Category</button></div>` + renderTable(['ID','Name','Actions'], rows);
      ui.qs('#addCat', content).onclick = async ()=>{
        ui.formDialog({
          title: 'Add Category',
          fields: [{ name: 'name', label: 'Category Name', type: 'text', required: true, placeholder: 'e.g., Laptops' }],
          values: {},
          submitText: 'Create',
          onSubmit: async ({ name })=> { await api.post('/categories', { name }); ui.toast('Added'); loadCategories(); }
        });
      };
      content.querySelectorAll('button[data-act=edit]').forEach(b=> b.onclick = async ()=>{
        const row = b.closest('tr');
        const currentName = row && row.children[1] ? row.children[1].textContent : '';
        ui.formDialog({
          title: 'Edit Category',
          fields: [{ name: 'name', label: 'Category Name', type: 'text', required: true }],
          values: { name: currentName },
          submitText: 'Save',
          onSubmit: async ({ name })=> { await api.put(`/categories/${b.dataset.id}`, { name }); ui.toast('Updated'); loadCategories(); }
        });
      });
      content.querySelectorAll('button[data-act=del]').forEach(b=> b.onclick = async ()=>{
        const ok = await ui.confirm({ title: 'Delete Category', message: 'Delete this category?' });
        if (ok) { await api.delete(`/categories/${b.dataset.id}`); ui.toast('Deleted'); loadCategories(); }
      });
    };

    function showOrderStatusModal(orderId, { rowEl = null, test = false } = {}) {
      const statuses = ['Pending','Processing','Paid','Cancelled'];
      const fields = [{ name: 'status', label: 'Status', type: 'select', required: true, options: statuses }];
      const dlg = ui.formDialog({
        title: 'Update Order Status',
        fields,
        values: { status: 'Pending' },
        submitText: 'Save',
        cancelText: 'Cancel',
        onSubmit: async ({ status }) => {
          if (test) return; // non-destructive during verification
          await api.put(`/orders/${orderId}/status`, { status });
          ui.toast('Order status updated');
          if (rowEl && rowEl.children && rowEl.children[2]) {
            rowEl.children[2].textContent = status;
          }
        }
      });
      if (test) {
        // Auto-close after a short delay in test mode
        setTimeout(() => { try { dlg.close(); } catch(_) {} }, 200);
      }
      return dlg;
    }

    // Shared delete confirmation for orders (supports test mode)
    async function openDeleteConfirm({ all = false, btnEl = null, orderId = null, test = false } = {}) {
      try {
        // Ensure no previous overlays remain
        const existing = document.querySelector('.modal-overlay');
        if (existing) existing.remove();

        const ok = await ui.confirm({
          title: all ? 'Delete All Orders' : 'Delete Order',
          message: all ? 'Are you sure you want to delete all orders?' : 'Are you sure you want to delete this order?',
        });
        if (!ok) return;
        if (test) return; // do not perform destructive action during verification

        if (all) {
          await api.delete('/orders');
          const table = ui.qs('#adminContent table');
          if (table) {
            const tbody = table.querySelector('tbody');
            if (tbody) tbody.innerHTML = '';
          }
          ui.toast('All orders deleted successfully');
        } else if (orderId) {
          await api.delete(`/orders/${orderId}`);
          const row = btnEl ? btnEl.closest('tr') : null;
          if (row) row.remove();
          ui.toast('Order deleted successfully');
        }
      } catch (e) {
        ui.toast(e.message || 'Failed to delete order(s)', 'error');
      }
    }

    const loadOrders = async () => {
      setActive('orders');
      const list = await api.get('/orders');
      const rows = (list||[]).map(o=>{
        const names = (o.items||[]).map(it=> it.product?.name).filter(Boolean);
        const label = names.length ? names.join(', ') : (o._id||o.id);
        return `<tr>
          <td>${label}</td>
          <td>${ui.currency(o.totalAmount||o.total||o.amount||0)}</td>
          <td>${o.status||'Pending'}</td>
          <td>${new Date(o.createdAt||Date.now()).toLocaleString('en-EG')}</td>
          <td><button class=\"btn ghost\" data-act=\"status\" data-id=\"${o._id||o.id}\">Update Status</button></td>
          <td><button class=\"btn danger\" data-act=\"del-order\" data-id=\"${o._id||o.id}\">Delete</button></td>
        </tr>`;
      });
      content.innerHTML = renderTable(['Order','Total','Status','Date','Actions','Delete'], rows) + `
        <div class="admin-actions" style="margin-top:12px;display:flex;justify-content:flex-end">
          <button class="btn delete-all" id="deleteAllOrdersBtn">Delete All Orders</button>
        </div>
        <!-- Pre-rendered hidden modal: Delete All Orders -->
        <div class="modal-overlay" id="deleteAllOrdersModal" aria-hidden="true">
          <div class="modal-dialog sm" role="dialog" aria-modal="true" aria-labelledby="delAllTitle">
            <div class="modal-header">
              <h3 id="delAllTitle">Delete All Orders</h3>
              <button class="modal-close" aria-label="Close">×</button>
            </div>
            <div class="modal-body">
              <p class="muted">Are you sure you want to delete all orders? This action cannot be undone.</p>
            </div>
            <div class="modal-footer">
              <button class="btn ghost" id="delAllCancelBtn">Cancel</button>
              <button class="btn danger" id="delAllConfirmBtn">Confirm</button>
            </div>
          </div>
        </div>`;
      // (Re)bind actions using unified modal helpers
      content.querySelectorAll('button[data-act=status]').forEach(b=> b.onclick = ()=> {
        const row = b.closest('tr');
        showOrderStatusModal(b.dataset.id, { rowEl: row });
      });
      content.querySelectorAll('button[data-act=del-order]').forEach(b=> b.onclick = ()=> openDeleteConfirm({ all: false, btnEl: b, orderId: b.dataset.id }));
      const delAllBtn = content.querySelector('#deleteAllOrdersBtn');
      const delAllModal = content.querySelector('#deleteAllOrdersModal');
      if (delAllBtn && delAllModal) {
        let openerEl = null;
        const getFirstFocusable = () => {
          const dlg = delAllModal.querySelector('.modal-dialog');
          const list = dlg && dlg.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
          return (list && list.length) ? list[0] : delAllModal.querySelector('.modal-close');
        };
        const openDelAll = ()=> {
          openerEl = document.activeElement || delAllBtn;
          delAllModal.classList.remove('closing');
          delAllModal.style.display = 'flex';
          delAllModal.classList.add('open');
          delAllModal.removeAttribute('aria-hidden');
          delAllModal.removeAttribute('inert');
          const toFocus = getFirstFocusable();
          if (toFocus && typeof toFocus.focus === 'function') toFocus.focus();
        };
        const closeDelAll = ()=> {
          // Animate close, then hide and set aria/inert
          delAllModal.classList.remove('open');
          delAllModal.classList.add('closing');
          const onAnimEnd = ()=>{
            delAllModal.classList.remove('closing');
            delAllModal.setAttribute('aria-hidden','true');
            delAllModal.setAttribute('inert','true');
            delAllModal.style.display = 'none';
            // Ensure nothing inside keeps focus
            try { if (document.activeElement && delAllModal.contains(document.activeElement)) delAllModal.blur && delAllModal.blur(); } catch(_) {}
            // Restore focus to opener
            try { if (openerEl && typeof openerEl.focus === 'function') openerEl.focus(); } catch(_) {}
            delAllModal.removeEventListener('animationend', onAnimEnd);
          };
          delAllModal.addEventListener('animationend', onAnimEnd);
          // Fallback: in case no animationend fires
          setTimeout(onAnimEnd, 250);
        };
        const cancelBtn = delAllModal.querySelector('#delAllCancelBtn');
        const closeBtn = delAllModal.querySelector('.modal-close');
        const confirmBtn = delAllModal.querySelector('#delAllConfirmBtn');
        delAllBtn.onclick = openDelAll;
        delAllModal.addEventListener('click', (e)=> { if (e.target === delAllModal) closeDelAll(); });
        if (closeBtn) closeBtn.onclick = closeDelAll;
        if (cancelBtn) cancelBtn.onclick = closeDelAll;
        // Close on Escape
        document.addEventListener('keydown', function onEsc(ev){ if (!delAllModal.hasAttribute('aria-hidden') && ev.key === 'Escape') { closeDelAll(); } });
        if (confirmBtn) confirmBtn.onclick = async ()=> {
          try {
            await api.delete('/orders');
            const table = ui.qs('#adminContent table');
            if (table) {
              const tbody = table.querySelector('tbody');
              if (tbody) tbody.innerHTML = '';
            }
            ui.toast('All orders deleted successfully');
          } catch (e) {
            ui.toast(e.message || 'Failed to delete all orders', 'error');
          } finally {
            closeDelAll();
          }
        };
      }

      // Ensure no auto-open behaviors are present; modals open only on explicit user click
    };

    const loadReviews = async () => {
      setActive('reviews');
      const list = await api.get('/reviews');
      const rows = (list||[]).map(r=>`<tr><td>${r._id||r.id}</td><td>${r.product?.name||''}</td><td>${r.user?.name||''}</td><td>${r.rating||0}</td><td>${r.comment||''}</td><td>
        <button class="btn danger" data-act="del" data-id="${r._id||r.id}">Delete</button>
      </td></tr>`);
      content.innerHTML = renderTable(['ID','Product','User','Rating','Comment','Actions'], rows);
      content.querySelectorAll('button[data-act=del]').forEach(b=> b.onclick = async ()=>{
        const ok = await ui.confirm({ title: 'Delete Review', message: 'Delete this review?' });
        if (ok) { await api.delete(`/reviews/${b.dataset.id}`); ui.toast('Deleted'); loadReviews(); }
      });
    };

    const loadPayments = async () => {
      setActive('payments');
      try {
        const res = await api.get('/admin/payments');
        const list = (res && (res.data || res)) || [];
        const rows = (list||[]).map(u=>`<tr>
          <td>${u.name || u.username || u.email || u.userId}</td>
          <td>${u.totalOrders || 0}</td>
          <td>${ui.currency(u.totalPaid || 0)}</td>
          <td><button class="btn" data-act="view" data-id="${u.userId}">View Details</button></td>
        </tr>`);
        content.innerHTML = `<h2 class="section-title">Payments Management</h2>` + 
          renderTable(['User','Order Count','Total Paid','Action'], rows.length?rows:[`<tr><td colspan="4" class="muted">No data available</td></tr>`]);
        // Bind view details
        content.querySelectorAll('button[data-act=view]').forEach(btn=> btn.onclick = async ()=>{
          const userId = btn.dataset.id;
          try {
            const det = await api.get(`/admin/payments/${userId}`);
            const orders = (det && (det.data || det)) || [];
            const body = document.createElement('div');
            const rows = (orders||[]).map(o=>`<tr>
              <td>${(o.productNames||'').replace(/</g,'&lt;')}</td>
              <td>${ui.currency(o.amount || 0)}</td>
              <td>${o.status || ''}</td>
              <td>${new Date(o.createdAt||Date.now()).toLocaleString('en-EG')}</td>
            </tr>`);
            body.innerHTML = renderTable(
              ['Product Name','Amount','Status','Date'],
              rows.length ? rows : [`<tr><td colspan="4" class="muted">No paid orders</td></tr>`]
            );
            ui.modal({ title: 'User Payment Details', body, submitText: null, cancelText: 'Close' });
          } catch (e) {
            ui.toast(e.message || 'Failed to load details', 'error');
          }
        });
      } catch (e) {
  content.innerHTML = `<div class="card"><p class="error">Failed to load payments management: ${e.message}</p></div>`;
      }
    };

    // Dashboard: KPIs + recent orders
    const loadDashboard = async () => {
      setActive('dashboard');
      try {
        const [users, prods, cats, orders, reviews] = await Promise.all([
          api.get('/users').catch(()=>[]),
          api.get('/products').catch(()=>[]),
          api.get('/categories').catch(()=>[]),
          api.get('/orders').catch(()=>[]),
          api.get('/reviews').catch(()=>[]),
        ]);
        const kpi = (label, value)=> `<div class="card"><div class="muted">${label}</div><div style="font-size:1.4rem;font-weight:800">${value}</div></div>`;
        const kpis = `
          <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px">
            ${kpi('Users', users.length)}
            ${kpi('Products', prods.length)}
            ${kpi('Categories', cats.length)}
            ${kpi('Orders', orders.length)}
            ${kpi('Reviews', reviews.length)}
          </div>`;
        const latest = (orders||[]).slice(0, 8).map(o=>{
          const names = (o.items||[]).map(it=> it.product?.name).filter(Boolean);
          const label = names.length ? names.join(', ') : (o._id||o.id);
          const total = ui.currency(o.totalAmount || o.total || o.amount || 0);
          const status = o.status || 'Pending';
          const date = new Date(o.createdAt||Date.now()).toLocaleString('en-EG');
          return `<tr><td>${label}</td><td>${total}</td><td>${status}</td><td>${date}</td></tr>`;
        });
        content.innerHTML = `
          <h2 class="section-title">Dashboard</h2>
          ${kpis}
          <div style="height:12px"></div>
          ${renderTable(['Order','Total','Status','Date'], latest.length? latest : [`<tr><td colspan="4" class="muted">No recent orders</td></tr>`])}
        `;
      } catch(e) {
        content.innerHTML = `<div class="card"><p class="error">Failed to load dashboard: ${e.message}</p></div>`;
      }
    };

    // Sidebar navigation
    ui.qsa('#adminSidebar a').forEach(a=> a.onclick = (e)=>{ 
      e.preventDefault(); 
      const sec = a.dataset.section; 
      ({dashboard:loadDashboard,users:loadUsers,products:loadProducts,categories:loadCategories,orders:loadOrders,reviews:loadReviews,payments:loadPayments}[sec])(); 
    });
    // Default
    loadDashboard();
  })();
}

// ---------------- Page bootstraps ----------------
document.addEventListener('DOMContentLoaded', async () => {
  // Page enter animation
  document.body.classList.add('page-enter');
  // Intercept internal link navigation for page-leave animation
  document.addEventListener('click', (e)=>{
    const a = e.target.closest('a');
    if (!a) return;
    const href = a.getAttribute('href');
    if (!href || href.startsWith('http') || href.startsWith('#') || a.target === '_blank') return;
    // Same-origin simple navigation
    e.preventDefault();
    document.body.classList.add('page-leave');
    setTimeout(()=> { location.href = href; }, 160);
  });

  // Scroll reveal animations
  const revEls = Array.from(document.querySelectorAll('.reveal'));
  if ('IntersectionObserver' in window && revEls.length) {
    const io = new IntersectionObserver((entries)=>{
      entries.forEach(en=>{ if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { threshold: 0.12 });
    revEls.forEach(el=> io.observe(el));
  } else {
    revEls.forEach(el=> el.classList.add('in'));
  }

  // Header
  renderHeader();
  ensureThemeToggle();

  // Index: categories grid
  const catsGrid = ui.qs('#categoriesGrid');
  if (catsGrid) categories.loadAndRender(catsGrid);

  // Product listing/detail
  const productsGrid = ui.qs('#productsGrid') || ui.qs('#products');
  if (productsGrid) {
    productsGrid.classList.add('in');
    productsGrid.style.opacity = '1';
    productsGrid.style.visibility = 'visible';
    if (getComputedStyle(productsGrid).display === 'none') {
      productsGrid.style.display = 'grid';
    }
  }
  const detailBox = ui.qs('#productDetail');
  if (productsGrid || detailBox) {
    const url = new URL(location.href);
    const id = url.searchParams.get('id');
    const category = url.searchParams.get('category');
    if (id && detailBox) {
      products.renderDetail(detailBox, id);
    } else if (productsGrid) {
      const catTitleEl = ui.qs('#category-title');
      const catParam = category ? decodeURIComponent(category) : '';
      if (catParam && catTitleEl) {
        // Show a friendly title; try to resolve actual category name
        (async () => {
          try {
            const cats = await api.get('/categories');
            const match = (cats||[]).find(c => {
              const key = (c._id || c.id || c.slug || c.name || '').toString();
              return key.toLowerCase() === catParam.toLowerCase();
            });
            catTitleEl.textContent = `${(match?.name || match?.title || catParam)} Products`;
          } catch (_) {
            catTitleEl.textContent = `${catParam} Products`;
          }
        })();
      }
      const items = await products.list(catParam ? { category: catParam } : {});
      const filtered = catParam ? (items || []).filter(p => {
        const c = p.category || p.categoryName || '';
        if (!c) return false;
        const key = typeof c === 'object'
          ? (c._id || c.id || c.slug || c.name || '').toString()
          : c.toString();
        return key.toLowerCase() === catParam.toLowerCase();
      }) : items;
      products.renderList(productsGrid, filtered || []);
    }
  }

  // Login form
  const loginForm = ui.qs('#loginForm');
  if (loginForm) {
    const params = new URLSearchParams(location.search);
    const redirect = params.get('redirect') || 'index.html';
    loginForm.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const data = Object.fromEntries(new FormData(loginForm).entries());
      try {
        const res = await api.post('/auth/login', data);
        auth.token = res.token; auth.user = res.user;
        const isAdmin = (res.user && res.user.role === 'admin');
        const target = (isAdmin && (!params.get('redirect') || redirect === 'index.html')) ? 'admin.html' : redirect;
        location.href = target;
      } catch(err) { ui.toast(err.message, 'error'); }
    });
  }

  // Payment page (payment.html)
  const paymentForm = ui.qs('#paymentForm');
  if (paymentForm) {
    if (!auth.requireLogin(`payment.html${location.search}`)) return;
    // Disable native browser validation in favor of our custom validations
    paymentForm.setAttribute('novalidate', 'true');
    const p = new URLSearchParams(location.search);
    const orderId = p.get('orderId');
    const method = (p.get('method') || '').toLowerCase();
    const meta = ui.qs('#paymentMeta');
    const visaFields = ui.qs('#visaFields');
    const vodafoneFields = ui.qs('#vodafoneFields');
    // Helper: toggle required based on selected method so hidden fields don't block submit
    function applyRequiredByMethod(m){
      const cardNumber = paymentForm.querySelector('input[name=cardNumber]');
      const expiryMonth = paymentForm.querySelector('input[name=expiryMonth]');
      const expiryYear = paymentForm.querySelector('input[name=expiryYear]');
      const cvv = paymentForm.querySelector('input[name=cvv]');
      const vf = paymentForm.querySelector('input[name=vodafoneNumber]');
      const visaReq = (m === 'visa');
      const vfReq = (m === 'vodafone');
      [cardNumber, expiryMonth, expiryYear, cvv].forEach(el=> { if (el) el.required = !!visaReq; });
      if (vf) vf.required = !!vfReq;
    }

    if (!orderId || !method || !['visa','vodafone'].includes(method)) {
      ui.toast('Payment details are incomplete', 'error');
      setTimeout(()=> location.href = 'checkout.html', 800);
      return;
    }

    // Toggle fields per method
    if (method === 'visa') { visaFields.classList.remove('hidden'); vodafoneFields.classList.add('hidden'); }
    else { vodafoneFields.classList.remove('hidden'); visaFields.classList.add('hidden'); }
    applyRequiredByMethod(method);
    if (meta) meta.textContent = `Pay order #${orderId} via ${method==='visa'?'Card / Visa':'Vodafone Cash'}`;

    // Format card number
    const cardInput = paymentForm.querySelector('input[name=cardNumber]');
    if (cardInput) cardInput.addEventListener('input', ()=> {
      let v = cardInput.value.replace(/\D+/g, '').slice(0, 19);
      cardInput.value = v.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
    });

    // Helper to initiate Vodafone OTP then redirect
    async function initiateVodafoneAndRedirect(orderId) {
      try {
        // Read phone explicitly from the Vodafone Cash input
        const phone = String(document.querySelector('[name="vodafoneNumber"]').value || '').trim();
        // Validate phone format before sending
        if (!/^01[0-9]{9}$/.test(phone)) {
          throw new Error('Please enter a valid Egyptian phone number (11 digits starting with 01)');
        }
        // Initiate Vodafone payment (backend sends OTP) with phone included
        const data = await api.post('/payments/initiate', { orderId, method: 'vodafone', phone });
        if (!data || data.success !== true) {
          throw new Error((data && (data.message || data.error)) || 'Failed to initiate payment');
        }
        document.body.classList.add('page-leave');
        setTimeout(()=> { location.href = `otp-confirmation.html?orderId=${encodeURIComponent(orderId)}&method=vodafone`; }, 160);
      } catch (err) {
        ui.toast(err.message || 'Failed to initiate Vodafone Cash payment. Please try again.', 'error');
        console.error('Initiate payment failed:', err);
      }
    }

    // Explicit click handler per requirements
    const completeBtn = ui.qs('#complete-payment-btn');
    if (completeBtn) {
      completeBtn.addEventListener('click', async (ev) => {
        if (method === 'vodafone') {
          ev.preventDefault();
          // Explicitly read the phone using the required selector
          const msisdn = String(document.querySelector('[name="vodafoneNumber"]').value || '').trim();
          if (!/^01[0-9]{9}$/.test(msisdn)) { ui.toast('Invalid Vodafone number', 'error'); return; }
          // Persist msisdn so OTP verify can include it if backend needs it
          sessionStorage.setItem(`vf_number_${orderId}`, msisdn);
          await initiateVodafoneAndRedirect(orderId);
        }
      });
    }

    paymentForm.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const data = Object.fromEntries(new FormData(paymentForm).entries());
      try {
        if (method === 'visa') {
          // Stricter client validations with inline errors
          const numberEl = paymentForm.querySelector('input[name=cardNumber]');
          const mmEl = paymentForm.querySelector('input[name=expiryMonth]');
          const yyEl = paymentForm.querySelector('input[name=expiryYear]');
          const cvvEl = paymentForm.querySelector('input[name=cvv]');

          // Reset custom validity
          [numberEl, mmEl, yyEl, cvvEl].forEach(el => el && el.setCustomValidity(''));

          const num = (data.cardNumber||'').replace(/\D+/g,'');
          const mmStr = String(data.expiryMonth||'');
          const yyStr = String(data.expiryYear||'');
          const cvvStr = String(data.cvv||'');
          let invalid = false;
          if (!/^\d{16}$/.test(num)) { invalid = true; numberEl && numberEl.setCustomValidity('Card number must be exactly 16 digits'); }
          const mm = Number(mmStr);
          if (!/^\d{1,2}$/.test(mmStr) || !(mm>=1 && mm<=12)) { invalid = true; mmEl && mmEl.setCustomValidity('Expiry month must be 1-12'); }
          if (!/^\d{2}$/.test(yyStr)) { invalid = true; yyEl && yyEl.setCustomValidity('Expiry year must be exactly 2 digits'); }
          if (!/^\d{3}$/.test(cvvStr)) { invalid = true; cvvEl && cvvEl.setCustomValidity('CVV must be exactly 3 digits'); }
          if (invalid) { (numberEl && numberEl.reportValidity()) || (mmEl && mmEl.reportValidity()) || (yyEl && yyEl.reportValidity()) || (cvvEl && cvvEl.reportValidity()); return; }

          const btn = paymentForm.querySelector('button[type=submit]');
          ui.setLoading(btn, true);
          // Request an email OTP for Visa
          await api.post('/payments/send-otp', { orderId, method: 'visa' });
          // Persist card details temporarily for OTP verification step
          try {
            sessionStorage.setItem(`visa_card_${orderId}`, JSON.stringify({ cardNumber: data.cardNumber, expiryMonth: data.expiryMonth, expiryYear: data.expiryYear, cvv: data.cvv }));
          } catch(_) {}
          // Redirect to email OTP verification page
          document.body.classList.add('page-leave');
          setTimeout(()=> { location.href = `verify-otp.html?orderId=${encodeURIComponent(orderId)}&method=visa`; }, 200);
        } else {
          // Vodafone: validate number, then initiate and redirect to OTP page
          const msisdn = String(document.querySelector('[name="vodafoneNumber"]').value || '').trim();
          if (!/^01[0-9]{9}$/.test(msisdn)) throw new Error('Invalid Vodafone number');
          sessionStorage.setItem(`vf_number_${orderId}`, msisdn);
          const btn = paymentForm.querySelector('button[type=submit]');
          ui.setLoading(btn, true);
          await initiateVodafoneAndRedirect(orderId);
        }
      } catch(err) {
        ui.toast(err.message || 'Payment failed', 'error');
      } finally {
        const btn = paymentForm.querySelector('button[type=submit]');
        ui.setLoading(btn, false);
      }
    });
  }

  // OTP Confirmation page (otp-confirmation.html)
  const otpPage = ui.qs('#otpPage');
  if (otpPage) {
    if (!auth.requireLogin(`otp-confirmation.html${location.search}`)) return;
    const p = new URLSearchParams(location.search);
    const orderId = p.get('orderId');
    const method = (p.get('method')||'').toLowerCase();
    const errorEl = ui.qs('#otpError');
    const hintEl = ui.qs('#otpHint');
    const timerEl = ui.qs('#otpTimer');
    const confirmBtn = ui.qs('#confirmOtpBtn');
    const resendBtn = ui.qs('#resendOtpBtn');
    const cancelLink = ui.qs('#cancelPayment');
    const inputs = Array.from(document.querySelectorAll('.otp-inputs input.otp'));

    if (!orderId || method !== 'vodafone') {
      ui.toast('Payment info missing. Returning to checkout…', 'error');
      setTimeout(()=> location.href = 'checkout.html', 600);
      return;
    }

    // Input behaviors
    function updateConfirmState(rem) {
      const code = inputs.map(x=>x.value).join('');
      confirmBtn.disabled = (code.length !== 6) || (rem <= 0);
    }
    inputs.forEach((inp, idx)=>{
      inp.addEventListener('input', ()=>{
        inp.value = inp.value.replace(/\D/g,'').slice(0,1);
        if (inp.value && idx < inputs.length-1) inputs[idx+1].focus();
        updateConfirmState(remaining);
      });
      inp.addEventListener('keydown', (e)=>{
        if (e.key === 'Backspace' && !inp.value && idx>0) inputs[idx-1].focus();
      });
    });
    if (inputs[0]) inputs[0].focus();

    // Timer helpers
    function fmt(sec){ const m = String(Math.floor(sec/60)).padStart(2,'0'); const s = String(sec%60).padStart(2,'0'); return `${m}:${s}`; }
    let remaining = 0;
    let iv = null;
    function setTimerFrom(exp){
      remaining = Math.max(0, Math.floor((exp.getTime()-Date.now())/1000));
      timerEl.textContent = `Code expires in ${fmt(remaining)}`;
      if (iv) clearInterval(iv);
      iv = setInterval(()=>{
        remaining = Math.max(0, remaining-1);
        timerEl.textContent = `Code expires in ${fmt(remaining)}`;
        if (remaining === 0) { clearInterval(iv); resendBtn.disabled = false; inputs.forEach(i=> i.disabled = true); updateConfirmState(remaining); }
      }, 1000);
      resendBtn.disabled = true;
      inputs.forEach(i=> { i.disabled = false; i.value=''; });
      if (inputs[0]) inputs[0].focus();
      updateConfirmState(remaining);
    }

    // Start countdown (OTP already sent from payment page)
    setTimerFrom(new Date(Date.now()+5*60*1000));

    // Confirm OTP
    async function verify(code){
      errorEl.textContent = '';
      try {
        // Include vodafoneNumber from session storage for backend validation
        const vodafoneNumber = sessionStorage.getItem(`vf_number_${orderId}`) || '';
        const payload = { orderId, otpCode: code, method: 'vodafone', vodafoneNumber };
        await api.post('/payments/verify-otp', payload);
        cart.clear();
        otpPage.innerHTML = `
          <div class="otp-success" style="text-align:center; padding:20px">
            <div class="checkmark" style="font-size:48px; color:#22c55e">✔</div>
            <h3>Payment Successful</h3>
            <p class="muted">Redirecting to your orders…</p>
          </div>`;
        setTimeout(()=> { location.href = 'payment-success.html'; }, 800);
      } catch (err) {
        errorEl.textContent = err.message || 'Invalid or expired code';
      }
    }

    confirmBtn.addEventListener('click', ()=>{
      const code = inputs.map(x=>x.value).join('');
      if (code.length===6 && remaining>0) verify(code);
    });

    // Resend
    resendBtn.addEventListener('click', async ()=>{
      try {
        resendBtn.disabled = true;
        // Include the previously provided phone number if available
        const phone = sessionStorage.getItem(`vf_number_${orderId}`) || '';
        const rs = await api.post('/payments/resend-otp', { orderId, phone });
        const exp = new Date(rs?.data?.expiresAt || Date.now()+5*60*1000);
        setTimerFrom(exp);
      } catch (e) {
        errorEl.textContent = e.message || 'Failed to resend code';
        resendBtn.disabled = false;
      }
    });

    // Cancel Payment: go back to payment form for this order
    cancelLink.addEventListener('click', (ev)=>{
      ev.preventDefault();
      document.body.classList.add('page-leave');
      setTimeout(()=> { location.href = `payment.html?orderId=${encodeURIComponent(orderId)}&method=vodafone`; }, 160);
    });
  }

  // Register form
  const registerForm = ui.qs('#registerForm');
  if (registerForm) {
    const params = new URLSearchParams(location.search);
    const redirect = params.get('redirect') || 'login.html';
    registerForm.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const data = Object.fromEntries(new FormData(registerForm).entries());
      try {
        const res = await api.post('/auth/register', data);
        if (res && res.success && res.userId) {
          ui.toast('Account created successfully, please log in');
          setTimeout(()=> { location.href = redirect; }, 700);
        } else if (res && res.token) {
          // Backward compatibility
          auth.token = res.token; auth.user = res.user; location.href = 'index.html';
        } else {
          ui.toast('Registration data sent');
        }
      } catch(err) { ui.toast(err.message, 'error'); }
    });
  }

  // Profile page
  const profileBox = ui.qs('#profileBox');
  const ordersList = ui.qs('#ordersList');
  const profileCart = ui.qs('#profileCart');
  if (profileBox) {
    if (!auth.requireLogin('profile.html')) return;
    try {
      let me = await auth.me();
      if (!me && auth.user) me = { user: auth.user };
      const u = me?.user || {};
      // If no user data could be loaded, redirect to login
      if (!u || !Object.keys(u).length) { alert('Please log in'); location.href = 'login.html?redirect=profile.html'; return; }
      // Persist latest user to local storage for header rendering
      try { auth.user = u; } catch(_) {}
      // Derive split name if backend stores full name
      const fullName = (u.name || '').trim();
      const [firstNameGuess, ...restName] = fullName.split(' ');
      const firstName = u.firstName || firstNameGuess || '';
      const lastName = u.lastName || (restName.join(' ').trim()) || '';
      const username = u.username || u.userName || '';
      const email = u.email || '';
      const phone = u.phone || u.phoneNumber || '';
      const address = u.address || '';

      // Render grouped profile form
      profileBox.innerHTML = `
        <form id="profileForm" class="form">
          <div class="card" style="margin-bottom:12px">
            <h3 class="section-title">Personal Information</h3>
            <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px">
              <label>First Name
                <input id="firstName" name="firstName" placeholder="Enter first name" value="${firstName}" required />
              </label>
              <label>Last Name
                <input id="lastName" name="lastName" placeholder="Enter last name" value="${lastName}" />
              </label>
              <label>Username
                <input id="username" name="username" placeholder="Username" value="${username}" readonly />
              </label>
              <label>Email
                <input id="email" type="email" name="email" placeholder="example@mail.com" value="${email}" readonly />
              </label>
            </div>
          </div>

          <div class="card" style="margin-bottom:12px">
            <h3 class="section-title">Contact Information</h3>
            <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px">
              <label>Phone Number
                <input id="phoneNumber" name="phone" placeholder="e.g., 01000000000" value="${phone}" />
              </label>
              <label>Address
                <input id="address" name="address" placeholder="City, street, house number" value="${address}" />
              </label>
            </div>
          </div>

          <div class="card" style="margin-bottom:12px">
            <h3 class="section-title">Security</h3>
            <div class="grid cols-1">
              <label>Password
                <input type="password" value="********" disabled />
              </label>
              <div class="actions" style="display:flex;gap:8px">
                <a href="#" id="changePwdBtn" class="btn">Change Password</a>
              </div>
            </div>
          </div>

          <div class="card" style="display:flex;justify-content:flex-end;gap:8px">
            <button type="submit" id="saveProfileBtn" class="btn">Save Changes</button>
          </div>
        </form>`;

      // Generic auto-fill: map user fields to inputs by name/id
      const formEl = ui.qs('#profileForm');
      if (formEl) {
        const map = new Map(Object.entries(u||{}));
        if (u && u.phoneNumber && !u.phone) map.set('phone', u.phoneNumber);
        if (u && u.userName && !u.username) map.set('username', u.userName);
        ui.qsa('input, select, textarea', formEl).forEach(el => {
          if (el.type === 'password') { el.value = '********'; el.disabled = true; return; }
          const key = el.name || el.id;
          if (!key) return;
          const val = map.has(key) ? map.get(key) : (u ? u[key] : undefined);
          if (val != null && val !== undefined) el.value = val;
        });
      }

      // Password change flow
      const changePwdBtn = ui.qs('#changePwdBtn');
      if (changePwdBtn) changePwdBtn.addEventListener('click', (e)=>{
        e.preventDefault();
        document.body.classList.add('page-leave');
        setTimeout(()=> { location.href = `forgot-password.html?email=${encodeURIComponent(email)}`; }, 160);
      });

      // Save profile
      const form = ui.qs('#profileForm');
      const saveBtn = ui.qs('#saveProfileBtn');
      if (form && saveBtn) {
        form.addEventListener('submit', async (ev)=>{
          ev.preventDefault();
          const data = Object.fromEntries(new FormData(form).entries());
          const payload = {
            name: `${(data.firstName||'').trim()} ${(data.lastName||'').trim()}`.trim(),
            firstName: (data.firstName||'').trim(),
            lastName: (data.lastName||'').trim(),
            username: data.username,
            email: data.email,
            phone: data.phone,
            phoneNumber: data.phone,
            address: data.address
          };
          try {
            ui.setLoading(saveBtn, true);
            try { await api.put('/auth/profile', payload); }
            catch(_) { await api.put('/users/me', payload); }
            auth.user = { ...u, ...payload };
            ui.toast('Account details saved');
          } catch(err) {
            auth.user = { ...u, ...payload };
            ui.toast(err.message || 'Could not save data to server. Saved locally', 'error');
          } finally {
            ui.setLoading(saveBtn, false);
          }
        });
      }
      if (ordersList) {
        try {
          const orders = await api.get(`/orders/mine`);
          ordersList.innerHTML = (orders||[]).map(o => {
            const names = (o.items||[]).map(it => it.product?.name).filter(Boolean);
            const title = names.length ? names.join(', ') : 'Order';
            return `
              <li class="card order">
                <span>${title}</span>
                <span>${ui.currency(o.totalAmount || o.total || o.amount)}</span>
                <span>${new Date(o.createdAt||Date.now()).toLocaleDateString('en-EG')}</span>
              </li>`;
          }).join('') || '<li class="muted">No orders yet</li>';
        } catch(_) { ordersList.innerHTML = '<li class="muted">Could not load your orders</li>'; }
      }
      if (profileCart) {
        const items = cart.read();
        if (!items.length) { profileCart.innerHTML = '<li class="muted">Your cart is empty</li>'; }
        else {
          const details = await Promise.all(items.map(async it => { try { const p = await api.get(`/products/${it.id}`); return { ...it, product: p }; } catch(_) { return { ...it, product: { name: 'Product', price: 0, images: [] } }; } }));
          const total = details.reduce((s,d)=> s + (d.product.price||0)*d.qty, 0);
          profileCart.innerHTML = details.map(d => `<li class="card"><span>${d.product.name}</span><span>x${d.qty}</span><span>${ui.currency((d.product.price||0)*d.qty)}</span></li>`).join('') + `<li class="total">Total: <strong>${ui.currency(total)}</strong></li>`;
        }
      }
    } catch(err) { profileBox.innerHTML = `<p class="error">${err.message}</p>`; }
  }

  // Cart page
  const cartBox = ui.qs('#cartBox');
  if (cartBox) {
    if (!auth.requireLogin('cart.html')) return;
    const renderCart = async () => {
      const items = cart.read();
      const details = await Promise.all(items.map(async it => {
        try { const p = await api.get(`/products/${it.id}`); return { ...it, product: p }; } catch(_) { return { ...it, product: { name: 'Product', price: 0 } }; }
      }));
      let subtotal = 0;
      cartBox.innerHTML = details.map(d => {
        subtotal += (d.product.price || 0) * d.qty;
        const cImgSrc = d.product.image || (d.product.images && d.product.images[0]) || '';
        const img = cImgSrc
          ? `<img src="${cImgSrc}" alt="${d.product.name}" class="product-image"/>`
          : `<img src="https://via.placeholder.com/120x90?text=${encodeURIComponent(d.product.name||'Product')}" alt="${d.product.name||'Product'}" class="product-image"/>`;
        return `
          <div class="cart-item" data-id="${d.id}">
            <div class="media">${img}</div>
            <div class="info">
              <div class="title">${d.product.name}</div>
              <div class="price">${ui.currency(d.product.price)}</div>
              <div class="qty">
                <button class="minus">-</button>
                <input type="number" min="1" value="${d.qty}">
                <button class="plus">+</button>
              </div>
            </div>
            <div class="item-actions">
              <button class="remove" aria-label="Remove">×</button>
              <button class="btn item-checkout" data-id="${d.id}">Checkout</button>
            </div>
          </div>`;
      }).join('') + `
        <div class="summary card">
          <div>Total: <strong>${ui.currency(subtotal)}</strong></div>
          <a class="btn" href="checkout.html">Checkout</a>
        </div>`;

      // interactions
      cartBox.querySelectorAll('.cart-item').forEach(row => {
        const id = row.dataset.id;
        const input = row.querySelector('input');
        row.querySelector('.minus').onclick = ()=> { cart.setQty(id, Math.max(1,(+input.value||1)-1)); renderCart(); };
        row.querySelector('.plus').onclick = ()=> { cart.setQty(id, (+input.value||1)+1); renderCart(); };
        row.querySelector('.remove').onclick = ()=> { row.classList.add('gone'); setTimeout(()=>{ cart.remove(id); renderCart(); }, 200); };
        const perCheckout = row.querySelector('.item-checkout');
        if (perCheckout) {
          perCheckout.onclick = ()=> {
            const qty = +input.value || 1;
            const url = `checkout.html?mode=single&product=${encodeURIComponent(id)}&qty=${qty}`;
            if (!auth.requireLogin(url)) return;
            location.href = url;
          };
        }
        enableSwipe(row, ()=> { row.querySelector('.remove').click(); }, null);
      });
    };
    renderCart();
  }

  // Checkout page
  const checkoutForm = ui.qs('#checkoutForm');
  const orderSummary = ui.qs('#orderSummary');
  if (checkoutForm && orderSummary) {
    if (!auth.requireLogin('checkout.html')) return;
    // Prefill from query (buy-now)
    const params = new URLSearchParams(location.search);
    const mode = (params.get('mode')||'').toLowerCase();
    const pId = params.get('product');
    const pQty = Math.max(1, +(params.get('qty')||1));
    // For single-item checkout, do NOT modify the stored cart; build a transient list
    // For full-cart checkout (default), use the full cart contents

    // Build summary
    const baseItems = (mode === 'single' && pId) ? [{ id: pId, qty: pQty }] : cart.read();
    const details = await Promise.all(baseItems.map(async it => { try { const p = await api.get(`/products/${it.id}`); return { ...it, product: p }; } catch(_) { return { ...it, product: { name: 'Product', price: 0 } }; } }));
    const total = details.reduce((s,d)=> s + (d.product.price||0)*d.qty, 0);
    orderSummary.innerHTML = details.map(d => `<li class="card"><span>${d.product.name}</span><span>x${d.qty}</span><span>${ui.currency(d.product.price*d.qty)}</span></li>`).join('') + `<li class="total">Total: <strong>${ui.currency(total)}</strong></li>`;

    checkoutForm.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const method = checkoutForm.querySelector('input[name=payMethod]:checked')?.value || 'cod';
      try {
        // Submit only the selected scope of items
        const scopeItems = (mode === 'single' && pId) ? [{ id: pId, qty: pQty }] : cart.read();
        const order = await api.post('/orders', { items: scopeItems, method });
        const orderId = order._id || order.id;
        if (!orderId) throw new Error('Order creation failed');
        if (method === 'cod') {
          // On COD, clear either the whole cart (full checkout) or just the single item's quantity
          if (mode === 'single' && pId) {
            const current = cart.read();
            const idx = current.findIndex(it => String(it.id) === String(pId));
            if (idx >= 0) {
              current[idx].qty = Math.max(0, (current[idx].qty||1) - pQty);
              if (current[idx].qty <= 0) current.splice(idx,1);
              cart.write(current);
            }
          } else {
            cart.clear();
          }
          ui.toast('Order confirmed. Pay on delivery');
          setTimeout(()=> location.href = 'profile.html', 600);
        } else {
          // redirect to payment form page
          document.body.classList.add('page-leave');
          setTimeout(()=> { location.href = `payment.html?orderId=${encodeURIComponent(orderId)}&method=${encodeURIComponent(method)}`; }, 160);
        }
      } catch(err) { ui.toast(err.message, 'error'); }
    });
  }

  // Link-based reset flow removed in favor of OTP-based flow

  // ---------------- OTP-based Forgot Password flow ----------------
  // Step 1: Forgot page -> request OTP
  const forgotForm = ui.qs('#forgotForm');
  if (forgotForm) {
    // Prefill and lock email if user is authenticated to bind flow to current user
    const p = new URLSearchParams(location.search);
    const emailParam = p.get('email') || '';
    const emailInput = forgotForm.querySelector('[name=email]');
    const u = auth.user;
    if (emailInput) {
      if (u && u.email) {
        emailInput.value = u.email;
        emailInput.readOnly = true;
        emailInput.setAttribute('aria-readonly','true');
      } else if (emailParam) {
        emailInput.value = emailParam;
      }
    }
    forgotForm.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const data = Object.fromEntries(new FormData(forgotForm).entries());
      const email = String(data.email||'').trim();
      if (!email) { ui.toast('Please enter your email', 'error'); return; }
      const btn = forgotForm.querySelector('button[type=submit]');
      try {
        ui.setLoading(btn, true);
        await api.post('/auth/password/request-otp', { email });
        ui.toast('The code has been sent to your email');
        // Navigate to OTP page with email carried in query
        document.body.classList.add('page-leave');
        setTimeout(()=> { location.href = `verify-otp.html?email=${encodeURIComponent(email)}`; }, 160);
      } catch(err) {
        ui.toast(err.message||'An error occurred', 'error');
      } finally {
        ui.setLoading(btn, false);
      }
    });
  }

  // Step 2: Verify OTP page
  const verifyOtpForm = ui.qs('#verifyOtpForm');
  if (verifyOtpForm) {
    const p = new URLSearchParams(location.search);
    let email = p.get('email') || '';
    const emailInput = verifyOtpForm.querySelector('[name=email]');
    if (emailInput) emailInput.value = email;
    // Enforce email consistency when logged in
    const u2 = auth.user;
    if (u2 && u2.email) {
      if (email && u2.email.toLowerCase() !== email.toLowerCase()) {
        ui.toast('You cannot reset for another user while logged in', 'error');
        document.body.classList.add('page-leave');
        setTimeout(()=> { location.href = `verify-otp.html?email=${encodeURIComponent(u2.email)}`; }, 160);
        return;
      }
      if (!email) {
        email = u2.email;
        if (emailInput) emailInput.value = email;
      }
    }
    const resendBtn = ui.qs('#resendOtpBtn');
    const msgEl = ui.qs('#otpMsg');

    verifyOtpForm.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const data = Object.fromEntries(new FormData(verifyOtpForm).entries());
      const code = String(data.code||'').trim();
      if (!/^[0-9]{6}$/.test(code)) { ui.toast('Invalid code', 'error'); return; }
      const btn = verifyOtpForm.querySelector('button[type=submit]');
      try {
        ui.setLoading(btn, true);
        const res = await api.post('/auth/password/verify-otp', { email, code });
        // Store short-lived reset session token in sessionStorage
        if (res && res.resetToken) sessionStorage.setItem('pwd_reset_token', res.resetToken);
        document.body.classList.add('page-leave');
        setTimeout(()=> { location.href = `set-new-password.html?email=${encodeURIComponent(email)}`; }, 160);
      } catch(err) {
        ui.toast(err.message||'Code verification failed', 'error');
      } finally {
        ui.setLoading(btn, false);
      }
    });

    if (resendBtn) resendBtn.addEventListener('click', async ()=>{
      try {
        resendBtn.disabled = true;
        await api.post('/auth/password/request-otp', { email });
        msgEl && (msgEl.textContent = 'Code resent');
        setTimeout(()=> { resendBtn.disabled = false; }, 30000);
      } catch(err) {
        ui.toast(err.message||'Could not resend the code', 'error');
        resendBtn.disabled = false;
      }
    });
  }

  // Step 3: Set new password page
  const setNewPasswordForm = ui.qs('#setNewPasswordForm');
  if (setNewPasswordForm) {
    const p = new URLSearchParams(location.search);
    let email = p.get('email') || '';
    // Enforce email consistency when logged in (defensive)
    const u3 = auth.user;
    if (u3 && u3.email) {
      if (email && u3.email.toLowerCase() !== email.toLowerCase()) {
        ui.toast('You cannot reset for another user while logged in', 'error');
        document.body.classList.add('page-leave');
        setTimeout(()=> { location.href = `set-new-password.html?email=${encodeURIComponent(u3.email)}`; }, 160);
        return;
      }
      if (!email) { email = u3.email; }
    }
    setNewPasswordForm.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const data = Object.fromEntries(new FormData(setNewPasswordForm).entries());
      const pass = String(data.password||'');
      const confirm = String(data.confirm||'');
      if (pass.length < 6) { ui.toast('Password must be at least 6 characters', 'error'); return; }
      if (pass !== confirm) { ui.toast('Passwords do not match', 'error'); return; }
      const resetToken = sessionStorage.getItem('pwd_reset_token');
      if (!resetToken) { ui.toast('Verification session expired. Please try again.', 'error'); location.href = `forgot-password.html`; return; }
      const btn = setNewPasswordForm.querySelector('button[type=submit]');
      try {
        ui.setLoading(btn, true);
        await api.post('/auth/password/reset-otp', { resetToken, password: pass });
        sessionStorage.removeItem('pwd_reset_token');
        // Clear any existing authenticated session/token
        try { auth.token = null; auth.user = null; } catch(_) {}
        ui.toast('Password changed successfully. Please log in again.');
        setTimeout(()=> { location.href = 'login.html'; }, 900);
      } catch(err) {
        ui.toast(err.message||'Could not update the password', 'error');
      } finally {
        ui.setLoading(btn, false);
      }
    });
  }
});

// Rotating hero banner (index.html)
