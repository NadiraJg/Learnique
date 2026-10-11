// Learnique MVP v1.4 — adaptive traversal practice + optional live Langflow chat.
// Demo progress and notes are stored only in this browser, not on a server.
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const STORAGE_KEY = 'learnique-mvp-v1';
  const traversalOrders = Object.freeze({
    inorder: [2, 4, 6, 8, 10, 12, 14],
    preorder: [8, 4, 2, 6, 12, 10, 14],
    postorder: [2, 6, 4, 10, 14, 12, 8]
  });
  const traversalLabel = {inorder:'Inorder',preorder:'Preorder',postorder:'Postorder'};
  const traversalRule = {
    inorder: 'Left → Root → Right',
    preorder: 'Root → Left → Right',
    postorder: 'Left → Right → Root'
  };
  const currentOrder = () => traversalOrders[state.traversalType] || traversalOrders.inorder;
  const tree = [
    { n:8, x:165, y:31, px:null },
    { n:4, x:87, y:93, px:165, py:31 },
    { n:12, x:243, y:93, px:165, py:31 },
    { n:2, x:43, y:163, px:87, py:93 },
    { n:6, x:130, y:163, px:87, py:93 },
    { n:10, x:200, y:163, px:243, py:93 },
    { n:14, x:286, y:163, px:243, py:93 }
  ];
  // Local, prewritten practice questions for each traversal. The AI selects
  // the traversal via Langflow; it does NOT generate these questions itself.
  const quizzes = Object.freeze({
    inorder: [
      {question:'Inorder traversal mengikuti urutan yang mana?', options:['Left → Root → Right','Root → Left → Right','Left → Right → Root'], correct:0, hint:'Pada inorder, root dikunjungi di antara subtree kiri dan kanan.'},
      {question:'Dari node 8, bagian mana yang diperiksa lebih dulu?', options:['Subtree kiri (node 4)','Node 8 (root)','Subtree kanan (node 12)'], correct:0, hint:'Dalam Left → Root → Right, bagian kiri didahulukan.'},
      {question:'Node pertama yang dikunjungi di gambar adalah...', options:['2','4','8'], correct:0, hint:'Ikuti cabang paling kiri: 8 → 4 → 2.'}
    ],
    preorder: [
      {question:'Preorder traversal mengikuti urutan yang mana?', options:['Left → Root → Right','Root → Left → Right','Left → Right → Root'], correct:1, hint:'Awalan pre berarti root dikunjungi sebelum anak-anaknya.'},
      {question:'Dari node 8, bagian mana yang dikunjungi pertama?', options:['Subtree kiri (node 4)','Node 8 (root)','Subtree kanan (node 12)'], correct:1, hint:'Pada preorder, root dikunjungi dahulu sebelum subtree kiri.'},
      {question:'Setelah node 8, node mana yang dikunjungi berikutnya?', options:['4','2','12'], correct:0, hint:'Setelah root 8, preorder masuk ke anak kiri, yaitu node 4.'}
    ],
    postorder: [
      {question:'Postorder traversal mengikuti urutan yang mana?', options:['Root → Left → Right','Left → Right → Root','Left → Root → Right'], correct:1, hint:'Post berarti root dikunjungi setelah kedua subtree.'},
      {question:'Sebelum mengunjungi node 8, subtree mana yang diproses lebih dulu?', options:['Node 8 (root)','Subtree kanan (node 12)','Subtree kiri (node 4)'], correct:2, hint:'Postorder mengikuti urutan Left → Right → Root, jadi mulai dari kiri.'},
      {question:'Node pertama yang dikunjungi di gambar adalah...', options:['4','2','8'], correct:1, hint:'Turun ke kiri sampai node 2, lalu kunjungi leaf itu.'}
    ]
  });
  const currentQuiz = () => quizzes[state.traversalType] || quizzes.inorder;
  const defaultState = () => ({notes:[], step:0, traversalType:'inorder', visualizationSource:'demo', guidedMode:'inorder', guidedStep:0, guidedActive:false, correct:0, wrong:0, hints:0, selected:null, simplified:false, messages:[], currentSuggestion: {text:'Inorder traversal visits: left subtree → root → right subtree.', simple_text:'Inorder = Kiri → Tengah → Kanan.'}});
  let state;
  let storedState;
  try { storedState = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); state = {...defaultState(), ...storedState}; }
  catch { storedState = {}; state = defaultState(); }
  if (!Object.hasOwn(traversalOrders, state.traversalType)) state.traversalType='inorder';
  if (state.visualizationSource !== 'agent') state.visualizationSource='demo';
  if (!Number.isInteger(state.step) || state.step<0 || state.step>7) state.step=0;
  if (!Array.isArray(state.notes)) state.notes = [];
  if (!Array.isArray(state.messages)) state.messages = [];
  if (!state.currentSuggestion || typeof state.currentSuggestion.text !== 'string') state.currentSuggestion=defaultState().currentSuggestion;
  // Upgrade v1.3 state safely: an older inorder-only quiz cannot be reused
  // for an AI-selected preorder/postorder lesson. Preserve saved notes/chat.
  if (!Object.hasOwn(storedState, 'guidedMode')) {
    // v1.3 only offered inorder questions. Preserve valid inorder progress;
    // discard mismatched progress when a different traversal was selected.
    state.guidedMode=state.traversalType;
    if (state.traversalType!=='inorder') { state.guidedStep=0;state.guidedActive=false; }
  } else if (state.guidedMode !== state.traversalType) {
    state.guidedMode=state.traversalType;
    state.guidedStep=0;
    state.guidedActive=false;
  }
  if (!Number.isInteger(state.guidedStep) || state.guidedStep<0 || state.guidedStep>currentQuiz().length) state.guidedStep=0;
  let liveMode = false;
  let busy = false;
  let sessionId = sessionStorage.getItem('learnique-session');
  if (!sessionId) {sessionId = crypto.randomUUID ? crypto.randomUUID() : 'student-' + Date.now(); sessionStorage.setItem('learnique-session',sessionId);}
  const intro = "Hi! 👋 I'm Learnique, your study companion.\n\nToday we're learning inorder traversal. I'll help you understand the logic, not just memorize the answer. Want to start with a simple explanation or try the visual tree?";
  function persist() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  function scrollToBottom() { const el=$('chatMessages'); el.scrollTop=el.scrollHeight; }
  function addMessage(role, message, store=true) {
    const item = document.createElement('div');
    item.className = 'chat-item ' + (role === 'student' ? 'student' : '');
    const wrap=document.createElement('div'); wrap.className='chat-content';
    if (role !== 'student') {
      const avatar=document.createElement('span'); avatar.className='chat-avatar'; avatar.textContent='L';
      item.appendChild(avatar);
      const label=document.createElement('div'); label.className='chat-name';label.textContent='Learnique';wrap.appendChild(label);
    }
    const bubble=document.createElement('div');bubble.className='chat-bubble';bubble.textContent=message;wrap.appendChild(bubble);
    const time=document.createElement('div');time.className='chat-time';time.textContent=role==='student'?'You':'Study assistant';wrap.appendChild(time);
    item.appendChild(wrap);$('chatMessages').appendChild(item);
    if (store) {state.messages.push({role,message}); if(state.messages.length>35) state.messages.shift();persist();}
    scrollToBottom();
  }
  function renderSuggested() {
    const suggestion=state.currentSuggestion;
    const canSimplify=Boolean(suggestion.simple_text);
    if(!canSimplify)state.simplified=false;
    $('suggestedNote').textContent=(state.simplified ? suggestion.simple_text : suggestion.text);
    $('rewriteNoteBtn').disabled=!canSimplify;
    $('rewriteNoteBtn').textContent=state.simplified?'Original':'Simplify';
  }
  function setSuggested(text, simplifiedText='') {
    // This only suggests a note; saving still requires clicking Add to notes.
    state.currentSuggestion={text:String(text).slice(0,500),simple_text:String(simplifiedText).slice(0,500)};
    state.simplified=false;
    renderSuggested();persist();
  }

  function applyVisualization(data) {
    // Server validates the order against the fixed BST. Check again in the UI.
    if (!data || data.visualization_type !== 'bst_traversal') return;
    const type = data.traversal;
    if (!Object.hasOwn(traversalOrders, type)) return;
    const canonical = traversalOrders[type];
    if (!Array.isArray(data.visit_order) ||
        data.visit_order.length !== canonical.length ||
        !data.visit_order.every((value, i) => value === canonical[i])) return;
    state.traversalType=type;
    state.visualizationSource='agent';
    state.step=0;
    state.selected=null;
    // The AI-selected traversal also changes the locally scripted
    // Guided Reasoning exercise, so we cannot leave an old inorder card up.
    state.guidedMode=type;
    state.guidedStep=0;
    state.guidedActive=true;
    persist();
    renderTree();
    renderGuided();
    updateProfile();
    $('visualPanel').classList.add('viz-updated');
    setTimeout(()=>$('visualPanel').classList.remove('viz-updated'),1800);
  }

  function explain() {
    const type=state.traversalType;
    addMessage('student',`Explain ${type} traversal simply`);
    addMessage('assistant',`Local practice reference: ${traversalLabel[type]} follows ${traversalRule[type]}. For this BST the node order is ${currentOrder().join(' → ')}. Try “Next step” to observe each visit, then test yourself with “I'm stuck”.`);
  }
  function startGuided() {
    addMessage('student',`I'm stuck on ${state.traversalType}. Walk me through the logic.`);
    addMessage('assistant',`Let's practice ${state.traversalType} with one small question at a time. These interactive questions are part of the local learning module.`);
    state.guidedMode=state.traversalType;state.guidedStep=0;state.guidedActive=true;persist();renderGuided();updateProfile();
  }
  function renderGuided() {
    const el=$('guidedCard');
    const quiz=currentQuiz();
    if (!state.guidedActive || state.guidedStep >= quiz.length) {el.classList.add('hidden');return;}
    el.classList.remove('hidden');
    const q=quiz[state.guidedStep];
    $('guidedTopic').textContent=state.traversalType.toUpperCase();
    $('guidedCounter').textContent=`Step ${state.guidedStep+1} / ${quiz.length}`;
    $('guidedQuestion').textContent=q.question;
    $('guidedHint').textContent='Choose an answer — your reasoning matters.';
    const feedback=$('guidedFeedback'); feedback.textContent=''; feedback.classList.add('hidden');
    const answers=$('guidedAnswers'); answers.replaceChildren();
    q.options.forEach((option,i)=>{
      const btn=document.createElement('button');btn.type='button';btn.textContent=option;
      btn.addEventListener('click',()=>answerGuided(i));answers.appendChild(btn);
    });
  }
  function answerGuided(index) {
    const quiz=currentQuiz();
    if(!state.guidedActive||state.guidedStep>=quiz.length)return;
    const q=quiz[state.guidedStep];
    if(index!==q.correct){
      state.wrong++;state.hints++;
      const feedback=$('guidedFeedback');
      feedback.textContent='Belum tepat — coba lagi! 💡 '+q.hint+' Pilih jawaban lain setelah memikirkan petunjuk ini.';
      feedback.classList.remove('hidden');
      $('guidedHint').textContent='Jawaban belum tepat. Perhatikan petunjuk di bawah.';
      const buttons=$('guidedAnswers').querySelectorAll('button');
      if(buttons[index]){buttons[index].classList.add('answer-incorrect');buttons[index].setAttribute('aria-invalid','true');buttons[index].disabled=true;}
      persist();updateProfile();return;
    }
    state.correct++;state.guidedStep++;
    if(state.guidedStep>=quiz.length){
      state.guidedActive=false;
      addMessage('assistant',`You completed the ${state.traversalType} practice! ✨\n\nNow try explaining ${traversalRule[state.traversalType]} in your own words. You can also check the tree animation.`);
      // Keep any AI-suggested note untouched when local practice completes.
      if(state.visualizationSource!=='agent') {
        setSuggested(`${traversalLabel[state.traversalType]} traversal = ${traversalRule[state.traversalType]}.`, `${traversalLabel[state.traversalType]} = ${traversalRule[state.traversalType].replaceAll('Left','Kiri').replaceAll('Right','Kanan').replaceAll('Root','Tengah')}.`);
      }
    }
    else $('guidedHint').textContent='Nice! Moving to the next step.';
    persist();renderGuided();updateProfile();
  }
  function startQuiz() {
    addMessage('student','Give me a practice question');
    addMessage('assistant','Practice challenge: predict the order of the nodes. Press “Next step” until you can explain the sequence, then tap “I’m stuck” if you need guided questions.');
    $('visualPanel').scrollIntoView({behavior:'smooth',block:'nearest'});
  }
  function showVisual() {
    addMessage('student','Show the interactive tree visualization');
    addMessage('assistant','Use “Next step” to see the visit order. Click any node to inspect it. Can you predict the next value *before* pressing Next?');
    $('visualPanel').scrollIntoView({behavior:'smooth',block:'nearest'});
  }
  function handleDemoMessage(input) {
    const s=input.toLowerCase();
    if(/stuck|bingung|gak ngerti|nggak ngerti|ga ngerti|bantu|hint|walkthrough|guide/.test(s)){addMessage('assistant','We can break it down into one decision at a time. I opened Guided Reasoning for the current traversal.');state.guidedMode=state.traversalType;state.guidedStep=0;state.guidedActive=true;renderGuided();}
    else if(/note|catat|ringkas|summary/.test(s)){setSuggested(`${traversalLabel[state.traversalType]} traversal: ${traversalRule[state.traversalType]}.`, `${traversalLabel[state.traversalType]} = ${traversalRule[state.traversalType].replaceAll('Left','Kiri').replaceAll('Right','Kanan').replaceAll('Root','Tengah')}.`);addMessage('assistant','I prepared a suggested note in the Smart Notes panel. You can simplify or save it.');}
    else if(/visual|gambar|lihat|tree|pohon|animasi/.test(s)){addMessage('assistant','You can use the interactive tree panel. Press “Next step” and observe the active node.');}
    else if(/inorder|preorder|postorder|traversal|explain|jelas|belajar|mulai/.test(s)){addMessage('assistant',`${traversalLabel[state.traversalType]} means ${traversalRule[state.traversalType]}. In this tree the visit order is ${currentOrder().join(' → ')}. Try Next step to examine the sequence.`);}
    else {addMessage('assistant','Demo mode currently supports practice on our fixed Binary Search Tree. Try “Explain simply”, “I’m stuck”, or “Show visualization”. To ask arbitrary questions, connect a Langflow agent using the included setup guide.');}
    persist();updateProfile();
  }
  async function submitMessage(input) {
    if(busy)return;
    addMessage('student',input);
    if(!liveMode){handleDemoMessage(input);return;}
    busy=true;$('sendBtn').disabled=true;$('sendStatus').textContent='Thinking...';
    try{
      const res=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:input,session_id:sessionId})});
      const data=await res.json();if(!res.ok)throw new Error(data.error||'Agent request failed');
      addMessage('assistant',data.text || 'The agent returned an empty response.');
      if(data.note_suggestion && typeof data.note_suggestion.text==='string') {
        setSuggested(data.note_suggestion.text, data.note_suggestion.simple_text || '');
        $('notesPanel').classList.add('note-updated');
        setTimeout(()=>$('notesPanel').classList.remove('note-updated'),1800);
      }
      if (data.visualization_request) applyVisualization(data.visualization_request);
    }catch(e){addMessage('assistant','Could not reach Langflow: '+e.message+'\n\nYour local learning tools still work. Check the Langflow URL and flow ID in .env.');}
    finally{busy=false;$('sendBtn').disabled=false;$('sendStatus').textContent='';}
  }
  function renderTree() {
    const svg=$('treeSvg');const ns='http://www.w3.org/2000/svg';svg.replaceChildren();
    const traversal=currentOrder();
    const visited=traversal.slice(0,state.step);
    const active=state.step>0?traversal[state.step-1]:null;
    $('vizExplainer').textContent='Click a node or step through '+state.traversalType+': '+traversalRule[state.traversalType]+'.';
    $('vizSource').textContent=(state.visualizationSource==='agent'?'AI selected · ':'Demo example · ')+traversalLabel[state.traversalType];
    $('vizSource').classList.toggle('ai-selected', state.visualizationSource==='agent');
    const shape=(tag,attrs)=>{const e=document.createElementNS(ns,tag);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,String(v)));return e;};
    tree.forEach(node=>{if(node.px==null)return;svg.appendChild(shape('line',{x1:node.px,y1:node.py,x2:node.x,y2:node.y,class:'tree-line'}));});
    tree.forEach(node=>{
      const g=shape('g',{class:'tree-node'+(visited.includes(node.n)?' visited':'')+(active===node.n?' active':'')+(state.selected===node.n?' picked':''),tabindex:'0',role:'button','aria-label':'Inspect node '+node.n});
      const c=shape('circle',{cx:node.x,cy:node.y,r:21});const t=shape('text',{x:node.x,y:node.y+5,'text-anchor':'middle'});t.textContent=node.n;g.append(c,t);
      const pick=()=>{state.selected=node.n;$('vizStatus').textContent='Selected node: '+node.n;persist();renderTree();};
      g.addEventListener('click',pick);g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();pick();}});svg.appendChild(g);
    });
    $('vizCount').textContent=state.step+' / '+traversal.length+' nodes';
    if(state.selected==null){$('vizStatus').textContent=state.step===0?'Ready to explore':state.step===traversal.length?'Traversal complete!':'Visiting node '+active;}
    const list=$('visitSequence');list.replaceChildren();
    if(visited.length===0){const p=document.createElement('span');p.className='placeholder';p.textContent='Your traversal will appear here';list.appendChild(p);}
    visited.forEach(n=>{const s=document.createElement('span');s.className='visit-number';s.textContent=n;list.appendChild(s);});
    $('prevStep').disabled=state.step===0;$('nextStep').disabled=state.step===traversal.length;
  }
  function changeStep(d){state.step=Math.max(0,Math.min(currentOrder().length,state.step+d));state.selected=null;persist();renderTree();}
  function renderNotes(){
    $('noteCount').textContent=state.notes.length;$('sideNoteCount').textContent=state.notes.length;
    const list=$('savedNotes');list.replaceChildren();
    if(!state.notes.length){const p=document.createElement('p');p.className='empty-notes';p.textContent='Your useful insights will appear here.';list.appendChild(p);return;}
    state.notes.forEach((note,i)=>{const row=document.createElement('div');row.className='saved-note';const txt=document.createElement('span');txt.textContent=note;const del=document.createElement('button');del.textContent='×';del.setAttribute('aria-label','Delete note');del.addEventListener('click',()=>{state.notes.splice(i,1);persist();renderNotes();});row.append(txt,del);list.appendChild(row);});
  }
  function updateProfile(){
    const total=currentQuiz().length;
    $('completedSteps').textContent=state.guidedStep+'/'+total;$('correctAnswers').textContent=state.correct;$('hintRequests').textContent=state.hints;
    $('sideProgressText').textContent=state.guidedStep+' / '+total;$('sidebarProgress').style.width=(Math.min(state.guidedStep,total)/total*100)+'%';
    $('profileInsight').textContent=state.guidedStep===total?`${traversalLabel[state.traversalType]} practice complete. Explain ${traversalRule[state.traversalType]} in your own words.`:state.hints>0?`Currently practising ${traversalLabel[state.traversalType]}. Your hints help you identify what to review.`:`Currently practising ${traversalLabel[state.traversalType]}. Questions are adapted to the selected traversal.`;
  }
  function navTo(id,button){document.querySelectorAll('.nav-item').forEach(b=>b.classList.remove('selected'));button.classList.add('selected');$(id).scrollIntoView({behavior:'smooth',block:'start'});}
  function reset(){if(!confirm('Reset demo chat, notes, and progress?'))return;state=defaultState();$('chatMessages').replaceChildren();addMessage('assistant',intro);renderSuggested();persist();renderGuided();renderTree();renderNotes();updateProfile();}
  async function initStatus(){
    try {const res=await fetch('/api/status'); const data=await res.json();liveMode=data.mode==='langflow';if(liveMode){$('modeTag').innerHTML='<span class="status-dot" style="background:#3d956a"></span> Langflow configured';}}
    catch { /* Browser-only hosting: demo remains usable. */ }
  }
  // Event handlers
  $('chatForm').addEventListener('submit',e=>{e.preventDefault();const input=$('messageInput').value.trim();if(!input)return;$('messageInput').value='';submitMessage(input);});
  document.querySelectorAll('[data-action]').forEach(btn=>btn.addEventListener('click',()=>({explain,guide:startGuided,visual:showVisual,quiz:startQuiz})[btn.dataset.action]()));
  $('prevStep').addEventListener('click',()=>changeStep(-1));$('nextStep').addEventListener('click',()=>changeStep(1));$('resetSteps').addEventListener('click',()=>{state.step=0;state.selected=null;persist();renderTree();});
  $('saveNoteBtn').addEventListener('click',()=>{const note=$('suggestedNote').textContent.trim();if(!state.notes.includes(note)){state.notes.unshift(note);persist();renderNotes();}$('saveNoteBtn').textContent='✓ Saved';setTimeout(()=>$('saveNoteBtn').textContent='+ Add to notes',1000);});
  $('rewriteNoteBtn').addEventListener('click',()=>{if(!state.currentSuggestion.simple_text)return;state.simplified=!state.simplified;renderSuggested();persist();});
  $('navStudy').addEventListener('click',()=>navTo('studyPanel',$('navStudy')));$('navVisual').addEventListener('click',()=>navTo('visualPanel',$('navVisual')));$('navNotes').addEventListener('click',()=>navTo('notesPanel',$('navNotes')));$('resetAll').addEventListener('click',reset);
  if(state.messages.length===0){addMessage('assistant',intro);}else{state.messages.forEach(m=>addMessage(m.role,m.message,false));}
  renderGuided();renderTree();renderNotes();renderSuggested();updateProfile();persist();initStatus();
})();
