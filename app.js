const RAW = window.QUESTION_BANK || [];
const state = JSON.parse(localStorage.getItem('beTrainerStateV2') || '{}');
state.ratings ||= {}; state.history ||= []; state.answers ||= {};
let currentList=[], currentIndex=0, examMode=false, examType='oral', timerHandle=null, seconds=0;
const $=s=>document.querySelector(s);

// Offensichtlich beim PDF-Import getrennte Fragmente werden wieder zu Prüfungskomplexen verbunden.
const MERGES = [
 ['o11','o12'],['o46','o47'],['o48','o49','o50'],['o85','o86'],['o94','o95'],['o97','o98','o99'],['o103','o104'],['o110','o111'],
 ['o114','o115'],['o131','o132'],['o136','o137'],['o152','o153'],['o156','o157'],['o171','o172'],
 ['o177','o178','o179'],['o180','o181','o182'],['o187','o188'],['o195','o196'],['o198','o199','o200','o201'],['o202','o203'],['o204','o205'],['o211','o212'],['o218','o219'],['o259','o260']
];
function repairBank(raw){
 const byId=Object.fromEntries(raw.map(x=>[x.id,{...x}])); const consumed=new Set(); const out=[];
 const mergeMap=new Map(); MERGES.forEach(g=>g.forEach(id=>mergeMap.set(id,g)));
 for(const q of raw){
   if(consumed.has(q.id)) continue;
   const group=mergeMap.get(q.id);
   if(!group){out.push({...q});continue}
   const items=group.map(id=>byId[id]).filter(Boolean); items.forEach(x=>consumed.add(x.id));
   const first=items[0];
   out.push({...first,id:'grp-'+group.join('-'),question:first.question,subquestions:items.slice(1).map(x=>x.question).filter(Boolean),answer:items.flatMap(x=>x.answer||[]),merged:true});
 }
 return out;
}
const Q=repairBank(RAW);
const modes={oral:'Mündlich',written:'Schriftlich'};
const oralCategories=['Technik','Recht','Pädagogik','Fahrlehrerrecht'];
const navItems=[['dashboard','Übersicht'],['learnOral','Lernen · mündlich'],['learnWritten','Lernen · schriftlich'],['examOral','Simulation · mündlich'],['examWritten','Simulation · schriftlich'],['weak','Schwächen'],['history','Verlauf']];
$('#nav').innerHTML=navItems.map(([id,n],i)=>`<button class="nav-btn ${i===0?'active':''}" data-view="${id}">${n}</button>`).join('');

