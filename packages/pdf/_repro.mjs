import { PDFDocument, rgb } from 'pdf-lib';
import { toPdfA } from './dist/pdfa.js';

function extractID(bytes){
  const s = Buffer.from(bytes).toString('latin1');
  const m = s.match(/\/ID\s*\[\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/);
  return m ? [m[1], m[2]] : null;
}

async function makePdf(text){
  const d = await PDFDocument.create();
  const p = d.addPage([300,300]);
  p.drawText(text, {x:20,y:150,size:12});
  return await d.save();
}

// Two genuinely-distinct documents, no title (default issued statement)
const a = await makePdf('Statement for account 111 — balance $1000');
const b = await makePdf('Statement for account 999 — balance $50000000');

const pa = await toPdfA(a, {allowNoIcc:true});
// different issue date/time to simulate real batch
const pb = await toPdfA(b, {allowNoIcc:true, date:new Date('2027-01-15T09:30:00Z')});

const ida = extractID(pa);
const idb = extractID(pb);
console.log('doc A /ID:', ida);
console.log('doc B /ID:', idb);
console.log('COLLIDE (distinct docs same ID):', JSON.stringify(ida)===JSON.stringify(idb));

// Also: two docs sharing an explicit title
const pc = await toPdfA(a, {allowNoIcc:true, title:'Monthly Statement', author:'ACME Bank'});
const pd = await toPdfA(b, {allowNoIcc:true, title:'Monthly Statement', author:'ACME Bank', date:new Date('2027-02-01T00:00:00Z')});
const idc = extractID(pc), idd = extractID(pd);
console.log('same-title A /ID:', idc, 'B /ID:', idd, 'COLLIDE:', JSON.stringify(idc)===JSON.stringify(idd));
