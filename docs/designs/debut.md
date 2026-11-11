# Debut design kit

Ready-to-paste entry for the admin Designs tab (Occasion: Debut). Price: set by you.
The preview image is served from `public/designs/debut/` (the admin accepts only https URLs).

## Blush (debut)

- Suggested name: Blush Debut
- Slug: `blush-debut`
- Layout: `blush`
- Price: set by you
- Preview image URL: `https://jlcitsolutions.com/designs/debut/blush.png`
- Colour schemes (primary / accent / background / text):
  1. Blush Rose: `#9d4a5c`, `#c9a25e`, `#fdf5f4`, `#3d2a2e`
  2. Lilac Dream: `#6b4c9a`, `#c79bc2`, `#f8f5fc`, `#2f2540`

Customers fill in up to 18 names each for the 18 Roses, 18 Candles and 18 Treasures (all optional), plus an Escort.
The invitation lists them under "The court".

Sample details:

```json
{
  "debutante": "Ana Reyes",
  "eventDate": "2027-08-21",
  "eventTime": "18:00",
  "headline": "A night to remember",
  "theme": "Enchanted Garden",
  "venue": {
    "name": "The Rose Ballroom",
    "address": "Pasig City",
    "mapUrl": ""
  },
  "schedule": [
    {
      "time": "18:00",
      "label": "Arrival & cocktails"
    },
    {
      "time": "19:00",
      "label": "Cotillion & 18 Roses"
    },
    {
      "time": "20:00",
      "label": "Dinner, 18 Candles & Treasures"
    },
    {
      "time": "21:30",
      "label": "Party"
    }
  ],
  "escort": "Miguel Santos",
  "hostedBy": "Mr. & Mrs. Reyes",
  "dressCode": "Formal, in shades of blush and gold",
  "message": "Please join us as Ana celebrates her eighteenth birthday.",
  "roses": [
    "Ramon Reyes (father)",
    "Paolo Reyes",
    "Tito Ben Cruz",
    "Miguel Santos"
  ],
  "candles": [
    "Liza Reyes (mother)",
    "Lola Carmen",
    "Bea Cruz",
    "Joy Tan"
  ],
  "treasures": [
    "Tita Marie",
    "Ninang Grace",
    "Carla Lim"
  ]
}
```
