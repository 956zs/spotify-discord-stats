import assert from 'node:assert/strict';
import test from 'node:test';
import { renderRecapMessages } from '../shared/recap-renderer.js';

test('recap renderer emits Discord Components v2 payloads', () => {
  const messages = renderRecapMessages(recapFixture());
  const types = messages.flatMap((message) => componentTypes(message.components));

  assert.equal(messages.length, 4);
  assert.ok(messages.every((message) => message.flags === 32768));
  assert.ok(messages.every((message) => message.allowed_mentions.parse.length === 0));
  assert.ok(messages.every((message) => message.content === undefined));
  assert.ok(messages.every((message) => message.embeds === undefined));
  assert.ok(types.includes(17));
  assert.ok(types.includes(9));
  assert.ok(types.includes(10));
  assert.ok(types.includes(11));
  assert.ok(types.includes(12));
  assert.ok(types.includes(14));
  assert.ok(messages.every((message) => componentTypes(message.components).length <= 40));
  assert.ok(messageText(messages).includes('# ✦ Weekly Recap'));
  assert.ok(messageText(messages).includes('## ✦ Rankings'));
  assert.match(messageText(messages), /<t:\d+:F>/);
  assert.match(messageText(messages), /<t:\d+:R>/);
  assert.match(messageText(messages), /<t:\d+:D>/);
  assert.doesNotMatch(messageText(messages), /`<t:\d+:[A-Za-z]>`/);
});

test('recap renderer omits invalid section thumbnails when artwork is unavailable', () => {
  const recap = recapFixture();
  recap.topTracks[0].albumImageUrl = null;
  recap.topAlbums[0].albumImageUrl = null;
  const messages = renderRecapMessages(recap);

  assert.equal(hasNullAccessory(messages), false);
});

function componentTypes(components) {
  return components.flatMap((component) => [
    component.type,
    ...componentTypes(component.components ?? []),
    ...(component.accessory ? componentTypes([component.accessory]) : []),
    ...(component.items ? component.items.map(() => 12) : [])
  ]);
}

function hasNullAccessory(messages) {
  return JSON.stringify(messages).includes('"accessory":null');
}

function messageText(messages) {
  return JSON.stringify(messages);
}

function recapFixture() {
  return {
    range: {
      kind: 'weekly',
      timeZone: 'Asia/Taipei',
      start: '2026-07-01T01:00:00.000Z',
      end: '2026-07-08T01:00:00.000Z'
    },
    summary: {
      songsPlayed: 118,
      listeningMs: 34920000,
      uniqueSongs: 76,
      differentArtists: 42,
      differentAlbums: 51
    },
    comparison: {
      songsPlayedDelta: 28,
      listeningMsDelta: 4440000,
      uniqueSongsDelta: 12,
      differentArtistsDelta: 7,
      differentAlbumsDelta: 8
    },
    topTracks: [
      track('Golden Hour', 'JVKE', 9, 'https://example.com/golden.jpg'),
      track('Sweet Disposition', 'The Temper Trap', 7, 'https://example.com/sweet.jpg')
    ],
    topArtists: [
      { artistKey: 'artist:jvke', artistName: 'JVKE', plays: 9 },
      { artistKey: 'artist:temper', artistName: 'The Temper Trap', plays: 7 }
    ],
    topAlbums: [
      album('summer flows 0.02', 14, 'https://example.com/album-one.jpg'),
      album('Get Up', 12, 'https://example.com/album-two.jpg')
    ],
    newTracks: [track('New Light', 'The Sample Artist', 3, 'https://example.com/new.jpg')],
    patterns: {
      peakDay: { date: '2026-07-07', plays: 31, listeningMs: 5580000 },
      peakHour: { hour: 22, label: '22:00', plays: 18 },
      lateNightPercent: 46,
      longestStreakDays: 6,
      listeningDays: 7
    }
  };
}

function track(trackName, artistName, plays, albumImageUrl) {
  return {
    trackKey: `track:${trackName}`,
    trackName,
    artists: [artistName],
    albumName: `Album ${trackName}`,
    albumImageUrl,
    plays,
    listeningMs: plays * 180000
  };
}

function album(albumName, plays, albumImageUrl) {
  return {
    albumKey: `album:${albumName}`,
    albumName,
    albumImageUrl,
    plays,
    listeningMs: plays * 180000
  };
}
