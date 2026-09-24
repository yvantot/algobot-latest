import { computeBootstrapAction } from './dda-bootstrap.js';
import { DDA_ACTIONS } from './dda.js';

// Rule inputs are separate from the frozen feature schema used by the saved LSTM.
export function recentPolicyState(events, now, windowMs = 180000) {
  const recent = events.filter(e => e.t <= now && e.t >= now - windowMs);
  const count = name => recent.filter(e => e.event === name).length;
  const runs = recent.filter(e => e.event === 'code_run');
  const harvests = recent.filter(e => e.event === 'crop_outcome');
  const errors = count('error') + count('order_error'), resets = count('code_reset');
  const spoilage = harvests.length ? harvests.filter(e => e.spoiled).length / harvests.length : 0;
  const frustration = (errors > 5 ? .3 : 0) + (resets > 3 ? .3 : 0) + (spoilage > .4 ? .3 : 0);
  return {errorCount:errors,resetCount:resets,frustrationScore:frustration,
    flowScore:runs.length ? runs.filter(e => e.success).length / runs.length : .5,
    successfulRuns:runs.filter(e => e.success).length,
    optimalHarvestChoices:recent.filter(e => e.event === 'greedy_choice' && e.optimal).length,
    suboptimalHarvestChoices:recent.filter(e => e.event === 'greedy_choice' && !e.optimal).length};
}

export class StableDifficultyPolicy {
  constructor() { this.reset(); }
  reset() { this.action=DDA_ACTIONS.NORMAL;this.changedAt=null;this.pending=null;this.confirmations=0; }
  decide(state, stage, proficiency, now) {
    let proposed=computeBootstrapAction(state,stage,proficiency);
    // Repeated successful runs must corroborate a high model score.
    if(proposed===DDA_ACTIONS.CHALLENGE && state.successfulRuns<3) proposed=DDA_ACTIONS.NORMAL;
    if(proposed===this.action){this.pending=null;this.confirmations=0;return this.action;}
    if(proposed===this.pending)this.confirmations++;else{this.pending=proposed;this.confirmations=1;}
    const assistance=proposed===DDA_ACTIONS.SCAFFOLD;
    if(assistance || (this.confirmations>=2 && (this.changedAt===null || now-this.changedAt>=60000))) {
      this.action=proposed;this.changedAt=now;this.pending=null;this.confirmations=0;
    }
    return this.action;
  }
}