function save(){localStorage.setItem('beTrainerStateV2',JSON.stringify(state));updateStats()}
function rating(id){return state.ratings[id]||'open'}
function updateStats(){const known=Q.filter(q=>rating(q.id)==='known').length,unsure=Q.filter(q=>rating(q.id)==='unsure').length,open=Q.length-known-unsure,pct=Q.length?Math.round(known/Q.length*100):0;$('#progressPct').textContent=pct+'%';$('.ring').style.setProperty('--p',pct+'%');$('#knownCount').textContent=known;$('#unsureCount').textContent=unsure;$('#openCount').textContent=open}
function categoriesFor(mode){return mode==='oral'?oralCategories:['Schriftlich BE']}
function fillCategories(){const mode=$('#modeSelect').value;$('#categorySelect').innerHTML=['Alle',...categoriesFor(mode)].map(c=>`<option>${c}</option>`).join('')}
function setMode(mode){$('#modeSelect').value=mode;fillCategories()}
function setView(v){
 document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.view===v));
 ['dashboard','trainer','examSetup','history'].forEach(id=>$('#'+id).classList.add('hidden'));
 if(v==='dashboard'){renderDashboard();$('#dashboard').classList.remove('hidden')}
 if(v==='learnOral'){setMode('oral');startFiltered();$('#trainer').classList.remove('hidden')}
 if(v==='learnWritten'){setMode('written');startFiltered();$('#trainer').classList.remove('hidden')}
 if(v==='weak'){currentList=Q.filter(q=>rating(q.id)!=='known');shuffle(currentList);currentIndex=0;examMode=false;showQuestion();$('#trainer').classList.remove('hidden')}
 if(v==='examOral'){renderExamSetup('oral');$('#examSetup').classList.remove('hidden')}
 if(v==='examWritten'){renderExamSetup('written');$('#examSetup').classList.remove('hidden')}
 if(v==='history'){renderHistory();$('#history').classList.remove('hidden')}
}
function renderDashboard(){
 const known=Q.filter(q=>rating(q.id)==='known').length;
 const groups=[...oralCategories,'Schriftlich BE'];
 const rows=groups.map(c=>{const a=Q.filter(q=>q.category===c),k=a.filter(q=>rating(q.id)==='known').length,p=a.length?Math.round(k/a.length*100):0;return `<div class="category-row"><strong>${c}</strong><div class="bar"><span style="width:${p}%"></span></div><span>${p}%</span></div>`}).join('');
 $('#dashboard').innerHTML=`<h2>Lernstand</h2><div class="grid"><div class="card"><div class="muted">Fragen gesamt</div><div class="big">${Q.length}</div></div><div class="card"><div class="muted">Sicher beantwortet</div><div class="big">${known}</div></div><div class="card"><div class="muted">Prüfungsreife</div><div class="big">${Math.round(known/Q.length*100)}%</div></div></div><div class="category-list">${rows}</div>`
}
function filters(){const mode=$('#modeSelect').value,c=$('#categorySelect').value,s=$('#statusSelect').value,term=$('#searchInput').value.toLowerCase();return Q.filter(q=>q.mode===mode&&(c==='Alle'||q.category===c)&&(s==='all'||rating(q.id)===s)&&(!term||JSON.stringify(q).toLowerCase().includes(term)))}
function startFiltered(){currentList=filters();if(!currentList.length){alert('Keine passenden Fragen gefunden.');return}currentIndex=0;examMode=false;showQuestion()}
function answerKey(q){return examMode?`exam-${examType}-${q.id}`:q.id}
function showQuestion(){
 clearInterval(timerHandle);seconds=0;$('#timer').textContent='';const q=currentList[currentIndex];if(!q){setView('dashboard');return}
 $('#modeBadge').textContent=modes[q.mode];$('#categoryBadge').textContent=q.category;$('#counter').textContent=`${currentIndex+1} / ${currentList.length}`;$('#questionTitle').textContent=q.question;$('#questionContext').textContent=q.context||'';$('#subquestions').innerHTML=(q.subquestions||[]).map(x=>`<li>${x}</li>`).join('');
 $('#answerInput').value=state.answers[answerKey(q)]||'';$('#solution').classList.add('hidden');$('#evaluation').classList.add('hidden');$('#rating').classList.add('hidden');$('#evaluateBtn').disabled=!$('#answerInput').value.trim();$('#prevBtn').disabled=currentIndex===0;$('#nextBtn').disabled=currentIndex>=currentList.length-1;
 if(examMode){timerHandle=setInterval(()=>{seconds++;$('#timer').textContent=`Zeit: ${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`},1000)}
}
function showSolution(){const q=currentList[currentIndex],title=q.solutionType||'Musterlösung / Erwartungshorizont';$('#solution').innerHTML=`<strong>${title}</strong><ol class="solution-list">${(q.answer||[]).map(a=>`<li>${escapeHtml(a)}</li>`).join('')}</ol><p class="solution-note">Die Musterlösung ist ein lernorientierter Erwartungshorizont. Bei Rechtsfragen gilt der Rechtsstand am Prüfungstag.</p>`;$('#solution').classList.remove('hidden');$('#rating').classList.remove('hidden')}

