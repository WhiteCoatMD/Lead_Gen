import { escapeHtml as esc, jsonLd } from "./render-site.mjs";

/**
 * Visible FAQs, plus FAQPage markup.
 *
 * On the rich-result question, honestly: Google restricted FAQ rich results in
 * 2023 to government and health sites, so these will almost certainly not
 * render as expanded answers in search. The markup is still valid and costs
 * nothing, and the visible content still earns its place — but nobody should
 * expect a rich result from it, and a plan built on that expectation would be
 * built on something that stopped being true three years ago.
 *
 * The real reason these exist is the caller. On Dallas, exactly one of a
 * thousand recorded queries was question-shaped: towing intent is transactional
 * and urgent. What FAQs do there is answer the thing a person hesitates over
 * before dialling — cost, coverage, whether anyone actually answers at 2am.
 * Price is the clearest case: 11,951 impressions across price-led queries, and
 * no price can be published, so the honest answer is what *decides* the price.
 *
 * Rendered as <details> so the page stays short while the content stays
 * crawlable — the text is in the HTML whether or not anyone expands it.
 */
export function renderFaq(site) {
  const faqs = site.faqs;
  if (!Array.isArray(faqs) || !faqs.length) return "";

  const items = faqs.map((f) => `
      <details class="faq-item">
        <summary>${esc(f.q)}</summary>
        <div class="faq-answer"><p>${esc(f.a)}</p></div>
      </details>`).join("");

  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return `
    <section class="shell faq" id="faq">
      <div class="section-heading">
        <p class="eyebrow accent">${esc(site.faqKicker || "Common questions")}</p>
        <h2>${esc(site.faqHeading || "Questions we get asked.")}</h2>
      </div>
      <div class="faq-list">${items}</div>
      <script type="application/ld+json">${jsonLd(schema)}</script>
    </section>`;
}

export const FAQ_CSS = `
/* FAQ. <details> keeps the page short without hiding the text from a crawler —
   the answer is in the HTML whether or not it is expanded. */
.faq{padding-block:clamp(2.5rem,5vw,4rem)}
.faq-list{max-width:48rem;margin-inline:auto;display:grid;gap:.6rem}
.faq-item{border:1px solid rgba(10,12,14,.14);border-radius:.55rem;background:#fff;overflow:hidden}
.faq-item summary{cursor:pointer;padding:.9rem 1.1rem;font-weight:650;list-style:none;position:relative;padding-right:2.6rem}
.faq-item summary::-webkit-details-marker{display:none}
.faq-item summary::after{content:"+";position:absolute;right:1.1rem;top:50%;transform:translateY(-50%);font-size:1.3rem;line-height:1;color:var(--accent);font-weight:400}
.faq-item[open] summary::after{content:"\\2013"}
.faq-item summary:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}
.faq-answer{padding:0 1.1rem 1rem;border-top:1px solid rgba(10,12,14,.08)}
.faq-answer p{margin:.8rem 0 0}
`;
