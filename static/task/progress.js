/* Participant activity progress, independent of jsPsych's top level groups. */
(function(root) {
  'use strict';
  var VERSION = 'progress-1.0.0-2026-10-26';
  var INTERNAL = ['call-function', 'fullscreen', 'pavlovia', 'preload'];

  function Tracker(options) {
    this.js = options.jsPsych || root.jsPsych;
    this.mouseMoves = options.mouseMoves || 8;
    this.units = Object.create(null);
    this.amount = 0;
    this.saved = false;
  }

  Tracker.prototype.prepare = function(timeline) {
    var self = this;
    function visit(node, path, excluded) {
      if (!node || typeof node !== 'object') return { node: node, ids: [] };
      // Shared instruction objects also appear in review branches. Copy every
      // occurrence so tracking a review cannot alter the forward instruction.
      var copy = Object.assign({}, node), ids = [];
      excluded = excluded || node.progress_exclude === true;
      if (Array.isArray(node.timeline)) {
        copy.timeline = node.timeline.map(function(child, index) {
          var planned = visit(child, path + '_' + index, excluded);
          ids = ids.concat(planned.ids);
          return planned.node;
        });
      } else if (!excluded && INTERNAL.indexOf(node.type) === -1) {
        var weight = node.type === 'instructions' && Array.isArray(node.pages)
          ? node.pages.length : node.type === 'memory-task' ? 3
          : node.type === 'mouse-trajectory' ? self.mouseMoves + 1 : 1;
        if (weight > 0) {
          var id = 'activity' + path;
          self.units[id] = { weight: weight, completed: 0, parts: Object.create(null), skipped: false };
          ids.push(id);
          var originalData = node.data;
          if (typeof originalData === 'function') {
            copy.data = function() {
              return Object.assign({}, originalData.apply(this, arguments), { progress_unit_id: id });
            };
          } else copy.data = Object.assign({}, originalData || {}, { progress_unit_id: id });
          var originalStart = node.on_start, originalFinish = node.on_finish;
          copy.on_start = function(trial) {
            if (typeof originalStart === 'function') originalStart.apply(this, arguments);
            trial.data = Object.assign({}, trial.data || {}, { progress_unit_id: id });
            self.units[id].skipped = false;
            self.render();
          };
          copy.on_finish = function(data) {
            if (typeof originalFinish === 'function') originalFinish.apply(this, arguments);
            var unit = self.units[id];
            if (node.type === 'mouse-trajectory' && data.mt_status !== 'completed') {
              // Closing or skipping the optional module leaves only the
              // completed movements and its closing response in the plan.
              unit.weight = Math.min(unit.weight, unit.completed + 1);
            } else if (node.type === 'memory-task' && data.skipped_pair === true) {
              unit.weight = Math.max(1, unit.completed);
            }
            // An incorrect comprehension attempt opens a review loop. It is
            // not an additional completed activity and cannot inflate progress.
            if (node.type !== 'comprehension' || data.done === true) self.complete(id);
          };
        }
      }
      if (!excluded && typeof node.conditional_function === 'function') {
        var originalCondition = node.conditional_function;
        copy.conditional_function = function() {
          // Evaluate only when jsPsych normally reaches the branch. Evaluating
          // ahead would change screening and comprehension behavior.
          var result = originalCondition.apply(this, arguments);
          if (!result) self.skip(ids);
          return result;
        };
      }
      return { node: copy, ids: ids };
    }
    return timeline.map(function(node, index) { return visit(node, '_' + index, false).node; });
  };

  Tracker.prototype.complete = function(id) {
    var unit = this.units[id];
    if (!unit) return;
    unit.completed = unit.weight;
    this.render();
  };

  Tracker.prototype.part = function(id, key) {
    var unit = this.units[id];
    if (!unit || unit.skipped || unit.parts[key]) return;
    unit.parts[key] = true;
    unit.completed = Math.min(unit.weight, unit.completed + 1);
    this.render();
  };

  Tracker.prototype.instructionPage = function(id, page) {
    this.part(id, 'page_' + page);
  };

  Tracker.prototype.onRecord = function(row) {
    var id = row.progress_unit_id;
    if (!id || !this.units[id]) return;
    if (row.trial_category === 'response_event' &&
        ['order', 'distance', 'placement'].indexOf(row.response_stage) !== -1 &&
        (row.stage_timed_out === false || row.final_omission === true)) {
      this.part(id, 'memory_' + row.response_stage);
    } else if (row.mt_row === 'trajectory' && row.trajectory_completed === true) {
      this.part(id, 'mouse_' + row.trajectory_id);
    }
  };

  Tracker.prototype.skip = function(ids) {
    var self = this;
    ids.forEach(function(id) {
      if (self.units[id] && self.units[id].completed === 0) self.units[id].skipped = true;
    });
    this.render();
  };

  Tracker.prototype.state = function() {
    var self = this, total = 0, completed = 0;
    Object.keys(this.units).forEach(function(id) {
      var unit = self.units[id];
      if (!unit.skipped) { total += unit.weight; completed += unit.completed; }
    });
    // One final activity belongs to saving. Upload retries and early exits
    // must never make an unfinished task appear fully completed.
    var calculated = (completed + (this.saved ? 1 : 0)) / (total + 1);
    if (!this.saved) calculated = Math.min(.99, calculated);
    return { version: VERSION, total_units: total + 1, completed_units: completed + (this.saved ? 1 : 0),
      proportion: Math.max(this.amount, Math.min(1, Math.max(0, calculated))), saved: this.saved };
  };

  Tracker.prototype.render = function() {
    this.amount = this.state().proportion;
    this.js.setProgressBar(this.amount);
  };

  Tracker.prototype.finishSaving = function() {
    this.saved = true;
    this.render();
  };

  root.DroneTaskProgress = { version: VERSION,
    create: function(options) { return new Tracker(options || {}); } };
})(window);
