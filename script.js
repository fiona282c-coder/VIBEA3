import {looks,products,outfits,news,celebrityLooks,translations} from './data.js';
import {analyzePortrait,analyzeFinishedMakeup} from './face-analysis.js';

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];

// Keep only one mobile navigation. If an older VIBEA nav was left behind
// by a previous manual edit, prefer the newest nav that contains Wardrobe.
const mobileNavs=$$('.mobile-nav');
if(mobileNavs.length>1){
  const keep=mobileNavs.find(n=>n.querySelector('[data-go="wardrobe"]'))||mobileNavs[mobileNavs.length-1];
  mobileNavs.forEach(n=>{if(n!==keep)n.remove()});
}
let lang=localStorage.getItem('vibea-lang')||'zh';
let currentPhotoData=null, currentAnalysis=null, cameraStream=null;
let tryonState={lip:'#b85d6a',blush:'#d88f92',intensity:.42};
const store={
  get(k,f){try{return JSON.parse(localStorage.getItem('vibea-'+k))??f}catch{return f}},
  set(k,v){localStorage.setItem('vibea-'+k,JSON.stringify(v))}
};

function t(key){return translations[lang]?.[key]||translations.zh[key]||key}
function localize(){document.documentElement.lang=lang==='zh'?'zh-Hant':'en'; $$('[data-i18n]').forEach(el=>{const k=el.dataset.i18n;if(t(k))el.textContent=t(k)}); $('#langToggle').textContent=lang==='zh'?'EN':'中'; renderAll();}
$('#langToggle').addEventListener('click',()=>{lang=lang==='zh'?'en':'zh';localStorage.setItem('vibea-lang',lang);localize()});

function goTo(id){$$('.page').forEach(p=>p.classList.toggle('active',p.id===id));window.scrollTo({top:0,behavior:'smooth'});if(id==='tryon')renderTryon();}
$$('[data-go]').forEach(b=>b.addEventListener('click',()=>goTo(b.dataset.go)));

