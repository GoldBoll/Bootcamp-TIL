// _posts/*.md 의 front matter(title·subtitle·categories·tags)를 읽어
// 글마다 주제형 썸네일 카드(SVG)를 만들고 image: 를 그 경로로 갈아끼운다.
//
// - 디자인 언어는 기존 assets/img/thumbs/*.svg 를 그대로 따른다
//   (1200x630 · 배경 #1d1e22 · 좌측 액센트 바 · 제목/규칙선/부제 · 하단 도메인)
// - 액센트 색은 카테고리, 우측 모티프는 태그에서 고른다
// - 본문에 실제 이미지가 있어 그걸 썸네일로 쓰는 글(assets/img/posts|til/...)은 건드리지 않는다
//
// 사용: node tools/gen-post-thumbs.mjs [--dry]

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'C:/GitHub/Bootcamp-TIL');
const DRY = process.argv.includes('--dry');
const POSTS = path.join(ROOT, '_posts');
const OUT_DIR = path.join(ROOT, 'assets', 'img', 'thumbs', 'cards');

const BG = '#1d1e22';
const FG = '#f5f6f8';
const SUB = '#9aa3ad';
const FOOT = '#6b7280';
const FONT = "'Segoe UI','Malgun Gothic',sans-serif";

// 카테고리 → 액센트 (기존 공용 썸네일에서 쓰던 색 그대로)
const ACCENT = {
  '백준': '#00B8A9',
  '프로그래머스': '#4A90E2',
  'LeetCode': '#FFA116',
  '알고리즘': '#4A90E2',
  'CS': '#52B788',
  '자료구조': '#52B788',
  'OS': '#52B788',
  'C++': '#52B788',
  '언리얼': '#8B7CF6',
  '팀프로젝트': '#8B7CF6',
  '회고': '#E5B454'
};

function accentOf(categories) {
  // 두 번째(세부) 카테고리를 먼저 본다 — 알고리즘·백준 → 백준 색
  for (const c of [...categories].reverse()) if (ACCENT[c]) return ACCENT[c];
  return '#E5B454';
}

// 태그 → 모티프. 위에서부터 먼저 맞는 것을 쓴다.
const MOTIF_BY_TAG = [
  ['graph', ['dfs', 'bfs', 'graph', 'backtracking', 'tree']],
  ['grid', ['dp', 'simulation', 'bitmask', 'brute-force']],
  ['bars', ['sort', 'vector', 'two-pointer', 'sliding-window', 'greedy']],
  ['halve', ['binary-search', 'divide-conquer']],
  ['buckets', ['hash', 'map', 'set', 'stl']],
  ['stack', ['stack', 'list', 'queue']],
  ['net', ['network', 'multiplayer', 'replication', 'rpc', 'dedicated-server', 'steam', 'netmode', 'netrole', 'ipc']],
  ['memory', ['pointer', 'reference', 'smart-pointer', 'gc', 'memory', 'raii', 'new', 'malloc']],
  ['threads', ['thread', 'process', 'concurrency', 'context-switching']],
  ['mesh', ['blender', 'skeletal-mesh', 'retargeting', 'accurig', 'tripo', 'asset-import', 'root-motion']],
  ['shader', ['material', 'postprocess', 'texture', 'art-direction', 'optimization']],
  ['motion', ['animation', 'blendspace', 'character-movement']],
  ['window', ['umg']],
  ['flow', ['delegate', 'interface', 'subsystem', 'gameplay-framework', 'design-pattern', 'component', 'gas', 'timer', 'gamemode', 'playerstate']],
  ['bug', ['debugging', '트러블슈팅']],
  ['math', ['math', 'modular', 'fibonacci', 'string']],
  ['branch', ['git']],
  ['cube', ['ue5', 'cpp', 'unity', 'unity2d', 'unity3d', 'gamedev', 'packaging', 'python', 'reflection', 'uobject', 'uclass', 'ustruct']]
];

function motifOf(tags, categories) {
  const t = tags.map((x) => x.toLowerCase());
  for (const [motif, keys] of MOTIF_BY_TAG) if (keys.some((k) => t.includes(k))) return motif;
  if (categories.includes('언리얼')) return 'cube';
  if (categories.includes('CS')) return 'buckets';
  if (categories.includes('알고리즘')) return 'grid';
  return 'note';
}

