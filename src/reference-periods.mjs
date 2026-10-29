export function weekKey(date){
 const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));return d.toISOString().slice(0,10);
}
export function completedReferencePoints(points,item,now,period='day'){
 const d=new Date(now);if(!Number.isFinite(d.getTime()))throw Error('Invalid cutoff time');
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:item.timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(d).map(p=>[p.type,p.value]));
 const today=`${parts.year}-${parts.month}-${parts.day}`,day=new Date(today+'T00:00:00Z').getUTCDay();
 if(period==='week'){
  const current=weekKey(today);return points.filter(p=>p.date<=today&&(weekKey(p.date)<current||((day===0||day===6)&&weekKey(p.date)===current)));
 }
 if(period!=='day')throw Error('Unknown interval');
 return points.filter(p=>p.date<today||(p.date===today&&Number(parts.hour)>=(item.market==='CN'?16:17)));
}
