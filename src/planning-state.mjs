import {defaultPlan} from './checkup.mjs';
export function advancePlanning(current,currentSnapshot,mode){
 if(mode==='edit')return structuredClone(current);
 const wasDemo=current.dataKind==='demo',demoGoals=current.planSource==='demo';
 return {...structuredClone(current),plan:demoGoals?defaultPlan():structuredClone(current.plan),planSource:demoGoals?'none':current.planSource,previousSnapshot:wasDemo?null:structuredClone(currentSnapshot),dataKind:'user'};
}
