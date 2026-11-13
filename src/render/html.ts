import { toBase64 } from "../model/base64.ts";
import { fontFaceCss } from "../catalog/fonts.ts";
import { backgroundCss, color, fillCss, num, paint, shadowCss } from "./css.ts";
import { lineHtml, pathHtml } from "./svg-html.ts";
import type { AssetStore, Deck, Element, ImageEl, Paragraph, ShapeEl, Slide, TextEl } from "../model/deck";

export type { AssetStore };

const CSP =
  "default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; font-src data:";
const CSP_STATIC = "default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:";
const SANS_STACK = "'Helvetica Neue', Arial, 'Segoe UI', sans-serif";
const SERIF_STACK = "Georgia, 'Times New Roman', Times, serif";
const MONO_STACK = "Consolas, 'Courier New', monospace";
const MONO_HINT = /mono|courier|consolas/i;
const SERIF_HINT = /georgia|times|garamond|playfair|merriweather|lora|serif(?!.*sans)|baskerville|cambria/i;
const SLIDE_BASE_COLOR = "#ffffff";

const ELEMENT_CSS = `.slide{position:relative;overflow:hidden;background:${SLIDE_BASE_COLOR};font-family:${SANS_STACK}}
.el{position:absolute;box-sizing:border-box}
.in{position:absolute;left:0;top:0;width:100%;height:100%;box-sizing:border-box}
.t{display:flex;flex-direction:column;white-space:pre-wrap;overflow-wrap:break-word}
.t p{margin:0;position:relative}
.t .bl{position:absolute;top:0}
.shape{border-style:solid}
.ln svg,.pa svg{display:block;overflow:visible}
.pa svg{width:100%;height:100%}
.fc{background-size:cover;background-position:center;background-repeat:no-repeat}
.fn{background-size:contain;background-position:center;background-repeat:no-repeat}
.missing{display:flex;align-items:center;justify-content:center;width:100%;height:100%;box-sizing:border-box;border:2px dashed #8a94a3;background:#e8ebf0;color:#5a6778;font:14px ${SANS_STACK};text-align:center}`;

const VIEWER_CSS = `html,body{margin:0;height:100%;overflow:hidden;background:#000}
#stage{position:absolute;left:0;top:0;transform-origin:0 0;overflow:hidden}
#stage .slide{position:absolute;left:0;top:0;visibility:hidden}
#stage .slide.on{visibility:visible;z-index:2}
.h-fade{opacity:0}
.h-slide-up{opacity:0;transform:translateY(40px)}
.h-slide-left{opacity:0;transform:translateX(60px)}
.h-zoom{opacity:0;transform:scale(.6)}
#counter{position:fixed;right:16px;bottom:12px;z-index:10;padding:4px 10px;border-radius:12px;background:rgba(0,0,0,.6);color:#fff;font:14px ${SANS_STACK};opacity:0;transition:opacity .3s;pointer-events:none}
#counter.vis{opacity:1}`;

