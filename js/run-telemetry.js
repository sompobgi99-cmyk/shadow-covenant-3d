(function(){
  const KEY = 'sc3_run_telemetry_v1';
  const MAX_RUNS = 60;

  function safeNumber(value, fallback){
    const n = Number(value);
    return Number.isFinite(n) ? n : (fallback || 0);
  }

  function safeLoad(){
    try {
      const rows = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(rows) ? rows : [];
    } catch (_) {
      return [];
    }
  }

  function safeSave(rows){
    try {
      localStorage.setItem(KEY, JSON.stringify(rows.slice(0, MAX_RUNS)));
    } catch (_) {}
  }

  function weaponSnapshot(p){
    if (!p || !Array.isArray(p.weapons)) return [];
    return p.weapons.map(w => {
      const meta = (typeof WEAPON_TYPES !== 'undefined' && WEAPON_TYPES[w.key]) || {};
      return {
        key: w.key,
        name: meta.name || w.key,
        level: safeNumber(w.lvl, 1),
        evolved: !!w.evolved,
        guard_active: w.guardActive == null ? null : safeNumber(w.guardActive, 0),
      };
    });
  }

  function tomeSnapshot(p){
    const counts = (p && p.tomeCount) || {};
    return Object.keys(counts).sort().map(id => {
      const meta = (typeof UPGRADES !== 'undefined' && UPGRADES.find(u => u.id === id)) || {};
      return { id, name: meta.name || id, count: safeNumber(counts[id], 0) };
    });
  }

  function itemSnapshot(p){
    const counts = (p && p.itemCounts) || {};
    return Object.keys(counts).sort().map(id => {
      const meta = (typeof ITEMS !== 'undefined' && ITEMS.find(it => it.id === id)) || {};
      return { id, name: meta.name || id, count: safeNumber(counts[id], 0) };
    });
  }

  function buildRunTelemetry(entry){
    const p = typeof player !== 'undefined' ? player : null;
    const stats = typeof runStats !== 'undefined' ? runStats : null;
    const runId = 'run_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
    return {
      schema: 1,
      id: runId,
      build: window.SHADOW_BUILD_VERSION || '',
      saved_at: new Date().toISOString(),
      name: entry && entry.name || 'Player',
      country_code: entry && entry.country_code || 'TH',
      character: entry && entry.character || ((p && p.char) || 'Unknown'),
      result: entry && entry.won ? 'clear' : 'fall',
      score: safeNumber(entry && entry.score, 0),
      kills: safeNumber(entry && entry.kills, 0),
      time: safeNumber(entry && entry.time, 0),
      level: safeNumber(entry && entry.level, p && p.level || 1),
      stage: safeNumber(entry && entry.stage, typeof mapStage !== 'undefined' ? mapStage : 1),
      damage_taken: safeNumber(entry && entry.damage, typeof damageTaken !== 'undefined' ? damageTaken : 0),
      overtime_level: typeof overtimeLevel === 'function' ? safeNumber(overtimeLevel(), 0) : 0,
      gold: safeNumber(p && p.gold, 0),
      hp: safeNumber(p && p.hp, 0),
      max_hp: safeNumber(p && p.maxHp, 0),
      crit_chance: safeNumber(p && p.critChance, 0),
      crit_damage: safeNumber(p && p.critDmg, 0),
      weapons: weaponSnapshot(p),
      tomes: tomeSnapshot(p),
      items: itemSnapshot(p),
      relics: (p && Array.isArray(p.relics) ? p.relics : []).map(r => ({ id: r.id, name: r.name })),
      summary: stats ? {
        weapon_damage: stats.weaponDamage || {},
        item_stats: stats.itemStats || {},
        death_cause: stats.deathCause || stats.lastHit || null,
      } : null,
    };
  }

  function saveRunTelemetry(entry){
    const run = buildRunTelemetry(entry || {});
    const rows = safeLoad();
    rows.unshift(run);
    safeSave(rows);
    return run;
  }

  function summarizeRunTelemetry(){
    const rows = safeLoad();
    const sum = (arr, fn) => arr.reduce((n, row) => n + safeNumber(fn(row), 0), 0);
    const bucket = (arr, keyFn, valueFn) => {
      const out = {};
      for (const row of arr) {
        const key = keyFn(row) || 'Unknown';
        if (!out[key]) out[key] = { runs: 0, score: 0, clears: 0 };
        out[key].runs++;
        out[key].score += safeNumber(valueFn(row), 0);
        if (row.result === 'clear') out[key].clears++;
      }
      return Object.entries(out)
        .map(([name, v]) => ({ name, runs: v.runs, avg_score: Math.round(v.score / Math.max(1, v.runs)), clear_rate: +(v.clears / Math.max(1, v.runs)).toFixed(2) }))
        .sort((a, b) => b.avg_score - a.avg_score);
    };
    return {
      runs: rows.length,
      avg_score: rows.length ? Math.round(sum(rows, r => r.score) / rows.length) : 0,
      avg_time: rows.length ? Math.round(sum(rows, r => r.time) / rows.length) : 0,
      clear_rate: rows.length ? +(rows.filter(r => r.result === 'clear').length / rows.length).toFixed(2) : 0,
      by_character: bucket(rows, r => r.character, r => r.score),
      by_start_weapon: bucket(rows, r => (r.weapons && r.weapons[0] && r.weapons[0].name) || 'Unknown', r => r.score),
    };
  }

  window.saveRunTelemetry = saveRunTelemetry;
  window.getRunTelemetry = safeLoad;
  window.summarizeRunTelemetry = summarizeRunTelemetry;
  window.exportRunTelemetry = () => JSON.stringify(safeLoad(), null, 2);
})();