function renderLooks(){
  $('#lookGrid').innerHTML=looks.map(l=>`<article class="look-card photo-look-card"><div class="look-photo-wrap"><img class="look-photo" src="${l.image}" alt="${l.name[lang]}" loading="lazy" onerror="this.onerror=null;this.src=\'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=85\'"><span class="look-code-chip">${l.code}</span></div><div class="look-copy"><span class="eyebrow">${l.tip[lang]}</span><h3>${l.name[lang]}</h3><p class="look-tip">${l.tip[lang]}</p><p>${l.desc[lang]}</p><div class="card-actions"><button data-open-tutorial="${l.id}">${lang==='zh'?'看影片教學':'Video tutorial'}</button><button data-learn-look="${l.id}">${lang==='zh'?'加入學習':'Track'}</button><button data-top-look="${l.id}">${lang==='zh'?'設為近期風格':'Use as recent style'}</button></div></div></article>`).join('');
  $$('[data-open-tutorial]').forEach(b=>b.onclick=()=>openTutorial(b.dataset.openTutorial));
  $$('[data-learn-look]').forEach(b=>b.onclick=()=>toggleLearned(b.dataset.learnLook));
  $$('[data-top-look]').forEach(b=>b.onclick=()=>{const p=store.get('progress',{learned:[],practice:0,mistakes:{Base:0,Eyes:0,Blush:0,Lips:0},recent:''});p.recent=b.dataset.topLook;store.set('progress',p);renderProgress();renderOutfits();});
}
const tutorialVideos={
  korean:{id:'134707202',source:'3CE / Stylenanda',url:'https://vimeo.com/134707202'},
  japanese:{id:'302672327',source:'Lancôme makeup tutorial',url:'https://vimeo.com/302672327'},
  chinese:{id:'107388571',source:'Red lips + liner tutorial',url:'https://vimeo.com/107388571'},
  western:{id:'254544070',source:'SA Style Studio full makeup tutorial',url:'https://vimeo.com/254544070'},
  clean:{id:'281680197',source:'Easy Day Look tutorial',url:'https://vimeo.com/281680197'},
  french:{id:'338886628',source:'Vogue HK x Gucci Beauty',url:'https://vimeo.com/338886628'},
  thai:{id:'169312616',source:'Summer Makeup / bronzy glow',url:'https://vimeo.com/169312616'},
  y2k:{id:'745233006',source:'2000s Korean beauty trend',url:'https://vimeo.com/745233006'}
};
let activeTutorialId='korean', pendingResultPhoto='';
function renderTutorials(){
  $('#tutorialGrid').innerHTML=looks.map(l=>{const v=tutorialVideos[l.id]||tutorialVideos.korean;return `<article class="tutorial-card video-tutorial-card"><div class="tutorial-cover"><img src="${l.image}" alt="${l.name[lang]}" loading="lazy"><button class="video-play-btn" data-open-tutorial="${l.id}" aria-label="Play">▶</button></div><span class="eyebrow">${l.tip[lang]}</span><h3>${l.name[lang]}</h3><ol class="tutorial-steps">${l.steps[lang].map(s=>`<li>${s}</li>`).join('')}</ol><div class="video-source-line">${v.source}</div><div class="card-actions"><button data-open-tutorial="${l.id}">${lang==='zh'?'直接播放影片':'Play video'}</button></div></article>`}).join('');
  $$('[data-open-tutorial]').forEach(b=>b.onclick=()=>openTutorial(b.dataset.openTutorial));
}
function tutorialComments(){return store.get('tutorial-comments',{})}
function openTutorial(id){activeTutorialId=id;const look=looks.find(l=>l.id===id)||looks[0],v=tutorialVideos[id]||tutorialVideos.korean;$('#tutorialModalTitle').textContent=look.name[lang];$('#tutorialVideo').src=`https://player.vimeo.com/video/${v.id}?title=0&byline=0&portrait=0`;$('#tutorialVideoSource').innerHTML=`${v.source} · <a href="${v.url}" target="_blank" rel="noopener">Vimeo ↗</a>`;$('#tutorialModal').hidden=false;document.body.classList.add('modal-open');renderTutorialComments()}
function closeTutorial(){$('#tutorialModal').hidden=true;$('#tutorialVideo').src='';document.body.classList.remove('modal-open')}
$$('[data-close-tutorial]').forEach(x=>x.addEventListener('click',closeTutorial));
$('#shareTutorialBtn').addEventListener('click',async()=>{const look=looks.find(l=>l.id===activeTutorialId);const shareData={title:`VIBEA · ${look?.name[lang]||'Makeup tutorial'}`,text:lang==='zh'?'一起練這個妝！':'Practice this look with me!',url:location.href};try{if(navigator.share)await navigator.share(shareData);else{await navigator.clipboard.writeText(location.href);alert(lang==='zh'?'網址已複製。':'Link copied.')}}catch{}});
$('#tutorialResultPhoto').addEventListener('change',e=>{const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=()=>{pendingResultPhoto=r.result;$('#tutorialResultPreview').src=r.result;$('#tutorialResultPreview').hidden=false};r.readAsDataURL(f)});
$('#tutorialCommentForm').addEventListener('submit',e=>{e.preventDefault();const all=tutorialComments();const arr=all[activeTutorialId]||[];arr.unshift({text:$('#tutorialCommentText').value.trim(),photo:pendingResultPhoto||'',date:new Date().toLocaleDateString()});all[activeTutorialId]=arr.slice(0,12);store.set('tutorial-comments',all);e.target.reset();pendingResultPhoto='';$('#tutorialResultPreview').hidden=true;renderTutorialComments()});
function renderTutorialComments(){const arr=tutorialComments()[activeTutorialId]||[];$('#tutorialCommentList').innerHTML=arr.map(c=>`<article class="tutorial-comment"><p>${escapeHtml(c.text)}</p>${c.photo?`<img src="${c.photo}" alt="result">`:''}<small>${c.date}</small></article>`).join('')||`<p>${lang==='zh'?'還沒有留言，成為第一個分享成果的人。':'No comments yet. Be the first to share a result.'}</p>`}
function renderProducts(){
  const budget=$('#budgetFilter').value, style=$('#styleFilter').value, skin=$('#skinFilter').value, cat=$('#categoryFilter').value;
  const filtered=products.filter(p=>(budget==='all'||p.price<=+budget)&&(style==='all'||p.styles.includes(style))&&(skin==='all'||p.skins.includes('all')||p.skins.includes(skin))&&(cat==='all'||p.category===cat));
  $('#productGrid').innerHTML=filtered.map((p,i)=>`<article class="product-card"><div class="product-art">${String(i+1).padStart(2,'0')}</div><small>${p.brand} · ${p.category.toUpperCase()}</small><h3>${p.name}</h3><p>${p.note[lang]}</p><strong>NT$ ${p.price.toLocaleString()}</strong><a href="${p.url}" target="_blank" rel="noopener">${lang==='zh'?'官方連結':'Official link'} ↗</a></article>`).join('')||`<p>${lang==='zh'?'沒有符合條件的產品。':'No matching products.'}</p>`;
}
['budgetFilter','styleFilter','skinFilter','categoryFilter'].forEach(id=>$('#'+id).addEventListener('change',renderProducts));
function focusMatchedMakeup(id){
  if(!id)return;
  const p=progressData();
  p.recent=id;
  store.set('progress',p);
  renderProgress();
  renderOutfits();
  goTo('looks');
  setTimeout(()=>{
    const target=document.querySelector(`[data-top-look="${id}"]`)?.closest('.look-card');
    if(target){
      target.classList.add('match-focus');
      target.scrollIntoView({behavior:'smooth',block:'center'});
      setTimeout(()=>target.classList.remove('match-focus'),1800);
    }
  },120);
}
function renderOutfits(){
  const filter=$('#outfitStyleFilter');
  const f=filter?.value||'all', p=progressData(), recent=p.recent||'';
  const rec=recent?outfits.filter(o=>o.makeup?.includes(recent)):[];
  const sync=$('#outfitMakeupSync');
  sync.textContent=recent
    ?(lang==='zh'?`依妝容推薦：${looks.find(l=>l.id===recent)?.name.zh||recent} · 點我查看妝容`:`Matched to makeup: ${looks.find(l=>l.id===recent)?.name.en||recent} · Tap to view`)
    :(lang==='zh'?'依妝容推薦：尚未選擇近期風格 · 點我選妝容':'Makeup match: no recent style selected · Tap to choose');
  sync.onclick=()=>recent?focusMatchedMakeup(recent):goTo('looks');

  const styles=['all','korean','japanese','clean','french','editorial','thai','y2k'];
  const styleNames={all:'All',korean:'Korean',japanese:'Japanese',clean:'Clean',french:'French',editorial:'Editorial',thai:'Thai',y2k:'Y2K'};
  const chips=$('#outfitStyleChips');
  if(chips){
    chips.innerHTML=styles.map(s=>`<button class="vibea-style-chip ${s===f?'active':''}" data-outfit-chip="${s}">${styleNames[s]}</button>`).join('');
    $$('[data-outfit-chip]').forEach(b=>b.onclick=()=>{filter.value=b.dataset.outfitChip;renderOutfits()});
  }

  const list=outfits.filter(o=>(f==='all'||o.style===f));
  const ordered=[...list].sort((a,b)=>(rec.includes(b)?1:0)-(rec.includes(a)?1:0));
  const saved=new Set(store.get('saved-outfits',[]));
  const heights=['vibea-tall','vibea-mid','vibea-short','vibea-mid'];
  $('#outfitGrid').innerHTML=ordered.map((o,i)=>{
    const primaryMatch=(recent&&o.makeup?.includes(recent))?recent:(o.makeup?.[0]||'');
    const matchLook=looks.find(l=>l.id===primaryMatch);
    const matchedNow=recent&&o.makeup?.includes(recent);
    const badgeLabel=matchLook
      ?(lang==='zh'?`妝容配對 · ${matchLook.name.zh}`:`Match · ${matchLook.name.en}`)
      :(lang==='zh'?'妝容配對':'Makeup match');
    return `<article class="outfit-pin ${heights[i%heights.length]} ${matchedNow?'recommended-pin':''}">
      <div class="outfit-image-wrap">
        <img src="${o.image}" alt="${o.name[lang]}" loading="lazy" onerror="this.onerror=null;this.src=\'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=85\'">
        
        ${primaryMatch?`<button class="makeup-match-badge" type="button" data-match-look="${primaryMatch}" aria-label="${badgeLabel}">${badgeLabel}</button>`:''}
        <button class="vibea-pin-save ${saved.has(o.id)?'saved':''}" type="button" data-save-outfit="${o.id}" aria-label="Save outfit">${saved.has(o.id)?'♥':'♡'}</button>
      </div>
      <div class="outfit-pin-copy"><small>${o.style.toUpperCase()}</small><h3>${o.name[lang]}</h3><p>${o.desc[lang]}</p><div class="card-actions">${o.items.map(it=>`<a href="${it.url}" target="_blank" rel="noopener">${it.label} ↗</a>`).join('')}</div></div>
    </article>`;
  }).join('')||`<p>${lang==='zh'?'這個分類目前沒有穿搭。':'No looks in this category yet.'}</p>`;

  $$('[data-match-look]').forEach(b=>b.onclick=(e)=>{
    e.preventDefault();
    e.stopPropagation();
    focusMatchedMakeup(b.dataset.matchLook);
  });
  $$('[data-save-outfit]').forEach(b=>b.onclick=()=>{
    const d=new Set(store.get('saved-outfits',[]));
    d.has(b.dataset.saveOutfit)?d.delete(b.dataset.saveOutfit):d.add(b.dataset.saveOutfit);
    store.set('saved-outfits',[...d]); renderOutfits();
  });
}
$('#outfitStyleFilter').addEventListener('change',renderOutfits);
function renderNews(){ $('#newsGrid').innerHTML=news.map(n=>`<article class="news-card"><span class="eyebrow">${n.source}</span><h3>${n.title[lang]}</h3><p>${n.body[lang]}</p><a href="${n.url}" target="_blank" rel="noopener">${lang==='zh'?'閱讀來源':'Read source'} ↗</a></article>`).join('') }
function renderCeleb(){ const map={'K-POP':'korean','90s':'french','RED':'western','Y2K':'y2k'}; $('#celebGrid').innerHTML=celebrityLooks.map(c=>`<article class="saved-card celeb-card"><div class="celeb-photo-wrap"><img class="celeb-photo" src="${c.image}" alt="${c.name[lang]}" loading="lazy" onerror="this.onerror=null;this.src=\'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=85\'"><span class="celeb-chip">${c.code}</span></div><h3>${c.name[lang]}</h3><p>${c.desc[lang]}</p><button class="celeb-link" data-open-tutorial="${map[c.code]||'korean'}">${lang==='zh'?'看影片教學':'Video tutorial'} ↗</button></article>`).join(''); $$('[data-open-tutorial]').forEach(b=>b.onclick=()=>openTutorial(b.dataset.openTutorial)); }