const VIEWER_JS = `(function(){
var W=+document.getElementById("stage").getAttribute("data-w");
var H=+document.getElementById("stage").getAttribute("data-h");
var STEP=200,DUR=500;
var stage=document.getElementById("stage");
var counter=document.getElementById("counter");
var slides=[].slice.call(document.querySelectorAll(".slide"));
var reduce=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;
var cur=-1,timers=[],transTimer=0,hideTimer=0,swiped=false,startX=0,startY=0;
var ANIM={"none":"none","fade":"fade","slide-up":"slide-up","fade-up":"slide-up","slide-left":"slide-left","zoom":"zoom","zoom-in":"zoom"};
var TRANS={"none":"none","fade":"fade","slide":"slide"};
function lookup(map,key){return Object.prototype.hasOwnProperty.call(map,key)?map[key]:"fade"}
function fit(){
var s=Math.min(window.innerWidth/W,window.innerHeight/H);
stage.style.width=W+"px";
stage.style.height=H+"px";
stage.style.transform="translate("+(window.innerWidth-W*s)/2+"px,"+(window.innerHeight-H*s)/2+"px) scale("+s+")";
}
function clearTimers(){
timers.forEach(function(t){clearTimeout(t)});
timers=[];
}
function resetAnims(sl){
[].slice.call(sl.querySelectorAll(".in[data-p]")).forEach(function(e){
e.classList.remove("h-fade","h-slide-up","h-slide-left","h-zoom");
e.style.transition="none";
});
}
function play(sl){
clearTimers();
resetAnims(sl);
if(reduce)return;
var els=[].slice.call(sl.querySelectorAll(".in[data-p]"));
var orders=[];
els.forEach(function(e){
var o=+e.getAttribute("data-o")||0;
if(orders.indexOf(o)<0)orders.push(o);
});
orders.sort(function(a,b){return a-b});
var items=[];
els.forEach(function(e){
var p=lookup(ANIM,e.getAttribute("data-p"));
if(p==="none")return;
e.classList.add("h-"+p);
items.push({e:e,p:p,at:orders.indexOf(+e.getAttribute("data-o")||0)*STEP+(+e.getAttribute("data-d")||0)});
});
void sl.offsetWidth;
items.forEach(function(it){
timers.push(setTimeout(function(){
it.e.style.transition="opacity "+DUR+"ms ease,transform "+DUR+"ms ease";
it.e.classList.remove("h-"+it.p);
},Math.max(0,it.at)));
});
}
function settle(){
clearTimeout(transTimer);
slides.forEach(function(s,i){
s.style.opacity="";s.style.transform="";s.style.transition="";s.style.zIndex="";
s.classList.toggle("on",i===cur);
});
}
function updateCounter(){
counter.textContent=(cur+1)+" / "+slides.length;
counter.classList.add("vis");
clearTimeout(hideTimer);
hideTimer=setTimeout(function(){counter.classList.remove("vis")},1800);
}
function show(n){
if(n<0||n>=slides.length||n===cur)return;
settle();
var prev=cur>=0?slides[cur]:null;
var next=slides[n];
var kind=lookup(TRANS,next.getAttribute("data-tp"));
var dur=+next.getAttribute("data-td")||0;
cur=n;
try{history.replaceState(null,"","#"+(n+1))}catch(err){}
updateCounter();
if(!prev||reduce||kind==="none"||dur<=0){
settle();
play(next);
return;
}
next.classList.add("on");
next.style.zIndex="3";
prev.style.zIndex="2";
prev.classList.add("on");
if(kind==="slide"){
next.style.transform="translateX("+W+"px)";
}else{
next.style.opacity="0";
}
void next.offsetWidth;
var tr=(kind==="slide"?"transform ":"opacity ")+dur+"ms ease";
next.style.transition=tr;
if(kind==="slide"){
prev.style.transition=tr;
prev.style.transform="translateX("+(-W)+"px)";
next.style.transform="translateX(0)";
}else{
next.style.opacity="1";
}
play(next);
transTimer=setTimeout(settle,dur+30);
}
function next(){show(cur+1)}
function prev(){show(cur-1)}
function toggleFullscreen(){
var d=document;
if(d.fullscreenElement){if(d.exitFullscreen)d.exitFullscreen()}
else if(d.documentElement.requestFullscreen){d.documentElement.requestFullscreen()}
}
document.addEventListener("keydown",function(e){
if(e.ctrlKey||e.altKey||e.metaKey)return;
var k=e.key;
var handled=true;
if(k==="ArrowRight"||k==="ArrowDown"||k===" "||k==="PageDown"||k==="Enter")next();
else if(k==="ArrowLeft"||k==="ArrowUp"||k==="PageUp"||k==="Backspace")prev();
else if(k==="Home")show(0);
else if(k==="End")show(slides.length-1);
else if(k==="f"||k==="F")toggleFullscreen();
else handled=false;
if(handled)e.preventDefault();
});
document.addEventListener("click",function(){
if(swiped){swiped=false;return}
next();
});
document.addEventListener("mousemove",function(){if(cur>=0)updateCounter()});
document.addEventListener("touchstart",function(e){
var t=e.changedTouches[0];
startX=t.clientX;
startY=t.clientY;
swiped=false;
},{passive:true});
document.addEventListener("touchend",function(e){
var t=e.changedTouches[0];
var dx=t.clientX-startX;
var dy=t.clientY-startY;
if(Math.abs(dx)>50&&Math.abs(dx)>Math.abs(dy)){
swiped=true;
if(dx<0)next();else prev();
}
},{passive:true});
window.addEventListener("resize",fit);
fit();
var start=parseInt(window.location.hash.slice(1),10)-1;
show(start>=0&&start<slides.length?start:0);
})();`;

