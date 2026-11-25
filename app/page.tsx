"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  Activity, ArrowLeft, ArrowRight, CalendarDays, Check, ChevronDown,
  Cloud, CloudOff, Download, Dumbbell, Flame, GlassWater, LoaderCircle,
  Moon, Plus, Save, Scale, Utensils, X
} from "lucide-react";

const START = "2026-11-25";
const MEALS = [
  { key: "pre", name: "Pré-treino", time: "Antes da academia", hint: "Algo leve e fácil de digerir" },
  { key: "post", name: "Pós-treino", time: "Depois da academia", hint: "Proteína + carboidrato" },
  { key: "snack1", name: "Lanche da manhã", time: "Entre refeições", hint: "Reforço calórico" },
  { key: "lunch", name: "Almoço", time: "Refeição principal", hint: "Prato completo" },
  { key: "snack2", name: "Lanche da tarde", time: "Durante o trabalho", hint: "Prático para levar" },
  { key: "dinner", name: "Jantar", time: "Depois do trabalho", hint: "Fechar as calorias do dia" },
] as const;

type MealKey = typeof MEALS[number]["key"];
type Meal = { completed: boolean; description: string };
type Daily = {
  weight_kg: string; water_ml: string; sleep_hours: string; appetite: string;
  trained: boolean; training_notes: string; notes: string;
};
const emptyDaily: Daily = {
  weight_kg: "", water_ml: "0", sleep_hours: "", appetite: "",
  trained: false, training_notes: "", notes: ""
};
const emptyMeals = (): Record<MealKey, Meal> => Object.fromEntries(
  MEALS.map(m => [m.key, { completed: false, description: "" }])
) as Record<MealKey, Meal>;

function dateString(d: Date) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function shiftDate(date: string, amount: number) {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + amount);
  return dateString(d);
}
function dayNumber(date: string) {
  return Math.floor((new Date(`${date}T12:00:00`).getTime() - new Date(`${START}T12:00:00`).getTime()) / 86400000) + 1;
}
function prettyDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
}

