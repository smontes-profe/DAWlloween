/**
 * @file hallOfFameView.test.js
 * @description Unit and Integration tests for HallOfFameView and Hall of Fame presentation layer.
 * Standards: UK English (en-GB), Node.js native test runner (node:test).
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { HallOfFameView, sanitizeText, formatRelativeDate } from '../src/views/hallOfFameView.js';

/**
 * Creates a lightweight DOM mock environment for node:test runner.
 */
function createMockElement(tagName = 'div') {
  return {
    tagName: tagName.toUpperCase(),
    innerHTML: '',
    className: '',
    classList: {
      _classes: new Set(),
      add: function (...args) { args.forEach((c) => this._classes.add(c)); },
      remove: function (...args) { args.forEach((c) => this._classes.delete(c)); },
      contains: function (c) { return this._classes.has(c); }
    },
    _listeners: new Map(),
    addEventListener(event, handler) {
      if (!this._listeners.has(event)) {
        this._listeners.set(event, []);
      }
      this._listeners.get(event).push(handler);
    },
    removeEventListener(event, handler) {
      if (this._listeners.has(event)) {
        const list = this._listeners.get(event);
        const idx = list.indexOf(handler);
        if (idx !== -1) list.splice(idx, 1);
      }
    },
    dispatchEvent(event) {
      const list = this._listeners.get(event.type) || [];
      for (const fn of list) fn(event);
    },
    querySelector(selector) {
      // Basic mock selector matching for known Hall of Fame IDs
      if (selector === '#hall-grid-container') {
        if (!this._grid) this._grid = createMockElement('div');
        return this._grid;
      }
      if (selector === '#hall-count-badge') {
        if (!this._badge) this._badge = createMockElement('span');
        return this._badge;
      }
      if (selector === '#btn-hall-refresh') {
        if (!this._refreshBtn) this._refreshBtn = createMockElement('button');
        return this._refreshBtn;
      }
      if (selector === '#btn-fab-refresh') {
        if (!this._fabBtn) this._fabBtn = createMockElement('button');
        return this._fabBtn;
      }
      return null;
    }
  };
}

describe('Hall of Fame Helper Utilities (US4.1 / T2)', () => {
  it('should sanitize potentially malicious HTML to prevent XSS vulnerabilities', () => {
    assert.equal(sanitizeText('<script>alert("boo!")</script>'), '&lt;script&gt;alert(&quot;boo!&quot;)&lt;/script&gt;');
    assert.equal(sanitizeText('Ghost & "Ghoul" <3> \'Witch\''), 'Ghost &amp; &quot;Ghoul&quot; &lt;3&gt; &#39;Witch&#39;');
    assert.equal(sanitizeText(null), '');
    assert.equal(sanitizeText(undefined), '');
    assert.equal(sanitizeText(123), '');
  });

  it('should format timestamps into descriptive relative representations', () => {
    assert.equal(formatRelativeDate(null), 'Reciente');
    assert.equal(formatRelativeDate('invalid-date'), 'Reciente');

    const now = new Date();

    // 10 seconds ago
    const secondsAgo = new Date(now.getTime() - 10 * 1000).toISOString();
    assert.equal(formatRelativeDate(secondsAgo), 'Hace unos segundos');

    // 5 minutes ago
    const minutesAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
    assert.equal(formatRelativeDate(minutesAgo), 'Hace 5 mins');

    // 2 hours ago
    const hoursAgo = new Date(now.getTime() - 2 * 3600 * 1000).toISOString();
    assert.equal(formatRelativeDate(hoursAgo), 'Hace 2 hs');

    // 3 days ago
    const daysAgo = new Date(now.getTime() - 3 * 86400 * 1000).toISOString();
    assert.equal(formatRelativeDate(daysAgo), 'Hace 3 días');
  });
});

