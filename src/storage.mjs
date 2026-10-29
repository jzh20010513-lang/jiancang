export function createPersistence(driver){
 let enabled=false;
 return {
  get enabled(){return enabled;},
  suspend(){enabled=false;},
  async restore(){const value=await driver.read();enabled=!!value;return value;},
  async enable(value){await driver.write(value);enabled=true;},
  async update(value){if(enabled) await driver.write(value);},
  async disable(){await driver.clear();enabled=false;}
 };
}
const dbName='holdings-studio-v1';
async function open(){return new Promise((resolve,reject)=>{
 const request=indexedDB.open(dbName,1);
 request.onupgradeneeded=()=>request.result.createObjectStore('state');
 request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(Error('本机存储不可用'));
 request.onblocked=()=>reject(Error('请先关闭此站点的其他标签页'));
});}
async function transaction(mode,action){
 const db=await open();return new Promise((resolve,reject)=>{
  let result;const tx=db.transaction('state',mode);let req;
  try{req=action(tx.objectStore('state'));}catch{tx.abort();db.close();reject(Error('保存失败，请导出备份后重试'));return;}
  req.onsuccess=()=>{result=req.result;};
  tx.oncomplete=()=>{db.close();resolve(result??null);};
  tx.onerror=tx.onabort=()=>{db.close();reject(Error('保存失败，请导出备份后重试'));};
 });
}
export const browserDriver={
 async read(){
  // Do not create any database for a fresh session-only visitor.
  if(indexedDB.databases){const list=await indexedDB.databases();if(!list.some(x=>x.name===dbName))return null;}
  else return null;
  return transaction('readonly',s=>s.get('current'));
 },
 write(value){return transaction('readwrite',s=>s.put(value,'current'));},
 clear(){return new Promise((resolve,reject)=>{const req=indexedDB.deleteDatabase(dbName);req.onsuccess=()=>resolve();req.onerror=()=>reject(Error('清除失败，请重试'));req.onblocked=()=>reject(Error('请关闭其他标签页再清除'));});}
};
