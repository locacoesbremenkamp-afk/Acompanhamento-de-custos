import { useState, useEffect, useCallback } from "react";
import { loadState, saveState } from "./supabase.js";

const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY || "";

const PROJECT = {
  name: "Galpão Industrial — Piracema",
  location: "Serra, Espírito Santo",
  client: "DM Eventos LTDA",
  clientCNPJ: "31.964.490/0001-70",
  engineer: "Eng. Renzo Vetorazzi B. Gozze",
  crea: "CREA ES-044985/D",
  startDate: "27/03/2026",
  endDate: "Set/2027",
  totalMO: 1790000,
};

const PHASES = [
  { id:"00", name:"Mobilização e Instalações Básicas", color:"#1F3864", weight:2,  s:1,  e:1,  budget:35800 },
  { id:"01", name:"Escavação e Terraplanagem",          color:"#1A5276", weight:3,  s:1,  e:2,  budget:53700 },
  { id:"02", name:"Estrutura de Concreto Armado",       color:"#154360", weight:25, s:2,  e:7,  budget:447500 },
  { id:"03", name:"Estrutura Metálica do Galpão",       color:"#117A65", weight:28, s:4,  e:8,  budget:501200 },
  { id:"04", name:"Alvenaria de Fechamento",            color:"#7D6608", weight:12, s:7,  e:10, budget:214800 },
  { id:"05", name:"PVS e Pavimentação Externa",         color:"#6E2F0A", weight:4,  s:10, e:12, budget:71600 },
  { id:"06", name:"Tubulação de Incêndio",              color:"#922B21", weight:3,  s:10, e:13, budget:53700 },
  { id:"07", name:"Instalações Hidrossanitárias",       color:"#1A237E", weight:5,  s:11, e:14, budget:89500 },
  { id:"08", name:"Acabamentos Internos",               color:"#4A148C", weight:16, s:13, e:17, budget:286400 },
  { id:"09", name:"Comissionamento e Entrega Final",    color:"#1B5E20", weight:2,  s:18, e:18, budget:35800 },
];