async function startCamera(){
  if(!$('#consentCheck').checked){alert(lang==='zh'?'請先閱讀並勾選隱私同意。':'Please read and accept the privacy notice first.');return}
  try{cameraStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:1280},height:{ideal:960}},audio:false});const v=$('#cameraVideo');v.srcObject=cameraStream;v.hidden=false;$('#analysisPreview').hidden=true;$('#cameraPlaceholder').hidden=true;$('#captureBtn').disabled=false;$('#analysisStatus').textContent=lang==='zh'?'相機已開啟。':'Camera ready.';}catch(e){$('#analysisStatus').textContent=(lang==='zh'?'無法開啟相機：':'Could not open camera: ')+e.message}}
$('#openCameraBtn').addEventListener('click',startCamera);
$('#captureBtn').addEventListener('click',()=>{const v=$('#cameraVideo'),c=$('#captureCanvas');c.width=v.videoWidth;c.height=v.videoHeight;c.getContext('2d').drawImage(v,0,0);currentPhotoData=c.toDataURL('image/jpeg',.92);showAnalysisPhoto(currentPhotoData);cameraStream?.getTracks().forEach(t=>t.stop());v.hidden=true;});
$('#photoInput').addEventListener('change',e=>{if(!$('#consentCheck').checked){e.target.value='';alert(lang==='zh'?'請先勾選隱私同意。':'Please accept the privacy notice first.');return}const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=()=>{currentPhotoData=r.result;showAnalysisPhoto(r.result)};r.readAsDataURL(f)});
function showAnalysisPhoto(src){const img=$('#analysisPreview');img.src=src;img.hidden=false;$('#cameraPlaceholder').hidden=true;$('#runAnalysisBtn').disabled=false;$('#analysisStatus').textContent=lang==='zh'?'照片已準備好。':'Photo ready.';}

