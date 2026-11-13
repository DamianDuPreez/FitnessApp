import { useState } from 'react'
import { db } from '../db/db'
import type { Exercise, TrackingType } from '../db/types'
import { MUSCLE_GROUPS } from './ExerciseList'

const ALL_MUSCLES = Object.values(MUSCLE_GROUPS).flat()
const EQUIPMENT = ['barbell', 'dumbbell', 'machine', 'cable', 'kettlebells', 'body only', 'bands', 'other']

export function CustomExerciseForm({ onCreated }: { onCreated: (e: Exercise) => void }) {
  const [name, setName] = useState('')
  const [muscle, setMuscle] = useState('chest')
  const [equipment, setEquipment] = useState('barbell')
  const [trackingType, setTrackingType] = useState<TrackingType>('weight_reps')

  const save = async () => {
    const trimmed = name.trim()
    if (!trimmed) return
    const ex: Exercise = {
      id: `custom-${Date.now().toString(36)}`,
      name: trimmed,
      category: 'strength',
      equipment,
      primaryMuscles: [muscle],
      secondaryMuscles: [],
      instructions: [],
      trackingType,
      popular: false,
      isCustom: true,
    }
    await db.exercises.add(ex)
    onCreated(ex)
  }

  return (
    <div className="stack">
      <label className="field">
        Name
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Hack Squat (gym machine)" autoFocus />
      </label>
      <label className="field">
        Main muscle
        <select className="input" value={muscle} onChange={(e) => setMuscle(e.target.value)}>
          {ALL_MUSCLES.map((m) => <option key={m}>{m}</option>)}
        </select>
      </label>
      <label className="field">
        Equipment
        <select className="input" value={equipment} onChange={(e) => setEquipment(e.target.value)}>
          {EQUIPMENT.map((m) => <option key={m}>{m}</option>)}
        </select>
      </label>
      <label className="field">
        What do you log?
        <select className="input" value={trackingType} onChange={(e) => setTrackingType(e.target.value as TrackingType)}>
          <option value="weight_reps">Weight × reps</option>
          <option value="bodyweight">Reps (bodyweight, optional added weight)</option>
          <option value="duration">Time</option>
        </select>
      </label>
      <button className="btn primary block" onClick={save} disabled={!name.trim()}>Create exercise</button>
    </div>
  )
}