const fmt  = v => (v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const fmtP = v => `${(+v||0).toFixed(1)}%`;
const today= () => new Date().toISOString().split("T")[0];
const INIT = () => ({ phases: PHASES.map(p=>({...p,currentPercent:0,updates:[]})), medicoes:[] });

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;700&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'IBM Plex Sans',sans-serif;background:#EEF2F7}
  ::-webkit-scrollbar{width:5px;height:5px}
  ::-webkit-scrollbar-track{background:#EEF2F7}
  ::-webkit-scrollbar-thumb{background:#B0BEC5;border-radius:99px}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
  .g4{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
  .g2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
  .ga{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:14px}
  .ph-row{display:grid;grid-template-columns:36px 1fr 56px 96px 38px;align-items:center;gap:8px}
  .m-row{display:grid;grid-template-columns:64px 100px 1fr auto;align-items:center;gap:12px}
  .pm3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}
  .fg2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  @media(max-width:640px){
    .g4{grid-template-columns:repeat(2,1fr)}
    .g2{grid-template-columns:1fr}
    .ga{grid-template-columns:1fr}
    .ph-row{grid-template-columns:34px 1fr 52px}
    .ph-bar,.ph-reg{display:none!important}
    .m-row{grid-template-columns:58px 1fr auto}
    .m-notes{display:none!important}
    .tb-lbl{display:none!important}
    .pm3{grid-template-columns:1fr 1fr}
    .fg2{grid-template-columns:1fr}
  }
`;

function Bar({pct,color,h=9}){return(<div style={{background:"#DDE3EC",borderRadius:99,overflow:"hidden",height:h,minWidth:0}}><div style={{width:`${Math.min(100,pct||0)}%`,height:"100%",background:color,borderRadius:99,transition:"width .5s ease"}}/></div>);}
function Lbl({children}){return <div style={{fontSize:10,fontWeight:600,color:"#607080",marginBottom:4,textTransform:"uppercase",letterSpacing:.5}}>{children}</div>;}
function Card({children,style={}}){return <div style={{background:"#fff",borderRadius:14,padding:"16px 18px",boxShadow:"0 1px 6px rgba(0,0,0,.07)",...style}}>{children}</div>;}
function Badge({children,color,bg}){return <span style={{display:"inline-block",padding:"2px 9px",borderRadius:99,fontSize:11,fontWeight:700,color,background:bg||color+"22",border:`1px solid ${color}33`}}>{children}</span>;}
function Toast({msg,type}){if(!msg)return null;const bg=type==="error"?"#C62828":type==="warn"?"#E65100":"#1B5E20";return <div style={{position:"fixed",bottom:18,right:18,background:bg,color:"#fff",padding:"11px 16px",borderRadius:10,fontSize:13,fontWeight:600,zIndex:9999,boxShadow:"0 8px 24px rgba(0,0,0,.25)",maxWidth:"88vw",animation:"fadeUp .3s ease"}}>{msg}</div>;}
function Btn({children,onClick,color="#1F3864",outline=false,sm=false,disabled=false,full=false}){const [h,setH]=useState(false);return(<button onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)} onClick={onClick} disabled={disabled} style={{display:"inline-flex",alignItems:"center",justifyContent:"center",gap:6,padding:sm?"6px 12px":"9px 16px",borderRadius:8,fontFamily:"'IBM Plex Sans',sans-serif",fontWeight:600,fontSize:sm?12:13,cursor:disabled?"not-allowed":"pointer",transition:"all .15s",width:full?"100%":"auto",background:outline?(h?color+"18":"transparent"):h?color+"dd":color,color:outline?color:"#fff",border:outline?`2px solid ${color}`:"none",opacity:disabled?.5:1}}>{children}</button>);}
function Fld({label,children}){return <div style={{marginBottom:13}}><Lbl>{label}</Lbl>{children}</div>;}
function Inp({label,...p}){return <Fld label={label}><input {...p} style={{width:"100%",padding:"8px 11px",borderRadius:8,border:"1.5px solid #DDE3EC",fontSize:13,fontFamily:"'IBM Plex Sans',sans-serif",outline:"none",background:"#fff",...p.style}}/></Fld>;}
function Txa({label,...p}){return <Fld label={label}><textarea {...p} style={{width:"100%",padding:"8px 11px",borderRadius:8,border:"1.5px solid #DDE3EC",fontSize:13,fontFamily:"'IBM Plex Sans',sans-serif",outline:"none",resize:"vertical",minHeight:70}}/></Fld>;}
function Sel({label,children,...p}){return <Fld label={label}><select {...p} style={{width:"100%",padding:"8px 11px",borderRadius:8,border:"1.5px solid #DDE3EC",fontSize:13,fontFamily:"'IBM Plex Sans',sans-serif",outline:"none",background:"#fff"}}>{children}</select></Fld>;}
function Modal({title,onClose,children,w=520}){return(<div style={{position:"fixed",inset:0,background:"rgba(15,25,40,.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:16,backdropFilter:"blur(2px)"}}><div style={{background:"#fff",borderRadius:16,width:w,maxWidth:"100%",maxHeight:"90vh",overflow:"auto",boxShadow:"0 24px 64px rgba(0,0,0,.25)",animation:"fadeUp .2s ease"}}><div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 20px 12px",borderBottom:"1px solid #EEF2F7",position:"sticky",top:0,background:"#fff",zIndex:1}}><span style={{fontWeight:700,fontSize:14,color:"#1A2332"}}>{title}</span><button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",fontSize:22,color:"#90A0B0",lineHeight:1}}>×</button></div><div style={{padding:"18px 20px 22px"}}>{children}</div></div></div>);}

async function callClaude(prompt){
  if(!API_KEY) throw new Error("VITE_ANTHROPIC_API_KEY não configurada.");
  const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json","x-api-key":API_KEY,"anthropic-version":"2023-06-01"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:800,messages:[{role:"user",content:prompt}]})});
  const d=await res.json();
  return d.content?.filter(b=>b.type==="text").map(b=>b.text).join("\n")||"";
}

function PhaseModal({phase,onClose,onSave}){
  const [open,setOpen]=useState(false);
  const [form,setForm]=useState({percent:String(phase.currentPercent||""),notes:"",date:today()});
  const realized=phase.budget*(phase.currentPercent||0)/100;
  const pc=phase.currentPercent>=100?"#1B5E20":phase.currentPercent>0?"#1A5276":"#90A0B0";
  const save=()=>{const v=parseFloat(form.percent);if(isNaN(v)||v<0||v>100)return;onSave(phase.id,{percent:v,notes:form.notes,date:form.date});setOpen(false);setForm({percent:"",notes:"",date:today()});};
  return(
    <Modal title={`Fase ${phase.id} — ${phase.name}`} onClose={onClose} w={580}>
      <div className="pm3" style={{marginBottom:16}}>
        {[{l:"Peso no Contrato",v:fmtP(phase.weight),c:phase.color},{l:"% Realizado",v:fmtP(phase.currentPercent),c:pc},{l:"M.O. Realizada",v:fmt(realized),c:"#1F3864"}].map(m=>(
          <div key={m.l} style={{background:"#F4F7FB",borderRadius:10,padding:"11px 13px",borderLeft:`4px solid ${m.c}`}}>
            <Lbl>{m.l}</Lbl>
            <div style={{fontSize:15,fontWeight:700,color:m.c,fontFamily:"'IBM Plex Mono',monospace"}}>{m.v}</div>
          </div>
        ))}
      </div>
      <Bar pct={phase.currentPercent} color={phase.color} h={11}/>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#90A0B0",marginTop:5,marginBottom:16}}><span>Mês {phase.s} – Mês {phase.e}</span><span>Orçado: {fmt(phase.budget)}</span></div>
      {!open
        ?<div style={{marginBottom:18}}><Btn onClick={()=>setOpen(true)}>+ Atualizar % Progresso</Btn></div>
        :<div style={{background:"#F0F7FF",borderRadius:12,padding:"14px",marginBottom:18,border:"1.5px solid #C3DCF5"}}>
          <div style={{fontWeight:700,fontSize:13,color:"#1F3864",marginBottom:12}}>Nova Atualização de Progresso</div>
          <div className="fg2"><Inp label="% Realizado (0–100)" type="number" min="0" max="100" value={form.percent} onChange={e=>setForm({...form,percent:e.target.value})}/><Inp label="Data" type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></div>
          <Txa label="Observações / Justificativa" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/>
          <div style={{display:"flex",gap:8}}><Btn onClick={save}>Salvar</Btn><Btn outline color="#607080" onClick={()=>setOpen(false)}>Cancelar</Btn></div>
        </div>}
      <div style={{fontWeight:700,fontSize:13,color:"#1A2332",marginBottom:10}}>Histórico <span style={{fontWeight:400,color:"#90A0B0"}}>({phase.updates?.length||0} registros)</span></div>
      {!phase.updates?.length
        ?<div style={{color:"#B0BEC5",fontSize:13,fontStyle:"italic"}}>Nenhum registro encontrado.</div>
        :<div style={{maxHeight:200,overflowY:"auto",display:"flex",flexDirection:"column",gap:9}}>
          {[...phase.updates].reverse().map((u,i)=>(
            <div key={i} style={{borderLeft:`3px solid ${phase.color}`,paddingLeft:11,paddingTop:3,paddingBottom:3}}>
              <div style={{display:"flex",alignItems:"center",gap:9,flexWrap:"wrap"}}>
                <span style={{fontWeight:700,fontSize:15,color:phase.color,fontFamily:"'IBM Plex Mono',monospace"}}>{fmtP(u.percent)}</span>
                <span style={{fontSize:11,color:"#90A0B0"}}>{u.date}</span>
              </div>
              {u.notes&&<div style={{fontSize:12,color:"#44556A",marginTop:2,lineHeight:1.5}}>{u.notes}</div>}
            </div>
          ))}
        </div>}
    </Modal>
  );
}

export default function App(){
  const [state,setState]=useState(null);
  const [loading,setLoading]=useState(true);
  const [tab,setTab]=useState("dashboard");
  const [sel,setSel]=useState(null);
  const [showMed,setShowMed]=useState(false);
  const [toast,setToast]=useState({msg:"",type:"success"});
  const [syncing,setSyncing]=useState(false);
  const [syncErr,setSyncErr]=useState("");
  const [medForm,setMedForm]=useState({date:today(),type:"quinzenal",notes:""});

  const fire=(msg,type="success")=>{setToast({msg,type});setTimeout(()=>setToast({msg:"",type:"success"}),4000);};

  useEffect(()=>{
    (async()=>{
      try{ const s=await loadState(); setState(s||INIT()); }
      catch{ setState(INIT()); }
      setLoading(false);
    })();
  },[]);

  const save=useCallback(async s=>{
    const n={...s,saved:new Date().toISOString()};
    setState(n); setSyncing(true); setSyncErr("");
    try{ await saveState(n); }
    catch(e){ setSyncErr("Erro ao sincronizar."); console.error(e); }
    finally{ setSyncing(false); }
  },[]);

  const overall=state?state.phases.reduce((a,p)=>a+(p.currentPercent||0)*p.weight/100,0):0;
  const totalR=state?state.phases.reduce((a,p)=>a+p.budget*(p.currentPercent||0)/100,0):0;
  const selPhase=state?.phases?.find(p=>p.id===sel);

  const addUpdate=(id,u)=>{save({...state,phases:state.phases.map(p=>p.id!==id?p:{...p,currentPercent:u.percent,updates:[...(p.updates||[]),{...u,id:Date.now()}]})});fire(`Fase ${id} → ${fmtP(u.percent)}`);setSel(null);};
  const addMed=()=>{const m={id:`M${String((state.medicoes?.length||0)+1).padStart(2,"0")}`, ...medForm,overallProgress:overall,sentToClient:false,ts:new Date().toISOString()};save({...state,medicoes:[...(state.medicoes||[]),m]});fire("Medição registrada!");setShowMed(false);setMedForm({date:today(),type:"quinzenal",notes:""});};
  const markSent=id=>{save({...state,medicoes:state.medicoes.map(m=>m.id===id?{...m,sentToClient:true}:m)});fire("Marcado como enviado.");};

  const exportJSON=()=>{
    const b=new Blob([JSON.stringify(state,null,2)],{type:"application/json"});
    const a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=`Backup_Obra_${today()}.json`;a.click();
    fire("JSON exportado.");
  };

  const printReport=()=>{
    const now=new Date().toLocaleDateString("pt-BR");
    const sc=overall>=50?"#1B5E20":"#E65100";
    const rows=state.phases.map((p,i)=>{
      const r=p.budget*(p.currentPercent||0)/100;
      const lu=p.updates?.[p.updates.length-1];
      return `<tr style="background:${i%2===0?"#F8FAFC":"#fff"}">
        <td><strong style="background:${p.color};color:#fff;padding:2px 7px;border-radius:4px;font-size:10px">F${p.id}</strong> ${p.name}</td>
        <td>${p.weight}%</td><td>${fmt(p.budget)}</td>
        <td><strong>${fmtP(p.currentPercent)}</strong><div style="background:#DDE3EC;border-radius:99px;height:6px;margin-top:4px"><div style="width:${Math.min(100,p.currentPercent||0)}%;height:100%;background:${p.color};border-radius:99px"></div></div></td>
        <td>${fmt(r)}</td><td style="font-size:10px;color:#607080">${lu?.notes||"—"}</td>
      </tr>`;
    }).join("");
    const medRows=(state.medicoes||[]).map(m=>`<tr>
      <td><strong>${m.id}</strong></td><td>${m.date}</td><td>${m.type}</td>
      <td><strong>${fmtP(m.overallProgress)}</strong></td>
      <td style="font-size:10px;color:#607080">${m.notes||"—"}</td>
      <td>${m.sentToClient?"✓ Enviado":"Pendente"}</td>
    </tr>`).join("");
    const html=`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8">
<title>Relatório — ${PROJECT.name}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;600;700&family=IBM+Plex+Mono:wght@500;700&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'IBM Plex Sans',sans-serif;color:#1A2332;padding:24px;font-size:12px;background:#fff}
.header{background:#1F3864;color:#fff;padding:18px 22px;border-radius:8px;margin-bottom:16px}
.header h1{font-size:15px;margin-bottom:4px}.header p{font-size:10px;opacity:.75}
.kpi{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px}
.kpi-card{border-top:4px solid #1F3864;padding:12px;background:#F8FAFC;border-radius:6px;text-align:center}
.kpi-lbl{font-size:9px;font-weight:700;color:#607080;text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px}
.kpi-val{font-size:17px;font-weight:700;font-family:'IBM Plex Mono',monospace;color:#1F3864}
.bar-wrap{background:#DDE3EC;border-radius:99px;height:10px;overflow:hidden;margin:7px 0}
.bar-fill{height:100%;border-radius:99px;background:${sc}}
h2{font-size:12px;font-weight:700;color:#1F3864;margin:18px 0 8px;text-transform:uppercase;letter-spacing:.5px;border-bottom:2px solid #EEF2F7;padding-bottom:5px}
table{width:100%;border-collapse:collapse;font-size:11px;margin-bottom:18px}
thead tr{background:#1F3864;color:#fff}
th{padding:8px 10px;text-align:left;font-weight:600;font-size:10px}
td{padding:7px 10px;border-bottom:1px solid #EEF2F7;vertical-align:middle}
tfoot tr td{background:#1F3864;color:#fff;font-weight:700;padding:8px 10px}
.footer{margin-top:20px;padding-top:10px;border-top:2px solid #EEF2F7;font-size:10px;color:#90A0B0;line-height:1.8}
@media print{body{padding:8px}@page{margin:1cm;size:A4}thead{display:table-header-group}tr{page-break-inside:avoid}}
</style></head><body>
<div class="header"><h1>RELATÓRIO DE ACOMPANHAMENTO DE OBRA</h1>
<p>${PROJECT.name} · ${PROJECT.location} · ${PROJECT.engineer} · ${PROJECT.crea}<br>${PROJECT.client} · CNPJ ${PROJECT.clientCNPJ} · Início ${PROJECT.startDate} — Prazo ${PROJECT.endDate}</p></div>
<div class="kpi">
  <div class="kpi-card"><div class="kpi-lbl">M.O. Orçada Total</div><div class="kpi-val">${fmt(PROJECT.totalMO)}</div></div>
  <div class="kpi-card" style="border-color:#117A65"><div class="kpi-lbl">M.O. Realizada (est.)</div><div class="kpi-val" style="color:#117A65">${fmt(totalR)}</div></div>
  <div class="kpi-card" style="border-color:${sc}"><div class="kpi-lbl">% Realizado Geral</div><div class="kpi-val" style="color:${sc}">${fmtP(overall)}</div></div>
</div>
<div style="margin-bottom:16px">
  <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:11px"><span style="font-weight:600">Progresso Global da Obra</span><span style="font-weight:700;font-family:'IBM Plex Mono',monospace;color:${sc}">${fmtP(overall)}</span></div>
  <div class="bar-wrap"><div class="bar-fill" style="width:${Math.min(100,overall)}%"></div></div>
  <div style="display:flex;justify-content:space-between;font-size:10px;color:#90A0B0;margin-top:4px"><span>Início: ${PROJECT.startDate}</span><span>Prazo: ${PROJECT.endDate} — 18 meses</span><span>Gerado em: ${now}</span></div>
</div>
<h2>Realizado × Previsto por Etapa</h2>
<table><thead><tr><th>Etapa</th><th>Peso</th><th>Orçado</th><th>% Real.</th><th>Realizado</th><th>Última Observação</th></tr></thead>
<tbody>${rows}</tbody>
<tfoot><tr><td colspan="2">TOTAL GERAL</td><td>${fmt(PROJECT.totalMO)}</td><td>${fmtP(overall)}</td><td>${fmt(totalR)}</td><td>—</td></tr></tfoot></table>
${state.medicoes?.length>0?`<h2>Histórico de Medições</h2>
<table><thead><tr><th>Medição</th><th>Data</th><th>Tipo</th><th>% Global</th><th>Observações</th><th>Status</th></tr></thead>
<tbody>${medRows}</tbody></table>`:""}
<div class="footer"><strong>RZV Engenharia</strong> · ${PROJECT.engineer} · ${PROJECT.crea} · ${PROJECT.client} · CNPJ ${PROJECT.clientCNPJ}<br>Relatório gerado em ${now}</div>
</body></html>`;
    const blob=new Blob([html],{type:"text/html;charset=utf-8"});
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);
    a.download=`Relatorio_Obra_${today()}.html`;
    document.body.appendChild(a);a.click();document.body.removeChild(a);
    setTimeout(()=>URL.revokeObjectURL(a.href),3000);
    fire("✅ Relatório baixado! Abra e pressione Ctrl+P para salvar como PDF.");
  };

  if(loading)return(<div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:"#1F3864",color:"#fff",flexDirection:"column",gap:14,fontFamily:"'IBM Plex Sans',sans-serif"}}><div style={{fontSize:40}}>🏗️</div><div style={{fontSize:15,fontWeight:600}}>Carregando dados da obra...</div></div>);

  const sc=overall>=80?"#1B5E20":overall>=30?"#1A5276":"#E65100";
  const TABS=[{id:"dashboard",icon:"📊",label:"Dashboard"},{id:"etapas",icon:"🏗️",label:"Etapas"},{id:"medicoes",icon:"📏",label:"Medições"},{id:"backup",icon:"💾",label:"Backup"}];

  return(
    <div style={{minHeight:"100vh",background:"#EEF2F7",fontFamily:"'IBM Plex Sans',sans-serif"}}>
      <style>{CSS}</style>
      <div style={{background:"#1F3864",color:"#fff",padding:"0 16px",display:"flex",alignItems:"center",justifyContent:"space-between",height:52,boxShadow:"0 2px 12px rgba(0,0,0,.25)",position:"sticky",top:0,zIndex:100}}>
        <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0}}>
          <span style={{fontSize:18,flexShrink:0}}>🏗️</span>
          <div style={{minWidth:0}}>
            <div style={{fontWeight:700,fontSize:13,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{PROJECT.name}</div>
            <div style={{fontSize:10,opacity:.65}}>{PROJECT.location} · {PROJECT.engineer}</div>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:12,flexShrink:0}}>
          <div style={{textAlign:"right"}}>
            <div className="tb-lbl" style={{fontSize:9,opacity:.65}}>Evolução Global</div>
            <div style={{fontWeight:700,fontSize:17,color:"#4ECDC4",fontFamily:"'IBM Plex Mono',monospace"}}>{fmtP(overall)}</div>
            {syncing&&<div style={{fontSize:9,color:"#90E0D0",marginTop:1,display:"flex",alignItems:"center",gap:4,justifyContent:"flex-end"}}><div style={{width:7,height:7,border:"1.5px solid #4ECDC4",borderTopColor:"transparent",borderRadius:"50%",animation:"spin 1s linear infinite"}}/> Sincronizando…</div>}
            {syncErr&&!syncing&&<div style={{fontSize:9,color:"#FF8A80",marginTop:1}}>{syncErr}</div>}
          </div>
          <Btn sm onClick={printReport}>📄 Relatório PDF</Btn>
        </div>
      </div>

      <div style={{background:"#fff",borderBottom:"1px solid #DDE3EC",display:"flex",overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
        {TABS.map(t=>(<button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"11px 14px",border:"none",background:"none",cursor:"pointer",fontWeight:tab===t.id?700:500,fontSize:13,fontFamily:"'IBM Plex Sans',sans-serif",color:tab===t.id?"#1F3864":"#90A0B0",whiteSpace:"nowrap",borderBottom:tab===t.id?"3px solid #1F3864":"3px solid transparent",transition:"all .15s",display:"flex",alignItems:"center",gap:5,flexShrink:0}}>{t.icon} {t.label}</button>))}
      </div>

      <div style={{padding:"14px",maxWidth:1100,margin:"0 auto"}}>
        {tab==="dashboard"&&<div style={{animation:"fadeUp .3s ease"}}>
          <div className="g4" style={{marginBottom:14}}>
            {[{label:"Evolução Global",value:fmtP(overall),color:sc,icon:"📈"},{label:"M.O. Orçada",value:fmt(PROJECT.totalMO),color:"#1F3864",icon:"💼"},{label:"M.O. Realizada",value:fmt(totalR),color:"#117A65",icon:"✅"},{label:"Medições",value:state.medicoes?.length||0,color:"#2E74B5",icon:"📏"}].map(k=>(
              <Card key={k.label} style={{borderTop:`4px solid ${k.color}`}}>
                <div style={{fontSize:20,marginBottom:7}}>{k.icon}</div>
                <Lbl>{k.label}</Lbl>
                <div style={{fontSize:19,fontWeight:700,color:k.color,fontFamily:"'IBM Plex Mono',monospace"}}>{k.value}</div>
              </Card>
            ))}
          </div>
          <Card style={{marginBottom:14}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:9,flexWrap:"wrap",gap:6}}>
              <div style={{fontWeight:700,fontSize:14,color:"#1A2332"}}>Progresso Global da Obra</div>
              <span style={{fontWeight:700,fontSize:19,color:sc,fontFamily:"'IBM Plex Mono',monospace"}}>{fmtP(overall)}</span>
            </div>
            <Bar pct={overall} color={sc} h={15}/>
            <div style={{display:"flex",justifyContent:"space-between",marginTop:7,fontSize:11,color:"#90A0B0",flexWrap:"wrap",gap:3}}><span>Início: {PROJECT.startDate}</span><span>Prazo: {PROJECT.endDate} · 18 meses</span></div>
          </Card>
          <Card>
            <div style={{fontWeight:700,fontSize:14,color:"#1A2332",marginBottom:12}}>Etapas — toque para registrar progresso</div>
            {state.phases.map(p=>(
              <div key={p.id} onClick={()=>setSel(p.id)} style={{cursor:"pointer",borderBottom:"1px solid #EEF2F7",padding:"9px 8px",borderRadius:8,transition:"background .15s"}} onMouseOver={e=>e.currentTarget.style.background="#F4F7FB"} onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                <div className="ph-row">
                  <div style={{background:p.color,color:"#fff",borderRadius:7,padding:"5px 0",textAlign:"center",fontWeight:700,fontSize:11}}>{p.id}</div>
                  <div style={{minWidth:0}}><div style={{fontWeight:600,fontSize:13,color:"#1A2332",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</div><div style={{fontSize:10,color:"#90A0B0"}}>Peso {p.weight}% · Mês {p.s}–{p.e}</div></div>
                  <div style={{fontWeight:700,fontSize:13,textAlign:"right",color:p.currentPercent>=100?"#1B5E20":p.currentPercent>0?"#1A5276":"#B0BEC5",fontFamily:"'IBM Plex Mono',monospace",flexShrink:0}}>{fmtP(p.currentPercent)}</div>
                  <div className="ph-bar"><Bar pct={p.currentPercent} color={p.color} h={7}/></div>
                  <div className="ph-reg" style={{textAlign:"right",fontSize:10,color:"#B0BEC5",flexShrink:0}}>{p.updates?.length||0} reg.</div>
                </div>
              </div>
            ))}
          </Card>
        </div>}

        {tab==="etapas"&&<div className="ga" style={{animation:"fadeUp .3s ease"}}>
          {state.phases.map(p=>{const lu=p.updates?.[p.updates.length-1];return(
            <div key={p.id} onClick={()=>setSel(p.id)} style={{background:"#fff",borderRadius:14,padding:"15px",cursor:"pointer",boxShadow:"0 1px 6px rgba(0,0,0,.07)",borderLeft:`5px solid ${p.color}`,transition:"transform .15s,box-shadow .15s"}} onMouseOver={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 6px 18px rgba(0,0,0,.11)"}} onMouseOut={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow="0 1px 6px rgba(0,0,0,.07)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:9,gap:8}}>
                <span style={{background:p.color,color:"#fff",borderRadius:6,padding:"3px 9px",fontSize:11,fontWeight:700,flexShrink:0}}>Fase {p.id}</span>
                <span style={{fontWeight:700,fontSize:17,color:p.currentPercent>=100?"#1B5E20":p.currentPercent>0?"#1A5276":"#B0BEC5",fontFamily:"'IBM Plex Mono',monospace"}}>{fmtP(p.currentPercent)}</span>
              </div>
              <div style={{fontWeight:700,fontSize:13,color:"#1A2332",marginBottom:9,lineHeight:1.4}}>{p.name}</div>
              <Bar pct={p.currentPercent} color={p.color} h={8}/>
              <div style={{display:"flex",justifyContent:"space-between",marginTop:8,fontSize:11,color:"#90A0B0"}}><span>Orçado: {fmt(p.budget)}</span><span>{p.updates?.length||0} atualizações</span></div>
              {lu&&<div style={{marginTop:8,background:"#F4F7FB",borderRadius:8,padding:"6px 10px",fontSize:11,color:"#44556A",lineHeight:1.5}}><strong>Último:</strong> {lu.date} — {fmtP(lu.percent)}{lu.notes?` — ${lu.notes.substring(0,50)}${lu.notes.length>50?"…":""}`:""}</div>}
            </div>);})}
        </div>}

        {tab==="medicoes"&&<div style={{animation:"fadeUp .3s ease"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:10}}>
            <div><div style={{fontWeight:700,fontSize:16,color:"#1A2332"}}>Medições Registradas</div><div style={{fontSize:12,color:"#90A0B0",marginTop:2}}>Acompanhamento quinzenal ou mensal do avanço físico</div></div>
            <Btn onClick={()=>setShowMed(true)}>+ Nova Medição</Btn>
          </div>
          {!state.medicoes?.length
            ?<Card style={{textAlign:"center",padding:"36px 20px"}}><div style={{fontSize:36,marginBottom:9}}>📏</div><div style={{fontWeight:600,color:"#44556A",marginBottom:5}}>Nenhuma medição registrada.</div><div style={{fontSize:13,color:"#90A0B0",marginBottom:14}}>Inicie registrando a primeira medição da obra.</div><Btn onClick={()=>setShowMed(true)}>+ Registrar Primeira Medição</Btn></Card>
            :<div style={{display:"flex",flexDirection:"column",gap:11}}>
              {[...state.medicoes].reverse().map(m=>(
                <Card key={m.id}>
                  <div className="m-row">
                    <div style={{background:"#1F3864",color:"#fff",borderRadius:9,padding:"9px 7px",textAlign:"center",fontWeight:700,flexShrink:0}}><div style={{fontSize:13,fontFamily:"'IBM Plex Mono',monospace"}}>{m.id}</div><div style={{fontSize:9,opacity:.65,marginTop:2}}>{m.type}</div></div>
                    <div style={{minWidth:0}}><div style={{fontWeight:700,fontSize:13}}>{m.date}</div><div style={{fontWeight:700,fontSize:17,color:"#1A5276",fontFamily:"'IBM Plex Mono',monospace"}}>{fmtP(m.overallProgress)}</div></div>
                    <div className="m-notes" style={{fontSize:12,color:"#607080",minWidth:0}}>{m.notes||<span style={{color:"#B0BEC5",fontStyle:"italic"}}>Sem observações</span>}</div>
                    <div style={{flexShrink:0}}>{m.sentToClient?<Badge color="#1B5E20" bg="#E8F5E9">✓ Enviado</Badge>:<Btn sm onClick={()=>markSent(m.id)}>Marcar enviado</Btn>}</div>
                  </div>
                </Card>
              ))}
            </div>}
        </div>}

        {tab==="backup"&&<div style={{animation:"fadeUp .3s ease"}}>
          <div className="g2" style={{marginBottom:14}}>
            {[
              {icon:"📄",title:"Relatório PDF para Cliente",color:"#1F3864",desc:"Gera o relatório como arquivo HTML — abra no navegador e pressione Ctrl+P para salvar como PDF.",action:printReport,btn:"Baixar Relatório"},
              {icon:"📁",title:"Exportar Backup JSON",color:"#4285F4",desc:"Exporta todos os dados da obra em formato JSON para salvar no Google Drive ou OneDrive.",action:exportJSON,btn:"Exportar JSON"},
            ].map(card=>(<Card key={card.title} style={{borderTop:`4px solid ${card.color}`}}><div style={{fontSize:26,marginBottom:9}}>{card.icon}</div><div style={{fontWeight:700,fontSize:14,color:"#1A2332",marginBottom:6}}>{card.title}</div><div style={{fontSize:12,color:"#607080",marginBottom:14,lineHeight:1.6}}>{card.desc}</div><Btn onClick={card.action} color={card.color} full>{card.btn}</Btn></Card>))}
          </div>
          <Card style={{background:"#FFF5F5",border:"1.5px solid #FFCDD2"}}>
            <div style={{fontWeight:700,color:"#C62828",marginBottom:5}}>⚠️ Zona de Risco</div>
            <div style={{fontSize:13,color:"#607080",marginBottom:12,lineHeight:1.6}}>Reiniciar apagará todos os dados de progresso, medições e histórico. Esta ação não pode ser desfeita.</div>
            <Btn color="#C62828" onClick={()=>{if(window.confirm("Confirma reiniciar todos os dados?"))save(INIT());fire("Dados reiniciados.","warn");}}>Reiniciar Dados da Obra</Btn>
          </Card>
        </div>}
      </div>

      {selPhase&&<PhaseModal phase={selPhase} onClose={()=>setSel(null)} onSave={addUpdate}/>}
      {showMed&&<Modal title="Registrar Nova Medição" onClose={()=>setShowMed(false)}>
        <div style={{background:"#F0F7FF",borderRadius:9,padding:"11px 13px",marginBottom:14,fontSize:13,color:"#1F3864",fontWeight:600}}>Evolução atual da obra: {fmtP(overall)}</div>
        <div className="fg2"><Inp label="Data da Medição" type="date" value={medForm.date} onChange={e=>setMedForm({...medForm,date:e.target.value})}/><Sel label="Tipo de Medição" value={medForm.type} onChange={e=>setMedForm({...medForm,type:e.target.value})}><option value="quinzenal">Quinzenal</option><option value="mensal">Mensal</option><option value="parcial">Parcial</option></Sel></div>
        <Txa label="Observações Gerais" value={medForm.notes} onChange={e=>setMedForm({...medForm,notes:e.target.value})}/>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end",flexWrap:"wrap"}}><Btn outline color="#607080" onClick={()=>setShowMed(false)}>Cancelar</Btn><Btn onClick={addMed}>Registrar Medição</Btn></div>
      </Modal>}
      <Toast msg={toast.msg} type={toast.type}/>
    </div>
  );
}