$('#runAnalysisBtn').addEventListener('click',async()=>{
  const img=$('#analysisPreview'); if(!img.src)return; $('#runAnalysisBtn').disabled=true; $('#analysisStatus').textContent=lang==='zh'?'正在載入人臉模型並分析…第一次可能需要幾秒。':'Loading face model and analyzing… first run may take a few seconds.';
  try{await img.decode().catch(()=>{});currentAnalysis=await analyzePortrait(img);renderAnalysis(currentAnalysis);$('#analysisStatus').textContent=lang==='zh'?'分析完成。':'Analysis complete.';store.set('last-report',{scores:currentAnalysis.scores,meta:currentAnalysis.meta,date:new Date().toISOString()});renderShadeMatches();}
  catch(e){console.error(e);$('#analysisStatus').textContent=e.message==='NO_FACE'?(lang==='zh'?'沒有偵測到清楚正臉，請換一張照片。':'No clear face detected. Try another photo.'):(lang==='zh'?'分析失敗，請確認網路連線後重試。':'Analysis failed. Check internet connection and try again.');}
  finally{$('#runAnalysisBtn').disabled=false}
});

function metricCard(name,score,desc){return `<article class="metric-card"><div class="metric-head"><span>${name}</span><b>${score}%</b></div><div class="meter"><i style="width:${score}%"></i></div><p>${desc}</p></article>`}
function scoreText(s){if(s>=82)return lang==='zh'?'平衡度高':'High balance';if(s>=68)return lang==='zh'?'整體協調':'Generally balanced';return lang==='zh'?'可透過妝髮調整視覺平衡':'Styling can refine visual balance'}
function chooseTopLook(a){if(a.meta.undertone==='warm'&&a.meta.skinEvenness<72)return 'korean';if(a.meta.faceShape==='square')return 'clean';if(a.scores.bone>80)return 'editorial';if(a.meta.undertone==='cool')return 'japanese';return 'korean'}
function renderAnalysis(a){
  $('#analysisReport').hidden=false;$('#overallScore').textContent=a.scores.overall.toFixed(1);$('#overallSummary').textContent=lang==='zh'?`這是基於單張 2D 影像的美感平衡估計，不是客觀美貌分數。臉型估計為 ${a.meta.faceShape}，影像色調偏 ${a.meta.undertone}。`:`This is an aesthetic-balance estimate from one 2D image, not an objective beauty score. Estimated face shape: ${a.meta.faceShape}; image undertone: ${a.meta.undertone}.`;
  $('#faceMetrics').innerHTML=[
    metricCard(lang==='zh'?'臉部對稱與比例':'Symmetry & Proportions',a.scores.symmetry,scoreText(a.scores.symmetry)),
    metricCard(lang==='zh'?'骨骼與下顎':'Bone Structure & Jawline',a.scores.bone,`${lang==='zh'?'2D 下顎角近似':'Approx. 2D jaw angle'}: ${a.meta.jawAngle}°`),
    metricCard(lang==='zh'?'可見膚質與均勻度':'Visible Skin Quality & Tone',a.scores.skin,`${lang==='zh'?'均勻度':'Evenness'} ${a.meta.skinEvenness}% · ${lang==='zh'?'清晰度':'Clarity'} ${a.meta.clarity}%`),
    metricCard(lang==='zh'?'五官協調':'Feature Harmony',a.scores.harmony,`${lang==='zh'?'眼距平衡':'Eye spacing balance'} ${a.meta.eyeSpacing}%`)
  ].join('');
  const strengths=[]; if(a.scores.symmetry>=72) strengths.push(lang==='zh'?'左右主要五官位置在這張照片中相對平衡。':'Major features appear relatively balanced left-to-right in this image.'); if(a.scores.harmony>=72) strengths.push(lang==='zh'?'眼、鼻、唇在臉部寬度中的比例關係較協調。':'Eye, nose and lip proportions appear visually coherent relative to face width.'); if(a.scores.skin>=72) strengths.push(lang==='zh'?'可見膚色與明暗分布較均勻。':'Visible tone and luminance distribution appear relatively even.'); if(!strengths.length) strengths.push(lang==='zh'?'臉部整體輪廓清楚，適合用妝髮強調個人特色。':'The face outline is clear enough to personalize makeup and hair placement.');
  $('#strengthList').innerHTML=strengths.map(x=>`<li>${x}</li>`).join('');
  const improve=[]; if(a.scores.symmetry<78) improve.push(lang==='zh'?'可用眉型、腮紅高度或髮線分區微調左右視覺平衡。':'Brows, blush height or hair parting can subtly rebalance left-right appearance.'); if(a.meta.skinEvenness<75) improve.push(lang==='zh'?'照片顯示部分明暗與紋理不均，可用薄底妝＋局部遮瑕，不必全臉加厚。':'Some visible tone/texture variation can be refined with a thin base plus spot concealing rather than full heavy coverage.'); if(a.scores.proportions<78) improve.push(lang==='zh'?'臉部三庭與寬高比在 2D 照片中不是完全平均，可透過瀏海、分線與修容位置調整視覺比例。':'Facial thirds and width-height balance are not perfectly even in this 2D image; fringe, parting and contour placement can alter visual proportions.'); if(!improve.length)improve.push(lang==='zh'?'沒有明顯需要「修正」的地方；建議用妝髮放大你喜歡的特徵，而不是追求單一比例標準。':'No obvious feature needs “correction”; use styling to emphasize what you like rather than chase one ratio standard.');
  $('#improveList').innerHTML=improve.map(x=>`<li>${x}</li>`).join('');
  const recs=[
    [lang==='zh'?'髮型 / 分線':'Hair / parting',a.meta.faceShape==='round'?(lang==='zh'?'頭頂保留高度、避免兩側過度蓬鬆；偏分可拉長視覺。':'Keep some crown height, reduce excess side volume; an off-center part can elongate the look.'):(lang==='zh'?'中分或自然偏分都可，將體積放在顴骨以上較俐落。':'Center or soft side parts both work; keep volume above the cheekbone for a cleaner silhouette.')],
    [lang==='zh'?'眉型':'Brows',lang==='zh'?'以原生眉型為基礎，眉峰位置不要過度外移；左右高度可用眉尾微調。':'Follow your natural brow base; avoid pushing the arch too far outward and use the tails to fine-tune height balance.'],
    [lang==='zh'?'修容 / 提亮':'Contour / highlight',lang==='zh'?'修容以顴骨下方與下顎邊緣少量暈染；提亮放在面中與眼下內側，避免整臉過亮。':'Use light contour under cheekbones and along the jaw; highlight the center and inner under-eye rather than the entire face.'],
    [lang==='zh'?'腮紅':'Blush',a.meta.faceShape==='round'?(lang==='zh'?'位置略高、往太陽穴延伸，避免集中在臉中央。':'Place slightly higher and sweep toward the temples rather than concentrating at center.'):(lang==='zh'?'從笑肌外側往顴骨方向暈染，保留面中乾淨。':'Blend from the outer apple toward the cheekbone while keeping the center clean.')],
    [lang==='zh'?'唇妝':'Lip',a.meta.undertone==='warm'?(lang==='zh'?'蜜桃、暖玫瑰、裸棕會比較自然。':'Peach, warm rose and nude-brown should read naturally.'):(lang==='zh'?'冷玫瑰、莓果、粉裸色會更協調。':'Cool rose, berry and pink-nude tones should harmonize well.')],
    [lang==='zh'?'護膚':'Skincare',lang==='zh'?'只依照片可見紋理給建議：先以溫和保濕、防曬與穩定作息為主；若有持續刺激或皮膚問題，應諮詢專業醫療人員。':'Based only on visible texture: prioritize gentle hydration and sunscreen. Persistent irritation or skin concerns should be discussed with a qualified clinician.']
  ];
  $('#recommendationList').innerHTML=recs.map(([h,b])=>`<div class="recommend-item"><b>${h}</b><span>${b}</span></div>`).join('');
  const dirs=[['Clean / Minimal',lang==='zh'?'能保留原生肌理並用局部提亮強化比例。':'Preserves natural texture and uses strategic brightness.'],['Soft Feminine',lang==='zh'?'柔和腮紅與眼妝容易順著五官比例建立協調。':'Soft blush and eye placement work with the visible feature balance.'],[a.meta.undertone==='warm'?'Korean-inspired':'Japanese-inspired',lang==='zh'?'適合以低飽和色與薄透底妝做個人化調整。':'Works well with low-saturation color and a lightweight base.']];
  $('#styleDirectionList').innerHTML=dirs.map(([h,b])=>`<div class="style-pill"><b>${h}</b><span>${b}</span></div>`).join('');
  const top=looks.find(x=>x.id===chooseTopLook(a));$('#topLookName').textContent=top.name[lang];$('#topLookReason').textContent=lang==='zh'?`依目前照片的臉型、影像色調與可見膚質，${top.name.zh} 的「${top.tip.zh}」最容易做出自然且可調整的效果。`:`Based on the current image’s face shape, tone and visible skin texture, ${top.name.en} is the strongest starting point.`;
  setTimeout(()=>$('#analysisReport').scrollIntoView({behavior:'smooth',block:'start'}),100);
}

