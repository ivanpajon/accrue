import { APP_NAME, APP_SLUG } from './brand.ts';
import type { Preferences } from './preferences.ts';
import type { ProjectionRow } from './compound.ts';
import { locales, translator, type MessageKey } from './i18n.ts';

export type ExportSnapshot = Preferences & { name: string; createdAt: Date; rows: ProjectionRow[] };
type Color = string;
type Text = { kind:'text'; text:string; x:number; y:number; size:number; bold?:boolean; color:Color };
type Command = Text | {kind:'rect';x:number;y:number;width:number;height:number;color:Color} | {kind:'line';x:number;y:number;x2:number;y2:number;color:Color;width:number;dash?:boolean};
export type Scene = {width:number;height:number;commands:Command[]};
export type CanvasFactory = (width:number,height:number) => HTMLCanvasElement;
const ink='#18181b', muted='#71717a', border='#e4e4e7', paper='#fafafa';
const series = [{key:'total',label:'totalBalance',color:'#2563eb'},{key:'contributed',label:'contributions',color:'#059669'},{key:'gains',label:'interest',color:'#d97706'}] as const;
const frequencyKeys:Record<string,MessageKey> = {'365':'daily','52':'weekly','26':'fortnightly','12':'monthly','4':'quarterly','2':'halfYearly','1':'yearly'};
export const browserCanvas:CanvasFactory = (width,height) => { const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;return canvas; };
const rect=(s:Scene,x:number,y:number,width:number,height:number,color=border)=>s.commands.push({kind:'rect',x,y,width,height,color});
const line=(s:Scene,x:number,y:number,x2:number,y2:number,color=border,width=1,dash=false)=>s.commands.push({kind:'line',x,y,x2,y2,color,width,dash});
const text=(s:Scene,value:string,x:number,y:number,size=20,bold=false,color=ink)=>s.commands.push({kind:'text',text:value,x,y,size,bold,color});
const font=(ctx:CanvasRenderingContext2D,size:number,bold=false)=>{ctx.font=`${bold?'600':'400'} ${size}px Arial, sans-serif`;};
function wrapped(ctx:CanvasRenderingContext2D,value:string,maxWidth:number,size:number,bold=false) {
  font(ctx,size,bold);const lines:string[]=[];let current='';
  for(const word of value.replace(/\s+/g,' ').trim().split(' ')) {
    const candidate=current?`${current} ${word}`:word;
    if(ctx.measureText(candidate).width<=maxWidth){current=candidate;continue;}
    if(current){lines.push(current);current='';}
    for(const char of word){if(ctx.measureText(current+char).width>maxWidth&&current){lines.push(current);current='';}current+=char;}
  }
  if(current)lines.push(current);return lines;
}
function paragraph(s:Scene,ctx:CanvasRenderingContext2D,value:string,x:number,y:number,width:number,size=20,color=muted,bold=false) {
  const lines=wrapped(ctx,value,width,size,bold);lines.forEach((value,i)=>text(s,value,x,y+i*size*1.45,size,bold,color));return y+lines.length*size*1.45;
}
function fitted(s:Scene,ctx:CanvasRenderingContext2D,value:string,x:number,y:number,width:number,size:number,bold=false,color=ink) {
  font(ctx,size,bold);while(ctx.measureText(value).width>width&&size>12){size-=1;font(ctx,size,bold);}text(s,value,x,y,size,bold,color);
}
function formatters(snapshot:ExportSnapshot) {
  const t=translator(snapshot.language),locale=locales[snapshot.language];
  const number=(value:number)=>new Intl.NumberFormat(locale,{maximumFractionDigits:2}).format(value);
  const money=(value:number,compact=false)=>new Intl.NumberFormat(locale,{style:'currency',currency:snapshot.currency,notation:Math.abs(value)>=1e15?'scientific':compact?'compact':'standard',maximumFractionDigits:compact?1:2}).format(value);
  const years=(n:number)=>t(n===1?'yearCount':'yearsCount',{count:number(n)});
  return {t,number,money,years};
}
export function exportFilename(snapshot:ExportSnapshot,extension:'png'|'pdf') {
  const base=snapshot.name.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60);
  const filename=base?`${APP_SLUG}-${base}`:translator(snapshot.language)('exportFile');
  return `${filename}-${snapshot.currency}.${extension}`;
}
function drawChart(s:Scene,ctx:CanvasRenderingContext2D,snapshot:ExportSnapshot,x:number,y:number,width:number,height:number,visible:Preferences['visible']) {
  const {t,money,number}=formatters(snapshot);const enabled=series.filter(item=>visible[item.key]);
  let legendX=x;
  for(const item of enabled){rect(s,legendX,y,10,10,item.color);text(s,t(item.label),legendX+18,y+12,18,false,muted);font(ctx,18);legendX+=ctx.measureText(t(item.label)).width+54;}
  text(s,snapshot.currency,x+width-45,y+12,16,false,muted);
  const values=snapshot.rows.flatMap(row=>enabled.map(item=>row[item.key]));
  const rawMin=Math.min(0,...values),rawMax=Math.max(0,...values);
  const span=rawMax-rawMin || 1;
  const min=rawMin<0?rawMin-span*.07:0,max=rawMax===rawMin?1:rawMax+span*.08;
  const left=x+118,right=x+width-20,top=y+55,bottom=y+height-47;
  const px=(year:number)=>left+year/Number(snapshot.years)*(right-left);
  const py=(value:number)=>bottom-(value-min)/(max-min)*(bottom-top);
  for(let i=0;i<=4;i++){
    const value=min+(max-min)*i/4,baseline=py(value);
    line(s,left,baseline,right,baseline,border,1,true);
    fitted(s,ctx,money(value,max-min>10),x,baseline+6,102,17,false,muted);
  }
  if(min<0)line(s,left,py(0),right,py(0),'#a1a1aa');
  const intervals=Math.min(10,Number(snapshot.years));
  const ticks=Array.from({length:intervals+1},(_,i)=>Math.round(i*Number(snapshot.years)/intervals));
  for(const year of ticks){const label=t('yearShort',{year:number(year)});font(ctx,16);text(s,label,Math.min(right-ctx.measureText(label).width/2,px(year)-ctx.measureText(label).width/2),bottom+31,16,false,muted);}
  for(const item of enabled){for(let i=1;i<snapshot.rows.length;i++){const a=snapshot.rows[i-1],b=snapshot.rows[i];line(s,px(a.year),py(a[item.key]),px(b.year),py(b[item.key]),item.color,item.key==='total'?3:2.5,item.key==='gains');}}
}
export function createChartScene(snapshot:ExportSnapshot,createCanvas:CanvasFactory=browserCanvas):Scene {
  const s:Scene={width:1400,height:860,commands:[]},ctx=createCanvas(1,1).getContext('2d')!;
  const {t,years}=formatters(snapshot);rect(s,0,0,s.width,s.height,'#ffffff');
  text(s,APP_NAME,60,57,24,true);text(s,t('chartTitle'),60,118,36,true);
  const next=paragraph(s,ctx,snapshot.name,60,155,1280,20);
  text(s,`${years(Number(snapshot.years))} · ${snapshot.currency}`,60,next+12,18,false,muted);
  drawChart(s,ctx,snapshot,60,next+49,1280,535-(next-184),snapshot.visible);
  line(s,60,788,1340,788);paragraph(s,ctx,t('note'),60,821,1280,16);
  return s;
}
export function createReportScenes(snapshot:ExportSnapshot,createCanvas:CanvasFactory=browserCanvas):Scene[] {
  const width=1200,height=1697,margin=72,content=width-2*margin,ctx=createCanvas(1,1).getContext('2d')!;
  const {t,money,number,years}=formatters(snapshot);const pages:Scene[]=[];
  const newPage=()=>{const s:Scene={width,height,commands:[]};rect(s,0,0,width,height,'#ffffff');text(s,APP_NAME,margin,65,25,true);text(s,t('reportTitle'),margin,105,18,false,muted);line(s,margin,132,width-margin,132);pages.push(s);return s;};
  let page=newPage(),y=192;
  y=paragraph(page,ctx,snapshot.name,margin,y,content,42,ink,true)+10;
  const date=new Intl.DateTimeFormat(locales[snapshot.language],{dateStyle:'long'}).format(snapshot.createdAt);
  text(page,t('reportCreated',{date}),margin,y,18,false,muted);y+=42;
  const last=snapshot.rows.at(-1)!;
  const metrics=[{label:t('balance'),value:last.total,color:'#2563eb'},{label:t('contributed'),value:last.contributed,color:'#059669'},{label:t(last.gains<0?'loss':'earned'),value:Math.abs(last.gains),color:last.gains<0?'#dc2626':'#d97706'}];
  metrics.forEach((item,i)=>{const x=margin+i*(content+18)/3,w=(content-36)/3;rect(page,x,y,w,114,paper);rect(page,x,y,4,114,item.color);text(page,item.label,x+20,y+32,18,false,muted);fitted(page,ctx,money(item.value,Math.abs(item.value)>=1e10),x+20,y+80,w-40,35,true);});
  y+=162;text(page,t('chartTitle'),margin,y,25,true);y+=31;drawChart(page,ctx,snapshot,margin,y,content,400,{total:true,contributed:true,gains:true});y+=442;
  text(page,t('settings'),margin,y,25,true);y+=26;
  const settings=[ [t('initial'),money(Number(snapshot.initial))], [t('rate'),`${number(Number(snapshot.rate))}%`], [t('compounding'),t(frequencyKeys[snapshot.compounds])], [t('period'),years(Number(snapshot.years))], [t('timingLabel'),t(snapshot.timing==='beginning'?'beginningTiming':'endTiming')], [t('currency'),snapshot.currency] ];
  settings.forEach(([label,value],i)=>{const x=margin+(i%2)*(content/2+12),top=y+Math.floor(i/2)*82;text(page,label,x,top+20,17,false,muted);fitted(page,ctx,value,x,top+51,content/2-30,22,true);});y+=283;
  const continuation=()=>{page=newPage();y=182;};
  const tableHeading=()=>{text(page,t('plan'),margin,y,25,true);y+=36;rect(page,margin,y,content,40,paper);[ [t('reportPhase'),0],[t('reportYears'),210],[t('reportAmount'),465],[t('reportRecurrence'),750] ].forEach(([label,offset])=>text(page,String(label),margin+Number(offset)+12,y+27,17,true,muted));y+=40;};
  if(y+130>1530)continuation();tableHeading();
  if(!snapshot.phases.length)y=paragraph(page,ctx,t('emptyPhases'),margin,y+33,content,20)+12;
  snapshot.phases.forEach((phase,i)=>{
    if(y+52>1530){continuation();tableHeading();}
    const range=phase.startYear===phase.endYear?t('yearSingle',{year:phase.startYear}):t('yearRange',{start:phase.startYear,end:phase.endYear});
    fitted(page,ctx,t('phaseName',{number:i+1}),margin+12,y+31,190,20);
    fitted(page,ctx,range,margin+222,y+31,235,20);
    fitted(page,ctx,money(Number(phase.amount)),margin+477,y+31,265,20,true);
    fitted(page,ctx,t(frequencyKeys[phase.frequency]),margin+762,y+31,content-774,20);
    line(page,margin,y+48,width-margin,y+48);y+=49;
  });
  y+=48;
  const yearlyHeading=()=>{text(page,t('yearlyView'),margin,y,25,true);y+=36;rect(page,margin,y,content,40,paper);[[t('year'),0],[t('added'),100],[t('interest'),335],[t('contributed'),570],[t('tableBalance'),805]].forEach(([label,offset])=>text(page,String(label),margin+Number(offset)+12,y+27,17,true,muted));y+=40;};
  if(y+180>1530)continuation();yearlyHeading();
  snapshot.rows.forEach((row,i)=>{
    if(y+46>1530){continuation();yearlyHeading();}
    if(i===snapshot.rows.length-1)rect(page,margin,y,content,44,paper);
    text(page,row.year===0?t('start'):number(row.year),margin+12,y+29,18);
    [row.addition,row.interest,row.contributed,row.total].forEach((value,j)=>fitted(page,ctx,money(value,Math.abs(value)>=1e15),margin+112+j*235,y+29,215,18,j===3,value<0?'#dc2626':ink));
    line(page,margin,y+43,width-margin,y+43);y+=44;
  });
  y+=40;
  const notes=[t('reportPhaseNote'),...(snapshot.phases.some(p=>Number(p.endYear)>Number(snapshot.years))?[t('clipped')]:[]),t('formula'),t('calendar'),t('caveats')];
  const notesHeight=35+notes.reduce((sum,note)=>sum+wrapped(ctx,note,content,18).length*26.1+17,0);
  if(y+notesHeight>1530)continuation();text(page,t('assumptions'),margin,y,24,true);y+=35;
  for(const note of notes)y=paragraph(page,ctx,note,margin,y,content,18)+17;
  pages.forEach((p,i)=>{line(p,margin,1590,width-margin,1590);text(p,t('reportFooter'),margin,1627,16,false,muted);text(p,`${i+1} / ${pages.length}`,width-margin-60,1627,16,false,muted);});
  return pages;
}
export function renderScene(scene:Scene,scale=2,createCanvas:CanvasFactory=browserCanvas) {
  const canvas=createCanvas(Math.round(scene.width*scale),Math.round(scene.height*scale)),ctx=canvas.getContext('2d');
  if(!ctx)throw new Error('Canvas unavailable');ctx.scale(scale,scale);
  for(const c of scene.commands){if(c.kind==='rect'){ctx.fillStyle=c.color;ctx.fillRect(c.x,c.y,c.width,c.height);}else if(c.kind==='line'){ctx.strokeStyle=c.color;ctx.lineWidth=c.width;ctx.setLineDash(c.dash?[6,5]:[]);ctx.beginPath();ctx.moveTo(c.x,c.y);ctx.lineTo(c.x2,c.y2);ctx.stroke();}else{font(ctx,c.size,c.bold);ctx.fillStyle=c.color;ctx.fillText(c.text,c.x,c.y);}}
  return canvas;
}
export async function renderPdf(snapshot:ExportSnapshot,createCanvas:CanvasFactory=browserCanvas) {
  const {PDFDocument,StandardFonts,rgb}=await import('pdf-lib');
  const pdf=await PDFDocument.create();pdf.setTitle(`${APP_NAME} - ${snapshot.name} - ${translator(snapshot.language)('reportTitle')}`);pdf.setAuthor(APP_NAME);pdf.setSubject(translator(snapshot.language)('projection'));pdf.setCreationDate(snapshot.createdAt);
  const regular=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
  const color=(hex:string)=>rgb(parseInt(hex.slice(1,3),16)/255,parseInt(hex.slice(3,5),16)/255,parseInt(hex.slice(5,7),16)/255);
  for(const scene of createReportScenes(snapshot,createCanvas)){
    const k=595.28/scene.width,page=pdf.addPage([595.28,scene.height*k]);
    for(const c of scene.commands){
      if(c.kind==='rect')page.drawRectangle({x:c.x*k,y:(scene.height-c.y-c.height)*k,width:c.width*k,height:c.height*k,color:color(c.color)});
      else if(c.kind==='line')page.drawLine({start:{x:c.x*k,y:(scene.height-c.y)*k},end:{x:c.x2*k,y:(scene.height-c.y2)*k},color:color(c.color),thickness:c.width*k,dashArray:c.dash?[6*k,5*k]:undefined});
      else {
        const face=c.bold?bold:regular,value=c.text.replace(/[\u202f\u00a0]/g,' ').replace(/\u2212/g,'-');
        try {face.encodeText(value);page.drawText(value,{x:c.x*k,y:(scene.height-c.y)*k,size:c.size*k,font:face,color:color(c.color)});}
        catch {
          // Preserve user-provided names outside Helvetica's character set using the browser's fonts.
          const probe=createCanvas(1,1).getContext('2d')!;font(probe,c.size,c.bold);
          const imageScene:Scene={width:Math.ceil(probe.measureText(c.text).width)+8,height:c.size*1.5,commands:[{...c,x:4,y:c.size}]};
          const image=await pdf.embedPng(renderScene(imageScene,3,createCanvas).toDataURL('image/png'));
          page.drawImage(image,{x:(c.x-4)*k,y:(scene.height-c.y-c.size*.5)*k,width:imageScene.width*k,height:imageScene.height*k});
        }
      }
    }
  }
  return pdf.save();
}
export async function exportProjection(snapshot:ExportSnapshot,type:'png'|'pdf') {
  await document.fonts.ready;
  let blob:Blob;
  if(type==='pdf'){const bytes=await renderPdf(snapshot);blob=new Blob([new Uint8Array(bytes)],{type:'application/pdf'});}
  else {const canvas=renderScene(createChartScene(snapshot));blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('Image export failed')),'image/png'));}
  const url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download=exportFilename(snapshot,type);document.body.appendChild(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
