"use strict";
const coloringRules=ChartAnalysis.coloringRules;
for(const element of ["vorticity","ascent"]){
  document.documentElement.style.setProperty(`--${element}-color`,coloringRules[element].color);
  document.documentElement.style.setProperty(`--${element}-opacity`,coloringRules[element].opacity);
}
document.documentElement.style.setProperty("--trough-color",coloringRules.axes.trough);
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
const tropopauseLayer=byId("tropopause-layer"),tropopauseContext=tropopauseLayer.getContext("2d");
let showTropopause=true;
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
let lowLevel = null, dynamics = null, trial = null, localCollection = null, ensemble = null;
const ensembleLayer = id => ensemble?.product === "fxxn519" ? ({vorticity:"heightAnomaly",ascent:"height5880"}[id] || id) : id === "ascent" ? "anomaly" : id;
const ensembleAvailable = id => Boolean(ensemble?.images[ensembleLayer(id)]);
let showVorticity = true, showAscent = true;
let showPrecipitation = true;
let showEquivalent=true,equivalentOpacity=coloringRules.equivalentOpacity;
const isFeas = () => dynamics?.product === "FEAS50";
const temperatureScales = () => trial ? SnapshotAnalysis.displayScales(trial) : dynamics ? ChartDynamics.scalesFor(dynamics) : lowLevel ? LowLevelAnalysis.scales : ChartAnalysis.isothermScales;
let showWet = true, showCold700 = true, showCold850 = true, showTrough700 = true, showRidge700 = true;
let coldOpacity = coloringRules.coldOpacity, warmOpacity = coloringRules.warmOpacity;
let showWarm850 = true;
const isTrialSelection = selected => ["experimental-local","experimental-snapshot"].includes(selected.variant.features);
const isReviewed = selected => ["reviewed-aupq35","reviewed-aupq78","reviewed-axfe578", "reviewed-feas50"].includes(selected.variant.features);
let showTemperature = true;
let showTemperature500 = true;
let temperatureError = "";
let windBands = null;
let showWind = true;
let candidates = null;
let showTrough = true;
let showRidge = true;
let showJet = true;
let analysisError = "";
const history = [];
const future = [];
let mode = "move";
let color = "#2563eb";
let active = null;
let pointer = null;
let pan = null;
let axisDraft = null, axisPreview = null, axisSelected = null, axisNode = null, axisDrag = null, axisAdding = false;
let activeVector = null, weatherId = "sun";
const vectorModes=["curve","line","shape","emoji"];
const vectorModeButtons=[["manual-curve","curve"],["manual-line","line"],["manual-shape","shape"],["manual-emoji","emoji"]];
let ready = false;
let chartLabel = "AUPQ35";
let exportUrl = null;
let zoomFactor = 1;
let fitView = true;
let rowView = null, rowFrames = null;
let catalog = null;
let currentSelection = null;
let loadingError = "";
let featuresLoading = false;
let loadRevision = 0;
let loadController = null;
let shareBusy = false;
let catalogRevision = 0;
const drawingStates = new Map();
const zoomSteps = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];
const analysisTools = [
  {id:"tropopause",button:"tropopause",label:"圏界面の色塗り",plane:"圏界面（hPa）",setEnabled:on=>{showTropopause=on;}},
  {id:"equivalent",button:"equivalent",label:"相当温位の色塗り",plane:"850hPa",setEnabled:on=>{showEquivalent=on;}},
  {id:"precipitation",button:"precipitation",label:"降水量の色塗り",plane:"地上",setEnabled:on=>{showPrecipitation=on;}},
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

function readingGuideElement(guide) {
  const content = document.createElement("div");
  content.className = "reading-guide";
  const heading = document.createElement("h4");
  heading.textContent = guide.title;
  const list = document.createElement("dl");
  for (const [key, label] of [["look","見るポイント"],["mark","マークするなら"],["learn","分かること"],["check","併せて確認"]]) {
    const term = document.createElement("dt"), description = document.createElement("dd");
    term.textContent = label; description.textContent = guide[key];
    list.append(term, description);
  }
  const source = document.createElement("a");
  source.href = guide.source; source.textContent = guide.sourceLabel;
  source.target = "_blank"; source.rel = "noopener noreferrer"; source.className = "guide-source";
  content.append(heading, list, source);
  return content;
}
function updateReadingTopics(layerGuides) {
  const section = byId("chart-reading-guide");
  const productId = currentSelection?.product.id;
  const topics = ChartReadingGuide.topics(productId).filter(item => !ChartReadingGuide.covered(item, layerGuides));
  section.hidden = !topics.length;
  const signature = `${currentSelection?.key}/${topics.map(item => `${item.kind}:${item.plane}`).join(",")}`;
  if (section.dataset.guideKey === signature) return;
  section.dataset.guideKey = signature;
  const items = byId("chart-reading-items");
  items.replaceChildren();
  for (const guide of topics) {
    const details = document.createElement("details"), summary = document.createElement("summary");
    const title = document.createElement("span"), action = document.createElement("span");
    details.className = "reading-topic"; title.textContent = guide.title;
    action.className = "reading-topic-action"; action.textContent = "解説を見る";
    summary.append(title, action); details.append(summary, readingGuideElement(guide));
    items.append(details);
  }
}
function updateAnalysisPanel() {
  let count = 0;
  const layerGuides = [];
  for (const tool of analysisTools) {
    const button = byId(tool.button);
    const enabled = button.getAttribute("aria-pressed") === "true";
    if (enabled) count++;
    const row = document.querySelector(`[data-layer="${tool.id}"]`);
    const unavailable = button.disabled || (!trial && !ensemble && ((tool.dynamics && !dynamics) || (tool.lowLevel && !lowLevel && !(dynamics && (["cold850","warm850"].includes(tool.id) || (isFeas() && ["trough700","ridge700"].includes(tool.id))))) || (lowLevel && ["wind","jet"].includes(tool.id))));
    row.hidden = unavailable || (activeOnly && !enabled);
    if (row.hidden && enabled) count--;
    const detailButton = document.querySelector(`[data-layer-detail="${tool.id}"]`);
    detailButton.disabled = button.disabled;
    const open = selectedDetail === tool.id && !row.hidden;
    detailButton.setAttribute("aria-expanded", String(open));
    byId(`detail-${tool.id}`).hidden = !open;
    const plane=ensemble && tool.id==="ascent" ? ensemble.product==="fxxn519"?"500hPa":"850hPa" : trial && !["symbols","geography"].includes(tool.id) ? trialPlane(tool.id) : ["symbols","geography"].includes(tool.id)?"図の各地図面":isFeas() && ["trough700","ridge700"].includes(tool.id)?"地上気圧":dynamics && tool.id==="temperature500"?"850hPa":lowLevel && !tool.lowLevel?tool.plane.replace("300","700").replace("500","850"):tool.plane;
    const guidePlane = trial && ["wind","jet"].includes(tool.id) ? `${trial.panels.find(panel => tool.id === "wind" ? panel.wind_bands?.length : panel.jet_guides?.length || panel.native_jet_strokes?.length)?.pressure_hpa || plane.match(/\d+/)?.[0]}hPa` : plane;
    const guide = ChartReadingGuide.layer(tool.id, guidePlane, currentSelection?.product.id);
    const detail = byId(`detail-${tool.id}`), guideKey = `${currentSelection?.key}/${guidePlane}`;
    if (guide && detail.dataset.guideKey !== guideKey) {
      detail.querySelector(".reading-guide")?.remove();
      detail.prepend(readingGuideElement(guide));
      detail.dataset.guideKey = guideKey;
    }
    if (!guide) { detail.querySelector(".reading-guide")?.remove(); delete detail.dataset.guideKey; }
    if (!unavailable && guide) layerGuides.push(guide);
    detailButton.firstChild.textContent = open ? "解説を閉じる " : "解説を見る ";
    detailButton.setAttribute("aria-label", `${button.textContent}（${guidePlane}）の解説・凡例・設定`);
    button.title = `${button.textContent} · ${plane} · ${enabled ? "表示中。クリックで外す" : "クリックで表示"}`;
  }
  updateReadingTopics(layerGuides);
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
  if (selectedDetail) button.closest(".layer-row").scrollIntoView({ block: "start" });
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
  byId("tropopause").disabled=true;byId("tropopause").setAttribute("aria-pressed","false");
  paper.dataset.tropopause=String(Boolean(trial?.product==="AUPA20"&&showTropopause));
  byId("equivalent").disabled=true;byId("equivalent").setAttribute("aria-pressed","false");
  byId("equivalent-opacity-value").textContent=`${Math.round(equivalentOpacity*100)}%`;
  byId("precipitation").disabled=true;byId("precipitation").setAttribute("aria-pressed","false");
  windLayer.setAttribute("aria-label",["AUPA20","AUPA25","FUPA252","FUPA302","FUPA402"].includes(trial?.product)?`${trial.panels[0].pressure_hpa}hPa等風速線に沿った緑色の塗り分け`:trial?.equivalent_temperature?"850hPaの相当温位を260〜370 Kの寒色から暖色で塗り分け":trial?.feas_forecast?"上段500hPaの正渦度と、下段850hPaの寒気・暖気を色分け":trial?.surface_forecast?"上段500hPaの正渦度と、下段地上の降水量を色分け":"300hPa等風速線に沿った緑色の塗り分け");
  const afterClear = history.slice(history.map((s) => s.kind).lastIndexOf("clear") + 1);
  const paintCount = afterClear.filter((s) => s.kind === "paint").length;
  const axisCount = ManualAxis.resolved(history).size;
  byId("undo").disabled = !history.length && !axisDraft;
  byId("redo").disabled = !future.length || Boolean(axisDraft);
  byId("clear").disabled = !paintCount && !axisCount;
  byId("save").disabled = !ready || featuresLoading || Boolean(axisDraft) || pointer !== null;
  byId("share").disabled = !ready || featuresLoading || shareBusy || pointer !== null || Boolean(axisDraft);
  updateAxisControls();
  byId("share").textContent = shareBusy ? "リンク作成中…" : "共有リンクコピー";
  for (const id of ["trough", "ridge", "jet"]) byId(id).disabled = !ready || !candidates;
  byId("jet").disabled ||= Boolean(lowLevel || dynamics); byId("ridge").disabled ||= Boolean(dynamics && !isFeas());
  byId("wind").disabled = !ready || !windBands;
  byId("wind").setAttribute("aria-pressed", String(Boolean(showWind && windBands)));
  byId("wind").textContent = "風速の色塗り";
  byId("symbol-color").disabled = !ready || !symbols;
  byId("symbol-color").setAttribute("aria-pressed", String(Boolean(showSymbols && symbols)));
  byId("symbol-color").textContent = ensemble ? "L・Hの文字" : "L・H・C・Wの文字";
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
  for (const [id,row] of [["fit-upper",0],["fit-lower",1]]) {
    byId(id).disabled = !ready || featuresLoading || !rowFrames;
    byId(id).setAttribute("aria-pressed",String(rowView === row));
  }
  byId("fit").setAttribute("aria-pressed",String(fitView));
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
    if(trial.color_only||trial.surface_forecast||trial.feas_forecast||trial.equivalent_temperature){
      for(const id of ["wet","ascent","cold850","warm850"])paper.dataset[id]=String(trialAvailable(id)&&trialEnabled(id));
    }
    paper.dataset.equivalent=String(trialAvailable("equivalent")&&showEquivalent);
    paper.dataset.precipitation=String(trialAvailable("precipitation")&&showPrecipitation);
    paper.dataset.trial="EXPERIMENTAL_UNVERIFIED";
  } else delete paper.dataset.trial;
  if(currentSelection?.product.id==="aupq35") {
    byId("temperature").disabled=true;
    byId("temperature").setAttribute("aria-pressed","false");
    paper.dataset.temperature="false";
  }
  if(ensemble){
    for(const [id,on] of [["precipitation",showPrecipitation],["vorticity",showVorticity],["ascent",showAscent],["cold850",showCold850],["warm850",showWarm850]]){const available=ensembleAvailable(id);byId(id).disabled=!ready||!available;byId(id).setAttribute("aria-pressed",String(available&&on));paper.dataset[id]=String(available&&on);}
    windLayer.setAttribute("aria-label",ensemble.product==="fxxn519"?"500hPa偏差の正負、5880m以上、850hPa寒暖気の参考着色":ensemble.product==="fefe19"?"アンサンブル平均降水域を水色から青で強調":"正渦度のピンク、降水予想頻度の寒色、気温偏差の正を赤・負を青で透過着色");
  } else if(!trial) paper.dataset.precipitation="false";
  const layerCount = updateAnalysisPanel();
  const overlayCount = updateOverlayPanel();
  const layers = [layerCount ? `解析${layerCount}項目` : "原図", overlayCount ? `重ね合わせ${overlayCount}項目` : "", paintCount ? `手描き${paintCount}筆` : "",axisCount ? `線・図形${axisCount}個` : ""].filter(Boolean);
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
    if(trial.surface_forecast){
      for(const panel of trial.panels.filter(p=>p.pressure_hpa===500)){
        if(showTrough)SnapshotAnalysis.drawAxes(analysisContext,panel.troughs,false);
        if(showRidge)SnapshotAnalysis.drawAxes(analysisContext,panel.ridges,true);
      }
      return;
    }
    const main=trial.panels[trial.product==="AUPQ78"||trial.product==="AUPQ35"?1:0],other=trial.panels[trial.product==="AUPQ78"||trial.product==="AUPQ35"?0:1];
    if(showTrough)SnapshotAnalysis.drawAxes(analysisContext,main.troughs,false);
    if(showRidge)SnapshotAnalysis.drawAxes(analysisContext,main.ridges,true);
    if(showTrough700 && other && other.pressure_hpa!==300)SnapshotAnalysis.drawAxes(analysisContext,other.troughs,false);
    if(showRidge700 && other && other.pressure_hpa!==300)SnapshotAnalysis.drawAxes(analysisContext,other.ridges,true);
    if(showJet && trial.product==="AUPA20")SnapshotAnalysis.drawNativeJets(jetContext,trial);
    else if(showJet && candidates?.jets.length)ChartAnalysis.drawJetAxes(jetContext,candidates.jets,trial.panels[0].bounds);
    return;
  }
  if (!candidates) return;
  if (showJet && windBands && candidates.jets.length) ChartAnalysis.drawJetAxes(jetContext, candidates.jets, windBands.bounds);
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
  tropopauseContext.clearRect(0,0,tropopauseLayer.width,tropopauseLayer.height);
  if(trial?.product==="AUPA20"&&showTropopause)SnapshotAnalysis.drawTropopause(tropopauseContext,trial);
  windContext.clearRect(0, 0, windLayer.width, windLayer.height);
  if(ensemble){EnsembleColoring.draw(windContext,ensemble,"precipitation",showPrecipitation);EnsembleColoring.draw(windContext,ensemble,ensembleLayer("vorticity"),showVorticity);EnsembleColoring.draw(windContext,ensemble,ensembleLayer("ascent"),showAscent);EnsembleColoring.draw(windContext,ensemble,"cold850",showCold850,coldOpacity/.35);EnsembleColoring.draw(windContext,ensemble,"warm850",showWarm850,warmOpacity/.35);}
  else if(trial) SnapshotAnalysis.drawFills(windContext,trial,{equivalent:showEquivalent,equivalentOpacity,precipitation:showPrecipitation,wet:showWet,cold700:showCold700,cold850:showCold850,warm850:showWarm850,warmOpacity,opacity:coldOpacity,wind:showWind,vorticity:showVorticity,ascent:showAscent});
  else if (dynamics) ChartDynamics.drawFills(windContext,dynamics,{vorticity:showVorticity,ascent:showAscent,cold:showCold850,warm:showWarm850,warmOpacity,opacity:coldOpacity});
  else if (lowLevel) LowLevelAnalysis.drawFills(windContext,lowLevel,{wet:showWet,cold700:showCold700,cold850:showCold850,warm850:showWarm850,warmOpacity,opacity:coldOpacity});
  else if (showWind && windBands) ChartAnalysis.drawWindBands(windContext, windBands);
}
byId("tropopause").addEventListener("click",()=>{if(!ready||!trial||!trialAvailable("tropopause"))return;showTropopause=!showTropopause;drawWind();controls();});
byId("wind").addEventListener("click", () => {
  if (!ready || !windBands) return;
  showWind = !showWind; drawWind(); controls();
});
function drawSymbols() {
  symbolContext.clearRect(0, 0, symbolLayer.width, symbolLayer.height);
  if (!ready || !showSymbols || !symbols) return;
  if(ensemble){EnsembleColoring.draw(symbolContext,ensemble,"symbols",true);return;}
  if(trial){SnapshotAnalysis.drawSymbols(symbolContext,trial);return;}
  ChartAnalysis.drawSymbols(symbolContext, symbols);
}
byId("symbol-color").addEventListener("click", () => {
  if (!ready || !symbols) return;
  showSymbols = !showSymbols; drawSymbols(); controls();
});
const ensembleRowParents = new Map(["precipitation","ascent","vorticity","cold850","warm850"].map(id=>[id,document.querySelector(`[data-layer="${id}"]`).parentElement]));
function temperatureLegends() {
  byId("detail-symbols").querySelector(".symbol-c").hidden=false;byId("detail-symbols").querySelector(".symbol-w").hidden=false;
  byId("detail-vorticity").querySelector(".legend").textContent="500hPa · ピンク · 濃さ30%";
  for(const [id,parent] of ensembleRowParents)parent.append(document.querySelector(`[data-layer="${id}"]`));
  byId("precipitation").textContent="降水量の色塗り";byId("ascent").textContent="上昇流の色塗り";byId("vorticity").textContent="正渦度の色塗り";
  byId("cold850").textContent="寒気の色塗り";byId("warm850").textContent="暖気の色塗り";
  byId("detail-ascent").querySelector(".legend").textContent="700hPa · 黄緑 · 濃さ30%";
  byId("detail-cold850").querySelector("p").textContent="原図の等温線を境界に、低温ほど濃い色で塗ります。";
  byId("detail-warm850").querySelector("p").textContent="850hPaの9・12・15・18・21・24℃以上を、薄い黄色から赤を経てえんじ色で塗ります。";
  if(ensemble){ensembleLegends();return;}
  if(trial){trialLegends();return;}
  byId("jet").textContent="強風軸";document.querySelector('[data-layer="symbols"]').parentElement.querySelector("h3 span").textContent="上段・下段";
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
  for (const [id,values] of [["cold700",coloringRules.coldThresholds[700]],["cold850",coloringRules.coldThresholds[850]]]) {
    byId(`${id}-legend`).replaceChildren();
    for (const [i,v] of values.entries()) {const span=document.createElement("span"),swatch=document.createElement("i");swatch.style.backgroundColor=LowLevelAnalysis.coldColors[i];span.append(swatch,`${v}℃以下`);byId(`${id}-legend`).append(span);}
  }
}
temperatureLegends();
for (const id of ["wet","cold700","cold850","warm850","trough700","ridge700"]) byId(id).addEventListener("click",()=>{
  if (!ready || (trial ? !trialAvailable(id) : ensemble ? !ensembleAvailable(id) : (!lowLevel && !(dynamics && (["cold850","warm850"].includes(id) || (isFeas() && ["trough700","ridge700"].includes(id))))))) return;
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
for (const id of ["analyze", "trough", "ridge", "jet"]) byId(id).addEventListener("click", () => {
  if (!ready || byId(id).disabled) return;
  if (id === "analyze") {
    const on = byId(id).getAttribute("aria-pressed") !== "true";
    for (const tool of analysisTools) if (!byId(tool.button).disabled) tool.setEnabled(on);
    for (const state of validOverlays()) state.enabled = on;
  }
  if (id === "trough") showTrough = !showTrough;
  if (id === "ridge") showRidge = !showRidge;
  if (id === "jet") showJet = !showJet;
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
  if (["axis","vector"].includes(stroke.kind)) { ManualAxis.draw(context,stroke,ChartAnalysis); return; }
  path(stroke);
  context.save();
  context.globalCompositeOperation = stroke.kind === "erase" ? "destination-out" : "source-over";
  context.globalAlpha = stroke.kind === "erase" ? 1 : stroke.opacity;
  context.drawImage(strokeLayer, 0, 0);
  context.restore();
}

function render() {
  context.clearRect(0, 0, ink.width, ink.height);
  for (const stroke of ManualAxis.flattened(history,axisDrag)) apply(stroke);
  if (active) apply(active);
  if(activeVector)ManualAxis.draw(context,activeVector,ChartAnalysis);
  if (axisDraft) {
    const points=[...axisDraft.points];
    if(axisPreview && ManualAxis.distance(points.at(-1),axisPreview)>1)points.push(axisPreview);
    ManualAxis.draw(context,{kind:axisDraft.type==="curve"?"vector":"axis",type:axisDraft.type,nodes:ManualAxis.smooth(points,ink.width,ink.height),style:axisDraft.style},ChartAnalysis);
  }
  drawAxisEditor(); updateAxisControls();
}

function selectMode(next) {
  if(axisDraft && next!==mode)completeAxis(false);
  mode = next;
  ink.dataset.mode = mode;
  for (const [id,value] of [["paint","paint"],["erase","erase"],["move","move"],["manual-trough","trough"],["manual-ridge","ridge"],["axis-edit","axis-edit"],...vectorModeButtons]) byId(id).setAttribute("aria-pressed", String(value === mode));
  axisAdding=false;drawAxisEditor();updateAxisControls();controls();
}

function selectedAxis() { return ManualAxis.resolved(history,axisDrag).get(axisSelected); }
function vectorType() {return mode==="shape"?byId("shape-type").value:mode==="axis-edit"?selectedAxis()?.type:mode;}
function readVectorStyle(type=vectorType()) {
  const box=["rect","ellipse","roundrect","triangle","emoji"].includes(type);
  return {stroke:byId("vector-color").value,fill:box && byId("vector-filled").checked?byId("vector-fill").value:"none",width:Math.max(1,Math.min(40,Number(byId("vector-width").value)||6)),opacity:Math.max(0,Math.min(100,Number(byId("vector-opacity").value || 100)))/100,start:box?"none":byId("vector-start").value,end:box?"none":byId("vector-end").value};
}
function syncVectorStyle(object) {
  if(!object || object.kind!=="vector" || byId("vector-style").contains(document.activeElement))return;
  const s=object.style;
  byId("vector-color").value=s.stroke;byId("vector-width").value=String(s.width);byId("vector-opacity").value=String(s.opacity*100);
  byId("vector-start").value=s.start;byId("vector-end").value=s.end;
  if(ManualAxis.isBox(object) && object.type!=="emoji"){byId("vector-filled").checked=s.fill!=="none";if(s.fill!=="none")byId("vector-fill").value=s.fill;}
  if(object.type==="emoji")byId("vector-size").value=String(Math.round(ManualAxis.bounds(object).width));
}
function updateAxisControls() {
  const curve=selectedAxis(),editing=mode==="axis-edit",drawing=["trough","ridge","curve"].includes(mode);
  for(const id of ["manual-trough","manual-ridge","axis-edit",...vectorModeButtons.map(x=>x[0])])byId(id).disabled=!ready || pointer!==null;
  byId("draw-on-chart").disabled=!ready || featuresLoading || pointer!==null;
  byId("draw-on-chart").textContent=mode==="axis-edit"?"天気図で編集 →":mode==="move"?"天気図を動かす →":axisDraft?"作図を続ける →":"天気図に描く →";
  byId("axis-draft-actions").hidden=!axisDraft;
  byId("axis-finish").disabled=!axisDraft || axisDraft.points.length<2;
  byId("axis-edit-actions").hidden=!editing || !curve;
  const editableCurve=curve && ManualAxis.isCurve(curve);
  byId("axis-add-node").hidden=byId("axis-remove-node").hidden=!editableCurve;
  byId("axis-add-node").disabled=!editableCurve || curve.nodes.length>=ManualAxis.maxNodes;
  byId("axis-add-node").setAttribute("aria-pressed",String(axisAdding));
  byId("axis-remove-node").disabled=!editableCurve || curve.nodes.length<=2 || axisNode===null;
  byId("manual").querySelector(".palette").hidden=mode!=="paint";
  byId("manual").querySelector(".settings").hidden=!["paint","erase"].includes(mode);
  byId("brush-opacity").hidden=mode!=="paint";
  byId("brush-size-label").textContent=mode==="erase"?"消す範囲":"太さ";
  byId("shape-picker").hidden=mode!=="shape";
  byId("weather-picker").hidden=mode!=="emoji";
  const type=vectorType(),box=["rect","ellipse","roundrect","triangle","emoji"].includes(type);
  byId("vector-style").hidden=!(vectorModes.includes(mode) || (editing && curve?.kind==="vector"));
  byId("vector-line-style").hidden=type==="emoji";byId("vector-arrow-style").hidden=box;
  byId("vector-fill-style").hidden=!box || type==="emoji";byId("vector-size-style").hidden=type!=="emoji";
  if(editing)syncVectorStyle(curve);
  for(const button of byId("weather-picker").children)button.setAttribute("aria-pressed",String(button.dataset.weather===weatherId));
  const names={paint:"色を塗る",erase:"消しゴム",move:"画面を移動",trough:"トラフ",ridge:"リッジ",curve:"曲線",line:"直線",shape:"図形",emoji:"天気マーク","axis-edit":"選択・編集",rect:"四角",ellipse:"円・楕円",roundrect:"角丸四角",triangle:"三角"};
  const hints={
    paint:"図をドラッグして塗ります。原図の黒い線は残ります。",
    erase:"ドラッグした部分の手描きを消します。線・図形を丸ごと消すには「選択・編集」。",
    move:"拡大した天気図をドラッグして動かします。描いたものを動かすときは「選択・編集」。",
    trough:"赤い二重線。図を順にクリックして頂点を置きます。最後に「曲線を確定」またはダブルクリック。",
    ridge:"青いギザギザ線。図を順にクリックして頂点を置きます。最後に「曲線を確定」またはダブルクリック。",
    curve:"図を順にクリックして頂点を置きます。最後に「曲線を確定」またはダブルクリック。",
    line:"始点から終点までドラッグして引きます。両端の矢印と色・太さを変えられます。",
    shape:"図をドラッグして大きさを決めます。Shiftを押すと正方形・円になります。",
    emoji:"マークを選んで図をクリック。ドラッグすると大きさも決められます。"
  };
  const hint=editing ? axisAdding?"線上をクリックして頂点を追加します。":!curve?"図の上で線・図形・天気マークをクリックして選びます。":ManualAxis.isBox(curve)?"ドラッグで移動、四隅の点で大きさを調整できます。":ManualAxis.isCurve(curve)?"四角い頂点をドラッグして移動。白い丸を動かすと曲がり具合を調整できます。":"両端の点をドラッグして調整。線をドラッグすると全体を動かせます。" : hints[mode];
  const title=editing && curve ? names[curve.type]+"を編集中":names[mode];
  const state=axisDraft ? `頂点 ${axisDraft.points.length}個・作図中` : editing ? curve?"選択中":"図をクリックして選ぶ" : drawing?"クリックで頂点を置く":mode==="emoji"?"クリックで配置":"ドラッグで操作";
  for(const [id,value]of [["tool-name",title],["tool-state",state],["hint",hint]])if(byId(id).textContent!==value)byId(id).textContent=value;
  byId("vector-style-title").textContent=type==="emoji"?"マークの設定":box?"図形の設定":"線の設定";

}
function drawAxisEditor() {
  const svg=byId("axis-editor");svg.replaceChildren();
  if(!ready || byId("manual").hidden)return;
  const curve=mode==="axis-edit"?selectedAxis():null;
  const box=curve && ManualAxis.isBox(curve);
  const nodes=box?ManualAxis.corners(curve).map(p=>({p})):curve?.nodes || (axisDraft?ManualAxis.smooth(axisDraft.points,ink.width,ink.height):[]);
  if(curve && axisNode!==null && axisNode>=nodes.length)axisNode=nodes.length-1;
  if(!nodes.length)return;
  const scale=ink.width/Math.max(1,ink.getBoundingClientRect().width),radius=5*scale;
  svg.setAttribute("viewBox",`0 0 ${ink.width} ${ink.height}`);
  const element=(name,attrs)=>{
    const el=document.createElementNS("http://www.w3.org/2000/svg",name);
    for(const [key,value]of Object.entries(attrs))el.setAttribute(key,String(value));
    svg.append(el);return el;
  };
  if(box) {
    const b=ManualAxis.bounds(curve);element("rect",{x:b.x,y:b.y,width:b.width,height:b.height,fill:"none",stroke:"#2563eb","stroke-width":scale,"stroke-dasharray":`${4*scale} ${3*scale}`});
  }
  if(curve && ManualAxis.isCurve(curve) && axisNode!==null) {
    const n=nodes[axisNode];
    for(const part of ["in","out"]) {
      if((part==="in" && axisNode===0) || (part==="out" && axisNode===nodes.length-1))continue;
      element("line",{x1:n.p[0],y1:n.p[1],x2:n[part][0],y2:n[part][1],stroke:"#2563eb","stroke-width":1.5*scale});
      element("circle",{cx:n[part][0],cy:n[part][1],r:radius,fill:"#fff",stroke:"#2563eb","stroke-width":1.5*scale,"data-handle":part});
    }
  }
  nodes.forEach((n,i)=>element("rect",{x:n.p[0]-radius,y:n.p[1]-radius,width:radius*2,height:radius*2,fill:i===axisNode?"#2563eb":"#fff",stroke:"#243247","stroke-width":1.5*scale,"data-node":i}));
}
function completeAxis(edit=true) {
  if(!axisDraft)return;
  const draft=axisDraft;axisDraft=axisPreview=null;
  if(draft.points.length>=2) {
    const curve=draft.type==="curve"?{kind:"vector",id:crypto.randomUUID(),type:"curve",nodes:ManualAxis.smooth(draft.points,ink.width,ink.height),style:draft.style,emoji:null}:{kind:"axis",id:crypto.randomUUID(),type:draft.type,nodes:ManualAxis.smooth(draft.points,ink.width,ink.height)};
    history.push(curve);future.length=0;axisSelected=curve.id;axisNode=0;
    if(edit)selectMode("axis-edit");
  }
  render();controls();
}
function cancelAxis() {axisDraft=axisPreview=null;render();controls();}
function commitAxisEdit(nodes) {
  const object=selectedAxis();if(!object)return;
  history.push(object.kind==="vector"?{kind:"vector-edit",id:axisSelected,value:{...object,nodes}}:{kind:"axis-edit",id:axisSelected,nodes});future.length=0;render();controls();
}
function axisDown(p) {
  const pos=[p.x,p.y],tolerance=12*ink.width/ink.getBoundingClientRect().width;
  if(["trough","ridge","curve"].includes(mode)) {
    if(!axisDraft)axisDraft={type:mode,points:[],style:readVectorStyle("curve")};
    if(axisDraft.points.length<ManualAxis.maxNodes && (!axisDraft.points.length || ManualAxis.distance(pos,axisDraft.points.at(-1))>tolerance/12))axisDraft.points.push(pos);
    axisPreview=null;render();controls();return;
  }
  let curve=selectedAxis(),hit=null;
  if(curve && !axisAdding) {
    const targets=(ManualAxis.isBox(curve)?ManualAxis.corners(curve).map(p=>({p})):curve.nodes).map((n,i)=>({index:i,part:ManualAxis.isBox(curve)?"resize":"p",distance:ManualAxis.distance(n.p,pos)}));
    if(axisNode!==null && ManualAxis.isCurve(curve))for(const part of ["in","out"])
      if(!((part==="in" && axisNode===0)||(part==="out" && axisNode===curve.nodes.length-1)))targets.push({index:axisNode,part,distance:ManualAxis.distance(curve.nodes[axisNode][part],pos)});
    const nearest=targets.sort((a,b)=>a.distance-b.distance)[0];
    if(nearest.distance<tolerance)hit={index:nearest.index,part:nearest.part};
  }
  if(hit) {axisNode=hit.index;axisDrag={id:curve.id,...hit,before:ManualAxis.copy(curve.nodes),nodes:ManualAxis.copy(curve.nodes),original:ManualAxis.clone(curve),start:pos};}
  else {
    const nearest=[...ManualAxis.resolved(history).values()].reverse().map(c=>({curve:c,hit:ManualAxis.hit(c,pos,tolerance)})).sort((a,b)=>a.hit.distance-b.hit.distance)[0];
    if(nearest && nearest.hit.distance<tolerance) {
      curve=nearest.curve;axisSelected=curve.id;
      if(axisAdding && ManualAxis.isCurve(curve) && curve.nodes.length<ManualAxis.maxNodes && nearest.hit.t>0.02 && nearest.hit.t<0.98) {
        axisNode=nearest.hit.segment+1;commitAxisEdit(ManualAxis.insert(curve.nodes,nearest.hit.segment,nearest.hit.t));
      } else {
        axisNode=ManualAxis.isBox(curve)?null:curve.nodes.reduce((best,n,i)=>ManualAxis.distance(n.p,pos)<ManualAxis.distance(curve.nodes[best].p,pos)?i:best,0);
        axisDrag={id:curve.id,part:"translate",original:ManualAxis.clone(curve),value:ManualAxis.clone(curve),start:pos};
      }
    } else {axisSelected=axisNode=null;}
    axisAdding=false;
  }
  render();controls();
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
  const frame = rowView === null ? null : rowFrames?.[rowView];
  const width = Math.floor((frame ? ChartView.fittedWidth(frame,ink.width,size) : fitView ? Math.min(size.width, size.height * ink.width / ink.height) : size.width * zoomFactor)+1e-7);
  paper.style.width = `${Math.floor(width)}px`;
  paper.style.height = `${Math.floor(width) * ink.height / ink.width}px`;
  if (fitView) { viewport.scrollTop = 0; viewport.scrollLeft = 0; zoomFactor = Math.floor(width) / size.width; }
  else if (frame) {
    zoomFactor = Math.floor(width)/size.width;
    const rect = paper.getBoundingClientRect();
    viewport.scrollLeft += rect.left+(frame[0]+frame[2])/2*rect.width/ink.width-focus.x;
    viewport.scrollTop += rect.top+(frame[1]+frame[3])/2*rect.height/ink.height-focus.y;
  }
  else { const rect = paper.getBoundingClientRect(); viewport.scrollLeft += rect.left + center.x * rect.width - focus.x; viewport.scrollTop += rect.top + center.y * rect.height - focus.y; }
  updateZoomLabel();
  drawAxisEditor();
  controls();
}
function setZoom(factor, anchor) {
  if (!ready || pointer !== null) return;
  zoomFactor = Math.max(0.25, Math.min(4, factor)); fitView = false; rowView = null; fit(anchor);
}
function zoomBy(direction) {
  if (!ready || pointer !== null) return;
  setZoom(direction > 0 ? (zoomSteps.find((x) => x > zoomFactor + 0.005) || 4) : ([...zoomSteps].reverse().find((x) => x < zoomFactor - 0.005) || 0.25));
}
byId("zoom-in").addEventListener("click", () => zoomBy(1));
byId("zoom-out").addEventListener("click", () => zoomBy(-1));
byId("fit").addEventListener("click", () => { fitView = true; rowView = null; fit(); });
for (const [id,row] of [["fit-upper",0],["fit-lower",1]]) byId(id).addEventListener("click", () => {
  if (!ready || featuresLoading || !rowFrames || pointer !== null) return;
  fitView = false; rowView = row; fit();
});
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
byId("draw-on-chart").addEventListener("click", () => { setPanel(false); viewport.focus({preventScroll:true}); });
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
  if (["trough","ridge","curve","axis-edit"].includes(mode)) {
    axisDown(point(event));
  } else if(["line","shape","emoji"].includes(mode)) {
    const p=point(event),type=vectorType();
    activeVector={kind:"vector",id:crypto.randomUUID(),type,nodes:ManualAxis.anchors([[p.x,p.y],[p.x,p.y]]),style:readVectorStyle(type),emoji:type==="emoji"?weatherId:null};render();
  } else if (mode === "move") {
    rowView = null; controls();
    pan = { x: event.clientX, y: event.clientY, left: viewport.scrollLeft, top: viewport.scrollTop };
  } else {
    active = { kind: mode, color, width: Number(byId("width").value) * ink.width / ink.getBoundingClientRect().width, opacity: Number(byId("opacity").value), points: [point(event)] };
    render();
  }
  controls();
});

ink.addEventListener("pointermove", (event) => {
  if(pointer===null && axisDraft) {const p=point(event);axisPreview=[p.x,p.y];render();return;}
  if (event.pointerId !== pointer) return;
  if(axisDrag) {
    const p=point(event),pos=[p.x,p.y];
    if(axisDrag.part==="translate")axisDrag.value=ManualAxis.translate(axisDrag.original,pos.map((v,k)=>v-axisDrag.start[k]),ink.width,ink.height);
    else if(axisDrag.part==="resize")axisDrag.value=ManualAxis.resize(axisDrag.original,axisDrag.index,pos,ink.width,ink.height);
    else axisDrag.nodes=ManualAxis.move(axisDrag.before,axisDrag.index,axisDrag.part,pos,ink.width,ink.height);
    render();
  } else if(activeVector) {
    const p=point(event),start=activeVector.nodes[0].p;
    if(event.shiftKey && ManualAxis.isBox(activeVector)) {
      const size=Math.max(Math.abs(p.x-start[0]),Math.abs(p.y-start[1]));
      p.x=Math.max(0,Math.min(ink.width,start[0]+Math.sign(p.x-start[0] || 1)*size));p.y=Math.max(0,Math.min(ink.height,start[1]+Math.sign(p.y-start[1] || 1)*size));
    }
    activeVector.nodes=ManualAxis.anchors([start,[p.x,p.y]]);render();
  } else if (pan) {
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
  if(axisDrag) {
    const edit=axisDrag;axisDrag=null;
    const value=edit.value || {...edit.original,nodes:edit.nodes};
    if(event.type!=="pointercancel" && JSON.stringify(value)!==JSON.stringify(edit.original)) {
      history.push(value.kind==="vector"?{kind:"vector-edit",id:edit.id,value}:{kind:"axis-edit",id:edit.id,nodes:value.nodes});future.length=0;
    }
  }
  if(activeVector) {
    const object=activeVector;activeVector=null;
    if(event.type!=="pointercancel") {
      const [a,b]=object.nodes.map(n=>n.p);
      if(ManualAxis.isBox(object) && (Math.abs(b[0]-a[0])<3 || Math.abs(b[1]-a[1])<3)) {
        const size=object.type==="emoji"?Math.max(24,Math.min(Number(byId("vector-size").value)||140,ink.width,ink.height)):140;
        const x=Math.max(0,Math.min(ink.width-size,a[0]-size/2)),y=Math.max(0,Math.min(ink.height-size,a[1]-size/2));
        object.nodes=ManualAxis.anchors([[x,y],[x+size,y+size]]);
      } else if(object.type==="line" && ManualAxis.distance(a,b)<3)object.nodes=ManualAxis.anchors([a,[a[0]+(a[0]>ink.width-140?-140:140),a[1]]]);
      if(ManualAxis.validVector(object,ink.width,ink.height)){history.push(object);future.length=0;axisSelected=object.id;axisNode=0;selectMode("axis-edit");}
    }
  }
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
ink.addEventListener("dblclick", () => {if(axisDraft)completeAxis();});
for(const [id,value]of [["manual-trough","trough"],["manual-ridge","ridge"],["axis-edit","axis-edit"]])byId(id).addEventListener("click",()=>selectMode(value));
for(const [id,value]of vectorModeButtons)byId(id).addEventListener("click",()=>selectMode(value));
byId("shape-type").addEventListener("change",()=>updateAxisControls());
byId("weather-picker").replaceChildren(...ManualAxis.weather.map(item=>{
  const button=document.createElement("button");button.type="button";button.textContent=item.glyph;button.title=item.label;button.setAttribute("aria-label",item.label);button.dataset.weather=item.id;
  button.addEventListener("click",()=>{weatherId=item.id;selectMode("emoji");});return button;
}));
function changeVectorStyle() {
  const object=selectedAxis();
  if(axisDraft?.type==="curve") {axisDraft.style=readVectorStyle("curve");render();return;}
  if(mode==="axis-edit" && object?.kind==="vector") {
    const value={...ManualAxis.clone(object),style:readVectorStyle(object.type)};
    history.push({kind:"vector-edit",id:object.id,value});future.length=0;render();controls();
  }
}
for(const id of ["vector-color","vector-width","vector-opacity","vector-start","vector-end","vector-fill","vector-filled"])byId(id).addEventListener("change",changeVectorStyle);
byId("vector-size").addEventListener("change",()=>{
  const object=selectedAxis();if(mode!=="axis-edit" || object?.type!=="emoji")return;
  const b=ManualAxis.bounds(object),size=Math.max(24,Math.min(Number(byId("vector-size").value)||140,ink.width,ink.height));
  const x=Math.max(0,Math.min(ink.width-size,b.x+b.width/2-size/2)),y=Math.max(0,Math.min(ink.height-size,b.y+b.height/2-size/2));
  commitAxisEdit(ManualAxis.anchors([[x,y],[x+size,y+size]]));
});
byId("axis-finish").addEventListener("click",()=>completeAxis());
byId("axis-cancel").addEventListener("click",cancelAxis);
byId("axis-add-node").addEventListener("click",()=>{axisAdding=!axisAdding;updateAxisControls();});
byId("axis-remove-node").addEventListener("click",()=>{
  const curve=selectedAxis();
  if(!curve || !ManualAxis.isCurve(curve) || curve.nodes.length<=2 || axisNode===null)return;
  const nodes=ManualAxis.copy(curve.nodes);nodes.splice(axisNode,1);axisNode=Math.min(axisNode,nodes.length-1);commitAxisEdit(nodes);
});
byId("axis-remove").addEventListener("click",()=>{
  if(!selectedAxis())return;
  history.push({kind:"axis-delete",id:axisSelected});future.length=0;axisSelected=axisNode=null;render();controls();
});

for (const id of ["paint", "erase", "move"]) byId(id).addEventListener("click", () => selectMode(id));
for (const swatch of document.querySelectorAll("[data-color]")) swatch.addEventListener("click", () => {
  color = swatch.dataset.color; byId("color").value = color; selectMode("paint");
  for (const button of document.querySelectorAll("[data-color]")) button.setAttribute("aria-pressed", String(button === swatch));
});
byId("color").addEventListener("input", (event) => {
  color = event.target.value; selectMode("paint");
  for (const button of document.querySelectorAll("[data-color]")) button.setAttribute("aria-pressed", "false");
});
byId("undo").addEventListener("click", () => {
  if(pointer!==null)return;
  if(axisDraft) {axisDraft.points.pop();if(!axisDraft.points.length)axisDraft=null;axisPreview=null;render();controls();}
  else if(history.length) { future.push(history.pop()); render(); controls(); }
});
byId("redo").addEventListener("click", () => { if (future.length && pointer === null) { history.push(future.pop()); render(); controls(); } });
byId("clear").addEventListener("click", () => byId("clear-dialog").showModal());
byId("clear-dialog").addEventListener("close", () => {
  if (byId("clear-dialog").returnValue === "clear") { axisDraft=axisPreview=null;history.push({ kind: "clear" }); future.length = 0; render(); controls(); }
});
byId("zoom").addEventListener("change", (event) => {
  if (event.target.value === "fit") { fitView = true; rowView = null; fit(); }
  else if (event.target.value !== "custom") setZoom(Number(event.target.value));
});
new ResizeObserver(() => fit()).observe(viewport);

byId("save").addEventListener("click", () => {
  if (!ready || featuresLoading || !currentSelection || axisDraft || pointer!==null) return;
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
  const footerHeight = (ensemble ? 530 : ((trial?.product==="AUPA20" || lowLevel || dynamics || trial?.color_only || trial?.surface_forecast || trial?.feas_forecast || trial?.equivalent_temperature) ? 440 : exportTerrain ? 340 : 260) + (exportWarm ? 56 : 0) + ((trial?.surface_forecast || trial?.feas_forecast) && exportTerrain ? 170 : 0));
  output.width = ink.width; output.height = ink.height + footerHeight + temperatureFooterHeight + overlayFooterHeight;
  const ctx = output.getContext("2d");
  ctx.fillStyle = "white"; ctx.fillRect(0, 0, output.width, output.height);
  ctx.drawImage(chart, 0, 0);
  ctx.globalCompositeOperation = "multiply"; ctx.drawImage(geographyLayer, 0, 0); ctx.drawImage(tropopauseLayer,0,0); ctx.drawImage(windLayer, 0, 0); ctx.drawImage(analysisLayer, 0, 0);
  ctx.globalCompositeOperation = "source-over"; ctx.drawImage(jetLayer, 0, 0);
  ctx.drawImage(temperatureLayer, 0, 0);
  ctx.drawImage(symbolLayer, 0, 0);
  ctx.globalCompositeOperation = "multiply"; ctx.drawImage(overlayLayer, 0, 0); ctx.drawImage(ink, 0, 0); ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "#243247"; ctx.font = "24px sans-serif";
  ctx.fillText(`出典：気象庁 ${selected.product.code}（画像化） / ${chartLabel}`, 26, ink.height + 38, output.width - 52);
  ctx.fillText(trial?.product==="AUPA20"?`200hPaジェット軸：${showJet?"原図の矢印を白縁付きの赤で着色":"表示なし"} / 手描き：利用者`:`解析案：${showTrough700 && (lowLevel || isFeas()) ? (isFeas()?"地上トラフ ":"700hPaトラフ ") : ""}${showTrough ? (lowLevel?"850hPaトラフ ":"500hPaトラフ ") : ""}${showRidge700 && (lowLevel || isFeas()) ? (isFeas()?"地上リッジ ":"700hPaリッジ ") : ""}${showRidge ? (lowLevel?"850hPaリッジ ":"500hPaリッジ ") : ""}${showJet ? `${trial?.panels[0].pressure_hpa||300}hPa強風軸（白縁付きの赤）` : ""}${!showTrough700 && !showRidge700 && !showTrough && !showRidge && !showJet ? "表示なし" : ""} / 手描き：利用者`, 26, ink.height + 76);
  if (showSymbols && symbols && !ensemble) for (const [index, letter] of ["L", "H", "C", "W"].entries()) {
    ctx.fillStyle = ChartAnalysis.symbolPalette[letter]; ctx.fillText(letter, 1610 + index * 90, ink.height + 76);
  }
  ctx.fillStyle = "#243247";
  ctx.font = "22px sans-serif"; ctx.fillText(trial?.surface_forecast ? "上段：500hPa高度・渦度 / 下段：地上気圧・風・降水量" : showWind ? `風速（${trial?.panels[0].pressure_hpa||300}hPa）` : "風速の色塗り：表示なし", 26, ink.height + 116);
  if (showWind && windBands) for (const [index, color] of ChartAnalysis.windPalette.entries()) {
    const x = 230 + index * 260;
    ctx.fillStyle = color; ctx.fillRect(x, ink.height + 95, 32, 24);
    ctx.fillStyle = "#243247"; ctx.fillText(windLabels[index], x + 42, ink.height + 116);
  }
  ctx.fillText(trial?.color_only ? "原図の等温線と縦線範囲を着色。予報の有効時刻は各枠の印字を確認してください。" : trial ? "解析試行：気象学的な精度は未検証。" : lowLevel ? "トラフ：この原図の等高度線の谷から推定した赤い二重線。汎用の自動検出ではありません。" : selected.variant.features === "reviewed-aupq35" ? "赤矢印：等風速線の強い帯の中心（流れの経路はこの1枚で確認）。トラフ：等高度線の曲がりから推定。" : `${selected.product.name}${selected.product.period ? " · " + selected.product.period : ""}`, 26, ink.height + 155, output.width - 52);
  ctx.fillText("利用者の着色・解析は気象庁の公式の解析ではありません。天気図解析マスター · Weather Chart Analysis Master · Bousai Wx Lab", 26, ink.height + 193, output.width - 52);
  const geoLabel = showGeography && geography ? `${ChartGeography.patterns.find(p => p.id === geographyStyle).label}（濃さ${Math.round(geographyOpacity * 100)}%）` : "表示なし";
  ctx.fillText(geography ? `陸海：${geoLabel}${showGeography && geographyStyle === "satellite" ? " / NASA Earth Observatory・Reto Stoeckli / 2004年10月の地表画像（投影変換）" : ""}` : "自動更新なし。解析・予想の日時は原図内を確認してください。", 26, ink.height + 231, output.width - 52);
  if(dynamics || trial?.feas_forecast) {
    ctx.fillText(`500hPa正渦度：${showVorticity?"ピンク・濃さ30%":"表示なし"}${isFeas()||trial?.feas_forecast?"":` / 700hPa上昇流：${showAscent?"黄緑・濃さ30%":"表示なし"}`}`,26,ink.height+275);
    ctx.fillText(`850hPa寒気：${showCold850?`濃さ${Math.round(coldOpacity*100)}%`:"表示なし"}`,26,ink.height+319);
    for(const [i,v] of coloringRules.coldThresholds[850].entries()) {const x=420+i*285;ctx.save();ctx.globalAlpha=coldOpacity;ctx.fillStyle=LowLevelAnalysis.coldColors[i];ctx.fillRect(x,ink.height+297,32,24);ctx.restore();ctx.fillText(`${v}℃以下`,x+42,ink.height+319);}
  }
  if(trial?.product==="AUPA20"){
    ctx.fillText(`圏界面の気圧：${showTropopause?"150hPa未満は無色・ピンク→赤紫→紫・濃さ35%":"表示なし"} / 境界50hPa間隔・数値100hPa間隔`,26,ink.height+280,output.width-52);
    for(const [i,item]of SnapshotAnalysis.tropopauseLegend().entries()){const x=26+i*(output.width-52)/7;ctx.save();if(item.color){ctx.globalAlpha=coloringRules.tropopauseOpacity;ctx.fillStyle=item.color;ctx.fillRect(x,ink.height+305,32,24);}else{ctx.strokeStyle="#cbd5e1";ctx.strokeRect(x,ink.height+305,32,24);}ctx.restore();ctx.fillText(item.label,x+40,ink.height+327,(output.width-52)/7-46);}
    ctx.fillText("気圧が低いほど圏界面は高い位置にあります。",26,ink.height+371,output.width-52);
  }
  if(trial?.equivalent_temperature){
    ctx.fillText(`850hPa相当温位：${showEquivalent?`濃さ${Math.round(equivalentOpacity*100)}%`:"表示なし"} / 260〜370 K / 原図の3 Kごとの境界`,26,ink.height+280,output.width-52);
    const gradient=ctx.createLinearGradient(26,0,output.width-26,0);for(const [v,c]of SnapshotAnalysis.equivalentStops)gradient.addColorStop((v-260)/110,c);
    ctx.save();ctx.globalAlpha=equivalentOpacity;ctx.fillStyle=gradient;ctx.fillRect(26,ink.height+305,output.width-52,24);ctx.restore();
    for(const v of [260,280,300,315,330,350,370]){ctx.fillText(`${v} K`,Math.min(output.width-94,26+(v-260)/110*(output.width-52)),ink.height+360);}
    ctx.fillText("各枠の有効時刻は原図の印字を確認。範囲外は端点色。",26,ink.height+405,output.width-52);
  }
  if(trial?.surface_forecast){
    ctx.fillText(`500hPa正渦度：${showVorticity?"ピンク・濃さ30%":"表示なし"}`,26,ink.height+275);
    ctx.fillText(`地上の降水量：${showPrecipitation?"水色〜青・濃さ45%":"表示なし"}（各予報時刻までの前${trialOther().accumulation_hours}時間の積算）`,26,ink.height+315,output.width-52);
    for(const [i,label] of SnapshotAnalysis.precipitationLabels.entries()){
      const x=26+i*(output.width-52)/6;ctx.save();ctx.globalAlpha=coloringRules.precipitationOpacity;ctx.fillStyle=SnapshotAnalysis.precipitationColors[i];ctx.fillRect(x,ink.height+339,32,24);ctx.restore();ctx.fillText(label,x+40,ink.height+361);
    }
    ctx.fillText("原図の0・10・20・30・40・50mmの等降水量線で区切ります。降水のない範囲は塗りません。",26,ink.height+404,output.width-52);
  }
  if(trial?.color_only) {
    ctx.fillText(`700hPa湿域：${showWet?"青水色・濃さ30%":"表示なし"} / 上昇流：${showAscent?"黄緑・濃さ30%":"表示なし"}`,26,ink.height+350,output.width-52);
    ctx.fillText(`850hPa寒気：${showCold850?`濃さ${Math.round(coldOpacity*100)}%`:"表示なし"}`,26,ink.height+394);
    for(const [i,v] of coloringRules.coldThresholds[850].entries()) {const x=420+i*285;ctx.save();ctx.globalAlpha=coldOpacity;ctx.fillStyle=LowLevelAnalysis.coldColors[i];ctx.fillRect(x,ink.height+372,32,24);ctx.restore();ctx.fillText(`${v}℃以下`,x+42,ink.height+394);}
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
    const terrainOffset = ensemble ? 110 : trial?.surface_forecast || trial?.feas_forecast ? 170 : 0;
    ctx.fillText("地表標高：NOAA ETOPO 2022 / EGM2008基準 / 1分格子（南北約1.9km）/ 投影変換した広域表示", 26, ink.height + 268 + terrainOffset);
    if (geographyStyle === "relief") ctx.fillText("陰影の明暗は斜面の向き・傾き。北西からの照明で山の凹凸を強調しています。", 26, ink.height + 307 + terrainOffset);
    else for (const [index, label] of elevationData.legend.labels.entries()) {
      const x = 26 + index * 275;
      ctx.save(); ctx.globalAlpha = geographyOpacity; ctx.fillStyle = elevationData.legend.colors[index]; ctx.fillRect(x, ink.height + 287 + terrainOffset, 30, 24); ctx.restore();
      ctx.fillStyle = "#243247"; ctx.fillText(label, x + 39, ink.height + 307 + terrainOffset);
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
  if(ensemble){
    ctx.fillStyle="white";ctx.fillRect(0,ink.height+49,output.width,143);
    ctx.fillStyle="#243247";ctx.font="22px sans-serif";
    ctx.fillText(`参考着色：Lは赤・Hは青（${showSymbols?"表示中":"OFF"}） / 手描き：利用者`,26,ink.height+76);
    const info=EnsembleColoring.legends(ensemble.product);
    ctx.fillText(ensemble.product==="fxxn519"?`${info.anomaly}（${showVorticity?"表示中":"OFF"}）`:`${info.rain}：${showPrecipitation?"水色〜青":"OFF"}`,26,ink.height+116,output.width-52);
    ctx.fillText(info.note,26,ink.height+155,output.width-52);
    ctx.fillText("利用者の着色・解析は気象庁の公式の解析ではありません。天気図解析マスター · Weather Chart Analysis Master · Bousai Wx Lab",26,ink.height+193,output.width-52);
    ctx.fillText(ensemble.product==="fxxn519"?`${info.height}（${showAscent?"表示中":"OFF"}）`:ensemble.product==="fzcx50"?`正渦度の斜線域：${showVorticity?"ピンク":"OFF"} / 気温偏差の曲線と0線の間：${showAscent?"正は赤・負は青の透過":"OFF"}`:"濃淡は領域の強調で、雨量・降水確率を表しません。",26,ink.height+275,output.width-52);
    ctx.fillText(ensemble.product==="fxxn519"?`850hPa：寒気${showCold850?Math.round(coldOpacity*100)+"％":"OFF"} / 暖気${showWarm850?Math.round(warmOpacity*100)+"％":"OFF"}。原図の等温線を確認してください。`:"濃淡から新しい数値を読み取らず、各枠の等値線・数値・有効時刻を確認してください。",26,ink.height+319,output.width-52);
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
  if(!byId("manual").hidden && !["INPUT","SELECT","TEXTAREA"].includes(event.target.tagName) && !byId("clear-dialog").open && !byId("share-dialog").open && !byId("overlay-dialog").open) {
    if(event.key==="Enter" && axisDraft && axisDraft.points.length>=2) {event.preventDefault();completeAxis();return;}
    if(event.key==="Escape" && (axisDraft || axisDrag || activeVector || mode==="axis-edit")) {activeVector=null;axisDrag=null;pointer=null;ink.dataset.dragging="false";axisSelected=axisNode=null;cancelAxis();return;}
    if((event.key==="Delete" || event.key==="Backspace") && mode==="axis-edit" && selectedAxis()) {event.preventDefault();byId(ManualAxis.isCurve(selectedAxis()) && axisNode!==null?"axis-remove-node":"axis-remove").click();return;}
  }
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
  const colored = reviewed || EnsembleColoring.products.includes(selected.product.id);
  for (const canvas of [analysisLayer, jetLayer, tropopauseLayer, windLayer, geographyLayer, symbolLayer, temperatureLayer, overlayLayer]) {
    canvas.width = colored || canvas === geographyLayer ? chart.naturalWidth : 1;
    canvas.height = colored || canvas === geographyLayer ? chart.naturalHeight : 1;
    canvas.hidden = !colored && canvas !== geographyLayer;
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
function captureDrawing() {
  return { history: [...history], future: [...future], showTropopause, showWind, showTrough, showRidge, showJet, showSymbols, showGeography, geographyStyle, geographyOpacity, showTemperature, showTemperature500, showVorticity, showAscent, showPrecipitation, showEquivalent, equivalentOpacity, showWet, showCold700, showCold850, showWarm850, warmOpacity, showTrough700, showRidge700, coldOpacity, overlayTarget, overlays: overlayState.map(layer => ({...layer})) };
}
function keepDrawing() {
  if (pointer !== null) finish({pointerId:pointer});
  if(axisDraft)completeAxis(false);
  if (ready && currentSelection) drawingStates.set(currentSelection.key,captureDrawing());
}
function shareMessage(message) {
  byId("share-message").textContent = message;
  byId("share-message").hidden = !message;
  if (message) byId("status").textContent = message;
}
function captureShared() {
  return {
    version:3,chart:ChartShare.identity(currentSelection),drawing:ChartShare.currentDrawing(captureDrawing()),
    view:{fit:fitView,zoom:fitView ? 1 : zoomFactor,x:viewport.scrollLeft/Math.max(1,viewport.scrollWidth-viewport.clientWidth),y:viewport.scrollTop/Math.max(1,viewport.scrollHeight-viewport.clientHeight)}
  };
}
async function copyShareLink(link) {
  try {
    if (!navigator.clipboard?.writeText) throw Error("Copy unavailable");
    await navigator.clipboard.writeText(link);
    shareMessage("共有リンクをコピーしました。貼り付けて共有できます。");
    return true;
  } catch { return false; }
}
byId("share").addEventListener("click",async () => {
  if (byId("share").disabled) return;
  const revision = loadRevision, captured = captureShared();
  shareBusy = true; shareMessage(""); controls();
  try {
    if ([loadingError,geographyError,terrainError,symbolError,temperatureError,analysisError,overlayError].some(Boolean) || validOverlays().length !== overlayState.length) throw Error("解析の読み込みを確認できないため、共有リンクを作成できません。図を再読み込みしてください。");
    const fragment = await ChartShare.encode(captured);
    if (revision !== loadRevision) return;
    const url = new URL(location.href); url.search = ""; url.hash = fragment;
    const link = url.href;
    if (!await copyShareLink(link)) {
      byId("share-url").value = link;
      byId("share-copy-note").textContent = "リンク欄を選択してコピーすることもできます。";
      byId("share-dialog").showModal(); byId("share-url").focus(); byId("share-url").select();
      shareMessage("共有リンクを作成しました。開いた欄からコピーしてください。");
    }
  } catch (error) { shareMessage(error.message); }
  finally { shareBusy = false; controls(); }
});
byId("share-copy").addEventListener("click",async () => {
  if (await copyShareLink(byId("share-url").value)) byId("share-dialog").close();
  else {
    byId("share-copy-note").textContent = "自動コピーを利用できません。選択したリンクをコピーしてください。";
    byId("share-url").focus(); byId("share-url").select();
  }
});
byId("share-close").addEventListener("click",() => byId("share-dialog").close());
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
async function loadSelection(retry = false, shared = null) {
  keepDrawing();
  if (shared) drawingStates.set(`${shared.chart.product}/${shared.chart.variant}/${shared.chart.page}`,shared.drawing);
  shareMessage("");
  const revision = ++loadRevision;
  loadController?.abort(); loadController = new AbortController();
  const signal = loadController.signal;
  const selected = ChartCatalog.selection(catalog, byId("chart-select").value, byId("source-select").value, Number(byId("page-select").value));
  currentSelection = selected; ready = false; paper.hidden = true; paper.dataset.ready = "false";
  active = pointer = pan = null;
  activeVector=null;
  axisDraft=axisPreview=axisSelected=axisNode=axisDrag=null;axisAdding=false;
  geographyMask = geographyBase = geography = satelliteImage = elevationData = terrainImage = symbols = windBands = candidates = isotherms = lowLevel = dynamics = trial = ensemble = null;
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
  showPrecipitation=state?.showPrecipitation ?? true;
  showEquivalent=state?.showEquivalent ?? true;equivalentOpacity=state?.equivalentOpacity ?? coloringRules.equivalentOpacity;byId("equivalent-opacity").value=String(Math.round(equivalentOpacity*100));
  showWet=state?.showWet ?? true;showCold700=state?.showCold700 ?? true;showCold850=state?.showCold850 ?? true;showWarm850=state?.showWarm850 ?? true;warmOpacity=state?.warmOpacity ?? coloringRules.warmOpacity;byId("warm-opacity").value=String(Math.round(warmOpacity*100));showTrough700=state?.showTrough700 ?? true;showRidge700=state?.showRidge700 ?? true;coldOpacity=state?.coldOpacity ?? coloringRules.coldOpacity;byId("cold-opacity").value=String(Math.round(coldOpacity*100));
  showTropopause=state?.showTropopause ?? true;
  showWind = state?.showWind ?? true; showTrough = state?.showTrough ?? true; showRidge = state?.showRidge ?? true; showJet = state?.showJet ?? true;
  showSymbols = state?.showSymbols ?? true; showGeography = state?.showGeography ?? true;
  showTemperature = state?.showTemperature ?? true;
  showTemperature500 = state?.showTemperature500 ?? true;
  geographyStyle = state?.geographyStyle || defaultGeographyStyle; geographyOpacity = state?.geographyOpacity ?? 0.4;
  byId("geography-opacity").value = String(Math.round(geographyOpacity * 100));
  fitView = true; rowView = rowFrames = null;
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
  byId("source-select").title = chartLabel + (isTrialSelection(selected) ? " / 解析試行：気象学的な精度は未検証。" : "");
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
    if(EnsembleColoring.products.includes(selected.product.id)) await loadEnsemble(selected,revision,signal);
    else if(isTrialSelection(selected)) await loadTrial(selected,revision,signal);
    else if (selected.variant.features === "reviewed-aupq78") await loadLowLevel(selected,revision,signal);
    else if (["reviewed-axfe578","reviewed-feas50"].includes(selected.variant.features)) await loadDynamics(selected,revision,signal);
    else if (reviewed) await loadFeatures(selected, revision, signal);
    if(selected.variant.features!=="reviewed-aupq35")await loadGeographyAtlas(selected,revision,signal);
    if (revision === loadRevision) {
      featuresLoading = false; byId("manual-only").hidden = reviewed || Boolean(geography); controls();
      if (shared) {
        if (validOverlays().length !== shared.drawing.overlays.length) {
          history.length = future.length = 0; overlayState = []; render(); drawOverlays(); controls();
          shareMessage("共有リンクの重ね合わせを確認できないため、手描きの復元を停止しました。");
        } else {
          fitView = shared.view.fit; rowView = null; zoomFactor = shared.view.zoom; fit();
          viewport.scrollLeft = shared.view.x * Math.max(0,viewport.scrollWidth-viewport.clientWidth);
          viewport.scrollTop = shared.view.y * Math.max(0,viewport.scrollHeight-viewport.clientHeight);
          shareMessage([geographyError,terrainError,symbolError,temperatureError,analysisError,overlayError].some(Boolean) || geographyStyle !== shared.drawing.geographyStyle ? "共有された図は開きましたが、解析の一部を復元できませんでした。" : "共有された天気図・解析・手描きを復元しました。");
        }
      }
    }
  } catch (error) {
    if (revision !== loadRevision || error.name === "AbortError") return;
    loadingError = "図を読み込めませんでした。「図を再読み込み」か別の天気図を選んでください。";
    byId("chart-retry").hidden = false; controls();
  }
}
function ensembleLegends() {
  const fefe=ensemble.product==="fefe19", info=EnsembleColoring.legends(ensemble.product);
  const common=document.querySelector('[data-layer="symbols"]').parentElement;
  common.querySelector("h3 span").textContent="各予想図";
  if(ensemble.product==="fxxn519"){
    common.append(document.querySelector('[data-layer="vorticity"]'),document.querySelector('[data-layer="ascent"]'));
    byId("symbol-color").textContent="L・Hの文字";
    byId("detail-symbols").querySelector(".symbol-c").hidden=true;byId("detail-symbols").querySelector(".symbol-w").hidden=true;
    byId("vorticity").textContent="500hPa高度の平年偏差";byId("ascent").textContent=ensemble.unavailable_layers?.height5880?"5880m以上（境界再解析中）":"5880m以上をピンク";
    byId("detail-vorticity").querySelector(".legend").textContent=info.anomaly+"。"+info.note;
    byId("detail-ascent").querySelector(".legend").textContent=(ensemble.unavailable_layers?.height5880?"原図の5880mの線との一致を確認できないため、自動着色を停止しています。":"")+info.height+"。地上の気温や太平洋高気圧の確定線とは区別します。";
    byId("upper-plane").textContent="500 hPa · 上段の平均図";byId("lower-plane").textContent="850 hPa · 下段の各予想図";
    byId("lower-plane").parentElement.append(document.querySelector('[data-layer="cold850"]'),document.querySelector('[data-layer="warm850"]'));
    for(const id of ["cold850","warm850"]){
      byId(`detail-${id}`).querySelector("p").textContent=info.temperature;
      if(ensemble.unavailable_layers?.[id]){byId(id).textContent=(id==="cold850"?"寒気":"暖気")+"（境界再解析中）";byId(`detail-${id}`).querySelector("p").textContent="原図の等温線との一致を確認できないため、自動着色を停止しています。"+info.temperature;}
    }
    for(const [id,values,colors] of [["cold850",coloringRules.coldThresholds[850],LowLevelAnalysis.coldColors],["warm850",LowLevelAnalysis.warmThresholds,LowLevelAnalysis.warmColors]]){
      byId(`${id}-legend`).replaceChildren();
      for(const [i,v] of values.entries()){const item=document.createElement("span"),swatch=document.createElement("i");swatch.style.backgroundColor=colors[i];item.append(swatch,`${v}℃${id==="cold850"?"以下":"以上"}`);byId(`${id}-legend`).append(item);}
    }
    return;
  }
  common.append(document.querySelector('[data-layer="precipitation"]'));
  byId("precipitation").textContent=fefe?"降水域の色塗り":"降水予想頻度の色塗り";
  byId("symbol-color").textContent="L・Hの文字";
  byId("detail-symbols").querySelector(".symbol-c").hidden=true;
  byId("detail-symbols").querySelector(".symbol-w").hidden=true;
  byId("precipitation-legend").replaceChildren();
  byId("precipitation-legend").setAttribute("aria-label",info.rain);
  for(const [i,label] of info.bands.entries()){
    const item=document.createElement("span"),swatch=document.createElement("i");
    swatch.style.background=fefe?"linear-gradient(90deg,#97e5ff,#1e65d2)":EnsembleColoring.rainColors[i];
    item.append(swatch,label);byId("precipitation-legend").append(item);
  }
  byId("precipitation-note").textContent=info.note;
  if(!fefe){
    common.append(document.querySelector('[data-layer="ascent"]'));
    byId("ascent").textContent="気温偏差の＋・−を色塗り";
    byId("upper-plane").textContent="500 hPa · 各予想図";
    byId("detail-vorticity").querySelector(".legend").textContent="正渦度の斜線域：淡いピンク〜濃いピンク。濃淡は領域の強調で、渦度の数値の違いを表しません。原図の等渦度線を確認してください。";
    byId("detail-ascent").querySelector(".legend").textContent="850hPa気温偏差：0線より上を赤、下を青の透過色。クラスター曲線と0線の間を強調し、縦線の予測幅は塗りつぶしません。地上気温とは区別します。";
  }
}
async function loadEnsemble(selected,revision,signal) {
  try {
    const data=EnsembleColoring.validate(await fetchJSON("ensemble-coloring.json",signal),selected);
    const images={};
    await Promise.all(Object.entries(data.layers).map(async([id,a])=>{
      if(data.unavailable_layers?.[id])return;
      images[id]=await checkedImage(EnsembleColoring.assetURL(a),a.sha256,a.width,a.height,signal);
    }));
    if(revision!==loadRevision)return;
    ensemble={...data,images};symbols=ensemble;
    temperatureLegends();drawSymbols();drawWind();controls();
  }catch(error){if(revision===loadRevision&&error.name!=="AbortError")analysisError="この原図の着色資料を確認できません。原図の閲覧・手描きは使えます。";}
}
async function loadGeographyAtlas(selected,revision,signal) {
  try {
    const atlas = selected.page.image_path.startsWith("local-collection/") ? {schema_version:1,coast_source:{license:"Public domain"},selections:localCollection.geography} : await fetchJSON("geography-catalog.json",signal);
    const data=GeographyAtlas.validate(atlas,selected);
    if(revision!==loadRevision)return;
    rowFrames=ChartView.rows(selected,data);
    if(!data.panels.length)return;
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
const trialOther = () => trial.surface_forecast?trial.panels.find(p=>p.pressure_hpa===0):trial.panels[trial.product === "AUPQ35" || trial.product === "AUPQ78" ? 0 : 1];
function trialPlane(id) {
  if(["AUPA20","AUPA25","FUPA252","FUPA402"].includes(trial.product)&&["wind","jet"].includes(id))return `${trial.panels[0].pressure_hpa}hPa`;
  if(["trough","ridge"].includes(id))return `${trialMain().pressure_hpa}hPa`;
  if(["trough700","ridge700"].includes(id))return trialOther()?.axis_pressure_hpa===0?"地上気圧":`${trialOther()?.pressure_hpa}hPa`;
  if(id==="temperature")return `${temperatureScales()[0].pressure_hpa}hPa`;
  if(id==="temperature500")return `${temperatureScales()[1]?.pressure_hpa}hPa`;
  if(id==="wet" && trial.color_only)return "700hPa";
  return analysisTools.find(t=>t.id===id)?.plane || "図の各地図面";
}
function trialEnabled(id) {
  return {tropopause:showTropopause,equivalent:showEquivalent,precipitation:showPrecipitation,vorticity:showVorticity,ascent:showAscent,wet:showWet,cold700:showCold700,cold850:showCold850,warm850:showWarm850,
    trough700:showTrough700,ridge700:showRidge700,temperature:showTemperature,temperature500:showTemperature500,
    wind:showWind,jet:showJet,trough:showTrough,ridge:showRidge,symbols:showSymbols,geography:showGeography}[id];
}
function trialAvailable(id) {
  const some=key=>trial.panels.some(p=>p[key]?.length);
  return {tropopause:trial.product==="AUPA20",equivalent:Boolean(trial.equivalent_temperature),precipitation:some("precipitation_bands"),vorticity:some("positive_vorticity_rectangles"),ascent:some("ascent_rectangles"),wet:some("wet_rectangles"),
    cold700:trial.panels.some(p=>p.pressure_hpa===700&&p.cold_thresholds),
    cold850:trial.panels.some(p=>p.pressure_hpa===850&&p.cold_thresholds),
    warm850:trial.panels.some(p=>p.pressure_hpa===850&&p.levels.some(l=>LowLevelAnalysis.warmThresholds.includes(l.temperature_c))),
    trough700:trialOther()?.pressure_hpa!==300&&trialOther()?.troughs.length>0,ridge700:trialOther()?.pressure_hpa!==300&&trialOther()?.ridges.length>0,
    temperature:(temperatureScales()[0].pressure_hpa!==300||["AUPN30","FUPA302"].includes(trial.product))&&temperatureScales()[0].values.length>0,temperature500:temperatureScales()[1]?.values.length>0,
    wind:some("wind_bands"),jet:Boolean(candidates?.jets.length||some("native_jet_strokes")),trough:trial.surface_forecast?trial.panels.some(p=>p.pressure_hpa===500&&p.troughs.length):trialMain().troughs.length>0,ridge:trial.surface_forecast?trial.panels.some(p=>p.pressure_hpa===500&&p.ridges.length):trialMain().ridges.length>0,
    symbols:trial.symbols.length>0,geography:Boolean(geography)}[id];
}
function trialLegends() {
  const nativeJet=trial.product==="AUPA20",upper=["AUPA20","AUPA25","FUPA252"].includes(trial.product),spotTemperatures=upper||["AUPN30","FUPA302","FUPA402","FUPA502"].includes(trial.product),jetPressure=trial.product.startsWith("FUPA")||upper?trial.panels[0].pressure_hpa:300;
  byId("jet").textContent=upper?"ジェット軸":"強風軸";
  byId("detail-jet").querySelector(".legend").textContent=`白縁付きの赤い矢印 · ${jetPressure}hPa`;
  byId("detail-jet").querySelector("p").textContent=nativeJet?"原図の200hPaジェット軸を白縁付きの赤で着色します。矢印は風の流れの向きです。":"閉じた強風域の両端や、等風速線の強い張り出しを通る滑らかな線です。楕円に限らず、短い流れも別々に描き、断定できない区間はつなぎません。";
  jetLayer.setAttribute("aria-label",nativeJet?"原図の200hPaジェット軸を白縁付きの赤で着色":`${jetPressure}hPaの強風帯をたどる白縁付きの赤い矢印`);
  temperatureLayer.setAttribute("aria-label",spotTemperatures?`${jetPressure}hPaの同じ気温の数字をつなぐ等温線`:"原図の等温線の着色");
  const common=document.querySelector('[data-layer="symbols"]').parentElement.querySelector("h3 span");common.textContent=trial.panels.length===1?"図全体":"上段・下段";
  byId("tropopause-legend").replaceChildren();
  for(const item of SnapshotAnalysis.tropopauseLegend()){const entry=document.createElement("span"),swatch=document.createElement("i");swatch.style.backgroundColor=item.color||"transparent";swatch.style.opacity=String(item.color?coloringRules.tropopauseOpacity:1);if(!item.color)swatch.style.border="1px solid #cbd5e1";entry.append(swatch,item.label);byId("tropopause-legend").append(entry);}

  if(trial.equivalent_temperature){
    byId("upper-plane").replaceChildren("850 hPa ");byId("lower-plane").replaceChildren("850 hPa ");
    const gradient=SnapshotAnalysis.equivalentStops.map(([v,c])=>`${c} ${(v-260)/110*100}%`).join(",");
    byId("equivalent-gradient").style.background=`linear-gradient(to right,${gradient})`;
    return;
  }
  byId("precipitation-legend").replaceChildren();
  if(trial.surface_forecast)byId("precipitation-note").textContent=`各枠の予報時刻までの前${trialOther().accumulation_hours}時間の積算降水量。原図の点線に沿って、水色から青へ10mm刻み・濃さ45%で色分けします。降水のない範囲は塗りません。50mm以上は同じ濃い青です。`;
  for(const [i,label] of SnapshotAnalysis.precipitationLabels.entries()){
    const entry=document.createElement("span"),swatch=document.createElement("i");swatch.style.backgroundColor=SnapshotAnalysis.precipitationColors[i];swatch.style.opacity=String(coloringRules.precipitationOpacity);entry.append(swatch,label);byId("precipitation-legend").append(entry);
  }
  for(const [i,scale] of temperatureScales().entries()) {
    const id=i?"temperature500":"temperature",legend=byId(`${id}-legend`);legend.replaceChildren();
    for(const [j,value] of scale.values.entries()) {
      const entry=document.createElement("span"),swatch=document.createElement("i");
      swatch.style.borderColor=scale.colors[j];swatch.style.setProperty("--temperature-color",scale.colors[j]);swatch.style.setProperty("--temperature-opacity",scale.opacity);entry.append(swatch,`${value}℃`);legend.append(entry);
    }
    const heading=byId(i?"lower-plane":"upper-plane"),pos=document.createElement("span");pos.textContent=trial.panels.length===1?"":i?"下段":"上段";
    heading.replaceChildren(trial.surface_forecast?(i?"地上 ":"500 hPa "):trial.color_only?(i?"850 / 700 hPa ":"500 / 700 hPa "):(trial.product==="FEAS50"||trial.feas_forecast)&&i?"地上 / 850 hPa ":trial.product==="AXFE578"&&i?"850 / 700 hPa ":`${scale.pressure_hpa} hPa `,pos);
    legend.setAttribute("aria-label",`${scale.pressure_hpa}hPaの気温線`);
    byId(`detail-${id}`).querySelector("p").textContent=spotTemperatures?"原図の同じ気温の数字をつなぐ補助線です。数字の間隔が大きい場所はつなぎません。":"原図の等温線を半透明の色線で表示します。";
    document.querySelector(`[data-layer-detail="${id}"]`).setAttribute("aria-label",`${scale.pressure_hpa}hPaの気温線の詳細`);
  }
  if(trial.color_only)byId("upper-plane").parentElement.append(document.querySelector('[data-layer="wet"]'));
  else byId("lower-plane").parentElement.append(document.querySelector('[data-layer="wet"]'));
  byId("detail-wet").querySelector("p").textContent=trial.color_only?"700hPaの湿域（T−Td < 3℃）の縦線範囲を青水色・濃さ30%で表示します。降水域とは異なります。":"原図の湿域（T−Td < 3℃）のドットを含む範囲。元のドットと線が透ける濃さ30%。境界はドット間隔の半分程度の近似です。降水域とは異なります。";
  if(trial.color_only||trial.feas_forecast)byId("detail-temperature500").querySelector("p").textContent="原図の850hPa等温線は3℃間隔、数値の印字は6℃間隔です。寒気・暖気の色塗りも、原図にある3℃ごとの境界を使います。";
  for(const id of ["trough","ridge","trough700","ridge700"]) {
    const upper=["trough","ridge"].includes(id)?trial.surface_forecast||trial.feas_forecast||["AXFE578","FEAS50","FUPA502"].includes(trial.product):["AUPQ35","AUPQ78"].includes(trial.product);
    byId(upper?"upper-plane":"lower-plane").parentElement.append(document.querySelector(`[data-layer="${id}"]`));
    const ridge=id.startsWith("ridge"),plane=trialPlane(id),panel=id.endsWith("700")?trialOther():trialMain();
    byId(id).textContent=`${plane}の${ridge?"リッジ":"トラフ"}`;
    byId(`detail-${id}`).querySelector(".legend").textContent=`${ridge?"青":"赤"}い線 · ${plane} · 解析試行`;
    const count=trial.surface_forecast&&upper?trial.panels.filter(p=>p.pressure_hpa===500).reduce((n,p)=>n+p[ridge?"ridges":"troughs"].length,0):panel?.[ridge?"ridges":"troughs"].length||0;
    byId(`detail-${id}`).querySelector("p").firstChild.textContent=`${count}本の解析試行。精度は未検証です。`;
  }
  for(const [id,values] of [["cold700",coloringRules.coldThresholds[700]],["cold850",coloringRules.coldThresholds[850]]]) {
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
    if(data.equivalent_temperature){symbols=isotherms=null;showTrough=showRidge=showTrough700=showRidge700=false;}
    if(data.feas_forecast)temperatureLayer.setAttribute("aria-label","下段850hPaの3℃ごとの等温線。暖気は暖色、寒気は寒色");
    if(data.color_only){
      showTrough=showRidge=showTrough700=showRidge700=false;
    }
    if(data.product==="AUPQ78")lowLevel=data;
    if(["AXFE578","FEAS50"].includes(data.product))dynamics=data;
    candidates={troughs:trialMain().troughs.map(a=>a.points),ridges:trialMain().ridges.map(a=>a.points),jets:SnapshotAnalysis.jetAxes(data)};
    if(data.panels.some(p=>p.wind_bands?.length))windBands={bounds:data.panels[0].bounds};
    if(!drawingStates.has(selected.key)){showTrough700=true;showRidge700=true;showWind=Boolean(windBands);showJet=Boolean(candidates.jets.length||data.panels[0].native_jet_strokes?.length);showCold700=true;showCold850=true;}
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
byId("equivalent").addEventListener("click",()=>{if(!ready||!trial?.equivalent_temperature)return;showEquivalent=!showEquivalent;drawWind();controls();});
byId("equivalent-opacity").addEventListener("input",event=>{equivalentOpacity=Number(event.target.value)/100;drawWind();controls();});
for(const id of ["vorticity","ascent","precipitation"])byId(id).addEventListener("click",()=>{if(!ready||!(trial?trialAvailable(id):ensemble?ensembleAvailable(id):dynamics))return;if(id==="vorticity")showVorticity=!showVorticity;else if(id==="ascent")showAscent=!showAscent;else showPrecipitation=!showPrecipitation;drawWind();controls();});
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
        rowFrames = ChartView.rows(selected,{width:selected.page.width,height:selected.page.height,panels:checked.panels});
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
  const revision = ++catalogRevision, fragment = location.hash;
  loadingError = ""; byId("chart-retry").hidden = true;
  try {
    catalog = ChartCatalog.validate(await fetchJSON("chart-catalog.json"));
    if(SnapshotAnalysis.localHost(location.hostname) && !catalog.latest_collection) {
      const response=await fetch("local-collection/catalog.json",{cache:"no-store"});
      if(response.ok){localCollection=await response.json();catalog=SnapshotAnalysis.merge(catalog,localCollection,location.hostname);}
    }
    if (revision !== catalogRevision) return;
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
    let shared = null, shareFailure = "";
    try {
      shared = await ChartShare.decode(fragment);
      if (revision !== catalogRevision) return;
      if (shared) {
        const selected = ChartCatalog.selection(catalog,shared.chart.product,shared.chart.variant,shared.chart.page);
        ChartShare.bind(shared,selected,ChartGeography.patterns.map(p => p.id));
        picker.value = selected.product.id;
        setOptions(byId("source-select"),selected.product.variants,selected.variant.id);
        setOptions(byId("page-select"),selected.variant.pages.map(page => ({id:String(page.number),label:`${page.number} / ${selected.variant.pages.length} ページ`})),String(selected.page.number));
        byId("page-selection").hidden = selected.variant.pages.length === 1;
      }
    } catch (error) { shared = null; shareFailure = error.message === "Unknown chart selection" ? "共有リンクの天気図は現在収録されていません。手描きの復元を停止しました。" : error.message; }
    if (shared) await loadSelection(false,shared);
    else {
      setOptions(byId("source-select"),catalog.products.find(p => p.id === picker.value).variants);
      const variant = catalog.products.find(p => p.id === picker.value).variants[0];
      setOptions(byId("page-select"),variant.pages.map(page => ({id:String(page.number),label:`${page.number} / ${variant.pages.length} ページ`})));
      byId("page-selection").hidden = variant.pages.length === 1;
      await loadSelection();
      if (shareFailure) shareMessage(shareFailure);
    }
  } catch (_) {
    if (revision !== catalogRevision) return;
    catalog = null; loadingError = "天気図の一覧を読み込めませんでした。「図を再読み込み」を押してください。";
    byId("chart-select").disabled = true; byId("chart-retry").hidden = false; controls();
  }
}
window.addEventListener("hashchange",() => { if (location.hash.startsWith("#share=")) loadCatalog(); });
loadCatalog();
