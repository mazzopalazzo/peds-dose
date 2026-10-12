'use strict';
/*
 * ALL CLINICAL CONTENT LIVES IN THIS FILE.
 *
 * PROTOTYPE DATA — drafted from general ERC/APLS-style rules of thumb and NOT
 * clinically validated. Every dose, cap, concentration and size must be checked
 * against local guidelines and signed off before any real-world use.
 *
 * Drug entry:
 *   name   display name
 *   dose   per-kg dose: number, [low, high], or (kg) => number | [low, high]
 *   unit   'mcg' | 'mg' | 'mmol' | 'mL' | 'J'
 *   max    absolute cap, same unit as dose (optional)
 *   conc   concentration in <unit> per mL — enables the "draw up" volume (optional)
 *   concLabel  how that concentration is shown to the user
 *   route, note, suffix   free text (optional)
 *
 * Equipment entry:
 *   name, value: (kg, months) => string, note (optional)
 */

// [weight in kg, approximate age in months]
const STEPS = [
  [3, 0], [3.5, 0], [4, 1], [4.5, 1.5], [5, 2], [6, 3], [7, 5], [8, 7], [9, 10],
  [10, 12], [11, 18], [12, 24], [13, 30], [14, 36], [15, 42], [16, 48], [17, 54],
  [18, 60], [19, 66], [20, 72], [22, 84], [24, 96], [26, 102], [28, 108], [30, 114],
  [32, 120], [35, 132], [40, 144], [45, 156], [50, 168],
];

// Weights that get a printed label on the dial.
const DIAL_LABELS = [3, 5, 10, 15, 20, 30, 40, 50];

function ageLabel(mo) {
  if (mo < 1) return 'Newborn';
  if (mo === 1.5) return '6 weeks';
  if (mo < 12) return mo + (mo === 1 ? ' month' : ' months');
  const y = Math.floor(mo / 12);
  const half = mo % 12 >= 6 ? '½' : '';
  return y + half + (y === 1 && !half ? ' year' : ' years');
}

const half = (x) => Math.round(x * 2) / 2;
const fix1 = (x) => x.toFixed(1);

function ett(kg, mo) {
  let uncuffed;
  if (mo < 6) uncuffed = 3.5;
  else if (mo < 18) uncuffed = 4.0;
  else if (mo < 24) uncuffed = 4.5;
  else uncuffed = half(mo / 48 + 4); // age/4 + 4
  const cuffed = Math.min(uncuffed - 0.5, 7.0); // age/4 + 3.5

  let oral;
  if (mo < 3 && kg < 5) oral = 6 + kg;
  else if (mo < 12) oral = 3 * uncuffed;
  else oral = mo / 24 + 12; // age/2 + 12
  const nasal = mo < 12 ? oral * 1.25 : mo / 24 + 15; // age/2 + 15

  return { cuffed, uncuffed, oral: half(oral), nasal: half(nasal) };
}

function vitals(kg, mo) {
  let v;
  if (mo < 12) v = { hr: '110–160', rr: '30–40', sbp: '70–90' };
  else if (mo < 24) v = { hr: '100–150', rr: '25–35', sbp: '80–95' };
  else if (mo < 60) v = { hr: '95–140', rr: '25–30', sbp: '80–100' };
  else if (mo < 144) v = { hr: '80–120', rr: '20–25', sbp: '90–110' };
  else v = { hr: '60–100', rr: '15–20', sbp: '100–120' };
  const perKg = mo < 1 ? 85 : mo < 12 ? 80 : mo < 144 ? 75 : 70;
  v.bloodVolume = Math.round(kg * perKg);
  v.bloodVolumePerKg = perKg;
  return v;
}

const maintenance = (kg) =>
  kg <= 10 ? 4 * kg : kg <= 20 ? 40 + 2 * (kg - 10) : 60 + (kg - 20);

