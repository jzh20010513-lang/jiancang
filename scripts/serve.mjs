import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {createQuoteService} from './quote-service.mjs';
const root=resolve(import.meta.dirname,'../dist');
const port=Number(process.env.PORT||4318);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.wasm':'application/wasm','.gz':'application/octet-stream','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.txt':'text/plain; charset=utf-8'};
export const csp="default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'; img-src 'self' blob: data:; font-src 'self'; connect-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
const quoteService=createQuoteService();
const server=http.createServer(async(req,res)=>{
 try{
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return;}
  const requestUrl=new URL(req.url,'http://localhost');
  const pathname=decodeURIComponent(requestUrl.pathname);
  if(pathname==='/api/market-quotes'){
   if(requestUrl.search||Number(req.headers['content-length']||0)>0||req.headers['transfer-encoding']){res.writeHead(400,{'Cache-Control':'no-store'});res.end('No parameters accepted');return;}
   const quotes=await quoteService.getQuotes();
   res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});
   res.end(req.method==='HEAD'?undefined:JSON.stringify(quotes));return;
  }
  const file=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(!file.startsWith(root+sep)||!((await stat(file)).isFile())) throw Error();
  const data=await readFile(file);
  res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Content-Security-Policy':csp,'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Cache-Control':'no-store'});
  res.end(req.method==='HEAD'?undefined:data);
 }catch{res.writeHead(404,{'Content-Type':'text/plain'});res.end('Not found');}
});
server.listen(port,'127.0.0.1',()=>console.log(`Local preview: http://127.0.0.1:${port}`));
