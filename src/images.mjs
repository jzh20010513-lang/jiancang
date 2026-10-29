const MAX_BYTES=10*1024*1024, MAX_PIXELS=20_000_000;
const fail=()=>{throw new Error('图片格式无效、包含动画或尺寸超出限制，请使用静态 PNG/JPEG/WebP。');};
const ascii=(b,o,n)=>String.fromCharCode(...b.subarray(o,o+n));
export function validateBatch(files){if(!files || files.length>10 || Array.from(files).reduce((s,f)=>s+f.size,0)>50*1024*1024)throw new Error('每批最多 10 张且总大小不超过 50 MiB。');}
export async function validateImage(file){
 if(!file || !Number.isFinite(file.size)||file.size===0||file.size>MAX_BYTES)throw new Error('单张图片须大于零且不超过 10 MiB。');
 const b=new Uint8Array(await file.arrayBuffer()),v=new DataView(b.buffer);let width,height,type;
 if(b.length>=33 && [137,80,78,71,13,10,26,10].every((x,i)=>b[i]===x)){
  type='image/png';if(ascii(b,12,4)!=='IHDR'||v.getUint32(8)!==13)fail();width=v.getUint32(16);height=v.getUint32(20);let ended=false;
  for(let o=8;o+12<=b.length;){const n=v.getUint32(o),tag=ascii(b,o+4,4);if(o+n+12>b.length)fail();if(tag==='acTL'||tag==='fcTL'||tag==='fdAT')fail();o+=n+12;if(tag==='IEND'){ended=true;break;}}
  if(!ended)fail();
 }else if(b.length>=12&&ascii(b,0,4)==='RIFF'&&ascii(b,8,4)==='WEBP'){
  type='image/webp';if(v.getUint32(4,true)+8!==b.length)fail();
  for(let o=12;o+8<=b.length;){const tag=ascii(b,o,4),n=v.getUint32(o+4,true),p=o+8;if(p+n>b.length)fail();if(tag==='ANIM'||tag==='ANMF')fail();
   if(tag==='VP8X'){if(n<10||(b[p]&2))fail();width=1+b[p+4]+(b[p+5]<<8)+(b[p+6]<<16);height=1+b[p+7]+(b[p+8]<<8)+(b[p+9]<<16);}
   if(tag==='VP8 '){if(n<10||b[p+3]!==157||b[p+4]!==1||b[p+5]!==42)fail();const fw=v.getUint16(p+6,true)&16383,fh=v.getUint16(p+8,true)&16383;if(width&&(fw!==width||fh!==height))fail();width=fw;height=fh;}
   if(tag==='VP8L'){if(n<5||b[p]!==47)fail();const bits=v.getUint32(p+1,true);const fw=(bits&16383)+1,fh=((bits>>>14)&16383)+1;if(width&&(fw!==width||fh!==height))fail();width=fw;height=fh;}
   o=p+n+(n%2);
  }
 }else if(b.length>=4&&b[0]===255&&b[1]===216){
  type='image/jpeg';let o=2;while(o<b.length){if(b[o++]!==255)fail();while(b[o]===255)o++;const marker=b[o++];if(marker===217||marker===218)break;if(marker===1||(marker>=208&&marker<=215))continue;if(o+2>b.length)fail();const len=v.getUint16(o);if(len<2||o+len>b.length)fail();if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)){if(len<8)fail();height=v.getUint16(o+3);width=v.getUint16(o+5);break;}o+=len;}
 }else fail();
 if(!width||!height||width*height>MAX_PIXELS)fail();return {width,height,type};
}
export async function decodeImage(file){
 const meta=await validateImage(file);const url=URL.createObjectURL(file);
 try{const img=new Image();img.decoding='async';await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error('图片无法解码，请更换静态图片。'));img.src=url;});if(!img.naturalWidth||img.naturalWidth*img.naturalHeight>MAX_PIXELS)fail();const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;canvas.getContext('2d').drawImage(img,0,0);return canvas;}finally{URL.revokeObjectURL(url);}
}
