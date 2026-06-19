
// ── Drop object distribution ──────────────────────────────────────
var drop_obj_distribution_default = [-4.25,-3,-1.75,-0.75,-0.25,0.25,0.75,1.75,3,4.25];
var drop_obj_duration_default = [350,400,500,550,600,600,600,500,500,400];

// ── Per-valence asset & feedback mappings ──────────────────────────
var VALENCE_CONFIG = {
  reward: {
    drone_img:   '../static/img/task_assets/reward/drone0.png',
    bag_img:     '../static/img/task_assets/reward/supply-bag.png',
    dot_img:     '../static/img/task_assets/reward/supply-dot.png',
    light_tint:  'linear-gradient(to bottom, rgba(255,234,97,.12), rgba(0,0,0,0))',
    light_opacity: '12%',
    feedback_sign: function(captured) { return captured; },
    feedback_color: function(captured) {
      if (captured === 10) return '#39FF14';
      if (captured === 0)  return '#ffd700';
      return '#39FF14';
    }
  },
  loss: {
    drone_img:   '../static/img/task_assets/loss/drone0.png',
    bag_img:     '../static/img/task_assets/loss/hazard-bag.png',
    dot_img:     '../static/img/task_assets/loss/hazard-dot.png',
    light_tint:  'linear-gradient(to bottom, rgba(80,0,120,.20), rgba(0,0,0,0))',
    light_opacity: '18%',
    feedback_sign: function(captured) { return captured - 10; },
    feedback_color: function(captured) {
      var val = captured - 10;
      if (val === 0) return '#ffd700';
      return '#ff4444';
    }
  }
};

// Legacy aliases (supply_distribution / supply_duration) so that any
// un-updated code that still references the old names continues to work.
var supply_distribution = [];
var supply_duration = [];
for (var _i = 0; _i < 200; _i++) {
  supply_distribution.push(drop_obj_distribution_default.slice());
  supply_duration.push(drop_obj_duration_default.slice());
}
