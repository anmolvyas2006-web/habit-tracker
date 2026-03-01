import { useState, useEffect, useCallback, useRef } from "react";

/* ═══════════════════════════════════════════════════════════
   DESIGN TOKENS
═══════════════════════════════════════════════════════════ */
const C = {
  bg:"#070709", card:"#0F0F14", elevated:"#161621", hover:"#1C1C2A",
  border:"#1E1E2E", borderHi:"#2A2A3F",
  ink:"#F2F2F8", sub:"#7878A0", dim:"#3A3A55",
  indigo:"#6B63FF", violet:"#A78BFA",
  emerald:"#34D399", rose:"#FB7185", amber:"#FBBF24",
  sky:"#38BDF8", orange:"#FB923C", teal:"#2DD4BF", pink:"#F472B6",
};

const HABIT_PALETTE = ["#6B63FF","#34D399","#FB7185","#FBBF24","#38BDF8","#A78BFA","#F472B6","#2DD4BF","#FB923C","#10B981"];
const HABIT_ICONS   = ["🧘","💪","📚","🏃","💧","🥗","😴","✍️","🎯","🧠","🎨","🎵","🌿","☀️","🔥","💊","🚴","🧹","💻","🤸","🥤","📝","🏋️","🎻"];

const TIME_CATEGORIES = [
  {id:"work",     label:"Work",     color:"#6B63FF", icon:"💼"},
  {id:"study",    label:"Study",    color:"#38BDF8", icon:"📚"},
  {id:"exercise", label:"Exercise", color:"#34D399", icon:"💪"},
  {id:"personal", label:"Personal", color:"#FBBF24", icon:"🌿"},
  {id:"social",   label:"Social",   color:"#F472B6", icon:"💬"},
  {id:"creative", label:"Creative", color:"#A78BFA", icon:"🎨"},
  {id:"health",   label:"Health",   color:"#2DD4BF", icon:"❤️"},
  {id:"leisure",  label:"Leisure",  color:"#FB923C", icon:"🎮"},
];

/* ═══════════════════════════════════════════════════════════
   PERSISTENCE
═══════════════════════════════════════════════════════════ */
const LS = {
  get:(k,d)=>{ try{const v=localStorage.getItem(k);return v?JSON.parse(v):d;}catch{return d;} },
  set:(k,v)=>{ try{localStorage.setItem(k,JSON.stringify(v));}catch{} },
};

/* ═══════════════════════════════════════════════════════════
   DATE / TIME UTILS
═══════════════════════════════════════════════════════════ */
const isoDate  = (d=new Date()) => d.toISOString().split("T")[0];
const today    = () => isoDate();
const ago      = n => { const d=new Date(); d.setDate(d.getDate()-n); return isoDate(d); };
const range    = n => Array.from({length:n},(_,i)=>ago(n-1-i));
const dayLet   = d => "SMTWTFS"[new Date(d+"T12:00").getDay()];
const fmtDay   = () => new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"});
const fmtSecs  = s => { const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sc=s%60; return h>0?`${h}h ${m}m`:`${m}m ${sc}s`; };
const fmtHHMM  = s => { const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sc=s%60; return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(sc).padStart(2,"0")}`; };
const fmtHours = s => (s/3600).toFixed(1)+"h";
const nowHour  = () => new Date().getHours();
const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAY_NAMES   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

// "05:00" → 300 minutes from midnight
const timeStrToMins = t => { if(!t) return null; const [h,m]=t.split(":").map(Number); return h*60+m; };
// minutes → "5:00 AM"
const minsToDisplay = m => { if(m==null) return ""; const h=Math.floor(m/60),mn=m%60,ampm=h<12?"AM":"PM",hh=h%12||12; return `${hh}:${String(mn).padStart(2,"0")} ${ampm}`; };
// duration in minutes → "1h 30m"
const minsDuration = m => { const h=Math.floor(m/60),mn=m%60; return h>0?`${h}h${mn>0?` ${mn}m`:""}`:` ${mn}m`; };

// Current time in minutes from midnight
const nowMins = () => { const n=new Date(); return n.getHours()*60+n.getMinutes(); };

// Is habit time window "now"?
const isHabitActive = (habit) => {
  if(!habit.startTime || !habit.endTime) return false;
  const now=nowMins(), s=timeStrToMins(habit.startTime), e=timeStrToMins(habit.endTime);
  return now>=s && now<e;
};

// Minutes until start (positive = future, negative = started)
const minsUntilStart = (habit) => {
  if(!habit.startTime) return null;
  return timeStrToMins(habit.startTime) - nowMins();
};

const formatCountdown = (mins) => {
  if(mins==null) return null;
  const abs=Math.abs(mins);
  if(abs<60) return `${abs}m`;
  return `${Math.floor(abs/60)}h ${abs%60}m`;
};

/* ═══════════════════════════════════════════════════════════
   HABIT CALCULATORS
═══════════════════════════════════════════════════════════ */
const streak = (logs,hid) => {
  let s=0; const d=new Date();
  for(;;){
    const key=isoDate(d);
    const hit=logs.some(l=>l.hid===hid&&l.date===key);
    if(!hit){if(s===0&&key===today()){d.setDate(d.getDate()-1);continue;}break;}
    s++;d.setDate(d.getDate()-1);
  }
  return s;
};
const longest = (logs,hid) => {
  const dates=[...new Set(logs.filter(l=>l.hid===hid).map(l=>l.date))].sort();
  if(!dates.length) return 0;
  let mx=1,cu=1;
  for(let i=1;i<dates.length;i++){const d=(new Date(dates[i])-new Date(dates[i-1]))/86400000;d===1?(cu++,mx=Math.max(mx,cu)):(cu=1);}
  return mx;
};
const weekRate = (logs,hid) => { const l7=range(7); return Math.round(l7.filter(d=>logs.some(l=>l.hid===hid&&l.date===d)).length/7*100); };
const isDone   = (logs,hid) => logs.some(l=>l.hid===hid&&l.date===today());

/* ═══════════════════════════════════════════════════════════
   TIME SESSION CALCULATORS
═══════════════════════════════════════════════════════════ */
const sessionsByDate  = (sessions,date)  => sessions.filter(s=>s.date===date);
const sessionsByRange = (sessions,dates) => sessions.filter(s=>dates.includes(s.date));
const totalSecs       = (sessions)       => sessions.reduce((acc,s)=>acc+(s.duration||0),0);
const secsByCategory  = (sessions)       => { const map={}; sessions.forEach(s=>{map[s.catId]=(map[s.catId]||0)+(s.duration||0);}); return map; };
const hourlyBreakdown = (sessions,date)  => { const h=Array(24).fill(0); sessions.filter(s=>s.date===date).forEach(s=>{h[Math.min(s.startHour??0,23)]+=(s.duration||0);}); return h; };

/* ═══════════════════════════════════════════════════════════
   GLOBAL CSS
═══════════════════════════════════════════════════════════ */
const GlobalCSS = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@300;400;500;600;700;800;900&family=Outfit:wght@300;400;500;600;700;800&display=swap');
    *,*::before,*::after{box-sizing:border-box;-webkit-tap-highlight-color:transparent;margin:0;padding:0;}
    html,body{background:${C.bg};color:${C.ink};font-family:'Outfit',system-ui,sans-serif;overscroll-behavior:none;-webkit-font-smoothing:antialiased;line-height:1.5;font-weight:400;}
    input,button,select{font-family:inherit;outline:none;}
    input[type="time"]::-webkit-calendar-picker-indicator{filter:invert(1);opacity:.5;}
    input::placeholder{color:${C.dim};}
    ::-webkit-scrollbar{width:3px;}
    ::-webkit-scrollbar-thumb{background:${C.border};border-radius:99px;}
    @keyframes fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
    @keyframes fadeIn{from{opacity:0}to{opacity:1}}
    @keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
    @keyframes popRing{0%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(1.1)}}
    @keyframes checkBounce{0%{transform:scale(1)}40%{transform:scale(1.35)}70%{transform:scale(.9)}100%{transform:scale(1)}}
    @keyframes pulse{0%,100%{opacity:.4}50%{opacity:1}}
    @keyframes ticker{from{opacity:0;transform:scale(.92)}to{opacity:1;transform:scale(1)}}
    @keyframes glow{0%,100%{box-shadow:0 0 0 0 transparent}50%{box-shadow:0 0 20px 4px var(--glow)}}
    @keyframes confetti{0%{transform:translate(0,0)rotate(0deg);opacity:1}100%{transform:translate(var(--tx),var(--ty))rotate(var(--r));opacity:0}}
    .tappable:active{transform:scale(.97);transition:transform .1s;}
    .hab-card:hover{background:${C.elevated};}
  `}</style>
);

/* ═══════════════════════════════════════════════════════════
   ATOMS
═══════════════════════════════════════════════════════════ */
const Ring = ({pct,size=80,stroke=7,color=C.indigo,children}) => {
  const r=size/2-stroke/2, circ=2*Math.PI*r;
  return (
    <div style={{position:"relative",width:size,height:size,flexShrink:0}}>
      <svg width={size} height={size} style={{display:"block"}}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.elevated} strokeWidth={stroke}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={circ*(1-Math.min(pct,100)/100)}
          transform={`rotate(-90 ${size/2} ${size/2})`} style={{transition:"stroke-dashoffset .9s cubic-bezier(.4,0,.2,1)"}}/>
      </svg>
      <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column"}}>{children}</div>
    </div>
  );
};

