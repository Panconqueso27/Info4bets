import { useState } from 'preact/hooks';
import { defaultLook, HAIR_COLORS, HAIRS, OUTFIT_COLORS, OUTFITS, randomLook, SKINS, type Option } from '../art/character';
import { ROLES } from '../core/roles';
import type { Character, Look, Role } from '../core/types';
import { CharacterCanvas } from './CharacterCanvas';

export function TitleScreen({ hasSave, onContinue, onNew }: { hasSave: boolean; onContinue: () => void; onNew: () => void }) {
  return (
    <div class="screen title-screen">
      <div class="logo">
        <h1>LA<br />CIUDAD</h1>
        <div class="sub">NUEVA YORK · 1985</div>
        <div class="note">(título provisional)</div>
      </div>
      <div class="stack">
        {hasSave && (
          <button class="btn" onClick={onContinue}>
            Continuar
          </button>
        )}
        <button class={`btn ${hasSave ? 'secondary' : ''}`} onClick={onNew}>
          Nueva partida
        </button>
      </div>
    </div>
  );
}

export function RoleSelect({ onPick, onBack }: { onPick: (r: Role) => void; onBack: () => void }) {
  return (
    <div class="screen">
      <h2>¿Quién eres en esta ciudad?</h2>
      <div class="stack">
        {(Object.keys(ROLES) as Role[]).map((id) => {
          const r = ROLES[id];
          return (
            <button key={id} class="role-card" onClick={() => onPick(id)}>
              <CharacterCanvas look={defaultLook(id)} scale={3} />
              <div class="info">
                <h3>{r.title}</h3>
                <div class="tag">{r.tagline}</div>
                <p>{r.description}</p>
                <div class="chips">
                  {r.bars.map((b, i) => (
                    <span key={b.id} class={`chip ${i >= 3 ? 'excl' : ''}`}>
                      {b.icon} {b.label}
                    </span>
                  ))}
                </div>
                <div class="lose">☠ {r.loseConditions}</div>
              </div>
            </button>
          );
        })}
      </div>
      <div class="spacer" />
      <button class="btn secondary" style={{ marginTop: 14 }} onClick={onBack}>
        Volver
      </button>
    </div>
  );
}

export function IdentityForm({
  role,
  onDone,
  onBack,
}: {
  role: Role;
  onDone: (name: string, age: number) => void;
  onBack: () => void;
}) {
  const def = ROLES[role];
  const [name, setName] = useState('');
  const [age, setAge] = useState(String(role === 'alcalde' ? 48 : 26));
  const [error, setError] = useState('');
  const [min, max] = def.ageRange;

  const submit = (e: Event) => {
    e.preventDefault();
    const n = name.trim();
    const a = Number(age);
    if (n.length < 2) return setError('El nombre debe tener al menos 2 letras.');
    if (!Number.isInteger(a) || a < min || a > max) return setError(`La edad debe estar entre ${min} y ${max}.`);
    onDone(n, a);
  };

  return (
    <form class="screen" onSubmit={submit}>
      <h2>{def.title}</h2>
      <label class="field">
        <span>NOMBRE</span>
        <input value={name} maxLength={16} autoFocus onInput={(e) => setName(e.currentTarget.value)} placeholder="Escribe un nombre" />
      </label>
      <label class="field">
        <span>EDAD ({min}–{max})</span>
        <input value={age} inputMode="numeric" maxLength={2} onInput={(e) => setAge(e.currentTarget.value.replace(/\D/g, ''))} />
      </label>
      <div class="error">{error}</div>
      <div class="spacer" />
      <div class="row">
        <button type="button" class="btn secondary" onClick={onBack}>
          Volver
        </button>
        <button type="submit" class="btn">
          Siguiente
        </button>
      </div>
    </form>
  );
}

function Cycle({ label, options, value, onChange }: { label: string; options: Option[]; value: string; onChange: (v: string) => void }) {
  const i = Math.max(0, options.findIndex((o) => o.id === value));
  const step = (d: number) => onChange(options[(i + d + options.length) % options.length].id);
  return (
    <div class="selector">
      <div class="label">{label}</div>
      <button type="button" class="arrow" onClick={() => step(-1)} aria-label={`${label} anterior`}>
        ◀
      </button>
      <div class="value">{options[i].label}</div>
      <button type="button" class="arrow" onClick={() => step(1)} aria-label={`${label} siguiente`}>
        ▶
      </button>
    </div>
  );
}

function Swatches({ label, colors, value, onChange }: { label: string; colors: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div class="selector">
      <div class="label">{label}</div>
      <div class="swatches">
        {colors.map((c) => (
          <button
            type="button"
            key={c}
            class={`swatch ${c === value ? 'on' : ''}`}
            style={{ background: c }}
            onClick={() => onChange(c)}
            aria-label={`${label} ${c}`}
          />
        ))}
      </div>
    </div>
  );
}

export function Customizer({
  role,
  name,
  age,
  onDone,
  onBack,
}: {
  role: Role;
  name: string;
  age: number;
  onDone: (c: Character) => void;
  onBack: () => void;
}) {
  const [look, setLook] = useState<Look>(() => defaultLook(role));
  const set = (patch: Partial<Look>) => setLook({ ...look, ...patch });

  return (
    <div class="screen">
      <h2>
        {name}, {age}
      </h2>
      <div class="preview">
        <CharacterCanvas look={look} scale={6} walk />
      </div>
      <Cycle label="ROPA" options={OUTFITS[role]} value={look.outfit} onChange={(outfit) => set({ outfit })} />
      <Cycle label="PEINADO" options={HAIRS} value={look.hair} onChange={(hair) => set({ hair })} />
      <Swatches label="COLOR ROPA" colors={OUTFIT_COLORS} value={look.outfitColor} onChange={(outfitColor) => set({ outfitColor })} />
      <Swatches label="PELO" colors={HAIR_COLORS} value={look.hairColor} onChange={(hairColor) => set({ hairColor })} />
      <Swatches label="PIEL" colors={SKINS} value={look.skin} onChange={(skin) => set({ skin })} />
      <div class="spacer" />
      <div class="stack" style={{ marginTop: 8 }}>
        <button type="button" class="btn secondary" onClick={() => setLook(randomLook(role))}>
          🎲 Aleatorio
        </button>
        <div class="row">
          <button type="button" class="btn secondary" onClick={onBack}>
            Volver
          </button>
          <button type="button" class="btn" onClick={() => onDone({ role, name, age, look })}>
            Empezar
          </button>
        </div>
      </div>
    </div>
  );
}
