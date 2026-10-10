/* Read-only queries over the dashboard's complete loaded source datasets. */
const normal = v => String(v ?? '').normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const tokens = v => normal(v).split(' ').filter(Boolean);
const ignored = new Set('what which who when where how many much is are was were the a an of in for to and this that show me tell please about dashboard data outlet outlets name code last latest visited assessed visit visits assessment assessments current total sum highest lowest most recent explain why all entire backend records'.split(' '));
const identities = /^(?:officer|officerName|Officer|Name|name|OutletName|outletName|OutletCode|outletCode|code|CODE|Site Code|Officer Name|RHO|Zonal|leader|zonal|Division|division|District|district|Category|category|ArticleName|ArticleCode|ArticleNo|bank)$/;
const unsafe = /password|secret|token|credential|authorization|api.?key|access.?key|refresh.?key|email/i;
const explain = q => /\b(?:why|explain|recommend|should|improve|analyse|analyze|cause|suggest|plan)\b|কেন|ব্যাখ্যা|পরামর্শ/i.test(q);
const latest = q => /\b(?:last|latest|recent|most recent)\b|সর্বশেষ|শেষ.*(?:ভিজিট|পরিদর্শন)/i.test(q);
const number = n => typeof n === 'number' && Number.isFinite(n);
const label = key => String(key).replace(/([a-z])([A-Z])/g,'$1 $2').replace(/[_:]/g,' ');
const fmt = value => value == null || value === '' ? '—' : number(value) ? new Intl.NumberFormat('en-GB',{maximumFractionDigits:6}).format(value) : String(value);
const dateText = value => new Date(value).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Dhaka'});
const eventDay = value => Math.floor((value+6*3600000)/86400000);
const hasEventTime = value => typeof value==='number'?value>1e9||value%1!==0:/[T ]\d{1,2}:\d{2}/.test(String(value));
export function dateRank(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number') {
    if(!Number.isFinite(value))return null;
    return value > 1e11 ? value : value > 1e9 ? value*1000 : value>20000&&value<100000 ? Math.round((value-25569)*86400000) : null;
  }
  const s=String(value).trim();
  if(/^\d+(?:\.\d+)?$/.test(s))return dateRank(Number(s));
  const iso=/^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if(iso){const n=Date.UTC(+iso[1],+iso[2]-1,+iso[3]);return new Date(n).toISOString().slice(0,10)===s?n:null;}
  const dmy=/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(s);
  if(dmy){if(+dmy[1]<=12&&+dmy[2]<=12&&dmy[1]!==dmy[2])return null;const day=+dmy[1],month=+dmy[2];if(month>12)return null;const n=Date.UTC(+dmy[3],month-1,day);const d=new Date(n);return d.getUTCDate()===day&&d.getUTCMonth()===month-1?n:null;}
  const n=Date.parse(s);return Number.isFinite(n)?n:null;
}
const monthNames='jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?';
const monthNumber=name=>['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(name.toLowerCase().slice(0,3))+1;
const rangeJoin='(?:&|and|to|through|until|[-–—])';
const dayPart='\\d{1,2}(?:st|nd|rd|th)?';
const endpoint='(?:\\d{4}[-/]\\d{1,2}[-/]\\d{1,2}|\\d{1,2}[/.\\-]\\d{1,2}(?:[/.\\-]\\d{4})?|'+dayPart+'\\s*(?:'+monthNames+')(?:\\s*,?\\s*\\d{4})?|(?:'+monthNames+')\\s*'+dayPart+'(?:\\s*,?\\s*\\d{4})?)';
function dateParts(text) {
  let m=/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(text);
  if(m)return {year:+m[1],month:+m[2],day:+m[3]};
  m=/^(\d{1,2})[/.\-](\d{1,2})(?:[/.\-](\d{4}))?$/.exec(text);
  if(m){if(+m[1]<=12&&+m[2]<=12&&+m[1]!==+m[2])return {error:'Numeric dates are ambiguous. Use a month name or YYYY-MM-DD.'};return {year:m[3]?+m[3]:null,month:+m[2],day:+m[1]};}
  m=new RegExp('^('+dayPart+')\\s*('+monthNames+')(?:\\s*,?\\s*(\\d{4}))?$','i').exec(text);
  if(m)return {day:parseInt(m[1],10),month:monthNumber(m[2]),year:m[3]?+m[3]:null};
  m=new RegExp('^('+monthNames+')\\s*('+dayPart+')(?:\\s*,?\\s*(\\d{4}))?$','i').exec(text);
  return m?{month:monthNumber(m[1]),day:parseInt(m[2],10),year:m[3]?+m[3]:null}:null;
}
function reportYear(data) {
  const scopeYears=[...new Set(String(data.reportMonth||data.scope||'').match(/\b(?:19|20)\d{2}\b/g)||[])];
  if(scopeYears.length===1)return +scopeYears[0];
  if(scopeYears.length>1)return null;
  const years=new Set();
  for(const ds of data.datasets||[])if(ds.latest)for(const row of ds.rows){const date=dateRank(row[ds.latest.field]);if(date!=null)years.add(new Date(date+6*3600000).getUTCFullYear());}
  return years.size===1?[...years][0]:null;
}
export function parseDateWindow(question,data) {
  const q=String(question), flags='i';
  let match=new RegExp('\\b('+endpoint+')\\s*'+rangeJoin+'\\s*('+endpoint+')\\b',flags).exec(q),start,end;
  if(match){start=dateParts(match[1]);end=dateParts(match[2]);}
  if(!match){
    match=new RegExp('\\b('+dayPart+')\\s*'+rangeJoin+'\\s*('+dayPart+')\\s*('+monthNames+')(?:\\s*,?\\s*(\\d{4}))?\\b',flags).exec(q);
    if(match){start={day:parseInt(match[1],10),month:monthNumber(match[3]),year:match[4]?+match[4]:null};end={...start,day:parseInt(match[2],10)};}
  }
  if(!match){
    match=new RegExp('\\b('+monthNames+')\\s*('+dayPart+')\\s*'+rangeJoin+'\\s*('+dayPart+')(?:\\s*,?\\s*(\\d{4}))?\\b',flags).exec(q);
    if(match){start={month:monthNumber(match[1]),day:parseInt(match[2],10),year:match[4]?+match[4]:null};end={...start,day:parseInt(match[3],10)};}
  }
  const rangeIntent=/\bbetween\s+(?:\d|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)|\bfrom\s+\d/i.test(q);
  if(!match&&rangeIntent)return {error:'I could not verify the requested date range. Use, for example, 1 October 2026 to 3 October 2026.'};
  if(!match){
    match=new RegExp('\\b('+endpoint+')\\b',flags).exec(q);
    if(match)start=end=dateParts(match[1]);
  }
  if(!match)return /\b(?:on|dated|during)\s+\d/i.test(q)?{error:'I could not verify the requested date. Use a month name or YYYY-MM-DD.'}:null;
  const remainder=q.slice(0,match.index)+' '+q.slice(match.index+match[0].length);
  if(new RegExp('\\b('+endpoint+')\\b',flags).test(remainder)||/\b(?:before|after|since|except|excluding)\b/i.test(remainder))return {error:'Please specify one inclusive date range using a start date and end date. I will not ignore additional dates or date exclusions.'};
  if(start?.error||end?.error)return {error:start?.error||end.error};
  if(!start||!end)return {error:'I could not verify the requested date range.'};
  const implicitYear=!start.year&&!end.year,year=start.year||end.year||reportYear(data);
  if(!year)return {error:'Please include the year in your requested dates; this backend scope does not identify one report year.'};
  start={...start,year:start.year||year};end={...end,year:end.year||year};
  const dayNumber=parts=>{const n=Date.UTC(parts.year,parts.month-1,parts.day),d=new Date(n);return d.getUTCFullYear()===parts.year&&d.getUTCMonth()===parts.month-1&&d.getUTCDate()===parts.day?n/86400000:null;};
  const startDay=dayNumber(start),endDay=dayNumber(end);
  if(startDay==null||endDay==null)return {error:'The requested dates are not valid calendar dates. Please correct the day, month or year.'};
  if(startDay>endDay)return {error:'The start date is after the end date. Please specify the dates in order, including both years if the range crosses a year.'};
  const iso=day=>new Date(day*86400000).toISOString().slice(0,10);
  return {start:iso(startDay),end:iso(endDay),startDay,endDay,implicitYear,label:dateText(startDay*86400000)+' to '+dateText(endDay*86400000)+' (inclusive)',question:remainder};
}
function columns(dataset) {
  const supplied=dataset.columns||[];
  const keys=new Set(supplied.map(c=>typeof c==='string'?c:c.key));
  for(const row of dataset.rows)for(const key of Object.keys(row||{}))if(!unsafe.test(key)&&['string','number','boolean'].includes(typeof row[key]))keys.add(key);
  return [...keys].filter(k=>!unsafe.test(k)).map(key=>{
    const known=supplied.find(c=>(typeof c==='string'?c:c.key)===key);
    return typeof known==='object'?known:{key,label:label(key)};
  });
}
function score(q, text) {
  const a=new Set(tokens(q)), b=tokens(text);
  return b.reduce((n,w)=>n+(a.has(w)||a.has(w+'s')?2:0),0);
}
function entities(question, datasets) {
  const q=' '+normal(question)+' ', relevant=new Set(tokens(question).filter(w=>!ignored.has(w)&&w.length>2)), result=[], fields=[];
  for(const ds of datasets) {
    const keys=ds.identity||columns(ds).map(c=>c.key).filter(k=>identities.test(k));
    for(const field of keys){
      const values=[...new Set(ds.rows.map(row=>row[field]).filter(v=>v!=null&&['string','number'].includes(typeof v)).map(String).filter(v=>normal(v).length>2))];
      const exact=values.filter(v=>q.includes(' '+normal(v)+' '));
      fields.push({dataset:ds.id,field,values,exact});
      if(exact.length)result.push({dataset:ds.id,field,values:exact,partial:false});
    }
  }
  // A word used in an exact name is not a second, partial outlet filter.
  const consumed=new Set(result.flatMap(s=>s.values.flatMap(tokens)));
  for(const word of consumed)relevant.delete(word);
  const partials=fields.filter(f=>!f.exact.length).map(f=>({...f,values:f.values.filter(v=>tokens(v).some(w=>relevant.has(w)))})).filter(f=>f.values.length);
  const personField=field=>/officer|leader|rho|zonal/i.test(field);
  const asksPerson=latest(question)||/\b(?:visits?|visited|assessments?|assessed|officer|leader|rho|zonal|performance|pending|completed)\b/i.test(question);
  const personWords=new Set(asksPerson?partials.filter(f=>personField(f.field)).flatMap(f=>f.values.flatMap(tokens).filter(w=>relevant.has(w))):[]);
  for(const f of partials){
    const hits=personField(f.field)?f.values:f.values.filter(v=>tokens(v).some(w=>relevant.has(w)&&!personWords.has(w)));
    if(hits.length)result.push({dataset:f.dataset,field:f.field,values:hits,partial:true});
  }
  return result;
}
function matched(ds, selections) {
  const terms=selections.filter(x=>x.dataset===ds.id);
  return ds.rows.filter(row=>terms.every(t=>t.values.includes(String(row[t.field]))));
}
function rowLine(row, cols, keys) {
  const allowed=keys?cols.filter(c=>keys.includes(c.key)):cols;
  return allowed.filter(c=>row[c.key]!=null&&row[c.key]!=='').slice(0,12).map(c=>c.label+': '+fmt(row[c.key])+(c.unit?' '+c.unit:'')).join(' · ');
}
function sourceNote(data, count, matchedCount) {
  const at=data.snapshot?new Date(data.snapshot):null;
  const snapshot=at&&Number.isFinite(at.getTime())?at.toLocaleString('en-GB',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Dhaka'})+' GMT+6':data.snapshot||'not supplied';
  return '\n\nSource: '+data.source+' · Snapshot: '+snapshot+'.\n'+count.toLocaleString('en-GB')+' backend records queried'+(matchedCount!=null?' · '+matchedCount.toLocaleString('en-GB')+' matched':'')+'. Scope: '+(data.scope||'published dashboard data')+'.';
}
function evidence(data, selections) {
  return {dashboardId:data.id,source:data.source,snapshot:data.snapshot,scope:data.scope,...(data.requestedDateRange?{requestedDateRange:data.requestedDateRange}:{}),coverage:'Queries run over every row in the stated backend scope before selecting evidence. No visible-row or pagination limit is used.',facts:data.facts||[],datasets:data.datasets.map(ds=>{const cols=columns(ds);return {id:ds.id,title:ds.title,...(ds.sourceRows!=null?{sourceRows:ds.sourceRows}:{}),totalRows:ds.rows.length,matchedRows:matched(ds,selections).length,columns:cols,rows:matched(ds,selections).slice(0,6).map(row=>Object.fromEntries(cols.filter(c=>['string','number','boolean'].includes(typeof row[c.key])).map(c=>[c.key,row[c.key]])))};})};
}
export async function queryBackend(question, provider, options={}) {
  if(!provider||typeof provider.read!=='function')throw Error('This dashboard data connection is not installed yet. Reload after uploading its dashboard patch.');
  const loaded=await provider.read({question,signal:options.signal,global:/\b(?:unfiltered|entire|whole|all data|all outlets|overall)\b/i.test(question)});
  if(options.signal?.aborted)throw Error('Stopped');
  if(!loaded||!Array.isArray(loaded.datasets)||loaded.ready===false)throw Error('The dashboard backend data has not loaded yet.');
  let data={...loaded,datasets:loaded.datasets.filter(ds=>Array.isArray(ds.rows)).map(ds=>({...ds,rows:ds.rows.filter(r=>r&&typeof r==='object'&&!Array.isArray(r))}))};
  const window=parseDateWindow(question,data), searchQuestion=window?.question||question;
  const selections=entities(searchQuestion,data.datasets), count=data.datasets.reduce((n,d)=>n+d.rows.length,0);
  let context=evidence(data,selections);
  const result=(answer,n)=>({answer:answer+sourceNote(data,count,n),context,source:data.source,recordsScanned:count,matchedRows:n,verified:true});
  if(window?.error)return result(window.error,0);
  if(/\b(?:snapshot|refreshed|updated|freshness)\b|স্ন্যাপ|আপডেট/i.test(question))return result('Backend snapshot: '+(data.snapshot||'time not supplied')+'.');
  if(!window&&/\b(?:filters?|selected|selection|scope|date range|period)\b|ফিল্টার/i.test(question)&&!latest(question))return result('Backend query scope: '+(data.scope||'published dashboard data')+'.\n'+(data.filters||[]).map(f=>f.label+': '+f.value).join('\n'));
  const ambiguous=selections.find(s=>s.partial&&/officer/i.test(s.field)&&new Set(s.values.map(normal)).size>1);
  if(ambiguous)return result('More than one officer matches. Please specify the full name:\n'+ambiguous.values.join('\n'));
  const code=question.match(/\b[A-Za-z]{1,2}\d{2,5}\b/)?.[0]?.toUpperCase();
  if(code&&!selections.some(s=>s.values.some(v=>normal(v)===normal(code))))return result('No backend record for '+code+' was found in this scope.',0);
  if(window){
    const candidates=data.datasets.filter(ds=>ds.latest?.field);
    if(!candidates.length)return result('I cannot verify records for '+window.label+': this backend supplies no dated event history. An outlet’s latest-visit summary cannot establish its visits in an earlier date range.',0);
    if(!selections.length){
      const vocabulary=new Set([...ignored,...tokens('list between from at on during dates date range through until did does do has have had their his her actual completed recorded response responses event transaction transactions done count number by'),...tokens(data.source+' '+data.scope),...data.datasets.flatMap(ds=>tokens(ds.title+' '+columns(ds).map(c=>c.label||c.key).join(' ')))]);
      if(tokens(searchQuestion).some(word=>word.length>2&&!vocabulary.has(word)))return result('I cannot match the requested name or condition to a backend field. Specify the full officer name or outlet code; I will not substitute another person’s dated records.',0);
    }
    candidates.sort((a,b)=>(score(searchQuestion,b.title)+(selections.some(s=>s.dataset===b.id)?10:0))-(score(searchQuestion,a.title)+(selections.some(s=>s.dataset===a.id)?10:0)));
    const ds=candidates[0], rows=ds.rows.filter(row=>{const date=dateRank(row[ds.latest.field]);return date!=null&&eventDay(date)>=window.startDay&&eventDay(date)<=window.endDay;});
    data={...data,datasets:[{...ds,rows,sourceRows:ds.rows.length}],facts:[],requestedDateRange:{start:window.start,end:window.end,inclusive:true,timeZone:'Asia/Dhaka',dateField:ds.latest.field},scope:(data.scope||'published dashboard data')+'; requested actual event dates '+window.label+' in GMT+6'+(window.implicitYear?'; omitted year taken from the backend report context':''),filters:[...(data.filters||[]),{label:'Requested actual event dates',value:window.label}]};
    context=evidence(data,selections);
  }
  if(latest(question)) {
    const candidates=data.datasets.filter(ds=>ds.latest);
    if(!candidates.length)return result('I cannot verify a latest visit or transaction: this backend dataset does not supply an event date.');
    if(!selections.length){
      const vocabulary=new Set([...ignored,...tokens('did does do has have had their his her from at on actual completed recorded response event transaction transactions done'),...tokens(window?'list between during dates date range through until':''),...tokens(data.source+' '+data.scope),...data.datasets.flatMap(ds=>tokens(ds.title+' '+columns(ds).map(c=>c.label||c.key).join(' ')))]);
      if(tokens(searchQuestion).some(word=>word.length>2&&!vocabulary.has(word)))return result('I cannot match the requested name or condition to a backend field. Specify the full officer name or outlet code; I will not substitute another person’s latest record.',0);
    }
    const ds=candidates.sort((a,b)=>score(question,b.title)-score(question,a.title))[0];
    const confirmLatest=code&&/^\s*(?:did|has|was|is)\b/i.test(question)&&/\b(?:visit|visited|assess|assessed|assessment)\b/i.test(question);
    const latestSelection=confirmLatest?selections.filter(s=>!/(?:code|Site Code)/i.test(s.field)):selections;
    const rows=matched(ds,latestSelection).map(row=>({row,date:dateRank(row[ds.latest.field])})).filter(r=>r.date!=null);
    if(!rows.length)return result('No dated completed visit or assessment matches this request in the backend records.',0);
    const max=rows.reduce((n,r)=>Math.max(n,r.date),-Infinity);
    const day=eventDay(max), dayRows=rows.filter(r=>eventDay(r.date)===day);
    const timestampsComplete=dayRows.every(r=>hasEventTime(r.row[ds.latest.field]));
    const final=timestampsComplete?dayRows.filter(r=>r.date===max):dayRows;
    const unique=[...new Map(final.map(r=>[JSON.stringify(r.row),r.row])).values()];
    const cols=columns(ds), keys=ds.latest.display||cols.map(c=>c.key);
    const title=unique.length===1?'Latest recorded '+(ds.latest.label||'event')+': '+dateText(max)+'.':'Latest recorded '+(ds.latest.label||'event')+' date: '+dateText(max)+'. '+unique.length+' records share that date.';
    const uncertainty=unique.length>1&&!timestampsComplete?'\nThe backend has no complete event timestamps for these records, so I cannot determine one last outlet from their order or response IDs. Attendance punch times are shown as recorded; they are not substituted for assessment timestamps.':'';
    const codeFields=cols.filter(c=>/(?:outlet.?code|site code|^code$)/i.test(c.key));
    const includesCode=unique.some(row=>codeFields.some(c=>normal(row[c.key])===normal(code)));
    const confirmation=confirmLatest?(includesCode?(unique.length===1?'Yes. ':'The requested outlet shares the latest date; one last outlet cannot be confirmed. '):'No. '+code+' is not among the latest recorded visits. '):'';
    return result(confirmation+title+'\n'+unique.slice(0,12).map(row=>rowLine(row,cols,keys)).join('\n')+(unique.length>12?'\nShowing 12 of '+unique.length+' latest-date records.':'')+uncertainty,rows.length);
  }
  if(window){
    const ds=data.datasets[0], rows=matched(ds,selections).sort((a,b)=>dateRank(a[ds.latest.field])-dateRank(b[ds.latest.field]));
    if(!rows.length)return result('No dated '+(ds.latest.label||'event')+' records match '+window.label+' in the available backend scope. Planned dates and outlet latest-visit summaries are not used as completed event dates.',0);
    if(explain(question))return {answer:null,context,source:data.source,recordsScanned:count,matchedRows:rows.length,verified:true,allowAI:true};
    const cols=columns(ds), keys=ds.latest.display||cols.map(c=>c.key);
    const header=ds.title+' — '+window.label+': '+rows.length+' recorded '+(ds.latest.label||'event')+' record'+(rows.length===1?'':'s')+'.';
    if(/\b(?:how many|count|number of)\b/i.test(question)&&/\b(?:visits?|assessments?|responses?|records?|transactions?|exceptions?)\b/i.test(question))return result(header+'\nThis counts recorded backend responses in the requested dates; it does not substitute the dashboard’s whole-period KPI.',rows.length);
    const wanted=Number(searchQuestion.match(/\b(?:list|show)\s+(\d{1,2})\b/i)?.[1]||20),limit=Math.min(20,Math.max(1,wanted));
    return result(header+'\n'+rows.slice(0,limit).map(row=>rowLine(row,cols,keys)).join('\n')+(rows.length>limit?'\nShowing '+limit+' of '+rows.length+' matching dated records; the search used all backend rows.':''),rows.length);
  }
  const scoped=data.datasets.map(ds=>{
    const rows=matched(ds,selections);
    const metricScore=Math.max(0,...columns(ds).filter(c=>rows.some(r=>number(r[c.key]))).map(c=>score(question,(c.label||c.key)+' '+(c.aliases||[]).join(' '))));
    return {ds,rows,weight:score(question,ds.title)+metricScore*2+(selections.some(s=>s.dataset===ds.id)?10:0)};
  });
  const facts=(data.facts||[]).map(f=>({...f,score:score(question,f.label)})).filter(f=>f.score>0).sort((a,b)=>b.score-a.score);
  const hasEntity=selections.some(s=>/officer|code|name|RHO|Zonal|leader|division|district/i.test(s.field));
  if(!hasEntity&&!explain(question)&&/\b(?:summary|overview|kpis|figures|numbers)\b/i.test(question)&&(data.facts||[]).length)return result(data.facts.map(f=>f.label+': '+fmt(f.value)+(f.unit?' '+f.unit:'')).join('\n'));
  const asksList=/\b(?:list|show)\b/i.test(question)&&/\b(?:links|dashboards|outlets|banks|channels|records)\b/i.test(question);
  if(!hasEntity&&facts.length&&!explain(question)&&!asksList&&!/\b(?:highest|lowest|top|bottom|largest|smallest)\b/i.test(question))return result(facts.filter(f=>f.score===facts[0].score).map(f=>f.label+': '+fmt(f.value)+(f.unit?' '+f.unit:'')).join('\n'));
  if(explain(question))return {answer:null,context,source:data.source,recordsScanned:count,verified:true,allowAI:true};
  const matching=scoped.filter(x=>x.rows.length).sort((a,b)=>b.weight-a.weight);
  if(!matching.length)return result('No backend record matches the requested name or code.',0);
  if(!hasEntity&&!/\b(?:summary|overview|list|show|records|outlets|banks|channels|kpis|figures|numbers|highest|lowest|top|bottom)\b/i.test(question))return result('I cannot verify that fact from the available backend fields. Specify an outlet code, full officer/leader name, metric, or latest visit.');
  const selected=matching[0],cols=columns(selected.ds);
  const metrics=cols.map(c=>({...c,score:score(question,(c.label||c.key)+' '+(c.aliases||[]).join(' '))})).filter(c=>c.score>0&&selected.rows.some(r=>number(r[c.key]))).sort((a,b)=>b.score-a.score);
  const ranked=/\b(?:highest|lowest|top|bottom|largest|smallest)\b/i.test(question);
  let rows=[...selected.rows];
  if(ranked){if(!metrics.length)return result('Please specify which backend metric to rank.',rows.length);const low=/\b(?:lowest|bottom|smallest)\b/i.test(question);rows.sort((a,b)=>!number(a[metrics[0].key])?1:!number(b[metrics[0].key])?-1:(a[metrics[0].key]-b[metrics[0].key])*(low?1:-1));}
  const wanted=Number(question.match(/\b(?:top|bottom|list|show)\s+(\d{1,2})\b/i)?.[1]||8),limit=Math.min(20,Math.max(1,wanted));
  const ids=cols.filter(c=>/code|name|officer|RHO|Zonal|leader|date|month|bank/i.test(c.key));
  const chosen=metrics.length?[...new Set([...ids.map(c=>c.key),...metrics.filter(c=>c.score===metrics[0].score).map(c=>c.key)])]:null;
  return result(selected.ds.title+':\n'+rows.slice(0,limit).map(row=>rowLine(row,cols,chosen)).join('\n')+(rows.length>limit?'\nShowing '+limit+' of '+rows.length+' matching backend records; the search used all rows.':''),rows.length);
}
export function groundedExplanation(reply, context) {
  const s=String(reply||'').trim();if(!s)return false;
  const source=JSON.stringify(context).toLowerCase();
  // A generated explanation cannot introduce outlet codes, numbers or dates.
  const identifiers=s.match(/\b[A-Za-z]{1,2}\d{2,5}\b|\b\d+(?:[,.:/-]\d+)*%?/g)||[];
  for(const value of identifiers)if(!source.includes(value.toLowerCase())&&!source.includes(value.replaceAll(',','').toLowerCase()))return false;
  if(/\b(?:last|latest|most recent)\s+(?:visit|assessment|outlet)|\b(?:visited|assessed)\s+on\b/i.test(s))return false;
  return true;
}
if(typeof window!=='undefined')window.ShwapnoBackendQueries=Object.freeze({queryBackend,groundedExplanation});

