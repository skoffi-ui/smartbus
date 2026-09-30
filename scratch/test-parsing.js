const data = {
  status: 4,
  time: null,
  show: '10-07-2026 17:01:28',
  raw_time: '2026-07-10 17:01:28',
  distance: 0,
  driver: null,
  items: {
    32: {
      items: [
        {
          lat: 1.1,
          lng: 1.2,
        },
      ],
    },
    33: {
      items: [
        {
          lat: 5.429022,
          lng: -4.143383,
        },
      ],
    },
  },
};

let latestPosition = null;

let groups = [];
if (Array.isArray(data)) {
  groups = data;
} else if (data && data.items) {
  groups = Array.isArray(data.items) ? data.items : Object.values(data.items);
}

if (groups.length > 0) {
  const lastGroup = groups[groups.length - 1];
  let subItems = [];
  if (lastGroup.items) {
    subItems = Array.isArray(lastGroup.items)
      ? lastGroup.items
      : Object.values(lastGroup.items);
  }

  if (subItems.length > 0) {
    latestPosition = subItems[subItems.length - 1];
  } else {
    latestPosition = lastGroup;
  }
}

console.log('Extracted:', latestPosition);
