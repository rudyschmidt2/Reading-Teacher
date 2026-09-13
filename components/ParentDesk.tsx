"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { isVoiceMuted, setVoiceMuted, speakPhoneme, speakPrompt, voiceStatus } from "@/lib/audio";
import { ageFromBirthday, THEMES, wordsUnlocked } from "@/lib/catalog";
import { allDimensions, kidNextModule, moduleStats, rollupDimension, verdictKey } from "@/lib/grades";
import { useHouse } from "@/lib/store";
import type { Child, ModuleVerdict, Stretch } from "@/lib/types";

function KidSelect({ selected, onPick }: { selected?: string; onPick: (id: string) => void }) {
  const { state } = useHouse();
  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {state.kids.map((k) => (
        <button
          key={k.id}
          type="button"
          onClick={() => onPick(k.id)}
          className={`rounded-full px-4 py-2 text-sm font-bold ${selected === k.id ? "bg-stone-900 text-white" : "bg-white"}`}
        >
          {k.name}
        </button>
      ))}
    </div>
  );
}

function VoiceCard() {
  const [muted, setMuted] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    setMuted(isVoiceMuted());
    void voiceStatus().then((status) => setConfigured(status.configured));
  }, []);

  return (
    <div className="mt-4 rounded-2xl bg-white p-4">
      <h3 className="font-black">Voiceover</h3>
      <p className="text-sm text-stone-600">Warm teacher voice for lesson prompts and letter sounds.</p>
      <button
        type="button"
        className={`mt-3 rounded-full px-4 py-2 ${muted ? "bg-stone-200" : "bg-stone-900 text-white"}`}
        onClick={() => {
          const next = !muted;
          setVoiceMuted(next);
          setMuted(next);
        }}
      >
        {muted ? "Voice off" : "Voice on"}
      </button>
      {configured === false ? (
        <p className="mt-3 text-sm text-amber-800">
          Natural voice is not set up. Add <span className="font-mono">OPENAI_API_KEY</span> in{" "}
          <span className="font-mono">.env.local</span> (or the same name on Vercel) so Riley, Hudson, and Myles hear a
          clear teacher. Kids still see the words. See the README.
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="rounded-full bg-stone-100 px-3 py-1 text-sm" onClick={() => speakPrompt("Stamp the one that says /s/.")}>
          Hear a prompt
        </button>
        <button type="button" className="rounded-full bg-stone-100 px-3 py-1 text-sm" onClick={() => speakPhoneme("/s/")}>
          Hear /s/
        </button>
      </div>
    </div>
  );
}

function AddChild() {
  const { addChild } = useHouse();
  const [name, setName] = useState("");
  const [birthday, setBirthday] = useState("");
  const [waiting, setWaiting] = useState(true);
  return (
    <form
      className="mt-4 grid gap-2 rounded-2xl bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name || !birthday) return;
        addChild(name, birthday, waiting ? "waiting" : "active");
        setName("");
      }}
    >
      <p className="font-bold">Add a child</p>
      <input className="rounded-xl border px-3 py-2" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
      <input className="rounded-xl border px-3 py-2" type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} />
      <label className="text-sm">
        <input type="checkbox" checked={waiting} onChange={(e) => setWaiting(e.target.checked)} /> Waiting
      </label>
      <button className="rounded-full bg-stone-900 px-4 py-2 text-white" type="submit">
        Save
      </button>
    </form>
  );
}

export function ParentHome() {
  const { state, ready } = useHouse();
  const [id, setId] = useState(state.kids[0]?.id ?? "riley");
  const child = state.kids.find((k) => k.id === id) ?? state.kids[0];
  if (!ready) return <p className="p-6">Loading desk…</p>;
  return (
    <main className="parent-desk px-4 py-6">
      <div className="mx-auto max-w-3xl">
        <p className="text-sm uppercase tracking-wide text-stone-500">Parent door</p>
        <h1 className="mt-1 text-3xl font-black">House desk</h1>
        <p className="mt-2 text-stone-600">Grades, speed, pass/fail. Kids never see this language.</p>
        <VoiceCard />
        <div className="mt-4">
          <KidSelect selected={child?.id} onPick={setId} />
        </div>
        {child ? <ChildDesk child={child} /> : null}
        <AddChild />
        <Link href="/" className="mt-6 inline-block text-sm underline">
          Back to doors
        </Link>
      </div>
    </main>
  );
}

