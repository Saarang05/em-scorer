// All weights and thresholds live here. Tune scoring without touching logic.
export const RUBRIC_VERSION = '1';

export const RUBRIC = {
  academics: {
    label: 'Academics', max: 30,
    toPercent: { '10': 10, '4': 25, percent: 1 }, // multiply CGPA by this
    tiers: [[85, 30], [75, 24], [65, 16], [55, 8], [0, 2]], // [min %, points]
    backlogPenalty: 4,
  },
  degreeFit: { label: 'Degree fit', max: 15, direct: 15, related: 9, unrelated: 3 },
  work: {
    label: 'Work and internships', max: 15,
    tiers: [[24, 15], [12, 11], [6, 7]], // [min months, points]
    anyWork: 4, none: 0, unrelatedWeight: 0.5,
  },
  research: { label: 'Research', max: 10, publication: 10, project: 6 },
  projects: { label: 'Projects and skills', max: 10, perProject: 2 },
  english: {
    label: 'English', max: 10,
    ielts: [[7, 10], [6.5, 7], [6, 4]],
    toefl: [[100, 10], [90, 7], [80, 4]],
  },
  leadership: {
    label: 'Leadership and international exposure', max: 5,
    points: { leadership: 2, volunteering: 1, exchange: 2, language: 1 },
  },
  quality: { label: 'Resume quality', max: 5, perCheck: 1, maxPages: 2 },
};

export const BANDS = [
  { min: 80, name: 'Strong', message: 'Competitive for scholarship rounds.', priority: 'Hot' },
  { min: 60, name: 'Competitive', message: 'Good base; fix the top gaps before applying.', priority: 'Hot' },
  { min: 40, name: 'Needs work', message: 'Apply only after strengthening 2–3 areas.', priority: 'Warm' },
  { min: 0, name: 'Not ready yet', message: 'Build the profile first; target a later intake.', priority: 'Cold' },
];
