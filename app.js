"use strict";
const byId = (id) => document.getElementById(id);
const chart = byId("chart");
const ink = byId("ink");
const context = ink.getContext("2d");
const paper = byId("paper");
const viewport = byId("viewport");
const strokeLayer = document.createElement("canvas");
const strokeContext = strokeLayer.getContext("2d");
const analysisLayer = byId("analysis-layer");
const analysisContext = analysisLayer.getContext("2d");
const jetLayer = byId("jet-layer");
const jetContext = jetLayer.getContext("2d");
const overlayLayer = byId("overlay-layer");
const overlayContext = overlayLayer.getContext("2d");
let panelRegistration = null;
let overlayError = "";
let overlayTarget = 500;
let overlayState = [];
let overlayView = "picker";
let selectedOverlay = null;
let selectedOverlayAnalysis = "jet";
const windLayer = byId("wind-layer");
const windContext = windLayer.getContext("2d");
const geographyLayer = byId("geography-layer");
const geographyContext = geographyLayer.getContext("2d");
let geography = null, geographyMask = null, geographyBase = null;
let satelliteImage = null;
let elevationData = null;
let terrainImage = null;
let terrainError = "";
const defaultGeographyStyle = "elevation-relief";
let geographyStyle = defaultGeographyStyle;
let geographyOpacity = 0.4;
let showGeography = true;
let geographyError = "";
const symbolLayer = byId("symbol-layer");
const symbolContext = symbolLayer.getContext("2d");
let symbols = null;
let showSymbols = true;
let symbolError = "";
const temperatureLayer = byId("temperature-layer");
const temperatureContext = temperatureLayer.getContext("2d");
let isotherms = null;
let lowLevel = null, dynamics = null, trial = null, localCollection = null;
let showVorticity = true, showAscent = true;
const isFeas = () => dynamics?.product === "FEAS50";
const temperatureScales = () => trial ? SnapshotAnalysis.displayScales(trial) : dynamics ? ChartDynamics.scalesFor(dynamics) : lowLevel ? LowLevelAnalysis.scales : ChartAnalysis.isothermScales;
let showWet = true, showCold700 = false, showCold850 = false, showTrough700 = false, showRidge700 = false;
let coldOpacity = .35, warmOpacity = .35;
let showWarm850 = false;
const isTrialSelection = selected => ["experimental-local","experimental-snapshot"].includes(selected.variant.features);
const isReviewed = selected => ["reviewed-aupq35","reviewed-aupq78","reviewed-axfe578", "reviewed-feas50"].includes(selected.variant.features);
let showTemperature = true;
let showTemperature500 = true;
let temperatureError = "";
let windBands = null;
let showWind = false;
let candidates = null;
let showTrough = false;
let showRidge = false;
let showJet = false;
let analysisError = "";
const history = [];
const future = [];
let mode = "move";
let color = "#2563eb";
let active = null;
let pointer = null;
let pan = null;
let ready = false;
let chartLabel = "AUPQ35";
let exportUrl = null;
let zoomFactor = 1;
let fitView = true;
let catalog = null;
let currentSelection = null;
let loadingError = "";
let featuresLoading = false;
let loadRevision = 0;
let loadController = null;
const drawingStates = new Map();
const zoomSteps = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];
const analysisTools = [
  {id:"vorticity",button:"vorticity",label:"正渦度の色塗り",plane:"500hPa",dynamics:true,setEnabled:on=>{showVorticity=on;}},
  {id:"ascent",button:"ascent",label:"上昇流の色塗り",plane:"700hPa",dynamics:true,setEnabled:on=>{showAscent=on;}},
  {id:"wet",button:"wet",label:"湿域の色塗り",plane:"700/850hPa",lowLevel:true,setEnabled:on=>{showWet=on;}},
  {id:"cold700",button:"cold700",label:"寒気の色塗り",plane:"700hPa",lowLevel:true,setEnabled:on=>{showCold700=on;}},
  {id:"cold850",button:"cold850",label:"寒気の色塗り",plane:"850hPa",lowLevel:true,setEnabled:on=>{showCold850=on;}},
  {id:"warm850",button:"warm850",label:"暖気の色塗り",plane:"850hPa",lowLevel:true,setEnabled:on=>{showWarm850=on;}},
  {id:"trough700",button:"trough700",label:"トラフ",plane:"700hPa",lowLevel:true,setEnabled:on=>{showTrough700=on;}},
  {id:"ridge700",button:"ridge700",label:"リッジ",plane:"700hPa",lowLevel:true,setEnabled:on=>{showRidge700=on;}},
  { id: "temperature", button: "temperature", label: "気温線", plane: "300hPa", setEnabled: on => { showTemperature = on; } },
  { id: "wind", button: "wind", label: "風速の色塗り", plane: "300hPa", setEnabled: on => { showWind = on; } },
  { id: "jet", button: "jet", label: "強風軸", plane: "300hPa", setEnabled: on => { showJet = on; } },
  { id: "temperature500", button: "temperature500", label: "気温線", plane: "500hPa", setEnabled: on => { showTemperature500 = on; } },
  { id: "trough", button: "trough", label: "トラフ", plane: "500hPa", setEnabled: on => { showTrough = on; } },
  { id: "ridge", button: "ridge", label: "リッジ", plane: "500hPa", setEnabled: on => { showRidge = on; } },
  { id: "symbols", button: "symbol-color", label: "L・H・C・Wの文字", plane: "300/500hPa", setEnabled: on => { showSymbols = on; } },
  { id: "geography", button: "geography-toggle", label: "陸海・地形", plane: "300/500hPa", setEnabled: on => { showGeography = on; } }
];
let activeOnly = false;
let selectedDetail = null;

const overlayTime = (layer = panelRegistration) => layer ? `${layer.observation_time.slice(0,10).replaceAll("-", "/")} ${layer.observation_time.slice(11,13)}Z` : "時刻を確認中";
const overlayAvailable = () => Boolean(ready && panelRegistration && candidates && !featuresLoading);
const validOverlays = () => !ready || !panelRegistration || !candidates ? [] : overlayState.filter(layer => {
  try { ChartAnalysis.validatePanelOverlay(layer,panelRegistration,currentSelection.key); return true; } catch { return false; }
});
const enabledOverlays = () => validOverlays().filter(layer => layer.enabled);
const overlayDescription = layer => `${layer.source_hpa}hPa ${ChartAnalysis.overlayAnalyses.find(t => t.id === layer.analysis_id).label} → ${layer.target_hpa}hPa`;
const overlayDestination = () => `${overlayTarget}hPa（${overlayTarget === 300 ? "上段" : "下段"}）`;
function overlayButton(text, handler) {
  const button = document.createElement("button"); button.type = "button"; button.textContent = text;
  button.addEventListener("click",handler); return button;
}
function openOverlay(view, id = null) {
  overlayView = view; selectedOverlay = id;
  if (view === "picker") {
    byId("overlay-source").value = String(overlayTarget === 500 ? 300 : 500);
    selectedOverlayAnalysis = ChartAnalysis.overlayAnalyses.find(t => t.source_hpa === Number(byId("overlay-source").value))?.id;
  }
  updateOverlayDialog();
  if (!byId("overlay-dialog").open) byId("overlay-dialog").showModal();
}
function updateOverlayDialog() {
  const available = overlayAvailable();
  for (const [id,view] of [["overlay-picker","picker"],["overlay-settings","settings"],["overlay-list","list"]]) byId(id).hidden = overlayView !== view;
  const layer = validOverlays().find(item => item.id === selectedOverlay);
  if (overlayView === "settings" && !layer) { overlayView = "list"; updateOverlayDialog(); return; }
  byId("overlay-dialog-title").textContent = overlayView === "picker" ? "解析を重ねる" : overlayView === "list" ? "重ねた解析" : overlayDescription(layer);
  if (overlayView === "picker") {
    byId("overlay-destination").textContent = `重ねる先：${currentSelection?.product.code || ""} · ${overlayDestination()}`;
    byId("overlay-time").value = overlayTime();
    byId("overlay-source").disabled = !available;
    for (const option of byId("overlay-source").options) option.disabled = Number(option.value) === overlayTarget;
    const tools = ChartAnalysis.overlayAnalyses.filter(t => t.source_hpa === Number(byId("overlay-source").value) && t.source_hpa !== overlayTarget);
    if (!tools.some(t => t.id === selectedOverlayAnalysis)) selectedOverlayAnalysis = tools[0]?.id;
    byId("overlay-items").replaceChildren(...tools.map(tool => {
      const button = overlayButton(tool.label,() => { selectedOverlayAnalysis = tool.id; updateOverlayDialog(); });
      button.dataset.analysis = tool.id; button.setAttribute("aria-pressed",String(tool.id === selectedOverlayAnalysis)); button.disabled = !available; return button;
    }));
    const tool = tools.find(t => t.id === selectedOverlayAnalysis);
    const existing = validOverlays().find(item => item.analysis_id === tool?.id && item.target_hpa === overlayTarget);
    byId("overlay-route").textContent = tool ? `${tool.source_hpa}hPa · ${tool.label} → ${overlayDestination()}` : "別の気圧面の解析を選んでください。";
    byId("overlay-apply").disabled = !available || !tool || Boolean(existing?.enabled);
    byId("overlay-apply").textContent = existing ? existing.enabled ? "追加済み" : "この図に再表示" : "この図に重ねる";
  }
  if (overlayView === "settings") {
    byId("overlay-provenance").textContent = `解析元：${layer.source_product} · ${layer.source_hpa}hPa · ${overlayTime(layer)}\n重ねる先：${layer.target_hpa}hPa（${layer.target_hpa === 300 ? "上段" : "下段"}）`;
    byId("overlay-toggle").textContent = `表示 ${layer.enabled ? "ON" : "OFF"}`;
    byId("overlay-toggle").setAttribute("aria-pressed",String(layer.enabled));
    byId("overlay-opacity").value = String(Math.round(layer.opacity*100));
    byId("overlay-opacity-value").textContent = `${Math.round(layer.opacity*100)}%`;
    for (const id of ["overlay-toggle","overlay-opacity","overlay-remove"]) byId(id).disabled = !available;
  }
  if (overlayView === "list") {
    byId("overlay-added").replaceChildren(...validOverlays().map(item => {
      const button = overlayButton(`${overlayDescription(item)} · ${item.enabled ? "ON" : "OFF"}\n${item.source_product} · ${overlayTime(item)} · 濃さ${Math.round(item.opacity*100)}%`,() => openOverlay("settings",item.id));
      button.dataset.layerId = item.id; return button;
    }));
    byId("overlay-clear").disabled = !available || !validOverlays().length;
  }
}
byId("overlay-target").addEventListener("change", event => { overlayTarget = Number(event.target.value); controls(); });
byId("overlay-add").addEventListener("click", () => { if (overlayAvailable()) openOverlay("picker"); });
byId("overlay-manage").addEventListener("click", () => openOverlay("list"));
byId("overlay-close").addEventListener("click", () => byId("overlay-dialog").close());
byId("overlay-back").addEventListener("click", () => openOverlay("list"));
byId("overlay-source").addEventListener("change", () => updateOverlayDialog());
byId("overlay-apply").addEventListener("click", () => {
  if (!overlayAvailable() || byId("overlay-apply").disabled) return;
  const layer = ChartAnalysis.createPanelOverlay(panelRegistration,currentSelection.key,selectedOverlayAnalysis,overlayTarget);
  const existing = overlayState.find(item => item.id === layer.id);
  if (existing) existing.enabled = true;
  else overlayState.push({...layer,source_product:currentSelection.product.code});
  byId("overlay-dialog").close(); drawOverlays(); controls();
});
byId("overlay-toggle").addEventListener("click", () => {
  const layer = validOverlays().find(item => item.id === selectedOverlay);
  if (!overlayAvailable() || !layer) return;
  layer.enabled = !layer.enabled; drawOverlays(); controls();
});
byId("overlay-opacity").addEventListener("input", event => {
  const layer = validOverlays().find(item => item.id === selectedOverlay);
  if (!overlayAvailable() || !layer) return;
  layer.opacity = Number(event.target.value)/100; drawOverlays(); controls();
});
byId("overlay-remove").addEventListener("click", () => {
  if (!overlayAvailable()) return;
  overlayState = overlayState.filter(item => item.id !== selectedOverlay);
  byId("overlay-dialog").close(); drawOverlays(); controls();
});
byId("overlay-clear").addEventListener("click", () => {
  if (!overlayAvailable()) return;
  overlayState = []; byId("overlay-dialog").close(); drawOverlays(); controls();
});
function updateOverlayPanel() {
  const available = overlayAvailable(), added = validOverlays(), active = enabledOverlays();
  byId("overlay-toolbar").hidden = currentSelection?.variant.features !== "reviewed-aupq35";
  byId("overlay-target").disabled = byId("overlay-add").disabled = !available;
  byId("overlay-target").value = String(overlayTarget);
  byId("overlay-chips").replaceChildren(...added.slice(0,3).map(item => {
    const button = overlayButton(`${overlayDescription(item)}${item.enabled ? "" : " · OFF"}`,() => openOverlay("settings",item.id));
    button.className = "overlay-chip"; button.dataset.layerId = item.id;
    button.setAttribute("aria-label",`${overlayDescription(item)} · ${item.enabled ? "ON" : "OFF"} · 設定を開く`);
    button.dataset.enabled = String(item.enabled); button.disabled = !available;
    button.title = `${item.source_product} · ${overlayTime(item)} · 濃さ${Math.round(item.opacity*100)}%`; return button;
  }));
  byId("overlay-manage").hidden = !added.length;
  byId("overlay-manage").textContent = `重ねた解析 ${added.length}件`;
  paper.dataset.overlays = active.map(item => `${item.analysis_id}-on-${item.target_hpa}`).join(",");
  if (byId("overlay-dialog").open) updateOverlayDialog();
  return active.length;
}