export default function Home() {
  const [date, setDate] = useState(START);
  const [daily, setDaily] = useState<Daily>(emptyDaily);
  const [meals, setMeals] = useState<Record<MealKey, Meal>>(emptyMeals);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("Conectando ao banco...");
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"hoje" | "historico">("hoje");
  const [history, setHistory] = useState<{ log_date: string; weight_kg: number | null; trained: boolean }[]>([]);

  const day = dayNumber(date);
  const completed = MEALS.filter(m => meals[m.key].completed).length;
  const progress = Math.max(0, Math.min(100, (completed / MEALS.length) * 100));

  const loadDay = useCallback(async (target: string) => {
    setReady(false);
    setError("");
    const { data: d, error: de } = await supabase.from("daily_logs").select("*").eq("log_date", target).maybeSingle();
    if (de) { setError(de.message); setReady(true); return; }
    if (d) setDaily({
      weight_kg: d.weight_kg == null ? "" : String(d.weight_kg),
      water_ml: String(d.water_ml ?? 0),
      sleep_hours: d.sleep_hours == null ? "" : String(d.sleep_hours),
      appetite: d.appetite == null ? "" : String(d.appetite),
      trained: !!d.trained, training_notes: d.training_notes ?? "", notes: d.notes ?? ""
    });
    else setDaily(emptyDaily);
    const { data: ms, error: me } = await supabase.from("meal_logs").select("*").eq("log_date", target);
    if (me) setError(me.message);
    const next = emptyMeals();
    (ms ?? []).forEach((m: any) => {
      if (m.meal_key in next) next[m.meal_key as MealKey] = { completed: !!m.completed, description: m.description ?? "" };
    });
    setMeals(next);
    setReady(true);
  }, []);

  const ensureSession = useCallback(async () => {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (!sessionData.session) {
      const { error: signError } = await supabase.auth.signInAnonymously();
      if (signError) throw signError;
    }
    setStatus("Sincronizado com a nuvem");
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await ensureSession();
        if (alive) await loadDay(date);
      } catch (e: any) {
        if (alive) { setStatus("Sem conexão"); setError(e.message || "Não foi possível conectar ao Supabase."); setReady(true); }
      }
    })();
    return () => { alive = false; };
  }, [ensureSession, loadDay, date]);

  const loadHistory = async () => {
    const { data, error: e } = await supabase.from("daily_logs").select("log_date,weight_kg,trained").order("log_date", { ascending: false }).limit(30);
    if (e) setError(e.message);
    setHistory(data ?? []);
  };

  const saveDaily = async () => {
    setSaving(true); setError("");
    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;
    if (!user) { setError("Sessão não encontrada. Atualize a página."); setSaving(false); return; }
    const payload = {
      user_id: user.id, log_date: date,
      weight_kg: daily.weight_kg ? Number(daily.weight_kg.replace(",", ".")) : null,
      water_ml: Number(daily.water_ml || 0),
      sleep_hours: daily.sleep_hours ? Number(daily.sleep_hours.replace(",", ".")) : null,
      appetite: daily.appetite ? Number(daily.appetite) : null,
      trained: daily.trained, training_notes: daily.training_notes, notes: daily.notes,
      updated_at: new Date().toISOString()
    };
    const { error: e } = await supabase.from("daily_logs").upsert(payload, { onConflict: "user_id,log_date" });
    if (e) setError(e.message); else setStatus("Salvo agora");
    setSaving(false);
  };

  const saveMeal = async (key: MealKey, patch: Partial<Meal>) => {
    const next = { ...meals[key], ...patch };
    setMeals(prev => ({ ...prev, [key]: next }));
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    const { error: e } = await supabase.from("meal_logs").upsert({
      user_id: auth.user.id, log_date: date, meal_key: key,
      completed: next.completed, description: next.description,
      updated_at: new Date().toISOString()
    }, { onConflict: "user_id,log_date,meal_key" });
    if (e) setError(e.message); else setStatus("Refeição salva");
  };

  const exportData = async () => {
    const [d, m] = await Promise.all([
      supabase.from("daily_logs").select("*").order("log_date"),
      supabase.from("meal_logs").select("*").order("log_date")
    ]);
    if (d.error || m.error) { setError(d.error?.message || m.error?.message || "Falha ao exportar."); return; }
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), daily_logs: d.data, meal_logs: m.data }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "meu-projeto-30-dias-backup.json"; a.click();
    URL.revokeObjectURL(url);
  };

  const updateDaily = (field: keyof Daily, value: string | boolean) => setDaily(prev => ({ ...prev, [field]: value }));

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand"><div className="brand-mark"><Flame size={20}/></div><div><b>PROJETO 30 DIAS</b><span>EVOLUÇÃO • MASSA MUSCULAR</span></div></div>
        <div className={`sync ${status.includes("Sem") ? "offline" : ""}`}><span className="sync-dot"/>{status.includes("Sem") ? <CloudOff size={14}/> : <Cloud size={14}/>}<span>{status}</span></div>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">SEU COMPROMISSO COMEÇA AGORA</div>
          <h1>30 dias de<br/><em>consistência.</em></h1>
          <p>O foco é simples: comer bem, treinar e acompanhar sua evolução.</p>
          <div className="day-pill"><CalendarDays size={15}/> DIA {Math.max(1, Math.min(30, day))} <span>/ 30</span></div>
        </div>
        <div className="ring-wrap">
          <div className="progress-ring" style={{ background: `conic-gradient(#c5f36b ${progress * 3.6}deg, #30352d 0deg)` }}>
            <div className="ring-inner"><strong>{completed}<small>/6</small></strong><span>REFEIÇÕES</span></div>
          </div>
          <span className="ring-caption">CHECK-IN DO DIA</span>
        </div>
      </section>

      <nav className="tabs">
        <button className={tab === "hoje" ? "active" : ""} onClick={() => setTab("hoje")}><Activity size={16}/> Meu dia</button>
        <button className={tab === "historico" ? "active" : ""} onClick={() => { setTab("historico"); void loadHistory(); }}><CalendarDays size={16}/> Histórico</button>
      </nav>

      {tab === "hoje" ? <>
        <div className="date-row">
          <button className="icon-btn" aria-label="Dia anterior" onClick={() => setDate(d => shiftDate(d, -1))}><ArrowLeft size={18}/></button>
          <div><b>{prettyDate(date)}</b><span>{date}</span></div>
          <button className="icon-btn" aria-label="Próximo dia" onClick={() => setDate(d => shiftDate(d, 1))}><ArrowRight size={18}/></button>
        </div>

        {error && <div className="error"><X size={16}/>{error}</div>}
        {!ready ? <div className="loading"><LoaderCircle className="spin" size={22}/> Carregando seus registros...</div> : <>
          <section className="section">
            <div className="section-head"><div><span className="kicker">01 / ROTINA</span><h2>Como foi seu dia?</h2></div><span className="section-icon"><Scale size={19}/></span></div>
            <div className="stats-grid">
              <label className="field-card"><span><Scale size={15}/> PESO (KG)</span><input inputMode="decimal" placeholder="66,0" value={daily.weight_kg} onChange={e => updateDaily("weight_kg", e.target.value)}/></label>
              <label className="field-card"><span><GlassWater size={15}/> ÁGUA (ML)</span><input inputMode="numeric" placeholder="2500" value={daily.water_ml} onChange={e => updateDaily("water_ml", e.target.value)}/></label>
              <label className="field-card"><span><Moon size={15}/> SONO (HORAS)</span><input inputMode="decimal" placeholder="8" value={daily.sleep_hours} onChange={e => updateDaily("sleep_hours", e.target.value)}/></label>
              <label className="field-card"><span><Activity size={15}/> APETITE (1–5)</span><select value={daily.appetite} onChange={e => updateDaily("appetite", e.target.value)}><option value="">Selecionar</option>{[1,2,3,4,5].map(n => <option key={n} value={n}>{n} / 5</option>)}</select></label>
            </div>
            <label className="check-line"><input type="checkbox" checked={daily.trained} onChange={e => updateDaily("trained", e.target.checked)}/><span className="check-custom"><Check size={13}/></span><Dumbbell size={17}/><b>Treinei hoje</b><span className="muted">Marque quando concluir</span></label>
            <label className="text-field"><span>Treino / exercícios</span><textarea rows={2} placeholder="Ex.: peito, ombro e tríceps..." value={daily.training_notes} onChange={e => updateDaily("training_notes", e.target.value)}/></label>
            <label className="text-field"><span>Observações do dia</span><textarea rows={2} placeholder="Energia, dificuldades, como se sentiu..." value={daily.notes} onChange={e => updateDaily("notes", e.target.value)}/></label>
            <button className="primary-btn" onClick={saveDaily} disabled={saving}><Save size={17}/>{saving ? "Salvando..." : "Salvar check-in"}</button>
          </section>

          <section className="section meals-section">
            <div className="section-head"><div><span className="kicker">02 / ALIMENTAÇÃO</span><h2>Abasteça o crescimento.</h2><p>Registre o que comeu em cada horário.</p></div><span className="section-icon"><Utensils size={19}/></span></div>
            <div className="meal-list">
              {MEALS.map((meal, i) => {
                const item = meals[meal.key];
                return <article className={`meal-card ${item.completed ? "done" : ""}`} key={meal.key}>
                  <button className="meal-check" aria-label={item.completed ? "Desmarcar refeição" : "Marcar refeição"} onClick={() => void saveMeal(meal.key, { completed: !item.completed })}>{item.completed && <Check size={17}/>}</button>
                  <div className="meal-content"><div className="meal-top"><div><b>{meal.name}</b><span>{meal.time}</span></div><span className="meal-index">0{i+1}</span></div>
                    <input value={item.description} placeholder={meal.hint} onChange={e => setMeals(prev => ({ ...prev, [meal.key]: { ...prev[meal.key], description: e.target.value } }))} onBlur={() => void saveMeal(meal.key, { description: meals[meal.key].description })}/>
                  </div>
                </article>;
              })}
            </div>
          </section>
        </>}
      </> : <section className="section history-section">
        <div className="section-head"><div><span className="kicker">03 / PROGRESSO</span><h2>Seu histórico.</h2><p>Os últimos registros salvos na nuvem.</p></div><span className="section-icon"><Activity size={19}/></span></div>
        <div className="history-list">{history.length ? history.map(item => <div className="history-row" key={item.log_date}><div><b>{prettyDate(item.log_date)}</b><span>{item.trained ? "Treino concluído" : "Sem treino marcado"}</span></div><strong>{item.weight_kg ? `${item.weight_kg} kg` : "—"}</strong></div>) : <div className="empty">Ainda não há registros. Seu progresso começa no primeiro check-in.</div>}</div>
      </section>}

      <footer className="footer">
        <div className="footer-note"><span className="live-dot"/><span>Seus dados ficam salvos na nuvem.</span></div>
        <button className="export-btn" onClick={exportData}><Download size={15}/> Exportar backup</button>
        <small>PROJETO 30 DIAS · UM DIA DE CADA VEZ.</small>
      </footer>
    </main>
  );
}