// 우측 모티프 — 480x480 상자(x 660..1140, y 90..570) 안에 그린다.
function motifSvg(kind, accent) {
  const o = 0.13; // 배경 장식이므로 본문 대비를 해치지 않는 투명도
  const g = (body) => `  <g opacity="${o}" stroke="${accent}" fill="none" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">\n${body}\n  </g>`;
  const dot = (x, y, r = 26) => `    <circle cx="${x}" cy="${y}" r="${r}" fill="${accent}" stroke="none"/>`;
  const line = (x1, y1, x2, y2) => `    <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
  const rect = (x, y, w, h, f = 'none') => `    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${f}"/>`;

  switch (kind) {
    case 'graph':
      return g([
        line(760, 200, 900, 160), line(900, 160, 1040, 240), line(760, 200, 840, 350),
        line(840, 350, 1040, 240), line(840, 350, 980, 450),
        dot(760, 200), dot(900, 160), dot(1040, 240), dot(840, 350), dot(980, 450)
      ].join('\n'));
    case 'grid': {
      const cells = [];
      for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
        const fill = (r + c) % 3 === 0 ? accent : 'none';
        cells.push(rect(720 + c * 100, 170 + r * 90, 84, 74, fill));
      }
      return g(cells.join('\n'));
    }
    case 'bars': {
      const hs = [90, 170, 130, 240, 200, 300];
      return g(hs.map((h, i) => rect(720 + i * 72, 470 - h, 52, h, i % 2 ? accent : 'none')).join('\n'));
    }
    case 'halve':
      return g([
        rect(700, 180, 440, 60, accent), rect(700, 270, 220, 60), rect(700, 360, 110, 60, accent),
        line(920, 300, 1000, 300), line(810, 390, 890, 390)
      ].join('\n'));
    case 'buckets':
      return g([
        rect(700, 170, 120, 100), rect(700, 300, 120, 100, accent), rect(700, 430, 120, 100),
        line(820, 220, 960, 220), line(820, 350, 960, 350), line(820, 480, 960, 480),
        dot(1000, 220, 22), dot(1000, 350, 22), dot(1000, 480, 22)
      ].join('\n'));
    case 'stack':
      return g([
        rect(760, 430, 300, 70), rect(760, 340, 300, 70, accent), rect(760, 250, 300, 70),
        line(910, 200, 910, 120), line(910, 120, 880, 155), line(910, 120, 940, 155)
      ].join('\n'));
    case 'net':
      return g([
        rect(830, 130, 160, 90, accent),
        line(870, 220, 760, 380), line(910, 220, 910, 380), line(950, 220, 1060, 380),
        rect(690, 380, 140, 80), rect(840, 380, 140, 80), rect(990, 380, 140, 80)
      ].join('\n'));
    case 'memory':
      return g([
        rect(700, 200, 110, 90), rect(700, 320, 110, 90, accent), rect(700, 440, 110, 90),
        rect(950, 200, 180, 330),
        line(810, 245, 950, 245), line(940, 245, 910, 220), line(940, 245, 910, 270),
        line(810, 365, 950, 365)
      ].join('\n'));
    case 'threads':
      return g([
        line(700, 190, 1140, 190), line(700, 300, 1140, 300), line(700, 410, 1140, 410),
        rect(780, 160, 120, 60, accent), rect(950, 270, 120, 60, accent), rect(830, 380, 120, 60)
      ].join('\n'));
    case 'mesh':
      return g([
        line(760, 180, 1080, 240), line(1080, 240, 1020, 480), line(1020, 480, 720, 400), line(720, 400, 760, 180),
        line(760, 180, 1020, 480), line(1080, 240, 720, 400),
        dot(760, 180, 16), dot(1080, 240, 16), dot(1020, 480, 16), dot(720, 400, 16)
      ].join('\n'));
    case 'shader':
      return g([
        `    <path d="M700 300 C 780 180, 860 420, 940 300 S 1100 180, 1140 300"/>`,
        `    <path d="M700 400 C 780 280, 860 520, 940 400 S 1100 280, 1140 400"/>`,
        rect(760, 150, 320, 80, accent)
      ].join('\n'));
    case 'motion':
      return g([
        `    <path d="M700 460 C 820 460, 840 200, 960 200 S 1100 380, 1140 300"/>`,
        dot(700, 460, 20), dot(960, 200, 20), dot(1140, 300, 20),
        line(700, 520, 1140, 520)
      ].join('\n'));
    case 'window':
      return g([
        rect(700, 160, 440, 320), line(700, 230, 1140, 230),
        dot(740, 195, 14), dot(790, 195, 14),
        rect(740, 280, 170, 60, accent), rect(740, 370, 340, 40)
      ].join('\n'));
    case 'flow':
      return g([
        rect(690, 260, 150, 110), rect(920, 150, 150, 110, accent), rect(920, 380, 150, 110),
        line(840, 300, 920, 210), line(840, 330, 920, 430)
      ].join('\n'));
    case 'bug':
      return g([
        `    <path d="M920 150 L1090 230 V 400 C 1090 470, 1010 510, 920 540 C 830 510, 750 470, 750 400 V 230 Z"/>`,
        line(830, 340, 900, 410), line(900, 410, 1020, 270)
      ].join('\n'));
    case 'math':
      return g([
        line(760, 190, 1060, 190), line(1060, 190, 880, 330), line(880, 330, 1060, 470), line(1060, 470, 760, 470),
        line(700, 330, 760, 330)
      ].join('\n'));
    case 'branch':
      return g([
        line(760, 150, 760, 520), dot(760, 200), dot(760, 480),
        `    <path d="M760 300 C 760 220, 1020 250, 1020 330"/>`, dot(1020, 360), line(1020, 360, 1020, 430),
        `    <path d="M1020 430 C 1020 500, 780 470, 760 430"/>`
      ].join('\n'));
    case 'cube':
      return g([
        rect(760, 200, 240, 240), rect(860, 140, 240, 240),
        line(760, 200, 860, 140), line(1000, 200, 1100, 140), line(760, 440, 860, 380), line(1000, 440, 1100, 380),
        dot(920, 320, 18)
      ].join('\n'));
    default:
      return g([
        rect(720, 160, 400, 340), line(780, 250, 1060, 250), line(780, 320, 1060, 320), line(780, 390, 980, 390)
      ].join('\n'));
  }
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// 대략적인 글자 폭 — 한글/한자 1.0em, 영문·숫자 0.55em, 공백 0.3em
function width(text, size) {
  let w = 0;
  for (const ch of text) {
    if (ch === ' ') w += 0.3;
    else if (/[\u3000-\u9fff\uac00-\ud7af]/.test(ch)) w += 1.0;
    else w += 0.55;
  }
  return w * size;
}

