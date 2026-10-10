(function () {
  "use strict";
  var holder = document.querySelector("[data-dest-data]");
  var DATA_URL = (holder && holder.getAttribute("data-dest-data")) || "assets/destinations.json";
  var ROOT = DATA_URL.replace(/assets\/destinations\.json$/, "");
  var MET = "https://api.met.no/weatherapi/locationforecast/2.0/compact";
  var TZ = "Asia/Bangkok";
  var SVGNS = "http://www.w3.org/2000/svg";
  var dataPromise = null;
  var libPromise = null;

  var LANG = (document.documentElement.getAttribute("lang") || "en").slice(0, 2).toLowerCase() === "ru" ? "ru" : "en";
  var STR = {
    en: {
      locale: "en-GB",
      close: "Close",
      facts: "{time} from Phuket",
      pin: "{name}: {time} from Phuket",
      today: "Today",
      hl: "H:{hi}° L:{lo}°",
      mm: "{n} mm",
      windCell: "{n} km/h",
      windWord: ["km/h", "km/h", "km/h"],
      windMul: 3.6,
      srRow: "{day}: {sky}{rain}, low {lo}°, high {hi}°{wind}.",
      srRain: ", {mm} of rain",
      srWind: ", wind {n} {unit} from the {point}",
      points: ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"],
      thunder: "Thunderstorms",
      words: {
        clearsky: "Sunny", fair: "Mostly sunny", partlycloudy: "Partly cloudy", cloudy: "Cloudy", fog: "Fog",
        lightrainshowers: "Light showers", rainshowers: "Showers", heavyrainshowers: "Heavy showers",
        lightrain: "Light rain", rain: "Rain", heavyrain: "Heavy rain"
      },
      nightWords: {clearsky: "Clear", fair: "Mostly clear"},
      skyText: {sun: "sunny", partly: "partly cloudy", cloud: "cloudy", rain: "rain", heavy: "heavy rain", thunder: "thunderstorms"},
      failed: "The forecast is not available just now.",
      failedLink: "See the forecast for {short} on Yr",
      mapLocale: null
    },
    ru: {
      locale: "ru-RU",
      close: "Закрыть",
      facts: "{time} от {from}",
      pin: "{name}: {time} от {from}",
      today: "Сегодня",
      hl: "Макс.: {hi}°, мин.: {lo}°",
      mm: "{n} мм",
      windCell: "{n} уз",
      windWord: ["узел", "узла", "узлов"],
      windMul: 1.94384,
      srRow: "{day}: {sky}{rain}, минимум {lo}°, максимум {hi}°{wind}.",
      srRain: ", осадки {mm}",
      srWind: ", ветер {n} {unit}, {point}",
      points: ["с севера", "с северо-востока", "с востока", "с юго-востока", "с юга", "с юго-запада", "с запада", "с северо-запада"],
      thunder: "Гроза",
      words: {
        clearsky: "Солнечно", fair: "Преимущественно солнечно", partlycloudy: "Переменная облачность", cloudy: "Облачно", fog: "Туман",
        lightrainshowers: "Небольшие ливни", rainshowers: "Ливни", heavyrainshowers: "Сильные ливни",
        lightrain: "Небольшой дождь", rain: "Дождь", heavyrain: "Сильный дождь"
      },
      nightWords: {clearsky: "Ясно", fair: "Преимущественно ясно"},
      skyText: {sun: "солнечно", partly: "переменная облачность", cloud: "облачно", rain: "дождь", heavy: "сильный дождь", thunder: "гроза"},
      failed: "Прогноз сейчас недоступен.",
      failedLink: "Открыть прогноз на Yr: {short}",
      mapLocale: {
        "AttributionControl.ToggleAttribution": "Показать или скрыть источники",
        "NavigationControl.ZoomIn": "Приблизить",
        "NavigationControl.ZoomOut": "Отдалить",
        "NavigationControl.ResetBearing": "Повернуть на север",
        "Map.Title": "Карта",
        "Marker.Title": "Метка на карте",
        "Popup.Close": "Закрыть",
        "CooperativeGesturesHandler.WindowsHelpText": "Чтобы изменить масштаб карты, используйте Ctrl и прокрутку",
        "CooperativeGesturesHandler.MacHelpText": "Чтобы изменить масштаб карты, используйте ⌘ и прокрутку",
        "CooperativeGesturesHandler.MobileHelpText": "Чтобы двигать карту, используйте два пальца"
      }
    }
  };
  var S = STR[LANG];

  function fmt(tpl, vars) {
    return tpl.replace(/\{(\w+)\}/g, function (m, k) { return vars[k] != null ? vars[k] : m; });
  }

  function plural(n, forms) {
    var a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return forms[2];
    if (b > 1 && b < 5) return forms[1];
    if (b === 1) return forms[0];
    return forms[2];
  }

  function L(d, key, fallback) {
    return (LANG === "ru" && d.ru && d.ru[key] != null) ? d.ru[key] : fallback;
  }

  function getData() {
    if (!dataPromise) {
      dataPromise = fetch(DATA_URL, {credentials: "omit"}).then(function (r) {
        if (!r.ok) throw new Error("data " + r.status);
        return r.json();
      });
    }
    return dataPromise;
  }

  function byId(data, slug) {
    for (var i = 0; i < data.destinations.length; i++) if (data.destinations[i].slug === slug) return data.destinations[i];
    return null;
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

  function whenNear(nodes, cb) {
    if (!("IntersectionObserver" in window)) { nodes.forEach(cb); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { io.unobserve(en.target); cb(en.target); }
      });
    }, {rootMargin: "600px 0px"});
    nodes.forEach(function (n) { io.observe(n); });
  }

  function loadLib(map) {
    if (window.maplibregl) return Promise.resolve(window.maplibregl);
    if (!libPromise) {
      libPromise = new Promise(function (resolve, reject) {
        var css = document.createElement("link");
        css.rel = "stylesheet"; css.href = map.maplibre_css;
        css.integrity = map.maplibre_css_sri; css.crossOrigin = "anonymous";
        document.head.appendChild(css);
        var s = document.createElement("script");
        s.src = map.maplibre_js; s.integrity = map.maplibre_js_sri; s.crossOrigin = "anonymous";
        s.onload = function () { window.maplibregl ? resolve(window.maplibregl) : reject(new Error("no maplibre")); };
        s.onerror = function () { reject(new Error("maplibre failed")); };
        document.head.appendChild(s);
      });
    }
    return libPromise;
  }

  function webglOK() {
    try {
      var c = document.createElement("canvas");
      return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl")));
    } catch (e) { return false; }
  }

  function style(m) {
    var name = ["coalesce", ["get", "name:en"], ["get", "name:latin"], ["get", "name"]];
    if (LANG === "ru") name = ["get", "name:ru"];
    return {
      version: 8,
      glyphs: m.glyphs,
      sources: {omt: {type: "vector", url: m.tiles}},
      layers: [
        {id: "land", type: "background", paint: {"background-color": "#F2F1EB"}},
        {id: "green", type: "fill", source: "omt", "source-layer": "landcover",
         filter: ["in", ["get", "class"], ["literal", ["wood", "grass", "wetland"]]],
         paint: {"fill-color": "#E3EADF", "fill-opacity": 0.7}},
        {id: "water", type: "fill", source: "omt", "source-layer": "water",
         paint: {"fill-color": "#C9E6E1"}},
        {id: "water-names", type: "symbol", source: "omt", "source-layer": "water_name",
         layout: {"text-field": name, "text-font": ["Noto Sans Regular"], "text-size": 11,
                  "text-letter-spacing": 0.12, "text-transform": "uppercase", "text-max-width": 8},
         paint: {"text-color": "#6F9AA0"}},
        {id: "places", type: "symbol", source: "omt", "source-layer": "place",
         filter: ["in", ["get", "class"], ["literal", ["island", "city", "town"]]],
         layout: {"text-field": name, "text-font": ["Noto Sans Regular"], "text-size": 11, "text-max-width": 8},
         paint: {"text-color": "#5E7078", "text-halo-color": "#F2F1EB", "text-halo-width": 1.4}}
      ]
    };
  }

  function marker(lib, map, lngLat, cls, label, side) {
    var node = el("div", "mk " + cls + (side ? " mk-" + side : ""));
    node.appendChild(el("span", "mk-dot"));
    if (label) node.appendChild(el("span", "mk-label", label));
    return new lib.Marker({element: node, anchor: "center"}).setLngLat(lngLat).addTo(map);
  }

  var ALL_SIDE = {"racha-yai-racha-noi": "left", "maiton-island": "left", "hong-island-krabi": "top",
                  "phang-nga-bay-james-bond-island": "left"};

  function boundsOf(lib, points) {
    var b = new lib.LngLatBounds(points[0], points[0]);
    points.forEach(function (p) { b.extend(p); });
    return b;
  }

  function heroPhoto(d) {
    for (var i = 0; i < d.photos.length; i++) if (d.photos[i].role === "hero") return d.photos[i];
    return d.photos[0];
  }

  function placeCard(node, map, d, onClose) {
    var card = el("div", "place");
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-label", L(d, "name", d.name));
    var ph = heroPhoto(d);
    var frame = el("div", "place-photo");
    var img = el("img");
    img.alt = L(d, "alt", ph.alt);
    img.decoding = "async";
    img.width = ph.w1200;
    img.height = Math.round(ph.w1200 * ph.height / ph.width);
    frame.appendChild(img);
    card.appendChild(frame);
    var close = el("button", "place-close");
    close.type = "button";
    close.setAttribute("aria-label", S.close);
    close.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17"/></svg>';
    close.addEventListener("click", function (ev) { ev.stopPropagation(); onClose(); });
    card.appendChild(close);
    var body = el("div", "place-body");
    body.appendChild(el("p", "place-name", L(d, "name", d.name)));
    body.appendChild(el("p", "place-facts", fmt(S.facts, {time: cap(L(d, "time", d.time)), from: L(d, "nearest", "")})));
    body.appendChild(el("p", "place-verdict", L(d, "verdict", d.verdict)));
    var a = el("a", "place-action", L(d, "link", "See " + d.short));
    a.href = ROOT + d.page;
    body.appendChild(a);
    card.appendChild(body);
    ["click", "mousedown", "touchstart", "wheel", "dblclick"].forEach(function (t) {
      card.addEventListener(t, function (ev) { ev.stopPropagation(); }, {passive: t === "touchstart" || t === "wheel"});
    });
    node.appendChild(card);
    var w = frame.clientWidth || 300, h = frame.clientHeight || w * 2 / 3;
    var need = Math.ceil(Math.max(w, h * ph.width / ph.height));
    img.sizes = need + "px";
    img.srcset = ROOT + ph.src1200 + " " + ph.w1200 + "w, " + ROOT + ph.src + " " + ph.width + "w";
    img.src = ROOT + ph.src1200;
    var pt = map.project([d.lon, d.lat]);
    var mapW = node.clientWidth, mapH = node.clientHeight;
    var cr = card.getBoundingClientRect(), nr = node.getBoundingClientRect();
    var box = {l: cr.left - nr.left, t: cr.top - nr.top, r: cr.right - nr.left, b: cr.bottom - nr.top};
    var hidden = pt.x > box.l - 24 && pt.x < box.r + 24 && pt.y > box.t - 24 && pt.y < box.b + 24;
    var outside = pt.x < 20 || pt.x > mapW - 20 || pt.y < 20 || pt.y > mapH - 20;
    if (hidden || outside) {
      var phone = box.r - box.l > mapW - 60;
      var offset = phone ? [0, -Math.round((box.b - box.t) / 2) - 8] : [Math.round((box.r + 12) / 2), 0];
      map.easeTo({center: [d.lon, d.lat], offset: offset, duration: 450});
    }
    return card;
  }

  var PHUKET_VIEW = [98.37, 7.95];   // lng, lat: the middle of Phuket island, to frame a single-place map

  function initMap(node, data, lib) {
    var mode = node.getAttribute("data-dest-map");
    var single = mode !== "all" ? byId(data, mode) : null;
    if (mode !== "all" && !single) return;
    var holder = el("div", "dest-map-canvas");
    node.appendChild(holder);
    var options = {
      container: holder, style: style(data.map), attributionControl: {compact: false},
      cooperativeGestures: true, dragRotate: false, pitchWithRotate: false, touchPitch: false,
      fadeDuration: 0, maxZoom: 13, minZoom: 5
    };
    if (S.mapLocale) options.locale = S.mapLocale;
    var map = new lib.Map(options);
    map.touchZoomRotate.disableRotation();
    map.addControl(new lib.NavigationControl({showCompass: false}), "top-right");
    var pts = [];
    map.on("error", function () { /* a missing tile is not a failure */ });
    map.on("load", function () { node.classList.add("is-ready"); });
    node.classList.add("is-ready");
    if (single) {
      marker(lib, map, [single.lon, single.lat], "mk-dest", L(single, "short", single.short));
      pts.push([single.lon, single.lat], PHUKET_VIEW);
      map.fitBounds(boundsOf(lib, pts), {padding: {top: 50, bottom: 50, left: 70, right: 96}, maxZoom: 10, duration: 0});
      return;
    }
    var open = null;   // {card, pin}
    function closeCard() {
      if (!open) return;
      open.card.remove();
      open.pin.classList.remove("is-active");
      open = null;
    }
    data.destinations.forEach(function (d) {
      var mk = marker(lib, map, [d.lon, d.lat], "mk-dest mk-button", L(d, "short", d.short), ALL_SIDE[d.slug]);
      var pin = mk.getElement();
      pin.setAttribute("role", "button");
      pin.setAttribute("tabindex", "0");
      pin.setAttribute("aria-label", fmt(S.pin, {name: L(d, "name", d.name), time: L(d, "time", d.time), from: L(d, "nearest", "")}));
      var show = function (ev, keyboard) {
        if (ev) ev.stopPropagation();
        closeCard();
        pin.classList.add("is-active");
        open = {pin: pin, card: placeCard(node, map, d, closeCard)};
        if (keyboard) open.card.querySelector(".place-action").focus({preventScroll: true});
      };
      pin.addEventListener("click", function (ev) { show(ev, false); });
      pin.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); show(null, true); }
      });
      pts.push([d.lon, d.lat]);
    });
    map.on("click", closeCard);
    node.addEventListener("keydown", function (ev) { if (ev.key === "Escape") closeCard(); });
    map.fitBounds(boundsOf(lib, pts), {padding: {top: 36, bottom: 36, left: 36, right: 96}, duration: 0});
  }

  function startMaps(nodes) {
    if (!nodes.length) return;
    whenNear(nodes, function (node) {
      if (!webglOK()) return;   // the plain text stays
      getData().then(function (data) {
        return loadLib(data.map).then(function (lib) { initMap(node, data, lib); });
      }).catch(function () { node.classList.add("is-failed"); });
    });
  }

  var SEVERITY = {sun: 0, partly: 1, cloud: 2, rain: 3, heavy: 4, thunder: 5};

  function base(code) { return (code || "").replace(/_(day|night|polartwilight)$/, ""); }

  function words(code) {
    var c = base(code);
    if (/thunder/.test(c)) return S.thunder;
    if (/_night$/.test(code || "") && S.nightWords[c]) return S.nightWords[c];
    if (S.words[c]) return S.words[c];
    return LANG === "en" ? cap(c.replace(/([a-z])(and)/g, "$1 and ")) : cap(S.skyText[kind(code)]);
  }

  function kind(code) {
    var c = base(code);
    if (/thunder/.test(c)) return "thunder";
    if (/^heavy(rain|sleet|snow)/.test(c)) return "heavy";
    if (/rain|sleet|snow/.test(c)) return "rain";
    if (c === "fair" || c === "partlycloudy") return "partly";
    if (c === "cloudy" || c === "fog") return "cloud";
    return "sun";
  }

  var CLOUD = '<path fill="#fff" d="M10.5 25.5h13a5.5 5.5 0 0 0 .9-10.93A7.25 7.25 0 0 0 10.6 14a5.75 5.75 0 0 0-.1 11.5z"/>';
  var CLOUD_UP = '<path fill="#fff" d="M10.5 21h13a5.25 5.25 0 0 0 .85-10.43A7 7 0 0 0 10.6 9.95 5.53 5.53 0 0 0 10.5 21z"/>';
  function rays(cx, cy, r1, r2) {
    var s = "";
    for (var i = 0; i < 8; i++) {
      var a = i * Math.PI / 4;
      s += '<line x1="' + (cx + r1 * Math.cos(a)).toFixed(2) + '" y1="' + (cy + r1 * Math.sin(a)).toFixed(2) +
           '" x2="' + (cx + r2 * Math.cos(a)).toFixed(2) + '" y2="' + (cy + r2 * Math.sin(a)).toFixed(2) + '"/>';
    }
    return '<g stroke="#FFD60A" stroke-width="2" stroke-linecap="round">' + s + "</g>";
  }
  function drops(n) {
    var xs = n === 3 ? [11, 16.5, 22] : [9, 13.5, 18, 22.5];
    return '<g stroke="#64D2FF" stroke-width="2.2" stroke-linecap="round">' + xs.map(function (x) {
      return '<line x1="' + x + '" y1="24" x2="' + (x - 1.6) + '" y2="' + (n === 3 ? 28.5 : 30) + '"/>';
    }).join("") + "</g>";
  }
  var ICONS = {
    sun: '<circle cx="16" cy="16" r="6" fill="#FFD60A"/>' + rays(16, 16, 9, 12),
    partly: '<circle cx="12" cy="12" r="4.6" fill="#FFD60A"/>' + rays(12, 12, 7, 9.4) +
            '<path fill="#fff" d="M13 27h11a4.75 4.75 0 0 0 .78-9.44A6.25 6.25 0 0 0 13.1 17.1 4.96 4.96 0 0 0 13 27z"/>',
    cloud: CLOUD,
    rain: CLOUD_UP + drops(3),
    heavy: CLOUD_UP + drops(4),
    thunder: CLOUD_UP + '<path fill="#FFD60A" d="M17.6 20.5l-4.6 6.3h3.3l-1.5 5 5.4-7h-3.4l1.6-4.3z"/>'
  };

  function icon(k) {
    var s = document.createElementNS(SVGNS, "svg");
    s.setAttribute("viewBox", "0 0 32 32");
    s.setAttribute("class", "wx-glyph");
    s.setAttribute("aria-hidden", "true");
    s.innerHTML = ICONS[k] || ICONS.sun;
    return s;
  }

  function arrow(deg) {
    var s = document.createElementNS(SVGNS, "svg");
    s.setAttribute("viewBox", "0 0 16 16");
    s.setAttribute("class", "wx-arrow");
    s.setAttribute("aria-hidden", "true");
    s.innerHTML = '<path d="M8 2.5l4 9.5-4-2.4-4 2.4z" fill="currentColor"/>';
    s.style.transform = "rotate(" + Math.round((deg + 180) % 360) + "deg)";
    return s;
  }

  function localParts(iso) {
    var d = new Date(iso);
    var f = new Intl.DateTimeFormat("en-GB", {timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23"});
    var p = {};
    f.formatToParts(d).forEach(function (x) { p[x.type] = x.value; });
    return {key: p.year + "-" + p.month + "-" + p.day, hour: Number(p.hour), date: d};
  }

  var POINTS = S.points;

  function meanDir(pairs) {
    var x = 0, y = 0;
    pairs.forEach(function (p) { var r = p[0] * Math.PI / 180; x += Math.sin(r) * p[1]; y += Math.cos(r) * p[1]; });
    return (Math.atan2(x, y) * 180 / Math.PI + 360) % 360;
  }

  function windSpeed(ms) { return Math.round(ms * S.windMul); }

  function analyse(json) {
    var ts = json.properties.timeseries;
    var days = {}, order = [];
    ts.forEach(function (t) {
      var lp = localParts(t.time);
      var d = days[lp.key];
      if (!d) { d = days[lp.key] = {date: lp.date, temps: [], winds: [], allWinds: [], rain: 0, sky6: []}; order.push(lp.key); }
      var inst = t.data.instant.details;
      if (inst.air_temperature != null) d.temps.push(inst.air_temperature);
      if (inst.wind_speed != null) {
        var pair = [inst.wind_from_direction, inst.wind_speed];
        d.allWinds.push(pair);
        if (lp.hour >= 7 && lp.hour <= 19) d.winds.push(pair);
      }
      var n1 = t.data.next_1_hours, n6 = t.data.next_6_hours;
      if (n1 && n1.details && n1.details.precipitation_amount != null) d.rain += n1.details.precipitation_amount;
      else if (n6 && n6.details && n6.details.precipitation_amount != null) d.rain += n6.details.precipitation_amount;
      if (n6 && n6.details) {
        if (n6.details.air_temperature_max != null) d.temps.push(n6.details.air_temperature_max);
        if (n6.details.air_temperature_min != null) d.temps.push(n6.details.air_temperature_min);
      }
      if (n6 && n6.summary) d.sky6.push([lp.hour, n6.summary.symbol_code]);
    });
    var list = order.slice(0, 7).map(function (k) {
      var d = days[k];
      var skies = d.sky6.filter(function (s) { return s[0] >= 6 && s[0] <= 13; });
      if (!skies.length && d.sky6.length) {
        skies = [d.sky6.slice().sort(function (a, b) { return Math.abs(a[0] - 12) - Math.abs(b[0] - 12); })[0]];
      }
      skies = skies.map(function (s) { return s[1]; });
      var sky = "sun";
      skies.forEach(function (c) { var kk = kind(c); if (SEVERITY[kk] > SEVERITY[sky]) sky = kk; });
      var w = d.winds.length ? d.winds : d.allWinds;
      return {
        date: d.date,
        lo: d.temps.length ? Math.round(Math.min.apply(null, d.temps)) : null,
        hi: d.temps.length ? Math.round(Math.max.apply(null, d.temps)) : null,
        rain: d.rain, sky: sky,
        wind: w.length ? windSpeed(Math.max.apply(null, w.map(function (p) { return p[1]; }))) : null,
        dir: w.length ? meanDir(w) : null
      };
    }).filter(function (d) { return d.lo != null; });
    var first = ts[0] && ts[0].data;
    var nowCode = first && ((first.next_1_hours && first.next_1_hours.summary.symbol_code) ||
                            (first.next_6_hours && first.next_6_hours.summary.symbol_code));
    var now = first ? {temp: Math.round(first.instant.details.air_temperature), sky: words(nowCode)} : null;
    return {now: now, days: list};
  }

  function dayName(date, i) {
    if (i === 0) return S.today;
    return cap(new Intl.DateTimeFormat(S.locale, {timeZone: TZ, weekday: "short"}).format(date));
  }
  function longDay(date, i) {
    if (i === 0) return S.today;
    return cap(new Intl.DateTimeFormat(S.locale, {timeZone: TZ, weekday: "long"}).format(date));
  }

  var SKY_TEXT = S.skyText;

  function row(d, i, min, max, nowTemp) {
    var li = el("li", "wx-row");
    var span = Math.max(1, max - min);
    var rainy = d.rain >= 0.5;
    var mm = fmt(S.mm, {n: Math.max(1, Math.round(d.rain))});
    var sr = fmt(S.srRow, {
      day: longDay(d.date, i), sky: SKY_TEXT[d.sky], lo: d.lo, hi: d.hi,
      rain: rainy ? fmt(S.srRain, {mm: mm}) : "",
      wind: d.wind != null ? fmt(S.srWind, {n: d.wind, unit: plural(d.wind, S.windWord), point: POINTS[Math.round(d.dir / 45) % 8]}) : ""
    });
    li.appendChild(el("span", "sr-only", sr));
    var vis = el("span", "wx-cells");
    vis.setAttribute("aria-hidden", "true");
    vis.appendChild(el("span", "wx-day", dayName(d.date, i)));
    var ic = el("span", "wx-icon");
    ic.appendChild(icon(d.sky));
    if (rainy) ic.appendChild(el("span", "wx-mm", mm));
    vis.appendChild(ic);
    vis.appendChild(el("span", "wx-lo", d.lo + "°"));
    var bar = el("span", "wx-bar");
    var fill = el("span", "wx-fill");
    var l = (d.lo - min) / span, w = Math.max((d.hi - d.lo) / span, 0.06);
    if (l + w > 1) l = 1 - w;
    fill.style.left = (l * 100).toFixed(2) + "%";
    fill.style.width = (w * 100).toFixed(2) + "%";
    fill.style.backgroundSize = (100 / w).toFixed(2) + "% 100%";
    fill.style.backgroundPosition = (w >= 1 ? 0 : (l / (1 - w)) * 100).toFixed(2) + "% 0";
    bar.appendChild(fill);
    if (i === 0 && nowTemp != null) {
      var dot = el("span", "wx-now-dot");
      dot.style.left = (Math.min(1, Math.max(0, (nowTemp - min) / span)) * 100).toFixed(2) + "%";
      bar.appendChild(dot);
    }
    vis.appendChild(bar);
    vis.appendChild(el("span", "wx-hi", d.hi + "°"));
    var wind = el("span", "wx-wind");
    if (d.wind != null) {
      wind.appendChild(arrow(d.dir));
      wind.appendChild(document.createTextNode(fmt(S.windCell, {n: d.wind})));
    }
    vis.appendChild(wind);
    li.appendChild(vis);
    return li;
  }

  function render(box, d, an) {
    var now = box.querySelector(".wx-now"), rows = box.querySelector(".wx-rows");
    var today = an.days[0];
    now.textContent = "";
    now.appendChild(el("p", "wx-place", L(d, "wx_name", d.wx_name || d.short)));
    if (an.now) {
      now.appendChild(el("p", "wx-temp", an.now.temp + "°"));
      now.appendChild(el("p", "wx-sky", an.now.sky));
    }
    now.appendChild(el("p", "wx-hl", fmt(S.hl, {hi: today.hi, lo: today.lo})));
    var min = Math.min.apply(null, an.days.map(function (x) { return x.lo; }));
    var max = Math.max.apply(null, an.days.map(function (x) { return x.hi; }));
    rows.textContent = "";
    an.days.forEach(function (x, i) { rows.appendChild(row(x, i, min, max, an.now && an.now.temp)); });
  }

  function yrLink(d) {
    return "https://www.yr.no/en/forecast/daily-table/" + d.lat.toFixed(4) + "," + d.lon.toFixed(4);
  }

  function cacheGet(key) {
    try {
      var v = JSON.parse(sessionStorage.getItem(key) || "null");
      if (v && v.expires > Date.now()) return v.json;
    } catch (e) {}
    return null;
  }

  function cacheSet(key, json, expires) {
    try { sessionStorage.setItem(key, JSON.stringify({json: json, expires: expires})); } catch (e) {}
  }

  function forecast(d) {
    var lat = d.lat.toFixed(4), lon = d.lon.toFixed(4);
    var key = "oo-wx-" + lat + "," + lon;
    var hit = cacheGet(key);
    if (hit) return Promise.resolve(hit);
    return fetch(MET + "?lat=" + lat + "&lon=" + lon, {credentials: "omit"}).then(function (r) {
      if (!r.ok) throw new Error("met " + r.status);
      var exp = Date.parse(r.headers.get("Expires") || "") || (Date.now() + 30 * 60000);
      return r.json().then(function (j) { cacheSet(key, j, Math.max(exp, Date.now() + 10 * 60000)); return j; });
    });
  }

  var fontsAsked = false;
  function thinFont() {
    if (fontsAsked) return;
    fontsAsked = true;
    var l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Manrope:wght@200;300&display=swap";
    document.head.appendChild(l);
  }

  function showWeather(box, d) {
    var card = box.querySelector(".wx-card");
    var status = box.querySelector(".wx-status");
    var ticket = {};
    box._wx = ticket;
    card.setAttribute("aria-busy", "true");
    forecast(d).then(function (json) {
      if (box._wx !== ticket) return;
      var an = analyse(json);
      if (!an.days.length) throw new Error("empty");
      render(box, d, an);
      box.classList.remove("is-failed");
      box.classList.add("is-ready");
      if (status) status.textContent = "";
    }).catch(function () {
      if (box._wx !== ticket) return;
      box.classList.remove("is-ready");
      box.classList.add("is-failed");
      if (status) {
        status.textContent = S.failed + " ";
        var a = el("a", null, fmt(S.failedLink, {short: L(d, "short", d.short)}));
        a.href = yrLink(d); a.target = "_blank"; a.rel = "noopener";
        status.appendChild(a);
      }
    }).then(function () { card.removeAttribute("aria-busy"); });
  }

  function startWeather(boxes) {
    if (!boxes.length) return;
    whenNear(boxes, function (box) {
      thinFont();
      getData().then(function (data) {
        var tabs = Array.prototype.slice.call(box.querySelectorAll("[data-wx-pick]"));
        var pick = function (slug, focus) {
          var d = byId(data, slug);
          if (!d) return;
          tabs.forEach(function (t) {
            var on = t.getAttribute("data-wx-pick") === slug;
            t.setAttribute("aria-selected", String(on));
            t.tabIndex = on ? 0 : -1;
            if (on && focus) t.focus();
            if (on && t.scrollIntoView && t.parentNode.scrollWidth > t.parentNode.clientWidth) {
              var p = t.parentNode;
              p.scrollTo({left: t.offsetLeft - (p.clientWidth - t.offsetWidth) / 2, behavior: "smooth"});
            }
          });
          showWeather(box, d);
        };
        tabs.forEach(function (t, i) {
          t.addEventListener("click", function () { pick(t.getAttribute("data-wx-pick")); });
          t.addEventListener("keydown", function (ev) {
            var j = ev.key === "ArrowRight" ? i + 1 : ev.key === "ArrowLeft" ? i - 1 : null;
            if (j == null) return;
            ev.preventDefault();
            pick(tabs[(j + tabs.length) % tabs.length].getAttribute("data-wx-pick"), true);
          });
        });
        pick(box.getAttribute("data-weather"));
      }).catch(function () {
        box.classList.add("is-failed");
        var status = box.querySelector(".wx-status");
        if (status) status.textContent = S.failed;
      });
    });
  }

  function start() {
    startMaps(Array.prototype.slice.call(document.querySelectorAll("[data-dest-map]")));
    startWeather(Array.prototype.slice.call(document.querySelectorAll("[data-weather]")));
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