function esc(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface RenderContext {
  assets: AssetStore;
  classes: Map<string, string | null>;
  css: string[];
}

function createContext(assets: AssetStore): RenderContext {
  return { assets, classes: new Map(), css: [] };
}

function assetClass(ctx: RenderContext, assetId: string): string | null {
  const known = ctx.classes.get(assetId);
  if (known !== undefined) return known;
  let asset: { mime: string; data: Uint8Array } | null = null;
  try {
    asset = ctx.assets.get(assetId);
  } catch {
    asset = null;
  }
  let name: string | null = null;
  if (asset && /^image\/[a-z0-9.+-]+$/i.test(asset.mime)) {
    name = `a${ctx.css.length}`;
    ctx.css.push(`.${name}{background-image:url("data:${asset.mime};base64,${toBase64(asset.data)}")}`);
  }
  ctx.classes.set(assetId, name);
  return name;
}

function imageClasses(ctx: RenderContext, assetId: string, fit: unknown): string | null {
  const name = assetClass(ctx, assetId);
  return name ? `${fit === "contain" ? "fn" : "fc"} ${name}` : null;
}

function cleanFont(name: unknown): string {
  return String(name ?? "").replace(/[^A-Za-z0-9 \-]/g, "").trim();
}

function fontStack(name: unknown): string {
  const clean = cleanFont(name);
  const fallback = MONO_HINT.test(clean) ? MONO_STACK : SERIF_HINT.test(clean) ? SERIF_STACK : SANS_STACK;
  return clean ? `'${clean}', ${fallback}` : fallback;
}

function fontCss(slides: Slide[]): string {
  const used = new Set<string>();
  for (const slide of slides) {
    for (const el of slide.elements) if (el.type === "text") used.add(cleanFont(el.fontFamily).toLowerCase());
  }
  const rules: string[] = [];
  for (const name of [...used].sort()) {
    const css = name ? fontFaceCss(name) : null;
    if (css) rules.push(css);
  }
  return rules.join("\n");
}

function rotationCss(rotation: number): string {
  const r = num(rotation);
  return r ? `transform:rotate(${r}deg);` : "";
}

function paragraphHtml(p: Paragraph, fontSize: number, lineHeight: number): string {
  const level = Math.max(0, Math.floor(num(p.level)));
  const indent = level * fontSize * 1.5;
  const pad = indent + (p.bullet ? fontSize * 1 : 0);
  const runs = p.runs
    .map((run) => {
      const styles: string[] = [];
      if (run.bold) styles.push("font-weight:700");
      if (run.italic) styles.push("font-style:italic");
      if (run.color) styles.push(`color:${color(run.color)}`);
      const text = esc(run.text);
      return styles.length ? `<span style="${styles.join(";")}">${text}</span>` : text;
    })
    .join("");
  const bullet = p.bullet ? `<span class="bl" style="left:${num(indent)}px">&bull;</span>` : "";
  const minHeight = num(fontSize * lineHeight);
  return `<p style="padding-left:${num(pad)}px;min-height:${minHeight}px">${bullet}${runs}</p>`;
}

function textHtml(el: TextEl): string {
  const fontSize = num(el.fontSize, 16);
  const lineHeight = num(el.lineHeight, 1.2) || 1.2;
  const justify = el.valign === "middle" ? "center" : el.valign === "bottom" ? "flex-end" : "flex-start";
  const align = el.align === "center" || el.align === "right" ? el.align : "left";
  const style =
    `justify-content:${justify};text-align:${align};font-family:${fontStack(el.fontFamily)};` +
    `font-size:${fontSize}px;line-height:${lineHeight};color:${color(el.color)}${el.shadow ? `;text-shadow:${shadowCss(el.shadow)}` : ""}`;
  return `<div class="in t" style="${style}">${el.paragraphs.map((p) => paragraphHtml(p, fontSize, lineHeight)).join("")}</div>`;
}

function shapeHtml(el: ShapeEl, ctx: RenderContext): string {
  const width = el.stroke ? Math.max(0, num(el.stroke.width)) : 0;
  const half = num(width / 2);
  const geometry = width
    ? `left:-${half}px;top:-${half}px;width:calc(100% + ${width}px);height:calc(100% + ${width}px);border-width:${width}px;border-color:${paint(el.stroke!.color, el.stroke!.alpha)};`
    : "border-width:0;";
  const radius = el.shape === "ellipse" ? "50%" : `${num(num(el.radius) + (width ? half : 0))}px`;
  const imageFill = el.fill && el.fill.kind === "image" ? imageClasses(ctx, el.fill.assetId, el.fill.fit) : null;
  if (el.fill && el.fill.kind === "image" && !imageFill) return missingHtml();
  const background = imageFill ? "" : `background:${fillCss(el.fill)};`;
  const shadow = el.shadow ? `;box-shadow:${shadowCss(el.shadow)}` : "";
  return `<div class="in shape${imageFill ? ` ${imageFill}` : ""}" style="${background}${geometry}border-radius:${radius}${shadow}"></div>`;
}

function missingHtml(): string {
  return `<div class="in missing">Image missing</div>`;
}

function imageHtml(el: ImageEl, ctx: RenderContext): string {
  const classes = imageClasses(ctx, el.assetId, el.fit);
  const shadow = el.shadow ? ` style="filter:drop-shadow(${shadowCss(el.shadow)})"` : "";
  return classes ? `<div class="in im ${classes}"${shadow}></div>` : missingHtml();
}

function elementHtml(el: Element, ctx: RenderContext, animated: boolean): string {
  let inner: string;
  switch (el.type) {
    case "text":
      inner = textHtml(el);
      break;
    case "shape":
      inner = shapeHtml(el, ctx);
      break;
    case "line":
      inner = lineHtml(el);
      break;
    case "image":
      inner = imageHtml(el, ctx);
      break;
    case "path":
      inner = pathHtml(el);
      break;
    default:
      return "";
  }
  if (animated && el.animation) {
    inner = inner.replace(
      /^<div class="in/,
      `<div data-p="${esc(String(el.animation.preset))}" data-o="${num(el.animation.order)}" data-d="${num(el.animation.delayMs)}" class="in`
    );
  }
  const box = `left:${num(el.x)}px;top:${num(el.y)}px;width:${num(el.w)}px;height:${num(el.h)}px;${rotationCss(el.rotation)}`;
  return `<div class="el el-${el.type}" style="${box}">${inner}</div>`;
}

function slideHtml(deck: Deck, slide: Slide, ctx: RenderContext, withTransition: boolean): string {
  const bg = backgroundCss(slide.background, SLIDE_BASE_COLOR);
  const bgImage = slide.background.kind === "image" ? imageClasses(ctx, slide.background.assetId, slide.background.fit) : null;
  const bgMissing = slide.background.kind === "image" && !bgImage ? missingHtml() : "";
  const transition =
    withTransition && slide.transition
      ? ` data-tp="${esc(String(slide.transition.preset))}" data-td="${num(slide.transition.durationMs)}"`
      : "";
  const size = `width:${num(deck.size.w)}px;height:${num(deck.size.h)}px;${bg}`;
  return `<section class="slide${bgImage ? ` ${bgImage}` : ""}"${transition} style="${size}">${bgMissing}${slide.elements.map((el) => elementHtml(el, ctx, withTransition)).join("")}</section>`;
}

export function renderDeckHtml(deck: Deck, assets: AssetStore): string {
  const w = num(deck.size.w);
  const h = num(deck.size.h);
  const print =
    `@media print{@page{size:${w}px ${h}px;margin:0}` +
    `html,body{height:auto;overflow:visible;background:none}` +
    `#stage{position:static;transform:none!important;width:auto!important;height:auto!important;overflow:visible}` +
    `#stage .slide{position:relative;visibility:visible!important;opacity:1!important;transform:none!important;transition:none!important;break-after:page;page-break-after:always}` +
    `#stage .slide:last-child{break-after:auto;page-break-after:auto}` +
    `.in{opacity:1!important;transform:none!important;transition:none!important}` +
    `#counter{display:none}` +
    `*{-webkit-print-color-adjust:exact;print-color-adjust:exact}}`;
  const ctx = createContext(assets);
  const slides = deck.slides.map((s) => slideHtml(deck, s, ctx, true)).join("\n");
  return (
    `<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n` +
    `<meta http-equiv="Content-Security-Policy" content="${CSP}">\n` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">\n` +
    `<title>${esc(deck.title)}</title>\n<style>\n${ELEMENT_CSS}\n${fontCss(deck.slides)}\n${ctx.css.join("\n")}\n${VIEWER_CSS}\n${print}\n</style>\n</head>\n<body>\n` +
    `<div id="stage" data-w="${w}" data-h="${h}">\n${slides}\n</div>\n<div id="counter"></div>\n` +
    `<script>\n${VIEWER_JS}\n</script>\n</body>\n</html>\n`
  );
}

export function renderSlideHtml(deck: Deck, slideIndex: number, assets: AssetStore): string {
  if (!Number.isInteger(slideIndex) || slideIndex < 0 || slideIndex >= deck.slides.length) {
    throw new Error(`Slide index ${slideIndex} is out of range (deck has ${deck.slides.length} slides)`);
  }
  const w = num(deck.size.w);
  const h = num(deck.size.h);
  const slide = deck.slides[slideIndex] as Slide;
  const ctx = createContext(assets);
  const body = slideHtml(deck, slide, ctx, false);
  return (
    `<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n` +
    `<meta http-equiv="Content-Security-Policy" content="${CSP_STATIC}">\n` +
    `<title>${esc(deck.title)}</title>\n<style>\n${ELEMENT_CSS}\n${fontCss([slide])}\n${ctx.css.join("\n")}\n` +
    `html,body{margin:0;padding:0;width:${w}px;height:${h}px;overflow:hidden}\n` +
    `*{-webkit-print-color-adjust:exact;print-color-adjust:exact}\n` +
    `@page{size:${w}px ${h}px;margin:0}\n</style>\n</head>\n<body>\n${body}\n</body>\n</html>\n`
  );
}
