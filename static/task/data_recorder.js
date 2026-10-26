/* Durable recording for the Drone Task. No automatic behavioral resumption. */
(function(root) {
  'use strict';
  var SCHEMA = 'drone-data-v2';
  var VERSION = 'save-2.0.0-2026-10-26';
  function uuid() {
    if (root.crypto && root.crypto.randomUUID) return root.crypto.randomUUID();
    return 'run_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,14);
  }
  function now() { return root.performance ? performance.now() : Date.now(); }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function bytes(value) { return new Blob([value]).size; }
  function csvRows(rows) {
    var keys=[], seen={};
    rows.forEach(function(row) { Object.keys(row).forEach(function(k) {
      if (!seen[k]) { seen[k]=true; keys.push(k); }
    }); });
    function cell(v) {
      if (v === null || v === undefined) return '';
      if (typeof v === 'object') v=JSON.stringify(v);
      return '"' + String(v).replace(/"/g,'""') + '"';
    }
    return keys.map(cell).join(',') + '\r\n' + rows.map(function(row) {
      return keys.map(function(k) { return cell(row[k]); }).join(',');
    }).join('\r\n') + '\r\n';
  }
  function offer(text, name, type) {
    var url=URL.createObjectURL(new Blob([text],{type:type || 'text/csv;charset=utf-8;'}));
    var link=document.createElement('a'); link.href=url; link.download=name;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(function() { URL.revokeObjectURL(url); },30000);
  }
  function phase(row) {
    if (row.task_phase) return row.task_phase;
    if (row.mt_row || row.trial_type === 'mouse-trajectory') return 'mouse_qc';
    if (row.memory_screening === true || /^memory_screening_/.test(row.trial_category || '')) return 'memory_screening';
    if (row.trial_type === 'trial') return Number(row.practice_no)>0 ? 'practice' : 'encoding';
    if (row.trial_type === 'memory-task') return 'memory';
    if (/comprehension/.test(row.trial_type || '')) return 'comprehension';
    if (row.trial_type === 'survey-demo') return 'demographics';
    if (row.trial_category === 'consent') return 'consent';
    if (row.trial_type === 'instructions') return 'instructions';
    return 'session';
  }
  function hash(text) {
    if (!root.crypto || !root.crypto.subtle) return Promise.resolve(null);
    return root.crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)).then(function(buffer) {
      return Array.from(new Uint8Array(buffer)).map(function(v) { return v.toString(16).padStart(2,'0'); }).join('');
    });
  }
  function openCache() {
    return new Promise(function(resolve,reject) {
      if (!root.indexedDB) { reject(new Error('Browser recovery storage unavailable')); return; }
      var timer=setTimeout(function(){reject(new Error('Browser recovery storage did not respond'));},5000);
      var request=indexedDB.open('drone_task_recovery_v2',1);
      request.onupgradeneeded=function() {
        var db=request.result;
        if (!db.objectStoreNames.contains('runs')) db.createObjectStore('runs',{keyPath:'run_uuid'});
        if (!db.objectStoreNames.contains('rows')) {
          var store=db.createObjectStore('rows',{keyPath:'cache_key'});
          store.createIndex('run_uuid','run_uuid',{unique:false});
        }
      };
      request.onsuccess=function() { clearTimeout(timer); resolve(request.result); };
      request.onerror=function() { clearTimeout(timer); reject(request.error); };
      request.onblocked=function() { clearTimeout(timer); reject(new Error('Browser recovery storage is blocked')); };
    });
  }
  function Recorder(options) {
    this.options=options || {}; this.js=this.options.jsPsych || root.jsPsych;
    this.env=this.options.env; this.run=uuid(); this.start=now(); this.sequence=0;
    this.cacheStatus='awaiting_consent'; this.consented=false; this.cache=null;
    this.pending=[]; this.cacheTimer=null; this.cacheWrites=Promise.resolve();
    this.lastCheckpoint=0; this.checkpointBusy=false; this.checkpointAgain=false;
    this.finalizing=false; this.finalSnapshot=null; this.receipt=null;
    this.exitReason=null; this.manifestWritten=false; this.interactionCursor=0;
    this.lastPhase=null; this.startedAt=new Date().toISOString();
    this.screenCounter=0; this.currentScreen=null; this.lastCheckpointRows=0;
    this.install();
  }
  Recorder.prototype.rows=function() { return this.js.data.get().values(); };
  Recorder.prototype.install=function() {
    var self=this, original=this.js.data.write;
    this.originalWrite=original;
    this.js.data.write=function(data) {
      data=data || {}; original.call(self.js.data,data);
      var row=self.js.data.get().last(1).values()[0];
      // jsPsych 6 merges trial.data after custom rows. Restore event identity.
      if (/^(session_manifest|session_summary|save_event|interaction_event|instruction_event|response_event|design_manifest)$/.test(data.trial_category || '')) {
        Object.assign(row,data); row.trial_type=data.trial_category.replace(/_/g,'-');
      }
      row.data_schema_version=SCHEMA; row.data_saving_version=VERSION;
      row.run_uuid=self.run; row.row_uuid=uuid(); row.row_sequence=++self.sequence;
      row.utc_timestamp=new Date().toISOString(); row.elapsed_ms=Math.round(now()-self.start);
      row.task_phase=phase(row);
      if (row.trial_type === 'instructions') {
        row.screen_id=row.screen_id || self.currentScreen;
        row.instruction_version='instructions-2026-10-26';
      }
      self.queueCache(row);
      if (self.consented && (row.mt_row==='trajectory' || row.trial_category==='response_event')) {
        self.requestCheckpoint('completed_response',row.mt_row==='trajectory');
      }
    };
    this.visibility=function() {
      if (document.visibilityState === 'hidden' && self.consented && !self.finalizing) {
        self.record('interaction_event',{event_name:'visibility_hidden',event_elapsed_ms:Math.round(now()-self.start)});
        self.flushCache(); self.requestCheckpoint('visibility_hidden',true);
      }
    };
    document.addEventListener('visibilitychange',this.visibility);
    this.pagehide=function() { if (self.consented && !self.receipt) self.flushCache(); };
    root.addEventListener('pagehide',this.pagehide);
  };
  Recorder.prototype.record=function(category,fields) {
    var data=Object.assign({trial_category:category,task_phase:'session'},fields || {});
    if (this.finalizing) data.internal_node_id='session_finalization';
    this.js.data.write(data);
    return this.rows()[this.rows().length-1];
  };
  Recorder.prototype.expected=function(outcome) {
    var full=!(this.options.devMode && this.options.stage!=='full');
    var main=outcome==='completed' && full;
    var screening=this.options.memoryScreeningEnabled && (full || this.options.stage==='memory-screen');
    var moduleEncoding=this.options.devMode && /^(encoding|block)$/.test(this.options.stage);
    var moduleMemory=this.options.devMode && /^(block|test|recognition)$/.test(this.options.stage);
    return {expected_main_encoding:main?200:moduleEncoding?Math.min(this.options.devNtrials || 50,50):0,
      expected_main_memory_pairs:main?56:moduleMemory?14:0,
      expected_screen_encoding:screening?20:0,
      expected_screen_order:screening?10:0,
      expected_mouse_trajectories:(main || /^(mouse-test|block)$/.test(this.options.stage)) && this.options.mouseQcEnabled?8:0,
      expected_demographics:main || this.options.stage==='survey'?1:0};
  };
  Recorder.prototype.enableCache=function() {
    if (this.consented) return;
    var self=this; this.consented=true;
    this.cacheStatus='opening';
    this.cacheReady=openCache().then(function(db) {
      self.cache=db; self.cacheStatus='available';
      self.pending=self.rows().map(function(row) { return clone(row); });
      self.offerPreviousRuns(); return self.flushCache();
    }).catch(function(error) {
      self.cacheStatus='unavailable'; self.pending=[];
      console.warn('[Recording] Local recovery unavailable',error.message);
    });
    if (!this.manifestWritten) {
      this.manifestWritten=true;
      this.record('session_manifest',Object.assign({
        session_started_at:this.startedAt,route_stage:this.options.stage || 'full',
        task_version:this.options.taskVersion,build_id:VERSION,
        pilot_mode:!!this.options.pilotMode,dev_mode:!!this.options.devMode,
        audit_full:!!this.options.auditFull,
        mouse_qc_requested:!!this.options.mouseQcRequested,mouse_qc_enabled:!!this.options.mouseQcEnabled,
        memory_screening_requested:!!this.options.memoryScreeningRequested,
        memory_screening_enabled:!!this.options.memoryScreeningEnabled,
        instruction_version:'instructions-2026-10-26',comprehension_version:'reference-aligned-12-v2',
        survey_version:'demographics-2026-10-26',
        browser_user_agent:navigator.userAgent,viewport_w:innerWidth,viewport_h:innerHeight,
        device_pixel_ratio:root.devicePixelRatio || 1,cache_status:this.cacheStatus
      },this.expected('completed')));
      if (this.options.designManifest) this.record('design_manifest',{
        design_id:'main_task',design_manifest_json:JSON.stringify(this.options.designManifest)});
    }
  };
  Recorder.prototype.queueCache=function(row) {
    if (!this.consented || this.cacheStatus==='unavailable' || this.receipt) return;
    this.pending.push(row);
    if (!this.cacheTimer) {
      var self=this;
      this.cacheTimer=setTimeout(function() { self.cacheTimer=null; self.flushCache(); },200);
    }
  };
  Recorder.prototype.flushCache=function() {
    var self=this;
    if (!this.cache || !this.pending.length || this.receipt) return this.cacheWrites;
    var pending=this.pending.splice(0).map(function(row) { return clone(row); });
    this.cacheWrites=this.cacheWrites.catch(function() {}).then(function() {
      return new Promise(function(resolve,reject) {
        var tx=self.cache.transaction(['runs','rows'],'readwrite');
        var timer=setTimeout(function(){reject(new Error('Recovery write did not respond'));},5000);
        tx.objectStore('runs').put({run_uuid:self.run,started_at:self.startedAt,updated_at:new Date().toISOString(),
          row_count:self.rows().length,acknowledged:false,cache_status:self.cacheStatus});
        pending.forEach(function(row) { tx.objectStore('rows').put({
          cache_key:self.run+':'+row.row_uuid,run_uuid:self.run,row:row}); });
        tx.oncomplete=function(){clearTimeout(timer);resolve();};
        tx.onerror=function() { clearTimeout(timer);reject(tx.error); };
        tx.onabort=function() { clearTimeout(timer);reject(tx.error || new Error('Local cache transaction aborted')); };
      });
    }).catch(function(error) { self.cacheStatus='unavailable';console.warn('[Recording] Recovery write failed',error.message); });
    return this.cacheWrites;
  };
  Recorder.prototype.clearCache=function() {
    var self=this;this.pending=[];clearTimeout(this.cacheTimer);this.cacheTimer=null;
    if (!this.cache) return Promise.resolve();
    return this.cacheWrites.then(function() { return new Promise(function(resolve) {
      var tx=self.cache.transaction(['runs','rows'],'readwrite');
      var timer=setTimeout(resolve,5000);
      tx.objectStore('runs').delete(self.run);
      var request=tx.objectStore('rows').index('run_uuid').openCursor(IDBKeyRange.only(self.run));
      request.onsuccess=function() { var cursor=request.result;if(cursor) {cursor.delete();cursor.continue();} };
      function done(){clearTimeout(timer);resolve();}
      tx.oncomplete=done;tx.onerror=done;tx.onabort=done;
    }); });
  };
  Recorder.prototype.offerPreviousRuns=function() {
    var self=this;if(!this.cache) return;
    var request=this.cache.transaction('runs').objectStore('runs').getAll();
    request.onsuccess=function() {
      var previous=request.result.filter(function(run) { return run.run_uuid!==self.run && !run.acknowledged; });
      if (!previous.length) return;
      var button=document.createElement('button');button.type='button';button.textContent='Recover previous recording';
      button.id='recording-recovery-button';
      button.style.cssText='position:fixed;bottom:12px;right:12px;z-index:10000;padding:8px 12px;font-size:13px;border-radius:8px;border:1px solid #94a3b8;background:white;color:#334155';
      button.onclick=function() {
        previous.forEach(function(run) {
          var req=self.cache.transaction('rows').objectStore('rows').index('run_uuid').getAll(run.run_uuid);
          req.onsuccess=function() {
            var rows=req.result.map(function(item) {return item.row;}).sort(function(a,b) {return a.row_sequence-b.row_sequence;});
            offer(csvRows(rows),'drone_task_'+run.run_uuid+'_recovery.csv');
          };
        });
      };
      document.body.appendChild(button);
    };
  };
  Recorder.prototype.onTrialStart=function(trial) {
    if (trial.type==='instructions') {
      trial.data=Object.assign({},trial.data || {});
      trial.data.screen_id=trial.data.screen_id || 'instruction_'+String(++this.screenCounter).padStart(3,'0');
      trial.data.instruction_screen_ids=(trial.pages || []).map(function(_,i) {return trial.data.screen_id+'_page_'+i;});
      this.currentScreen=trial.data.screen_id;
    }
  };
  Recorder.prototype.onInteraction=function(event) {
    if (this.finalizing) return;
    this.record('interaction_event',{event_name:event.event,event_trial_index:event.trial,
      event_elapsed_ms:event.time,viewport_w:innerWidth,viewport_h:innerHeight,
      device_pixel_ratio:root.devicePixelRatio || 1});
    this.interactionCursor++;
  };
  Recorder.prototype.onDataUpdate=function(row) {
    if (row.trial_category==='consent' && Number(row.response !== undefined?row.response:row.button_pressed)===0 && !root._bot_detected) this.enableCache();
    if (!this.options.showConsent && this.options.devMode) this.enableCache();
    if (this.finalizing || !this.consented) return;
    if (row.view_history) {
      var self=this;
      row.view_history.forEach(function(view) {
        self.record('instruction_event',{task_phase:'instructions',event_name:'page_view',screen_id:view.screen_id || row.screen_id,
          page_index:view.page_index,page_id:view.page_id || row.screen_id+'_page_'+view.page_index,
          viewing_time:view.viewing_time,viewed_prior_instruction:!!view.viewed_prior_instruction,
          prior_instruction_index:view.prior_instruction_index});
      });
    }
    var current=phase(row);
    if (current!==this.lastPhase) {
      this.record('save_event',{event_name:'phase_checkpoint',task_phase:current});
      this.lastPhase=current;this.requestCheckpoint('phase_boundary',true);
    } else this.requestCheckpoint('periodic',false);
    this.flushCache();
  };
  Recorder.prototype.requestCheckpoint=function(reason,force) {
    if (!this.consented || this.finalizing) return;
    if (!force && now()-this.lastCheckpoint<30000) return;
    if (!this.env.USE_PAVLOVIA) {this.flushCache();return;}
    var transport=this.js.plugins.pavlovia;
    if (transport.state && transport.state().storage_mode==='download') {this.flushCache();return;}
    if (this.checkpointBusy) {this.checkpointAgain=true;return;}
    var self=this;this.checkpointBusy=true;
    setTimeout(function() {
      if (self.finalizing) {self.checkpointBusy=false;return;}
      var snapshotRows=self.rows().length, snapshot=csvRows(self.rows());
      Promise.resolve().then(function(){return transport.checkpoint({participantId:self.options.participantId,
        key:'drone_task_'+self.run+'_checkpoint.csv',csv:snapshot});}).then(function(receipt) {
        self.lastCheckpoint=now();self.lastCheckpointRows=snapshotRows;
        self.record('save_event',{event_name:'checkpoint_ack',save_reason:reason,
          save_acknowledged:receipt.acknowledged,save_disposition:receipt.disposition,
          save_payload_bytes:bytes(snapshot),save_row_count:snapshotRows,
          save_attempts:receipt.attempts});
      }).catch(function(error) {
        self.record('save_event',{event_name:'checkpoint_error',save_reason:reason,
          save_error:String(error && error.message || 'Checkpoint upload failed')});
      }).finally(function() {
        self.checkpointBusy=false;self.flushCache();
        if (self.checkpointAgain && !self.finalizing) {self.checkpointAgain=false;self.requestCheckpoint('coalesced',false);}
      });
    },50);
  };
  Recorder.prototype.setExit=function(reason) {this.exitReason=reason;};
  Recorder.prototype.counts=function() {
    var rows=this.rows(), main=rows.filter(function(r) {return r.trial_type==='trial' && Number(r.practice_no)===0 && !r.memory_screening && r.task_phase!=='memory_screening';});
    return {observed_main_encoding:main.length,
      observed_main_memory_pairs:rows.filter(function(r) {return r.trial_type==='memory-task' && r.task_phase!=='memory_screening';}).length,
      observed_screen_encoding:rows.filter(function(r) {return r.trial_category==='memory_screening_encoding';}).length,
      observed_screen_order:rows.filter(function(r) {return r.trial_category==='memory_screening_order';}).length,
      observed_mouse_trajectories:rows.filter(function(r) {return r.mt_row==='trajectory';}).length,
      observed_demographics:rows.filter(function(r) {return r.trial_type==='survey-demo';}).length,
      total_scored_trials:main.filter(function(r) {return typeof r.supply_caught==='number';}).length,
      total_supply_caught:main.reduce(function(a,r) {return a+(Number(r.supply_caught)||0);},0),
      total_score:main.reduce(function(a,r) {return a+(Number(r.score)||0);},0)};
  };
  Recorder.prototype.panel=function(title,text,actions) {
    var display=document.querySelector('.jspsych-display-element') || document.body;
    display.innerHTML='<div style="max-width:680px;margin:12vh auto;padding:30px;text-align:center;font:18px/1.6 system-ui;color:#243746"><h1 style="font-size:28px"></h1><p></p><div class="recording-actions"></div></div>';
    display.querySelector('h1').textContent=title;display.querySelector('p').textContent=text;
    var container=display.querySelector('.recording-actions');
    (actions || []).forEach(function(action) {
      var button=document.createElement('button');button.type='button';button.textContent=action.label;
      button.style.cssText='margin:8px;padding:12px 20px;font-size:16px;border:1px solid #94a3b8;border-radius:8px;background:white;cursor:pointer';
      button.onclick=action.run;container.appendChild(button);
    });
  };
  Recorder.prototype.downloadAudit=function() {
    if (!this.finalSnapshot) return;
    offer(this.finalSnapshot.csv,this.finalSnapshot.filename);
    if (this.receipt) offer(JSON.stringify(this.receipt,null,2),this.finalSnapshot.filename.replace(/\.csv$/,'.receipt.json'),'application/json');
  };
  Recorder.prototype.auditActions=function() {
    var self=this;
    return [{label:'Download CSV',run:function(){offer(self.finalSnapshot.csv,self.finalSnapshot.filename);}},
      {label:'Download save receipt',run:function(){offer(JSON.stringify(self.receipt,null,2),self.finalSnapshot.filename.replace(/\.csv$/,'.receipt.json'),'application/json');}}];
  };
  Recorder.prototype.finalize=async function(config) {
    var self=this;
    if (this.finalizing) return;
    this.finalizing=true;
    root.removeEventListener('beforeunload',config.verifyUnload);
    if (config.getConsentDeclined() || (!this.consented && !this.options.devMode)) {
      try {if(this.env.USE_PAVLOVIA) await this.js.plugins.pavlovia.closeSession({isCompleted:false});}catch(_){}
      this.panel('Thank you for your interest','You have not consented to participate. Your responses have not been uploaded. You may close this tab.');
      return;
    }
    this.panel('Saving your responses','Please keep this tab open while your responses are saved.');
    // Let an already requested checkpoint settle before constructing the final snapshot.
    if (this.checkpointBusy) {
      await new Promise(function(resolve) {var timer=setInterval(function(){if(!self.checkpointBusy){clearInterval(timer);resolve();}},50);});
    }
    var outcome='early_terminated';
    try {
    var result=config.getMemoryScreeningResult ? config.getMemoryScreeningResult() : null;
    var count=this.counts(); outcome='completed';
    if (this.options.devMode && this.options.stage!=='full') outcome='module_completed';
    else if (result && result.status==='configuration_error') outcome='configuration_error';
    else if (result && result.status==='failed' && !this.options.auditFull) outcome='memory_screened_out';
    else if (config.getLowQuality() || count.observed_main_encoding!==200 || count.observed_main_memory_pairs!==56 || count.observed_demographics!==1) outcome='early_terminated';
    this.outcome=outcome;
    var events=this.js.data.getInteractionData().values();
    // Capture the interaction snapshot before upload; event rows are the primary log.
    var summary=this.record('session_summary',Object.assign({},count,this.expected(outcome),{
      outcome:outcome,exit_reason:this.exitReason || (outcome==='completed'?'normal_completion':outcome),
      audit_full:!!this.options.auditFull,screening_criterion_passed:result ? result.passed : null,
      memory_screening_passed:result ? result.passed : null,
      cache_status:this.cacheStatus,session_started_at:this.startedAt,session_finished_at:new Date().toISOString(),
      interactions:JSON.stringify(events),total_interactions:events.length,
      final_phase:this.lastPhase
    }));
    this.record('save_event',{event_name:'final_save_started',save_is_final:true,save_acknowledged:false});
    await this.flushCache();
    if (this.cacheReady) await this.cacheReady;
    await this.flushCache();
    summary.cache_status=this.cacheStatus;
    var csv=csvRows(this.rows());
    this.finalSnapshot={csv:csv,filename:'drone_task_'+this.run+'_final.csv',
      payload_bytes:bytes(csv),row_count:this.rows().length,payload_sha256:await hash(csv)};
    } catch(preparationError) {
      this.panel('Your recording is still available','Saving could not be prepared. Download your recording before closing this tab.',[
        {label:'Download recording',run:function(){offer(csvRows(self.rows()),'drone_task_'+self.run+'_recovery.csv');}}
      ]);
      console.error('[Recording] Could not prepare final snapshot',preparationError);
      return;
    }
    async function attempt() {
      try {
        self.panel('Saving your responses','Please keep this tab open while the server confirms your recording.');
        var received;
        if (self.env.USE_PAVLOVIA) received=await self.js.plugins.pavlovia.finalize({
          // This is a finished recording endpoint, including a planned
          // screening exit. Behavioral completion is the explicit outcome
          // in the CSV, not Pavlovia's transport completion flag. Closing
          // consented, saved endpoints as incomplete can invoke server
          // incomplete-result retention settings. Decline and pagehide
          // remain incomplete and never assert behavioral completion.
          participantId:self.options.participantId,key:self.finalSnapshot.filename,csv:self.finalSnapshot.csv,isCompleted:true});
        else {offer(csv,self.finalSnapshot.filename);received={disposition:'downloaded',acknowledged:false,attempts:0,session_closed:false};}
        self.receipt=Object.assign({},received,{
          run_uuid:self.run,filename:self.finalSnapshot.filename,payload_sha256:self.finalSnapshot.payload_sha256,
          payload_bytes:self.finalSnapshot.payload_bytes,row_count:self.finalSnapshot.row_count,
          is_final:true,saved_at:new Date().toISOString(),outcome:outcome,
          server_session_completed:received.acknowledged===true && received.session_closed===true,
          data_schema_version:SCHEMA,data_saving_version:VERSION
        });
        if (received.acknowledged && received.disposition==='uploaded') await self.clearCache();
        document.removeEventListener('visibilitychange',self.visibility);root.removeEventListener('pagehide',self.pagehide);
        var success=received.acknowledged && received.disposition==='uploaded';
        var message=success?'Your responses have been saved and confirmed by the server.':'A CSV copy has been offered for download. Cloud saving has not been confirmed. Please keep the downloaded file.';
        var actions=self.auditActions();
        self.panel(outcome==='configuration_error'?'Session could not finish':'Thank you for participating',message,actions);
        if (!config.PILOT_MODE && !config.DEV_MODE && success) {
          var destination=null;
          if (outcome==='memory_screened_out') destination=config.memoryScreeningCompletionUrl;
          else if (outcome==='completed') destination='https://app.prolific.com/submissions/complete?cc='+encodeURIComponent(config.CODE_SUCCESS);
          else if (outcome==='early_terminated' && config.CODE_REJECT && !/^REPLACE_/.test(config.CODE_REJECT)) destination='https://app.prolific.com/submissions/complete?cc='+encodeURIComponent(config.CODE_REJECT);
          if (destination && destination.indexOf('REPLACE_')===-1) root.location.assign(destination);
        }
      } catch(error) {
        self.panel('Your recording is still available','The server has not confirmed saving. Retry the upload or download your recording before closing this tab.',[
          {label:'Retry saving',run:attempt},
          {label:'Download recording',run:function(){offer(self.finalSnapshot.csv,self.finalSnapshot.filename.replace('_final.csv','_recovery.csv'));}}
        ]);
        console.error('[Recording] Final upload not confirmed',error);
      }
    }
    await attempt();
  };
  root.DroneDataRecorder={version:VERSION,schemaVersion:SCHEMA,create:function(options){return new Recorder(options);},csvRows:csvRows};
})(window);
