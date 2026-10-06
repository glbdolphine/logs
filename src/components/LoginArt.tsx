import React from 'react';

/*
 * Login artwork. Everything here is built around one vertical axis so the page can sit
 * symmetrically around its own centre line:
 *   - NetworkBackdrop is drawn for the left half and mirrored onto the right half.
 *   - LoginIllustration uses x = 240 (the middle of its 480-wide canvas) as the axis for the
 *     circle, frames, panel, card, speech tail, person, desk and plants; anything that appears
 *     on both sides is defined once and mirrored with <use>.
 */

const MIRROR_1600 = 'translate(1600 0) scale(-1 1)';
const MIRROR_480 = 'translate(480 0) scale(-1 1)';

// Soft network of dots and lines for the page background (left half, mirrored to the right)
export const NetworkBackdrop: React.FC = () => {
  const lines: [number, number, number, number][] = [
    [160, 205, 230, 245], [355, 237, 455, 215], [455, 215, 395, 262],
    [583, 155, 612, 250], [205, 670, 140, 755], [340, 727, 325, 790],
    [30, 420, 135, 462], [470, 788, 560, 735],
  ];
  // Nothing is drawn on the centre line itself, so the form never has lines running through it.
  const dots: [number, number][] = [
    [160, 208], [230, 245], [355, 237], [455, 215], [395, 262], [583, 155],
    [612, 250], [140, 755], [340, 727], [135, 462], [472, 788], [560, 735],
  ];

  const half = (
    <>
      {lines.map(([x1, y1, x2, y2], i) => (
        <line key={`l${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#b9e0c3" strokeWidth="1.5" />
      ))}
      {dots.map(([cx, cy], i) => (
        <circle key={`d${i}`} cx={cx} cy={cy} r="4" fill="#a6d7b3" />
      ))}
    </>
  );

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 1600 900"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <g>{half}</g>
      <g transform={MIRROR_1600}>{half}</g>
    </svg>
  );
};

// Login scene: a speech-bubble login card above a desk, flanked by plants
export const LoginIllustration: React.FC = () => {
  const ink = '#26352d';
  const skin = '#f1d6c0';
  const font = "'Plus Jakarta Sans', system-ui, sans-serif";

  return (
    <svg viewBox="0 0 480 440" className="block w-full h-auto" aria-hidden="true">
      <defs>
        {/* ---- left-hand pieces, mirrored onto the right with <use> ---- */}
        <g id="pi-frame">
          <rect x="24" y="145" width="78" height="150" fill="none" stroke="#6b7c72" strokeWidth="1.5" />
          <rect x="32" y="155" width="62" height="130" fill="none" stroke="#6b7c72" strokeWidth="1" />
        </g>

        <g id="pi-leaves">
          <g fill="#6fcf86">
            <ellipse cx="100" cy="70" rx="9" ry="16" transform="rotate(-25 100 70)" />
            <ellipse cx="118" cy="52" rx="8" ry="15" transform="rotate(30 118 52)" />
            <ellipse cx="96" cy="110" rx="8" ry="15" transform="rotate(-10 96 110)" />
            <ellipse cx="112" cy="140" rx="9" ry="16" transform="rotate(35 112 140)" />
            <ellipse cx="94" cy="175" rx="8" ry="15" transform="rotate(-30 94 175)" />
            <ellipse cx="108" cy="232" rx="9" ry="16" transform="rotate(30 108 232)" />
            <ellipse cx="128" cy="265" rx="8" ry="15" transform="rotate(-25 128 265)" />
          </g>
          <g fill="#4eb36a">
            <ellipse cx="134" cy="84" rx="6" ry="12" transform="rotate(-20 134 84)" />
            <ellipse cx="126" cy="190" rx="6" ry="12" transform="rotate(25 126 190)" />
          </g>
        </g>

        <g id="pi-clouds" fill="#ffffff">
          <ellipse cx="160" cy="58" rx="34" ry="10" />
          <ellipse cx="178" cy="48" rx="20" ry="11" />
          <ellipse cx="144" cy="50" rx="14" ry="9" />
          <ellipse cx="116" cy="208" rx="20" ry="7" />
          <ellipse cx="127" cy="201" rx="12" ry="8" />
        </g>

        {/* ---- a plant drawn around x = 0, placed with translate() ---- */}
        <g id="pi-plant">
          <g stroke={ink} strokeWidth="2" fill="none">
            <path d="M0 390 L0 330" />
            <path d="M-5 390 C-7 362 -13 346 -18 332" />
            <path d="M5 390 C7 362 13 346 18 332" />
          </g>
          <g fill={ink}>
            <ellipse cx="0" cy="330" rx="4" ry="8" />
            <ellipse cx="-18" cy="332" rx="4" ry="8" transform="rotate(-20 -18 332)" />
            <ellipse cx="18" cy="332" rx="4" ry="8" transform="rotate(20 18 332)" />
            <ellipse cx="-10" cy="350" rx="3.5" ry="7" transform="rotate(-35 -10 350)" />
            <ellipse cx="10" cy="350" rx="3.5" ry="7" transform="rotate(35 10 350)" />
          </g>
          <rect x="-13" y="390" width="26" height="30" fill={ink} />
        </g>
      </defs>

      {/* soft circle: spans the full height of the scene, from panel top to ground line */}
      <circle cx="240" cy="220" r="200" fill="#dcf4e3" />

      {/* side frames */}
      <use href="#pi-frame" />
      <use href="#pi-frame" transform={MIRROR_480} />

      {/* main panel: drop shadow straight down so both sides match */}
      <rect x="75" y="28" width="330" height="280" rx="8" fill={ink} />
      <rect x="75" y="20" width="330" height="280" rx="8" fill="#9be3a8" />

      {/* leaves and clouds, left then mirrored */}
      <use href="#pi-leaves" />
      <use href="#pi-leaves" transform={MIRROR_480} />
      <use href="#pi-clouds" />
      <use href="#pi-clouds" transform={MIRROR_480} />

      {/* speech tail, centred under the panel */}
      <path d="M222 300 L240 326 L258 300 Z" fill={ink} />

      {/* login card: 190 wide, 42 clear of the panel's top and bottom edges */}
      <rect x="145" y="96" width="190" height="162" rx="8" fill="#ffffff" stroke={ink} strokeWidth="2.5" />
      <circle cx="240" cy="92" r="30" fill="#ffffff" stroke={ink} strokeWidth="2.5" />
      <circle cx="240" cy="84" r="10" fill={ink} />
      <path d="M220 112 C220 99 260 99 260 112 Z" fill={ink} />
      <text x="240" y="152" textAnchor="middle" fontSize="17" fontWeight="500" fill={ink} style={{ fontFamily: font, letterSpacing: '0.5px' }}>
        LOGIN
      </text>
      <rect x="175" y="166" width="130" height="18" fill="#ffffff" stroke={ink} strokeWidth="1.5" />
      <rect x="175" y="194" width="130" height="18" fill="#ffffff" stroke={ink} strokeWidth="1.5" />
      <text x="240" y="178.5" textAnchor="middle" fontSize="7" fill="#9aa59e" style={{ fontFamily: font }}>USERNAME</text>
      <text x="240" y="206.5" textAnchor="middle" fontSize="7" fill="#9aa59e" style={{ fontFamily: font }}>PASSWORD</text>
      <rect x="175" y="224" width="130" height="18" rx="2" fill="#2f8f3a" />

      {/* ground line */}
      <line x1="10" y1="420" x2="470" y2="420" stroke={ink} strokeWidth="2" />

      {/* plants, equally far either side of the axis */}
      <use href="#pi-plant" transform="translate(112 0)" />
      <use href="#pi-plant" transform="translate(368 0)" />

      {/* desk */}
      <rect x="155" y="388" width="170" height="32" fill="#ffffff" stroke={ink} strokeWidth="2" />
      <rect x="146" y="380" width="188" height="9" fill="#ffffff" stroke={ink} strokeWidth="2" />

      {/* person at the desk, seen from behind and centred on the axis */}
      <rect x="198" y="358" width="84" height="62" rx="14" fill="#6b7c72" />
      <path d="M204 420 L204 394 C204 380 218 372 240 372 C262 372 276 380 276 394 L276 420 Z" fill="#aeb2b0" stroke={ink} strokeWidth="2" />
      <rect x="232" y="362" width="16" height="14" rx="5" fill={skin} stroke={ink} strokeWidth="2" />
      <circle cx="240" cy="349" r="19" fill={ink} />
      <ellipse cx="220.5" cy="352" rx="3.5" ry="5" fill={skin} stroke={ink} strokeWidth="1.5" />
      <ellipse cx="259.5" cy="352" rx="3.5" ry="5" fill={skin} stroke={ink} strokeWidth="1.5" />
    </svg>
  );
};