const Chip = ({children,color,style={}}) => (
  <span style={{display:"inline-flex",alignItems:"center",gap:4,background:color+"18",border:`1px solid ${color}35`,borderRadius:99,padding:"2px 9px",fontSize:11,fontWeight:700,color,letterSpacing:.3,...style}}>{children}</span>
);

const SLabel = ({children}) => (
  <p style={{fontSize:11,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:1.4,marginBottom:12}}>{children}</p>
);

const PBar = ({pct,color,h=5}) => (
  <div style={{height:h,background:C.elevated,borderRadius:99,overflow:"hidden"}}>
    <div style={{height:"100%",width:`${Math.min(pct,100)}%`,background:color,borderRadius:99,transition:"width .8s ease"}}/>
  </div>
);

const Confetti = ({color,active}) => {
  if(!active) return null;
  return (
    <div style={{position:"absolute",inset:0,pointerEvents:"none",zIndex:20}}>
      {Array.from({length:10},(_,i)=>(
        <div key={i} style={{position:"absolute",top:"50%",left:"50%",width:i%2===0?5:4,height:i%2===0?5:7,borderRadius:i%2===0?"50%":2,background:[color,C.amber,"#fff"][i%3],"--tx":`${(Math.random()-.5)*80}px`,"--ty":`${-(20+Math.random()*60)}px`,"--r":`${(Math.random()-.5)*360}deg`,animation:`confetti .55s ${i*30}ms ease-out forwards`,opacity:0}}/>
      ))}
    </div>
  );
};