function bagData(){return store.get('bag',[])}
function renderBag(){const bag=bagData();$('#bagItems').innerHTML=bag.map((x,i)=>`<div class="bag-item"><b>${x.name}</b><span>${x.category} · ${x.tone||'—'}</span><button class="text-btn" data-remove-bag="${i}">×</button></div>`).join('')||`<span>${lang==='zh'?'尚未加入產品。':'No products yet.'}</span>`;$$('[data-remove-bag]').forEach(b=>b.onclick=()=>{const d=bagData();d.splice(+b.dataset.removeBag,1);store.set('bag',d);renderBag()});renderBagMatch();}
$('#bagForm').addEventListener('submit',e=>{e.preventDefault();const d=bagData();d.push({name:$('#bagName').value.trim(),category:$('#bagCategory').value,tone:$('#bagTone').value.trim()});store.set('bag',d);e.target.reset();renderBag()});
$('#clearBagBtn').addEventListener('click',()=>{store.set('bag',[]);renderBag()});
function getShadeProfile(){const r=store.get('last-report',{}).meta||{};const undertone=r.undertone||'neutral',b=r.brightness||188;const depth=b>=208?'fair':b>=185?'light':b>=160?'medium':'tan';return {undertone,depth}}
function shadeRecommendations(){const {undertone,depth}=getShadeProfile();const fitMap={fair:{cool:['110 PORCELAIN','110'],neutral:['109 LIGHT IVORY','109'],warm:['112 NATURAL IVORY','112']},light:{cool:['115 IVORY','115'],neutral:['120 CLASSIC IVORY','120'],warm:['118 LIGHT BEIGE','118']},medium:{cool:['122 CREAMY BEIGE','122'],neutral:['125 NUDE BEIGE','125'],warm:['128 WARM NUDE','128']},tan:{cool:['220 NATURAL BEIGE','220'],neutral:['220 NATURAL BEIGE','220'],warm:['220 NATURAL BEIGE','220']}};const fit=fitMap[depth][undertone]||fitMap.light.neutral;const blush=undertone==='warm'?['NARS ORGASM','蜜桃香檳金']:undertone==='cool'?['NARS BEHAVE','柔霧淡粉紫']:['NARS DEEP THROAT','柔和蜜桃粉'];const lip=undertone==='warm'?['Peach / Warm Rose','暖蜜桃・暖玫瑰']:undertone==='cool'?['Cool Rose / Berry','冷玫瑰・莓果']:['Rose Nude','玫瑰裸色'];return [
{type:lang==='zh'?'底妝起始色號':'Foundation starting shade',name:`Maybelline FIT ME ${fit[0]}`,shade:fit[1],why:lang==='zh'?`依照片明暗＋${undertone} undertone 的起始估計；請用官方線上試色再次確認。`:`Starting estimate from image brightness + ${undertone} undertone; confirm with official virtual try-on.`,url:'https://www.maybelline.com.tw/all-products/face-makeup/liquid-foundation/fit-me-matte-liquid-foundation'},
{type:lang==='zh'?'腮紅精確色號':'Exact blush shade',name:blush[0],shade:blush[1],why:lang==='zh'?`這個色系與 ${undertone} undertone 較容易融合。`:`This shade family usually harmonizes with a ${undertone} undertone.`,url:'https://www.narscosmetics.com.tw/zh/%E8%85%AE%E7%B4%85/999NACBLUSH01.html'},
{type:lang==='zh'?'唇色方向':'Lip shade direction',name:lip[0],shade:lip[1],why:lang==='zh'?'用來補足你現有化妝包的安全起點，實際顏色仍受原生唇色影響。':'A safe starting direction; actual color will vary with natural lip tone.',url:'https://www.narscosmetics.com.tw/zh/lips'}
]}
function renderShadeMatches(){const box=$('#shadeMatchGrid');if(!box)return;const recs=shadeRecommendations();const profile=getShadeProfile();$('#shadeMatchNote').textContent=lang==='zh'?`依最近一次臉部分析：${profile.depth} depth / ${profile.undertone} undertone。這是相片估色起點，不等於專櫃實測。`:`From your latest analysis: ${profile.depth} depth / ${profile.undertone} undertone. This is a photo-based starting estimate, not an in-store shade match.`;box.innerHTML=recs.map(r=>`<article class="shade-rec-card"><small>${r.type}</small><h4>${r.name}</h4><span class="shade-pill">${r.shade}</span><p>${r.why}</p><a href="${r.url}" target="_blank" rel="noopener">${lang==='zh'?'官方產品連結':'Official product link'} ↗</a></article>`).join('')}
function renderBagMatch(){const bag=bagData(),cats=new Set(bag.map(x=>x.category));const score=l=>{const req={korean:['base','eye','blush','lip'],japanese:['base','eye','blush'],chinese:['base','eye','lip'],western:['base','eye','blush','lip'],clean:['base','blush','lip'],french:['base','liner','lip'],thai:['base','eye','blush','lip'],y2k:['base','eye','lip']}[l.id]||[];return req.filter(x=>cats.has(x)).length/req.length};const ranked=looks.map(l=>[l,score(l)]).sort((a,b)=>b[1]-a[1]);renderShadeMatches();if(bag.length<2){$('#bagTopLook').textContent='—';$('#bagTopReason').textContent=t('bagEmpty');$('#bagCompatibleLooks').innerHTML='';return}const [top,s]=ranked[0];$('#bagTopLook').textContent=top.name[lang];$('#bagTopReason').textContent=lang==='zh'?`你目前的化妝包已覆蓋這個妝約 ${Math.round(s*100)}% 的核心類別；下方同時提供適合你的起始色號與官方連結。`:`Your bag covers about ${Math.round(s*100)}% of the core categories for this look. Starting shade suggestions and official links are shown below.`;$('#bagCompatibleLooks').innerHTML=ranked.filter(x=>x[1]>=.5).slice(0,4).map(([l,v])=>`<span>${l.name[lang]} ${Math.round(v*100)}%</span>`).join('')}


