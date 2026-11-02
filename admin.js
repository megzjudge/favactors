(function () {
  "use strict";

  var loginSection = document.getElementById("loginSection");
  var appSection = document.getElementById("appSection");
  var loginForm = document.getElementById("loginForm");
  var loginError = document.getElementById("loginError");
  var logoutBtn = document.getElementById("logoutBtn");

  var actorPicker = document.getElementById("actorPicker");
  var currentPhotoImg = document.getElementById("currentPhotoImg");
  var duplicateNameWarning = document.getElementById("duplicateNameWarning");

  var actorForm = document.getElementById("actorForm");
  var nameInput = document.getElementById("name");
  var initialsInput = document.getElementById("initials");
  var imdbInput = document.getElementById("imdb");
  var tmdbInput = document.getElementById("tmdb");
  var wikiInput = document.getElementById("wiki");
  var grokipediaInput = document.getElementById("grokipedia");
  var autofillLinksBtn = document.getElementById("autofillLinksBtn");
  var autofillStatus = document.getElementById("autofillStatus");
  var searchImdbBtn = document.getElementById("searchImdbBtn");
  var openUrlBtns = document.querySelectorAll(".open-url-btn");
  var favsList = document.getElementById("favsList");
  var addFavBtn = document.getElementById("addFavBtn");
  var pullCreditsBtn = document.getElementById("pullCreditsBtn");
  var creditsStatus = document.getElementById("creditsStatus");
  var creditsList = document.getElementById("creditsList");
  var addSelectedCreditsBtn = document.getElementById("addSelectedCreditsBtn");

  var searchBtn = document.getElementById("searchBtn");
  var searchStatus = document.getElementById("searchStatus");
  var resultsGrid = document.getElementById("resultsGrid");
  var seeMoreBtn = document.getElementById("seeMoreBtn");
  var manualUrlInput = document.getElementById("manualUrlInput");
  var manualUrlBtn = document.getElementById("manualUrlBtn");
  var manualUrlError = document.getElementById("manualUrlError");
  var selectedPreview = document.getElementById("selectedPreview");
  var selectedThumb = document.getElementById("selectedThumb");
  var selectedKey = document.getElementById("selectedKey");
  var clearSelectionBtn = document.getElementById("clearSelectionBtn");

  var saveBtn = document.getElementById("saveBtn");
  var saveError = document.getElementById("saveError");
  var saveSuccess = document.getElementById("saveSuccess");

  var lightbox = document.getElementById("lightbox");
  var lightboxImg = document.getElementById("lightboxImg");
  var lightboxClose = document.getElementById("lightboxClose");
  var previewStage = document.getElementById("previewStage");
  var startCropBtn = document.getElementById("startCropBtn");
  var cropStage = document.getElementById("cropStage");
  var cropViewport = document.getElementById("cropViewport");
  var cropImg = document.getElementById("cropImg");
  var zoomRange = document.getElementById("zoomRange");
  var confirmCropBtn = document.getElementById("confirmCropBtn");
  var cancelCropBtn = document.getElementById("cancelCropBtn");

  var allActors = [];
  var searchResults = [];
  var selectedImage = null; // { thumbnail, full }
  var currentCredits = [];
  var editingActor = null; // the actor object currently loaded for edit, or null when adding new

  function sanitizeKey(name) {
    return name.replace(/[^A-Za-z0-9]/g, "");
  }

  function showError(el, message) {
    el.textContent = message;
    el.hidden = false;
  }
  function hideError(el) {
    el.hidden = true;
  }

  /* ---------- auth ---------- */

  function checkAuth() {
    fetch("/api/me")
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.authenticated) {
          loginSection.hidden = true;
          appSection.hidden = false;
          loadActorsList();
        } else {
          loginSection.hidden = false;
          appSection.hidden = true;
        }
      })
      .catch(function () {
        loginSection.hidden = false;
        appSection.hidden = true;
      });
  }

  loginForm.addEventListener("submit", function (e) {
    e.preventDefault();
    hideError(loginError);
    var password = document.getElementById("password").value;
    fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: password }),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.ok) {
          checkAuth();
        } else {
          showError(loginError, data.error || "Invalid password");
        }
      })
      .catch(function () { showError(loginError, "Login failed"); });
  });

  logoutBtn.addEventListener("click", function () {
    fetch("/api/logout", { method: "POST" }).then(checkAuth);
  });

  /* ---------- actor picker (add new / edit existing) ---------- */

  function loadActorsList() {
    fetch("actors.json")
      .then(function (r) { return r.json(); })
      .then(function (data) {
        allActors = data;
        var sorted = data
          .map(function (a, idx) { return { actor: a, idx: idx }; })
          .sort(function (a, b) { return a.actor.name.localeCompare(b.actor.name); });
        actorPicker.innerHTML = '<option value="">+ Add new actor</option>';
        sorted.forEach(function (entry) {
          var opt = document.createElement("option");
          opt.value = entry.idx;
          opt.textContent = entry.actor.name;
          actorPicker.appendChild(opt);
        });
      })
      .catch(function () { /* public file; non-fatal if it fails to load */ });
  }

  actorPicker.addEventListener("change", function () {
    var idx = actorPicker.value;
    if (idx === "") { resetForm(); return; }
    populateForm(allActors[Number(idx)]);
  });

  function populateForm(actor) {
    editingActor = actor;
    nameInput.value = actor.name || "";
    initialsInput.value = actor.initials || "";
    imdbInput.value = actor.imdb || "";
    tmdbInput.value = actor.tmdb || "";
    wikiInput.value = actor.wiki || "";
    grokipediaInput.value = actor.grokipedia || "";
    favsList.innerHTML = "";
    (actor.favs || []).forEach(addFavRow);
    if (favsList.children.length === 0) addFavRow();
    resetSearch();
    resetCredits();
    clearSelection();
    updateSearchBtnState();
    updatePullCreditsBtnState();
    updateNameDependentBtns();
    updateCurrentPhotoPreview(actor);
    updateDuplicateWarning();
    autofillStatus.textContent = "";
  }

  function resetForm() {
    editingActor = null;
    actorForm.reset();
    favsList.innerHTML = "";
    addFavRow();
    resetSearch();
    resetCredits();
    clearSelection();
    updateSearchBtnState();
    updatePullCreditsBtnState();
    updateNameDependentBtns();
    updateCurrentPhotoPreview(null);
    updateDuplicateWarning();
    autofillStatus.textContent = "";
  }

  function updateCurrentPhotoPreview(actor) {
    var key = actor && actor.photo;
    currentPhotoImg.hidden = true;
    if (!key) {
      currentPhotoImg.src = "";
      return;
    }
    currentPhotoImg.onload = function () { currentPhotoImg.hidden = false; };
    currentPhotoImg.onerror = function () { currentPhotoImg.hidden = true; currentPhotoImg.src = ""; };
    currentPhotoImg.src = "images/" + key + ".jpg";
  }

  function updateDuplicateWarning() {
    if (editingActor) { duplicateNameWarning.hidden = true; return; }
    var name = nameInput.value.trim();
    if (!name) { duplicateNameWarning.hidden = true; return; }
    var match = allActors.some(function (a) { return a.name.toLowerCase() === name.toLowerCase(); });
    if (match) {
      duplicateNameWarning.textContent = '"' + name + '" already exists — saving here will overwrite them. ' +
        "Pick them from the dropdown above instead to edit them.";
      duplicateNameWarning.hidden = false;
    } else {
      duplicateNameWarning.hidden = true;
    }
  }
  nameInput.addEventListener("input", updateDuplicateWarning);

  function resetSearch() {
    searchResults = [];
    resultsGrid.innerHTML = "";
    resultsGrid.hidden = true;
    seeMoreBtn.hidden = true;
    searchStatus.textContent = "";
    manualUrlError.hidden = true;
  }

  /* ---------- favs rows ---------- */

  function addFavRow(fav) {
    var row = document.createElement("div");
    row.className = "fav-row";

    var titleInput = document.createElement("input");
    titleInput.type = "text";
    titleInput.placeholder = "Title";
    titleInput.className = "fav-title";
    titleInput.value = (fav && fav.t) || "";

    var urlInput = document.createElement("input");
    urlInput.type = "url";
    urlInput.placeholder = "URL";
    urlInput.className = "fav-url";
    urlInput.value = (fav && fav.u) || "";

    var removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.textContent = "×";
    removeBtn.setAttribute("aria-label", "Remove favourite");
    removeBtn.addEventListener("click", function () { row.remove(); });

    row.appendChild(titleInput);
    row.appendChild(urlInput);
    row.appendChild(removeBtn);
    favsList.appendChild(row);
  }

  addFavBtn.addEventListener("click", function () { addFavRow(); });

  function collectFavs() {
    var favs = [];
    Array.prototype.forEach.call(favsList.children, function (row) {
      var t = row.querySelector(".fav-title").value.trim();
      var u = row.querySelector(".fav-url").value.trim();
      if (t && u) favs.push({ t: t, u: u });
    });
    return favs;
  }

  /* ---------- link autofill ---------- */

  nameInput.addEventListener("input", updateNameDependentBtns);
  function updateNameDependentBtns() {
    var hasName = nameInput.value.trim().length > 0;
    autofillLinksBtn.disabled = !hasName;
    searchImdbBtn.disabled = !hasName;
  }

  autofillLinksBtn.addEventListener("click", function () {
    var name = nameInput.value.trim();
    if (!name) return;
    autofillStatus.textContent = "Looking up…";
    autofillLinksBtn.disabled = true;

    fetch("/api/lookup-links?name=" + encodeURIComponent(name))
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
      .then(function (res) {
        autofillLinksBtn.disabled = false;
        if (!res.ok) {
          autofillStatus.textContent = res.data.error || "Lookup failed";
          return;
        }
        var found = [];
        if (res.data.tmdb) { tmdbInput.value = res.data.tmdb; found.push("TMDB"); }
        if (res.data.wiki) { wikiInput.value = res.data.wiki; found.push("Wikipedia"); }
        if (res.data.grokipedia) { grokipediaInput.value = res.data.grokipedia; found.push("Grokipedia"); }
        autofillStatus.textContent = found.length
          ? "Filled " + found.join(", ") + " — best guesses, please check them"
          : "No matches found";
      })
      .catch(function () {
        autofillLinksBtn.disabled = false;
        autofillStatus.textContent = "Lookup failed";
      });
  });

  searchImdbBtn.addEventListener("click", function () {
    var name = nameInput.value.trim();
    if (!name) return;
    window.open("https://www.imdb.com/find/?q=" + encodeURIComponent(name) + "&s=nm", "_blank", "noopener,noreferrer");
  });

  Array.prototype.forEach.call(openUrlBtns, function (btn) {
    btn.addEventListener("click", function () {
      var targetId = btn.dataset.target;
      var input = document.getElementById(targetId);
      var value = input && input.value.trim();
      if (!value) return;
      window.open(value, "_blank", "noopener,noreferrer");
    });
  });

  /* ---------- TMDB filmography ---------- */

  tmdbInput.addEventListener("input", updatePullCreditsBtnState);
  function updatePullCreditsBtnState() {
    pullCreditsBtn.disabled = tmdbInput.value.trim().length === 0;
  }

  function resetCredits() {
    currentCredits = [];
    creditsList.innerHTML = "";
    creditsList.hidden = true;
    addSelectedCreditsBtn.hidden = true;
    creditsStatus.textContent = "";
  }

  pullCreditsBtn.addEventListener("click", function () {
    var tmdbUrl = tmdbInput.value.trim();
    if (!tmdbUrl) return;
    creditsStatus.textContent = "Loading…";
    creditsList.hidden = true;
    addSelectedCreditsBtn.hidden = true;
    pullCreditsBtn.disabled = true;

    fetch("/api/tmdb-credits?tmdbUrl=" + encodeURIComponent(tmdbUrl))
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
      .then(function (res) {
        pullCreditsBtn.disabled = false;
        if (!res.ok) {
          creditsStatus.textContent = res.data.error || "Failed to load credits";
          return;
        }
        currentCredits = res.data.credits || [];
        creditsStatus.textContent = currentCredits.length
          ? currentCredits.length + " credits"
          : "No credits found";
        renderCredits();
      })
      .catch(function () {
        pullCreditsBtn.disabled = false;
        creditsStatus.textContent = "Failed to load credits";
      });
  });

  function renderCredits() {
    creditsList.innerHTML = "";
    var existingUrls = {};
    Array.prototype.forEach.call(favsList.children, function (row) {
      var u = row.querySelector(".fav-url").value.trim();
      if (u) existingUrls[u] = true;
    });

    currentCredits.forEach(function (credit, idx) {
      var label = document.createElement("label");
      label.className = "credit-row";

      var cb = document.createElement("input");
      cb.type = "checkbox";
      cb.dataset.idx = idx;
      var alreadyAdded = !!existingUrls[credit.url];
      if (alreadyAdded) cb.disabled = true;

      var text = document.createElement("span");
      text.textContent = credit.title + (credit.year ? " (" + credit.year + ")" : "") +
        (alreadyAdded ? " — already added" : "");

      label.appendChild(cb);
      label.appendChild(text);
      creditsList.appendChild(label);
    });
    creditsList.hidden = currentCredits.length === 0;
    addSelectedCreditsBtn.hidden = currentCredits.length === 0;
  }

  addSelectedCreditsBtn.addEventListener("click", function () {
    var checked = creditsList.querySelectorAll('input[type="checkbox"]:checked');
    Array.prototype.forEach.call(checked, function (cb) {
      var credit = currentCredits[Number(cb.dataset.idx)];
      if (!credit) return;
      addFavRow({ t: credit.title + (credit.year ? " (" + credit.year + ")" : ""), u: credit.url });
    });
    renderCredits();
  });

  /* ---------- image search ---------- */

  nameInput.addEventListener("input", updateSearchBtnState);
  function updateSearchBtnState() {
    searchBtn.disabled = nameInput.value.trim().length === 0;
  }

  var lastSearchCount = 60;

  searchBtn.addEventListener("click", function () {
    var q = nameInput.value.trim();
    if (!q) return;
    searchStatus.textContent = "Searching…";
    resultsGrid.hidden = true;
    resultsGrid.innerHTML = "";
    seeMoreBtn.hidden = true;
    searchBtn.disabled = true;
    searchResults = [];
    lastSearchCount = 60;

    runSearch(q, lastSearchCount, function (ok, results, error) {
      searchBtn.disabled = false;
      if (!ok) {
        searchStatus.textContent = error || "Search failed";
        return;
      }
      searchResults = results;
      searchStatus.textContent = searchResults.length
        ? searchResults.length + " results"
        : "No results";
      renderAll();
      seeMoreBtn.hidden = searchResults.length === 0;
    });
  });

  seeMoreBtn.addEventListener("click", function () {
    var q = nameInput.value.trim();
    if (!q) return;
    seeMoreBtn.disabled = true;
    seeMoreBtn.textContent = "Loading…";
    lastSearchCount = Math.min(lastSearchCount + 60, 200);

    runSearch(q, lastSearchCount, function (ok, results, error) {
      seeMoreBtn.disabled = false;
      seeMoreBtn.textContent = "See more";
      if (!ok) {
        searchStatus.textContent = error || "Search failed";
        return;
      }
      var seen = {};
      searchResults.forEach(function (r) { seen[r.full] = true; });
      var added = 0;
      results.forEach(function (r) {
        if (!seen[r.full]) {
          seen[r.full] = true;
          searchResults.push(r);
          added++;
        }
      });
      searchStatus.textContent = searchResults.length + " results";
      renderAll();
      // Brave's image search has no real pagination — a bigger count can return
      // the exact same set, so if nothing new came back, stop offering more.
      seeMoreBtn.hidden = added === 0 || lastSearchCount >= 200;
    });
  });

  function runSearch(q, count, cb) {
    fetch("/api/image-search?q=" + encodeURIComponent(q) + "&count=" + count)
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
      .then(function (res) {
        if (!res.ok) { cb(false, null, res.data.error); return; }
        cb(true, res.data.results || [], null);
      })
      .catch(function () { cb(false, null, "Search failed"); });
  }

  function renderAll() {
    resultsGrid.innerHTML = "";
    searchResults.forEach(function (result, idx) {
      var cell = document.createElement("div");
      cell.className = "result-thumb";
      cell.dataset.idx = idx;

      var img = document.createElement("img");
      img.src = result.thumbnail;
      img.alt = result.title || "";
      img.loading = "lazy";

      var badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = "✓";

      cell.appendChild(img);
      cell.appendChild(badge);
      cell.addEventListener("click", function () { openLightbox(result, cell); });
      if (selectedImage && selectedImage.full === result.full) {
        cell.classList.add("is-selected");
      }
      resultsGrid.appendChild(cell);
    });
    resultsGrid.hidden = searchResults.length === 0;
  }

  /* ---------- manual URL fallback ---------- */

  manualUrlBtn.addEventListener("click", function () {
    manualUrlError.hidden = true;
    var raw = manualUrlInput.value.trim();
    if (!raw) return;
    var parsed;
    try {
      parsed = new URL(raw);
    } catch {
      showError(manualUrlError, "Not a valid URL");
      return;
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      showError(manualUrlError, "URL must be http(s)");
      return;
    }
    openLightbox({ thumbnail: raw, full: raw, title: "Manual URL" }, null);
  });

  /* ---------- lightbox + crop ---------- */

  var CROP_VIEWPORT = 280; // px, matches .crop-viewport in admin.css
  var CROP_OUTPUT = 480; // px, exported square size

  var activeCell = null;
  var activeResult = null;
  var cropState = null; // { naturalW, naturalH, baseScale, scale, x, y }
  var dragState = null;

  function proxyUrl(url) {
    return "/api/image-proxy?url=" + encodeURIComponent(url);
  }

  function openLightbox(result, cell) {
    activeCell = cell;
    activeResult = result;
    lightboxImg.src = proxyUrl(result.full);
    previewStage.hidden = false;
    cropStage.hidden = true;
    lightbox.hidden = false;
  }

  function closeLightbox() {
    lightbox.hidden = true;
    lightboxImg.src = "";
    cropImg.src = "";
    cropState = null;
    dragState = null;
    activeCell = null;
    activeResult = null;
  }

  lightboxClose.addEventListener("click", closeLightbox);
  lightbox.addEventListener("click", function (e) {
    if (e.target === lightbox) closeLightbox();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !lightbox.hidden) closeLightbox();
  });

  startCropBtn.addEventListener("click", function () {
    previewStage.hidden = true;
    cropStage.hidden = false;
    var src = proxyUrl(activeResult.full);
    var loader = new Image();
    loader.onload = function () {
      cropImg.src = src;
      initCropState(loader.naturalWidth, loader.naturalHeight);
    };
    loader.onerror = function () {
      showError(saveError, "Could not load image for cropping");
      previewStage.hidden = false;
      cropStage.hidden = true;
    };
    loader.src = src;
  });

  cancelCropBtn.addEventListener("click", function () {
    previewStage.hidden = false;
    cropStage.hidden = true;
  });

  function initCropState(naturalW, naturalH) {
    var baseScale = Math.max(CROP_VIEWPORT / naturalW, CROP_VIEWPORT / naturalH);
    cropState = { naturalW: naturalW, naturalH: naturalH, baseScale: baseScale, scale: baseScale };
    var w = naturalW * baseScale, h = naturalH * baseScale;
    cropState.x = (CROP_VIEWPORT - w) / 2;
    cropState.y = (CROP_VIEWPORT - h) / 2;
    zoomRange.value = 0;
    applyCropTransform();
  }

  function clampCrop() {
    var w = cropState.naturalW * cropState.scale;
    var h = cropState.naturalH * cropState.scale;
    cropState.x = Math.min(0, Math.max(CROP_VIEWPORT - w, cropState.x));
    cropState.y = Math.min(0, Math.max(CROP_VIEWPORT - h, cropState.y));
  }

  function applyCropTransform() {
    cropImg.style.width = cropState.naturalW * cropState.scale + "px";
    cropImg.style.height = cropState.naturalH * cropState.scale + "px";
    cropImg.style.left = cropState.x + "px";
    cropImg.style.top = cropState.y + "px";
  }

  zoomRange.addEventListener("input", function () {
    if (!cropState) return;
    var t = parseFloat(zoomRange.value);
    var newScale = cropState.baseScale * (1 + t * 2); // up to 3x baseScale
    var centre = CROP_VIEWPORT / 2;
    var natX = (centre - cropState.x) / cropState.scale;
    var natY = (centre - cropState.y) / cropState.scale;
    cropState.scale = newScale;
    cropState.x = centre - natX * newScale;
    cropState.y = centre - natY * newScale;
    clampCrop();
    applyCropTransform();
  });

  cropViewport.addEventListener("pointerdown", function (e) {
    if (!cropState) return;
    dragState = { startX: e.clientX, startY: e.clientY, origX: cropState.x, origY: cropState.y };
    cropViewport.setPointerCapture(e.pointerId);
  });
  cropViewport.addEventListener("pointermove", function (e) {
    if (!dragState || !cropState) return;
    cropState.x = dragState.origX + (e.clientX - dragState.startX);
    cropState.y = dragState.origY + (e.clientY - dragState.startY);
    clampCrop();
    applyCropTransform();
  });
  function endDrag() { dragState = null; }
  cropViewport.addEventListener("pointerup", endDrag);
  cropViewport.addEventListener("pointercancel", endDrag);

  confirmCropBtn.addEventListener("click", function () {
    if (!cropState) return;
    var canvas = document.createElement("canvas");
    canvas.width = CROP_OUTPUT;
    canvas.height = CROP_OUTPUT;
    var ctx = canvas.getContext("2d");
    var sSize = CROP_VIEWPORT / cropState.scale;
    var sx = -cropState.x / cropState.scale;
    var sy = -cropState.y / cropState.scale;
    ctx.drawImage(cropImg, sx, sy, sSize, sSize, 0, 0, CROP_OUTPUT, CROP_OUTPUT);
    canvas.toBlob(function (blob) {
      if (!blob) { showError(saveError, "Crop failed — try again"); return; }
      var reader = new FileReader();
      reader.onload = function () {
        finalizeSelection(reader.result.split(",")[1]);
      };
      reader.readAsDataURL(blob);
    }, "image/jpeg", 0.92);
  });

  function finalizeSelection(base64) {
    selectedImage = { thumbnail: activeResult.thumbnail, full: activeResult.full, imageData: base64 };
    Array.prototype.forEach.call(resultsGrid.children, function (el) {
      el.classList.toggle("is-selected", el === activeCell);
    });
    selectedThumb.src = "data:image/jpeg;base64," + base64;
    selectedKey.textContent = sanitizeKey(nameInput.value.trim() || "") || "(enter a name)";
    selectedPreview.hidden = false;
    updateSaveBtnState();
    closeLightbox();
  }

  function clearSelection() {
    selectedImage = null;
    selectedPreview.hidden = true;
    Array.prototype.forEach.call(resultsGrid.children, function (el) {
      el.classList.remove("is-selected");
    });
    updateSaveBtnState();
  }

  clearSelectionBtn.addEventListener("click", clearSelection);

  function updateSaveBtnState() {
    var hasName = nameInput.value.trim().length > 0;
    var hasPhoto = !!selectedImage || !!editingActor; // editing an actor keeps their existing photo if none picked
    saveBtn.disabled = !hasName || !hasPhoto;
  }
  nameInput.addEventListener("input", updateSaveBtnState);

  /* ---------- save ---------- */

  actorForm.addEventListener("submit", function (e) {
    e.preventDefault();
    hideError(saveError);
    saveSuccess.hidden = true;
    if (!selectedImage && !editingActor) return;

    var payload = {
      name: nameInput.value.trim(),
      originalName: editingActor ? editingActor.name : "",
      initials: initialsInput.value.trim(),
      imdb: imdbInput.value.trim(),
      tmdb: tmdbInput.value.trim(),
      wiki: wikiInput.value.trim(),
      grokipedia: grokipediaInput.value.trim(),
      favs: collectFavs(),
      imageData: selectedImage ? selectedImage.imageData : "",
    };

    saveBtn.disabled = true;
    saveBtn.textContent = "Saving…";

    fetch("/api/save-actor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
      .then(function (res) {
        saveBtn.textContent = "Save actor";
        if (!res.ok) {
          saveBtn.disabled = false;
          showError(saveError, res.data.error || "Save failed");
          return;
        }
        saveSuccess.textContent = (res.data.updated ? "Updated " : "Added ") + payload.name +
          " — commit " + res.data.commit.slice(0, 7);
        saveSuccess.hidden = false;
        resetForm();
        loadActorsList();
      })
      .catch(function () {
        saveBtn.textContent = "Save actor";
        saveBtn.disabled = false;
        showError(saveError, "Save failed");
      });
  });

  /* ---------- init ---------- */

  addFavRow();
  checkAuth();
})();
