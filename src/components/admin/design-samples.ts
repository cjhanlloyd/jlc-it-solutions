// Default sample details for a new admin design, per product type. Kept React-free so tests can check them against the occasion rules.
// Golden (milestone) sample, used for the Golden design kit in docs/designs/birthday.md.
export const MILESTONE_SAMPLE: object = {
  celebrant: 'Roberto Santos', age: 50, eventDate: '2027-05-22', eventTime: '18:00', headline: 'Fifty years, well lived',
  theme: 'fifty years, well lived', venue: { name: 'The Grand Ballroom', address: 'Makati City', mapUrl: '' },
  schedule: [{ time: '18:00', label: 'Cocktails' }, { time: '19:00', label: 'Dinner' }, { time: '20:30', label: 'Toasts & dancing' }],
  dressCode: 'Filipiniana / Barong', message: 'Join us for an evening to celebrate Roberto.', hostedBy: 'The Santos family',
};

export const SAMPLES: Record<string, object> = {
  wedding_invitation: {
    partner1: 'Maria', partner2: 'Juan', eventDate: '2027-06-12', eventTime: '16:00',
    ceremony: { name: 'St. Joseph Church', address: 'Manila', mapUrl: '' }, schedule: [], message: 'We would love to celebrate with you.',
  },
  birthday_invitation: {
    celebrant: 'Mia', age: 7, eventDate: '2027-03-14', eventTime: '14:00', theme: 'Under the Sea', headline: 'Come splash and play with us!',
    venue: { name: 'Jollibee Party Room', address: 'SM North EDSA, Quezon City', mapUrl: '' },
    schedule: [{ time: '14:00', label: 'Games & magic show' }, { time: '15:00', label: 'Cake & candles' }, { time: '15:30', label: 'Loot bags' }],
    dressCode: 'Come in blue or a sea-creature costume', giftsNote: 'Gift idea: books or art sets', message: 'Mia is turning seven and would love to celebrate with you!',
    hostedBy: 'Anna & Carlo',
  },
  debut_invitation: {
    debutante: 'Ana Reyes', eventDate: '2027-08-21', eventTime: '18:00', headline: 'A night to remember', theme: 'Enchanted Garden',
    venue: { name: 'The Rose Ballroom', address: 'Pasig City', mapUrl: '' },
    schedule: [{ time: '18:00', label: 'Arrival & cocktails' }, { time: '19:00', label: 'Cotillion & 18 Roses' }, { time: '20:00', label: 'Dinner, 18 Candles & Treasures' }, { time: '21:30', label: 'Party' }],
    escort: 'Miguel Santos', hostedBy: 'Mr. & Mrs. Reyes', dressCode: 'Formal, in shades of blush and gold',
    message: 'Please join us as Ana celebrates her eighteenth birthday.',
    roses: ['Ramon Reyes (father)', 'Paolo Reyes', 'Tito Ben Cruz', 'Miguel Santos'],
    candles: ['Liza Reyes (mother)', 'Lola Carmen', 'Bea Cruz', 'Joy Tan'],
    treasures: ['Tita Marie', 'Ninang Grace', 'Carla Lim'],
  },
};
