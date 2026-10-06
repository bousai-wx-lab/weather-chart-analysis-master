"use strict";
const ChartShare = (() => {
  const maxFragment = 60000, maxBytes = 2000000, maxPoints = 50000;
  const flags = Object.freeze(["showWind","showTrough","showRidge","showJet","showSymbols","showGeography","showTemperature","showTemperature500","showVorticity","showAscent","showPrecipitation","showEquivalent","showWet","showCold700","showCold850","showWarm850","showTrough700","showRidge700"]);
  const opacities = Object.freeze(["geographyOpacity","equivalentOpacity","warmOpacity","coldOpacity"]);
  const invalid = () => { throw Error("共有リンクの内容を確認できません。リンク全体をコピーし直してください。"); };
  const tooLarge = () => { throw Error("手描きの量が多く、共有リンクに収まりません。PNG保存をご利用ください。"); };
  const number = (v, min, max) => typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
  function keys(value, names) {
    if (!value || Array.isArray(value) || typeof value !== "object" || Object.keys(value).length !== names.length || names.some(k => !Object.hasOwn(value,k))) invalid();
  }
  function validate(value) {
    keys(value,["version","chart","drawing","view"]);
    if (value.version !== 1) invalid();
    const c = value.chart, d = value.drawing;
    keys(c,["product","variant","page","source","image","width","height","analysis"]);
    if (![c.product,c.variant].every(v => typeof v === "string" && /^[a-z0-9-]{1,100}$/.test(v)) || !Number.isInteger(c.page) || !number(c.page,1,100) || ![c.source,c.image].every(v => typeof v === "string" && /^[a-f0-9]{64}$/.test(v)) || !(c.analysis === null || (typeof c.analysis === "string" && /^[a-f0-9]{64}$/.test(c.analysis))) || ![c.width,c.height].every(v => Number.isInteger(v) && number(v,200,12288))) invalid();
    keys(d,["history","future",...flags,...opacities,"geographyStyle","overlayTarget","overlays"]);
    if (flags.some(k => typeof d[k] !== "boolean") || opacities.some(k => !number(d[k],0,1)) || typeof d.geographyStyle !== "string" || !/^[a-z-]{1,40}$/.test(d.geographyStyle) || ![300,500].includes(d.overlayTarget)) invalid();
    let points = 0;
    for (const list of [d.history,d.future]) {
      if (!Array.isArray(list) || list.length > 5000) invalid();
      for (const stroke of list) {
        if (stroke?.kind === "clear") { keys(stroke,["kind"]); continue; }
        keys(stroke,["kind","color","width","opacity","points"]);
        if (!["paint","erase"].includes(stroke.kind) || typeof stroke.color !== "string" || !/^#[a-f0-9]{6}$/i.test(stroke.color) || !number(stroke.width,0.001,Math.max(c.width,c.height)*2) || !number(stroke.opacity,0,1) || !Array.isArray(stroke.points) || !stroke.points.length) invalid();
        points += stroke.points.length;
        if (points > maxPoints) tooLarge();
        for (const p of stroke.points) {
          keys(p,["x","y"]);
          if (!number(p.x,0,c.width) || !number(p.y,0,c.height)) invalid();
        }
      }
    }
    if (!Array.isArray(d.overlays) || d.overlays.length > 3) invalid();
    const routes = new Set();
    for (const layer of d.overlays) {
      keys(layer,["id","source_key","source_hpa","analysis_id","target_hpa","source_sha256","image_sha256","observation_time","enabled","opacity","source_product"]);
      const route = `${layer.analysis_id}/${layer.target_hpa}`;
      if (routes.has(route) || !["jet","trough","ridge"].includes(layer.analysis_id) || layer.source_hpa !== (layer.analysis_id === "jet" ? 300 : 500) || layer.target_hpa !== (layer.source_hpa === 300 ? 500 : 300) || layer.source_key !== `${c.product}/${c.variant}/${c.page}` || layer.source_sha256 !== c.source || layer.image_sha256 !== c.image || typeof layer.observation_time !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(layer.observation_time) || layer.id !== `${layer.source_key}|${layer.observation_time}|${layer.analysis_id}|${layer.target_hpa}` || typeof layer.source_product !== "string" || !/^[A-Z0-9-]{1,30}$/.test(layer.source_product) || typeof layer.enabled !== "boolean" || !number(layer.opacity,0,1)) invalid();
      routes.add(route);
    }
    keys(value.view,["fit","zoom","x","y"]);
    if (typeof value.view.fit !== "boolean" || !number(value.view.zoom,.25,4) || !number(value.view.x,0,1) || !number(value.view.y,0,1)) invalid();
    return value;
  }
  function identity(selected) {
    return {product:selected.product.id,variant:selected.variant.id,page:selected.page.number,source:selected.variant.source_sha256,image:selected.page.image_sha256,width:selected.page.width,height:selected.page.height,analysis:selected.variant.analysis_sha256 || null};
  }
  function currentDrawing(drawing) {
    const lastClear = drawing.history.map(stroke => stroke.kind).lastIndexOf("clear");
    return {...drawing,history:drawing.history.slice(lastClear+1),future:[]};
  }
  function bind(value, selected, styles) {
    validate(value);
    const expected = identity(selected);
    if (Object.keys(expected).some(k => value.chart[k] !== expected[k])) throw Error("共有リンクと同じ原図を確認できません。別の天気図には手描きを重ねません。");
    if (!styles.includes(value.drawing.geographyStyle) || value.drawing.overlays.some(layer => selected.variant.features !== "reviewed-aupq35" || layer.source_product !== selected.product.code)) invalid();
    return value;
  }
  async function streamBytes(stream, limit) {
    const reader = stream.getReader(), chunks = [];
    let size = 0;
    try {
      while (true) {
        const {value,done} = await reader.read();
        if (done) break;
        size += value.length;
        if (size > limit) tooLarge();
        chunks.push(value);
      }
    } finally { await reader.cancel().catch(() => {}); }
    const output = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { output.set(chunk,offset); offset += chunk.length; }
    return output;
  }
  function base64(bytes) {
    let binary = "";
    for (let i=0;i<bytes.length;i+=8192) binary += String.fromCharCode(...bytes.subarray(i,i+8192));
    return btoa(binary).replaceAll("+","-").replaceAll("/","_").replace(/=+$/,"");
  }
  async function encode(value) {
    const raw = new TextEncoder().encode(JSON.stringify(validate(value)));
    if (raw.length > maxBytes) tooLarge();
    let bytes = raw, mode = "j";
    if (typeof CompressionStream !== "undefined") {
      const compressed = await streamBytes(new Blob([raw]).stream().pipeThrough(new CompressionStream("deflate")),maxBytes);
      if (compressed.length < raw.length) { bytes = compressed; mode = "d"; }
    }
    const fragment = `#share=1.${mode}.${base64(bytes)}`;
    if (fragment.length > maxFragment) tooLarge();
    return fragment;
  }
  async function decode(fragment) {
    if (!fragment.startsWith("#share=")) return null;
    if (fragment.length > maxFragment) tooLarge();
    const match = /^#share=1\.([jd])\.([A-Za-z0-9_-]+)$/.exec(fragment);
    if (!match) invalid();
    try {
      const encoded = match[2].replaceAll("-","+").replaceAll("_","/");
      let bytes = Uint8Array.from(atob(encoded),c => c.charCodeAt(0));
      if (match[1] === "d") {
        if (typeof DecompressionStream === "undefined") throw Error("このブラウザーは共有リンクの復元に対応していません。新しいブラウザーで開いてください。");
        bytes = await streamBytes(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate")),maxBytes);
      }
      if (bytes.length > maxBytes) tooLarge();
      return validate(JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes)));
    } catch (error) {
      if (error.message.startsWith("共有") || error.message.startsWith("手描き") || error.message.startsWith("このブラウザー")) throw error;
      invalid();
    }
  }
  return {flags,opacities,maxFragment,identity,currentDrawing,validate,bind,encode,decode};
})();
if (typeof module !== "undefined") module.exports = ChartShare;
