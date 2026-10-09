"use strict";
const EnsembleColoring = (() => {
  const products = ["fefe19", "fzcx50", "fxxn519"];
  const rainColors = ["#99ebfd", "#309be7", "#234ca9"];
  function assetURL(asset) {
    if (!/^assets\/ensemble\/[a-zA-Z0-9-]+\.png$/.test(asset?.path) || !/^[a-f0-9]{64}$/.test(asset?.sha256)) throw Error("Invalid ensemble asset URL");
    return `${asset.path}?v=${asset.sha256}`;
  }
  function validate(data, selected) {
    if (data?.schema_version !== 1 || data.gradient_semantics !== "source-contours-and-area-emphasis" || !products.includes(selected.product.id) || !Array.isArray(data.selections) || data.selections.length !== 6) throw Error("Invalid ensemble coloring");
    const records = data.selections.filter(r => r.product === selected.product.id && r.variant === selected.variant.id && r.page === selected.page.number);
    if (records.length !== 1) throw Error("Ensemble selection mismatch");
    const r = records[0], expected = r.product === "fefe19" ? ["precipitation", "symbols"] : r.product === "fxxn519" ? ["heightAnomaly", "height5880", "cold850", "warm850", "symbols"] : ["precipitation", "symbols", "vorticity", "anomaly"];
    if (r.source_sha256 !== selected.variant.source_sha256 || r.image_sha256 !== selected.page.image_sha256 || r.width !== selected.page.width || r.height !== selected.page.height || !r.layers || Object.keys(r.layers).sort().join() !== expected.sort().join()) throw Error("Ensemble source mismatch");
    if (r.unavailable_layers && (r.product !== "fxxn519" || typeof r.unavailable_layers !== "object" || Array.isArray(r.unavailable_layers) || Object.entries(r.unavailable_layers).some(([id, reason]) => !["height5880", "cold850", "warm850"].includes(id) || reason !== "contour-boundary-unverified"))) throw Error("Invalid coloring quality status");
    if (r.product === "fxxn519") {
      const s=r.numeric_source, reference=selected.variant.label.replace(" ","T").replace(" UTC",":00+00:00");
      const hash=value=>/^[a-f0-9]{64}$/.test(value);
      if (!s || s.model!=="GSM" || s.reference_time!==reference || s.grid_degrees!==0.5 || !Array.isArray(s.forecasts) || s.forecasts.length!==6 || s.forecasts.some((f,i)=>f.forecast_hours!==72+i*24 || !hash(f.grib_sha256) || !hash(f.input_sha256) || !hash(f.field_sha256?.height) || !hash(f.field_sha256?.temperature))) throw Error("Ensemble numeric source mismatch");
    } else if (r.numeric_source) throw Error("Unexpected numeric source");
    for (const [id, asset] of Object.entries(r.layers)) {
      if (asset.path !== `assets/ensemble/${r.variant}-${id}.png` || !/^[a-f0-9]{64}$/.test(asset.sha256) || asset.width !== r.width || asset.height !== r.height) throw Error("Ensemble mask mismatch");
    }
    return r;
  }
  function draw(ctx, coloring, id, enabled, opacity = 1) {
    if (coloring && enabled && coloring.images[id]) {ctx.save();ctx.globalAlpha=opacity;ctx.drawImage(coloring.images[id], 0, 0);ctx.restore();}
  }
  function legends(product) {
    if(product === "fxxn519") return {
      anomaly: "500hPa平均高度の平年偏差：負は寒色・正は暖色",
      note: "原図の縦線・0線から偏差の正負を強調する参考着色です。帯内のグラデーションは領域の見やすさのためで、偏差の絶対値は原図の数値で確認します。平均高度と偏差を区別します。",
      height: "500hPa高度5880m以上：下段の地図・緯度時間断面をピンク",
      temperature: "850hPa：寒気0・−3・−6・−9・−12℃以下、暖気9・12・15・18・21・24℃以上の既存配色。同じ初期時刻・予報時間のGSM数値データを使い、原図の3℃ごとの等温線に境界を合わせています。C/Wから気温を推定しません。"
    };
    return product === "fefe19" ? {
      rain: "24時間で5mm以上のアンサンブル平均降水域",
      note: "点描域を青で塗ります。原図は5mm/24時間以上の範囲だけを示し、雨量の強弱は載っていません。雨量・降水確率の違いを表しません。原図の境界・各枠の期間も確認してください。",
      bands: ["5mm/24h以上"],
      colors: ["#5fb1ed"]
    } : {
      rain: "5mm/24時間以上の予想頻度（％）",
      note: "原図の10・50・90％線に沿い、予想頻度が高い帯ほど濃い青で塗ります。5mm/24時間以上を予想するメンバーの割合で、公表の降水確率や降水量とは異なります。",
      bands: ["10〜50％", "50〜90％", "90％以上"],
      colors: rainColors
    };
  }
  return {products, rainColors, validate, draw, legends, assetURL};
})();
if (typeof module !== "undefined") module.exports = EnsembleColoring;