describe('HallOfFameView Component Unit Tests (US4.1 / T2)', () => {
  let mockContainer;
  let mockSupabase;
  let mockAlerts;

  beforeEach(() => {
    mockContainer = createMockElement('main');

    mockSupabase = {
      fetchHallOfFame: async () => [
        {
          id: 'test-1',
          nickname: 'ScaryPumpkin',
          video_url: 'https://example.com/reactions/reaction_1.webm',
          photo_url: null,
          created_at: new Date().toISOString()
        },
        {
          id: 'test-2',
          nickname: 'GhostlyPlayer',
          video_url: null,
          photo_url: 'https://example.com/reactions/reaction_2.webp',
          created_at: new Date(Date.now() - 120000).toISOString()
        }
      ]
    };

    mockAlerts = {
      infoCalls: [],
      errorCalls: [],
      info(msg, title) { this.infoCalls.push({ msg, title }); },
      error(msg, title) { this.errorCalls.push({ msg, title }); }
    };
  });

  it('should initialise and generate initial template with skeletons upon mounting', () => {
    const view = new HallOfFameView({
      supabaseService: mockSupabase,
      alertsService: mockAlerts
    });

    view.mount(mockContainer);

    assert.ok(mockContainer.innerHTML.includes('Hall of Fame'));
    assert.ok(mockContainer.innerHTML.includes('hall-grid'));
    assert.ok(mockContainer.innerHTML.includes('reaction-skeleton'));
    assert.ok(mockContainer.innerHTML.includes('btn-fab-refresh'));
  });

  it('should fetch and render reaction cards accurately for videos and photos', async () => {
    const view = new HallOfFameView({
      supabaseService: mockSupabase,
      alertsService: mockAlerts
    });

    await view.mount(mockContainer);

    const grid = mockContainer.querySelector('#hall-grid-container');
    assert.ok(grid.innerHTML.includes('ScaryPumpkin'));
    assert.ok(grid.innerHTML.includes('video class="reaction-card__video"'));
    assert.ok(grid.innerHTML.includes('🎬 Vídeo'));

    assert.ok(grid.innerHTML.includes('GhostlyPlayer'));
    assert.ok(grid.innerHTML.includes('img class="reaction-card__image"'));
    assert.ok(grid.innerHTML.includes('📷 Foto'));

    const badge = mockContainer.querySelector('#hall-count-badge');
    assert.equal(badge.textContent, '2 Almas Inmortalizadas');
  });

  it('should render empty state when no reaction records exist in cloud storage', async () => {
    const emptySupabase = {
      fetchHallOfFame: async () => []
    };

    const view = new HallOfFameView({
      supabaseService: emptySupabase,
      alertsService: mockAlerts
    });

    await view.mount(mockContainer);

    const grid = mockContainer.querySelector('#hall-grid-container');
    assert.ok(grid.innerHTML.includes('hall-empty'));
    assert.ok(grid.innerHTML.includes('El mural de las almas está en silencio'));
    assert.ok(grid.innerHTML.includes('href="#home"'));

    const badge = mockContainer.querySelector('#hall-count-badge');
    assert.equal(badge.textContent, '0 Almas Inmortalizadas');
  });

  it('should display error layout and emit alert toast when cloud fetch fails', async () => {
    const failingSupabase = {
      fetchHallOfFame: async () => {
        throw new Error('Network timeout in classroom');
      }
    };

    const view = new HallOfFameView({
      supabaseService: failingSupabase,
      alertsService: mockAlerts
    });

    await view.mount(mockContainer);

    const grid = mockContainer.querySelector('#hall-grid-container');
    assert.ok(grid.innerHTML.includes('Interrupción de Comunicación'));
    assert.equal(mockAlerts.errorCalls.length, 1);
    assert.equal(mockAlerts.errorCalls[0].title, 'Error de Conexión');
  });

  it('should integrate seamlessly with appRouter to mount HallOfFameView on #hall-of-fame', async () => {
    const { Router, registerApplicationRoutes } = await import('../src/app.js');
    const router = new Router();
    registerApplicationRoutes(router);
    assert.equal(router.routes.has('#hall-of-fame'), true);

    const registeredView = router.routes.get('#hall-of-fame');
    assert.ok(registeredView instanceof HallOfFameView);
  });

  it('should trigger manual refresh via FAB and emit info alert upon completion', async () => {
    let fetchCount = 0;
    const trackingSupabase = {
      fetchHallOfFame: async () => {
        fetchCount++;
        return [
          {
            id: `test-${fetchCount}`,
            nickname: `RefreshedPlayer_${fetchCount}`,
            video_url: null,
            photo_url: 'https://example.com/photo.webp',
            created_at: new Date().toISOString()
          }
        ];
      }
    };

    const view = new HallOfFameView({
      supabaseService: trackingSupabase,
      alertsService: mockAlerts
    });

    await view.mount(mockContainer);
    assert.equal(fetchCount, 1);

    // Trigger FAB click
    await view.refreshWithSpin();
    assert.equal(fetchCount, 2);

    const grid = mockContainer.querySelector('#hall-grid-container');
    assert.ok(grid.innerHTML.includes('RefreshedPlayer_2'));
    assert.ok(mockAlerts.infoCalls.some((c) => c.msg.includes('Mural de reacciones actualizado')));
  });

  it('should preserve existing cards on screen if manual refresh encounters an error', async () => {
    let callIndex = 0;
    const intermittentSupabase = {
      fetchHallOfFame: async () => {
        callIndex++;
        if (callIndex === 1) {
          return [{ id: '1', nickname: 'SurvivorOne', photo_url: 'https://example.com/p.webp' }];
        }
        throw new Error('Temporary glitch');
      }
    };

    const view = new HallOfFameView({
      supabaseService: intermittentSupabase,
      alertsService: mockAlerts
    });

    await view.mount(mockContainer);
    const grid = mockContainer.querySelector('#hall-grid-container');
    assert.ok(grid.innerHTML.includes('SurvivorOne'));

    // Manual refresh fails, but cards should be preserved
    await view.refreshWithSpin();
    assert.ok(grid.innerHTML.includes('SurvivorOne'));
    assert.equal(mockAlerts.errorCalls.length, 1);
  });

  it('should clean up timers and references upon destroy()', () => {
    const view = new HallOfFameView({
      supabaseService: mockSupabase,
      alertsService: mockAlerts
    });

    view.mount(mockContainer);
    view.pollTimer = 999;
    view.destroy();

    assert.equal(view.pollTimer, null);
    assert.equal(view.container, null);
  });
});
