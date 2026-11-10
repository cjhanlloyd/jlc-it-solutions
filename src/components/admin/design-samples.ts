// Default sample details for a new admin design, per product type. Kept React-free so tests can check them against the occasion rules.
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
};
