import { escapeHtml as esc } from "./render-site.mjs";

/**
 * The lead form, and the script that submits it.
 *
 * Opt-in per site via `leadForm` in site.json, so a site without a configured
 * recipient cannot render a form that silently drops what people type into it.
 *
 * Posts same-origin to /api/lead. The site identifies itself by slug and the
 * destination is resolved server-side from that — a form that could name its
 * own recipient would be an open relay.
 *
 * Progressive enhancement is deliberate: the markup is a real <form> with a
 * real action, so it still submits without JavaScript. The script only
 * upgrades it to stay on the page.
 *
 * The phone number stays the primary call to action above this. A fencing
 * quote usually starts with a conversation, and the form is for people who
 * are not going to ring at nine at night — not a replacement for the call.
 *
 * `pagePath` is the path of the page the form sits on ("/" for a home page),
 * posted as `page` so a delivered lead can be credited to the page that
 * produced it. The script overwrites it with location.pathname; the value
 * rendered here is what a visitor without JavaScript sends.
 */
export function renderLeadForm(site, slug, pagePath = "/") {
  const cfg = site.leadForm;
  if (!cfg) return "";

  const services = (site.services || []).map((s) => s.title);
  const areas = site.serviceAreas || [site.city];

  return `
    <section class="shell leadform" id="quote">
      <div class="section-heading">
        <p class="eyebrow accent">${esc(cfg.kicker || "Request a quote")}</p>
        <h2>${esc(cfg.heading || "Tell us about the job.")}</h2>
        <p>${esc(cfg.intro || "")}</p>
      </div>
      <form class="lead-form" method="post" action="/api/lead" novalidate>
        <input type="hidden" name="site" value="${esc(slug)}">
        <input type="hidden" name="page" value="${esc(pagePath)}">
        <!-- Honeypot: hidden from people, irresistible to bots. Anything that
             fills it is discarded server-side. -->
        <div class="hp" aria-hidden="true">
          <label>Company<input type="text" name="company" tabindex="-1" autocomplete="off"></label>
        </div>
        <div class="field-row">
          <label>Your name<span class="req">*</span>
            <input type="text" name="name" required autocomplete="name">
          </label>
          <label>Phone<span class="req">*</span>
            <input type="tel" name="phone" required autocomplete="tel" inputmode="tel">
          </label>
        </div>
        <div class="field-row">
          <label>Email <span class="opt">optional</span>
            <input type="email" name="email" autocomplete="email" inputmode="email">
          </label>
          <label>City
            <select name="city">
              <option value="">Choose…</option>
              ${areas.map((a) => `<option value="${esc(a)}">${esc(a)}</option>`).join("")}
            </select>
          </label>
        </div>
        ${services.length ? `
        <label>What do you need?
          <select name="service">
            <option value="">Choose…</option>
            ${services.map((s) => `<option value="${esc(s)}">${esc(s)}</option>`).join("")}
            <option value="Something else">Something else</option>
          </select>
        </label>` : ""}
        <label>Anything useful to know?
          <textarea name="message" rows="4" placeholder="${esc(cfg.placeholder || "Roughly how long a run, what the ground is doing, and when you are hoping to start.")}"></textarea>
        </label>
        <button type="submit" class="button primary">${esc(cfg.submit || "Send request")}</button>
        <p class="form-note" role="status" aria-live="polite"></p>
        <p class="fineprint">${esc(cfg.fineprint || "")}</p>
      </form>
    </section>`;
}

/** Submits without leaving the page, and says plainly when it could not. */
export const LEAD_FORM_SCRIPT = `
(function(){
  var form = document.querySelector('.lead-form');
  if (!form) return;
  var note = form.querySelector('.form-note');
  var button = form.querySelector('button[type=submit]');
  var original = button ? button.textContent : '';

  form.addEventListener('submit', function(e){
    e.preventDefault();
    note.className = 'form-note';
    var page = form.querySelector('input[name=page]');
    if (page) page.value = location.pathname;

    var data = {};
    new FormData(form).forEach(function(v, k){ data[k] = v; });

    if (!String(data.name || '').trim() || !String(data.phone || '').trim()) {
      note.className = 'form-note error';
      note.textContent = 'Please give us a name and a phone number.';
      return;
    }

    button.disabled = true;
    button.textContent = 'Sending…';

    fetch('/api/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(function(res){
      return res.json().catch(function(){ return {}; }).then(function(body){
        return { ok: res.ok, body: body };
      });
    }).then(function(r){
      button.disabled = false;
      button.textContent = original;
      if (r.ok) {
        form.reset();
        note.className = 'form-note ok';
        note.textContent = 'Thanks — we have got that and will be in touch.';
      } else {
        note.className = 'form-note error';
        note.textContent = (r.body && r.body.error) || 'That did not send. Please call us instead.';
      }
    }).catch(function(){
      button.disabled = false;
      button.textContent = original;
      note.className = 'form-note error';
      note.textContent = 'That did not send. Please call us instead.';
    });
  });
})();
`;