// 공백 기준으로 자르되, 한 낱말이 한 줄보다 길면 글자 단위로 쪼갠다(공백 없는 한글 제목 대비)
function greedyWrap(text, size, maxWidth) {
  const lines = [];
  let cur = '';
  const push = () => { if (cur) { lines.push(cur); cur = ''; } };

  for (const word of text.split(' ')) {
    let w = word;
    if (width(w, size) > maxWidth) {
      push();
      let chunk = '';
      for (const ch of w) {
        if (width(chunk + ch, size) > maxWidth && chunk) { lines.push(chunk); chunk = ch; }
        else chunk += ch;
      }
      w = chunk;
    }
    const next = cur ? `${cur} ${w}` : w;
    if (width(next, size) > maxWidth && cur) { push(); cur = w; }
    else cur = next;
  }
  push();
  return lines;
}

// 줄 수를 유지하면서 폭을 좁혀 줄 길이를 고르게 만든다 ("언리얼" 한 낱말만 남는 줄 방지)
function balance(text, size, maxWidth, lineCount) {
  let best = greedyWrap(text, size, maxWidth);
  for (let w = maxWidth; w > 200; w -= 20) {
    const cand = greedyWrap(text, size, w);
    if (cand.length !== lineCount) break;
    best = cand;
  }
  return best;
}

function wrap(text, size, maxWidth, maxLines) {
  let lines = greedyWrap(text, size, maxWidth);
  if (lines.length > 1 && lines.length <= maxLines) lines = balance(text, size, maxWidth, lines.length);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = `${kept[maxLines - 1].replace(/[\s·—-]+$/, '')}…`;
    return kept;
  }
  return lines;
}

function clip(text, size, maxWidth) {
  if (width(text, size) <= maxWidth) return text;
  let out = '';
  for (const ch of text) {
    if (width(`${out}${ch}…`, size) > maxWidth) break;
    out += ch;
  }
  return `${out}…`;
}

