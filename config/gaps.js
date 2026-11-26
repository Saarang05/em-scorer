// One fix template per category. {field}, {points}, {max} and the other {words} are filled in code.
export const FIXES = {
  academics: 'Raise your academic standing: you are at {percent}% ({points}/{max}). Target the next tier ({nextTier}%+) in remaining semesters{backlogNote}.',
  degreeFit: 'Your degree is a weaker match for {field} ({points}/{max}). Add 2 credit-bearing courses or certifications in {field}, or consider a target field closer to your degree.',
  work: 'Add a {field} internship or job: you have {months} counted months ({points}/{max}). Reach {nextMonths} months to move up a tier.',
  research: {
    none: 'Add 1 research project or thesis in {field}; you have 0 research points.',
    some: 'Turn your research project into a journal or conference paper in {field} to go from {points} to {max} points.',
  },
  projects: 'Add {needed} substantial {field} project(s) with a clear problem, method and result; you have {points}/{max} points.',
  english: {
    none: 'Book IELTS or TOEFL now and aim for IELTS 7.0+ / TOEFL 100+; you have 0 English points.',
    some: 'Retake your English test and aim for IELTS 7.0+ / TOEFL 100+ to go from {points} to {max} points.',
  },
  leadership: 'Add a club leadership role, volunteering, an exchange or a language certificate; you have {points}/{max} points.',
  quality: 'Fix your resume ({points}/{max}): {failed}.',
};

export const QUALITY_FIXES = {
  shortEnough: 'cut it to 2 pages or fewer',
  datedEntries: 'add dates to every entry',
  quantifiedResults: 'quantify results (numbers, %, scale)',
  noClutter: 'remove the photo and date of birth',
  standardSections: 'use Europass-style sections (Education, Experience, Skills, Languages)',
};