function updateAnalysisPanel() {
  let count = 0;
  for (const tool of analysisTools) {
    const button = byId(tool.button);
    const enabled = button.getAttribute("aria-pressed") === "true";
    if (enabled) count++;
    const row = document.querySelector(`[data-layer="${tool.id}"]`);
    row.hidden = button.disabled || (!trial && ((tool.dynamics && !dynamics) || (tool.lowLevel && !lowLevel && !(dynamics && (["cold850","warm850"].includes(tool.id) || (isFeas() && ["trough700","ridge700"].includes(tool.id))))) || (lowLevel && ["wind","jet"].includes(tool.id)))) || (activeOnly && !enabled);
    if (row.hidden && enabled) count--;
    const detailButton = document.querySelector(`[data-layer-detail="${tool.id}"]`);
    detailButton.disabled = button.disabled;
    const open = selectedDetail === tool.id && !row.hidden;
    detailButton.setAttribute("aria-expanded", String(open));
    byId(`detail-${tool.id}`).hidden = !open;
    const plane=trial && !["symbols","geography"].includes(tool.id) ? trialPlane(tool.id) : ["symbols","geography"].includes(tool.id)?"図の各地図面":isFeas() && ["trough700","ridge700"].includes(tool.id)?"地上気圧":dynamics && tool.id==="temperature500"?"850hPa":lowLevel && !tool.lowLevel?tool.plane.replace("300","700").replace("500","850"):tool.plane;
    button.title = `${tool.label} · ${plane} · ${enabled ? "表示中。クリックで外す" : "クリックで表示"}`;
  }
  byId("layer-count").textContent = String(count);
  byId("active-only").setAttribute("aria-pressed", String(activeOnly));
  byId("no-active-layers").hidden = !activeOnly || count > 0;
  const available = analysisTools.filter(tool => !byId(tool.button).disabled);
  const allOn = !featuresLoading && available.length > 0 && available.every(tool => byId(tool.button).getAttribute("aria-pressed") === "true") && validOverlays().every(layer => layer.enabled);
  byId("analyze").disabled = !ready || featuresLoading || !available.length;
  byId("analyze").setAttribute("aria-pressed", String(allOn));
  byId("analyze").textContent = `すべての解析を${allOn ? "OFF" : "ON"}`;
  for (const group of document.querySelectorAll("[data-layer-group]")) {
    group.hidden = !Array.from(group.querySelectorAll("[data-layer]")).some(row => !row.hidden);
  }
  const style = ChartGeography.patterns.find(p => p.id === geographyStyle);
  byId("geography-current").textContent = `選択中：${style.label} · 濃さ${Math.round(geographyOpacity * 100)}%`;
  byId("geography-toggle").textContent = `陸海 · ${style.label}`;
  return count;
}
byId("active-only").addEventListener("click", () => { activeOnly = !activeOnly; updateAnalysisPanel(); });
for (const button of document.querySelectorAll("[data-layer-detail]")) button.addEventListener("click", () => {
  selectedDetail = selectedDetail === button.dataset.layerDetail ? null : button.dataset.layerDetail;
  updateAnalysisPanel();
  if (selectedDetail) byId(`detail-${selectedDetail}`).scrollIntoView({ block: "nearest" });
});
function selectPanelMode(manual) {
  byId("manual").hidden = !manual;
  byId("analysis-panel").hidden = manual;
  byId("manual-mode").setAttribute("aria-pressed", String(manual));
  byId("analysis-mode").setAttribute("aria-pressed", String(!manual));
  selectMode(manual ? "paint" : "move");
}
byId("analysis-mode").addEventListener("click", () => selectPanelMode(false));
byId("manual-mode").addEventListener("click", () => selectPanelMode(true));
byId("start-manual").addEventListener("click", () => { selectPanelMode(true); byId("paint").focus(); });

function controls() {
  const afterClear = history.slice(history.map((s) => s.kind).lastIndexOf("clear") + 1);
  const paintCount = afterClear.filter((s) => s.kind === "paint").length;
  byId("undo").disabled = !history.length;
  byId("redo").disabled = !future.length;
  byId("clear").disabled = !paintCount;
  byId("save").disabled = !ready || featuresLoading;
  for (const id of ["trough", "ridge", "jet"]) byId(id).disabled = !ready || !candidates;
  byId("jet").disabled ||= Boolean(lowLevel || dynamics); byId("ridge").disabled ||= Boolean(dynamics && !isFeas());
  byId("wind").disabled = !ready || !windBands;
  byId("wind").setAttribute("aria-pressed", String(Boolean(showWind && windBands)));
  byId("wind").textContent = "風速の色塗り";
  byId("symbol-color").disabled = !ready || !symbols;
  byId("symbol-color").setAttribute("aria-pressed", String(Boolean(showSymbols && symbols)));
  byId("symbol-color").textContent = "L・H・C・Wの文字";
  byId("temperature").disabled = !ready || !isotherms || Boolean(dynamics);
  byId("temperature").setAttribute("aria-pressed", String(Boolean(showTemperature && isotherms)));
  byId("temperature").textContent = "気温線";
  byId("temperature500").disabled = !ready || !isotherms;
  byId("temperature500").setAttribute("aria-pressed", String(Boolean(showTemperature500 && isotherms)));
  for (const [id,on] of [["wet",showWet],["cold700",showCold700],["cold850",showCold850],["warm850",showWarm850],["trough700",showTrough700],["ridge700",showRidge700]]) {
    byId(id).disabled = !ready || (!lowLevel && !(dynamics && (["cold850","warm850"].includes(id) || (isFeas() && ["trough700","ridge700"].includes(id))))); byId(id).setAttribute("aria-pressed",String(Boolean((lowLevel || (dynamics && (["cold850","warm850"].includes(id) || (isFeas() && ["trough700","ridge700"].includes(id))))) && on)));
  }
  paper.dataset.warm850 = String(Boolean((lowLevel || dynamics || trial) && showWarm850));
  paper.dataset.wet = String(Boolean(lowLevel && showWet)); paper.dataset.cold850 = String(Boolean((lowLevel || dynamics) && showCold850)); paper.dataset.cold700 = String(Boolean(lowLevel && showCold700)); paper.dataset.trough700 = String(Boolean(lowLevel && showTrough700)); paper.dataset.ridge700 = String(Boolean(lowLevel && showRidge700));
  for(const [id,on] of [["vorticity",showVorticity],["ascent",showAscent]]) {const available=Boolean(dynamics && (id!=="ascent" || !isFeas()));byId(id).disabled=!ready||!available;byId(id).setAttribute("aria-pressed",String(available&&on));paper.dataset[id]=String(available&&on);}
  byId("warm-opacity-value").textContent = `${Math.round(warmOpacity*100)}%`;
  for(const swatch of byId("warm850-legend").querySelectorAll("i"))swatch.style.opacity=String(warmOpacity);
  byId("cold-opacity-value").textContent = `${Math.round(coldOpacity*100)}%`;
  byId("original").disabled = !((lowLevel && (showWet || showCold700 || showCold850 || showWarm850 || showTrough700 || showRidge700)) || (dynamics && (showVorticity || (!isFeas() && showAscent) || showCold850 || showWarm850))) && !enabledOverlays().length && !showWind && !showTrough && !showRidge && !showJet && !(showSymbols && symbols) && !(showGeography && geography) && !((showTemperature || showTemperature500) && isotherms);
  byId("geography-toggle").disabled = byId("geography-opacity").disabled = !ready || !geography;
  byId("geography-toggle").setAttribute("aria-pressed", String(Boolean(showGeography && geography)));
  byId("geography-opacity-value").textContent = `${Math.round(geographyOpacity * 100)}%`;
  for (const button of byId("geography-patterns").querySelectorAll("button")) {
    const style = ChartGeography.patterns.find(p => p.id === button.dataset.pattern);
    button.disabled = !ready || !geography || (style.satellite && !satelliteImage) || (style.terrain !== undefined && !terrainImage);
    button.setAttribute("aria-pressed", String(Boolean(showGeography && geography && button.dataset.pattern === geographyStyle)));
  }
  byId("satellite-note").hidden = !showGeography || geographyStyle !== "satellite";
  const selectedStyle = ChartGeography.patterns.find(p => p.id === geographyStyle);
  const isTerrain = showGeography && selectedStyle.terrain !== undefined && terrainImage;
  byId("elevation-note").hidden = !isTerrain;
  byId("elevation-legend").hidden = geographyStyle === "relief";
  byId("relief-note").hidden = !isTerrain || geographyStyle === "elevation";
  for (const swatch of byId("elevation-legend").querySelectorAll("i")) swatch.style.opacity = String(geographyOpacity);
  byId("trough").setAttribute("aria-pressed", String(Boolean(showTrough && candidates)));
  byId("ridge").setAttribute("aria-pressed", String(Boolean(showRidge && candidates)));
  byId("jet").setAttribute("aria-pressed", String(Boolean(showJet && candidates)));
  byId("zoom-in").disabled = !ready || (!fitView && zoomFactor >= 4);
  byId("zoom-out").disabled = !ready || (!fitView && zoomFactor <= 0.25);
  paper.dataset.strokes = String(history.length);
  paper.dataset.trough = String(Boolean(showTrough && candidates));
  paper.dataset.ridge = String(Boolean(showRidge && candidates));
  paper.dataset.jet = String(Boolean(showJet && candidates));
  paper.dataset.wind = String(Boolean(showWind && windBands));
  paper.dataset.symbols = String(Boolean(showSymbols && symbols));
  paper.dataset.temperature = String(Boolean(showTemperature && isotherms));
  paper.dataset.temperature500 = String(Boolean(showTemperature500 && isotherms));
  paper.dataset.geography = showGeography && geography ? geographyStyle : "off";
  if(trial) {
    for(const tool of analysisTools){const available=trialAvailable(tool.id),button=byId(tool.button);button.disabled=!ready||!available;button.setAttribute("aria-pressed",String(available && trialEnabled(tool.id)));}
    if(trial.color_only){
      byId("original").disabled=!analysisTools.some(tool=>trialAvailable(tool.id)&&trialEnabled(tool.id))&&!enabledOverlays().length;
      for(const id of ["wet","ascent","cold850","warm850"])paper.dataset[id]=String(trialAvailable(id)&&trialEnabled(id));
    }
    paper.dataset.trial="EXPERIMENTAL_UNVERIFIED";
  } else delete paper.dataset.trial;
  if(currentSelection?.product.id==="aupq35") {
    byId("temperature").disabled=true;
    byId("temperature").setAttribute("aria-pressed","false");
    paper.dataset.temperature="false";
  }
  const layerCount = updateAnalysisPanel();
  const overlayCount = updateOverlayPanel();
  const layers = [layerCount ? `解析${layerCount}項目` : "原図", overlayCount ? `重ね合わせ${overlayCount}項目` : "", paintCount ? `手描き${paintCount}筆` : ""].filter(Boolean);
  byId("status").textContent = loadingError || (!ready ? "図を読み込み中" : [geographyError, terrainError, symbolError, temperatureError, analysisError, overlayError].filter(Boolean).join("・") || [currentSelection?.product.code, ...(layers.length ? layers : ["原図を表示中"])].filter(Boolean).join("・"));
}

