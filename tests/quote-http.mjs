import http from 'node:http';
import assert from 'node:assert/strict';
const origin=process.env.BASE_URL||'http://127.0.0.1:4320';
const get=async(path,method='GET',body='')=>new Promise((resolve,reject)=>{
 const req=http.request(origin+path,{method,headers:body?{'Content-Length':Buffer.byteLength(body)}:{}},res=>{let text='';res.on('data',chunk=>text+=chunk);res.on('end',()=>resolve({status:res.statusCode,text}));});req.on('error',reject);req.end(body);
});
assert.equal((await get('/api/market-quotes?symbol=not-accepted')).status,400);
assert.equal((await get('/api/market-quotes','POST','synthetic')).status,405);
assert.equal((await get('/api/market-quotes','GET','synthetic')).status,400);
const response=await get('/api/market-quotes');assert.equal(response.status,200);
const bundle=JSON.parse(response.text);assert.equal(bundle.records.length,4);assert.ok(bundle.records.every(r=>['sh000001','sz399001','sz399006','sh000300'].includes(r.id)));
console.log('Fixed public quote HTTP boundary passed.');