const STOP=new Set('der die das den dem des ein eine einer eines und oder sowie ist sind wird werden mit von zu zum zur im in auf für bei als auch sich dass diese dieser dieses durch aus an am es er sie man was welche welcher welchen welchem wie wo warum wann nicht mehr kann können muss müssen soll sollen über unter vor nach zwischen beim bzw ggf z b'.split(' '));
const SYN={
 'geschwindigkeit':['tempo'], 'fahrzeug':['kfz','pkw','auto'], 'fahrschüler':['fs','schüler'], 'fahrerlaubnis':['fe'], 'führerschein':['fs'], 'ordnungswidrigkeit':['owi'], 'straßenverkehrsordnung':['stvo'], 'straßenverkehrsgesetz':['stvg'], 'strafgesetzbuch':['stgb'], 'fahrschülerausbildungsordnung':['fahrschausbO','fahrschausbo'], 'bremsweg':['bremsstrecke'], 'reaktionsweg':['reaktionsstrecke'], 'umweltbewusst':['umweltschonend'], 'verantwortungsvoll':['verantwortlich']
};
function norm(s){return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ß/g,'ss').replace(/[^a-z0-9§.%]+/g,' ').trim()}
function stem(w){return w.replace(/(ungen|ung|keiten|keit|heiten|heit|ischen|ischer|ische|lich|igen|ige|iger|en|er|e|s)$/,'')}
function concepts(q){
 const all=[];(q.answer||[]).forEach((line,idx)=>{let words=norm(line).split(/\s+/).filter(w=>w.length>=4&&!STOP.has(w));words=[...new Set(words.map(stem).filter(w=>w.length>=3))];if(words.length){all.push({label:line,terms:words.slice(0,Math.min(4,words.length)),required:idx<12})}});return all.slice(0,18)
}
function hasTerm(text,t){const n=norm(text),st=stem(t);if(n.includes(t)||n.split(/\s+/).map(stem).includes(st))return true;for(const [k,alts] of Object.entries(SYN)){const kk=stem(norm(k));if(st===kk&&alts.some(a=>n.includes(norm(a))))return true;if(alts.map(a=>stem(norm(a))).includes(st)&&n.includes(norm(k)))return true}return false}
function evaluate(){
 const q=currentList[currentIndex],ans=$('#answerInput').value.trim();if(!ans)return;
 state.answers[answerKey(q)]=ans;
 const cs=concepts(q);const results=cs.map(c=>({...c,matched:c.terms.some(t=>hasTerm(ans,t))}));const matched=results.filter(r=>r.matched).length,total=Math.max(1,results.length),pct=Math.round(matched/total*100);
 let grade=pct>=92?'1 (sehr gut)':pct>=81?'2 (gut)':pct>=67?'3 (befriedigend)':pct>=50?'4 (ausreichend)':pct>=30?'5 (mangelhaft)':'6 (ungenügend)';
 const missing=results.filter(r=>!r.matched).slice(0,10);const found=results.filter(r=>r.matched).slice(0,10);
 $('#evaluation').innerHTML=`<div class="eval-head"><div><span class="muted">Automatische Stichwortprüfung</span><div class="grade">Note ${grade}</div></div><div class="score-circle">${pct}%</div></div><p><strong>${matched} von ${total}</strong> erwarteten Kernaspekten erkannt.</p>${found.length?`<div class="match-box good"><strong>Erkannt:</strong> ${found.map(x=>escapeHtml(shortLabel(x.label))).join(' · ')}</div>`:''}${missing.length?`<div class="match-box bad"><strong>Fehlende/anders formulierte Kernaspekte:</strong><ul>${missing.map(x=>`<li>${escapeHtml(shortLabel(x.label))}</li>`).join('')}</ul></div>`:''}<p class="solution-note">Die Auswertung erkennt Stichwörter und häufige Synonyme. Inhaltlich richtige, stark abweichend formulierte Antworten können zu niedrig bewertet werden. Die Musterlösung bleibt der verbindliche Vergleich.</p>`;
 $('#evaluation').classList.remove('hidden');$('#rating').classList.remove('hidden');state.lastEvaluation={id:q.id,pct,grade};save()
}
function shortLabel(s){return s.length>90?s.slice(0,87)+'…':s}
function escapeHtml(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
function move(delta){const ni=currentIndex+delta;if(ni<0||ni>=currentList.length)return;persistAnswer();currentIndex=ni;showQuestion()}
function persistAnswer(){const q=currentList[currentIndex];if(q)state.answers[answerKey(q)]=$('#answerInput').value;save()}
function skip(){persistAnswer();if(currentIndex<currentList.length-1)move(1);else if(examMode)finishExam()}
function finishExam(){clearInterval(timerHandle);persistAnswer();const scores=currentList.map(q=>{const ans=state.answers[`exam-${examType}-${q.id}`]||'';const cs=concepts(q);return cs.length?Math.round(cs.filter(c=>c.terms.some(t=>hasTerm(ans,t))).length/cs.length*100):0});const avg=Math.round(scores.reduce((a,b)=>a+b,0)/Math.max(1,scores.length));const grade=avg>=92?'1':avg>=81?'2':avg>=67?'3':avg>=50?'4':avg>=30?'5':'6';state.history.unshift({date:new Date().toLocaleString('de-DE'),type:modes[examType],total:currentList.length,score:avg,grade});state.history=state.history.slice(0,30);save();alert(`Simulation beendet: ${avg}% – Note ${grade}`);setView('dashboard')}
function writtenBlock(q){const m=q.question.match(/^BE-(\d)/);return m?Number(m[1]):0}
function pickOne(arr){return arr[Math.floor(Math.random()*arr.length)]}
function buildWrittenExam(){
 const written=Q.filter(q=>q.mode==='written');const groups={1:[],2:[],3:[],ped:[]};written.forEach(q=>{const b=writtenBlock(q);if(b===1)groups[1].push(q);else if(b===2)groups[2].push(q);else if(b===3)groups[3].push(q);else if([4,5,6].includes(b))groups.ped.push(q)});
 const selected=[pickOne(groups[1]),pickOne(groups[2]),pickOne(groups[3])];shuffle(groups.ped);selected.push(...groups.ped.slice(0,2));return shuffle(selected.filter(Boolean))
}
function buildOralExam(){let out=[];oralCategories.forEach(c=>{const a=shuffle(Q.filter(q=>q.mode==='oral'&&q.category===c).slice());out.push(...a.slice(0,2))});return shuffle(out)}
function renderExamSetup(type){examType=type;const isWritten=type==='written';$('#examSetup').innerHTML=`<h2>${isWritten?'Schriftliche':'Mündliche'} Prüfungssimulation</h2><p class="muted">${isWritten?'5 Aufgaben: eine aus Verkehrsverhalten, eine aus Recht, eine aus Technik und zwei aus Pädagogik/Fahrlehrerwesen.':'8 Prüfungskomplexe: je zwei aus Technik, Recht, Pädagogik und Fahrlehrerrecht.'}</p><div class="notice">Antworten werden nach zwingenden Kernbegriffen der Musterlösung ausgewertet. Danach erhalten Sie Prozentwert und Note.</div><button id="startExam" style="margin-top:16px">Simulation starten</button>`;$('#startExam').onclick=()=>{currentList=isWritten?buildWrittenExam():buildOralExam();currentIndex=0;examMode=true;$('#examSetup').classList.add('hidden');$('#trainer').classList.remove('hidden');showQuestion()}}
function renderHistory(){const h=state.history||[];$('#history').innerHTML='<h2>Prüfungsverlauf</h2>'+(h.length?h.map(x=>`<div class="history-item"><strong>${x.date} · ${x.type||'Prüfung'}</strong><div>${x.score??0}% · Note ${x.grade??'-'} · ${x.total} Aufgaben</div></div>`).join(''):'<p class="muted">Noch keine Simulation abgeschlossen.</p>')}
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}