function drawGeography() {
  geographyContext.clearRect(0, 0, geographyLayer.width, geographyLayer.height);
  if (!ready || !showGeography || !geography) return;
  const style = ChartGeography.patterns.find(p => p.id === geographyStyle);
  // A restored style can arrive before its independently validated image.
  if ((style.satellite && !satelliteImage) || (style.terrain !== undefined && !terrainImage)) return;
  if (geography.atlas) GeographyAtlas.draw(geographyContext,geography,geographyStyle,geographyOpacity,geographyMask,geographyBase,satelliteImage,terrainImage);
  else ChartGeography.draw(geographyContext, geography, geographyStyle, geographyOpacity, satelliteImage, terrainImage);
}
for (const [index, style] of ChartGeography.patterns.entries()) {
  const button = document.createElement("button"), preview = document.createElement("canvas"), label = document.createElement("span");
  button.type = "button"; button.dataset.pattern = style.id; button.disabled = true; button.setAttribute("aria-pressed", "false");
  preview.width = 132; preview.height = 30; preview.setAttribute("aria-hidden", "true");
  ChartGeography.preview(preview, style.id, satelliteImage);
  label.textContent = `${index + 1}. ${style.label}`; button.append(preview, label);
  button.addEventListener("click", () => { geographyStyle = style.id; showGeography = true; drawGeography(); controls(); });
  byId("geography-patterns").append(button);
}
byId("geography-toggle").addEventListener("click", () => { showGeography = !showGeography; drawGeography(); controls(); });
byId("geography-opacity").addEventListener("input", (event) => { geographyOpacity = Number(event.target.value) / 100; drawGeography(); controls(); });

function drawAnalysis() {
  analysisContext.clearRect(0, 0, analysisLayer.width, analysisLayer.height);
  jetContext.clearRect(0, 0, jetLayer.width, jetLayer.height);
  if(trial){
    const main=trial.panels[trial.product==="AUPQ78"||trial.product==="AUPQ35"?1:0],other=trial.panels[trial.product==="AUPQ78"||trial.product==="AUPQ35"?0:1];
    if(showTrough)SnapshotAnalysis.drawAxes(analysisContext,main.troughs,false);
    if(showRidge)SnapshotAnalysis.drawAxes(analysisContext,main.ridges,true);
    if(showTrough700 && other.pressure_hpa!==300)SnapshotAnalysis.drawAxes(analysisContext,other.troughs,false);
    if(showRidge700 && other.pressure_hpa!==300)SnapshotAnalysis.drawAxes(analysisContext,other.ridges,true);
    if(showJet && candidates?.jets.length)ChartAnalysis.drawJetAxes(jetContext,candidates.jets,trial.panels[0].bounds);
    return;
  }
  if (!candidates) return;
  if (showJet) ChartAnalysis.drawJetAxes(jetContext, candidates.jets, windBands.bounds);
  if (showTrough) ChartAnalysis.drawTroughs(analysisContext, candidates.troughs);
  if ((lowLevel || isFeas()) && showTrough700) ChartAnalysis.drawTroughs(analysisContext,(lowLevel ? lowLevel.panels[0] : dynamics.panels[1]).troughs.map(a=>a.points));
  if ((lowLevel || isFeas()) && showRidge700) ChartAnalysis.drawRidges(analysisContext,(lowLevel ? lowLevel.panels[0] : dynamics.panels[1]).ridges.map(a=>a.points));
  if (showRidge) ChartAnalysis.drawRidges(analysisContext, candidates.ridges);
  drawOverlays();
}
function drawOverlays() {
  overlayContext.clearRect(0,0,overlayLayer.width,overlayLayer.height);
  for (const layer of enabledOverlays()) ChartAnalysis.drawPanelOverlay(overlayContext,candidates,panelRegistration,layer,currentSelection.key);
}
const windLabels = ["40–60 kt", "60–80 kt", "80–100 kt", "100–120 kt", "120 kt以上"];
for (const [index, color] of ChartAnalysis.windPalette.entries()) {
  const entry = document.createElement("span"), swatch = document.createElement("i");
  entry.className = "wind-swatch"; swatch.style.backgroundColor = color;
  swatch.setAttribute("aria-hidden", "true"); entry.append(swatch, windLabels[index]);
  byId("wind-legend").append(entry);
}
function drawWind() {
  windContext.clearRect(0, 0, windLayer.width, windLayer.height);
  if(trial) SnapshotAnalysis.drawFills(windContext,trial,{wet:showWet,cold700:showCold700,cold850:showCold850,warm850:showWarm850,warmOpacity,opacity:coldOpacity,wind:showWind,vorticity:showVorticity,ascent:showAscent});
  else if (dynamics) ChartDynamics.drawFills(windContext,dynamics,{vorticity:showVorticity,ascent:showAscent,cold:showCold850,warm:showWarm850,warmOpacity,opacity:coldOpacity});
  else if (lowLevel) LowLevelAnalysis.drawFills(windContext,lowLevel,{wet:showWet,cold700:showCold700,cold850:showCold850,warm850:showWarm850,warmOpacity,opacity:coldOpacity});
  else if (showWind && windBands) ChartAnalysis.drawWindBands(windContext, windBands);
}
byId("wind").addEventListener("click", () => {
  if (!ready || !windBands) return;
  showWind = !showWind; drawWind(); controls();
});
function drawSymbols() {
  symbolContext.clearRect(0, 0, symbolLayer.width, symbolLayer.height);
  if (!ready || !showSymbols || !symbols) return;
  if(trial){SnapshotAnalysis.drawSymbols(symbolContext,trial);return;}
  ChartAnalysis.drawSymbols(symbolContext, symbols);
}
byId("symbol-color").addEventListener("click", () => {
  if (!ready || !symbols) return;
  showSymbols = !showSymbols; drawSymbols(); controls();
});
function temperatureLegends() {
  if(trial){trialLegends();return;}
  byId("trough").textContent="トラフ";byId("ridge").textContent="リッジ";
  const scales=temperatureScales();
  for (const id of ["trough","ridge"]) byId(dynamics?"upper-plane":"lower-plane").parentElement.append(document.querySelector(`[data-layer="${id}"]`));
  for (const id of ["trough700","ridge700"]) byId("lower-plane").parentElement.append(document.querySelector(`[data-layer="${id}"]`));
  if (!isFeas()) for (const id of ["trough700","ridge700"]) byId("upper-plane").parentElement.append(document.querySelector(`[data-layer="${id}"]`));
  for (const id of ["trough700","ridge700"]) {byId(id).textContent=`${isFeas()?"地上": "700hPa"}の${id==="trough700"?"トラフ":"リッジ"}`;byId(`detail-${id}`).querySelector(".legend").textContent=`${isFeas()?"地上気圧":"700hPa"}の解析案`;}
  byId("detail-ridge").querySelector(".legend").lastChild.textContent=`青いジグザグ線 · ${lowLevel?850:500}hPa`;
  for (const [plane,scale] of scales.entries()) {
    const id=plane?"temperature500-legend":"temperature-legend";byId(id).replaceChildren();
    for (const [index,value] of scale.values.entries()) {
      const entry=document.createElement("span"),swatch=document.createElement("i");
      swatch.style.borderColor=scale.colors[index];swatch.style.setProperty("--temperature-color",scale.colors[index]);swatch.style.setProperty("--temperature-opacity",scale.opacity);entry.append(swatch,`${value}℃`);byId(id).append(entry);
    }
    const pressure=scale.pressure_hpa;
    byId(id).setAttribute("aria-label",`${pressure}hPaの気温線`);
    document.querySelector(`[data-layer-detail="${plane?"temperature500":"temperature"}"]`).setAttribute("aria-label",`${pressure}hPaの気温線の詳細`);
    byId(plane?"lower-plane":"upper-plane").replaceChildren(`${plane && isFeas()?"地上 / 850 hPa":plane && dynamics?"850 / 700 hPa":`${pressure} hPa`} `);
    const position=document.createElement("span");position.textContent=plane?"下段":"上段";byId(plane?"lower-plane":"upper-plane").append(position);
    byId(plane?"detail-temperature500":"detail-temperature").querySelector("p").textContent=(lowLevel || dynamics)?"原図の破線の上に細い半透明の色線を重ね、気温の数字を読める隙間を残します。":plane?"−3〜−30℃の全10段階。元の黒い破線が透けるように、細い半透明の色を重ねます。":"−27〜−51℃の全5段階。原図の同じ気温の数字を滑らかにつなぐ補助線です。";
  }
  byId("detail-trough").querySelector(".legend").textContent=`赤い二重線 · ${lowLevel?850:500}hPa`;
  byId("detail-trough").querySelector("p").firstChild.textContent=dynamics?`${dynamics.panels[0].troughs.length}本の500hPaトラフ。日本周辺の曲がりを見た解析案です。`:""+ (lowLevel?"参照解析に合わせた3本。同じ谷としてつながる範囲を分けて表示します。":"この原図の等高度線の谷を確認した4本。短い波と低気圧の周りも含みます。");
  for (const [id,values] of [["cold700",[-15,-18,-21,-24,-27]],["cold850",[0,-3,-6,-9,-12]]]) {
    byId(`${id}-legend`).replaceChildren();
    for (const [i,v] of values.entries()) {const span=document.createElement("span"),swatch=document.createElement("i");swatch.style.backgroundColor=LowLevelAnalysis.coldColors[i];span.append(swatch,`${v}℃以下`);byId(`${id}-legend`).append(span);}
  }
}
temperatureLegends();
for (const id of ["wet","cold700","cold850","warm850","trough700","ridge700"]) byId(id).addEventListener("click",()=>{
  if (!ready || (trial ? !trialAvailable(id) : (!lowLevel && !(dynamics && (["cold850","warm850"].includes(id) || (isFeas() && ["trough700","ridge700"].includes(id))))))) return;
  if(id==="wet")showWet=!showWet;if(id==="cold700")showCold700=!showCold700;if(id==="cold850")showCold850=!showCold850;if(id==="warm850")showWarm850=!showWarm850;if(id==="trough700")showTrough700=!showTrough700;if(id==="ridge700")showRidge700=!showRidge700;drawWind();drawAnalysis();controls();
});
for(const [i,v] of LowLevelAnalysis.warmThresholds.entries()){const entry=document.createElement("span"),swatch=document.createElement("i");swatch.style.backgroundColor=LowLevelAnalysis.warmColors[i];entry.append(swatch,`${v}℃以上`);byId("warm850-legend").append(entry);}
byId("warm-opacity").addEventListener("input",event=>{warmOpacity=Number(event.target.value)/100;drawWind();controls();});
byId("cold-opacity").addEventListener("input",event=>{coldOpacity=Number(event.target.value)/100;drawWind();controls();});
function drawTemperature() {
  temperatureContext.clearRect(0, 0, temperatureLayer.width, temperatureLayer.height);
  const upper=showTemperature && currentSelection?.product.id!=="aupq35";
  if(ready && trial){SnapshotAnalysis.drawTemperature(temperatureContext,trial,SnapshotAnalysis.temperatureEnabled(trial,[upper,showTemperature500]));return;}
  if (ready && isotherms) ChartAnalysis.drawIsotherms(temperatureContext, isotherms, [upper?(lowLevel?700:300):null,showTemperature500?((lowLevel||dynamics)?850:500):null],temperatureScales());
}
byId("temperature").addEventListener("click", () => {
  if (!ready || !isotherms) return;
  showTemperature = !showTemperature; drawTemperature(); controls();
});
byId("temperature500").addEventListener("click", () => {
  if (!ready || !isotherms) return;
  showTemperature500 = !showTemperature500; drawTemperature(); controls();
});
for (const id of ["analyze", "trough", "ridge", "jet", "original"]) byId(id).addEventListener("click", () => {
  if (!ready || byId(id).disabled) return;
  if (id === "analyze") {
    const on = byId(id).getAttribute("aria-pressed") !== "true";
    for (const tool of analysisTools) if (!byId(tool.button).disabled) tool.setEnabled(on);
    for (const state of validOverlays()) state.enabled = on;
  }
  if (id === "trough") showTrough = !showTrough;
  if (id === "ridge") showRidge = !showRidge;
  if (id === "jet") showJet = !showJet;
  if (id === "original") {
    for (const tool of analysisTools) tool.setEnabled(false);
    for (const state of overlayState) state.enabled = false;
  }
  drawAnalysis(); drawWind(); drawSymbols(); drawGeography(); drawTemperature(); controls();
});

