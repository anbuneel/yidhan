// Renders the PNG exports in images/brand/export/ from the SVGs in images/brand/.
// Uses the Playwright that the e2e suite already installs.
// Usage (from the repo root): node scripts/brand/export.cjs
const {chromium}=require('playwright');const fs=require('fs');
const B='images/brand/', O='images/brand/export/'; fs.mkdirSync(O,{recursive:true});
const jobs=[ // [source, out, size, rounded?]
 ['favicon.svg','favicon-16.png',16],['favicon.svg','favicon-32.png',32],['favicon.svg','favicon-48.png',48],
 ['app-icon.svg','icon-192.png',192,true],['app-icon.svg','icon-512.png',512,true],
 ['app-icon.svg','maskable-512.png',512],['app-icon.svg','apple-touch-icon.png',180],
 ['android-foreground.svg','android-foreground-432.png',432],['app-icon.svg','play-store-512.png',512],
 ['seal.svg','seal-1024.png',1024]];
(async()=>{const b=await chromium.launch();const p=await b.newPage();
for(const [src,out,sz,round] of jobs){await p.setViewportSize({width:sz,height:sz});
 const svg=fs.readFileSync(B+src,'utf8');
 await p.setContent(`<style>html,body{margin:0;background:transparent}div{width:${sz}px;height:${sz}px;overflow:hidden;${round?'border-radius:22%;':''}}svg{width:100%;height:100%;display:block}</style><div>${svg}</div>`);
 await p.screenshot({path:O+out,omitBackground:true});}
await b.close();console.log('done',jobs.length);})();