export function ChildDesk({ child }: { child: Child }) {
  const house = useHouse();
  const dims = useMemo(
    () => allDimensions().map((d) => rollupDimension(child, house.state.attempts, d)),
    [child, house.state.attempts],
  );
  const next = kidNextModule(child, house.state);
  const pendingSpeak = house.state.attempts.filter((a) => a.kidId === child.id && a.spokenGrade === "pending");
  const theme = THEMES.find((t) => t.id === child.themeToday);

  return (
    <section className="mt-4 space-y-4">
      <div className="rounded-2xl bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black">{child.name}</h2>
            <p>
              Age {ageFromBirthday(child.birthday)} · birthday {child.birthday} · {child.status}
            </p>
            <p>Track: {child.track === "letters" ? "letters / sounds" : "phonics words"}</p>
            <p>Today&apos;s theme: {theme?.label ?? "not picked yet"} (kid-picked)</p>
            <p>Placement shelf: {child.status === "waiting" ? "none — waiting" : child.placementGrade ?? "not taken"}</p>
            {child.placementNote ? <p className="text-sm text-stone-600">{child.placementNote}</p> : null}
            {child.kidLine ? <p className="text-sm">What they saw: {child.kidLine}</p> : null}
          </div>
          <div className="flex flex-col gap-2">
            {child.status === "waiting" ? (
              <button type="button" className="rounded-full bg-stone-900 px-4 py-2 text-white" onClick={() => house.setStatus(child.id, "active")}>
                Activate
              </button>
            ) : (
              <button type="button" className="rounded-full bg-stone-200 px-4 py-2" onClick={() => house.setStatus(child.id, "waiting")}>
                Pause to waiting
              </button>
            )}
            {child.status === "active" ? (
              <Link href={`/kids/${child.id}/theme`} className="rounded-full bg-amber-300 px-4 py-2 text-center font-bold text-stone-900">
                Start today&apos;s session
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      {child.status === "waiting" ? (
        <p className="rounded-2xl bg-white p-4">Waiting is first-class. No lessons. No fake grade.</p>
      ) : (
        <>
          <div className="rounded-2xl bg-white p-4">
            <h3 className="font-black">Full gambit</h3>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {dims.map((d) => (
                <div key={d.key} className="rounded-xl bg-stone-100 p-3">
                  <p className="font-bold">{d.label}</p>
                  <p className="text-sm capitalize">{d.status.replace("-", " ")}</p>
                  <p className="text-sm">{d.note}</p>
                  {d.key === "speed" && d.avgMs ? <p className="text-sm">{d.avgMs} ms average</p> : null}
                </div>
              ))}
              <div className="rounded-xl bg-stone-100 p-3">
                <p className="font-bold">Pass / fail per module</p>
                <p className="text-sm">Parent-door words only. Kid never hears fail.</p>
              </div>
            </div>
          </div>

          <LastSession childId={child.id} />
          <ScoutCard kidId={child.id} />
          <PathEditor child={child} />

          <div className="rounded-2xl bg-white p-4">
            <h3 className="font-black">Spoken attempts to grade</h3>
            {pendingSpeak.length === 0 ? <p className="text-sm text-stone-600">None waiting.</p> : null}
            <ul className="mt-2 space-y-2">
              {pendingSpeak.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-stone-100 p-3">
                  <span className="text-sm">
                    {a.spokenText || "parent-listen"} · {a.itemId}
                  </span>
                  <span className="flex gap-2">
                    <button type="button" className="rounded-full bg-emerald-700 px-3 py-1 text-white" onClick={() => house.gradeSpoken(a.id, "hit")}>
                      Hit
                    </button>
                    <button type="button" className="rounded-full bg-stone-700 px-3 py-1 text-white" onClick={() => house.gradeSpoken(a.id, "miss")}>
                      Miss
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <CreateModule child={child} />

          {child.id === "myles" ? (
            <div className="rounded-2xl bg-white p-4">
              <h3 className="font-black">Myles word unlock</h3>
              <p className="text-sm">Needs probe `ready_for_print_words` AND your confirm. Name is Myles.</p>
              <label className="mt-2 block text-sm">
                <input
                  type="checkbox"
                  checked={child.readyForPrintWords}
                  onChange={(e) => house.setReadyForPrintWords(child.id, e.target.checked)}
                />{" "}
                Probe flag ready_for_print_words
              </label>
              <button
                type="button"
                className="mt-2 rounded-full bg-stone-900 px-4 py-2 text-white disabled:opacity-40"
                disabled={!child.readyForPrintWords}
                onClick={() => house.unlockWords(child.id, !child.parentUnlockedWords)}
              >
                {child.parentUnlockedWords ? "Park back on letters" : "Confirm first word module"}
              </button>
              <p className="mt-2 text-sm">{wordsUnlocked(child) ? "Words are unlocked." : "Still letters and sounds only."}</p>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Link href={`/kids/${child.id}/play?mode=scout`} className="rounded-full bg-indigo-800 px-4 py-2 text-white">
              Send a scout
            </Link>
            {next ? (
              <Link href={`/kids/${child.id}/play?mode=try`} className="rounded-full bg-white px-4 py-2">
                Try {next.title}
              </Link>
            ) : null}
            <button type="button" className="rounded-full bg-white px-4 py-2" onClick={() => house.resetHouse()}>
              Reset house data
            </button>
          </div>
        </>
      )}
    </section>
  );
}

function PathEditor({ child }: { child: Child }) {
  const house = useHouse();
  const [stretch, setStretch] = useState<Stretch>(child.stretch);
  return (
    <div className="rounded-2xl bg-white p-4">
      <h3 className="font-black">Path — not locked</h3>
      <p className="text-sm text-stone-600">Reorder, skip, hold, pass/fail. Default stretch is stretch-hard.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {(["easier", "stretch-hard", "harder"] as Stretch[]).map((s) => (
          <button
            key={s}
            type="button"
            className={`rounded-full px-3 py-1 text-sm ${stretch === s ? "bg-stone-900 text-white" : "bg-stone-100"}`}
            onClick={() => {
              setStretch(s);
              house.setStretch(child.id, s === "easier" || s === "harder" ? s : "stretch-hard");
            }}
          >
            {s}
          </button>
        ))}
        <select
          className="rounded-full bg-stone-100 px-3 py-1 text-sm"
          value={child.sessionLength}
          onChange={(e) => house.setSession(child.id, e.target.value as Child["sessionLength"])}
        >
          <option value="shorter">Shorter session</option>
          <option value="standard">Standard</option>
          <option value="longer">Longer</option>
        </select>
      </div>
      <ol className="mt-4 space-y-2">
        {child.path.map((id, index) => {
          const mod = house.module(id);
          if (!mod) return null;
          const stats = moduleStats(child.id, mod, house.state.attempts, house.state.verdicts[verdictKey(child.id, id)]);
          return (
            <li key={id} className="rounded-xl bg-stone-100 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-bold">
                    {index + 1}. {mod.title}
                  </p>
                  <p className="text-sm">
                    {mod.skill} · {stats.hits} hits / {stats.misses} misses · parent verdict: {stats.verdict}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Link
                    href={`/kids/${child.id}/play?mode=try&module=${id}`}
                    className="rounded-full bg-amber-300 px-3 py-1 text-sm font-bold text-stone-900"
                    onClick={() => {
                      if (!child.themeToday) house.pickTheme(child.id, "planets-space");
                    }}
                  >
                    Try
                  </Link>
                  <button type="button" className="rounded-full bg-white px-3 py-1 text-sm" disabled={index === 0} onClick={() => house.moveModule(child.id, index, index - 1)}>
                    Up
                  </button>
                  <button
                    type="button"
                    className="rounded-full bg-white px-3 py-1 text-sm"
                    disabled={index === child.path.length - 1}
                    onClick={() => house.moveModule(child.id, index, index + 1)}
                  >
                    Down
                  </button>
                  <button
                    type="button"
                    className="rounded-full bg-white px-3 py-1 text-sm"
                    onClick={() => house.setPath(child.id, child.path.filter((x) => x !== id))}
                  >
                    Drop
                  </button>
                  <button type="button" className="rounded-full bg-white px-3 py-1 text-sm" onClick={() => house.applyFromSheet(child.id, id, "done")}>
                    From sheet: done
                  </button>
                  <button type="button" className="rounded-full bg-white px-3 py-1 text-sm" onClick={() => house.applyFromSheet(child.id, id, "ease")}>
                    Ease
                  </button>
                  <button type="button" className="rounded-full bg-white px-3 py-1 text-sm" onClick={() => house.applyFromSheet(child.id, id, "harden")}>
                    Harden
                  </button>
                  <button type="button" className="rounded-full bg-white px-3 py-1 text-sm" onClick={() => house.applyFromSheet(child.id, id, "hold")}>
                    Hold
                  </button>
                  {(["open", "pass", "fail"] as ModuleVerdict[]).map((v) => (
                    <button
                      key={v}
                      type="button"
                      className={`rounded-full px-3 py-1 text-sm ${stats.verdict === v ? "bg-stone-900 text-white" : "bg-white"}`}
                      onClick={() => house.setVerdict(child.id, id, v)}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      <div className="mt-4">
        <p className="font-bold">House library</p>
        <p className="text-sm text-stone-600">Every shipped module. Add to this child’s path or try it.</p>
        <ul className="mt-2 space-y-2">
          {house.state.modules
            .filter((m) => (child.track === "letters" && !wordsUnlocked(child) ? m.track === "letters" : true))
            .map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-stone-50 p-2">
                <span>
                  {m.title} <span className="text-sm opacity-70">({m.skill})</span>
                </span>
                <span className="flex gap-1">
                  {!child.path.includes(m.id) ? (
                    <button type="button" className="rounded-full bg-white px-3 py-1 text-sm" onClick={() => house.setPath(child.id, [...child.path, m.id])}>
                      Add
                    </button>
                  ) : null}
                  <Link
                    href={`/kids/${child.id}/play?mode=try&module=${m.id}`}
                    className="rounded-full bg-amber-300 px-3 py-1 text-sm font-bold text-stone-900"
                    onClick={() => {
                      if (!child.themeToday) house.pickTheme(child.id, "planets-space");
                    }}
                  >
                    Try
                  </Link>
                </span>
              </li>
            ))}
        </ul>
      </div>
    </div>
  );
}

function CreateModule({ child }: { child: Child }) {
  const house = useHouse();
  const [title, setTitle] = useState("");
  const [skill, setSkill] = useState("");
  const [seeds, setSeeds] = useState(child.track === "letters" ? "s, a, t" : "sat, pin");
  const lockedWords = !wordsUnlocked(child);
  return (
    <form
      className="rounded-2xl bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault();
        house.createAndAssign(child.id, {
          title,
          skill,
          track: lockedWords ? "letters" : child.track,
          seeds,
        });
        setTitle("");
      }}
    >
      <h3 className="font-black">Create a module from results</h3>
      <p className="text-sm text-stone-600">
        {lockedWords ? "Myles stays in letters/sounds until unlock." : "Seeds become tap, drag, and speak items."}
      </p>
      <input className="mt-2 w-full rounded-xl border px-3 py-2" placeholder="Module name" value={title} onChange={(e) => setTitle(e.target.value)} />
      <input className="mt-2 w-full rounded-xl border px-3 py-2" placeholder="Skill target" value={skill} onChange={(e) => setSkill(e.target.value)} />
      <textarea className="mt-2 w-full rounded-xl border px-3 py-2" value={seeds} onChange={(e) => setSeeds(e.target.value)} />
      <button className="mt-2 rounded-full bg-stone-900 px-4 py-2 text-white" type="submit">
        Create and put on path
      </button>
    </form>
  );
}

function LastSession({ childId }: { childId: string }) {
  const { state } = useHouse();
  const recent = [...state.attempts].reverse().filter((a) => a.kidId === childId).slice(0, 8);
  if (recent.length === 0) return null;
  return (
    <div className="rounded-2xl bg-white p-4">
      <h3 className="font-black">Last session</h3>
      <p className="text-sm text-stone-600">Misses stay after a later hit. Kid heard “not that one,” never fail.</p>
      <ul className="mt-2 space-y-1 text-sm">
        {recent.map((a) => (
          <li key={a.id}>
            {a.itemId} · {a.kind} · {a.correct ? "hit" : "miss"} · {a.kidSaw} · {a.ms}ms
            {a.spokenGrade ? ` · speak ${a.spokenGrade}` : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ScoutCard({ kidId }: { kidId: string }) {
  const house = useHouse();
  const report = [...house.state.scouts].reverse().find((s) => s.kidId === kidId);
  if (!report) return null;
  return (
    <div className="rounded-2xl bg-white p-4">
      <h3 className="font-black">Scout map — daily does not auto-change</h3>
      <p className="text-sm">
        Pack {report.pack} · ceiling {report.ceiling} · floor {report.floor} · {report.status}
      </p>
      <ul className="mt-2 text-sm">
        {report.bands.map((b) => (
          <li key={b.name}>
            {b.name}: {b.tag}
          </li>
        ))}
      </ul>
      {report.drafts.map((d) => (
        <p key={d.title} className="text-sm">
          Draft: {d.title} — {d.skill} ({d.stretch})
        </p>
      ))}
      {report.status === "pending" ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="rounded-full bg-stone-900 px-3 py-1 text-white" onClick={() => house.resolveScout(kidId, "approved")}>
            Approve drafts
          </button>
          <button type="button" className="rounded-full bg-white px-3 py-1" onClick={() => house.resolveScout(kidId, "approved", true)}>
            Ease drafts
          </button>
          <button type="button" className="rounded-full bg-white px-3 py-1" onClick={() => house.resolveScout(kidId, "ignored")}>
            Ignore
          </button>
        </div>
      ) : null}
    </div>
  );
}