function path(stroke) {
  strokeContext.clearRect(0, 0, ink.width, ink.height);
  if (stroke.kind === "clear") return;
  strokeContext.strokeStyle = stroke.color;
  strokeContext.fillStyle = stroke.color;
  strokeContext.lineWidth = stroke.width;
  strokeContext.lineCap = "round";
  strokeContext.lineJoin = "round";
  const [first, ...rest] = stroke.points;
  if (!rest.length) {
    strokeContext.beginPath();
    strokeContext.arc(first.x, first.y, stroke.width / 2, 0, Math.PI * 2);
    strokeContext.fill();
  } else {
    strokeContext.beginPath();
    strokeContext.moveTo(first.x, first.y);
    for (const point of rest) strokeContext.lineTo(point.x, point.y);
    strokeContext.stroke();
  }
}

function apply(stroke) {
  if (stroke.kind === "clear") { context.clearRect(0, 0, ink.width, ink.height); return; }
  path(stroke);
  context.save();
  context.globalCompositeOperation = stroke.kind === "erase" ? "destination-out" : "source-over";
  context.globalAlpha = stroke.kind === "erase" ? 1 : stroke.opacity;
  context.drawImage(strokeLayer, 0, 0);
  context.restore();
}

function render() {
  context.clearRect(0, 0, ink.width, ink.height);
  for (const stroke of history) apply(stroke);
  if (active) apply(active);
}

function selectMode(next) {
  mode = next;
  ink.dataset.mode = mode;
  for (const id of ["paint", "erase", "move"]) byId(id).setAttribute("aria-pressed", String(id === mode));
  byId("hint").textContent = mode === "move" ? "拡大した図をドラッグして移動します。" : mode === "erase" ? "色塗りだけを消します。原図は残ります。" : "ドラッグして色を塗ります。原図の黒い線は残ります。";
}

function viewSize() {
  const style = getComputedStyle(viewport);
  return {
    width: Math.max(1, viewport.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)),
    height: Math.max(1, viewport.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom))
  };
}
function updateZoomLabel() {
  const exact = zoomSteps.find((step) => Math.abs(step - zoomFactor) < 0.0001);
  byId("custom-zoom").hidden = fitView || Boolean(exact);
  byId("custom-zoom").textContent = `${Math.round(zoomFactor * 100)}%`;
  byId("zoom").value = fitView ? "fit" : exact ? String(exact) : "custom";
}
function fit(anchor) {
  if (!ready || pointer !== null) return;
  const viewRect = viewport.getBoundingClientRect(), oldRect = paper.getBoundingClientRect();
  const focus = anchor || { x: viewRect.left + viewport.clientWidth / 2, y: viewRect.top + viewport.clientHeight / 2 };
  const center = { x: (focus.x - oldRect.left) / oldRect.width, y: (focus.y - oldRect.top) / oldRect.height };
  const size = viewSize();
  const width = fitView ? Math.min(size.width, size.height * ink.width / ink.height) : size.width * zoomFactor;
  paper.style.width = `${Math.floor(width)}px`;
  paper.style.height = `${Math.floor(width) * ink.height / ink.width}px`;
  if (fitView) { viewport.scrollTop = 0; viewport.scrollLeft = 0; zoomFactor = Math.floor(width) / size.width; }
  else { const rect = paper.getBoundingClientRect(); viewport.scrollLeft += rect.left + center.x * rect.width - focus.x; viewport.scrollTop += rect.top + center.y * rect.height - focus.y; }
  updateZoomLabel();
  controls();
}
function setZoom(factor, anchor) {
  if (!ready || pointer !== null) return;
  zoomFactor = Math.max(0.25, Math.min(4, factor)); fitView = false; fit(anchor);
}
function zoomBy(direction) {
  if (!ready || pointer !== null) return;
  setZoom(direction > 0 ? (zoomSteps.find((x) => x > zoomFactor + 0.005) || 4) : ([...zoomSteps].reverse().find((x) => x < zoomFactor - 0.005) || 0.25));
}
byId("zoom-in").addEventListener("click", () => zoomBy(1));
byId("zoom-out").addEventListener("click", () => zoomBy(-1));
byId("fit").addEventListener("click", () => { fitView = true; fit(); });
viewport.addEventListener("wheel", (event) => {
  if (!ready || pointer !== null || !event.deltaY) return;
  event.preventDefault();
  const pixels = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientHeight : 1);
  setZoom(zoomFactor * Math.exp(-Math.max(-120, Math.min(120, pixels)) * 0.0025), { x: event.clientX, y: event.clientY });
}, { passive: false });

function setPanel(open, focus = false) {
  if (pointer !== null) return;
  byId("workspace").classList.toggle("panel-collapsed", !open);
  byId("control-panel").hidden = !open;
  byId("panel-open").hidden = open;
  byId("panel-close").setAttribute("aria-expanded", String(open));
  byId("panel-open").setAttribute("aria-expanded", String(open));
  if (focus) byId(open ? "panel-close" : "panel-open").focus();
}
byId("panel-close").addEventListener("click", () => setPanel(false, true));
byId("panel-open").addEventListener("click", () => setPanel(true, true));
byId("choose-chart").addEventListener("click", () => { setPanel(true); byId("chart-select").scrollIntoView({ block: "nearest" }); byId("chart-select").focus(); });
const narrowView = matchMedia("(max-width: 720px)");
setPanel(!narrowView.matches);
narrowView.addEventListener("change", (event) => setPanel(!event.matches));
const compactLinks = matchMedia("(max-width: 1100px)");
byId("links").open = !compactLinks.matches;
compactLinks.addEventListener("change", (event) => { byId("links").open = !event.matches; });

function point(event) {
  const rect = ink.getBoundingClientRect();
  return { x: Math.max(0, Math.min(ink.width, (event.clientX - rect.left) * ink.width / rect.width)), y: Math.max(0, Math.min(ink.height, (event.clientY - rect.top) * ink.height / rect.height)) };
}

ink.addEventListener("pointerdown", (event) => {
  if (!ready || pointer !== null || event.button !== 0) return;
  pointer = event.pointerId;
  ink.setPointerCapture(pointer);
  ink.dataset.dragging = "true";
  if (mode === "move") {
    pan = { x: event.clientX, y: event.clientY, left: viewport.scrollLeft, top: viewport.scrollTop };
  } else {
    active = { kind: mode, color, width: Number(byId("width").value) * ink.width / ink.getBoundingClientRect().width, opacity: Number(byId("opacity").value), points: [point(event)] };
    render();
  }
});