document.querySelectorAll('.nav-btn').forEach(b=>b.onclick=()=>setView(b.dataset.view));
$('#modeSelect').onchange=()=>{fillCategories();if(!$('#trainer').classList.contains('hidden')&&!examMode)startFiltered()};
['categorySelect','statusSelect'].forEach(id=>$('#'+id).onchange=()=>{if(!$('#trainer').classList.contains('hidden')&&!examMode)startFiltered()});
$('#searchInput').oninput=()=>{};
$('#randomBtn').onclick=()=>{const mode=$('#modeSelect').value,a=Q.filter(q=>q.mode===mode);currentList=[a[Math.floor(Math.random()*a.length)]];currentIndex=0;examMode=false;['dashboard','examSetup','history'].forEach(id=>$('#'+id).classList.add('hidden'));$('#trainer').classList.remove('hidden');showQuestion()};
$('#answerInput').oninput=e=>{$('#evaluateBtn').disabled=!e.target.value.trim()};
$('#evaluateBtn').onclick=evaluate;$('#showAnswerBtn').onclick=showSolution;$('#skipBtn').onclick=skip;$('#prevBtn').onclick=()=>move(-1);$('#nextBtn').onclick=()=>move(1);
$('#rating').onclick=e=>{const r=e.target.dataset.rating;if(!r)return;const q=currentList[currentIndex];state.ratings[q.id]=r;save()};
$('#resetBtn').onclick=()=>{if(confirm('Den gesamten Lernfortschritt und alle Antworten wirklich löschen?')){localStorage.removeItem('beTrainerStateV2');location.reload()}};
fillCategories();updateStats();renderDashboard();
