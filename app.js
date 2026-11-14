(function () {
  'use strict';

  var W = 2223, H = 1637;
  var FOCUS_X = 0.33, FOCUS_Y = 0.50;

  var ASSETS = {
    map: 'assets/map-clean.jpg?v=3',
    A: 'assets/A.jpg',
    B: 'assets/B.jpg',
    C: 'assets/C.jpg',
    effect1: 'assets/effect1.jpg',
    effect2: 'assets/effect2.jpg',
    effect3: 'assets/effect3.jpg'
  };

  var SPOTS = {
    A: {
      id: 'A', x: 472.7, y: 1265.3, tag: '茶室', name: '临水茶室',
      desc: '木构茶室，落地窗正对锦鲤池与主楼',
      yaw: 15, pitch: -0.02
    },
    B: {
      id: 'B', x: 1024.0, y: 1007.4, tag: '露台', name: '庭院露台',
      desc: '户外茶座与遮阳伞，临水正对茶室',
      yaw: 90, pitch: -0.03
    },
    C: {
      id: 'C', x: 403.0, y: 747.8, tag: '石桥', name: '石桥园路',
      desc: '石板园路与拱桥，串联水景与茶室',
      yaw: 90, pitch: -0.02
    }
  };
  var ORDER = ['A', 'B', 'C'];

  var EFFECTS = [
    { src: ASSETS.effect1, spot: 'B', alt: '庭院露台效果图' },
    { src: ASSETS.effect2, spot: 'A', alt: '临水茶室效果图' },
    { src: ASSETS.effect3, spot: 'C', alt: '石桥园路效果图' }
  ];

  var $ = function (sel) { return document.querySelector(sel); };

  var frame = $('#frame');
  var frameBg = $('#frameBg');
  var mapLayer = $('#mapLayer');
  var mapImg = $('#mapImg');
  var mapLoading = $('#mapLoading');
  var markerLayer = $('#markerLayer');
  var hint = $('#hint');
  var callout = $('#callout');
  var calloutScrim = $('#calloutScrim');
  var calloutImg = $('#calloutImg');
  var calloutKicker = $('#calloutKicker');
  var calloutName = $('#calloutName');
  var calloutDesc = $('#calloutDesc');
  var enterBtn = $('#enterBtn');

  var fw = 0, fh = 0;
  var s = 1, tx = 0, ty = 0;
  var minS = 1, maxS = 1, coverS = 1;
  var inited = false, mapReady = false;
  var animId = null;
  var activeSpot = null;
  var calloutToken = 0;
  var hintTimer = null;

  var markerEls = {};

  /* ---------------- map ---------------- */

  function buildMarkers() {
    ORDER.forEach(function (id) {
      var sp = SPOTS[id];
      var b = document.createElement('button');
      b.className = 'marker';
      b.type = 'button';
      b.setAttribute('data-spot', id);
      b.setAttribute('aria-label', sp.name + '，查看全景');
      b.innerHTML = '<span class="dot">' + id + '</span><span class="tag">' + sp.tag + '</span>';
      markerLayer.appendChild(b);
      markerEls[id] = b;
    });
  }

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function clampView(ns, ntx, nty) {
    var w = W * ns, h = H * ns;
    var x = ntx, y = nty;
    if (w <= fw + 0.5) x = (fw - w) / 2;
    else x = clamp(x, fw - w, 0);
    if (h <= fh + 0.5) y = (fh - h) / 2;
    else y = clamp(y, fh - h, 0);
    return { s: ns, tx: x, ty: y };
  }

  function apply() {
    mapLayer.style.transform = 'translate3d(' + tx.toFixed(2) + 'px,' + ty.toFixed(2) + 'px,0) scale(' + s.toFixed(5) + ')';
    ORDER.forEach(function (id) {
      var sp = SPOTS[id];
      var el = markerEls[id];
      if (!el) return;
      var x = tx + sp.x * s;
      var y = ty + sp.y * s;
      el.style.transform = 'translate3d(' + x.toFixed(2) + 'px,' + y.toFixed(2) + 'px,0)';
      el.classList.toggle('left', x > fw - 96);
    });
    if (callout.classList.contains('show')) closeCallout();
  }

  function measure() {
    var r = frame.getBoundingClientRect();
    fw = r.width;
    fh = r.height;
  }

  function initView() {
    measure();
    if (fw < 20 || fh < 20) return;

    var oldFW = fw, oldFH = fh;
    minS = Math.min(fw / W, fh / H);
    coverS = Math.max(fw / W, fh / H);
    maxS = Math.min(0.85, Math.max(coverS * 2.2, 0.95));

    if (!inited) {
      s = coverS;
      tx = fw / 2 - FOCUS_X * W * s;
      ty = fh / 2 - FOCUS_Y * H * s;
      inited = true;
    } else {
      /* keep the map point under the frame centre while resizing */
      var cx = (oldFW / 2 - tx) / s;
      var cy = (oldFH / 2 - ty) / s;
      var ratio = s / (coverS || s);
      s = clamp(coverS * ratio, minS, maxS);
      tx = fw / 2 - cx * s;
      ty = fh / 2 - cy * s;
    }

    var v = clampView(s, tx, ty);
    s = v.s; tx = v.tx; ty = v.ty;
    apply();
    mapLoading.classList.add('hide');
  }

  function onResize() {
    if (!mapReady || !inited) { initView(); return; }
    var oldW = fw, oldH = fh;
    measure();
    if (fw < 20 || fh < 20) return;
    var cx = (oldW / 2 - tx) / s;
    var cy = (oldH / 2 - ty) / s;
    minS = Math.min(fw / W, fh / H);
    coverS = Math.max(fw / W, fh / H);
    maxS = Math.min(0.85, Math.max(coverS * 2.2, 0.95));
    s = clamp(s, minS, maxS);
    tx = fw / 2 - cx * s;
    ty = fh / 2 - cy * s;
    var v = clampView(s, tx, ty);
    s = v.s; tx = v.tx; ty = v.ty;
    apply();
  }

  function stopAnim() {
    if (animId) { cancelAnimationFrame(animId); animId = null; }
  }

  function animateTo(ns, ntx, nty, dur) {
    stopAnim();
    var t0 = performance.now();
    var s0 = s, x0 = tx, y0 = ty;
    dur = dur || 300;
    function step(t) {
      var k = Math.min(1, (t - t0) / dur);
      var e = 1 - Math.pow(1 - k, 3);
      s = s0 + (ns - s0) * e;
      tx = x0 + (ntx - x0) * e;
      ty = y0 + (nty - y0) * e;
      mapLayer.style.transform = 'translate3d(' + tx.toFixed(2) + 'px,' + ty.toFixed(2) + 'px,0) scale(' + s.toFixed(5) + ')';
      ORDER.forEach(function (id) {
        var sp = SPOTS[id], el = markerEls[id];
        var x = tx + sp.x * s, y = ty + sp.y * s;
        el.style.transform = 'translate3d(' + x.toFixed(2) + 'px,' + y.toFixed(2) + 'px,0)';
        el.classList.toggle('left', x > fw - 96);
      });
      if (k < 1) animId = requestAnimationFrame(step);
      else { animId = null; }
    }
    animId = requestAnimationFrame(step);
  }

  function zoomAt(ns, cx, cy, animate) {
    ns = clamp(ns, minS, maxS);
    var k = ns / s;
    var ntx = cx - (cx - tx) * k;
    var nty = cy - (cy - ty) * k;
    var v = clampView(ns, ntx, nty);
    if (animate) animateTo(v.s, v.tx, v.ty, 260);
    else { s = v.s; tx = v.tx; ty = v.ty; apply(); }
  }

  function resetView(animate) {
    var ns = coverS;
    var ntx = fw / 2 - FOCUS_X * W * ns;
    var nty = fh / 2 - FOCUS_Y * H * ns;
    var v = clampView(ns, ntx, nty);
    if (animate) animateTo(v.s, v.tx, v.ty, 340);
    else { s = v.s; tx = v.tx; ty = v.ty; apply(); }
  }

  function fitView(animate) {
    var v = clampView(minS, (fw - W * minS) / 2, (fh - H * minS) / 2);
    if (animate) animateTo(v.s, v.tx, v.ty, 340);
    else { s = v.s; tx = v.tx; ty = v.ty; apply(); }
  }

  /* gestures */
  var pointers = new Map();
  var panStart = null;
  var pinchStart = null;
  var lastTap = 0;
  var downInfo = null;

  frame.addEventListener('pointerdown', function (e) {
    if (e.target.closest('.controls, .callout, .marker')) return;
    if (e.button !== undefined && e.button !== 0 && e.pointerType === 'mouse') return;

    hideHint();
    stopAnim();
    frame.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    frame.classList.add('dragging');

    if (pointers.size === 1) {
      panStart = { x: e.clientX, y: e.clientY, tx: tx, ty: ty };
      downInfo = { x: e.clientX, y: e.clientY, t: performance.now() };
      pinchStart = null;
    } else if (pointers.size === 2) {
      var pts = Array.from(pointers.values());
      var dx = pts[0].x - pts[1].x, dy = pts[0].y - pts[1].y;
      pinchStart = {
        d: Math.max(1, Math.hypot(dx, dy)),
        s: s, tx: tx, ty: ty,
        mx: (pts[0].x + pts[1].x) / 2,
        my: (pts[0].y + pts[1].y) / 2
      };
      panStart = null;
    }
  });

  frame.addEventListener('pointermove', function (e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.size === 2 && pinchStart) {
      var pts = Array.from(pointers.values());
      var dx = pts[0].x - pts[1].x, dy = pts[0].y - pts[1].y;
      var d = Math.max(1, Math.hypot(dx, dy));
      var ns = clamp(pinchStart.s * d / pinchStart.d, minS, maxS);
      var mx = (pts[0].x + pts[1].x) / 2;
      var my = (pts[0].y + pts[1].y) / 2;
      var k = ns / pinchStart.s;
      var ntx = mx - (pinchStart.mx - pinchStart.tx) * k;
      var nty = my - (pinchStart.my - pinchStart.ty) * k;
      var v = clampView(ns, ntx, nty);
      s = v.s; tx = v.tx; ty = v.ty;
      apply();
      return;
    }

    if (pointers.size === 1 && panStart) {
      var r = frame.getBoundingClientRect();
      var mx2 = e.clientX - r.left;
      var my2 = e.clientY - r.top;
      tx = panStart.tx + (mx2 - (panStart.x - r.left));
      ty = panStart.ty + (my2 - (panStart.y - r.top));
      var cv = clampView(s, tx, ty);
      tx = cv.tx; ty = cv.ty;
      apply();
    }
  });

  function endPointer(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);

    if (pointers.size === 1) {
      var rest = Array.from(pointers.values())[0];
      panStart = { x: rest.x, y: rest.y, tx: tx, ty: ty };
      pinchStart = null;
      downInfo = null;
    } else if (pointers.size === 0) {
      frame.classList.remove('dragging');
      panStart = null;
      pinchStart = null;
      if (downInfo && e.pointerType !== 'mouse') {
        var moved = Math.hypot(e.clientX - downInfo.x, e.clientY - downInfo.y);
        var dt = performance.now() - downInfo.t;
        if (moved < 9 && dt < 320) {
          var now = performance.now();
          if (now - lastTap < 320) {
            var r = frame.getBoundingClientRect();
            var cx = e.clientX - r.left, cy = e.clientY - r.top;
            if (s > coverS * 1.55) resetView(true);
            else zoomAt(Math.min(maxS, coverS * 2.0), cx, cy, true);
            lastTap = 0;
          } else {
            lastTap = now;
          }
        }
      }
      downInfo = null;
    }
  }

  frame.addEventListener('pointerup', endPointer);
  frame.addEventListener('pointercancel', endPointer);

  frame.addEventListener('wheel', function (e) {
    e.preventDefault();
    hideHint();
    var r = frame.getBoundingClientRect();
    var factor = Math.exp(-e.deltaY * 0.0014);
    zoomAt(s * factor, e.clientX - r.left, e.clientY - r.top, false);
  }, { passive: false });

  /* controls */
  $('#zoomIn').addEventListener('click', function () {
    hideHint();
    zoomAt(s * 1.42, fw / 2, fh / 2, true);
  });
  $('#zoomOut').addEventListener('click', function () {
    hideHint();
    zoomAt(s / 1.42, fw / 2, fh / 2, true);
  });
  $('#fitBtn').addEventListener('click', function () {
    hideHint();
    fitView(true);
  });
  $('#resetBtn').addEventListener('click', function () {
    hideHint();
    resetView(true);
  });

  /* ---------------- callout ---------------- */

  function hideHint() {
    hint.classList.add('hide');
    if (hintTimer) { clearTimeout(hintTimer); hintTimer = null; }
  }

  function openCallout(id) {
    var sp = SPOTS[id];
    if (!sp) return;
    closeCallout(true);
    hideHint();
    activeSpot = id;

    var token = ++calloutToken;
    calloutImg.src = ASSETS[id];
    calloutKicker.textContent = id + ' · 全景点位';
    calloutName.textContent = sp.name;
    calloutDesc.textContent = sp.desc;
    callout.hidden = false;
    calloutScrim.hidden = false;
    markActive(id);

    requestAnimationFrame(function () {
      if (token !== calloutToken) return;
      positionCallout();
      callout.classList.add('show');
    });
  }

  function positionCallout() {
    var sp = SPOTS[activeSpot];
    if (!sp) return;
    var mx = tx + sp.x * s;
    var my = ty + sp.y * s;
    var cw = callout.offsetWidth || 252;
    var ch = callout.offsetHeight || 130;

    var left = clamp(mx - cw / 2, 8, Math.max(8, fw - cw - 8));
    var top = my - ch - 27;
    if (top < 8) top = my + 30;
    top = clamp(top, 8, Math.max(8, fh - ch - 8));

    callout.style.left = left + 'px';
    callout.style.top = top + 'px';
    if (my > fh * 0.55) callout.style.transformOrigin = '50% 100%';
    else callout.style.transformOrigin = '50% 0%';
  }

  function closeCallout(immediate) {
    calloutToken++;
    callout.classList.remove('show');
    calloutScrim.hidden = true;
    activeSpot = null;
    markActive(null);
    if (immediate) { callout.hidden = true; return; }
    var token = calloutToken;
    setTimeout(function () {
      if (token === calloutToken) callout.hidden = true;
    }, 220);
  }

  function markActive(id) {
    ORDER.forEach(function (k) {
      if (markerEls[k]) markerEls[k].classList.toggle('active', k === id);
    });
  }

  calloutScrim.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    closeCallout();
  });
  $('#calloutClose').addEventListener('click', function () { closeCallout(); });
  enterBtn.addEventListener('click', function () {
    if (activeSpot) openViewer(activeSpot);
  });

  markerLayer.addEventListener('click', function (e) {
    var btn = e.target.closest('.marker');
    if (!btn) return;
    var id = btn.getAttribute('data-spot');
    if (id) openCallout(id);
  });

  /* ---------------- map boot ---------------- */

  function bootMap() {
    mapReady = true;
    measure();
    initView();
    hintTimer = setTimeout(hideHint, 6500);
  }

  mapImg.src = ASSETS.map;

  if (mapImg.complete && mapImg.naturalWidth) {
    bootMap();
  } else {
    mapImg.addEventListener('load', bootMap);
    mapImg.addEventListener('error', function () {
      mapLoading.classList.add('hide');
    });
  }

  var ro = new ResizeObserver(function () { onResize(); });
  ro.observe(frame);
  window.addEventListener('orientationchange', function () { setTimeout(onResize, 250); });

  /* ---------------- 720 viewer ---------------- */

  var viewer = $('#viewer');
  var canvas = $('#panoCanvas');
  var vName = $('#vName');
  var vHint = $('#vHint');
  var vLoading = $('#vLoading');
  var miniMap = $('#miniMap');
  var miniImg = $('#miniImg');
  var renderLayer = $('#renderLayer');
  var renderImg = $('#renderImg');
  var thumbStrip = $('#thumbStrip');
  miniImg.src = ASSETS.map;

  var renderer = null, scene3 = null, camera3 = null, sphere = null;
  var vOpen = false, currentSpot = null;
  var DEFAULT_FOV = 96, MIN_FOV = 40, MAX_FOV = 115;
  var vYaw = 0, vPitch = 0, vFov = DEFAULT_FOV;
  var texCache = {};
  var dirty = false;
  var loopId = null;
  var vPointers = new Map();
  var vDrag = null;
  var vPinch = null;
  var vVel = { x: 0, y: 0 };
  var inertiaId = null;
  var hintTimer2 = null;
  var preloadTimer = null;
  var renderOpen = false, renderToken = 0;

  function buildThumbs() {
    thumbStrip.innerHTML = EFFECTS.map(function (r, i) {
      return '<button class="effect-thumb" type="button" data-effect="' + i + '" aria-label="' + r.alt + '">' +
        '<img src="' + r.src + '" alt=""></button>';
    }).join('');
    thumbStrip.addEventListener('click', function (e) {
      var b = e.target.closest('.effect-thumb');
      if (!b) return;
      openRender(parseInt(b.getAttribute('data-effect'), 10));
    });
  }

  function initThree() {
    if (renderer) return true;
    if (!window.THREE) { vLoading.innerHTML = '<em>渲染组件加载失败</em>'; return false; }
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false });
    } catch (err) {
      vLoading.innerHTML = '<em>当前浏览器不支持 WebGL</em>';
      return false;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;

    scene3 = new THREE.Scene();
    camera3 = new THREE.PerspectiveCamera(72, 1, 1, 1200);
    camera3.rotation.order = 'YXZ';

    var geo = new THREE.SphereGeometry(500, 64, 40);
    geo.scale(-1, 1, 1);
    sphere = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
    sphere.frustumCulled = false;
    scene3.add(sphere);
    return true;
  }

  function resizeViewer() {
    if (!renderer) return;
    var w = viewer.clientWidth, h = viewer.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera3.aspect = w / h;
    camera3.updateProjectionMatrix();
    dirty = true;
  }

  function updateCamera() {
    if (!camera3) return;
    camera3.fov = vFov;
    camera3.updateProjectionMatrix();
    camera3.rotation.y = vYaw;
    camera3.rotation.x = vPitch;
    dirty = true;
  }

  function renderLoop() {
    if (!vOpen) return;
    if (dirty && renderer && scene3 && camera3) {
      renderer.render(scene3, camera3);
      dirty = false;
    }
    loopId = requestAnimationFrame(renderLoop);
  }

  function ensureTexture(id, cb) {
    if (texCache[id]) { cb(texCache[id]); return; }
    var loader = new THREE.TextureLoader();
    loader.load(ASSETS[id], function (tex) {
      tex.encoding = THREE.sRGBEncoding;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      tex.needsUpdate = true;
      texCache[id] = tex;
      cb(tex);
    }, undefined, function () {
      vLoading.innerHTML = '<em>全景图加载失败，请检查文件</em>';
      vLoading.classList.remove('hide');
    });
  }

  function updateMini(sp) {
    var dim = miniMap.clientWidth || 88;
    var ms = 0.10;
    miniImg.style.width = (W * ms) + 'px';
    miniImg.style.height = (H * ms) + 'px';
    miniImg.style.left = (dim / 2 - sp.x * ms) + 'px';
    miniImg.style.top = (dim / 2 - sp.y * ms) + 'px';
  }

  function openRender(i) {
    if (!EFFECTS[i]) return;
    renderToken++;
    renderOpen = true;
    renderImg.src = EFFECTS[i].src;
    renderImg.alt = EFFECTS[i].alt;
    renderLayer.hidden = false;
    viewer.classList.add('render-mode');
    requestAnimationFrame(function () { renderLayer.classList.add('show'); });
  }

  function closeRender() {
    if (!renderOpen) return;
    renderOpen = false;
    renderToken++;
    var token = renderToken;
    renderLayer.classList.remove('show');
    viewer.classList.remove('render-mode');
    setTimeout(function () {
      if (token === renderToken) renderLayer.hidden = true;
    }, 230);
  }

  function showSpot(id, done) {
    var sp = SPOTS[id];
    if (!sp) return;
    currentSpot = id;
    vName.textContent = sp.name;
    updateMini(sp);

    vYaw = sp.yaw * Math.PI / 180;
    vPitch = sp.pitch || 0;
    vFov = DEFAULT_FOV;
    updateCamera();

    vLoading.classList.remove('hide');
    ensureTexture(id, function (tex) {
      if (currentSpot !== id) return;
      sphere.material.map = tex;
      sphere.material.needsUpdate = true;
      dirty = true;
      vLoading.classList.add('hide');
      if (done) done();
    });
  }

  function openViewer(id) {
    if (!SPOTS[id]) return;
    closeCallout(true);
    if (!initThree()) {
      viewer.hidden = false;
      viewer.classList.add('show');
      return;
    }
    viewer.hidden = false;
    vOpen = true;
    resizeViewer();
    if (!thumbStrip.children.length) buildThumbs();
    renderOpen = false;
    renderLayer.hidden = true;
    renderLayer.classList.remove('show');
    viewer.classList.remove('render-mode');
    showSpot(id, function () {
      requestAnimationFrame(function () { dirty = true; });
    });
    requestAnimationFrame(function () { viewer.classList.add('show'); });
    vHint.classList.remove('hide');
    if (hintTimer2) clearTimeout(hintTimer2);
    hintTimer2 = setTimeout(function () { vHint.classList.add('hide'); }, 3800);
    if (loopId) cancelAnimationFrame(loopId);
    loopId = requestAnimationFrame(renderLoop);

    if (preloadTimer) clearTimeout(preloadTimer);
    preloadTimer = setTimeout(function () {
      ORDER.forEach(function (k) {
        if (k !== currentSpot) ensureTexture(k, function () {});
      });
    }, 1400);
  }

  function closeViewer() {
    if (!vOpen) return;
    vOpen = false;
    if (renderOpen) {
      renderOpen = false;
      renderToken++;
      renderLayer.classList.remove('show');
      renderLayer.hidden = true;
      viewer.classList.remove('render-mode');
    }
    viewer.classList.remove('show');
    if (loopId) { cancelAnimationFrame(loopId); loopId = null; }
    if (inertiaId) { cancelAnimationFrame(inertiaId); inertiaId = null; }
    stopVInertia();
    setTimeout(function () {
      if (!vOpen) viewer.hidden = true;
    }, 380);
  }

  function clampPitch(p) {
    return Math.max(-1.45, Math.min(1.45, p));
  }

  function stopVInertia() {
    if (inertiaId) { cancelAnimationFrame(inertiaId); inertiaId = null; }
    vVel.x = vVel.y = 0;
  }

  function vInertia() {
    if (!vOpen) return;
    vYaw += vVel.x;
    vPitch = clampPitch(vPitch + vVel.y);
    vVel.x *= 0.93;
    vVel.y *= 0.93;
    updateCamera();
    if (Math.abs(vVel.x) + Math.abs(vVel.y) > 0.00025) {
      inertiaId = requestAnimationFrame(vInertia);
    } else {
      inertiaId = null;
    }
  }

  canvas.addEventListener('pointerdown', function (e) {
    if (!vOpen) return;
    stopVInertia();
    canvas.setPointerCapture(e.pointerId);
    vPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (vPointers.size === 1) {
      vDrag = { x: e.clientX, y: e.clientY };
      vPinch = null;
    } else if (vPointers.size === 2) {
      var pts = Array.from(vPointers.values());
      vPinch = {
        d: Math.max(1, Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)),
        fov: vFov
      };
      vDrag = null;
    }
  });

  canvas.addEventListener('pointermove', function (e) {
    if (!vOpen || !vPointers.has(e.pointerId)) return;
    vPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (vPointers.size === 2 && vPinch) {
      var pts = Array.from(vPointers.values());
      var d = Math.max(1, Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y));
      vFov = clamp(vPinch.fov * vPinch.d / d, MIN_FOV, MAX_FOV);
      updateCamera();
      return;
    }

    if (vPointers.size === 1 && vDrag) {
      var dx = e.clientX - vDrag.x;
      var dy = e.clientY - vDrag.y;
      vDrag = { x: e.clientX, y: e.clientY };
      var sens = 0.0042 * (vFov / DEFAULT_FOV);
      vYaw += dx * sens;
      vPitch = clampPitch(vPitch + dy * sens);
      vVel.x = dx * sens;
      vVel.y = dy * sens;
      updateCamera();
    }
  });

  function endVPointer(e) {
    if (!vPointers.has(e.pointerId)) return;
    vPointers.delete(e.pointerId);

    if (vPointers.size === 1) {
      var rest = Array.from(vPointers.values())[0];
      vDrag = { x: rest.x, y: rest.y };
      vPinch = null;
    } else if (vPointers.size === 0) {
      vDrag = null;
      vPinch = null;
      if (Math.abs(vVel.x) + Math.abs(vVel.y) > 0.0004) {
        stopVInertia();
        inertiaId = requestAnimationFrame(vInertia);
      }
    }
  }

  canvas.addEventListener('pointerup', endVPointer);
  canvas.addEventListener('pointercancel', endVPointer);

  canvas.addEventListener('wheel', function (e) {
    if (!vOpen) return;
    e.preventDefault();
    vFov = clamp(vFov + e.deltaY * 0.045, MIN_FOV, MAX_FOV);
    updateCamera();
  }, { passive: false });

  document.addEventListener('keydown', function (e) {
    if (!vOpen) return;
    if (e.key === 'Escape') closeViewer();
    var step = 0.05;
    if (e.key === 'ArrowLeft') { vYaw -= step; updateCamera(); }
    if (e.key === 'ArrowRight') { vYaw += step; updateCamera(); }
    if (e.key === 'ArrowUp') { vPitch = clampPitch(vPitch + step); updateCamera(); }
    if (e.key === 'ArrowDown') { vPitch = clampPitch(vPitch - step); updateCamera(); }
  });

  $('#backBtn').addEventListener('click', closeViewer);
  miniMap.addEventListener('click', closeViewer);
  renderLayer.addEventListener('click', closeRender);
  $('#vReset').addEventListener('click', function () {
    if (!currentSpot) return;
    var sp = SPOTS[currentSpot];
    vYaw = sp.yaw * Math.PI / 180;
    vPitch = sp.pitch || 0;
    vFov = DEFAULT_FOV;
    updateCamera();
  });

  window.addEventListener('resize', function () {
    if (!vOpen) return;
    resizeViewer();
    if (currentSpot) updateMini(SPOTS[currentSpot]);
  });

  frameBg.style.backgroundImage = 'url("' + ASSETS.map + '")';
  buildMarkers();
  buildThumbs();

  /* dev hook: ?view=A then __setView(deg) in the console */
  window.__setView = function (deg, pitchDeg) {
    if (!vOpen) return;
    vYaw = (deg || 0) * Math.PI / 180;
    vPitch = (pitchDeg || 0) * Math.PI / 180;
    updateCamera();
  };

  /* deep link for review: ?view=A */
  try {
    var q = new URLSearchParams(location.search);
    var v = (q.get('view') || '').toUpperCase();
    if (SPOTS[v]) {
      var start = function () {
        if (inited) openViewer(v);
        else setTimeout(start, 120);
      };
      start();
    }
  } catch (err) {}
})();