ink.addEventListener("pointermove", (event) => {
  if (event.pointerId !== pointer) return;
  if (pan) {
    viewport.scrollLeft = pan.left + pan.x - event.clientX;
    viewport.scrollTop = pan.top + pan.y - event.clientY;
  } else if (active) {
    const samples = event.getCoalescedEvents?.();
    for (const sample of samples?.length ? samples : [event]) active.points.push(point(sample));
    render();
  }
});

function finish(event) {
  if (event.pointerId !== pointer) return;
  if (active) {
    history.push(active); future.length = 0; active = null;
  }
  pointer = null; pan = null;
  ink.dataset.dragging = "false";
  render(); controls();
}
ink.addEventListener("pointerup", finish);
ink.addEventListener("pointercancel", finish);
ink.addEventListener("lostpointercapture", finish);

for (const id of ["paint", "erase", "move"]) byId(id).addEventListener("click", () => selectMode(id));
for (const swatch of document.querySelectorAll("[data-color]")) swatch.addEventListener("click", () => {
  color = swatch.dataset.color; byId("color").value = color; selectMode("paint");
  for (const button of document.querySelectorAll("[data-color]")) button.setAttribute("aria-pressed", String(button === swatch));
});
byId("color").addEventListener("input", (event) => {
  color = event.target.value; selectMode("paint");
  for (const button of document.querySelectorAll("[data-color]")) button.setAttribute("aria-pressed", "false");
});
byId("undo").addEventListener("click", () => { if (history.length && pointer === null) { future.push(history.pop()); render(); controls(); } });
byId("redo").addEventListener("click", () => { if (future.length && pointer === null) { history.push(future.pop()); render(); controls(); } });
byId("clear").addEventListener("click", () => byId("clear-dialog").showModal());
byId("clear-dialog").addEventListener("close", () => {
  if (byId("clear-dialog").returnValue === "clear") { history.push({ kind: "clear" }); future.length = 0; render(); controls(); }
});
byId("zoom").addEventListener("change", (event) => {
  if (event.target.value === "fit") { fitView = true; fit(); }
  else if (event.target.value !== "custom") setZoom(Number(event.target.value));
});
new ResizeObserver(() => fit()).observe(viewport);

byId("save").addEventListener("click", () => {
  if (!ready || featuresLoading || !currentSelection) return;
  const selected = currentSelection;
  const exportRevision = loadRevision;
  const output = document.createElement("canvas");
  const selectedGeography = ChartGeography.patterns.find(p => p.id === geographyStyle);
  const exportTerrain = Boolean(showGeography && geography && terrainImage && selectedGeography.terrain !== undefined);
  const exportTemperatures = isotherms ? temperatureScales().filter((s,i)=>s.values.length && (i?showTemperature500:showTemperature && selected.product.id!=="aupq35")) : [];
  const exportOverlays = enabledOverlays();
  const temperatureFooterHeight = exportTemperatures.length ? exportTemperatures.length*40+56 : 0;
  const overlayFooterHeight = exportOverlays.length ? (exportOverlays.length+1)*44 : 0;
  const exportWarm=showWarm850 && Boolean((trial || lowLevel || dynamics)?.panels.some(p=>p.pressure_hpa===850));
  const footerHeight = ((lowLevel || dynamics || trial?.color_only) ? 440 : exportTerrain ? 340 : 260) + (exportWarm ? 56 : 0);
  output.width = ink.width; output.height = ink.height + footerHeight + temperatureFooterHeight + overlayFooterHeight;
  const ctx = output.getContext("2d");
  ctx.fillStyle = "white"; ctx.fillRect(0, 0, output.width, output.height);
  ctx.drawImage(chart, 0, 0);
  ctx.globalCompositeOperation = "multiply"; ctx.drawImage(geographyLayer, 0, 0); ctx.drawImage(windLayer, 0, 0); ctx.drawImage(analysisLayer, 0, 0);
  ctx.globalCompositeOperation = "source-over"; ctx.drawImage(jetLayer, 0, 0);
  ctx.drawImage(temperatureLayer, 0, 0);
  ctx.drawImage(symbolLayer, 0, 0);
  ctx.globalCompositeOperation = "multiply"; ctx.drawImage(overlayLayer, 0, 0); ctx.drawImage(ink, 0, 0); ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "#243247"; ctx.font = "24px sans-serif";
  ctx.fillText(`出典：気象庁 ${selected.product.code}（画像化） / ${chartLabel}`, 26, ink.height + 38, output.width - 52);
  ctx.fillText(`解析案：${showTrough700 && (lowLevel || isFeas()) ? (isFeas()?"地上トラフ ":"700hPaトラフ ") : ""}${showTrough ? (lowLevel?"850hPaトラフ ":"500hPaトラフ ") : ""}${showRidge700 && (lowLevel || isFeas()) ? (isFeas()?"地上リッジ ":"700hPaリッジ ") : ""}${showRidge ? (lowLevel?"850hPaリッジ ":"500hPaリッジ ") : ""}${showJet ? "300hPa強風軸" : ""}${!showTrough700 && !showRidge700 && !showTrough && !showRidge && !showJet ? "表示なし" : ""} / 手描き：利用者`, 26, ink.height + 76);
  if (showSymbols && symbols) for (const [index, letter] of ["L", "H", "C", "W"].entries()) {
    ctx.fillStyle = ChartAnalysis.symbolPalette[letter]; ctx.fillText(letter, 1610 + index * 90, ink.height + 76);
  }
  ctx.fillStyle = "#243247";
  ctx.font = "22px sans-serif"; ctx.fillText(showWind ? "風速（300hPa）" : "風速の色塗り：表示なし", 26, ink.height + 116);
  if (showWind) for (const [index, color] of ChartAnalysis.windPalette.entries()) {
    const x = 230 + index * 260;
    ctx.fillStyle = color; ctx.fillRect(x, ink.height + 95, 32, 24);
    ctx.fillStyle = "#243247"; ctx.fillText(windLabels[index], x + 42, ink.height + 116);
  }
  ctx.fillText(trial?.color_only ? "原図の等温線と縦線範囲を着色。予報の有効時刻は各枠の印字を確認してください。" : trial ? "解析試行：気象学的な精度は未検証。" : lowLevel ? "トラフ：この原図の等高度線の谷から推定した赤い二重線。汎用の自動検出ではありません。" : selected.variant.features === "reviewed-aupq35" ? "赤矢印：等風速線の強い帯の中心（流れの経路はこの1枚で確認）。トラフ：等高度線の曲がりから推定。" : `${selected.product.name}${selected.product.period ? " · " + selected.product.period : ""}`, 26, ink.height + 155, output.width - 52);
  ctx.fillText("利用者の着色・解析は気象庁の公式の解析ではありません。天気図解析マスター · Weather Chart Analysis Master · Bousai Wx Lab", 26, ink.height + 193, output.width - 52);
  const geoLabel = showGeography && geography ? `${ChartGeography.patterns.find(p => p.id === geographyStyle).label}（濃さ${Math.round(geographyOpacity * 100)}%）` : "表示なし";
  ctx.fillText(geography ? `陸海：${geoLabel}${showGeography && geographyStyle === "satellite" ? " / NASA Earth Observatory・Reto Stoeckli / 2004年10月の地表画像（投影変換）" : ""}` : "自動更新なし。解析・予想の日時は原図内を確認してください。", 26, ink.height + 231, output.width - 52);
  if(dynamics) {
    ctx.fillText(`500hPa正渦度：${showVorticity?"ピンク・濃さ30%":"表示なし"}${isFeas()?"":` / 700hPa上昇流：${showAscent?"黄緑・濃さ30%":"表示なし"}`}`,26,ink.height+275);
    ctx.fillText(`850hPa寒気：${showCold850?`濃さ${Math.round(coldOpacity*100)}%`:"表示なし"}`,26,ink.height+319);
    for(const [i,v] of [0,-3,-6,-9,-12].entries()) {const x=420+i*285;ctx.save();ctx.globalAlpha=coldOpacity;ctx.fillStyle=LowLevelAnalysis.coldColors[i];ctx.fillRect(x,ink.height+297,32,24);ctx.restore();ctx.fillText(`${v}℃以下`,x+42,ink.height+319);}
  }
  if(trial?.color_only) {
    ctx.fillText(`700hPa湿域：${showWet?"青水色・濃さ30%":"表示なし"} / 上昇流：${showAscent?"黄緑・濃さ30%":"表示なし"}`,26,ink.height+350,output.width-52);
    ctx.fillText(`850hPa寒気：${showCold850?`濃さ${Math.round(coldOpacity*100)}%`:"表示なし"}`,26,ink.height+394);
    for(const [i,v] of [0,-3,-6,-9,-12].entries()) {const x=420+i*285;ctx.save();ctx.globalAlpha=coldOpacity;ctx.fillStyle=LowLevelAnalysis.coldColors[i];ctx.fillRect(x,ink.height+372,32,24);ctx.restore();ctx.fillText(`${v}℃以下`,x+42,ink.height+394);}
    ctx.fillText("850hPaの色塗りは原図の3℃刻みの等温線で区切ります。",26,ink.height+430,output.width-52);
  }
  if (lowLevel) {
    ctx.fillStyle="#243247";
    ctx.fillText(`湿域：${showWet?"T−Td < 3℃ / 青水色・濃さ30% / 原図ドット格子の近似":"表示なし"}`,26,ink.height+270);
    for (const [row,panel] of lowLevel.panels.entries()) {
      const on=panel.pressure_hpa===700?showCold700:showCold850;
      ctx.fillText(`${panel.pressure_hpa}hPa寒気：${on?`濃さ${Math.round(coldOpacity*100)}%`:"表示なし"}`,26,ink.height+310+row*44);
      for(const [i,v] of panel.cold_thresholds.entries()) {const x=420+i*285;ctx.save();ctx.globalAlpha=coldOpacity;ctx.fillStyle=LowLevelAnalysis.coldColors[i];ctx.fillRect(x,ink.height+290+row*44,32,24);ctx.restore();ctx.fillStyle="#243247";ctx.fillText(`${v}℃以下`,x+42,ink.height+310+row*44);}
    }
    ctx.fillText("寒気の目安：低温ほど濃い青、最大は濃紺。",26,ink.height+399,output.width-52);
  }
  if (exportTerrain) {
    ctx.fillText("地表標高：NOAA ETOPO 2022 / EGM2008基準 / 1分格子（南北約1.9km）/ 投影変換した広域表示", 26, ink.height + 268);
    if (geographyStyle === "relief") ctx.fillText("陰影の明暗は斜面の向き・傾き。北西からの照明で山の凹凸を強調しています。", 26, ink.height + 307);
    else for (const [index, label] of elevationData.legend.labels.entries()) {
      const x = 26 + index * 275;
      ctx.save(); ctx.globalAlpha = geographyOpacity; ctx.fillStyle = elevationData.legend.colors[index]; ctx.fillRect(x, ink.height + 287, 30, 24); ctx.restore();
      ctx.fillStyle = "#243247"; ctx.fillText(label, x + 39, ink.height + 307);
    }
  }
  if(exportWarm){
    const y=ink.height+footerHeight-22;ctx.fillStyle="#243247";ctx.font="22px sans-serif";ctx.fillText(`850hPa暖気（濃さ${Math.round(warmOpacity*100)}%）`,26,y);
    for(const [i,v] of LowLevelAnalysis.warmThresholds.entries()){const x=470+i*245;ctx.save();ctx.globalAlpha=warmOpacity;ctx.fillStyle=LowLevelAnalysis.warmColors[i];ctx.fillRect(x,y-22,32,24);ctx.restore();ctx.fillText(`${v}℃以上`,x+42,y);}
  }
  if (exportTemperatures.length) {
    for (const [row,scale] of exportTemperatures.entries()) {
    const y = ink.height + footerHeight + 30 + row*40;
    ctx.fillStyle = "#243247"; ctx.font = "22px sans-serif"; ctx.fillText(`${scale.pressure_hpa}hPa 気温線`, 26, y);
    ctx.save(); ctx.lineDashOffset = 0;
    for (const [index, value] of scale.values.entries()) {
      const x = 230 + index * 170;
      const length = scale.pressure_hpa===500 ? 56 : 38;
      if (scale.opacity<1) {
        ctx.globalAlpha = 1; ctx.setLineDash([14,7]); ctx.strokeStyle = "#243247"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x,y-8); ctx.lineTo(x+length,y-8); ctx.stroke();
      }
      ctx.setLineDash(scale.dash); ctx.globalAlpha = scale.opacity;
      ctx.strokeStyle = scale.colors[index]; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x,y-8); ctx.lineTo(x+length,y-8); ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#243247"; ctx.fillText(`${value}℃`,x+length+10,y);
    }
    ctx.restore();
    }
    ctx.fillText(trial?.color_only?"原図の等温線に半透明の色を重ねた表示です。":"原図の気温表示・破線をもとに滑らかにつなぐ補助線。気温の格子データから算出した線ではありません。", 26, ink.height+footerHeight+exportTemperatures.length*40+28, output.width-52);
  }
  if (exportOverlays.length) {
    const y = ink.height+footerHeight+temperatureFooterHeight+30;
    ctx.fillStyle = "#243247"; ctx.font = "22px sans-serif";
    ctx.fillText("重ね合わせ（解析元の気圧面・時刻）",26,y);
    for (const [index,tool] of exportOverlays.entries()) ctx.fillText(`${overlayDescription(tool)} / ${tool.source_product} · ${overlayTime(tool)} / 濃さ${Math.round(tool.opacity*100)}%`,26,y+(index+1)*44,output.width-52);
  }
  output.toBlob((blob) => {
    if (loadRevision !== exportRevision || currentSelection?.key !== selected.key || !ready) return;
    if (!blob) { byId("status").textContent = "保存できませんでした"; return; }
    if (exportUrl) URL.revokeObjectURL(exportUrl);
    exportUrl = URL.createObjectURL(blob);
    const link = byId("export-link");
    link.download = `${selected.variant.id}-p${selected.page.number}-colored.png`;
    link.href = exportUrl; link.hidden = false; link.click();
    byId("status").textContent = "PNGを書き出しました";
  }, "image/png");
});

