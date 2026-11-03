(function () {
  "use strict";

  var K = window.TMI_KNOWLEDGE;
  if (!K || !Array.isArray(K.entries)) { return; }

  var MAX_INPUT = 400;
  var MAX_TURNS = 40;

  var STOP = ("a an the is are was were do does did i me my we our you your it its this that " +
    "of to in on for with and or but if what which who how why when where can could would " +
    "should will shall about please tell know more some any have has had am be been").split(" ");

  var open = false;
  var busy = false;
  var turns = 0;
  var lastFocus = null;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) { n.className = cls; }
    if (text != null) { n.textContent = text; }
    return n;
  }

  var launcher = el("button", "tmi-c-launcher", "Ask Texas Movement");
  launcher.type = "button";
  launcher.setAttribute("aria-expanded", "false");
  launcher.setAttribute("aria-controls", "tmi-c-panel");

  var panel = el("div", "tmi-c-panel");
  panel.id = "tmi-c-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "false");
  panel.setAttribute("aria-labelledby", "tmi-c-title");
  panel.dataset.open = "false";

  var head = el("div", "tmi-c-head");
  var title = el("h2", "tmi-c-title", "Ask Texas Movement");
  title.id = "tmi-c-title";
  var closeBtn = el("button", "tmi-c-close", "\u00D7");
  closeBtn.type = "button";
  closeBtn.setAttribute("aria-label", "Close assistant");
  head.appendChild(title); head.appendChild(closeBtn);

  var log = el("div", "tmi-c-log");
  log.setAttribute("role", "log");
  log.setAttribute("aria-label", "Conversation");

  var privacy = el("p", "tmi-c-privacy",
    "Messages are processed on this page against approved company information. Do not enter sensitive personal or financial information.");

  var form = el("form", "tmi-c-form");
  var input = el("textarea", "tmi-c-input");
  input.rows = 1;
  input.maxLength = MAX_INPUT;
  input.placeholder = "Ask about our divisions\u2026";
  input.setAttribute("aria-label", "Your question");
  var send = el("button", "tmi-c-send", "Send");
  send.type = "submit";
  form.appendChild(input); form.appendChild(send);

  var foot = el("div", "tmi-c-foot");
  var disclosure = el("p", "tmi-c-disclosure",
    "AI assistant. Responses may be inaccurate. Please confirm important details with Texas Movement.");
  var clear = el("button", "tmi-c-clear", "Clear");
  clear.type = "button";
  foot.appendChild(disclosure); foot.appendChild(clear);

  var live = el("div", "tmi-c-sr");
  live.setAttribute("aria-live", "polite");
  live.setAttribute("aria-atomic", "true");

  panel.appendChild(head);
  panel.appendChild(log);
  panel.appendChild(privacy);
  panel.appendChild(form);
  panel.appendChild(foot);

  document.body.appendChild(launcher);
  document.body.appendChild(panel);
  document.body.appendChild(live);

  function bubble(who, text) {
    var b = el("div", "tmi-c-msg", text);
    b.dataset.who = who;
    log.appendChild(b);
    log.scrollTop = log.scrollHeight;
    if (who === "bot" || who === "note") { live.textContent = text; }
    return b;
  }

  function linkRow(links) {
    if (!links || !links.length) { return; }
    var row = el("div", "tmi-c-links");
    links.forEach(function (l) {
      if (!l || typeof l.href !== "string") { return; }
      var a = el("a", "tmi-c-link", l.label || l.href);
      a.href = l.href;
      if (/^https?:/i.test(l.href)) { a.target = "_blank"; a.rel = "noopener noreferrer"; }
      row.appendChild(a);
    });
    if (row.childNodes.length) { log.appendChild(row); log.scrollTop = log.scrollHeight; }
  }

  function contactLink() {
    if (K.contact && K.contact.href) {
      linkRow([{ label: K.contact.label || K.contact.display, href: K.contact.href }]);
    }
  }

  function greet() {
    bubble("bot", "Hello. I can answer questions about Texas Movement Consulting, HERO, Performance, and Media using approved company information. What would you like to know?");
  }

  function tokens(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/)
      .filter(function (w) { return w.length > 1 && STOP.indexOf(w) === -1; });
  }

  function findAnswer(query) {
    var q = String(query).toLowerCase();
    var qt = tokens(query);
    var best = null, bestScore = 0;

    K.entries.forEach(function (e) {
      var score = 0;
      (e.keywords || []).forEach(function (k) {
        var kk = String(k).toLowerCase();
        if (kk.length > 2 && q.indexOf(kk) !== -1) {
          score += kk.indexOf(" ") !== -1 ? 6 : 3;
        } else {
          var kt = tokens(kk);
          for (var i = 0; i < kt.length; i++) {
            if (qt.indexOf(kt[i]) !== -1) { score += 1; }
          }
        }
      });
      tokens(e.title).forEach(function (w) { if (qt.indexOf(w) !== -1) { score += 1; } });
      if (score > bestScore) { bestScore = score; best = e; }
    });

    return bestScore >= 3 ? best : null;
  }

  function setBusy(v) {
    busy = v;
    send.disabled = v;
    send.textContent = v ? "\u2026" : "Send";
    input.disabled = v;
  }

  function respond(text) {
    var hit = findAnswer(text);
    if (hit) {
      bubble("bot", hit.answer);
      linkRow(hit.links);
    } else {
      bubble("bot", K.fallback);
      contactLink();
    }
    setBusy(false);
    input.focus();
  }

  function submit() {
    if (busy) { return; }
    var text = input.value.trim();
    if (!text) { return; }
    if (turns >= MAX_TURNS) {
      bubble("note", "This conversation has reached its length limit. Select Clear to start again.");
      return;
    }
    if (text.length > MAX_INPUT) { text = text.slice(0, MAX_INPUT); }

    turns++;
    bubble("user", text);
    input.value = "";
    input.style.height = "auto";
    setBusy(true);

    window.setTimeout(function () { respond(text); }, 260);
  }

  function setOpen(v) {
    open = v;
    panel.dataset.open = v ? "true" : "false";
    launcher.setAttribute("aria-expanded", v ? "true" : "false");
    if (v) {
      lastFocus = document.activeElement;
      if (!log.childNodes.length) { greet(); }
      input.focus();
    } else {
      launcher.focus();
    }
  }

  launcher.addEventListener("click", function () { setOpen(!open); });
  closeBtn.addEventListener("click", function () { setOpen(false); });

  form.addEventListener("submit", function (ev) { ev.preventDefault(); submit(); });

  input.addEventListener("keydown", function (ev) {
    if (ev.key === "Enter" && !ev.shiftKey) { ev.preventDefault(); submit(); }
  });

  input.addEventListener("input", function () {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 110) + "px";
  });

  clear.addEventListener("click", function () {
    while (log.firstChild) { log.removeChild(log.firstChild); }
    turns = 0;
    setBusy(false);
    live.textContent = "Conversation cleared.";
    greet();
    input.focus();
  });

  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape" && open) { ev.preventDefault(); setOpen(false); return; }
    if (ev.key === "Tab" && open) {
      var f = panel.querySelectorAll("button, a[href], textarea");
      var list = [];
      for (var i = 0; i < f.length; i++) { if (!f[i].disabled) { list.push(f[i]); } }
      if (!list.length) { return; }
      var first = list[0], last = list[list.length - 1];
      if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
      else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
    }
  });
})();
