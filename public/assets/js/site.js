/* Shared front-end behavior for every template. No dependencies, no tracking, no third-party calls
   (except Cloudflare Turnstile on production forms that enable it). */
(function () {
  'use strict';

  /* Mobile navigation */
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('site-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!open));
      document.body.classList.toggle('nav-open', !open);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        toggle.setAttribute('aria-expanded', 'false');
        document.body.classList.remove('nav-open');
        toggle.focus();
      }
    });
  }

  /* Before / after comparison sliders */
  document.querySelectorAll('[data-ba]').forEach(function (fig) {
    var range = fig.querySelector('.ba-range');
    fig.classList.add('ba-ready');
    var set = function () { fig.style.setProperty('--pos', range.value + '%'); };
    range.addEventListener('input', set);
    set();
  });

  /* "Open now" indicator, computed in the business's own time zone */
  var DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  var DAYNAME = { sun: 'Sunday', mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday' };
  function fmt(t) {
    var p = t.split(':').map(Number), h = p[0], m = p[1];
    var s = (h % 12 || 12) + (m ? ':' + String(m).padStart(2, '0') : '') + (h >= 12 ? ' PM' : ' AM');
    return s;
  }
  function hoursFor(hours, day) {
    for (var i = 0; i < hours.length; i++) if (hours[i].days.indexOf(day) > -1 && !hours[i].closed) return hours[i];
    return null;
  }
  document.querySelectorAll('[data-open-status]').forEach(function (el) {
    try {
      var cfg = JSON.parse(el.getAttribute('data-open-status'));
      var parts = new Intl.DateTimeFormat('en-US', { timeZone: cfg.tz, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
      var get = function (t) { return parts.filter(function (p) { return p.type === t; })[0].value; };
      var day = get('weekday').toLowerCase().slice(0, 3);
      var now = get('hour') + ':' + get('minute');
      var today = hoursFor(cfg.hours, day);
      var text = el.querySelector('.open-text');
      if (today && now >= today.open && now < today.close) {
        el.classList.add('is-open');
        text.textContent = 'Open now, until ' + fmt(today.close);
      } else {
        el.classList.add('is-closed');
        var idx = DAYS.indexOf(day), next = null, label = '';
        if (today && now < today.open) { next = today; label = 'today'; }
        for (var k = 1; !next && k <= 7; k++) {
          var d = DAYS[(idx + k) % 7], h = hoursFor(cfg.hours, d);
          if (h) { next = h; label = k === 1 ? 'tomorrow' : DAYNAME[d]; }
        }
        text.textContent = next ? 'Closed now. Opens ' + label + ' at ' + fmt(next.open) : 'Closed now';
      }
    } catch (e) { /* leave the static fallback text */ }
  });

  /* Pre-select a service when arriving from a "Get an estimate" link (?service=Name) */
  try {
    var wanted = new URLSearchParams(location.search).get('service');
    if (wanted) {
      document.querySelectorAll('form[data-form] select').forEach(function (sel) {
        for (var i = 0; i < sel.options.length; i++) if (sel.options[i].text === wanted) sel.selectedIndex = i;
      });
    }
  } catch (e) {}

  /* Forms */
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  function labelFor(el) {
    var wrap = el.closest('.field');
    var lab = wrap && (wrap.querySelector('label') || wrap.querySelector('legend'));
    return lab ? lab.firstChild.textContent.trim() : el.name;
  }
  function validateField(el) {
    var v = (el.value || '').trim();
    if (el.required && !v) return 'Enter ' + labelFor(el).toLowerCase() + '.';
    if (!v) return '';
    if (el.type === 'email' && !EMAIL.test(v)) return 'Enter an email address like name@example.com.';
    if (el.type === 'tel' && v.replace(/\D/g, '').length < 10) return 'Enter a 10-digit phone number, or leave it blank.';
    if (el.maxLength > 0 && v.length > el.maxLength) return 'Keep this under ' + el.maxLength + ' characters.';
    if (el.minLength > 0 && v.length < el.minLength) return 'Add a little more detail (at least ' + el.minLength + ' characters).';
    if (el.type === 'number') {
      var n = Number(v);
      if (!isFinite(n) || n < Number(el.min || 0) || (el.max && n > Number(el.max))) return 'Enter a number' + (el.max ? ' between ' + el.min + ' and ' + el.max : '') + '.';
    }
    if (el.pattern && !new RegExp('^(?:' + el.pattern + ')$').test(v)) return 'Check the format of this field.';
    return '';
  }
  function showError(el, msg, form) {
    var holder = el.closest('.field');
    var err = holder && holder.querySelector('.field-error');
    if (!err) return;
    err.textContent = msg;
    err.hidden = !msg;
    holder.classList.toggle('has-error', !!msg);
    form.querySelectorAll('[name="' + el.name + '"]').forEach(function (x) { x.setAttribute('aria-invalid', msg ? 'true' : 'false'); });
  }

  document.querySelectorAll('form[data-form]').forEach(function (form) {
    var summary = form.querySelector('.error-summary');
    var result = form.querySelector('.form-result');
    var button = form.querySelector('button[type="submit"]');

    form.querySelectorAll('input, select, textarea').forEach(function (el) {
      el.addEventListener('blur', function () { if (el.type !== 'radio' && el.type !== 'checkbox' && el.closest('.field')) showError(el, validateField(el), form); });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var problems = [];
      form.querySelectorAll('.field input:not([type=radio]):not([type=checkbox]), .field select, .field textarea').forEach(function (el) {
        var msg = validateField(el);
        showError(el, msg, form);
        if (msg) problems.push({ el: el, msg: msg });
      });
      form.querySelectorAll('fieldset.choice[data-required]').forEach(function (fs) {
        var first = fs.querySelector('input');
        var ok = fs.querySelector('input:checked');
        showError(first, ok ? '' : 'Choose at least one option.', form);
        if (!ok) problems.push({ el: first, msg: fs.querySelector('legend').firstChild.textContent.trim() + ': choose an option.' });
      });
      var list = summary.querySelector('ul');
      list.innerHTML = '';
      if (problems.length) {
        problems.forEach(function (p) {
          var li = document.createElement('li');
          var a = document.createElement('a');
          a.href = '#' + p.el.id;
          a.textContent = p.msg;
          a.addEventListener('click', function (ev) { ev.preventDefault(); p.el.focus(); });
          li.appendChild(a); list.appendChild(li);
        });
        summary.hidden = false; result.hidden = true;
        summary.focus();
        return;
      }
      summary.hidden = true;

      if (form.getAttribute('data-mode') !== 'production') {
        // Demo mode: never transmit anything. Clear the form so test data does not linger.
        form.reset();
        result.className = 'form-result is-demo';
        result.innerHTML = '<p><strong>Demo complete. Nothing was sent.</strong></p><p>Your entries passed validation and were cleared. On the live site, this request would arrive in the owner\'s inbox and you would see a confirmation here.</p>';
        result.hidden = false; result.focus();
        return;
      }

      // Production: only confirm when the server says the inquiry was accepted.
      var data = {};
      new FormData(form).forEach(function (v, k) {
        if (data[k] !== undefined) data[k] = [].concat(data[k], v); else data[k] = v;
      });
      button.disabled = true;
      var original = button.textContent;
      button.textContent = 'Sending...';
      fetch(form.action, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(data) })
        .then(function (r) { return r.json().catch(function () { return { ok: false }; }).then(function (j) { return { status: r.status, body: j }; }); })
        .then(function (res) {
          if (res.body && res.body.ok) {
            form.reset();
            result.className = 'form-result is-ok';
            result.innerHTML = '<p><strong>Request received.</strong></p><p>' + (res.body.message || 'Thanks. We will reply by email soon.') + '</p>';
            if (window.turnstile) try { window.turnstile.reset(); } catch (x) {}
          } else {
            result.className = 'form-result is-error';
            var msg = (res.body && res.body.error) || 'Your request was not sent.';
            result.textContent = '';
            var p1 = document.createElement('p'); p1.innerHTML = '<strong>Not sent.</strong> '; p1.appendChild(document.createTextNode(msg));
            result.appendChild(p1);
            var fallback = form.getAttribute('data-fallback-email');
            if (fallback) { var p2 = document.createElement('p'); p2.textContent = 'You can also email ' + fallback + ' directly.'; result.appendChild(p2); }
          }
        })
        .catch(function () {
          result.className = 'form-result is-error';
          result.innerHTML = '<p><strong>Not sent.</strong> We could not reach the server. Check your connection and try again.</p>';
        })
        .then(function () { button.disabled = false; button.textContent = original; result.hidden = false; result.focus(); });
    });
  });
})();
