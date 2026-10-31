(function () {
  "use strict";

  var loginSection = document.getElementById("loginSection");
  var appSection = document.getElementById("appSection");
  var loginForm = document.getElementById("loginForm");
  var loginError = document.getElementById("loginError");
  var logoutBtn = document.getElementById("logoutBtn");

  var modeRadios = document.querySelectorAll('input[name="mode"]');
  var existingActorSelect = document.getElementById("existingActor");

  var actorForm = document.getElementById("actorForm");
  var nameInput = document.getElementById("name");
  var initialsInput = document.getElementById("initials");
  var imdbInput = document.getElementById("imdb");
  var tmdbInput = document.getElementById("tmdb");
  var wikiInput = document.getElementById("wiki");
  var grokipediaInput = document.getElementById("grokipedia");
  var favsList = document.getElementById("favsList");
  var addFavBtn = document.getElementById("addFavBtn");

  var searchBtn = document.getElementById("searchBtn");
  var searchStatus = document.getElementById("searchStatus");
  var resultsGrid = document.getElementById("resultsGrid");
  var selectedPreview = document.getElementById("selectedPreview");
  var selectedThumb = document.getElementById("selectedThumb");
  var selectedKey = document.getElementById("selectedKey");
  var clearSelectionBtn = document.getElementById("clearSelectionBtn");

  var saveBtn = document.getElementById("saveBtn");
  var saveError = document.getElementById("saveError");
  var saveSuccess = document.getElementById("saveSuccess");

  var lightbox = document.getElementById("lightbox");
  var lightboxImg = document.getElementById("lightboxImg");
  var lightboxTick = document.getElementById("lightboxTick");
  var lightboxClose = document.getElementById("lightboxClose");

  var allActors = [];
  var searchResults = [];
  var selectedImage = null; // { thumbnail, full }

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

  /* ---------- existing actors (mode: edit) ---------- */

  function loadActorsList() {
    fetch("actors.json")
      .then(function (r) { return r.json(); })
      .then(function (data) {
        allActors = data;
        existingActorSelect.innerHTML = '<option value="">— choose an actor —</option>';
        data.forEach(function (a, idx) {
          var opt = document.createElement("option");
          opt.value = idx;
          opt.textContent = a.name;
          existingActorSelect.appendChild(opt);
        });
      })
      .catch(function () { /* public file; non-fatal if it fails to load */ });
  }

  Array.prototype.forEach.call(modeRadios, function (radio) {
    radio.addEventListener("change", function () {
      var isEdit = document.querySelector('input[name="mode"]:checked').value === "edit";
      existingActorSelect.hidden = !isEdit;
      if (!isEdit) resetForm();
    });
  });

  existingActorSelect.addEventListener("change", function () {
    var idx = existingActorSelect.value;
    if (idx === "") { resetForm(); return; }
    populateForm(allActors[Number(idx)]);
  });

  function populateForm(actor) {
    nameInput.value = actor.name || "";
    initialsInput.value = actor.initials || "";
    imdbInput.value = actor.imdb || "";
    tmdbInput.value = actor.tmdb || "";
    wikiInput.value = actor.wiki || "";
    grokipediaInput.value = actor.grokipedia || "";
    favsList.innerHTML = "";
    (actor.favs || []).forEach(addFavRow);
    if (favsList.children.length === 0) addFavRow();
    clearSelection();
    updateSearchBtnState();
  }

  function resetForm() {
    actorForm.reset();
    favsList.innerHTML = "";
    addFavRow();
    clearSelection();
    updateSearchBtnState();
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

  /* ---------- image search ---------- */

  nameInput.addEventListener("input", updateSearchBtnState);
  function updateSearchBtnState() {
    searchBtn.disabled = nameInput.value.trim().length === 0;
  }

  searchBtn.addEventListener("click", function () {
    var q = nameInput.value.trim();
    if (!q) return;
    searchStatus.textContent = "Searching…";
    resultsGrid.hidden = true;
    resultsGrid.innerHTML = "";
    searchBtn.disabled = true;

    fetch("/api/image-search?q=" + encodeURIComponent(q))
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
      .then(function (res) {
        searchBtn.disabled = false;
        if (!res.ok) {
          searchStatus.textContent = res.data.error || "Search failed";
          return;
        }
        searchResults = res.data.results || [];
        searchStatus.textContent = searchResults.length
          ? searchResults.length + " results"
          : "No results";
        renderResults();
      })
      .catch(function () {
        searchBtn.disabled = false;
        searchStatus.textContent = "Search failed";
      });
  });

  function renderResults() {
    resultsGrid.innerHTML = "";
    resultsGrid.hidden = searchResults.length === 0;
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
      resultsGrid.appendChild(cell);
    });
  }

  /* ---------- lightbox ---------- */

  var activeCell = null;

  function openLightbox(result, cell) {
    activeCell = cell;
    lightboxImg.src = result.full;
    lightboxTick.checked = selectedImage && selectedImage.full === result.full;
    lightbox.hidden = false;
    lightbox.dataset.resultFull = result.full;
    lightbox.dataset.resultThumb = result.thumbnail;
  }

  function closeLightbox() {
    lightbox.hidden = true;
    lightboxImg.src = "";
    activeCell = null;
  }

  lightboxClose.addEventListener("click", closeLightbox);
  lightbox.addEventListener("click", function (e) {
    if (e.target === lightbox) closeLightbox();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !lightbox.hidden) closeLightbox();
  });

  lightboxTick.addEventListener("change", function () {
    if (lightboxTick.checked) {
      selectImage({ thumbnail: lightbox.dataset.resultThumb, full: lightbox.dataset.resultFull }, activeCell);
      closeLightbox();
    } else {
      clearSelection();
    }
  });

  function selectImage(result, cell) {
    selectedImage = result;
    Array.prototype.forEach.call(resultsGrid.children, function (el) {
      el.classList.toggle("is-selected", el === cell);
    });
    selectedThumb.src = result.thumbnail;
    selectedKey.textContent = sanitizeKey(nameInput.value.trim() || "") || "(enter a name)";
    selectedPreview.hidden = false;
    updateSaveBtnState();
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
    saveBtn.disabled = !selectedImage || nameInput.value.trim().length === 0;
  }
  nameInput.addEventListener("input", updateSaveBtnState);

  /* ---------- save ---------- */

  actorForm.addEventListener("submit", function (e) {
    e.preventDefault();
    hideError(saveError);
    saveSuccess.hidden = true;
    if (!selectedImage) return;

    var payload = {
      name: nameInput.value.trim(),
      initials: initialsInput.value.trim(),
      imdb: imdbInput.value.trim(),
      tmdb: tmdbInput.value.trim(),
      wiki: wikiInput.value.trim(),
      grokipedia: grokipediaInput.value.trim(),
      favs: collectFavs(),
      imageUrl: selectedImage.full,
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
