/* MeowMemo's original illustrations, drawn as inline SVG.
 * A ginger cat (fur #f4934a, stripes #d96f2c, outline #23213a) and one sticker per situation. */
(function (root) {
  "use strict";
  const O = "#23213a"; // outline
  const FUR = "#f4934a", STRIPE = "#d96f2c", PINK = "#ff8fa3";

  const svg = (vb, body, label) =>
    `<svg viewBox="${vb}" ${label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"'} xmlns="http://www.w3.org/2000/svg">${body}</svg>`;

  // A cat peeking over the top edge of a card, paws resting on it.
  const peek = svg("0 0 128 75", `
    <polygon points="30,32 33,3 56,22" fill="${FUR}" stroke="${O}" stroke-width="2.5" stroke-linejoin="round"/>
    <polygon points="98,32 95,3 72,22" fill="${FUR}" stroke="${O}" stroke-width="2.5" stroke-linejoin="round"/>
    <polygon points="36,24 37,12 47,21" fill="${PINK}"/>
    <polygon points="92,24 91,12 81,21" fill="${PINK}"/>
    <ellipse cx="64" cy="47" rx="40" ry="30" fill="${FUR}" stroke="${O}" stroke-width="2.5"/>
    <path d="M64 18v9M55 20l2 7M73 20l-2 7" stroke="${STRIPE}" stroke-width="3" stroke-linecap="round"/>
    <ellipse cx="49" cy="45" rx="6" ry="7.5" fill="${O}"/><ellipse cx="79" cy="45" rx="6" ry="7.5" fill="${O}"/>
    <circle cx="51" cy="42" r="2" fill="#fff"/><circle cx="81" cy="42" r="2" fill="#fff"/>
    <path d="M60 55h8l-4 4z" fill="${PINK}" stroke="${O}" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M64 59q-4 5-8 2M64 59q4 5 8 2" fill="none" stroke="${O}" stroke-width="2" stroke-linecap="round"/>
    <path d="M38 54h-14M38 58l-13 4M90 54h14M90 58l13 4" stroke="${O}" stroke-width="1.5" stroke-linecap="round"/>
    <ellipse cx="40" cy="70" rx="13" ry="7" fill="${FUR}" stroke="${O}" stroke-width="2.5"/>
    <ellipse cx="88" cy="70" rx="13" ry="7" fill="${FUR}" stroke="${O}" stroke-width="2.5"/>
    <path d="M36 66v5M44 66v5M84 66v5M92 66v5" stroke="${O}" stroke-width="1.5" stroke-linecap="round"/>`);

  // A closed journal with a paw print on the cover, for the empty journal.
  const notebook = svg("0 0 120 100", `
    <rect x="26" y="12" width="72" height="80" rx="9" fill="#23213a" opacity=".9"/>
    <rect x="22" y="8" width="72" height="80" rx="9" fill="#e9e5ff" stroke="${O}" stroke-width="2.5"/>
    <path d="M22 17a9 9 0 0 1 9-9h7v80h-7a9 9 0 0 1-9-9z" fill="#8c7cf0" stroke="${O}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M84 8v80" stroke="#ffb627" stroke-width="5"/>
    <g fill="#ffb627" stroke="${O}" stroke-width="2"><ellipse cx="60" cy="56" rx="11" ry="9.5"/><circle cx="47" cy="42" r="4.6"/><circle cx="55" cy="35" r="4.6"/><circle cx="65" cy="35" r="4.6"/><circle cx="73" cy="42" r="4.6"/></g>`);

  // A curled-up sleeping cat (kept for reference; no longer used).
  const sleeping = svg("0 0 200 120", `
    <path d="M176 92c22-6 20-36 2-40" fill="none" stroke="${O}" stroke-width="15" stroke-linecap="round"/>
    <path d="M176 92c22-6 20-36 2-40" fill="none" stroke="${FUR}" stroke-width="10" stroke-linecap="round"/>
    <ellipse cx="112" cy="84" rx="70" ry="30" fill="${FUR}" stroke="${O}" stroke-width="2.5"/>
    <path d="M96 58q4 10 0 22M116 56q4 12 0 26M136 60q4 10 0 20" fill="none" stroke="${STRIPE}" stroke-width="4" stroke-linecap="round"/>
    <polygon points="38,66 38,40 56,54" fill="${FUR}" stroke="${O}" stroke-width="2.5" stroke-linejoin="round"/>
    <polygon points="70,54 80,34 86,60" fill="${FUR}" stroke="${O}" stroke-width="2.5" stroke-linejoin="round"/>
    <circle cx="60" cy="80" r="28" fill="${FUR}" stroke="${O}" stroke-width="2.5"/>
    <path d="M46 80q5 4 10 0M66 78q5 4 10 0" fill="none" stroke="${O}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M59 88h6l-3 3z" fill="${PINK}"/>
    <path d="M70 108c10 4 26 4 36 0" fill="none" stroke="${O}" stroke-width="2.5" stroke-linecap="round"/>
    <text x="96" y="36" font-family="Bricolage Grotesque, sans-serif" font-weight="800" font-size="20" fill="#8c7cf0">z</text>
    <text x="112" y="20" font-family="Bricolage Grotesque, sans-serif" font-weight="800" font-size="28" fill="#8c7cf0">z</text>`);

  // Happy cat face in a round sticker (a cat was detected).
  const happy = svg("0 0 76 76", `
    <circle cx="38" cy="38" r="35" fill="#d5f2ea" stroke="${O}" stroke-width="2.5"/>
    <polygon points="17,34 20,12 34,24" fill="${FUR}" stroke="${O}" stroke-width="2.2" stroke-linejoin="round"/>
    <polygon points="59,34 56,12 42,24" fill="${FUR}" stroke="${O}" stroke-width="2.2" stroke-linejoin="round"/>
    <ellipse cx="38" cy="42" rx="23" ry="19" fill="${FUR}" stroke="${O}" stroke-width="2.2"/>
    <path d="M28 40q3-4 6 0M42 40q3-4 6 0" fill="none" stroke="${O}" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M35 46h6l-3 3z" fill="${PINK}"/>
    <path d="M38 49q-3 4-6 1M38 49q3 4 6 1" fill="none" stroke="${O}" stroke-width="1.8" stroke-linecap="round"/>`, "Cat face");

  // Puzzled sticker (no cat found).
  const puzzled = svg("0 0 76 76", `
    <circle cx="38" cy="38" r="35" fill="#fce4e9" stroke="${O}" stroke-width="2.5"/>
    <path d="M28 30a10 10 0 1 1 14 9c-3 1.5-4 3.5-4 6v2" fill="none" stroke="${O}" stroke-width="5" stroke-linecap="round"/>
    <circle cx="38" cy="56" r="3.2" fill="${O}"/>`, "Question mark");

  // Situation stickers.
  const food = svg("0 0 64 64", `
    <circle cx="24" cy="25" r="4.5" fill="#b9772f" stroke="${O}" stroke-width="2"/>
    <circle cx="33" cy="21" r="5" fill="#c98b3c" stroke="${O}" stroke-width="2"/>
    <circle cx="41" cy="26" r="4.5" fill="#b9772f" stroke="${O}" stroke-width="2"/>
    <rect x="7" y="29" width="50" height="7" rx="3.5" fill="#ffd36e" stroke="${O}" stroke-width="2.4"/>
    <path d="M10 36h44c0 10-10 17-22 17S10 46 10 36z" fill="#ffb627" stroke="${O}" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M22 44q10 4 20 0" fill="none" stroke="${O}" stroke-width="2" stroke-linecap="round" opacity=".5"/>`);
  const brushing = svg("0 0 64 64", `
    <rect x="8" y="16" width="36" height="14" rx="6" fill="${PINK}" stroke="${O}" stroke-width="2.4"/>
    <rect x="42" y="19" width="15" height="8" rx="4" fill="#ffd0da" stroke="${O}" stroke-width="2.4"/>
    <path d="M13 30v9M19 30v9M25 30v9M31 30v9M37 30v9" stroke="${O}" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M12 51q4-5 8 0t8 0 8 0" fill="none" stroke="${FUR}" stroke-width="3.5" stroke-linecap="round"/>`);
  const isolation = svg("0 0 64 64", `
    <path d="M6 57h52" stroke="${O}" stroke-width="2.4" stroke-linecap="round"/>
    <rect x="17" y="8" width="32" height="49" rx="3" fill="#3b3566" stroke="${O}" stroke-width="2.4"/>
    <polygon points="17,8 31,13 31,61 17,57" fill="#8c7cf0" stroke="${O}" stroke-width="2.4" stroke-linejoin="round"/>
    <circle cx="27.5" cy="36" r="2.2" fill="#ffb627"/>
    <circle cx="40" cy="30" r="2" fill="#ffb627"/><circle cx="45" cy="30" r="2" fill="#ffb627"/>`);
  const other = svg("0 0 64 64", `
    <path d="M14 14h36a8 8 0 0 1 8 8v16a8 8 0 0 1-8 8H30l-12 10 2-10h-6a8 8 0 0 1-8-8V22a8 8 0 0 1 8-8z" fill="#ecebf5" stroke="${O}" stroke-width="2.4" stroke-linejoin="round"/>
    <circle cx="22" cy="30" r="3" fill="${O}"/><circle cx="32" cy="30" r="3" fill="${O}"/><circle cx="42" cy="30" r="3" fill="${O}"/>`);
  const unknown = svg("0 0 64 64", `
    <circle cx="32" cy="32" r="24" fill="#ecebf5" stroke="${O}" stroke-width="2.4"/>
    <path d="M25 26a7 7 0 1 1 10 6.3c-2 1-3 2.6-3 4.7v1" fill="none" stroke="${O}" stroke-width="3.6" stroke-linecap="round"/>
    <circle cx="32" cy="45" r="2.4" fill="${O}"/>`);

  // Faint paw prints, decoration on the add card.
  const paws = svg("0 0 64 64", `
    <g fill="currentColor"><ellipse cx="22" cy="44" rx="9" ry="7.5"/><circle cx="11" cy="32" r="4"/><circle cx="18" cy="25" r="4"/><circle cx="27" cy="25" r="4"/><circle cx="33" cy="32" r="4"/></g>
    <g fill="currentColor" transform="translate(28 -18)"><ellipse cx="22" cy="44" rx="7" ry="6"/><circle cx="13" cy="34.5" r="3.2"/><circle cx="18.5" cy="29" r="3.2"/><circle cx="25.5" cy="29" r="3.2"/><circle cx="30.5" cy="34.5" r="3.2"/></g>`);

  // Doodle stickers.
  const yarn = svg("0 0 64 64", `
    <path d="M44 48c6 4 12 2 14 6" fill="none" stroke="${O}" stroke-width="2.4" stroke-linecap="round"/>
    <circle cx="30" cy="32" r="20" fill="#8c7cf0" stroke="${O}" stroke-width="2.6"/>
    <path d="M14 26c8-4 22-2 32 8M12 34c10-2 22 2 30 12M20 15c4 8 6 22 2 34M30 12c6 10 8 24 6 38" fill="none" stroke="#e9e5ff" stroke-width="2.2" stroke-linecap="round"/>`);
  const fish = svg("0 0 64 64", `
    <path d="M8 32c8-12 26-14 38-4l10-8v24l-10-8C34 46 16 44 8 32z" fill="#3fbfa8" stroke="${O}" stroke-width="2.6" stroke-linejoin="round"/>
    <circle cx="20" cy="30" r="2.6" fill="${O}"/>
    <path d="M30 24c3 4 3 12 0 16" fill="none" stroke="${O}" stroke-width="2" stroke-linecap="round" opacity=".55"/>`);
  const sparkle = svg("0 0 64 64", `
    <path d="M32 6l6 18 18 6-18 6-6 18-6-18-18-6 18-6z" fill="#ffb627" stroke="${O}" stroke-width="2.4" stroke-linejoin="round"/>`);

  // Recording tips.
  const tipClose = svg("0 0 64 64", `
    <rect x="22" y="8" width="22" height="40" rx="5" fill="#e9e5ff" stroke="${O}" stroke-width="2.4"/>
    <circle cx="33" cy="42" r="2" fill="${O}"/>
    <path d="M50 20q5 6 0 12M55 15q9 11 0 22" fill="none" stroke="#8c7cf0" stroke-width="2.6" stroke-linecap="round"/>
    <ellipse cx="18" cy="54" rx="12" ry="5" fill="${FUR}" stroke="${O}" stroke-width="2.2"/>`);
  const tipQuiet = svg("0 0 64 64", `
    <path d="M10 26h10l12-10v32L20 38H10z" fill="#ffd0da" stroke="${O}" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M42 24l14 16M56 24L42 40" stroke="#c23a55" stroke-width="3.2" stroke-linecap="round"/>`);
  const tipTime = svg("0 0 64 64", `
    <rect x="27" y="4" width="10" height="6" rx="2" fill="${O}"/>
    <circle cx="32" cy="36" r="21" fill="#fff0cc" stroke="${O}" stroke-width="2.4"/>
    <path d="M32 36V23" stroke="${O}" stroke-width="3" stroke-linecap="round"/>
    <path d="M32 36l8 6" stroke="#ffb627" stroke-width="3" stroke-linecap="round"/>`);

  /** A default cat avatar: a cat silhouette on one of four sticker colours, picked from the name. */
  function catAvatar(name) {
    const colours = ["#ffb627", "#ff8fa3", "#8c7cf0", "#3fbfa8"];
    let h = 0;
    for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    const bg = colours[h % colours.length];
    return svg("0 0 64 64", `
      <rect width="64" height="64" fill="${bg}"/>
      <path d="M14 58V30l4-16 10 10h8l10-10 4 16v28z" fill="${O}"/>
      <ellipse cx="25" cy="36" rx="3.4" ry="4.2" fill="${bg}"/><ellipse cx="39" cy="36" rx="3.4" ry="4.2" fill="${bg}"/>
      <path d="M30 44h4l-2 2z" fill="${PINK}"/>`);
  }

  const api = { yarn, fish, sparkle, tipClose, tipQuiet, tipTime, catAvatar, peek, sleeping, notebook, happy, puzzled, food, brushing, isolation, other, unknown, paws };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MeowArt = api;
})(typeof self !== "undefined" ? self : this);
