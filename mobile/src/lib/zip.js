let crcTable;
function crc32(bytes) {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n=0;n<256;n++) { let c=n; for(let k=0;k<8;k++) c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1); crcTable[n]=c>>>0; }
  }
  let crc=0xffffffff;
  for(let i=0;i<bytes.length;i++) crc=crcTable[(crc^bytes[i])&255]^(crc>>>8);
  return (crc^0xffffffff)>>>0;
}
function utf8(value) {
  const encoded=unescape(encodeURIComponent(String(value))), bytes=new Uint8Array(encoded.length);
  for(let i=0;i<encoded.length;i++) bytes[i]=encoded.charCodeAt(i);
  return bytes;
}
function header(size,write) { const buffer=new ArrayBuffer(size); write(new DataView(buffer)); return new Uint8Array(buffer); }
function join(parts) { const result=new Uint8Array(parts.reduce((sum,part)=>sum+part.length,0)); let offset=0; parts.forEach((part)=>{result.set(part,offset);offset+=part.length;}); return result; }
export function bytesToBase64(bytes) {
  const alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let result="";
  for(let i=0;i<bytes.length;i+=3){
    const a=bytes[i],b=i+1<bytes.length?bytes[i+1]:0,c=i+2<bytes.length?bytes[i+2]:0,n=(a<<16)|(b<<8)|c;
    result+=alphabet[(n>>>18)&63]+alphabet[(n>>>12)&63]+(i+1<bytes.length?alphabet[(n>>>6)&63]:"=")+(i+2<bytes.length?alphabet[n&63]:"=");
  }
  return result;
}
export function createZip(files) {
  const locals=[],centrals=[]; let offset=0;
  files.forEach((file)=>{
    const name=utf8(file.name),bytes=file.data instanceof Uint8Array?file.data:new Uint8Array(file.data),crc=crc32(bytes),localOffset=offset;
    const local=header(30,(d)=>{d.setUint32(0,0x04034b50,true);d.setUint16(4,20,true);d.setUint16(6,0x0800,true);d.setUint16(8,0,true);d.setUint32(10,0,true);d.setUint32(14,crc,true);d.setUint32(18,bytes.length,true);d.setUint32(22,bytes.length,true);d.setUint16(26,name.length,true);d.setUint16(28,0,true);});
    locals.push(local,name,bytes);offset+=local.length+name.length+bytes.length;
    const central=header(46,(d)=>{d.setUint32(0,0x02014b50,true);d.setUint16(4,20,true);d.setUint16(6,20,true);d.setUint16(8,0x0800,true);d.setUint16(10,0,true);d.setUint32(12,0,true);d.setUint32(16,crc,true);d.setUint32(20,bytes.length,true);d.setUint32(24,bytes.length,true);d.setUint16(28,name.length,true);d.setUint16(30,0,true);d.setUint16(32,0,true);d.setUint16(34,0,true);d.setUint16(36,0,true);d.setUint32(38,0,true);d.setUint32(42,localOffset,true);});
    centrals.push(central,name);
  });
  const centralBytes=join(centrals),centralOffset=offset;
  const end=header(22,(d)=>{d.setUint32(0,0x06054b50,true);d.setUint16(4,0,true);d.setUint16(6,0,true);d.setUint16(8,files.length,true);d.setUint16(10,files.length,true);d.setUint32(12,centralBytes.length,true);d.setUint32(16,centralOffset,true);d.setUint16(20,0,true);});
  return join([...locals,centralBytes,end]);
}