const WeekStrip = ({logs,hid,color}) => (
  <div style={{display:"flex",gap:5}}>
    {range(7).map(d=>{
      const done=logs.some(l=>l.hid===hid&&l.date===d),isToday=d===today();
      return (
        <div key={d} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
          <div style={{width:30,height:30,borderRadius:9,background:done?color:C.elevated,border:`1.5px solid ${done?color+"66":isToday?C.borderHi:"transparent"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:done?"#fff":C.dim,fontWeight:700,transition:"all .2s",boxShadow:done?`0 2px 10px ${color}44`:"none"}}>{done?"✓":""}</div>
          <span style={{fontSize:9,color:isToday?color:C.dim,fontWeight:isToday?800:600}}>{dayLet(d)}</span>
        </div>
      );
    })}
  </div>
);

/* ═══════════════════════════════════════════════════════════
   TIME BADGE — shows on habit card
═══════════════════════════════════════════════════════════ */
const TimeBadge = ({habit, nowMin}) => {
  if(!habit.startTime) return null;
  const active = isHabitActive(habit);
  const start  = timeStrToMins(habit.startTime);
  const end    = habit.endTime ? timeStrToMins(habit.endTime) : null;
  const minsLeft = end!=null ? end-nowMin : null;
  const minsAway = start-nowMin;

  // ACTIVE — window is now
  if(active) {
    const pct = end!=null ? Math.round(((nowMin-start)/(end-start))*100) : 0;
    return (
      <div style={{display:"flex",alignItems:"center",gap:8,marginTop:8,padding:"8px 12px",background:`${habit.color}12`,border:`1px solid ${habit.color}35`,borderRadius:12}}>
        <div style={{width:7,height:7,borderRadius:"50%",background:habit.color,animation:"pulse 1.2s infinite",flexShrink:0}}/>
        <div style={{flex:1}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
            <span style={{fontSize:12,fontWeight:700,color:habit.color}}>🕐 Happening now</span>
            {minsLeft!=null&&<span style={{fontSize:11,color:C.sub,fontWeight:600}}>{formatCountdown(minsLeft)} left</span>}
          </div>
          {end!=null&&<PBar pct={pct} color={habit.color} h={3}/>}
        </div>
      </div>
    );
  }

  // UPCOMING within 60 mins
  if(minsAway>0 && minsAway<=60) {
    return (
      <div style={{display:"flex",alignItems:"center",gap:8,marginTop:8,padding:"7px 12px",background:`${C.amber}10`,border:`1px solid ${C.amber}30`,borderRadius:12}}>
        <span style={{fontSize:13}}>⏰</span>
        <span style={{fontSize:12,fontWeight:600,color:C.amber}}>
          Starts in {formatCountdown(minsAway)} · {minsToDisplay(start)}
          {end!=null?` – ${minsToDisplay(end)}`:""}
        </span>
      </div>
    );
  }

  // DEFAULT — just show scheduled time
  return (
    <div style={{display:"inline-flex",alignItems:"center",gap:5,marginTop:6,padding:"4px 10px",background:C.elevated,border:`1px solid ${C.border}`,borderRadius:10}}>
      <span style={{fontSize:11}}>🕐</span>
      <span style={{fontSize:11,fontWeight:600,color:C.sub}}>
        {minsToDisplay(start)}{end!=null?` – ${minsToDisplay(end)}`:""}
        {end!=null&&start<end?` · ${minsDuration(end-start)}`:""}
      </span>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════
   HABIT CARD
═══════════════════════════════════════════════════════════ */
const HabitCard = ({habit,logs,onToggle,onPress,onDelete,idx,nowMin}) => {
  const [burst,setBurst]       = useState(false);
  const [bounce,setBounce]     = useState(false);
  const [confirmDel,setConfirm]= useState(false);  // two-tap confirm
  const done   = isDone(logs,habit.id);
  const s      = streak(logs,habit.id);
  const active = isHabitActive(habit);

  // auto-cancel confirm after 3 s if user ignores
  useEffect(()=>{
    if(!confirmDel) return;
    const t=setTimeout(()=>setConfirm(false),3000);
    return()=>clearTimeout(t);
  },[confirmDel]);

  const handleCheck = e => {
    e.stopPropagation();
    setConfirm(false);
    if(!done){setBurst(true);setBounce(true);setTimeout(()=>setBurst(false),700);setTimeout(()=>setBounce(false),500);}
    onToggle(habit.id);
  };

  const handleDeleteTap = e => {
    e.stopPropagation();
    if(confirmDel){ onDelete(habit.id); }
    else { setConfirm(true); }
  };

  return (
    <div className="hab-card tappable" onClick={()=>{setConfirm(false);onPress(habit);}} style={{
      background:C.card,
      border:`1px solid ${confirmDel?C.rose+"55":active?habit.color+"66":done?habit.color+"44":C.border}`,
      borderRadius:22,padding:"18px 18px 14px",marginBottom:10,cursor:"pointer",
      position:"relative",overflow:"hidden",
      animation:`fadeUp .4s ${idx*60}ms both`,
      boxShadow:confirmDel?`0 4px 24px ${C.rose}22`:active?`0 0 0 1px ${habit.color}44,0 6px 32px ${habit.color}22`:done?`0 4px 28px ${habit.color}18,0 0 0 1px ${habit.color}22`:"none",
      transition:"background .2s,border-color .25s,box-shadow .25s",
    }}>
      {/* top accent bar */}
      <div style={{position:"absolute",top:0,left:0,right:0,height:2.5,background:`linear-gradient(90deg,${confirmDel?C.rose:habit.color},transparent 70%)`,opacity:done||active||confirmDel?1:0,transition:"opacity .3s",borderRadius:"22px 22px 0 0"}}/>
      {bounce&&<div style={{position:"absolute",inset:0,borderRadius:22,border:`2px solid ${habit.color}`,animation:"popRing .6s ease-out forwards",pointerEvents:"none"}}/>}
      <Confetti color={habit.color} active={burst}/>

      {/* ── MAIN ROW ── */}
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:0}}>
        {/* icon */}
        <div style={{width:50,height:50,borderRadius:16,flexShrink:0,background:habit.color+"18",border:`1.5px solid ${habit.color}${active?"88":"40"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,transition:"border-color .3s"}}>{habit.icon}</div>

        {/* info */}
        <div style={{flex:1,minWidth:0}}>
          <p style={{fontSize:15,fontWeight:700,margin:"0 0 3px",color:done?C.sub:C.ink,textDecoration:done?"line-through":"none",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{habit.name}</p>
          <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
            {s>0?<Chip color={habit.color}>🔥 {s} day streak</Chip>:<span style={{fontSize:11,color:C.dim,fontWeight:500}}>No streak yet</span>}
            {habit.freq&&<span style={{fontSize:10,color:C.dim,fontWeight:500}}>{habit.freq}</span>}
          </div>
        </div>

        {/* ── ACTION BUTTONS ── */}
        <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
          {/* DELETE button */}
          <button onClick={handleDeleteTap}
            title={confirmDel?"Tap again to confirm delete":"Delete habit"}
            style={{
              width:36, height:36, borderRadius:11, cursor:"pointer",
              border:`1.5px solid ${confirmDel?C.rose:C.border}`,
              background: confirmDel?`${C.rose}22`:"transparent",
              color: confirmDel?C.rose:C.dim,
              display:"flex",alignItems:"center",justifyContent:"center",
              transition:"all .2s cubic-bezier(.34,1.56,.64,1)",
              transform: confirmDel?"scale(1.1)":"scale(1)",
              fontSize:15,
            }}>
            {confirmDel
              ? /* trash confirm icon */
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
              : /* dots / kebab */
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            }
          </button>

          {/* CHECK button */}
          <button onClick={handleCheck}
            style={{width:46,height:46,borderRadius:15,flexShrink:0,cursor:"pointer",
              border:`2px solid ${done?habit.color:C.borderHi}`,
              background:done?habit.color:"transparent",
              color:"#fff",fontSize:20,fontWeight:700,
              display:"flex",alignItems:"center",justifyContent:"center",
              animation:bounce?"checkBounce .4s ease":"none",
              transition:"background .2s,border-color .2s,box-shadow .2s",
              boxShadow:done?`0 4px 16px ${habit.color}55`:"none",
            }}>{done?"✓":""}</button>
        </div>
      </div>

      {/* Confirm delete banner */}
      {confirmDel&&(
        <div style={{marginTop:10,padding:"8px 12px",background:`${C.rose}14`,border:`1px solid ${C.rose}30`,borderRadius:11,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <span style={{fontSize:12,fontWeight:600,color:C.rose}}>🗑 Tap delete again to confirm</span>
          <button onClick={e=>{e.stopPropagation();setConfirm(false);}}
            style={{fontSize:11,fontWeight:700,color:C.sub,background:"none",border:"none",cursor:"pointer",padding:"2px 6px"}}>Cancel</button>
        </div>
      )}

      {/* Time badge */}
      <TimeBadge habit={habit} nowMin={nowMin}/>

      {/* week strip */}
      <div style={{marginTop:12,paddingTop:12,borderTop:`1px solid ${C.border}`}}>
        <WeekStrip logs={logs} hid={habit.id} color={habit.color}/>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════
   SCHEDULE TIMELINE (Today view top)
═══════════════════════════════════════════════════════════ */
const ScheduleTimeline = ({habits, logs, nowMin, onToggle}) => {
  const scheduled = habits.filter(h=>h.startTime).sort((a,b)=>timeStrToMins(a.startTime)-timeStrToMins(b.startTime));
  if(!scheduled.length) return null;

  return (
    <div style={{background:C.card,borderRadius:20,padding:"16px 18px",marginBottom:14,border:`1px solid ${C.border}`,animation:"fadeUp .44s both"}}>
      <SLabel>Today's Schedule</SLabel>
      <div style={{position:"relative",paddingLeft:28}}>
        {/* vertical connector line */}
        <div style={{position:"absolute",left:10,top:12,bottom:12,width:1.5,background:`linear-gradient(180deg,${C.indigo}88,${C.border})`,borderRadius:99}}/>

        {scheduled.map((h,i)=>{
          const active = isHabitActive(h);
          const done   = isDone(logs, h.id);   // ← real logs now
          const start  = timeStrToMins(h.startTime);
          const end    = h.endTime ? timeStrToMins(h.endTime) : null;
          const past   = !active && (end!=null ? nowMin>end : nowMin>start);

          /* radio dot colour logic */
          const dotColor = done ? h.color : active ? h.color : past ? C.dim : C.border;

          return (
            <div key={h.id} style={{display:"flex",alignItems:"center",gap:14,marginBottom:i<scheduled.length-1?14:0,position:"relative"}}>

              {/* ── RADIO / COMPLETION BUTTON ── */}
              <button
                onClick={e=>{e.stopPropagation();onToggle(h.id);}}
                title={done?"Mark incomplete":"Mark complete"}
                style={{
                  width:22, height:22, borderRadius:"50%", flexShrink:0,
                  border:`2px solid ${done?h.color:active?h.color:past?C.dim:C.borderHi}`,
                  background: done ? h.color : "transparent",
                  cursor:"pointer",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  boxShadow: done?`0 0 10px ${h.color}66`:active?`0 0 8px ${h.color}44`:"none",
                  transition:"all .25s cubic-bezier(.34,1.56,.64,1)",
                  position:"relative", zIndex:1,
                  marginLeft:-28+10,   /* align over the vertical line */
                  padding:0,
                }}>
                {/* inner filled circle when NOT done (radio style) */}
                {!done && (
                  <div style={{
                    width:8, height:8, borderRadius:"50%",
                    background: active?h.color:past?C.dim:C.dim,
                    opacity: active?1:0.35,
                    transition:"all .2s",
                  }}/>
                )}
                {/* checkmark when done */}
                {done && (
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                    <polyline points="2,6 5,9 10,3" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </button>

              {/* ── TEXT INFO ── */}
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:1}}>
                  <span style={{fontSize:15}}>{h.icon}</span>
                  <span style={{
                    fontSize:13, fontWeight:700,
                    color: done?C.sub : active?h.color : past?C.sub : C.ink,
                    textDecoration: done?"line-through":"none",
                    transition:"color .2s",
                    overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                  }}>{h.name}</span>
                  {active && !done && <Chip color={h.color} style={{fontSize:9,padding:"1px 7px",flexShrink:0}}>NOW</Chip>}
                  {done && <Chip color={C.emerald} style={{fontSize:9,padding:"1px 7px",flexShrink:0}}>✓ Done</Chip>}
                </div>
                <span style={{fontSize:11,color:done?C.dim:C.sub,fontWeight:500}}>
                  {minsToDisplay(start)}{end!=null?` – ${minsToDisplay(end)}`:""}
                  {end!=null&&end>start?` · ${minsDuration(end-start)}`:""}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════
   TODAY SCREEN
═══════════════════════════════════════════════════════════ */
const TodayScreen = ({habits,logs,onToggle,onAdd,onPress,onDelete}) => {
  const [nowMin,setNowMin] = useState(nowMins());

  // Update every minute for live countdowns
  useEffect(()=>{
    const t=setInterval(()=>setNowMin(nowMins()),30000);
    return ()=>clearInterval(t);
  },[]);

  const doneCount=habits.filter(h=>isDone(logs,h.id)).length, total=habits.length;
  const pct=total?Math.round(doneCount/total*100):0, allDone=total>0&&doneCount===total;
  const hr=new Date().getHours();
  const greet=hr<12?"Good morning":hr<17?"Good afternoon":"Good evening";
  const emoji=hr<12?"☀️":hr<17?"⛅":"🌙";

  // Sort: active time window first, then upcoming, then rest
  const sortedHabits = [...habits].sort((a,b)=>{
    const aActive=isHabitActive(a)?0:1, bActive=isHabitActive(b)?0:1;
    if(aActive!==bActive) return aActive-bActive;
    const aStart=timeStrToMins(a.startTime)??9999, bStart=timeStrToMins(b.startTime)??9999;
    return aStart-bStart;
  });

  return (
    <div style={{padding:"0 16px"}}>
      <div style={{marginBottom:20,animation:"fadeUp .4s both"}}>
        <p style={{fontSize:13,color:C.sub,fontWeight:500,marginBottom:4}}>{greet} {emoji}</p>
        <h1 style={{fontSize:26,fontWeight:800,color:allDone?C.emerald:C.ink,transition:"color .5s",fontFamily:"'Nunito','Outfit',system-ui,sans-serif",letterSpacing:"-.3px"}}>{allDone?"All done today! 🎉":"Today's Habits"}</h1>
        <p style={{fontSize:13,color:C.sub,marginTop:2}}>{fmtDay()}</p>
      </div>

      {/* Progress ring */}
      {total>0&&(
        <div style={{background:C.card,borderRadius:22,padding:"18px 20px",border:`1px solid ${allDone?C.emerald+"55":C.border}`,marginBottom:14,animation:"fadeUp .43s both",boxShadow:allDone?`0 0 50px ${C.emerald}14`:"none",transition:"all .4s"}}>
          <div style={{display:"flex",alignItems:"center",gap:18}}>
            <Ring pct={pct} size={74} color={allDone?C.emerald:C.indigo}>
              <span style={{fontSize:15,fontWeight:800,color:allDone?C.emerald:C.indigo,fontFamily:"'Nunito','Outfit',system-ui,sans-serif"}}>{pct}%</span>
            </Ring>
            <div style={{flex:1}}>
              <SLabel>Daily Progress</SLabel>
              <p style={{fontSize:26,fontWeight:800,marginBottom:7,fontFamily:"'Nunito','Outfit',system-ui,sans-serif",letterSpacing:"-.3px"}}>{doneCount}<span style={{fontSize:16,color:C.sub,fontWeight:500}}>/{total} done</span></p>
              <PBar pct={pct} color={allDone?C.emerald:C.indigo}/>
            </div>
          </div>
        </div>
      )}

      {/* Schedule timeline */}
      <ScheduleTimeline habits={habits} logs={logs} nowMin={nowMin} onToggle={onToggle}/>

      {/* Empty state */}
      {habits.length===0&&(
        <div style={{textAlign:"center",padding:"60px 24px",background:C.card,borderRadius:22,border:`1px dashed ${C.border}`,animation:"fadeUp .5s both"}}>
          <div style={{fontSize:48,marginBottom:16}}>✨</div>
          <h3 style={{fontSize:19,fontWeight:800,marginBottom:8,fontFamily:"'Nunito','Outfit',system-ui,sans-serif"}}>No habits yet</h3>
          <p style={{fontSize:14,color:C.sub,lineHeight:1.7,marginBottom:22}}>Tap + to create your first habit.<br/>You can add a scheduled time too!</p>
          <button onClick={onAdd} style={{padding:"12px 26px",fontSize:14,fontWeight:700,cursor:"pointer",background:`linear-gradient(135deg,${C.indigo},${C.violet})`,border:"none",borderRadius:14,color:"#fff",boxShadow:`0 6px 24px ${C.indigo}44`}}>+ Create First Habit</button>
        </div>
      )}

      {sortedHabits.map((h,i)=>(
        <HabitCard key={h.id} habit={h} logs={logs} onToggle={onToggle} onPress={onPress} onDelete={onDelete} idx={i} nowMin={nowMin}/>
      ))}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════
   HABIT SHEET  (add / edit) — with time picker
═══════════════════════════════════════════════════════════ */
const HabitSheet = ({habit,onSave,onDelete,onClose}) => {
  const isEdit=!!habit;
  const [name,setName]           = useState(habit?.name||"");
  const [icon,setIcon]           = useState(habit?.icon||"⭐");
  const [color,setColor]         = useState(habit?.color||HABIT_PALETTE[0]);
  const [freq,setFreq]           = useState(habit?.freq||"Daily");
  const [startTime,setStartTime] = useState(habit?.startTime||"");
  const [endTime,setEndTime]     = useState(habit?.endTime||"");
  const [hasTime,setHasTime]     = useState(!!(habit?.startTime));

  const pal=HABIT_PALETTE.find(p=>p===color)||HABIT_PALETTE[0];

  const handleSave = () => {
    if(!name.trim()) return;
    onSave({
      id:habit?.id||`${Date.now()}`,
      name:name.trim(), icon, color, freq,
      startTime: hasTime&&startTime?startTime:null,
      endTime:   hasTime&&endTime?endTime:null,
    });
  };

  return (
    <div style={{position:"fixed",inset:0,background:"#000000BB",backdropFilter:"blur(14px)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:400,animation:"fadeIn .2s both"}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:C.card,borderRadius:"24px 24px 0 0",border:`1px solid ${C.border}`,width:"100%",maxWidth:520,maxHeight:"95vh",overflowY:"auto",animation:"slideUp .32s cubic-bezier(.22,1,.36,1) both",paddingBottom:44}}>

        {/* handle */}
        <div style={{display:"flex",justifyContent:"center",padding:"12px 0 6px"}}>
          <div style={{width:40,height:4,borderRadius:99,background:C.border}}/>
        </div>

        {/* title bar */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 20px 18px"}}>
          <p style={{fontSize:19,fontWeight:800,fontFamily:"'Nunito','Outfit',system-ui,sans-serif"}}>{isEdit?"Edit Habit":"New Habit"}</p>
          <button onClick={onClose} style={{fontSize:15,background:"none",border:`1px solid ${C.border}`,borderRadius:10,padding:"7px 12px",color:C.sub,cursor:"pointer"}}>✕</button>
        </div>

        {/* live preview */}
        <div style={{display:"flex",justifyContent:"center",marginBottom:24}}>
          <div style={{width:80,height:80,borderRadius:24,background:`${color}22`,border:`2px solid ${color}55`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:38,boxShadow:`0 10px 36px ${color}40`,transition:"all .25s"}}>
            {icon}
          </div>
        </div>

        <div style={{padding:"0 20px"}}>
          {/* Name */}
          <SLabel>Habit Name</SLabel>
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Morning Meditation" maxLength={40}
            style={{width:"100%",background:C.elevated,border:`1px solid ${C.border}`,borderRadius:13,padding:"13px 15px",color:C.ink,fontSize:15,marginBottom:20}}/>

          {/* ── SCHEDULED TIME SECTION ── */}
          <div style={{marginBottom:20}}>
            {/* toggle */}
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
              <SLabel>Scheduled Time</SLabel>
              <button onClick={()=>{setHasTime(!hasTime);if(hasTime){setStartTime("");setEndTime("");}}}
                style={{display:"flex",alignItems:"center",gap:8,background:"none",border:"none",cursor:"pointer",padding:0}}>
                <div style={{width:44,height:24,borderRadius:99,background:hasTime?color:C.elevated,border:`1.5px solid ${hasTime?color:C.borderHi}`,transition:"all .25s",position:"relative",flexShrink:0}}>
                  <div style={{position:"absolute",top:2,left:hasTime?22:2,width:18,height:18,borderRadius:"50%",background:"#fff",transition:"left .25s",boxShadow:"0 1px 4px #00000040"}}/>
                </div>
                <span style={{fontSize:12,fontWeight:600,color:hasTime?color:C.sub}}>{hasTime?"On":"Off"}</span>
              </button>
            </div>

            {hasTime&&(
              <div style={{background:C.elevated,borderRadius:16,padding:16,border:`1px solid ${color}30`}}>
                {/* visual time display */}
                {startTime&&(
                  <div style={{textAlign:"center",marginBottom:14,padding:"12px",background:`${color}12`,borderRadius:12,border:`1px solid ${color}25`}}>
                    <p style={{fontSize:22,fontWeight:800,color,fontFamily:"'Nunito','Outfit',system-ui,sans-serif",letterSpacing:"-.3px"}}>
                      {minsToDisplay(timeStrToMins(startTime))}
                      {endTime&&<span style={{fontSize:16,color:C.sub,fontWeight:500}}> – {minsToDisplay(timeStrToMins(endTime))}</span>}
                    </p>
                    {startTime&&endTime&&timeStrToMins(endTime)>timeStrToMins(startTime)&&(
                      <p style={{fontSize:12,color:C.sub,marginTop:3}}>
                        Duration: {minsDuration(timeStrToMins(endTime)-timeStrToMins(startTime))}
                      </p>
                    )}
                  </div>
                )}

                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                  {/* Start time */}
                  <div>
                    <p style={{fontSize:11,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Start Time</p>
                    <div style={{position:"relative"}}>
                      <input type="time" value={startTime} onChange={e=>setStartTime(e.target.value)}
                        style={{width:"100%",background:C.card,border:`1.5px solid ${startTime?color:C.border}`,borderRadius:11,padding:"11px 12px",color:C.ink,fontSize:14,fontWeight:600,transition:"border-color .2s"}}/>
                    </div>
                    {startTime&&<p style={{fontSize:11,color:color,marginTop:4,fontWeight:600}}>⏰ {minsToDisplay(timeStrToMins(startTime))}</p>}
                  </div>

                  {/* End time */}
                  <div>
                    <p style={{fontSize:11,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>End Time</p>
                    <div style={{position:"relative"}}>
                      <input type="time" value={endTime} onChange={e=>setEndTime(e.target.value)}
                        style={{width:"100%",background:C.card,border:`1.5px solid ${endTime?color:C.border}`,borderRadius:11,padding:"11px 12px",color:C.ink,fontSize:14,fontWeight:600,transition:"border-color .2s"}}/>
                    </div>
                    {endTime&&<p style={{fontSize:11,color:C.sub,marginTop:4,fontWeight:600}}>🏁 {minsToDisplay(timeStrToMins(endTime))}</p>}
                  </div>
                </div>

                {/* Quick time presets */}
                <div style={{marginTop:14}}>
                  <p style={{fontSize:11,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Quick Presets</p>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    {[
                      {label:"Early Morning",start:"05:00",end:"06:00"},
                      {label:"Morning",start:"06:00",end:"07:00"},
                      {label:"Forenoon",start:"09:00",end:"10:00"},
                      {label:"Noon",start:"12:00",end:"13:00"},
                      {label:"Afternoon",start:"15:00",end:"16:00"},
                      {label:"Evening",start:"18:00",end:"19:00"},
                      {label:"Night",start:"21:00",end:"22:00"},
                    ].map(p=>(
                      <button key={p.label} onClick={()=>{setStartTime(p.start);setEndTime(p.end);}}
                        style={{fontSize:11,fontWeight:600,padding:"5px 10px",background:startTime===p.start?`${color}22`:C.card,border:`1px solid ${startTime===p.start?color:C.border}`,borderRadius:8,color:startTime===p.start?color:C.sub,cursor:"pointer",transition:"all .15s"}}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Icons */}
          <SLabel>Icon</SLabel>
          <div style={{display:"grid",gridTemplateColumns:"repeat(8,1fr)",gap:7,marginBottom:20}}>
            {HABIT_ICONS.map(ic=>(
              <button key={ic} onClick={()=>setIcon(ic)} style={{fontSize:21,background:ic===icon?`${color}22`:C.elevated,border:`2px solid ${ic===icon?color:"transparent"}`,borderRadius:11,padding:"6px 0",cursor:"pointer",transition:"all .15s"}}>{ic}</button>
            ))}
          </div>

          {/* Colors */}
          <SLabel>Color</SLabel>
          <div style={{display:"flex",gap:9,flexWrap:"wrap",marginBottom:20}}>
            {HABIT_PALETTE.map(p=>(
              <button key={p} onClick={()=>setColor(p)} style={{width:36,height:36,borderRadius:"50%",background:p,border:`3px solid ${p===color?"#fff":"transparent"}`,cursor:"pointer",outline:`2.5px solid ${p===color?p:"transparent"}`,outlineOffset:2,transition:"transform .15s",transform:p===color?"scale(1.15)":"scale(1)"}}/>
            ))}
          </div>

          {/* Frequency */}
          <SLabel>Frequency</SLabel>
          <div style={{display:"flex",gap:8,marginBottom:26}}>
            {["Daily","Weekdays","Weekends"].map(f=>(
              <button key={f} onClick={()=>setFreq(f)} style={{flex:1,padding:"11px 0",borderRadius:12,border:`2px solid ${freq===f?color:C.border}`,background:freq===f?`${color}18`:C.elevated,color:freq===f?color:C.sub,fontWeight:700,fontSize:12,cursor:"pointer",transition:"all .15s"}}>{f}</button>
            ))}
          </div>

          {/* Save */}
          <button onClick={handleSave} style={{width:"100%",padding:"15px",fontSize:15,fontWeight:800,cursor:name.trim()?"pointer":"not-allowed",background:name.trim()?`linear-gradient(135deg,${color},${color}CC)`:C.elevated,border:"none",borderRadius:15,color:name.trim()?"#fff":C.dim,boxShadow:name.trim()?`0 6px 24px ${color}44`:"none",transition:"all .2s",marginBottom:10,fontFamily:"'Nunito','Outfit',system-ui,sans-serif"}}>
            {isEdit?"Save Changes":"Create Habit"}
          </button>
          {isEdit&&(
            <button onClick={()=>onDelete(habit.id)} style={{width:"100%",padding:"13px",fontSize:14,fontWeight:700,background:`${C.rose}14`,border:`1px solid ${C.rose}30`,borderRadius:15,color:C.rose,cursor:"pointer"}}>
              Delete Habit
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════
   DETAIL SHEET
═══════════════════════════════════════════════════════════ */
const DetailSheet = ({habit,logs,onClose,onEdit}) => {
  const s=streak(logs,habit.id),lng=longest(logs,habit.id),r=weekRate(logs,habit.id),tot=logs.filter(l=>l.hid===habit.id).length;
  const nowMin=nowMins();
  return (
    <div style={{position:"fixed",inset:0,background:"#000000AA",backdropFilter:"blur(12px)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:400,animation:"fadeIn .2s both"}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:C.card,borderRadius:"24px 24px 0 0",border:`1px solid ${C.border}`,width:"100%",maxWidth:520,maxHeight:"90vh",overflowY:"auto",animation:"slideUp .32s cubic-bezier(.22,1,.36,1) both",paddingBottom:40}}>
        <div style={{display:"flex",justifyContent:"center",padding:"12px 0 6px"}}><div style={{width:40,height:4,borderRadius:99,background:C.border}}/></div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 20px 16px"}}>
          <p style={{fontSize:18,fontWeight:800,fontFamily:"'Nunito','Outfit',system-ui,sans-serif"}}>Habit Details</p>
          <div style={{display:"flex",gap:8}}>
            <button onClick={onEdit} style={{fontSize:13,fontWeight:700,background:`${habit.color}18`,border:`1px solid ${habit.color}44`,borderRadius:10,padding:"8px 14px",color:habit.color,cursor:"pointer"}}>Edit</button>
            <button onClick={onClose} style={{fontSize:15,background:"none",border:`1px solid ${C.border}`,borderRadius:10,padding:"8px 12px",color:C.sub,cursor:"pointer"}}>✕</button>
          </div>
        </div>

        <div style={{margin:"0 20px 18px",background:`${habit.color}12`,borderRadius:18,padding:"16px",border:`1px solid ${habit.color}30`}}>
          <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:habit.startTime?12:0}}>
            <div style={{width:54,height:54,borderRadius:16,background:`${habit.color}22`,border:`2px solid ${habit.color}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26}}>{habit.icon}</div>
            <div>
              <p style={{fontSize:19,fontWeight:800,fontFamily:"'Nunito','Outfit',system-ui,sans-serif"}}>{habit.name}</p>
              <div style={{display:"flex",gap:6,marginTop:4,flexWrap:"wrap"}}>
                <Chip color={habit.color}>{habit.freq||"Daily"}</Chip>
                {habit.startTime&&(
                  <Chip color={C.sub}>🕐 {minsToDisplay(timeStrToMins(habit.startTime))}{habit.endTime?` – ${minsToDisplay(timeStrToMins(habit.endTime))}`:""}  </Chip>
                )}
              </div>
            </div>
          </div>
          {habit.startTime&&<TimeBadge habit={habit} nowMin={nowMin}/>}
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,margin:"0 20px 18px"}}>
          {[{label:"Current Streak",val:`${s}d`,icon:"🔥",color:habit.color},{label:"Best Streak",val:`${lng}d`,icon:"🏆",color:C.amber},{label:"Weekly Rate",val:`${r}%`,icon:"📊",color:C.sky},{label:"Total Done",val:`${tot}`,icon:"✅",color:C.emerald}].map((st,i)=>(
            <div key={i} style={{background:C.elevated,borderRadius:14,padding:"14px",textAlign:"center"}}>
              <div style={{fontSize:20,marginBottom:6}}>{st.icon}</div>
              <div style={{fontSize:21,fontWeight:800,color:st.color,fontFamily:"'Nunito','Outfit',system-ui,sans-serif"}}>{st.val}</div>
              <div style={{fontSize:11,color:C.sub,marginTop:2}}>{st.label}</div>
            </div>
          ))}
        </div>

        <div style={{margin:"0 20px"}}>
          <SLabel>Last 30 Days</SLabel>
          <div style={{display:"grid",gridTemplateColumns:"repeat(10,1fr)",gap:5}}>
            {range(30).map(d=>{const done=logs.some(l=>l.hid===habit.id&&l.date===d);return(<div key={d} title={d} style={{aspectRatio:"1",borderRadius:5,background:done?habit.color:C.elevated,transition:"all .2s",boxShadow:done?`0 2px 8px ${habit.color}55`:"none"}}/>);})}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════
   STATS SCREEN
═══════════════════════════════════════════════════════════ */
const StatsScreen = ({habits,logs}) => {
  const l30=range(30),totalDone=logs.length,weekDone=logs.filter(l=>range(7).includes(l.date)).length;
  const topLongest=Math.max(0,...habits.map(h=>longest(logs,h.id))),topStreak=Math.max(0,...habits.map(h=>streak(logs,h.id)));
  const dayCounts=[0,1,2,3,4,5,6].map(i=>logs.filter(l=>new Date(l.date+"T12:00").getDay()===i).length);
  const maxDay=Math.max(1,...dayCounts);
  return (
    <div style={{padding:"0 16px"}}>
      <div style={{marginBottom:22,animation:"fadeUp .4s both"}}>
        <h1 style={{fontSize:26,fontWeight:800,fontFamily:"'Nunito','Outfit',system-ui,sans-serif",letterSpacing:"-.3px"}}>Stats</h1>
        <p style={{fontSize:13,color:C.sub,marginTop:2}}>Your real activity data</p>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
        {[{label:"Total Check-ins",val:totalDone,icon:"✅",color:C.emerald},{label:"This Week",val:weekDone,icon:"📅",color:C.indigo},{label:"Best Streak",val:`${topLongest}d`,icon:"🏆",color:C.amber},{label:"Active Streak",val:`${topStreak}d`,icon:"🔥",color:C.rose}].map((s,i)=>(
          <div key={i} style={{background:C.card,borderRadius:18,padding:"16px",border:`1px solid ${C.border}`,position:"relative",overflow:"hidden",animation:`fadeUp .${45+i*5}s both`}}>
            <div style={{position:"absolute",top:-12,right:-12,width:60,height:60,borderRadius:"50%",background:s.color,opacity:.08}}/>
            <div style={{fontSize:22,marginBottom:8}}>{s.icon}</div>
            <div style={{fontSize:24,fontWeight:800,color:s.color,fontFamily:"'Nunito','Outfit',system-ui,sans-serif"}}>{s.val}</div>
            <div style={{fontSize:11,color:C.sub,fontWeight:600,marginTop:2}}>{s.label}</div>
          </div>
        ))}
      </div>
      <div style={{background:C.card,borderRadius:18,padding:18,marginBottom:12,border:`1px solid ${C.border}`,animation:"fadeUp .5s both"}}>
        <SLabel>Best Days of Week</SLabel>
        {logs.length===0?<p style={{fontSize:13,color:C.dim,fontStyle:"italic"}}>Check in habits to see patterns</p>:(
          <div style={{display:"flex",alignItems:"flex-end",gap:7,height:76}}>
            {dayCounts.map((cnt,i)=>(
              <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:5}}>
                <div style={{width:"100%",height:Math.max(4,cnt/maxDay*64),borderRadius:"4px 4px 0 0",background:`linear-gradient(180deg,${C.indigo},${C.violet})`,opacity:cnt===0?.15:1,transition:"height .7s ease"}}/>
                <span style={{fontSize:9,color:C.sub,fontWeight:700}}>{"SMTWTFS"[i]}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{background:C.card,borderRadius:18,padding:18,marginBottom:12,border:`1px solid ${C.border}`,animation:"fadeUp .55s both"}}>
        <SLabel>Habit Performance</SLabel>
        {habits.length===0?<p style={{fontSize:13,color:C.dim,fontStyle:"italic"}}>Create habits to see data</p>:habits.map((h,i)=>{
          const r=weekRate(logs,h.id),s=streak(logs,h.id),lng=longest(logs,h.id);
          return (
            <div key={h.id} style={{marginBottom:i<habits.length-1?16:0,paddingBottom:i<habits.length-1?16:0,borderBottom:i<habits.length-1?`1px solid ${C.border}`:"none"}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:7}}>
                <div style={{width:32,height:32,borderRadius:10,background:h.color+"18",border:`1.5px solid ${h.color}35`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,flexShrink:0}}>{h.icon}</div>
                <div style={{flex:1,minWidth:0}}>
                  <p style={{fontSize:13,fontWeight:700,color:C.ink,margin:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{h.name}</p>
                  {h.startTime&&<p style={{fontSize:10,color:C.sub}}>🕐 {minsToDisplay(timeStrToMins(h.startTime))}{h.endTime?` – ${minsToDisplay(timeStrToMins(h.endTime))}`:""}</p>}
                  <p style={{fontSize:11,color:C.sub}}>🔥 {s} · 🏆 {lng} best</p>
                </div>
                <span style={{fontSize:17,fontWeight:800,color:h.color,fontFamily:"'Nunito','Outfit',system-ui,sans-serif"}}>{r}%</span>
              </div>
              <PBar pct={r} color={h.color}/>
            </div>
          );
        })}
      </div>
      <div style={{background:C.card,borderRadius:18,padding:18,border:`1px solid ${C.border}`,animation:"fadeUp .6s both"}}>
        <SLabel>30-Day Heatmap</SLabel>
        {logs.length===0?<p style={{fontSize:13,color:C.dim,fontStyle:"italic"}}>Check-ins appear here</p>:(
          <>
            <div style={{display:"grid",gridTemplateColumns:"repeat(10,1fr)",gap:5}}>
              {l30.map(d=>{const cnt=logs.filter(l=>l.date===d).length,intensity=habits.length?Math.min(cnt/habits.length,1):0,isToday=d===today();return(<div key={d} title={`${d}: ${cnt} done`} style={{aspectRatio:"1",borderRadius:5,background:cnt===0?C.elevated:C.indigo,opacity:cnt===0?1:0.2+intensity*0.8,border:isToday?`1.5px solid ${C.indigo}`:"none"}}/>);})}
            </div>
            <div style={{display:"flex",alignItems:"center",gap:5,marginTop:10}}>
              <span style={{fontSize:10,color:C.dim}}>Less</span>
              {[0,.3,.6,1].map(v=><div key={v} style={{width:11,height:11,borderRadius:3,background:v===0?C.elevated:C.indigo,opacity:v===0?1:0.2+v*0.8}}/>)}
              <span style={{fontSize:10,color:C.dim}}>More</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════
   INSIGHTS SCREEN
═══════════════════════════════════════════════════════════ */
const InsightsScreen = ({habits,logs}) => {
  const rates=habits.map(h=>weekRate(logs,h.id));
  const avg=rates.length?Math.round(rates.reduce((a,b)=>a+b,0)/rates.length):0;
  const bestH=habits.reduce((b,h)=>!b||weekRate(logs,h.id)>weekRate(logs,b.id)?h:b,null);
  const worstH=habits.reduce((b,h)=>!b||weekRate(logs,h.id)<weekRate(logs,b.id)?h:b,null);
  const todayDone=habits.filter(h=>isDone(logs,h.id)).length;
  const scoreColor=avg>=80?C.emerald:avg>=50?C.amber:avg>0?C.rose:C.dim;
  const nudges=[];
  habits.forEach(h=>{
    const s=streak(logs,h.id),r=weekRate(logs,h.id),done=isDone(logs,h.id);
    if(s>=3&&!done) nudges.push({type:"warn",icon:"⚡",msg:`Don't break your ${s}-day streak for "${h.name}"!`});
    if(r===100) nudges.push({type:"win",icon:"🏆",msg:`Perfect week for "${h.name}" — incredible!`});
    if(r<30&&s===0&&logs.some(l=>l.hid===h.id)) nudges.push({type:"nudge",icon:"💡",msg:`"${h.name}" needs attention — restart today.`});
  });
  const nudgeMeta={win:C.emerald,warn:C.amber,nudge:C.indigo};
  return (
    <div style={{padding:"0 16px"}}>
      <div style={{marginBottom:22,animation:"fadeUp .4s both"}}>
        <h1 style={{fontSize:26,fontWeight:800,fontFamily:"'Nunito','Outfit',system-ui,sans-serif",letterSpacing:"-.3px"}}>Insights</h1>
        <p style={{fontSize:13,color:C.sub,marginTop:2}}>Based on your real activity</p>
      </div>
      <div style={{background:`linear-gradient(140deg,#12102A,${C.card})`,borderRadius:22,padding:"20px",marginBottom:12,border:`1px solid ${C.indigo}30`,animation:"fadeUp .45s both",boxShadow:`0 12px 48px ${C.indigo}15`}}>
        <div style={{display:"flex",alignItems:"center",gap:18}}>
          <Ring pct={avg} size={84} color={scoreColor} stroke={8}>
            <span style={{fontSize:19,fontWeight:800,color:scoreColor,fontFamily:"'Nunito','Outfit',system-ui,sans-serif"}}>{avg}</span>
          </Ring>
          <div>
            <SLabel>Habit Score</SLabel>
            <p style={{fontSize:20,fontWeight:800,marginBottom:4,fontFamily:"'Nunito','Outfit',system-ui,sans-serif"}}>{avg>=80?"Excellent 🔥":avg>=60?"Good 👍":avg>=30?"Keep Going 💪":habits.length>0?"Just Starting 🌱":"No data yet"}</p>
            <p style={{fontSize:12,color:C.sub}}>{habits.length} habits · {todayDone}/{habits.length} done today</p>
          </div>
        </div>
      </div>
      {nudges.length>0&&(
        <div style={{marginBottom:12,animation:"fadeUp .5s both"}}>
          <SLabel>Smart Nudges</SLabel>
          {nudges.slice(0,3).map((n,i)=>{const col=nudgeMeta[n.type];return(<div key={i} style={{background:`${col}12`,border:`1px solid ${col}30`,borderRadius:14,padding:"12px 14px",marginBottom:8,display:"flex",alignItems:"center",gap:11}}><span style={{fontSize:19,flexShrink:0}}>{n.icon}</span><span style={{fontSize:13,fontWeight:500,color:C.ink,lineHeight:1.5}}>{n.msg}</span></div>);})}
        </div>
      )}
      {habits.length>1&&bestH&&worstH&&bestH.id!==worstH.id&&(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12,animation:"fadeUp .55s both"}}>
          {[{h:bestH,label:"🏆 Strongest",color:C.emerald},{h:worstH,label:"⚡ Needs Work",color:C.rose}].map(({h,label,color})=>(
            <div key={h.id} style={{background:C.card,borderRadius:18,padding:15,border:`1px solid ${color}30`}}>
              <p style={{fontSize:10,fontWeight:700,color,textTransform:"uppercase",letterSpacing:.8,marginBottom:9}}>{label}</p>
              <div style={{fontSize:26,marginBottom:5}}>{h.icon}</div>
              <p style={{fontSize:12,fontWeight:700,color:C.ink,marginBottom:3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{h.name}</p>
              <p style={{fontSize:20,fontWeight:800,color,fontFamily:"'Nunito','Outfit',system-ui,sans-serif"}}>{weekRate(logs,h.id)}%</p>
            </div>
          ))}
        </div>
      )}
      {habits.length>0&&(
        <div style={{background:C.card,borderRadius:18,padding:18,border:`1px solid ${C.border}`,animation:"fadeUp .6s both"}}>
          <SLabel>Weekly Completion Rate</SLabel>
          {habits.map((h,i)=>{const r=weekRate(logs,h.id);return(
            <div key={h.id} style={{display:"flex",alignItems:"center",gap:10,marginBottom:i<habits.length-1?13:0}}>
              <span style={{fontSize:17,width:24,textAlign:"center"}}>{h.icon}</span>
              <div style={{flex:1}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                  <span style={{fontSize:12,fontWeight:600,color:C.sub}}>{h.name}</span>
                  <span style={{fontSize:12,fontWeight:800,color:h.color}}>{r}%</span>
                </div>
                <PBar pct={r} color={h.color} h={4}/>
              </div>
            </div>
          );})}
        </div>
      )}
      {habits.length===0&&<div style={{textAlign:"center",padding:"50px 20px"}}><div style={{fontSize:42,marginBottom:12}}>🧠</div><h3 style={{fontSize:17,fontWeight:800,color:C.ink,marginBottom:7,fontFamily:"'Nunito','Outfit',system-ui,sans-serif"}}>No data yet</h3><p style={{fontSize:14,color:C.sub,lineHeight:1.6}}>Create habits and start checking in to unlock insights.</p></div>}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════
   TIME TRACKER SCREEN
═══════════════════════════════════════════════════════════ */
const TimeScreen = ({sessions,activeSession,onStartSession,onStopSession}) => {
  const [selCat,setSelCat]=useState(TIME_CATEGORIES[0].id);
  const [note,setNote]=useState("");
  const [viewMode,setViewMode]=useState("today");
  const [elapsed,setElapsed]=useState(0);
  const timerRef=useRef(null);

  useEffect(()=>{
    if(activeSession){timerRef.current=setInterval(()=>setElapsed(Math.floor((Date.now()-activeSession.startTs)/1000)),1000);}
    else{clearInterval(timerRef.current);setElapsed(0);}
    return()=>clearInterval(timerRef.current);
  },[activeSession]);

  const activeCat=TIME_CATEGORIES.find(c=>c.id==(activeSession?.catId||selCat));
  let viewDates=[],viewLabel="";
  if(viewMode==="today"){viewDates=[today()];viewLabel="Today";}
  if(viewMode==="week"){viewDates=range(7);viewLabel="This Week";}
  if(viewMode==="month"){viewDates=range(30);viewLabel="This Month";}
  if(viewMode==="year"){viewDates=range(365);viewLabel="This Year";}

  const viewSessions=sessionsByRange(sessions,viewDates);
  const totalSec=totalSecs(viewSessions);
  const catBreakdown=secsByCategory(viewSessions);
  const todayHours=hourlyBreakdown(sessions,today());
  const maxHour=Math.max(1,...todayHours);
  const dailyTotals=(viewMode==="week"||viewMode==="month")?range(viewMode==="week"?7:30).map(d=>({date:d,secs:totalSecs(sessionsByDate(sessions,d))})):[];
  const maxDayT=Math.max(1,...dailyTotals.map(d=>d.secs));
  const monthlyTotals=viewMode==="year"?Array.from({length:12},(_,i)=>{const d=new Date();d.setMonth(d.getMonth()-11+i);const ym=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;return{label:MONTH_NAMES[d.getMonth()],secs:sessions.filter(s=>s.date.startsWith(ym)).reduce((a,s)=>a+(s.duration||0),0)};}):[];
  const maxMonth=Math.max(1,...monthlyTotals.map(m=>m.secs));

  return (
    <div style={{padding:"0 16px"}}>
      <div style={{marginBottom:20,animation:"fadeUp .4s both"}}>
        <h1 style={{fontSize:26,fontWeight:800,fontFamily:"'Nunito','Outfit',system-ui,sans-serif",letterSpacing:"-.3px"}}>Time Tracker</h1>
        <p style={{fontSize:13,color:C.sub,marginTop:2}}>Track where your time really goes</p>
      </div>

      {/* Timer card */}
      <div style={{background:activeSession?`linear-gradient(140deg,#12102A,${C.card})`:C.card,borderRadius:22,padding:"20px",marginBottom:14,border:`1px solid ${activeSession?C.indigo+"55":C.border}`,animation:"fadeUp .44s both",boxShadow:activeSession?`0 0 50px ${activeCat?.color||C.indigo}18`:"none",transition:"all .4s"}}>
        {!activeSession?(
          <>
            <SLabel>Start a Session</SLabel>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:14}}>
              {TIME_CATEGORIES.map(cat=>(
                <button key={cat.id} onClick={()=>setSelCat(cat.id)} className="tappable" style={{background:selCat===cat.id?`${cat.color}22`:C.elevated,border:`1.5px solid ${selCat===cat.id?cat.color:C.border}`,borderRadius:13,padding:"10px 0",cursor:"pointer",transition:"all .15s",display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                  <span style={{fontSize:18}}>{cat.icon}</span>
                  <span style={{fontSize:10,fontWeight:700,color:selCat===cat.id?cat.color:C.sub}}>{cat.label}</span>
                </button>
              ))}
            </div>
            <input value={note} onChange={e=>setNote(e.target.value)} placeholder="What are you working on? (optional)" maxLength={60}
              style={{width:"100%",background:C.elevated,border:`1px solid ${C.border}`,borderRadius:12,padding:"12px 14px",color:C.ink,fontSize:14,marginBottom:14}}/>
            <button onClick={()=>{onStartSession({catId:selCat,note:note.trim(),startTs:Date.now(),startHour:new Date().getHours(),date:today()});setNote("");}} className="tappable"
              style={{width:"100%",padding:"15px",fontSize:15,fontWeight:800,background:`linear-gradient(135deg,${activeCat?.color||C.indigo},${C.violet})`,border:"none",borderRadius:14,color:"#fff",cursor:"pointer",boxShadow:`0 6px 24px ${activeCat?.color||C.indigo}44`,display:"flex",alignItems:"center",justifyContent:"center",gap:10,fontFamily:"'Nunito','Outfit',system-ui,sans-serif"}}>
              ▶ Start {activeCat?.label} Session
            </button>
          </>
        ):(
          <>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
              <div style={{width:52,height:52,borderRadius:16,background:`${activeCat?.color||C.indigo}22`,border:`2px solid ${activeCat?.color||C.indigo}55`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}}>{activeCat?.icon}</div>
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:3}}><div style={{width:7,height:7,borderRadius:"50%",background:C.rose,animation:"pulse 1.2s infinite"}}/><span style={{fontSize:11,fontWeight:700,color:C.rose,textTransform:"uppercase",letterSpacing:.8}}>Recording</span></div>
                <p style={{fontSize:14,fontWeight:700}}>{activeCat?.label}{activeSession.note?` — ${activeSession.note}`:""}</p>
              </div>
            </div>
            <div style={{textAlign:"center",marginBottom:18}}>
              <div style={{fontSize:48,fontWeight:800,letterSpacing:"-1px",fontFamily:"'Nunito','Outfit',system-ui,sans-serif",color:activeCat?.color||C.indigo,animation:"ticker .3s ease"}}>{fmtHHMM(elapsed)}</div>
              <p style={{fontSize:12,color:C.sub,marginTop:3}}>Session running</p>
            </div>
            <button onClick={()=>onStopSession(elapsed)} className="tappable" style={{width:"100%",padding:"15px",fontSize:15,fontWeight:800,background:`${C.rose}22`,border:`2px solid ${C.rose}55`,borderRadius:14,color:C.rose,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10,fontFamily:"'Nunito','Outfit',system-ui,sans-serif"}}>
              ⏹ Stop &amp; Save
            </button>
          </>
        )}
      </div>

      {/* Today sessions */}
      {sessions.filter(s=>s.date===today()).length>0&&(
        <div style={{background:C.card,borderRadius:18,padding:18,marginBottom:14,border:`1px solid ${C.border}`,animation:"fadeUp .5s both"}}>
          <SLabel>Today's Sessions</SLabel>
          {sessions.filter(s=>s.date===today()).slice(-5).reverse().map((s,i)=>{
            const cat=TIME_CATEGORIES.find(c=>c.id===s.catId);
            return(
              <div key={s.id} style={{display:"flex",alignItems:"center",gap:11,paddingBottom:i<4?11:0,marginBottom:i<4?11:0,borderBottom:i<4?`1px solid ${C.border}`:"none"}}>
                <div style={{width:34,height:34,borderRadius:10,background:`${cat?.color||C.indigo}18`,border:`1.5px solid ${cat?.color||C.indigo}35`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,flexShrink:0}}>{cat?.icon}</div>
                <div style={{flex:1,minWidth:0}}><p style={{fontSize:13,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cat?.label}{s.note?` — ${s.note}`:""}</p><p style={{fontSize:11,color:C.sub}}>{fmtSecs(s.duration||0)}</p></div>
                <span style={{fontSize:12,fontWeight:800,color:cat?.color||C.indigo}}>{fmtSecs(s.duration||0)}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Period selector + breakdown */}
      <div style={{background:C.card,borderRadius:18,padding:18,marginBottom:14,border:`1px solid ${C.border}`,animation:"fadeUp .55s both"}}>
        <div style={{display:"flex",gap:8,marginBottom:16}}>
          {[["today","Today"],["week","Week"],["month","Month"],["year","Year"]].map(([id,label])=>(
            <button key={id} onClick={()=>setViewMode(id)} style={{flex:1,padding:"9px 0",borderRadius:11,border:`1.5px solid ${viewMode===id?C.indigo:C.border}`,background:viewMode===id?`${C.indigo}18`:C.elevated,color:viewMode===id?C.indigo:C.sub,fontWeight:700,fontSize:12,cursor:"pointer",transition:"all .15s"}}>{label}</button>
          ))}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:16,padding:14,background:C.elevated,borderRadius:14}}>
          <Ring pct={Math.min(100,totalSec/28800*100)} size={64} color={C.indigo} stroke={6}>
            <span style={{fontSize:9,fontWeight:800,color:C.indigo,textAlign:"center"}}>{fmtHours(totalSec)}</span>
          </Ring>
          <div>
            <SLabel>{viewLabel} Total</SLabel>
            <p style={{fontSize:22,fontWeight:800,fontFamily:"'Nunito','Outfit',system-ui,sans-serif"}}>{fmtSecs(totalSec)}</p>
            <p style={{fontSize:11,color:C.sub,marginTop:2}}>{viewSessions.length} sessions</p>
          </div>
        </div>
        {Object.keys(catBreakdown).length>0?(
          <>
            <SLabel>By Category</SLabel>
            {TIME_CATEGORIES.filter(cat=>catBreakdown[cat.id]>0).sort((a,b)=>(catBreakdown[b.id]||0)-(catBreakdown[a.id]||0)).map(cat=>{
              const secs=catBreakdown[cat.id]||0,pct=totalSec?Math.round(secs/totalSec*100):0;
              return(
                <div key={cat.id} style={{marginBottom:11}}>
                  <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:5}}>
                    <span style={{fontSize:15}}>{cat.icon}</span>
                    <span style={{fontSize:13,fontWeight:700,flex:1}}>{cat.label}</span>
                    <span style={{fontSize:12,fontWeight:800,color:cat.color}}>{fmtSecs(secs)}</span>
                    <span style={{fontSize:11,color:C.sub,width:30,textAlign:"right"}}>{pct}%</span>
                  </div>
                  <PBar pct={pct} color={cat.color}/>
                </div>
              );
            })}
          </>
        ):<p style={{fontSize:13,color:C.dim,fontStyle:"italic",textAlign:"center",padding:"8px 0"}}>No sessions in {viewLabel.toLowerCase()} yet</p>}
      </div>

      {/* Charts */}
      {viewMode==="today"&&(
        <div style={{background:C.card,borderRadius:18,padding:18,marginBottom:14,border:`1px solid ${C.border}`,animation:"fadeUp .6s both"}}>
          <SLabel>Hourly Activity Today</SLabel>
          {sessions.filter(s=>s.date===today()).length===0?<p style={{fontSize:13,color:C.dim,fontStyle:"italic"}}>Log sessions to see hourly patterns</p>:(
            <div style={{display:"flex",alignItems:"flex-end",gap:3,height:76,overflowX:"auto",paddingBottom:4}}>
              {todayHours.map((secs,h)=>{const active=h===nowHour(),pct=secs/maxHour,barH=Math.max(secs>0?4:1,pct*68);return(<div key={h} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3,flexShrink:0,width:25}}><div style={{width:"100%",height:barH,borderRadius:"3px 3px 0 0",background:secs>0?C.indigo:C.elevated,opacity:secs>0?1:.25,border:active?`1px solid ${C.indigo}66`:"none",transition:"height .6s ease"}}/>{h%4===0&&<span style={{fontSize:8,color:C.dim}}>{h===0?"12a":h<12?`${h}a`:h===12?"12p":`${h-12}p`}</span>}</div>);})}
            </div>
          )}
        </div>
      )}
      {(viewMode==="week"||viewMode==="month")&&dailyTotals.length>0&&(
        <div style={{background:C.card,borderRadius:18,padding:18,marginBottom:14,border:`1px solid ${C.border}`,animation:"fadeUp .6s both"}}>
          <SLabel>Daily Time — {viewLabel}</SLabel>
          {dailyTotals.every(d=>d.secs===0)?<p style={{fontSize:13,color:C.dim,fontStyle:"italic"}}>No sessions in this period</p>:(
            <div style={{display:"flex",alignItems:"flex-end",gap:viewMode==="month"?3:7,height:84,overflowX:"auto",paddingBottom:4}}>
              {dailyTotals.map((d,i)=>{const h=Math.max(d.secs>0?4:1,(d.secs/maxDayT)*72),isToday=d.date===today();return(<div key={d.date} style={{flex:viewMode==="week"?1:undefined,width:viewMode==="month"?26:undefined,display:"flex",flexDirection:"column",alignItems:"center",gap:4,flexShrink:0}}><div style={{width:"100%",height:h,borderRadius:"4px 4px 0 0",background:isToday?C.indigo:d.secs>0?C.indigo+"88":C.elevated,opacity:d.secs>0?1:.2,transition:"height .6s ease"}}/>{viewMode==="week"&&<span style={{fontSize:9,color:isToday?C.indigo:C.sub,fontWeight:700}}>{DAY_NAMES[new Date(d.date+"T12:00").getDay()].slice(0,2)}</span>}{viewMode==="month"&&i%7===0&&<span style={{fontSize:8,color:C.dim}}>{d.date.slice(8)}</span>}</div>);})}
            </div>
          )}
        </div>
      )}
      {viewMode==="year"&&(
        <div style={{background:C.card,borderRadius:18,padding:18,marginBottom:14,border:`1px solid ${C.border}`,animation:"fadeUp .6s both"}}>
          <SLabel>Monthly — This Year</SLabel>
          {monthlyTotals.every(m=>m.secs===0)?<p style={{fontSize:13,color:C.dim,fontStyle:"italic"}}>No yearly data yet</p>:(
            <div style={{display:"flex",alignItems:"flex-end",gap:5,height:84}}>
              {monthlyTotals.map((m,i)=>{const h=Math.max(m.secs>0?4:1,(m.secs/maxMonth)*72);return(<div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}><div style={{width:"100%",height:h,borderRadius:"4px 4px 0 0",background:m.secs>0?`linear-gradient(180deg,${C.indigo},${C.violet})`:C.elevated,opacity:m.secs>0?1:.15}}/><span style={{fontSize:8,color:C.sub,fontWeight:700}}>{m.label.slice(0,1)}</span></div>);})}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════
   BOTTOM NAV
═══════════════════════════════════════════════════════════ */
const BottomNav = ({active,onChange,habits,logs,sessions,activeSession}) => {
  const undone=habits.filter(h=>!isDone(logs,h.id)).length;
  const tabs=[
    {id:"today",   label:"Habits",   svg:<><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>},
    {id:"time",    label:"Time",     svg:<><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 12"/></>},
    {id:"stats",   label:"Stats",    svg:<><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></>},
    {id:"insights",label:"Insights", svg:<><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>},
  ];
  return (
    <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:520,background:`${C.card}F5`,backdropFilter:"blur(28px)",borderTop:`1px solid ${C.border}`,zIndex:100,display:"flex",padding:"8px 0 24px"}}>
      {tabs.map(t=>{
        const isA=t.id===active;
        return(
          <button key={t.id} onClick={()=>onChange(t.id)} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:5,background:"none",border:"none",cursor:"pointer",padding:"6px 0",color:isA?C.indigo:C.sub,transition:"color .2s",position:"relative"}}>
            {t.id==="today"&&undone>0&&habits.length>0&&<div style={{position:"absolute",top:2,right:"calc(50% - 18px)",width:7,height:7,borderRadius:"50%",background:C.rose,border:`1.5px solid ${C.card}`}}/>}
            {t.id==="time"&&activeSession&&<div style={{position:"absolute",top:2,right:"calc(50% - 16px)",width:7,height:7,borderRadius:"50%",background:C.rose,animation:"pulse 1s infinite",border:`1.5px solid ${C.card}`}}/>}
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{opacity:isA?1:.45,transition:"opacity .2s"}}>{t.svg}</svg>
            <span style={{fontSize:10,fontWeight:700,letterSpacing:.5,textTransform:"uppercase"}}>{t.label}</span>
            {isA&&<div style={{position:"absolute",bottom:-8,width:22,height:3,borderRadius:99,background:C.indigo}}/>}
          </button>
        );
      })}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════
   ROOT APP
═══════════════════════════════════════════════════════════ */
export default function App() {
  const [habits,  setHabits]  = useState(()=>LS.get("hf_habits_v6",  []));
  const [logs,    setLogs]    = useState(()=>LS.get("hf_logs_v6",    []));
  const [sessions,setSessions]= useState(()=>LS.get("hf_sessions_v6",[]));
  const [activeSession,setActiveSession]=useState(()=>LS.get("hf_active_v6",null));

  const [tab,     setTab]     = useState("today");
  const [showAdd, setShowAdd] = useState(false);
  const [editH,   setEditH]   = useState(null);
  const [viewH,   setViewH]   = useState(null);

  useEffect(()=>LS.set("hf_habits_v6",  habits),         [habits]);
  useEffect(()=>LS.set("hf_logs_v6",    logs),           [logs]);
  useEffect(()=>LS.set("hf_sessions_v6",sessions),       [sessions]);
  useEffect(()=>LS.set("hf_active_v6",  activeSession),  [activeSession]);

  const toggleLog = useCallback(hid=>{
    const t=today(),idx=logs.findIndex(l=>l.hid===hid&&l.date===t);
    if(idx>=0) setLogs(p=>p.filter((_,i)=>i!==idx));
    else setLogs(p=>[...p,{id:`${hid}__${Date.now()}`,hid,date:t}]);
  },[logs]);

  const saveHabit = useCallback(data=>{
    if(editH) setHabits(p=>p.map(h=>h.id===data.id?data:h));
    else setHabits(p=>[...p,data]);
    setShowAdd(false);setEditH(null);setViewH(null);
  },[editH]);

  const deleteHabit = useCallback(id=>{
    setHabits(p=>p.filter(h=>h.id!==id));
    setLogs(p=>p.filter(l=>l.hid!==id));
    setShowAdd(false);setEditH(null);setViewH(null);
  },[]);

  const startSession = useCallback(data=>setActiveSession(data),[]);
  const stopSession  = useCallback(elapsed=>{
    if(!activeSession) return;
    setSessions(p=>[...p,{id:`sess__${Date.now()}`,catId:activeSession.catId,note:activeSession.note,date:activeSession.date,startHour:activeSession.startHour,duration:elapsed}]);
    setActiveSession(null);
  },[activeSession]);

  return (
    <div style={{minHeight:"100vh",background:C.bg,color:C.ink,display:"flex",justifyContent:"center"}}>
      <GlobalCSS/>
      <div style={{width:"100%",maxWidth:520,display:"flex",flexDirection:"column",minHeight:"100vh"}}>

        {/* Top bar */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"18px 20px 10px",position:"sticky",top:0,zIndex:50,background:`${C.bg}F8`,backdropFilter:"blur(24px)",borderBottom:`1px solid ${C.border}`}}>
          <p style={{fontSize:21,fontWeight:800,fontFamily:"'Nunito','Outfit',system-ui,sans-serif",background:`linear-gradient(135deg,${C.indigo},${C.violet})`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",margin:0}}>HabitFlow</p>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            {activeSession&&<div style={{display:"flex",alignItems:"center",gap:5,background:`${C.rose}18`,border:`1px solid ${C.rose}44`,borderRadius:99,padding:"4px 11px"}}><div style={{width:6,height:6,borderRadius:"50%",background:C.rose,animation:"pulse 1s infinite"}}/><span style={{fontSize:11,fontWeight:700,color:C.rose}}>LIVE</span></div>}
            {tab==="today"&&<button onClick={()=>{setEditH(null);setShowAdd(true);}} style={{width:40,height:40,borderRadius:13,background:`linear-gradient(135deg,${C.indigo},${C.violet})`,border:"none",cursor:"pointer",fontSize:22,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:`0 4px 20px ${C.indigo}50`}}>+</button>}
          </div>
        </div>

        {/* Content */}
        <div style={{flex:1,overflowY:"auto",paddingTop:6,paddingBottom:90}}>
          {tab==="today"    &&<TodayScreen    habits={habits} logs={logs} onToggle={toggleLog} onAdd={()=>setShowAdd(true)} onPress={setViewH} onDelete={deleteHabit}/>}
          {tab==="time"     &&<TimeScreen     sessions={sessions} activeSession={activeSession} onStartSession={startSession} onStopSession={stopSession}/>}
          {tab==="stats"    &&<StatsScreen    habits={habits} logs={logs}/>}
          {tab==="insights" &&<InsightsScreen habits={habits} logs={logs}/>}
        </div>

        <BottomNav active={tab} onChange={setTab} habits={habits} logs={logs} sessions={sessions} activeSession={activeSession}/>

        {(showAdd||editH)&&<HabitSheet habit={editH} onSave={saveHabit} onDelete={deleteHabit} onClose={()=>{setShowAdd(false);setEditH(null);}}/>}
        {viewH&&!editH&&<DetailSheet habit={viewH} logs={logs} onClose={()=>setViewH(null)} onEdit={()=>{setEditH(viewH);setViewH(null);}}/>}
      </div>
    </div>
  );
}