const SECTIONS = [
  {
    id: 'resus', title: 'Resuscitation', color: 'red',
    items: [
      { name: 'Adrenaline', dose: 10, unit: 'mcg', max: 1000, conc: 100, concLabel: '0.1 mg/mL', route: 'IV/IO', note: 'every 3–5 min' },
      { name: 'Defibrillation', dose: 4, unit: 'J' },
      { name: 'Amiodarone', dose: 5, unit: 'mg', max: 300, conc: 50, concLabel: '50 mg/mL', route: 'IV/IO', note: 'after 3rd and 5th shock' },
      { name: 'Fluid bolus', dose: 10, unit: 'mL', note: 'balanced crystalloid, reassess' },
      { name: 'Glucose 10%', dose: 2, unit: 'mL', route: 'IV/IO', note: 'hypoglycaemia' },
      { name: 'Atropine', dose: 20, unit: 'mcg', max: 500, conc: 100, concLabel: 'diluted to 0.1 mg/mL', route: 'IV/IO' },
      { name: 'Adenosine', dose: 0.2, unit: 'mg', max: 6, conc: 3, concLabel: '3 mg/mL', route: 'rapid IV + flush', note: '2nd dose 0.3 mg/kg, max 12 mg' },
      { name: 'Sync. cardioversion', dose: [1, 2], unit: 'J', note: '1st, then 2nd shock' },
      { name: 'Calcium gluconate 10%', dose: 0.5, unit: 'mL', max: 20, route: 'slow IV' },
      { name: 'Sodium bicarbonate 8.4%', dose: 1, unit: 'mmol', conc: 1, concLabel: '1 mmol/mL', route: 'IV/IO' },
      { name: 'Tranexamic acid', dose: 15, unit: 'mg', max: 1000, conc: 100, concLabel: '100 mg/mL', route: 'IV over 10 min' },
      { name: 'Blood products', dose: 10, unit: 'mL', note: 'per product, reassess' },
    ],
  },
  {
    id: 'airway', title: 'Airway & equipment', color: 'blue',
    items: [
      { name: 'ETT cuffed', value: (kg, mo) => 'ID ' + fix1(ett(kg, mo).cuffed), note: 'have ±0.5 ready' },
      { name: 'ETT uncuffed', value: (kg, mo) => (mo < 96 ? 'ID ' + fix1(ett(kg, mo).uncuffed) : '—') },
      { name: 'ETT depth, oral', value: (kg, mo) => ett(kg, mo).oral + ' cm', note: 'at lips' },
      { name: 'ETT depth, nasal', value: (kg, mo) => ett(kg, mo).nasal + ' cm', note: 'at nostril' },
      {
        name: 'Laryngeal mask',
        value: (kg) => '# ' + (kg < 5 ? '1' : kg < 10 ? '1.5' : kg < 20 ? '2' : kg < 30 ? '2.5' : kg < 50 ? '3' : '3–4'),
      },
      {
        name: 'Laryngoscope blade',
        value: (kg, mo) => (mo < 3 ? 'Miller 0–1' : mo < 12 ? 'Miller 1' : mo < 36 ? 'Mac 1–2' : mo < 108 ? 'Mac 2' : 'Mac 3'),
      },
      {
        name: 'Oropharyngeal airway',
        value: (kg, mo) => '# ' + (mo < 1 ? '000–00' : mo < 12 ? '00–0' : mo < 36 ? '1' : mo < 108 ? '2' : '3'),
        note: 'incisors to angle of jaw',
      },
      {
        name: 'Suction catheter',
        value: (kg, mo) => {
          const fr = Math.round(ett(kg, mo).uncuffed * 2);
          return (fr % 2 ? fr - 1 + '–' + (fr + 1) : fr) + ' Fr';
        },
      },
      { name: 'Tidal volume', value: (kg) => Math.round(kg * 6) + '–' + Math.round(kg * 8) + ' mL', note: '6–8 mL/kg' },
      { name: 'Gastric tube', value: (kg, mo) => (mo < 12 ? '6–8' : mo < 72 ? '8–10' : mo < 144 ? '10–12' : '12–14') + ' Fr' },
      { name: 'Urinary catheter', value: (kg, mo) => (mo < 3 ? '5–6' : mo < 12 ? '6–8' : mo < 60 ? '8' : mo < 120 ? '8–10' : '10–12') + ' Fr' },
      { name: 'IV cannula', value: (kg, mo) => (mo < 1 ? '24 G' : mo < 12 ? '24–22 G' : kg < 30 ? '22–20 G' : '20–18 G') },
      { name: 'IO needle', value: (kg) => (kg < 40 ? '15 mm' : '25 mm'), note: 'longer if thick soft tissue' },
      { name: 'Chest drain', value: (kg, mo) => (mo < 1 ? '8–12' : mo < 12 ? '12–16' : mo < 96 ? '16–24' : '20–32') + ' Fr' },
    ],
  },
  {
    id: 'induction', title: 'Induction & relaxants', color: 'violet',
    items: [
      { name: 'Propofol', dose: [2, 4], unit: 'mg', conc: 10, concLabel: '10 mg/mL', route: 'IV' },
      { name: 'Ketamine', dose: [1, 2], unit: 'mg', conc: 10, concLabel: '10 mg/mL', route: 'IV' },
      { name: 'Thiopental', dose: [3, 5], unit: 'mg', conc: 25, concLabel: '25 mg/mL', route: 'IV' },
      { name: 'Fentanyl', dose: [1, 2], unit: 'mcg', conc: 50, concLabel: '50 mcg/mL', route: 'IV' },
      { name: 'Suxamethonium', dose: [1, 2], unit: 'mg', conc: 50, concLabel: '50 mg/mL', route: 'IV', note: '2 mg/kg in infants' },
      { name: 'Rocuronium (RSI)', dose: 1, unit: 'mg', conc: 10, concLabel: '10 mg/mL', route: 'IV' },
      { name: 'Sugammadex', dose: [2, 4], unit: 'mg', conc: 100, concLabel: '100 mg/mL', route: 'IV', note: 'routine / deep block' },
      { name: 'Sugammadex, immediate', dose: 16, unit: 'mg', conc: 100, concLabel: '100 mg/mL', route: 'IV' },
      { name: 'Neostigmine', dose: 50, unit: 'mcg', max: 2500, conc: 2500, concLabel: '2.5 mg/mL', route: 'IV' },
      { name: 'Glycopyrrolate', dose: 10, unit: 'mcg', max: 500, conc: 200, concLabel: '0.2 mg/mL', route: 'IV' },
      { name: 'Ephedrine', dose: [0.1, 0.2], unit: 'mg', conc: 5, concLabel: 'diluted to 5 mg/mL', route: 'IV' },
      { name: 'Phenylephrine', dose: [1, 2], unit: 'mcg', conc: 100, concLabel: 'diluted to 0.1 mg/mL', route: 'IV' },
    ],
  },
  {
    id: 'analgesia', title: 'Analgesia, sedation & reversal', color: 'teal',
    items: [
      { name: 'Morphine', dose: 0.1, unit: 'mg', conc: 1, concLabel: 'diluted to 1 mg/mL', route: 'IV', note: 'titrate' },
      { name: 'Paracetamol', dose: (kg) => (kg < 10 ? 7.5 : 15), unit: 'mg', max: 1000, conc: 10, concLabel: '10 mg/mL', route: 'IV' },
      { name: 'Midazolam', dose: [0.05, 0.1], unit: 'mg', max: 5, conc: 1, concLabel: '1 mg/mL', route: 'IV', note: 'sedation' },
      { name: 'Ondansetron', dose: 0.1, unit: 'mg', max: 4, conc: 2, concLabel: '2 mg/mL', route: 'IV' },
      { name: 'Dexamethasone', dose: 0.15, unit: 'mg', max: 8, conc: 4, concLabel: '4 mg/mL', route: 'IV', note: 'PONV' },
      { name: 'Naloxone', dose: 10, unit: 'mcg', max: 400, conc: 400, concLabel: '0.4 mg/mL', route: 'IV', note: 'repeat/titrate' },
      { name: 'Flumazenil', dose: 10, unit: 'mcg', max: 200, conc: 100, concLabel: '0.1 mg/mL', route: 'IV' },
    ],
  },
  {
    id: 'seizure', title: 'Seizures', color: 'amber',
    items: [
      { name: 'Midazolam, buccal', dose: 0.3, unit: 'mg', max: 10, conc: 5, concLabel: '5 mg/mL', route: 'buccal' },
      { name: 'Lorazepam', dose: 0.1, unit: 'mg', max: 4, route: 'IV' },
      { name: 'Diazepam, rectal', dose: 0.5, unit: 'mg', max: 20, route: 'PR' },
      { name: 'Levetiracetam', dose: 40, unit: 'mg', max: 3000, conc: 100, concLabel: '100 mg/mL', route: 'IV over 10 min' },
      { name: 'Phenobarbital', dose: 20, unit: 'mg', max: 1000, route: 'IV over 20 min' },
    ],
  },
  {
    id: 'crisis', title: 'Anaphylaxis & crises', color: 'orange',
    items: [
      { name: 'Adrenaline IM', dose: 10, unit: 'mcg', max: 500, conc: 1000, concLabel: '1 mg/mL', route: 'IM thigh', note: 'anaphylaxis' },
      { name: 'Hydrocortisone', dose: 4, unit: 'mg', max: 100, route: 'IV' },
      { name: 'Magnesium sulfate', dose: 50, unit: 'mg', max: 2000, route: 'IV over 20 min' },
      { name: 'Lipid emulsion 20%, bolus', dose: 1.5, unit: 'mL', route: 'IV over 1 min', note: 'LA toxicity' },
      { name: 'Lipid emulsion 20%, infusion', dose: 15, unit: 'mL', suffix: '/h', route: 'IV' },
      { name: 'Dantrolene', dose: 2.5, unit: 'mg', conc: 1 / 3, concLabel: '20 mg in 60 mL', route: 'IV', note: 'malignant hyperthermia' },
      { name: 'NaCl 3%', dose: 3, unit: 'mL', route: 'IV', note: 'raised ICP' },
      { name: 'Bupivacaine, max', dose: 2, unit: 'mg', note: 'max total dose' },
      { name: 'Lidocaine, max', dose: 3, unit: 'mg', note: 'max total, 7 mg/kg with adrenaline' },
    ],
  },
  {
    id: 'fluids', title: 'Fluids', color: 'sky',
    items: [
      { name: 'Maintenance', value: (kg) => maintenance(kg) + ' mL/h', note: '4-2-1 rule' },
      { name: 'Est. blood volume', value: (kg, mo) => vitals(kg, mo).bloodVolume + ' mL', note: 'age-based mL/kg' },
    ],
  },
];