document.addEventListener("keydown", (event) => {
  if (!byId("overlay-dialog").open && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z" && !["INPUT", "SELECT"].includes(event.target.tagName)) {
    event.preventDefault(); byId(event.shiftKey ? "redo" : "undo").click();
  }
});

function initialize(selected) {
  if (chart.naturalWidth !== selected.page.width || chart.naturalHeight !== selected.page.height) throw Error("Chart dimensions mismatch");
  for (const canvas of [ink, strokeLayer]) {
    canvas.width = chart.naturalWidth; canvas.height = chart.naturalHeight;
  }
  const reviewed = isReviewed(selected) || isTrialSelection(selected);
  for (const canvas of [analysisLayer, jetLayer, windLayer, geographyLayer, symbolLayer, temperatureLayer, overlayLayer]) {
    canvas.width = reviewed || canvas === geographyLayer ? chart.naturalWidth : 1;
    canvas.height = reviewed || canvas === geographyLayer ? chart.naturalHeight : 1;
    canvas.hidden = !reviewed && canvas !== geographyLayer;
  }
  const low=selected.variant.features==="reviewed-aupq78",dyn=["reviewed-axfe578","reviewed-feas50"].includes(selected.variant.features),feas=isFeasSelection(selected);
  for (const canvas of [jetLayer,overlayLayer]) canvas.hidden = !reviewed || low || dyn;
  windLayer.setAttribute("aria-label",["fxfe5782","fxfe5784","fxfe577"].includes(selected.product.id)?"700hPaの湿域・上昇流と850hPaの寒気・暖気の色塗り":["aupq78","axfe578","feas-feas50"].includes(selected.product.id)?"湿域・寒気・暖気・正渦度・上昇流の色塗り":"300hPa等風速線に沿った緑色の塗り分け");
  analysisLayer.setAttribute("aria-label",low?"700・850hPaのトラフ、赤い二重曲線。リッジ、青いジグザグ線":feas?"500hPaと地上気圧のトラフは赤い二重曲線、リッジは青いジグザグ線":"500hPaのトラフは赤い二重曲線、リッジは青いジグザグ線");
  temperatureLayer.setAttribute("aria-label",["fxfe5782","fxfe5784","fxfe577"].includes(selected.product.id)?"上段500hPaと下段850hPaの等温線。対応する実況図と同じ配色":["aupq78","axfe578","feas-feas50"].includes(selected.product.id)?"700・850hPaの等温線。0℃を境に暖色と寒色、暖気はえんじ色、寒気は濃紺":selected.product.id==="aupq35"?"500hPaの気温線。暖かい薄い青から寒い濃い紫":"300・500hPaの気温線。暖かい薄い青から寒い濃い紫");
  paper.style.aspectRatio = `${ink.width} / ${ink.height}`;
  ready = true; paper.hidden = false; paper.dataset.ready = "true"; paper.dataset.chart = selected.product.id; paper.dataset.source = selected.variant.id;
  selectMode(byId("manual").open ? "paint" : "move"); render(); drawAnalysis(); drawWind(); drawSymbols(); drawGeography(); drawTemperature(); fit(); controls();
}
async function fetchJSON(path, signal) {
  const response = await fetch(path, { cache: "no-store", signal });
  if (!response.ok) throw Error("Chart data unavailable");
  return response.json();
}
async function checkedImage(path, expectedHash, width, height, signal, retry = false, applyImage = null) {
  const response = await fetch(path, { signal, cache: retry ? "reload" : "default" });
  if (!response.ok) throw Error("Chart image unavailable");
  const bytes = await response.arrayBuffer();
  const actualHash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), b => b.toString(16).padStart(2, "0")).join("");
  if (actualHash !== expectedHash) throw Error("Chart image hash mismatch");
  const url = URL.createObjectURL(new Blob([bytes], { type: "image/png" })), image = new Image();
  try {
    image.src = url; await image.decode();
    if (image.naturalWidth !== width || image.naturalHeight !== height) throw Error("Chart image size mismatch");
    if (applyImage) await applyImage(image);
    return image;
  } finally { URL.revokeObjectURL(url); }
}
function keepDrawing() {
  if (!ready || !currentSelection) return;
  if (pointer !== null) finish({ pointerId: pointer });
  drawingStates.set(currentSelection.key, { history: [...history], future: [...future], showWind, showTrough, showRidge, showJet, showSymbols, showGeography, geographyStyle, geographyOpacity, showTemperature, showTemperature500, showVorticity, showAscent, showWet, showCold700, showCold850, showWarm850, warmOpacity, showTrough700, showRidge700, coldOpacity, overlayTarget, overlays: overlayState.map(layer => ({...layer})) });
}
function setOptions(select, records, value) {
  select.replaceChildren();
  for (const record of records) {
    const option = document.createElement("option"); option.value = record.id; option.textContent = record.label; select.append(option);
  }
  select.value = value || records[0].id; select.disabled = records.length < 2;
}
function selectProduct() {
  const product = catalog.products.find(p => p.id === byId("chart-select").value);
  setOptions(byId("source-select"), product.variants, product.variants[0].id);
  selectSource();
}
function selectSource() {
  const product = catalog.products.find(p => p.id === byId("chart-select").value);
  const variant = product.variants.find(v => v.id === byId("source-select").value);
  setOptions(byId("page-select"), variant.pages.map(page => ({ id: String(page.number), label: `${page.number} / ${variant.pages.length} ページ` })));
  byId("page-selection").hidden = variant.pages.length === 1;
  loadSelection();
}
byId("chart-select").addEventListener("change", selectProduct);
byId("source-select").addEventListener("change", selectSource);
byId("page-select").addEventListener("change", () => loadSelection());
byId("chart-retry").addEventListener("click", () => catalog ? loadSelection(true) : loadCatalog());
async function loadSelection(retry = false) {
  keepDrawing();
  const revision = ++loadRevision;
  loadController?.abort(); loadController = new AbortController();
  const signal = loadController.signal;
  const selected = ChartCatalog.selection(catalog, byId("chart-select").value, byId("source-select").value, Number(byId("page-select").value));
  currentSelection = selected; ready = false; paper.hidden = true; paper.dataset.ready = "false";
  active = pointer = pan = null;
  geographyMask = geographyBase = geography = satelliteImage = elevationData = terrainImage = symbols = windBands = candidates = isotherms = lowLevel = dynamics = trial = null;
  temperatureLegends();
  panelRegistration = null;
  loadingError = geographyError = terrainError = symbolError = analysisError = temperatureError = overlayError = "";
  history.length = future.length = 0;
  const state = drawingStates.get(selected.key);
  overlayState = state?.overlays ? state.overlays.map(layer => ({...layer})) : [];
  byId("overlay-dialog").close(); selectedOverlay = null;
  overlayTarget = state?.overlayTarget || 500;
  if (state) { history.push(...state.history); future.push(...state.future); }
  showVorticity=state?.showVorticity ?? true;showAscent=state?.showAscent ?? true;
  showWet=state?.showWet ?? true;showCold700=state?.showCold700 ?? false;showCold850=state?.showCold850 ?? false;showWarm850=state?.showWarm850 ?? false;warmOpacity=state?.warmOpacity ?? .35;byId("warm-opacity").value=String(Math.round(warmOpacity*100));showTrough700=state?.showTrough700 ?? isFeasSelection(selected);showRidge700=state?.showRidge700 ?? isFeasSelection(selected);coldOpacity=state?.coldOpacity ?? .35;byId("cold-opacity").value=String(Math.round(coldOpacity*100));
  showWind = state?.showWind || false; showTrough = state?.showTrough ?? ["reviewed-aupq78","reviewed-axfe578","reviewed-feas50","experimental-local","experimental-snapshot"].includes(selected.variant.features); showRidge = state?.showRidge ?? ["reviewed-aupq78","reviewed-feas50","experimental-local","experimental-snapshot"].includes(selected.variant.features); showJet = state?.showJet || false;
  showSymbols = state?.showSymbols ?? true; showGeography = state?.showGeography ?? true;
  showTemperature = state?.showTemperature ?? true;
  showTemperature500 = state?.showTemperature500 ?? true;
  geographyStyle = state?.geographyStyle || defaultGeographyStyle; geographyOpacity = state?.geographyOpacity ?? 0.4;
  byId("geography-opacity").value = String(Math.round(geographyOpacity * 100));
  fitView = true;
  if (exportUrl) { URL.revokeObjectURL(exportUrl); exportUrl = null; }
  byId("export-link").hidden = true; byId("export-link").removeAttribute("href");
  byId("chart-retry").hidden = true;
  const reviewed = isReviewed(selected) || isTrialSelection(selected);
  featuresLoading = true;
  selectedDetail = null; activeOnly = false;
  byId("manual-only").hidden = true;
  for (const section of document.querySelectorAll("[data-requires]")) section.hidden = false;
  const retrieved = new Date(selected.variant.retrieved_at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
  chartLabel = selected.variant.observation_label || `${selected.variant.label} · ${retrieved} JST取得`;
  byId("chart-name").textContent = `${selected.product.name}${selected.product.period ? " · " + selected.product.period : ""}`;
  byId("chart-info").textContent = chartLabel;
  byId("chart-note").textContent = isTrialSelection(selected) ? "今回収録した原図の解析試行。トラフ・リッジを含む精度は検証中です。" : reviewed ? `自動更新なし。${selected.variant.features === "reviewed-aupq78"?"上段700hPa・下段850hPa":isFeasSelection(selected)?"上段500hPa・下段地上気圧／850hPa気温":selected.variant.features === "reviewed-axfe578"?"上段500hPa・下段850hPa気温／700hPa上昇流":"上段300hPa・下段500hPa"}。固定原図の着色・解析も使えます。` : "自動更新なし。陸海の着色と手描きでの解析を使えます。解析・予想の日時は原図内を確認してください。";
  byId("source-link").href = selected.variant.source_url;
  byId("source-link").textContent = `気象庁 ${selected.product.code} 原図${selected.variant.source_url.endsWith(".pdf") ? "PDF" : "PNG"}`;
  controls();
  try {
    await checkedImage(selected.page.image_path, selected.page.image_sha256, selected.page.width, selected.page.height, signal, retry, async image => {
      if (revision !== loadRevision) return;
      chart.src = image.src; await chart.decode();
    });
    if (revision !== loadRevision) return;
    chart.alt = `気象庁 ${selected.product.code} · ${selected.product.name} · ${chartLabel}`;
    initialize(selected);
    if(isTrialSelection(selected)) await loadTrial(selected,revision,signal);
    else if (selected.variant.features === "reviewed-aupq78") await loadLowLevel(selected,revision,signal);
    else if (["reviewed-axfe578","reviewed-feas50"].includes(selected.variant.features)) await loadDynamics(selected,revision,signal);
    else if (reviewed) await loadFeatures(selected, revision, signal);
    if(selected.variant.features!=="reviewed-aupq35")await loadGeographyAtlas(selected,revision,signal);
    if (revision === loadRevision) { featuresLoading = false; byId("manual-only").hidden = reviewed || Boolean(geography); controls(); }
  } catch (error) {
    if (revision !== loadRevision || error.name === "AbortError") return;
    loadingError = "図を読み込めませんでした。「図を再読み込み」か別の天気図を選んでください。";
    byId("chart-retry").hidden = false; controls();
  }
}
async function loadGeographyAtlas(selected,revision,signal) {
  try {
    const atlas = selected.page.image_path.startsWith("local-collection/") ? {schema_version:1,coast_source:{license:"Public domain"},selections:localCollection.geography} : await fetchJSON("geography-catalog.json",signal);
    const data=GeographyAtlas.validate(atlas,selected);
    if(!data.panels.length){byId("chart-note").textContent="自動更新なし。手描きでの解析を使えます。解析・予想の日時は原図内を確認してください。";return;}
    const mask=await checkedImage(data.mask.path,data.mask.sha256,data.mask.width,data.mask.height,signal);
    if(revision!==loadRevision)return;
    geography={...data,atlas:true};geographyMask=mask;
    const wantedStyle=geographyStyle;
    if(GeographyAtlas.canonical(data) && ["elevation","elevation-relief","satellite"].includes(geographyStyle))geographyStyle="paper";
    if(!GeographyAtlas.canonical(data) && ["elevation","elevation-relief","satellite"].includes(geographyStyle))geographyStyle="paper";
    drawGeography();controls();
    if(GeographyAtlas.canonical(data)) {
      const original=await fetchJSON("chart.json",signal);
      const base=ChartGeography.validate(await fetchJSON("land-sea.json",signal),original),elevation=ChartGeography.validateElevation(await fetchJSON("elevation.json",signal),original);
      const [terrain,satellite]=await Promise.all([checkedImage(elevation.image.path,elevation.image.sha256,elevation.image.width,elevation.image.height,signal),checkedImage(base.satellite.path,base.satellite.image_sha256,base.satellite.width,base.satellite.height,signal)]);
      if(revision!==loadRevision)return;
      geographyBase=base;geographyStyle=wantedStyle;terrainImage=terrain;satelliteImage=satellite;elevationData=elevation;
      byId("elevation-legend").replaceChildren();
      for(const [i,label] of elevation.legend.labels.entries()){const span=document.createElement("span"),swatch=document.createElement("i");swatch.style.backgroundColor=elevation.legend.colors[i];span.append(swatch,label);byId("elevation-legend").append(span);}
      for(const style of ChartGeography.patterns)ChartGeography.preview(byId("geography-patterns").querySelector(`[data-pattern="${style.id}"] canvas`),style.id,satellite,terrain,base);
      drawGeography();controls();
    }
  }catch(error){if(revision===loadRevision && error.name!=="AbortError"){geographyError="陸海の資料を確認できません。";controls();}}
}
const isFeasSelection = selected => selected.variant.features === "reviewed-feas50";
const trialMain = () => trial.panels[trial.product === "AUPQ35" || trial.product === "AUPQ78" ? 1 : 0];
const trialOther = () => trial.panels[trial.product === "AUPQ35" || trial.product === "AUPQ78" ? 0 : 1];
function trialPlane(id) {
  if(["trough","ridge"].includes(id))return `${trialMain().pressure_hpa}hPa`;
  if(["trough700","ridge700"].includes(id))return trialOther().axis_pressure_hpa===0?"地上気圧":`${trialOther().pressure_hpa}hPa`;
  if(id==="temperature")return `${temperatureScales()[0].pressure_hpa}hPa`;
  if(id==="temperature500")return `${temperatureScales()[1].pressure_hpa}hPa`;
  if(id==="wet" && trial.color_only)return "700hPa";
  return analysisTools.find(t=>t.id===id)?.plane || "図の各地図面";
}
function trialEnabled(id) {
  return {vorticity:showVorticity,ascent:showAscent,wet:showWet,cold700:showCold700,cold850:showCold850,warm850:showWarm850,
    trough700:showTrough700,ridge700:showRidge700,temperature:showTemperature,temperature500:showTemperature500,
    wind:showWind,jet:showJet,trough:showTrough,ridge:showRidge,symbols:showSymbols,geography:showGeography}[id];
}
function trialAvailable(id) {
  const some=key=>trial.panels.some(p=>p[key]?.length);
  return {vorticity:some("positive_vorticity_rectangles"),ascent:some("ascent_rectangles"),wet:some("wet_rectangles"),
    cold700:trial.panels.some(p=>p.pressure_hpa===700&&p.cold_thresholds),
    cold850:trial.panels.some(p=>p.pressure_hpa===850&&p.cold_thresholds),
    warm850:trial.panels.some(p=>p.pressure_hpa===850&&p.levels.some(l=>LowLevelAnalysis.warmThresholds.includes(l.temperature_c))),
    trough700:trialOther().pressure_hpa!==300&&trialOther().troughs.length>0,ridge700:trialOther().pressure_hpa!==300&&trialOther().ridges.length>0,
    temperature:temperatureScales()[0].pressure_hpa!==300&&temperatureScales()[0].values.length>0,temperature500:temperatureScales()[1].values.length>0,
    wind:some("wind_bands"),jet:Boolean(candidates?.jets.length),trough:trialMain().troughs.length>0,ridge:trialMain().ridges.length>0,
    symbols:trial.symbols.length>0,geography:Boolean(geography)}[id];
}
function trialLegends() {
  for(const [i,scale] of temperatureScales().entries()) {
    const id=i?"temperature500":"temperature",legend=byId(`${id}-legend`);legend.replaceChildren();
    for(const [j,value] of scale.values.entries()) {
      const entry=document.createElement("span"),swatch=document.createElement("i");
      swatch.style.borderColor=scale.colors[j];swatch.style.setProperty("--temperature-color",scale.colors[j]);swatch.style.setProperty("--temperature-opacity",scale.opacity);entry.append(swatch,`${value}℃`);legend.append(entry);
    }
    const heading=byId(i?"lower-plane":"upper-plane"),pos=document.createElement("span");pos.textContent=i?"下段":"上段";
    heading.replaceChildren(trial.color_only?(i?"850 / 700 hPa ":"500 / 700 hPa "):trial.product==="FEAS50"&&i?"地上 / 850 hPa ":trial.product==="AXFE578"&&i?"850 / 700 hPa ":`${scale.pressure_hpa} hPa `,pos);
    legend.setAttribute("aria-label",`${scale.pressure_hpa}hPaの気温線`);
    byId(`detail-${id}`).querySelector("p").textContent="原図の等温線を半透明の色線で表示します。";
    document.querySelector(`[data-layer-detail="${id}"]`).setAttribute("aria-label",`${scale.pressure_hpa}hPaの気温線の詳細`);
  }
  if(trial.color_only)byId("upper-plane").parentElement.append(document.querySelector('[data-layer="wet"]'));
  else byId("lower-plane").parentElement.append(document.querySelector('[data-layer="wet"]'));
  byId("detail-wet").querySelector("p").textContent=trial.color_only?"700hPaの湿域（T−Td < 3℃）の縦線範囲を青水色・濃さ30%で表示します。降水域とは異なります。":"原図の湿域（T−Td < 3℃）のドットを含む範囲。元のドットと線が透ける濃さ30%。境界はドット間隔の半分程度の近似です。降水域とは異なります。";
  if(trial.color_only)byId("detail-temperature500").querySelector("p").textContent="原図の850hPa等温線は3℃間隔、数値の印字は6℃間隔です。寒気・暖気の色塗りも、原図にある3℃ごとの境界を使います。";
  for(const id of ["trough","ridge","trough700","ridge700"]) {
    const upper=["trough","ridge"].includes(id)?["AXFE578","FEAS50"].includes(trial.product):["AUPQ35","AUPQ78"].includes(trial.product);
    byId(upper?"upper-plane":"lower-plane").parentElement.append(document.querySelector(`[data-layer="${id}"]`));
    const ridge=id.startsWith("ridge"),plane=trialPlane(id),panel=id.endsWith("700")?trialOther():trialMain();
    byId(id).textContent=`${plane}の${ridge?"リッジ":"トラフ"}`;
    byId(`detail-${id}`).querySelector(".legend").textContent=`${ridge?"青":"赤"}い線 · ${plane} · 解析試行`;
    byId(`detail-${id}`).querySelector("p").firstChild.textContent=`${panel[ridge?"ridges":"troughs"].length}本の解析試行。精度は未検証です。`;
  }
  for(const [id,values] of [["cold700",[-15,-18,-21,-24,-27]],["cold850",[0,-3,-6,-9,-12]]]) {
    byId(`${id}-legend`).replaceChildren();
    for(const [i,v] of values.entries()){const span=document.createElement("span"),swatch=document.createElement("i");swatch.style.backgroundColor=LowLevelAnalysis.coldColors[i];span.append(swatch,`${v}℃以下`);byId(`${id}-legend`).append(span);}
  }
}
async function loadTrial(selected,revision,signal) {
  try {
    const response=await fetch(selected.variant.analysis_path,{signal,cache:"no-store"});
    if(!response.ok)throw Error("Trial data unavailable");
    const bytes=await response.arrayBuffer(),actual=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes)),b=>b.toString(16).padStart(2,"0")).join("");
    if(actual!==selected.variant.analysis_sha256)throw Error("Trial data hash mismatch");
    const data=SnapshotAnalysis.validate(JSON.parse(new TextDecoder().decode(bytes)),selected,location.hostname);
    if(revision!==loadRevision)return;
    trial=data;symbols=isotherms=data;
    if(data.color_only){
      showTrough=showRidge=showTrough700=showRidge700=false;
      byId("chart-note").textContent="上段500hPa気温・700hPa湿域、下段850hPa気温・700hPa上昇流。固定原図の着色を使えます。";
    }
    if(data.product==="AUPQ78")lowLevel=data;
    if(["AXFE578","FEAS50"].includes(data.product))dynamics=data;
    candidates={troughs:trialMain().troughs.map(a=>a.points),ridges:trialMain().ridges.map(a=>a.points),jets:SnapshotAnalysis.jetAxes(data)};
    if(data.panels.some(p=>p.wind_bands?.length))windBands={bounds:data.panels[0].bounds};
    if(!drawingStates.has(selected.key)){showTrough700=true;showRidge700=true;showWind=Boolean(windBands);showJet=Boolean(candidates.jets.length);showCold700=true;showCold850=true;}
    temperatureLegends();drawSymbols();drawTemperature();drawWind();drawAnalysis();controls();
  }catch(error){if(revision===loadRevision&&error.name!=="AbortError"){analysisError="今回の原図と解析試行の対応を確認できません。";controls();}}
}
async function loadDynamics(selected,revision,signal) {
  try {
    const checked=ChartDynamics.validate(await fetchJSON(isFeasSelection(selected)?"feas50-analysis.json":"axfe578-analysis.json",signal),selected);
    if(revision!==loadRevision)return;
    dynamics=checked;symbols=checked;isotherms=checked;candidates={troughs:checked.panels[0].troughs.map(a=>a.points),ridges:(checked.panels[0].ridges || []).map(a=>a.points),jets:[]};
    temperatureLegends();drawSymbols();drawTemperature();drawWind();drawAnalysis();controls();
  } catch(error) {if(revision===loadRevision && error.name!=="AbortError")analysisError=`${selected.product.code}の解析資料を確認できません。`;}
}
for(const id of ["vorticity","ascent"])byId(id).addEventListener("click",()=>{if(!ready||!dynamics)return;if(id==="vorticity")showVorticity=!showVorticity;else showAscent=!showAscent;drawWind();controls();});
async function loadLowLevel(selected,revision,signal) {
  try {
    const checked=LowLevelAnalysis.validate(await fetchJSON("aupq78-analysis.json",signal),selected);
    if (revision!==loadRevision) return;
    lowLevel=checked;symbols=checked;isotherms=checked;
    candidates={troughs:checked.panels[1].troughs.map(a=>a.points),ridges:checked.panels[1].ridges.map(a=>a.points),jets:[]};
    temperatureLegends();drawSymbols();drawTemperature();drawWind();drawAnalysis();controls();
  } catch(error) { if(revision===loadRevision && error.name!=="AbortError") {analysisError="AUPQ78の解析資料を確認できません。原図の閲覧・手描きは使えます。";controls();} }
}
async function loadFeatures(selected, revision, signal) {
  const current = () => revision === loadRevision;
  let data;
  try {
    data = await fetchJSON("chart.json", signal);
    if (data.image_path !== selected.page.image_path || data.image_sha256 !== selected.page.image_sha256 || data.source_sha256 !== selected.variant.source_sha256 || data.width !== selected.page.width || data.height !== selected.page.height) throw Error("Analysis source mismatch");
  } catch (error) {
    if (current() && error.name !== "AbortError") { analysisError = "自動着色・解析の資料を確認できません。原図の閲覧・手描きは使えます。"; controls(); }
    return;
  }
  await Promise.allSettled([
    (async () => {
      try {
        const checked = ChartAnalysis.validateIsotherms(await fetchJSON("isotherms.json", signal), data);
        if (current()) { isotherms = checked; drawTemperature(); controls(); }
      } catch (error) { if (current() && error.name !== "AbortError") { temperatureError = "気温線の資料を確認できません。原図の気温表示は残ります。"; controls(); } }
    })(),
    (async () => {
      try {
        const [contours, wind, guides] = await Promise.all(["contours.json", "wind-bands.json", "jet-guides.json"].map(path => fetchJSON(path, signal)));
        const checkedContours = ChartAnalysis.validate(contours, data), checkedWind = ChartAnalysis.validateWindBands(wind, data);
        ChartAnalysis.validateHeightAxes(checkedContours);
        const checkedGuides = ChartAnalysis.validateJetGuides(guides, data, checkedWind);
        const checkedCandidates = ChartAnalysis.analyze(checkedContours, checkedWind, checkedGuides);
        if (current()) { windBands = checkedWind; candidates = checkedCandidates; drawAnalysis(); drawWind(); controls(); }
      } catch (error) { if (current() && error.name !== "AbortError") { analysisError = "解析資料を確認できません。原図の閲覧・手描きは使えます。"; controls(); } }
    })(),
    (async () => {
      try {
        const checked = ChartAnalysis.validateSymbols(await fetchJSON("center-symbols.json", signal), data);
        if (current()) { symbols = checked; drawSymbols(); controls(); }
      } catch (error) { if (current() && error.name !== "AbortError") { symbolError = "文字の資料を確認できません。原図の文字を表示します。"; controls(); } }
    })(),
    (async () => {
      try {
        const checked = ChartGeography.validate(await fetchJSON("land-sea.json", signal), data);
        if (!current()) return;
        geography = checked;
        try { panelRegistration = ChartAnalysis.validatePanelRegistration(checked,data); }
        catch { overlayError = "重ね合わせの位置を確認できません。各気圧面の解析は使えます。"; }
        if (terrainImage) for (const style of ChartGeography.patterns.filter(p => p.terrain !== undefined)) ChartGeography.preview(byId("geography-patterns").querySelector(`[data-pattern="${style.id}"] canvas`), style.id, null, terrainImage, geography);
        drawGeography(); drawOverlays(); controls();
        try {
          const image = await checkedImage(checked.satellite.path, checked.satellite.image_sha256, checked.satellite.width, checked.satellite.height, signal);
          if (current()) { satelliteImage = image; ChartGeography.preview(byId("geography-patterns").querySelector('[data-pattern="satellite"] canvas'), "satellite", image); drawGeography(); controls(); }
        } catch (error) { if (current() && error.name !== "AbortError") { geographyError = "衛星画像を確認できません。ほかの塗り方は使えます。"; controls(); } }
      } catch (error) { if (current() && error.name !== "AbortError") { geographyError = "陸海の資料を確認できません。ほかの色分けは使えます。"; controls(); } }
    })(),
    (async () => {
      try {
        const checked = ChartGeography.validateElevation(await fetchJSON("elevation.json", signal), data);
        const image = await checkedImage(checked.image.path, checked.image.sha256, checked.image.width, checked.image.height, signal);
        if (!current()) return;
        elevationData = checked; terrainImage = image;
        for (const style of ChartGeography.patterns.filter(p => p.terrain !== undefined)) ChartGeography.preview(byId("geography-patterns").querySelector(`[data-pattern="${style.id}"] canvas`), style.id, null, image, geography);
        byId("elevation-legend").replaceChildren();
        for (const [index, label] of checked.legend.labels.entries()) {
          const entry = document.createElement("span"), swatch = document.createElement("i");
          swatch.style.backgroundColor = checked.legend.colors[index]; swatch.setAttribute("aria-hidden", "true"); entry.append(swatch, label); byId("elevation-legend").append(entry);
        }
        drawGeography(); controls();
      } catch (error) { if (current() && error.name !== "AbortError") { terrainError = "標高の資料を確認できません。ほかの塗り方は使えます。"; controls(); } }
    })()
  ]);
}
async function loadCatalog() {
  loadingError = ""; byId("chart-retry").hidden = true;
  try {
    catalog = ChartCatalog.validate(await fetchJSON("chart-catalog.json"));
    if(SnapshotAnalysis.localHost(location.hostname) && !catalog.latest_collection) {
      const response=await fetch("local-collection/catalog.json",{cache:"no-store"});
      if(response.ok){localCollection=await response.json();catalog=SnapshotAnalysis.merge(catalog,localCollection,location.hostname);}
    }
    const picker = byId("chart-select"); picker.replaceChildren();
    for (const [id, label] of [["observation", "実況天気図"], ["forecast", "予想天気図"]]) {
      const group = document.createElement("optgroup"); group.label = label;
      for (const product of catalog.products.filter(p => p.group === id)) {
        const option = document.createElement("option"); option.value = product.id; option.textContent = `${product.code} · ${product.name}${product.period ? "（" + product.period + "）" : ""}`; group.append(option);
      }
      picker.append(group);
    }
    picker.disabled = false; picker.value = "aupq35";
    byId("chart-count").textContent = `実況${catalog.products.filter(p => p.group === "observation").length}・予想${catalog.products.filter(p => p.group === "forecast").length}`;
    selectProduct();
  } catch (_) {
    catalog = null; loadingError = "天気図の一覧を読み込めませんでした。「図を再読み込み」を押してください。";
    byId("chart-select").disabled = true; byId("chart-retry").hidden = false; controls();
  }
}
loadCatalog();
