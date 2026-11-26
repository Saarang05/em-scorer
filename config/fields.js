// Target fields. "direct" bachelor subjects score full degree-fit points, "related" score partial.
export const FIELDS = {
  cs: { label: 'Computer Science & Software', direct: ['cs', 'data-ai'], related: ['electrical', 'physics-maths'] },
  'data-ai': { label: 'Data Science & AI', direct: ['data-ai', 'cs'], related: ['electrical', 'physics-maths', 'mechanical', 'business'] },
  electrical: { label: 'Electrical, Electronics & Photonics', direct: ['electrical'], related: ['cs', 'mechanical', 'physics-maths'] },
  mechanical: { label: 'Mechanical, Robotics & Materials', direct: ['mechanical'], related: ['electrical', 'physics-maths', 'civil', 'cs'] },
  civil: { label: 'Civil & Construction', direct: ['civil'], related: ['mechanical', 'environment'] },
  environment: { label: 'Environment, Energy & Sustainability', direct: ['environment'], related: ['civil', 'mechanical', 'health', 'physics-maths', 'electrical', 'policy'] },
  health: { label: 'Public Health & Life Sciences', direct: ['health'], related: ['environment', 'physics-maths', 'policy'] },
  'physics-maths': { label: 'Physics, Chemistry & Mathematics', direct: ['physics-maths'], related: ['electrical', 'mechanical', 'cs', 'data-ai'] },
  business: { label: 'Business, Economics & Management', direct: ['business'], related: ['policy', 'data-ai', 'cs'] },
  policy: { label: 'Public Policy, Development & Social Sciences', direct: ['policy'], related: ['business', 'humanities', 'environment', 'health'] },
  humanities: { label: 'Humanities, Languages & Media', direct: ['humanities'], related: ['policy', 'business'] },
};
export const FIELD_IDS = Object.keys(FIELDS);
