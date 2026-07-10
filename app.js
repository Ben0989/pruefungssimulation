const Q = window.QUESTION_BANK || [];
const categories = ['Alle', ...new Set(Q.map(q=>q.category))];
const state = JSON.parse(localStorage.getItem('beTrainerState') || '{}');
state.ratings ||= {}; state.history ||= [];
let currentList=[], currentIndex=0, examMode=false, examRemaining=0, timerHandle=null, seconds=0;

const $=s=>document.querySelector(s);
const navItems=[['dashboard','Übersicht'],['learn','Lernen'],['weak','Schwächen'],['exam','Prüfungsmodus'],['history','Verlauf']];
$('#nav').innerHTML=navItems.map(([id,n],i)=>`<button class="nav-btn ${i===0?'active':''}" data-view="${id}">${n}</button>`).join('');
$('#categorySelect').innerHTML=categories.map(c=>`<option>${c}</option>`).join('');

function save(){localStorage.setItem('beTrainerState',JSON.stringify(state)); updateStats()}
function rating(id){return state.ratings[id]||'open'}
function updateStats(){
 const known=Q.filter(q=>rating(q.id)==='known').length, unsure=Q.filter(q=>rating(q.id)==='unsure').length, open=Q.length-known-unsure;
 const pct=Math.round(known/Q.length*100); $('#progressPct').textContent=pct+'%'; $('.ring').style.setProperty('--p',pct+'%');
 $('#knownCount').textContent=known; $('#unsureCount').textContent=unsure; $('#openCount').textContent=open;
}
function setView(v){
 document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.view===v));
 ['dashboard','trainer','examSetup','history'].forEach(id=>$('#'+id).classList.add('hidden'));
 if(v==='dashboard'){renderDashboard();$('#dashboard').classList.remove('hidden')}
 if(v==='learn'){startFiltered();$('#trainer').classList.remove('hidden')}
 if(v==='weak'){currentList=Q.filter(q=>rating(q.id)!=='known');shuffle(currentList);currentIndex=0;showQuestion();$('#trainer').classList.remove('hidden')}
 if(v==='exam'){renderExamSetup();$('#examSetup').classList.remove('hidden')}
 if(v==='history'){renderHistory();$('#history').classList.remove('hidden')}
}
function renderDashboard(){
 const known=Q.filter(q=>rating(q.id)==='known').length;
 const rows=categories.slice(1).map(c=>{const a=Q.filter(q=>q.category===c),k=a.filter(q=>rating(q.id)==='known').length,p=Math.round(k/a.length*100);return `<div class="category-row"><strong>${c}</strong><div class="bar"><span style="width:${p}%"></span></div><span>${p}%</span></div>`}).join('');
 $('#dashboard').innerHTML=`<h2>Lernstand</h2><div class="grid"><div class="card"><div class="muted">Fragen gesamt</div><div class="big">${Q.length}</div></div><div class="card"><div class="muted">Sicher beantwortet</div><div class="big">${known}</div></div><div class="card"><div class="muted">Prüfungsreife</div><div class="big">${Math.round(known/Q.length*100)}%</div></div></div><div class="category-list">${rows}</div>`;
}
function filters(){
 const c=$('#categorySelect').value,s=$('#statusSelect').value,term=$('#searchInput').value.toLowerCase();
 return Q.filter(q=>(c==='Alle'||q.category===c)&&(s==='all'||rating(q.id)===s)&&(!term||JSON.stringify(q).toLowerCase().includes(term)));
}
function startFiltered(){currentList=filters(); if(!currentList.length){alert('Keine passenden Fragen gefunden.');return} currentIndex=0;examMode=false;showQuestion()}
function showQuestion(){
 clearInterval(timerHandle); seconds=0; $('#timer').textContent='';
 const q=currentList[currentIndex]; if(!q){setView('dashboard');return}
 $('#categoryBadge').textContent=q.category; $('#counter').textContent=`${currentIndex+1} / ${currentList.length}`;
 $('#questionTitle').textContent=q.question; $('#questionContext').textContent=q.context||'';
 $('#subquestions').innerHTML=(q.subquestions||[]).map(x=>`<li>${x}</li>`).join('');
 $('#answerInput').value=''; $('#solution').classList.add('hidden'); $('#rating').classList.add('hidden');
 if(examMode){timerHandle=setInterval(()=>{seconds++;$('#timer').textContent=`Zeit: ${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`},1000)}
}
function showSolution(){const q=currentList[currentIndex];const title=q.solutionType||'Musterlösung / Erwartungshorizont';$('#solution').innerHTML=`<strong>${title}</strong><ol class="solution-list">${q.answer.map(a=>`<li>${a}</li>`).join('')}</ol><p class="solution-note">Die Musterlösung ist ein lernorientierter Erwartungshorizont. Bei Rechtsfragen sind die im Prüfungszeitpunkt geltenden Vorschriften maßgeblich.</p>`;$('#solution').classList.remove('hidden');$('#rating').classList.remove('hidden')}
function next(){currentIndex++; if(examMode){examRemaining--; if(examRemaining<=0||currentIndex>=currentList.length){finishExam();return}} showQuestion()}
function finishExam(){clearInterval(timerHandle);const attempted=currentList.slice(0,currentIndex+1),known=attempted.filter(q=>rating(q.id)==='known').length;state.history.unshift({date:new Date().toLocaleString('de-DE'),total:attempted.length,known});state.history=state.history.slice(0,30);save();alert(`Prüfung beendet: ${known} von ${attempted.length} Fragen als sicher bewertet.`);setView('dashboard')}
function renderExamSetup(){
 $('#examSetup').innerHTML=`<h2>Prüfungsmodus</h2><p class="muted">Zufällige Fragen, laufende Zeitmessung und Abschlussauswertung.</p><div class="exam-options"><label>Anzahl Fragen<br><select id="examCount"><option>10</option><option>20</option><option>30</option><option>40</option></select></label><label>Bereich<br><select id="examCategory">${categories.map(c=>`<option>${c}</option>`).join('')}</select></label></div><button id="startExam" style="margin-top:16px">Prüfung starten</button>`;
 $('#startExam').onclick=()=>{const c=$('#examCategory').value,n=Number($('#examCount').value);currentList=Q.filter(q=>c==='Alle'||q.category===c);shuffle(currentList);currentList=currentList.slice(0,n);currentIndex=0;examMode=true;examRemaining=currentList.length;$('#examSetup').classList.add('hidden');$('#trainer').classList.remove('hidden');showQuestion()}
}
function renderHistory(){const h=state.history||[];$('#history').innerHTML='<h2>Prüfungsverlauf</h2>'+(h.length?h.map(x=>`<div class="history-item"><strong>${x.date}</strong><div>${x.known} von ${x.total} sicher (${Math.round(x.known/x.total*100)}%)</div></div>`).join(''):'<p class="muted">Noch keine Prüfung abgeschlossen.</p>')}
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}

document.querySelectorAll('.nav-btn').forEach(b=>b.onclick=()=>setView(b.dataset.view));
$('#randomBtn').onclick=()=>{currentList=[Q[Math.floor(Math.random()*Q.length)]];currentIndex=0;examMode=false;$('#dashboard').classList.add('hidden');$('#examSetup').classList.add('hidden');$('#history').classList.add('hidden');$('#trainer').classList.remove('hidden');showQuestion()};
$('#showAnswerBtn').onclick=showSolution; $('#nextBtn').onclick=next;
$('#rating').onclick=e=>{const r=e.target.dataset.rating;if(!r)return;const q=currentList[currentIndex];state.ratings[q.id]=r;save();next()};
['categorySelect','statusSelect'].forEach(id=>$('#'+id).onchange=()=>{if(!$('#trainer').classList.contains('hidden'))startFiltered()});
$('#searchInput').oninput=()=>{};
$('#resetBtn').onclick=()=>{if(confirm('Den gesamten Lernfortschritt wirklich löschen?')){localStorage.removeItem('beTrainerState');location.reload()}};
updateStats();renderDashboard();