const scanCats=['base','brow','eye','liner','blush','lip','highlight'];$('#bagScanCategories').innerHTML=scanCats.map(c=>`<label><input type="checkbox" value="${c}">${c}</label>`).join('');
$('#bagPhotoInput').addEventListener('change',e=>{const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=()=>{const img=$('#bagPhotoPreview');img.src=r.result;img.hidden=false;$('#useScanBtn').disabled=false};r.readAsDataURL(f)});
$('#useScanBtn').addEventListener('click',()=>{const checked=$$('#bagScanCategories input:checked').map(x=>x.value);if(!checked.length){alert(lang==='zh'?'請勾選照片中有哪些類別。':'Select which categories are visible.');return}const d=bagData();checked.forEach(c=>d.push({name:`Scanned ${c}`,category:c,tone:'photo-confirmed'}));store.set('bag',d);renderBag()});

function renderSwatches(){const lips=['#b85d6a','#a34853','#8e3f4c','#c57780','#8b5b54'], blush=['#d88f92','#e4a1a1','#c77f7d','#df9a80','#b87379'];$('#lipSwatches').innerHTML=lips.map(c=>`<button class="swatch ${c===tryonState.lip?'active':''}" style="background:${c}" data-lip="${c}" aria-label="lip"></button>`).join('');$('#blushSwatches').innerHTML=blush.map(c=>`<button class="swatch ${c===tryonState.blush?'active':''}" style="background:${c}" data-blush="${c}" aria-label="blush"></button>`).join('');$$('[data-lip]').forEach(b=>b.onclick=()=>{tryonState.lip=b.dataset.lip;renderSwatches();renderTryon()});$$('[data-blush]').forEach(b=>b.onclick=()=>{tryonState.blush=b.dataset.blush;renderSwatches();renderTryon()});}
$('#tryonIntensity').addEventListener('input',e=>{tryonState.intensity=+e.target.value/100;renderTryon()});$('#resetTryon').addEventListener('click',()=>{tryonState={lip:'#b85d6a',blush:'#d88f92',intensity:.42};$('#tryonIntensity').value=42;renderSwatches();renderTryon()});
function renderTryon(){renderSwatches();const canvas=$('#tryonCanvas'),ctx=canvas.getContext('2d');if(!currentPhotoData||!currentAnalysis){$('#tryonEmpty').hidden=false;ctx.clearRect(0,0,canvas.width,canvas.height);return}$('#tryonEmpty').hidden=true;const img=new Image();img.onload=()=>{canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;ctx.drawImage(img,0,0);const lm=currentAnalysis.landmarks,W=canvas.width,H=canvas.height;const P=i=>({x:lm[i].x*W,y:lm[i].y*H});ctx.save();ctx.globalAlpha=tryonState.intensity;ctx.fillStyle=tryonState.blush;[205,425].forEach(i=>{const p=P(i),r=W*.055;const g=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,r);g.addColorStop(0,tryonState.blush);g.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fill()});ctx.fillStyle=tryonState.lip;ctx.beginPath();[61,146,91,181,84,17,314,405,321,375,291,308,324,318,402,317,14,87,178,88,95,78].forEach((i,idx)=>{const p=P(i);if(idx===0)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y)});ctx.closePath();ctx.fill();ctx.restore()};img.src=currentPhotoData}