function card({ title, subtitle, categories, tags }) {
  const accent = accentOf(categories);
  const motif = motifOf(tags, categories);

  // 1~3줄이 되도록 크기를 낮춰 가며 맞춘다
  let size = 84;
  let lines = wrap(title, size, 900, 3);
  if (lines.length > 1) { size = 74; lines = wrap(title, size, 900, 3); }
  if (lines.length > 2) { size = 62; lines = wrap(title, size, 920, 3); }

  // 부제가 없으면 아래 여백이 커지므로 제목 블록을 조금 내려 균형을 맞춘다
  const drop = subtitle ? 0 : 34;
  const top = (lines.length === 1 ? 268 : lines.length === 2 ? 232 : 214) + drop;
  const lh = Math.round(size * 1.3);
  const baselines = lines.map((_, i) => top + i * lh);
  const ruleY = baselines[baselines.length - 1] + 34;
  const subY = ruleY + 66;

  const cat = categories.join(' · ');
  const tagLine = tags.slice(0, 4).map((t) => `#${t}`).join('   ');

  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-label="${esc(title)}">`,
    `  <rect width="1200" height="630" fill="${BG}"/>`,
    `  <rect width="14" height="630" fill="${accent}"/>`,
    motifSvg(motif, accent),
    `  <text x="84" y="118" font-family="${FONT}" font-size="30" font-weight="600" fill="${accent}">${esc(cat)}</text>`,
    ...lines.map((l, i) => `  <text x="84" y="${baselines[i]}" font-family="${FONT}" font-size="${size}" font-weight="700" fill="${FG}">${esc(l)}</text>`),
    `  <rect x="88" y="${ruleY}" width="120" height="8" rx="4" fill="${accent}"/>`
  ];
  if (subtitle) {
    parts.push(`  <text x="84" y="${subY}" font-family="${FONT}" font-size="32" fill="${SUB}">${esc(clip(subtitle, 32, 880))}</text>`);
  }
  if (tagLine) {
    parts.push(`  <text x="84" y="552" font-family="${FONT}" font-size="26" fill="${FOOT}">${esc(tagLine)}</text>`);
  }
  parts.push(`  <text x="84" y="594" font-family="${FONT}" font-size="24" fill="${FOOT}">goldboll.github.io</text>`);
  parts.push('</svg>');
  return `${parts.join('\n')}\n`;
}

function readList(fm, key) {
  const m = fm.match(new RegExp(`^${key}:\\s*\\[(.*)\\]\\s*$`, 'm'));
  if (!m) return [];
  return m[1].split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
}

function readScalar(fm, key) {
  const m = fm.match(new RegExp(`^${key}:\\s*(.*)$`, 'm'));
  if (!m) return '';
  return m[1].trim().replace(/^["']|["']$/g, '').replace(/\s*#.*$/, '').trim();
}

fs.mkdirSync(OUT_DIR, { recursive: true });

let made = 0;
let skipped = 0;
const skippedFiles = [];

for (const file of fs.readdirSync(POSTS).filter((f) => f.endsWith('.md')).sort()) {
  const full = path.join(POSTS, file);
  const raw = fs.readFileSync(full, 'utf8');
  const fmEnd = raw.indexOf('\n---', 4);
  if (!raw.startsWith('---') || fmEnd < 0) continue;
  const fm = raw.slice(3, fmEnd);

  const image = readScalar(fm, 'image');
  // 본문 캡처를 썸네일로 쓰는 글은 그대로 둔다 (공용 썸네일만 교체 대상)
  if (image && !image.startsWith('/assets/img/thumbs/')) {
    skipped++;
    skippedFiles.push(file);
    continue;
  }

  const title = readScalar(fm, 'title');
  if (!title) { skipped++; skippedFiles.push(file); continue; }

  const svg = card({
    title,
    subtitle: readScalar(fm, 'subtitle'),
    categories: readList(fm, 'categories'),
    tags: readList(fm, 'tags')
  });

  const slug = file.replace(/\.md$/, '');
  const outPath = path.join(OUT_DIR, `${slug}.svg`);
  const rel = `/assets/img/thumbs/cards/${slug}.svg`;

  if (!DRY) {
    fs.writeFileSync(outPath, svg, 'utf8');
    const updated = image
      ? raw.replace(/^image:.*$/m, `image: ${rel}`)
      : raw.replace(/^---\r?\n/, `---\nimage: ${rel}\n`);
    fs.writeFileSync(full, updated, 'utf8');
  }
  made++;
}

console.log(`카드 생성: ${made}편 / 건너뜀(본문 이미지 사용·제목 없음): ${skipped}`);
if (skippedFiles.length) console.log(`건너뛴 글:\n  ${skippedFiles.join('\n  ')}`);
