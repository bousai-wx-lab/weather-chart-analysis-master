"use strict";
// Display copy derived from the project's weather-map analysis manual.
// Guides explain the source chart; they do not infer new analysis from pixels.
const ChartReadingGuide = (() => {
  const pdf = "https://hondana-storage.s3.amazonaws.com/46/files/%E5%A4%A9%E6%B0%97%E5%9B%B3%E3%81%AE%E3%81%BF%E3%81%8B%E3%81%9F%20%E5%A2%97%E8%A3%9C%E6%94%B9%E8%A8%82%E6%96%B0%E8%A3%85%E7%89%88%E3%80%80%EF%BD%9E55%20%282%29.pdf";
  const definitions = {
    height: ["高度場・谷と尾根", "等高度線の曲がり、間隔、閉じた低高度域と高高度域。大きな波を先に捉え、短い波を分けます。", "谷の軸と尾根の軸、地上低気圧の位置、前時刻の軸を時刻付きで記入します。", "上流から接近する波、低気圧と上層の位置関係、流れの蛇行や停滞を読めます。", "同時刻の地上・上下層・渦度と照合します。特定の高度線をジェットや高気圧の厳密な境界にしません。"],
    trough: ["トラフ", "等高度線が低高度側へくぼむ谷。広い総観規模の谷と、その中の短波を区別し、両側の線の曲がりを見ます。", "谷の曲率が大きい部分をたどって軸を描きます。枝分かれや短い谷は別に描き、根拠のない空白をつなぎません。", "擾乱を運ぶ波の位置と移動、地上低気圧との位相を読めます。谷の前面では上昇を支える場との重なりを調べます。", "渦度極大は補助根拠です。極大をすべて結んだ線や一つの等高度線を軸にせず、湿り・移流・地上場も確認します。"],
    ridge: ["リッジ", "等高度線が高高度側へ張り出す尾根と、その両側の谷。尾根の振幅と上下層の位置のずれを見ます。", "尾根の中心を波線でたどり、前時刻の位置と地上高気圧を添えます。ツールの軸は青いジグザグ線です。", "高高度域の張り出し、流れの蛇行、谷の通過を遅らせる構造の候補を読めます。", "尾根だけで晴天を決めません。下層の湿り・前線・地形を照合し、ブロッキングは複数時刻で持続性を確かめます。"],
    temperature: ["気温・寒暖気", "等温線や観測点の温度、寒暖の中心、線の集中帯。風が等温線をどちら向きに横切るかを見ます。", "注目する等温線、C・W、前時刻の中心と、暖気・寒気の流入方向を強調します。面塗りは元の線が読める濃さにします。", "寒暖気の接近、温度傾度、風と組み合わせた暖寒気移流を読めます。", "温度だけで降雪・雷を確定せず、下層の湿り・鉛直成層・地上観測と照合します。"],
    wind: ["風・強風帯", "等風速線の囲み・張り出しと、矢羽根の風向・風速。強風帯が同じ流れに属するかを見ます。", "強い帯と核を薄く塗り分け、矢羽根の向き、帯の端、風向や風速が急変する場所を強調します。", "空気の輸送経路と強風帯の形、上層の流れの変化を読めます。", "単位は原図のKTを確認します。上空の風を地上の風速へ直接換算せず、上下の面と観測で確かめます。"],
    jet: ["強風軸", "等風速線の強い張り出しと閉じた強風域の両端、矢羽根の方向。複数の強風帯や分岐を区別します。", "同じ流れの核を通る滑らかな軸に、流れの向きを付けます。手描きの参考は青、ツールの表示は白縁付きの赤です。", "ジェットの位置・蛇行・分岐と、谷・地上低気圧・前線との相対配置を読めます。", "核だけを一直線につながず、等高度線を軸としてなぞりません。断定できない区間は分け、隣接する気圧面も見ます。"],
    wet: ["湿数・湿域", "湿数（気温−露点温度）の小さい域と、湿域のハッチ。乾燥域の張り出しと風の経路も見ます。", "湿域を薄く強調し、乾燥空気が入り込む側を別の色や模様にします。原図のハッチ条件を確認します。", "雲を支える湿った層、乾燥空気の侵入、湿りの補給経路を読めます。", "湿域は降水域そのものではありません。上昇流・下層の湿り・衛星・レーダーと照合します。"],
    vorticity: ["渦度", "正負の渦度域、まとまった極大、等高度線の谷との対応。小さな極大と総観規模のまとまりを分けます。", "追跡する正渦度のまとまりを選び、極大と前時刻の位置に時刻を付けます。ツールは正渦度域をピンクで表示します。", "低気圧性の回転が強い場所、波の移動と発達を考える手掛かりが得られます。", "正渦度があるだけで上昇流や雨は決まりません。渦度の移流、下層の温度移流、湿り・地上低気圧との位相を確認します。"],
    ascent: ["鉛直流（ω）", "負のωが示す上昇域と、その極大・帯状分布。850hPaの風・気温、500hPaの波との重なりを見ます。", "注目する上昇極大と帯の向きを強調し、暖湿気の流入経路を添えます。下降域と同じ色にしません。", "空気を持ち上げる場と、湿った空気の供給が重なる場所を読めます。", "ωは気圧の時間変化なので負が上昇です。単位・符号を原図で確認し、湿りや地形なしに降水量を決めません。"],
    surface: ["地上気圧・中心と前線", "高低気圧の中心、等圧線の間隔・曲がり、風向の変化。同じ有効時刻の上層の谷と比べます。", "Lを赤、Hを青で強調し、前時刻の中心を時刻付きで添えます。推定する前線には候補と書き、等温線集中帯と風のシアを根拠にします。", "中心の移動・発達と、広域の風や前線帯の動向を読めます。", "モデルの地上気圧図と予報官の前線解析を区別します。前線は地上・850hPaの風、温度・湿り、雲・雨で照合します。"],
    precipitation: ["積算降水量", "降水域の位置・量と、積算の開始・終了時刻。地上低気圧や前線帯と対応するかを見ます。", "注目する雨域と量の境界を薄く塗り、何時間分の積算かを記します。湿域・上昇域とは別の模様にします。", "積算期間内の雨の広がりと、擾乱との対応を読めます。", "積算量を瞬間の雨の強さにしません。予想の位置・時間のずれを考え、実況はレーダー・雨量観測で確かめます。"],
    equivalent: ["相当温位", "高相当温位域、線の集中帯、風との位置関係。同じ時刻の温度・湿り・上昇域を見ます。", "高い値の供給域と流入経路、低い値との境界を強調します。数値と単位Kを残し、単なる温度の色分けと区別します。", "下層の暖湿気の供給、気団境界と前線帯を考える手掛かりになります。", "850hPaの高い値だけで不安定や大雨を確定しません。上下層の相当温位・持ち上げ・対流の実況を確認します。"],
    tropopause: ["圏界面", "圏界面の気圧と局所的な高気圧値の領域、200・250・300hPaの風や温度との対応を見ます。", "注目する気圧線と低い圏界面の候補域を囲み、周囲の強風軸・深い谷の位置を添えます。", "気圧が大きいほど低い圏界面です。谷の周辺で成層圏の空気が関わる構造を調べられます。", "圏界面の折れ込みや乱気流をこの図だけで確定せず、断面図・隣接面・観測と照合します。"],
    symbols: ["観測記号", "矢羽根、気温、湿数などの原図の記号と数値。同じ位置の観測を一組として読みます。", "注目する風向の変化、強風、寒暖気、湿った観測点を強調します。記号自体を塗りつぶさないようにします。", "等値線だけでは見落とす局所的な風の変化と、解析線を支える観測の位置が分かります。", "数字の配置・符号・単位は原図の凡例を確認します。強調表示は新しい観測値を追加するものではありません。"],
    geography: ["陸海・地形", "海岸線、山脈・高原と、風・湿域・降水域の位置関係を見ます。", "風上・風下、湿った風が当たる山地、注目地域を原図の線を隠さない濃さで強調します。", "地形による持ち上げや雨陰など、総観場を地域の天気へ結び付ける場所が分かります。", "広域の地形表示です。高い山では850hPaなどが地中になる場合があり、地上の気温・風とは区別します。"],
    sectionWind: ["断面の風・ジェット", "緯度と気圧の軸、風速の核、上下・南北のシア。東経130度と140度の位置差を見ます。", "強風核、鉛直シアの大きい層、前線に対応する風向変化を囲み、地図上の位置へ戻します。", "平面図で見えないジェットの高さや、上下層の風のつながりを読めます。", "断面は限られた経度の切り口です。平面図と時刻をそろえ、隣の経度へそのまま延ばしません。"],
    sectionThermal: ["断面の気温・湿り・安定度", "気温・露点や湿数の鉛直分布、前線の傾斜、湿った層の厚さ、圏界面付近の変化を見ます。", "湿潤層、乾燥層、寒暖気の境と前線候補を分けて強調します。雨雪を考えるときは0℃付近の層もたどります。", "気団の立体構造、雲の層、下層から上層への寒暖や湿りのつながりを読めます。", "相当温位・温位の鉛直勾配や持ち上げの条件も照合します。特定層の温度だけで雨雪・対流を確定しません。"],
    heightAnomaly: ["500hPa高度・偏差", "平均高度の谷・尾根と、平年からの正負偏差。日本と上流の配置、平均期間を見ます。", "持続する軸と偏差中心を別の記号で強調し、期間ごとの位置・振幅の変化を記します。", "偏西風の南北の偏り、持続する循環と、その変化を考える背景を読めます。", "正偏差を地上の高温と直結させず、850hPaの移流を照合します。平均期間・季節が違う図の数値を同列にしません。"],
    temperatureAnomaly: ["850hPa気温・偏差", "平均気温と平年差、寒暖気の流入方向。地域・平均期間・有効時刻をそろえて見ます。", "寒暖の偏差中心、流入経路、期間ごとに変化する境界を強調します。絶対気温と偏差を区別します。", "広域の寒暖の傾向と、気団の変化を読めます。", "850hPaの地域平均は地点の最高・最低気温そのものではありません。地上場、雲、地形とメンバーの幅を照合します。"],
    pressureAnomaly: ["海面気圧・偏差", "平均的な高低圧部と平年差、等圧線の配置。期間をそろえ、500hPa・850hPaと対応させます。", "高低圧部と偏差中心、風の流入方向、期間間の配置変化を記します。", "持続しやすい広域配置と、下層の寒暖気移流を支える流れを読めます。", "平滑化された平均図から個別日の中心・前線・通過時刻を確定せず、日別図と照合します。"],
    spread: ["スプレッド", "メンバー間のばらつきが大きい場所・時期と、平均の谷・尾根の位置。規格化の有無と凡例を見ます。", "ばらつきの大きい領域を囲み、谷の位置差・振幅差・二つのシナリオなどに対応付けます。", "予想の違いが集中する場所と、不確かさが増す時期を読めます。", "小さい値は正しさの保証ではありません。規格化した値と高度の単位を混ぜず、確率・各メンバーも見ます。"],
    probability: ["高偏差確率", "対象が500hPa高度など何の偏差か、正負の条件、閾値、平均期間とメンバー割合を見ます。", "正・負で支持の多い領域を別の模様で囲み、平均偏差・スプレッドと対応させます。", "平均だけでは分からない、偏差の符号や条件を支持するメンバーの割合が分かります。", "500hPa高度の高偏差確率を、地上気温の「かなり高い・低い」の確率にしません。閾値は掲載図の凡例を優先します。"],
    streamfunction: ["200・850hPa流線関数", "上・下層の絶対場と偏差、循環の中心、線の間隔。両層と熱帯対流の位置関係を見ます。", "上下層の循環偏差の中心と、ジェット・亜熱帯高気圧に対応するパターンを記します。", "平年から循環がどう変わるかと、上・下層の応答を読めます。", "偏差の符号を実際の循環の符号と取り違えません。緯度・半球・絶対場を確認し、速度ポテンシャルの発散成分と分けます。"],
    velocityPotential: ["200hPa速度ポテンシャル", "絶対場・偏差と、熱帯の対流の活発・不活発に対応する大規模な発散・収束の配置を見ます。", "負偏差側の対流活発候補と正偏差側の不活発候補、移動方向を強調し、降水や海面水温と対応させます。", "熱帯の対流活動と上層の発散循環の大規模な関係を調べられます。", "速度ポテンシャルはωそのものでも局地の雨量でもありません。衛星・降水、流線関数と中緯度の応答を照合します。"],
    rainAnomaly: ["降水量偏差", "多雨・少雨の偏りと、平均期間、熱帯対流・循環の対応。絶対量と平年差を区別します。", "正負の偏差域を別に強調し、期間間の広がりや移動を記します。", "期間平均の降水の偏りと、大規模循環との整合を読めます。", "個別日の雨量や大雨確率へ読み替えません。季節・地域・モデルの偏りと、他の対流指標を照合します。"],
    sst: ["海面水温偏差", "正負の偏差の広がり・持続と、海域、平均期間。熱帯対流との位置関係を見ます。", "持続する暖水・冷水偏差域と、対流活発域の位置を別に囲みます。", "予想の出発点となる海洋の背景と、対流分布を考える手掛かりになります。", "正偏差だけで対流や日本の天候を決めません。絶対水温、季節、大気循環と時刻を合わせて照合します。"],
    temperatureSeries: ["850hPa気温偏差の時系列", "地域平均、メンバー平均と各メンバー、移動平均の幅。符号が変わる時期や二群に分かれる期間を見ます。", "寒暖の継続・転換時期、メンバーの範囲、実況と予想の境を記します。", "平均の傾向と、その裏にある対立したシナリオ、時間方向の不確かさが分かります。", "線の太さ・密度だけで確率を決めません。5日・7日など平均幅を確認し、地点の地上気温と区別します。"],
    indices: ["循環指数の時系列", "指数名・定義・符号、平均と各メンバーの変化。気温が変わる時期と対応するかを見ます。", "符号の変化・持続とメンバーの幅を記し、その時期の谷・尾根・偏差パターンを空間図で確認します。", "気温変化を支える循環の候補と、その持続性を読めます。", "指数ごとに意味が違います。単一指数で日本の天候を決めず、図の定義と空間分布へ戻ります。"],
    longitudeTime: ["赤道域の経度・時間断面", "経度と時間の軸、速度ポテンシャルなどの対象量、平均幅。模様の傾き・東進・西進・停滞を見ます。", "初期日時を線で示し、対流活発候補を時間方向に追って移動経路を記します。", "熱帯の季節内変動の進み方と、その予想の継続性を読めます。", "初期日前後の移動平均は解析・予想をまたぐことがあります。空間図と照合し、単一経度の変化を日本の寒暖の因果と断定しません。"],
    latitudeTime: ["東経135度の緯度・時間断面", "緯度と時間の軸、500hPa高度の注目等値線の南北移動。実況と予想の境を見ます。", "日本の緯度と注目する高度線、南下・北上・停滞する時期を強調します。", "偏西風帯の南北変動を、過去から予想へ連続した時間軸で読めます。", "特定高度線は寒暖の背景の目安です。地上気温・雪の直接判定にせず、平面図とアンサンブルを照合します。"],
    cluster: ["クラスター別の高度線", "同じ高度線について、クラスター間の位置差と構成メンバー数。平均の谷・尾根と比べます。", "線が離れる帯と、谷の位置・高気圧の張り出しなどの違いを囲みます。", "平均図では隠れる複数の循環シナリオと、違いが集中する構造が分かります。", "線が多い場所を降水確率と取り違えません。構成比とメンバー、地上配置への影響を確認します。"],
    rainFrequency: ["降水頻度", "凡例の雨量閾値・積算時間を超えるメンバーの割合と、地上配置・湿った空気の供給を見ます。", "割合の境界を薄く強調し、地域と対象期間を記します。", "指定したモデルの雨量条件を支持するメンバーの多さが分かります。", "掲載例の5mm/24時間以上の頻度を、公表の1mm以上の降水確率と同一視しません。平均積算雨量とも区別します。"],
    meanRain: ["アンサンブル平均の降水域", "平均積算雨量が凡例の条件を満たす範囲と、平均地上配置の推移を見ます。", "対象期間と雨域を記し、平均の高低圧部との対応を強調します。", "期間内の雨の大まかな広がりと、平均的な総観場を読めます。", "降水確率図ではありません。一部の多雨メンバーや平滑化の影響を受けるので、降水頻度・各メンバーも確認します。"]
  };
  definitions.trough[2] += " 手描きの参考は茶色の曲線、ツールは赤い線です。";
  definitions.heightAnomaly[0] = "平均高度・偏差";
  definitions.temperatureAnomaly[0] = "平均気温・偏差";
  definitions.temperatureSeries[0] = "気温偏差の時系列";
  definitions.streamfunction[0] = "流線関数";
  definitions.probability[1] += " 自然変動の標準偏差も参照し、偏差の大きさを背景の変動幅と比べます。";
  definitions.sectionWind[1] = "横軸の観測地点と実際の位置、対数気圧の縦軸、風速の核、鉛直・水平シアを見ます。";
  definitions.sectionWind[4] += " AXJP130の地点はすべて同じ経線上にはなく、観測点間の最大風速を捉え損ねる場合もあります。";
  definitions.sectionTemperature = ["断面の気温・温位・前線面", "気温線と温位線の傾きの違い、温位線が密になる傾斜帯、逆転層・安定層を見ます。", "密な温位線の帯と前線面候補、逆転・安定層を囲み、平面図の前線と位置を対応させます。", "前線面の傾斜と寒暖気の上下関係、安定層の位置を読めます。", "断面の縦横倍率による見掛けの傾斜を実際の傾斜にしません。湿った下層の前線は相当温位も使い、エマグラム・平面図と照合します。"];
  definitions.sectionWet = ["断面の露点・湿潤層", "気温と露点の差の鉛直分布、湿った層の厚さと上下の乾燥層を見ます。", "湿潤層と乾燥層を別に強調し、雲の下端・上端の候補に印を付けます。", "雲があり得る層と、上下層の湿りのつながりを読めます。", "湿数の雲層の目安は温度にも依存します。一律の湿数3℃線を雲底・雲頂にせず、観測・衛星・エマグラムで確認します。"];
  definitions.sectionTropopause = ["断面の圏界面", "圏界面と最大風速の観測記号、温度・温位の変化、ジェットとの位置関係を見ます。", "観測に基づく圏界面と二重圏界面の候補、強風核の高さを別の記号で強調します。", "平面図では見えない圏界面の高さ・傾きと、ジェットとの立体構造を読めます。", "観測のない区間を確定線で補わず、隣接する断面・圏界面図・エマグラムと照合します。"];
  const indexDefinitions = [
    ["indexZonal","極東東西指数","東経90～170度の40度帯と60度帯の500hPa高度偏差の差","東西流の強弱、蛇行と高緯度ブロッキング","低指数を日本の低温へ直結させず、谷が来る場所を確認します。"],
    ["indexOkinawa","沖縄高度","北緯30度・東経120～140度の500hPa高度偏差","南側の亜熱帯高気圧の張り出しと寒候期の寒気南下","下層の移流と季節を確認し、正負の符号だけで地上気温を決めません。"],
    ["indexEast","東方海上高度","北緯40度・東経140～170度の500hPa高度偏差","日本の東の尾根・谷と、暖寒気の流入経路","日本の西側の谷と合わせて空間図で読みます。"],
    ["indexOkhotsk","オホーツク海高気圧指数","北緯50～60度・東経130～150度の500hPa高度偏差","日本の北の尾根・寒冷渦、地上高気圧と下層の冷気","上層指数だけで地上のオホーツク海高気圧の強さを確定しません。"],
    ["indexVortex","北半球極渦指数","北緯70～80度の帯状平均500hPa高度偏差","極域の高度・寒気と中緯度へ向かう流れ","極域の低高度が強くても、寒気の放出先は空間図で確認します。"],
    ["indexEurasia","ユーラシアパターン指数","ユーラシアに沿う波列を表す指数","ヨーロッパ・シベリア・日本の谷と尾根の対応","符号と日本付近の応答は季節・指数の定義も確認します。"]
  ];
  for (const [kind,title,definition,structure,check] of indexDefinitions) definitions[kind] = [title, `${definition}。平均と各メンバーの符号・変化・持続を見ます。`, "符号が変わる時期、持続する期間、メンバーの幅を記し、同時期の空間図へ対応付けます。", `${structure}を考える手掛かりになります。`, `${check} 領域・式・規格化は掲載資料の定義を確認します。`];
  const topic = (kind, plane = "", page = 4) => ({ kind, plane, page });
  const indices = (page, twoWeek = false) => indexDefinitions.slice(0, twoWeek ? 6 : 4).map(([kind]) => topic(kind, "", page));
  const profiles = {};
  const add = (ids, items) => { for (const id of ids) profiles[id] = items; };
  const upper = (plane, page) => [topic("height", plane, page), topic("temperature", plane, page), topic("wind", plane, page), topic("jet", plane, page)];
  add(["aupa20"], [...upper(200, 38), topic("tropopause", "圏界面", 38)]);
  add(["aupa25"], upper(250, 36));
  add(["aupn30"], upper(300, 34));
  add(["aupq35"], [...upper(300, 30), topic("height", 500, 22), topic("temperature", 500, 22), topic("wind", 500, 22)]);
  add(["aupq78"], [topic("height", 700, 18), topic("temperature", 700, 18), topic("wind", 700, 18), topic("wet", 700, 18), topic("height", 850, 12), topic("temperature", 850, 12), topic("wind", 850, 12), topic("wet", 850, 12)]);
  add(["auxn50"], [topic("height", 500, 26), topic("temperature", 500, 26)]);
  const dynamics = [topic("height", 500, 42), topic("vorticity", 500, 42), topic("temperature", 850, 46), topic("wind", 850, 46), topic("ascent", 700, 46)];
  add(["axfe578"], dynamics);
  const surface = [topic("surface", 0, 94), topic("temperature", 850, 94), topic("height", 500, 96), topic("vorticity", 500, 96)];
  add(["feas-feas50", ...["02","04","07","09","12","14","16","19","21","24","26"].map(hour => `feas${hour}-feas5${hour}`)], surface);
  add(["axjp130-axjp140"], [topic("sectionWind", "鉛直断面", 50), topic("sectionTemperature", "鉛直断面", 50), topic("sectionWet", "鉛直断面", 50), topic("sectionTropopause", "鉛直断面", 50)]);
  for (const [id, plane, page] of [["fupa252",250,84],["fupa302",300,82],["fupa402",400,80],["fupa502",500,78]]) add([id], upper(plane, page));
  add(["fxfe5782","fxfe5784","fxfe577"], [topic("temperature",850,64),topic("wind",850,64),topic("ascent",700,64),topic("temperature",500,68),topic("wet",700,68)]);
  add(["fxfe502","fxfe504","fxfe507"], [topic("height",500,56),topic("vorticity",500,56),topic("surface",0,60),topic("wind",0,60),topic("precipitation",0,60)]);
  add(["fxjp854"], [topic("equivalent",850,72),topic("wind",850,72)]);
  add(["fefe19"], [topic("surface",0,98),topic("meanRain",0,98)]);
  add(["fzcx50"], [topic("height",500,100),topic("vorticity",500,100),topic("equivalent",850,100),topic("cluster","",100),topic("rainFrequency","",100),topic("spread","",100),topic("temperatureSeries",850,100)]);
  add(["fxxn519"], [topic("heightAnomaly",500,103),topic("height",500,103),topic("temperature",850,103),topic("latitudeTime",500,103)]);
  const meanFields = page => [topic("heightAnomaly",500,page),topic("temperatureAnomaly",850,page),topic("pressureAnomaly",0,page)];
  const tropicalFields = page => [topic("velocityPotential",200,page),topic("streamfunction","200・850hPa",page),topic("rainAnomaly","",page)];
  add(["fcvx21"], [...meanFields(109),topic("sst","",109),topic("velocityPotential",200,109),topic("streamfunction","200・850hPa",109),topic("longitudeTime","赤道域",109)]);
  add(["fcvx22"], [...meanFields(113),topic("probability",500,113)]);
  add(["fcvx23"], tropicalFields(116));
  add(["fcvx24"], [topic("temperatureSeries",850,120),...indices(121,true),topic("spread",500,120)]);
  add(["fcvx11"], [...meanFields(126),topic("sst","",126),topic("velocityPotential",200,126),topic("streamfunction","200・850hPa",126)]);
  add(["fcvx12"], meanFields(130));
  add(["fcvx13"], [topic("heightAnomaly",500,134),topic("spread",500,134),topic("probability",500,134)]);
  add(["fcvx14"], [topic("temperatureSeries",850,138),...indices(139),topic("spread",500,138),topic("longitudeTime","赤道域",138)]);
  add(["fcvx15"], tropicalFields(142));
  const layerKinds = { temperature:"temperature", temperature500:"temperature", cold700:"temperature", cold850:"temperature", warm850:"temperature", trough:"trough", trough700:"trough", ridge:"ridge", ridge700:"ridge", wind:"wind", jet:"jet", wet:"wet", vorticity:"vorticity", ascent:"ascent", precipitation:"precipitation", equivalent:"equivalent", tropopause:"tropopause", symbols:"symbols", geography:"geography" };
  function planeNumber(plane) { return Number(String(plane).match(/\d+/)?.[0]) || 0; }
  function guide(item, productId) {
    const base = definitions[item.kind];
    if (!base || !profiles[productId]) return null;
    const plane = typeof item.plane === "number" ? item.plane ? `${item.plane}hPa` : "地上" : item.plane;
    const result = {kind:item.kind, plane:item.plane, title:[plane,base[0]].filter(Boolean).join(" · "), look:base[1], mark:base[2], learn:base[3], check:base[4], source:`${pdf}#page=${item.page}`, sourceLabel:`参考：天気図のみかた · 本p.${item.page+46}～（PDF p.${item.page}～）`};
    if (["wind","jet"].includes(item.kind) && item.plane === 850) {
      result.look = "850hPaの矢羽根、強風の経路、等温線・湿域との重なり。風が暖湿気を運ぶ側と寒気を運ぶ側を分けます。";
      result.mark = "暖湿気の流入を矢印で記し、50KT以上など注目する強風の観測点・範囲を強調します。";
      result.learn = "下層の暖湿気輸送、寒気の流入、前線付近の風向シアや小さな循環を読めます。";
      result.check = "地上風速へ直接換算せず、相当温位・地上前線・700hPaの湿りと上昇域、降水実況を照合します。";
    }
    if (item.kind === "wind" && item.plane === 0) {
      result.look = "地上の風向・風速、低気圧や前線帯付近の風向シア、等圧線の間隔を見ます。";
      result.mark = "強風域、風向が変わる帯、風の流入と収束の候補を中心・雨域と対応付けます。";
      result.learn = "地上の風の変化と、低気圧・前線・降水域の位置関係を読めます。";
      result.check = "850hPaの風と区別し、モデルの地上風の定義・地形・地上観測を確認します。";
    }
    if (item.kind === "temperature" && item.plane === 850) {
      result.learn = "下層の気団、暖寒気移流、前線候補の集中帯を読めます。風と湿りを組み合わせて供給経路を確認します。";
      result.check = "0℃・−6℃などは季節・地域による目安です。雨雪の確定線にせず、融解層・地上気温・湿りを照合します。山岳域の地中面にも注意します。";
    }
    if (item.kind === "temperature" && [200,250,300].includes(item.plane)) result.check = "深い谷の暖気は圏界面が低く成層圏の空気が関わる可能性があります。地上の暖気と同一視せず、圏界面図・断面図・隣接する気圧面を確認します。";
    if (["trough","ridge"].includes(item.kind) && item.plane === 0) {
      result.look = `地上の等圧線が示す${item.kind === "trough" ? "気圧の谷" : "高圧部の張り出し"}。500hPaの等高度線による軸とは分けて読みます。`;
      result.mark = "地上の等圧線の曲がりから軸をたどり、中心・風向変化・前線候補を添えます。";
      result.learn = "地上の配置の形と、上層の波との位置関係を読めます。";
      result.check = "850hPaの気温を地上の軸の根拠にせず、地上の風・温度・湿りと上層場を照合します。";
    }
    if (/^fcvx/.test(productId)) result.check += " 平均期間と初期時刻を確認し、個別日の現象とは分けて読みます。";
    if (productId === "fefe19" && item.kind === "surface") result.check = "メンバー平均で中心が平滑化されます。この掲載図の等圧線から絶対気圧・中心示度を補記せず、日別図・メンバーの違いを確認します。";
    if (/^feas\d/.test(productId)) result.check += " 先の予想ほど位置・振幅の誤差が増え得るので、アンサンブルと前回予想を比較します。";
    return result;
  }
  function topics(productId) { return (profiles[productId] || []).map(item => guide(item, productId)); }
  function layer(id, plane, productId) {
    const kind = productId === "fxxn519" && id === "vorticity" ? "heightAnomaly" : productId === "fxxn519" && id === "ascent" ? "latitudeTime" : productId === "fefe19" && id === "precipitation" ? "meanRain" : productId === "fzcx50" && id === "precipitation" ? "rainFrequency" : productId === "fzcx50" && id === "ascent" ? "temperatureSeries" : layerKinds[id];
    if (!kind || !profiles[productId]) return null;
    const pressure = planeNumber(plane);
    const matchKind = ["trough","ridge"].includes(kind) ? pressure ? "height" : "surface" : kind;
    const match = profiles[productId].find(item => item.kind === matchKind && (typeof item.plane !== "number" || item.plane === pressure));
    return guide({kind,plane:kind === "rainFrequency" ? "" : kind === "tropopause" ? "圏界面" : ["geography","symbols"].includes(kind) ? plane : pressure,page:match?.page || profiles[productId][0].page}, productId);
  }
  function covered(item, layers) {
    return layers.some(layer => layer && layer.plane === item.plane && (layer.kind === item.kind || item.kind === "height" && ["trough","ridge"].includes(layer.kind) || item.kind === "surface" && ["trough","ridge"].includes(layer.kind)));
  }
  return {topics, layer, covered};
})();
if (typeof module !== "undefined") module.exports = ChartReadingGuide;