$('#afterPhotoInput').addEventListener('change',e=>{const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=()=>{const img=$('#afterPreview');img.src=r.result;img.hidden=false;$('#afterAnalyzeBtn').disabled=false};r.readAsDataURL(f)});
$('#afterAnalyzeBtn').addEventListener('click',async()=>{const img=$('#afterPreview');try{await img.decode().catch(()=>{});const r=await analyzeFinishedMakeup(img);$('#afterResult').hidden=false;$('#afterScore').innerHTML=`<div class="overall-score-card"><div><span class="eyebrow">FINISH SCORE</span><h3>${(r.finish/10).toFixed(1)}<small>/10</small></h3></div><p>${lang==='zh'?'這是影像完成度估計，不是對你的外貌評價。':'This estimates visible makeup finish, not your attractiveness.'}</p></div>`;const tips=[];tips.push(r.evenness<74?(lang==='zh'?'底妝明暗仍有些不均，可在局部薄補，不建議全臉再加厚。':'Some visible tone variation remains; spot-correct rather than adding a full heavy layer.'):(lang==='zh'?'底妝在這張照片中的明暗分布相對均勻。':'Base tone appears relatively even in this image.'));tips.push(r.balance<76?(lang==='zh'?'左右眉眼或腮紅高度可對著鏡子再比一次。':'Compare brow/eye or blush height side-to-side in a mirror.'):(lang==='zh'?'左右妝容位置在照片中大致平衡。':'Makeup placement appears broadly balanced left-to-right.'));$('#afterTips').innerHTML=tips.map(x=>`<li>${x}</li>`).join('')}catch(e){alert(lang==='zh'?'沒有偵測到清楚正臉，請換一張照片。':'No clear face detected. Try another photo.')}});

