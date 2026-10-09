"use strict";
const EnsembleColoring = (() => {
  const products = ["fefe19", "fzcx50", "fxxn519"];
  const rainColors = ["#99ebfd", "#309be7", "#234ca9"];
  function validate(data, selected) {
    if (data?.schema_version !== 1 || data.gradient_semantics !== "source-contours-and-area-emphasis" || !products.includes(selected.product.id) || !Array.isArray(data.selections) || data.selections.length !== 6) throw Error("Invalid ensemble coloring");
    const records = data.selections.filter(r => r.product === selected.product.id && r.variant === selected.variant.id && r.page === selected.page.number);
    if (records.length !== 1) throw Error("Ensemble selection mismatch");
    const r = records[0], expected = r.product === "fefe19" ? ["precipitation", "symbols"] : r.product === "fxxn519" ? ["heightAnomaly", "height5880", "cold850", "warm850", "symbols"] : ["precipitation", "symbols", "vorticity", "anomaly"];
    if (r.source_sha256 !== selected.variant.source_sha256 || r.image_sha256 !== selected.page.image_sha256 || r.width !== selected.page.width || r.height !== selected.page.height || !r.layers || Object.keys(r.layers).sort().join() !== expected.sort().join()) throw Error("Ensemble source mismatch");
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
      temperature: "850hPa：寒気0・−3・−6・−9・−12℃以下、暖気9・12・15・18・21・24℃以上の既存配色。原図の3℃ごとの等温線に沿う参考着色で、C/Wから数値を補いません。同定できない内側の等温線は塗り足さず、原図で確認してください。"
    };
    return product === "fefe19" ? {
      rain: "24時間で5mm以上のアンサンブル平均降水域",
      note: "点描域を水色〜青で強調します。濃淡は領域の見やすさのためで、雨量・降水確率の違いを表しません。原図の境界・各枠の期間も確認してください。",
      bands: ["5mm/24h以上"]
    } : {
      rain: "5mm/24時間以上の予想頻度（％）",
      note: "原図の10・50・90％線に沿った参考着色です。5mm/24時間以上を予想するメンバーの割合で、公表の降水確率や降水量とは異なります。帯内の濃淡は領域の強調です。",
      bands: ["10〜50％", "50〜90％", "90％以上"]
    };
  }
  return {products, rainColors, validate, draw, legends};
})();
if (typeof module !== "undefined") module.exports = EnsembleColoring;