function reviewData(){return store.get('reviews',[])}
function isPromo(text,disclosed){const x=text.toLowerCase();const patterns=[/https?:\/\//,/www\./,/#ad\b/,/#sponsored\b/,/業配/,/合作邀約/,/折扣碼/,/優惠碼/,/coupon/,/affiliate/,/use my code/,/promo code/];return disclosed||patterns.some(r=>r.test(x))}
function renderReviewOptions(){ $('#reviewProduct').innerHTML=products.map(p=>`<option value="${p.id}">${p.name}</option>`).join('') }
$('#reviewForm').addEventListener('submit',e=>{e.preventDefault();const text=$('#reviewText').value.trim(), disclosed=$('#reviewDisclosure').checked, r={id:Date.now(),product:$('#reviewProduct').value,rating:+$('#reviewRating').value,text,flagged:isPromo(text,disclosed),created:new Date().toLocaleDateString()};const d=reviewData();d.unshift(r);store.set('reviews',d);e.target.reset();renderReviews()});
$('#showFlagged').addEventListener('change',renderReviews);
function renderReviews(){const show=$('#showFlagged').checked;const d=reviewData().filter(r=>show||!r.flagged);$('#reviewList').innerHTML=d.map(r=>{const p=products.find(x=>x.id===r.product);return `<article class="review-card ${r.flagged?'flagged':''}"><div class="review-meta"><b>${p?.name||r.product} · ${'★'.repeat(r.rating)}</b>${r.flagged?`<span class="flag-label">${lang==='zh'?'可能含推廣':'Possible promo'}</span>`:''}</div><p>${escapeHtml(r.text)}</p><small>${r.created}</small></article>`}).join('')||`<p>${lang==='zh'?'目前沒有可顯示的評價。':'No reviews to show yet.'}</p>`}
function escapeHtml(s){return s.replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}

function progressData(){return store.get('progress',{learned:[],practice:0,mistakes:{Base:0,Eyes:0,Blush:0,Lips:0},recent:''})}
function toggleLearned(id){const p=progressData();p.learned=p.learned.includes(id)?p.learned.filter(x=>x!==id):[...p.learned,id];p.recent=id;store.set('progress',p);renderProgress()}
function renderProgress(){const p=progressData();$('#learnedCount').textContent=p.learned.length;$('#practiceCount').textContent=p.practice;$('#favoriteStyle').textContent=looks.find(l=>l.id===p.recent)?.name[lang]||'—';$('#learningLookList').innerHTML=looks.map(l=>`<label class="learn-row"><span>${l.name[lang]}</span><input type="checkbox" data-progress-look="${l.id}" ${p.learned.includes(l.id)?'checked':''}></label>`).join('');$$('[data-progress-look]').forEach(x=>x.onchange=()=>toggleLearned(x.dataset.progressLook));$('#mistakeList').innerHTML=Object.entries(p.mistakes).map(([k,v])=>`<div class="mistake-row"><span>${k}</span><div class="mistake-buttons"><button data-mistake="${k}" data-delta="-1">−</button><b>${v}</b><button data-mistake="${k}" data-delta="1">＋</button></div></div>`).join('');$$('[data-mistake]').forEach(b=>b.onclick=()=>{const d=progressData();d.mistakes[b.dataset.mistake]=Math.max(0,(d.mistakes[b.dataset.mistake]||0)+(+b.dataset.delta));store.set('progress',d);renderProgress()})}
$('#addPracticeBtn').addEventListener('click',()=>{const p=progressData();p.practice++;store.set('progress',p);renderProgress()});

$('#clearLocalData').addEventListener('click',()=>{if(confirm(lang==='zh'?'確定清除這台裝置上的 VIBEA 化妝包、評價、學習紀錄與分析紀錄？':'Clear VIBEA bag, reviews, progress and analysis records on this device?')){Object.keys(localStorage).filter(k=>k.startsWith('vibea-')).forEach(k=>localStorage.removeItem(k));location.reload()}});

function renderAll(){renderLooks();renderTutorials();renderProducts();renderOutfits();renderNews();renderCeleb();renderBag();renderReviewOptions();renderReviews();renderProgress()}
localize();
